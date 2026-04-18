import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/database'
import { evaluateFormula } from '@/lib/calculation-engine'

// ─── Types ───────────────────────────────────────────────────────────────────

interface SolveRequest {
  equation_id?: number | string
  formula?: string
  values?: Record<string, number | string>
  solve_for?: string
}

interface SolveResponse {
  success: boolean
  result: Record<string, number>
  solved_variable: string | null
  method: 'direct' | 'numerical' | null
  formula: string
  error?: string
}

interface EquationInfo {
  id: number
  equation_id: string
  name: string
  formula: string | null
  equation_latex: string | null
  domain: string | null
  description: string | null
  inputs: EquationVariable[]
  outputs: EquationVariable[]
}

interface EquationVariable {
  symbol: string
  name: string
  unit: string | null
  default_value: number | null
  description: string | null
  formula?: string | null
}

// ─── GET handler – equation info ────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const equationId = searchParams.get('equation_id')

    if (!equationId) {
      return NextResponse.json(
        { success: false, error: 'equation_id query parameter is required' },
        { status: 400 }
      )
    }

    const db = await ensureDatabase()

    // Load equation from workflows database
    const equation = await db.queryOneWorkflow<Record<string, unknown>>(
      `SELECT * FROM equations WHERE id = ? OR equation_id = ?`,
      [Number(equationId) || 0, equationId]
    )

    if (!equation) {
      return NextResponse.json(
        { success: false, error: 'Equation not found' },
        { status: 404 }
      )
    }

    const eqId = equation.id as number

    // Load input definitions
    const eqInputs = await db.queryWorkflows<Record<string, unknown>>(
      `SELECT * FROM equation_inputs WHERE equation_id = ? ORDER BY input_order`,
      [eqId]
    )

    // Load output definitions
    const eqOutputs = await db.queryWorkflows<Record<string, unknown>>(
      `SELECT * FROM equation_outputs WHERE equation_id = ? ORDER BY output_order`,
      [eqId]
    )

    const inputs: EquationVariable[] = eqInputs.map((inp) => ({
      symbol: (inp.symbol as string) || (inp.name as string),
      name: inp.name as string,
      unit: (inp.unit as string) || null,
      default_value: inp.default_value != null ? Number(inp.default_value) : null,
      description: (inp.description as string) || null,
    }))

    const outputs: EquationVariable[] = eqOutputs.map((out) => ({
      symbol: (out.symbol as string) || (out.name as string),
      name: out.name as string,
      unit: (out.unit as string) || null,
      default_value: out.default_value != null ? Number(out.default_value) : null,
      description: (out.description as string) || null,
      formula: (out.formula as string) || null,
    }))

    const info: EquationInfo = {
      id: eqId,
      equation_id: equation.equation_id as string,
      name: equation.name as string,
      formula: (equation.equation as string) || (equation.formula as string) || null,
      equation_latex: (equation.equation_latex as string) || null,
      domain: (equation.domain as string) || null,
      description: (equation.description as string) || null,
      inputs,
      outputs,
    }

    return NextResponse.json({ success: true, data: info })
  } catch (error) {
    console.error('Equation info API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load equation info' },
      { status: 500 }
    )
  }
}

