/**
 * Formula Solver Utility
 *
 * Parses engineering formulas from a database, maps variable symbols to
 * input/output names, supports forward calculation and bidirectional
 * solving (bisection) for missing inputs.
 *
 * Uses mathjs for safe, robust expression evaluation.
 */

import { evaluate as mathEvaluate, compile as mathCompile } from 'mathjs'

// ─── Type Definitions ───────────────────────────────────────────────────────

export interface InputConfig {
  name: string
  symbol: string
  unit: string
  type: string
  required: boolean
  default?: number
  min_value?: number
  max_value?: number
  help_text?: string
}

export interface OutputConfig {
  name: string
  symbol: string
  unit: string
  type: string
  precision: number
}

export interface ParsedStepFormula {
  isComputable: boolean
  equations: {
    outputName: string
    outputSymbol: string
    expression: string // mathjs-evaluable expression with names
    originalFormula: string
  }[]
  symbolMap: Record<string, string> // symbol → name
  allInputNames: string[]
  allOutputNames: string[]
}

export interface SolveResult {
  values: Record<string, string>
  autoCalculated: Record<string, boolean>
  error: string | null
}

// ─── Greek Letter Mapping ───────────────────────────────────────────────────

const GREEK_MAP: Record<string, string> = {
  'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta',
  'ε': 'epsilon', 'ζ': 'zeta', 'η': 'eta', 'θ': 'theta',
  'ι': 'iota', 'κ': 'kappa', 'λ': 'lambda', 'μ': 'mu',
  'ν': 'nu', 'ξ': 'xi', 'ο': 'omicron', 'π': 'pi',
  'ρ': 'rho', 'σ': 'sigma', 'τ': 'tau', 'υ': 'upsilon',
  'φ': 'phi', 'χ': 'chi', 'ψ': 'psi', 'ω': 'omega',
  // Uppercase Greek
  'Α': 'Alpha', 'Β': 'Beta', 'Γ': 'Gamma', 'Δ': 'Delta',
  'Ε': 'Epsilon', 'Ζ': 'Zeta', 'Η': 'Eta', 'Θ': 'Theta',
  'Ι': 'Iota', 'Κ': 'Kappa', 'Λ': 'Lambda', 'Μ': 'Mu',
  'Ν': 'Nu', 'Ξ': 'Xi', 'Ο': 'Omicron', 'Π': 'Pi',
  'Ρ': 'Rho', 'Σ': 'Sigma', 'Τ': 'Tau', 'Υ': 'Upsilon',
  'Φ': 'Phi', 'Χ': 'Chi', 'Ψ': 'Psi', 'Ω': 'Omega',
}

// ─── Special Character Cleaning ─────────────────────────────────────────────

/**
 * Escape regex metacharacters in a string.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Normalise special engineering characters so the formula is
 * parseable by mathjs and our symbol-replacement logic.
 *
 * Order matters: Greek letters are replaced first so that composite
 * symbols like κ are turned into valid identifiers before we process
 * √, ², primes, etc.
 */