// ─── POST handler – solve equation ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const db = await ensureDatabase()
    const body: SolveRequest = await request.json()
    const { equation_id, formula: bodyFormula, values = {}, solve_for } = body

    // Validate: at least equation_id or formula must be provided
    if (!equation_id && !bodyFormula) {
      return NextResponse.json(
        { success: false, error: 'Either equation_id or formula must be provided' },
        { status: 400 }
      )
    }

    // Validate: values must be provided
    if (!values || Object.keys(values).length === 0) {
      return NextResponse.json(
        { success: false, error: 'values must be provided with at least one known variable' },
        { status: 400 }
      )
    }

    let formula = bodyFormula || ''
    let inputDefs: EquationVariable[] = []
    let outputDefs: EquationVariable[] = []

    // ── Load equation from DB if equation_id provided ──
    if (equation_id) {
      const equation = await db.queryOneWorkflow<Record<string, unknown>>(
        `SELECT * FROM equations WHERE id = ? OR equation_id = ?`,
        [Number(equation_id) || 0, String(equation_id)]
      )

      if (!equation) {
        return NextResponse.json(
          { success: false, error: 'Equation not found' },
          { status: 404 }
        )
      }

      const eqId = equation.id as number
      formula = formula || (equation.equation as string) || (equation.formula as string) || ''

      const eqInputs = await db.queryWorkflows<Record<string, unknown>>(
        `SELECT * FROM equation_inputs WHERE equation_id = ? ORDER BY input_order`,
        [eqId]
      )
      const eqOutputs = await db.queryWorkflows<Record<string, unknown>>(
        `SELECT * FROM equation_outputs WHERE equation_id = ? ORDER BY output_order`,
        [eqId]
      )

      inputDefs = eqInputs.map((inp) => ({
        symbol: (inp.symbol as string) || (inp.name as string),
        name: inp.name as string,
        unit: (inp.unit as string) || null,
        default_value: inp.default_value != null ? Number(inp.default_value) : null,
        description: (inp.description as string) || null,
      }))

      outputDefs = eqOutputs.map((out) => ({
        symbol: (out.symbol as string) || (out.name as string),
        name: out.name as string,
        unit: (out.unit as string) || null,
        default_value: out.default_value != null ? Number(out.default_value) : null,
        description: (out.description as string) || null,
        formula: (out.formula as string) || null,
      }))
    }

    if (!formula) {
      return NextResponse.json(
        { success: false, error: 'No formula available to solve' },
        { status: 400 }
      )
    }

    // ── Build numeric context from user values ──
    const context: Record<string, number> = {}
    for (const [key, val] of Object.entries(values)) {
      const num = Number(val)
      if (!isNaN(num)) {
        context[key] = num
      }
    }

    // Apply default values from DB definitions for inputs not provided
    for (const inp of inputDefs) {
      if (!(inp.symbol in context) && inp.default_value != null && !isNaN(inp.default_value)) {
        context[inp.symbol] = inp.default_value
      }
    }

    // ── Parse formula into statements ──
    const statements = parseFormulaStatements(formula)

    // ── Determine the set of input and output variable symbols ──
    const inputSymbols = new Set(inputDefs.map((d) => d.symbol))
    const outputSymbols = new Set(outputDefs.map((d) => d.symbol))

    // If no DB definitions, infer from formula
    if (inputSymbols.size === 0 && outputSymbols.size === 0) {
      for (const stmt of statements) {
        if (stmt.outputVar) {
          outputSymbols.add(stmt.outputVar)
        }
      }
      // Variables used in expressions that are not output vars are input vars
      for (const stmt of statements) {
        const varsInExpr = extractVariables(stmt.expression)
        for (const v of varsInExpr) {
          if (!outputSymbols.has(v) && !(v in BUILTIN_NAMES)) {
            inputSymbols.add(v)
          }
        }
      }
    }

    // ── Determine which variable to solve for ──
    let targetVar = solve_for || null

    if (!targetVar) {
      // Auto-detect: find the first variable that is NOT in the provided values
      // Prefer output variables first
      for (const sym of outputSymbols) {
        if (!(sym in values)) {
          targetVar = sym
          break
        }
      }
      // If no unsolved output, check inputs
      if (!targetVar) {
        for (const sym of inputSymbols) {
          if (!(sym in values)) {
            targetVar = sym
            break
          }
        }
      }
    }

    if (!targetVar) {
      // All variables are known – just evaluate outputs
      const result = evaluateAllOutputs(statements, context, outputDefs)
      return NextResponse.json({
        success: true,
        result,
        solved_variable: null,
        method: 'direct' as const,
        formula,
      } satisfies SolveResponse)
    }

    // ── Attempt direct evaluation ──
    // Case 1: targetVar is an output variable and all expression inputs are known
    const directResult = tryDirectEvaluation(targetVar, statements, context, outputDefs)
    if (directResult !== null) {
      return NextResponse.json({
        success: true,
        result: { [targetVar]: directResult },
        solved_variable: targetVar,
        method: 'direct' as const,
        formula,
      } satisfies SolveResponse)
    }

    // ── Attempt numerical solving (bisection) ──
    // targetVar is an input variable (reverse calculation)
    const numericalResult = tryNumericalSolving(targetVar, statements, context, outputDefs)
    if (numericalResult !== null) {
      return NextResponse.json({
        success: true,
        result: { [targetVar]: numericalResult },
        solved_variable: targetVar,
        method: 'numerical' as const,
        formula,
      } satisfies SolveResponse)
    }

    // ── Could not solve ──
    return NextResponse.json(
      {
        success: false,
        result: {},
        solved_variable: targetVar,
        method: null,
        formula,
        error: `Could not solve for '${targetVar}'. Ensure enough known values are provided.`,
      } satisfies SolveResponse,
      { status: 422 }
    )
  } catch (error) {
    console.error('Solve API error:', error)
    return NextResponse.json(
      {
        success: false,
        result: {},
        solved_variable: null,
        method: null,
        formula: '',
        error: 'Failed to solve equation',
      } satisfies SolveResponse,
      { status: 500 }
    )
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Built-in math/engineering function names to exclude from variable detection */
const BUILTIN_NAMES: Record<string, boolean> = {
  sqrt: true, sin: true, cos: true, tan: true, asin: true, acos: true, atan: true,
  log: true, ln: true, exp: true, pow: true, abs: true, round: true, ceil: true,
  floor: true, max: true, min: true, sum: true, avg: true,
  select_cable: true, select_standard_size: true, next_standard_size: true,
  apply_demand_factor: true, lookup_cu_table: true, voltage_drop: true,
  pf_correction_capacitor: true, three_phase_power: true, short_circuit_current: true,
  beam_deflection: true, bending_stress: true, shear_stress: true,
  reynolds_number: true, darcy_friction_factor: true, pressure_drop: true,
  heat_transfer_coefficient: true,
  PI: true, E: true,
}

interface FormulaStatement {
  outputVar: string | null
  expression: string
}

/** Parse a formula string into individual assignment statements */
function parseFormulaStatements(formula: string): FormulaStatement[] {
  const formulas = formula.replace(/;/g, '\n').split('\n').map((f) => f.trim()).filter(Boolean)
  const statements: FormulaStatement[] = []

  for (const f of formulas) {
    if (f.includes('=') && !f.includes('==')) {
      const parts = f.split('=')
      if (parts.length >= 2) {
        const varName = parts[0].trim()
        const expr = parts.slice(1).join('=').trim()
        statements.push({ outputVar: varName, expression: expr })
      }
    } else {
      statements.push({ outputVar: null, expression: f })
    }
  }

  return statements
}

/** Extract variable names from an expression using word-boundary matching */
function extractVariables(expression: string): string[] {
  const vars: string[] = []
  // Match word-boundary identifiers (letters, digits, underscore, starting with letter/underscore)
  const regex = /\b([a-zA-Z_]\w*)\b/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(expression)) !== null) {
    const name = match[1]
    if (!BUILTIN_NAMES[name] && !vars.includes(name)) {
      vars.push(name)
    }
  }
  return vars
}

/** Evaluate all output variables from statements and output definitions */
function evaluateAllOutputs(
  statements: FormulaStatement[],
  context: Record<string, number>,
  outputDefs: EquationVariable[]
): Record<string, number> {
  const result: Record<string, number> = {}
  const ctx = { ...context }

  // Evaluate statements in order
  for (const stmt of statements) {
    if (stmt.outputVar) {
      try {
        const val = evaluateFormula(stmt.expression, ctx)
        ctx[stmt.outputVar] = val
        result[stmt.outputVar] = val
      } catch {
        // skip
      }
    }
  }

  // Evaluate output-specific formulas
  for (const out of outputDefs) {
    if (out.formula && out.formula.trim()) {
      try {
        const val = evaluateFormula(out.formula, ctx)
        ctx[out.symbol] = val
        result[out.symbol] = val
      } catch {
        // skip
      }
    } else if (!(out.symbol in result) && out.symbol in ctx) {
      result[out.symbol] = ctx[out.symbol]
    }
  }

  return result
}

/**
 * Try direct evaluation for a target variable.
 * Returns the value if the target can be computed directly, null otherwise.
 */
function tryDirectEvaluation(
  targetVar: string,
  statements: FormulaStatement[],
  context: Record<string, number>,
  outputDefs: EquationVariable[]
): number | null {
  // Strategy 1: targetVar is the output of a formula statement
  for (const stmt of statements) {
    if (stmt.outputVar === targetVar) {
      try {
        const val = evaluateFormula(stmt.expression, context)
        if (isFinite(val)) {
          return val
        }
      } catch {
        // Expression may reference unknowns – fall through to numerical
      }
    }
  }

  // Strategy 2: targetVar has an output-specific formula
  for (const out of outputDefs) {
    if (out.symbol === targetVar && out.formula && out.formula.trim()) {
      try {
        const val = evaluateFormula(out.formula, context)
        if (isFinite(val)) {
          return val
        }
      } catch {
        // fall through
      }
    }
  }

  // Strategy 3: evaluate all statements sequentially and check if target appears
  const ctx = { ...context }
  let found = false
  let foundValue = 0

  for (const stmt of statements) {
    if (stmt.outputVar) {
      try {
        const val = evaluateFormula(stmt.expression, ctx)
        if (stmt.outputVar === targetVar) {
          if (isFinite(val)) {
            found = true
            foundValue = val
          }
        }
        ctx[stmt.outputVar] = val
      } catch {
        // If this statement defines our target and we can't evaluate it, direct won't work
        if (stmt.outputVar === targetVar) {
          return null
        }
      }
    }
  }

  // Also try output defs
  for (const out of outputDefs) {
    if (out.symbol === targetVar && !(targetVar in ctx)) {
      if (out.formula && out.formula.trim()) {
        try {
          const val = evaluateFormula(out.formula, ctx)
          if (isFinite(val)) {
            found = true
            foundValue = val
          }
        } catch {
          // skip
        }
      }
    }
  }

  return found ? foundValue : null
}