function cleanSpecialChars(formula: string): string {
  let cleaned = formula

  // 1. Replace Greek letters with their latin equivalents
  for (const [greek, latin] of Object.entries(GREEK_MAP)) {
    cleaned = cleaned.replace(new RegExp(escapeRegExp(greek), 'g'), latin)
  }

  // 2. Replace √ with sqrt()
  //    √(expr) → sqrt(expr)
  cleaned = cleaned.replace(/√\(/g, 'sqrt(')
  //    √3 → sqrt(3), √2 → sqrt(2), etc.
  cleaned = cleaned.replace(/√(\d+(?:\.\d+)?)/g, 'sqrt($1)')
  //    √var → sqrt(var)  (single variable after √)
  cleaned = cleaned.replace(/√([a-zA-Z_]\w*)/g, 'sqrt($1)')

  // 3. Replace superscript digits
  cleaned = cleaned.replace(/²/g, '**2')
  cleaned = cleaned.replace(/³/g, '**3')
  cleaned = cleaned.replace(/⁴/g, '**4')
  cleaned = cleaned.replace(/ⁿ/g, '**n')
  cleaned = cleaned.replace(/⁻¹/g, '**(-1)')

  // 4. Replace multiplication / division signs
  cleaned = cleaned.replace(/×/g, '*')
  cleaned = cleaned.replace(/÷/g, '/')

  // 5. Replace primes (I_k'' → I_k_dblprime, I_k' → I_k_prime)
  cleaned = cleaned.replace(/''/g, '_dblprime')
  cleaned = cleaned.replace(/'/g, '_prime')

  return cleaned
}

// ─── Non-Computable Equation Detection ──────────────────────────────────────

/**
 * Keywords / symbols that indicate an equation is descriptive rather
 * than computable (e.g. "I_z ≥ I_b → select cable CSA").
 */
const NON_COMPUTABLE_KEYWORDS: string[] = [
  'table', 'select', 'choose', 'lookup', 'per ', 'per)',
  '≥', '≤', '→', '⟶', 'check', 'verify', 'ensure',
  'reference', 'refer', 'see ', 'note:', 'comment',
  'standard', 'code', 'regulation', 'manual',
]

/**
 * Returns true when the equation string looks like a computable
 * mathematical assignment (LHS = RHS with math on the right).
 */
function isComputableEquation(equation: string): boolean {
  const trimmed = equation.trim()
  if (!trimmed) return false

  // Must contain a single "=" (not == or !=)
  if (!trimmed.includes('=') || trimmed.includes('==') || trimmed.includes('!=')) {
    return false
  }

  // Both sides of "=" must be non-empty
  const eqIdx = trimmed.indexOf('=')
  const lhs = trimmed.substring(0, eqIdx).trim()
  const rhs = trimmed.substring(eqIdx + 1).trim()
  if (!lhs || !rhs) return false

  // Check for non-computable keywords (case-insensitive)
  const lower = trimmed.toLowerCase()
  for (const keyword of NON_COMPUTABLE_KEYWORDS) {
    if (lower.includes(keyword.toLowerCase())) return false
  }

  // Check for non-computable comparison / arrow symbols
  if (/[≥≤→⟶]/.test(trimmed)) return false

  // RHS should contain at least one digit, operator, parenthesis, or
  // known math function — otherwise it's probably a textual description.
  const hasMathContent =
    /[\d+\-*/^()]/.test(rhs) ||
    /sqrt|sin|cos|tan|log|ln|exp|abs|pow|max|min|pi|ceil|floor|round/i.test(rhs)
  if (!hasMathContent) return false

  return true
}

// ─── Symbol Replacement ─────────────────────────────────────────────────────

/**
 * Replace all known symbols in *expression* with their mapped names.
 *
 * Symbols are sorted by length (longest first) so that e.g. "u_k%"
 * is replaced before "u_k", preventing partial-match corruption.
 *
 * A lookbehind / lookahead ensures we only match whole tokens — "pf"
 * will not match inside "power_factor" or "kp_factor".
 */
function replaceSymbolsInExpression(
  expression: string,
  symbolMap: Record<string, string>,
): string {
  // Sort symbols by length, longest first
  const sortedSymbols = Object.keys(symbolMap).sort((a, b) => b.length - a.length)

  let result = expression

  for (const symbol of sortedSymbols) {
    const name = symbolMap[symbol]
    if (!name) continue

    // Escape regex metacharacters in the symbol
    const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    // Replace only when not adjacent to other word characters or '('
    // (the '(' check prevents replacing "sqrt" inside "sqrt(")
    const regex = new RegExp(
      `(?<![a-zA-Z0-9_])${escaped}(?![a-zA-Z0-9_(])`,
      'g',
    )
    result = result.replace(regex, name)
  }

  return result
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Parse a raw engineering formula string into a structured object
 * containing computable equations with name-based expressions.
 *
 * @param formula      Raw formula string from the database
 * @param inputConfig  Input field definitions (symbol → name mapping)
 * @param outputConfig Output field definitions (symbol → name mapping)
 *
 * @example
 * ```ts
 * const parsed = parseFormula(
 *   "I_L = P*1000 / (√3 * V * pf)",
 *   [
 *     { name: "apparent_power", symbol: "P", ... },
 *     { name: "line_voltage",   symbol: "V", ... },
 *     { name: "power_factor",   symbol: "pf", ... },
 *   ],
 *   [{ name: "load_current", symbol: "I_L", precision: 2, ... }],
 * )
 * // parsed.equations[0].expression === "apparent_power*1000 / (sqrt(3) * line_voltage * power_factor)"
 * ```
 */
export function parseFormula(
  formula: string,
  inputConfig: InputConfig[],
  outputConfig: OutputConfig[],
): ParsedStepFormula {
  // ── Build symbol → name map ──────────────────────────────────────────
  const symbolMap: Record<string, string> = {}
  const allInputNames: string[] = []
  const allOutputNames: string[] = []

  // Inputs first
  for (const input of inputConfig) {
    const cleanSymbol = cleanSpecialChars(input.symbol)
    symbolMap[cleanSymbol] = input.name
    allInputNames.push(input.name)
  }

  // Outputs (may overwrite if a symbol appears in both — outputs win)
  for (const output of outputConfig) {
    const cleanSymbol = cleanSpecialChars(output.symbol)
    symbolMap[cleanSymbol] = output.name
    allOutputNames.push(output.name)
  }

  // ── Empty formula → nothing to compute ───────────────────────────────
  if (!formula || !formula.trim()) {
    return {
      isComputable: false,
      equations: [],
      symbolMap,
      allInputNames,
      allOutputNames,
    }
  }

  // ── Clean special characters ─────────────────────────────────────────
  const cleanedFormula = cleanSpecialChars(formula)

  // ── Split by ";" for multi-equation formulas ─────────────────────────
  const rawEquations = cleanedFormula.split(';')

  const equations: ParsedStepFormula['equations'] = []
  let hasComputable = false

  for (const rawEq of rawEquations) {
    const trimmed = rawEq.trim()
    if (!trimmed) continue

    // Skip non-computable equations
    if (!isComputableEquation(trimmed)) continue

    // ── Split at first "=" ────────────────────────────────────────────
    const eqIdx = trimmed.indexOf('=')
    const outputSymbolRaw = trimmed.substring(0, eqIdx).trim()
    const expressionRaw = trimmed.substring(eqIdx + 1).trim()

    // ── Match LHS symbol to an output_config entry ────────────────────
    //    We try several normalisations because symbols like "VD%" may
    //    appear with or without the trailing percent sign.
    let outputName = ''

    // 1. Direct match after cleaning
    const cleanOutputSymbol = cleanSpecialChars(outputSymbolRaw)
    if (symbolMap[cleanOutputSymbol]) {
      outputName = symbolMap[cleanOutputSymbol]
    }

    // 2. Strip trailing % and try again
    if (!outputName) {
      const stripped = cleanOutputSymbol.replace(/%$/, '')
      if (symbolMap[stripped]) {
        outputName = symbolMap[stripped]
      }
    }

    // 3. Walk output_config explicitly
    if (!outputName) {
      for (const output of outputConfig) {
        const cfgClean = cleanSpecialChars(output.symbol)
        const cfgStripped = cfgClean.replace(/%$/, '')
        const lhsStripped = cleanOutputSymbol.replace(/%$/, '')
        if (
          cfgClean === cleanOutputSymbol ||
          cfgStripped === lhsStripped ||
          output.symbol === outputSymbolRaw
        ) {
          outputName = output.name
          break
        }
      }
    }

    // 4. Last resort: use the cleaned symbol as a slug
    if (!outputName) {
      outputName = cleanOutputSymbol.replace(/[^a-zA-Z0-9_]/g, '_')
    }

    // ── Replace symbols in the RHS expression with their names ────────
    const expression = replaceSymbolsInExpression(expressionRaw, symbolMap)

    equations.push({
      outputName,
      outputSymbol: outputSymbolRaw,
      expression,
      originalFormula: rawEq.trim(),
    })

    hasComputable = true

    // Register this output in the symbol map so later equations in the
    // same multi-equation formula can reference it.
    symbolMap[cleanOutputSymbol] = outputName
    const strippedSymbol = cleanOutputSymbol.replace(/%$/, '')
    if (strippedSymbol !== cleanOutputSymbol) {
      symbolMap[strippedSymbol] = outputName
    }
  }

  return {
    isComputable: hasComputable,
    equations,
    symbolMap,
    allInputNames,
    allOutputNames,
  }
}

/**
 * Evaluate a parsed formula given a set of input values.
 *
 * Each equation is evaluated in order; results of earlier equations
 * are available to later ones (multi-equation chaining).
 *
 * @param parsedFormula  The output of `parseFormula`
 * @param values         Map of input name → value (number or numeric string)
 *
 * @returns A `SolveResult` with computed output values (as strings),
 *          flags for which values were auto-calculated, and any error.
 */
export function evaluateFormula(
  parsedFormula: ParsedStepFormula,
  values: Record<string, number | string>,
): SolveResult {
  if (!parsedFormula.isComputable || parsedFormula.equations.length === 0) {
    return { values: {}, autoCalculated: {}, error: null }
  }

  const resultValues: Record<string, string> = {}
  const autoCalculated: Record<string, boolean> = {}

  // Build the evaluation scope from provided values
  const scope: Record<string, number> = {}
  for (const [key, val] of Object.entries(values)) {
    const num = typeof val === 'number' ? val : parseFloat(String(val))
    if (!isNaN(num) && isFinite(num)) {
      scope[key] = num
    }
  }

  // Evaluate each equation in sequence
  for (const eq of parsedFormula.equations) {
    try {
      const result = mathEvaluate(eq.expression, scope)

      if (result !== undefined && result !== null) {
        const numResult =
          typeof result === 'number'
            ? result
            : typeof result.toNumber === 'function'
              ? result.toNumber() // BigNumber / Fraction
              : Number(result)

        if (isFinite(numResult)) {
          scope[eq.outputName] = numResult
          resultValues[eq.outputName] = String(numResult)
          autoCalculated[eq.outputName] = true
        }
      }
    } catch (err) {
      return {
        values: resultValues,
        autoCalculated,
        error: `Error evaluating "${eq.outputSymbol} = ${eq.expression}": ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  }

  return { values: resultValues, autoCalculated, error: null }
}

/**
 * Solve for an unknown input by bisection.
 *
 * Given a target output value, iteratively adjusts the unknown input
 * until the formula produces the target output within tolerance.
 *
 * @param parsedFormula      Output of `parseFormula`
 * @param values             Known input values (missing the unknown)
 * @param unknownName        The `name` of the input to solve for
 * @param targetOutputName   The `name` of the output to match
 * @param targetOutputValue  The desired output value
 * @param tolerance          Convergence tolerance (default 0.001)
 * @param maxIter            Maximum bisection iterations (default 200)
 *
 * @returns A `SolveResult` with the solved unknown and all computed outputs.
 */
export function solveForUnknown(
  parsedFormula: ParsedStepFormula,
  values: Record<string, number | string>,
  unknownName: string,
  targetOutputName: string,
  targetOutputValue: number,
  tolerance: number = 0.001,
  maxIter: number = 200,
): SolveResult {
  const noSolution: SolveResult = {
    values: {},
    autoCalculated: { [unknownName]: false },
    error: null,
  }

  if (!parsedFormula.isComputable || parsedFormula.equations.length === 0) {
    noSolution.error = 'Formula is not computable'
    return noSolution
  }

  // Verify the target output exists in the equations
  const targetEq = parsedFormula.equations.find(
    (eq) => eq.outputName === targetOutputName,
  )
  if (!targetEq) {
    noSolution.error = `No equation produces output "${targetOutputName}"`
    return noSolution
  }

  // ── Pre-compile expressions for performance ──────────────────────────
  //    (bisection evaluates the same expressions many times)
  const compiled = parsedFormula.equations.map((eq) => ({
    outputName: eq.outputName,
    outputSymbol: eq.outputSymbol,
    compiled: mathCompile(eq.expression),
  }))

  // ── Build the scope for a given unknown value ────────────────────────
  const buildScope = (unknownValue: number): Record<string, number> => {
    const scope: Record<string, number> = {}
    for (const [key, val] of Object.entries(values)) {
      if (key === unknownName) continue
      const num = typeof val === 'number' ? val : parseFloat(String(val))
      if (!isNaN(num) && isFinite(num)) {
        scope[key] = num
      }
    }
    scope[unknownName] = unknownValue
    return scope
  }

  // ── Evaluate the full equation chain and return the target output ────
  const evaluateChain = (unknownValue: number): number | null => {
    const scope = buildScope(unknownValue)

    for (const { outputName, compiled: compiledExpr } of compiled) {
      try {
        const result = compiledExpr.evaluate(scope)

        if (result !== undefined && result !== null) {
          const numResult =
            typeof result === 'number'
              ? result
              : typeof result.toNumber === 'function'
                ? result.toNumber()
                : Number(result)

          if (isFinite(numResult)) {
            scope[outputName] = numResult
          } else {
            return null
          }
        } else {
          return null
        }
      } catch {
        return null
      }
    }

    return scope[targetOutputName] ?? null
  }

  // ── Determine reasonable search bounds ───────────────────────────────
  const numericValues = Object.values(values)
    .map((v) => (typeof v === 'number' ? v : parseFloat(String(v))))
    .filter((v) => isFinite(v))

  const maxAbs =
    numericValues.length > 0
      ? Math.max(...numericValues.map(Math.abs), 1)
      : 100

  let low = 0.001
  let high = maxAbs * 100

  let fLow = evaluateChain(low)
  let fHigh = evaluateChain(high)

  // ── Expand bounds if the root is not bracketed ───────────────────────
  if (
    fLow === null ||
    fHigh === null ||
    (fLow - targetOutputValue) * (fHigh - targetOutputValue) > 0
  ) {
    for (const factor of [1e3, 1e6, 1e8, 1e10]) {
      high = maxAbs * factor
      fHigh = evaluateChain(high)
      if (fHigh !== null) {
        const diffHigh = fHigh - targetOutputValue
        const diffLow = fLow !== null ? fLow - targetOutputValue : null
        if (diffLow !== null && diffLow * diffHigh <= 0) break
      }
    }
  }

  // ── Try negative bounds for cases where unknown could be negative ────
  if (fLow !== null && fHigh !== null) {
    let diffLow = fLow - targetOutputValue
    let diffHigh = fHigh - targetOutputValue

    if (diffLow * diffHigh > 0) {
      const negLow = -maxAbs * 100
      const fNegLow = evaluateChain(negLow)
      if (fNegLow !== null) {
        const diffNegLow = fNegLow - targetOutputValue
        if (diffNegLow * diffHigh <= 0) {
          low = negLow
          fLow = fNegLow
          diffLow = diffNegLow
        } else if (diffLow * diffNegLow <= 0) {
          high = negLow
          fHigh = fNegLow
          diffHigh = diffNegLow
        }
      }
    }
  }

  // ── Verify bounds bracket the root ───────────────────────────────────
  if (fLow === null || fHigh === null) {
    noSolution.error = `Could not find valid evaluation bounds for "${unknownName}"`
    return noSolution
  }

  const diffLow = fLow - targetOutputValue
  const diffHigh = fHigh - targetOutputValue

  if (diffLow * diffHigh > 0) {
    noSolution.error =
      `Bisection cannot bracket solution for "${unknownName}" — ` +
      `target ${targetOutputValue} not between f(${low})=${fLow} and f(${high})=${fHigh}`
    return noSolution
  }

  // ── Bisection loop ───────────────────────────────────────────────────
  for (let i = 0; i < maxIter; i++) {
    const mid = (low + high) / 2
    const fMid = evaluateChain(mid)

    if (fMid === null) {
      // Shrink from the side that still evaluates
      high = mid
      continue
    }

    const diffMid = fMid - targetOutputValue

    // Convergence check
    if (Math.abs(diffMid) < tolerance) {
      // ── Build the full result with all outputs ─────────────────────
      const fullScope = buildScope(mid)

      for (const { outputName, compiled: compiledExpr } of compiled) {
        try {
          const result = compiledExpr.evaluate(fullScope)
          if (result !== undefined && result !== null) {
            const numResult =
              typeof result === 'number'
                ? result
                : typeof result.toNumber === 'function'
                  ? result.toNumber()
                  : Number(result)
            if (isFinite(numResult)) {
              fullScope[outputName] = numResult
            }
          }
        } catch {
          // Skip failed intermediate evaluations
        }
      }

      const resultValues: Record<string, string> = {
        [unknownName]: String(mid),
      }
      const autoCalc: Record<string, boolean> = {
        [unknownName]: true,
      }

      for (const eq of parsedFormula.equations) {
        if (fullScope[eq.outputName] !== undefined) {
          resultValues[eq.outputName] = String(fullScope[eq.outputName])
          autoCalc[eq.outputName] = true
        }
      }

      return { values: resultValues, autoCalculated: autoCalc, error: null }
    }

    // Determine which half keeps the root bracketed
    const currentFlow = evaluateChain(low)
    if (currentFlow !== null) {
      const currentDiffLow = currentFlow - targetOutputValue
      if (diffMid * currentDiffLow < 0) {
        high = mid
      } else {
        low = mid
      }
    } else {
      low = mid
    }
  }

  // ── Did not converge — return best estimate ──────────────────────────
  const bestEstimate = (low + high) / 2
  noSolution.values = { [unknownName]: String(bestEstimate) }
  noSolution.autoCalculated = { [unknownName]: true }
  noSolution.error = `Bisection did not converge for "${unknownName}" after ${maxIter} iterations`
  return noSolution
}