/**
 * Try numerical solving using bisection method.
 * Used for reverse calculation: solving for an input variable when the output is known.
 */
function tryNumericalSolving(
  targetVar: string,
  statements: FormulaStatement[],
  context: Record<string, number>,
  outputDefs: EquationVariable[]
): number | null {
  // Find a statement whose output is known (provided in values or already computable)
  // and whose expression references the targetVar.
  // That gives us: knownOutput = f(targetVar, otherKnowns)
  // We solve: f(targetVar, otherKnowns) - knownOutput = 0

  // Collect known output values (from user-provided values, not computed)
  const knownOutputs: { symbol: string; value: number }[] = []

  // Check which outputs are known from the provided values
  for (const out of outputDefs) {
    if (out.symbol in context) {
      knownOutputs.push({ symbol: out.symbol, value: context[out.symbol] })
    }
  }

  // Also check statement outputs that are in the context
  for (const stmt of statements) {
    if (stmt.outputVar && stmt.outputVar in context) {
      // Avoid duplicate
      if (!knownOutputs.some((ko) => ko.symbol === stmt.outputVar)) {
        knownOutputs.push({ symbol: stmt.outputVar, value: context[stmt.outputVar] })
      }
    }
  }

  // If no known outputs, try to compute outputs from known inputs and use those as targets
  if (knownOutputs.length === 0) {
    // Evaluate everything we can without targetVar
    const ctxWithoutTarget = { ...context }
    delete ctxWithoutTarget[targetVar]

    for (const stmt of statements) {
      if (stmt.outputVar && stmt.outputVar !== targetVar) {
        try {
          const val = evaluateFormula(stmt.expression, ctxWithoutTarget)
          if (isFinite(val)) {
            ctxWithoutTarget[stmt.outputVar] = val
          }
        } catch {
          // skip
        }
      }
    }

    for (const out of outputDefs) {
      if (out.formula && out.symbol !== targetVar) {
        try {
          const val = evaluateFormula(out.formula, ctxWithoutTarget)
          if (isFinite(val) && !(out.symbol in ctxWithoutTarget)) {
            knownOutputs.push({ symbol: out.symbol, value: val })
          }
        } catch {
          // skip
        }
      }
    }
  }

  // Try each known output as a target for bisection
  for (const { symbol: outputSymbol, value: targetValue } of knownOutputs) {
    // Find the expression that defines this output
    const matchingStmt = statements.find((s) => s.outputVar === outputSymbol)
    const matchingOutDef = outputDefs.find((o) => o.symbol === outputSymbol && o.formula)

    // Determine the expression to evaluate
    let expression: string | null = null
    if (matchingStmt) {
      expression = matchingStmt.expression
    } else if (matchingOutDef?.formula) {
      expression = matchingOutDef.formula
    }

    if (!expression) continue

    // Check that the expression references the targetVar
    const varsInExpr = extractVariables(expression)
    if (!varsInExpr.includes(targetVar)) continue

    // Build context without the targetVar
    const solveContext: Record<string, number> = { ...context }
    delete solveContext[targetVar]
    // Also remove the output symbol from context (it's the target of the expression)
    delete solveContext[outputSymbol]

    // Use bisection to solve: expression(context + {targetVar: x}) = targetValue
    const result = bisectionSolve(expression, solveContext, targetVar, targetValue)
    if (result !== null) {
      return result
    }
  }

  // Alternative approach: if the formula is like "V = I * R" and we know V and R,
  // solve for I using the full statement context
  for (const stmt of statements) {
    if (!stmt.outputVar) continue
    if (stmt.outputVar === targetVar) continue // Already tried direct

    const varsInExpr = extractVariables(stmt.expression)
    if (!varsInExpr.includes(targetVar)) continue

    // The output variable should have a known value
    if (!(stmt.outputVar in context)) continue

    const targetValue = context[stmt.outputVar]
    const solveContext: Record<string, number> = { ...context }
    delete solveContext[targetVar]
    delete solveContext[stmt.outputVar]

    const result = bisectionSolve(stmt.expression, solveContext, targetVar, targetValue)
    if (result !== null) {
      return result
    }
  }

  return null
}

/**
 * Bisection method solver.
 * Solves: evaluateFormula(expression, { ...context, [unknownVar]: x }) = targetValue
 * Returns the value of unknownVar, or null if convergence fails.
 */
function bisectionSolve(
  expression: string,
  knownContext: Record<string, number>,
  unknownVar: string,
  targetValue: number,
  tolerance: number = 0.0001,
  maxIter: number = 200
): number | null {
  const evalAt = (x: number): number => {
    const ctx = { ...knownContext, [unknownVar]: x }
    try {
      return evaluateFormula(expression, ctx)
    } catch {
      return NaN
    }
  }

  // Determine reasonable search bounds based on known values
  const knownValues = Object.values(knownContext)
  const maxAbs = knownValues.length > 0
    ? Math.max(...knownValues.map(Math.abs), 1)
    : 1000

  // Start with a wide range and narrow down
  let low = -maxAbs * 1000
  let high = maxAbs * 1000

  let fLow = evalAt(low) - targetValue
  let fHigh = evalAt(high) - targetValue

  // Check if root is already bracketed
  if (isNaN(fLow) || isNaN(fHigh)) {
    // Try smaller ranges
    for (const range of [1e6, 1e4, 1e3, 100, 10, 1, 0.1]) {
      low = -range
      high = range
      fLow = evalAt(low) - targetValue
      fHigh = evalAt(high) - targetValue
      if (!isNaN(fLow) && !isNaN(fHigh)) break
    }
  }

  if (isNaN(fLow) || isNaN(fHigh)) return null

  // Try to find bounds where f changes sign
  if (fLow * fHigh > 0) {
    // Expand bounds progressively
    const expansions = [1e6, 1e4, 1e3, 100, 10, 1, 0.1, 0.01, 0.001]
    let found = false
    for (const scale of expansions) {
      low = -scale
      high = scale
      fLow = evalAt(low) - targetValue
      fHigh = evalAt(high) - targetValue
      if (isNaN(fLow) || isNaN(fHigh)) continue
      if (fLow * fHigh <= 0) {
        found = true
        break
      }
    }

    if (!found) {
      // Try asymmetric bounds based on targetValue
      if (targetValue > 0) {
        low = 0
        high = targetValue * 10 + 100
      } else {
        low = targetValue * 10 - 100
        high = 0
      }
      fLow = evalAt(low) - targetValue
      fHigh = evalAt(high) - targetValue
      if (isNaN(fLow) || isNaN(fHigh) || fLow * fHigh > 0) return null
    }
  }

  // Bisection iteration
  for (let i = 0; i < maxIter; i++) {
    const mid = (low + high) / 2
    const fMid = evalAt(mid) - targetValue

    if (isNaN(fMid)) {
      // Shrink to the side that produces valid values
      high = mid
      continue
    }

    if (Math.abs(fMid) < tolerance) return mid

    if (fMid * fLow < 0) {
      high = mid
      fHigh = fMid
    } else {
      low = mid
      fLow = fMid
    }
  }

  // Return best approximation even if not fully converged
  const finalMid = (low + high) / 2
  const finalResidual = Math.abs(evalAt(finalMid) - targetValue)
  if (finalResidual < tolerance * 100) {
    return finalMid
  }

  return null
}
