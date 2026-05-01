import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
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

interface EquationVariable {
  symbol: string
  name: string
  unit: string | null
  default_value: number | null
  description: string | null
  formula?: string | null
}

interface EquationInfo {
  id: string
  equation_id: string
  name: string
  formula: string | null
  equation_latex: string | null
  domain: string | null
  description: string | null
  inputs: EquationVariable[]
  outputs: EquationVariable[]
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

    // Load equation from Prisma
    const equation = await db.equation.findFirst({
      where: {
        OR: [
          { id: equationId },
          { slug: equationId },
        ]
      },
      include: {
        inputs: { orderBy: { order: 'asc' } },
        outputs: { orderBy: { order: 'asc' } },
      },
    })

    if (!equation) {
      return NextResponse.json(
        { success: false, error: 'Equation not found' },
        { status: 404 }
      )
    }

    const inputs: EquationVariable[] = equation.inputs.map(inp => ({
      symbol: inp.symbol || inp.name,
      name: inp.name,
      unit: inp.unit || null,
      default_value: inp.defaultVal != null ? Number(inp.defaultVal) : null,
      description: null,
    }))

    const outputs: EquationVariable[] = equation.outputs.map(out => ({
      symbol: out.symbol || out.name,
      name: out.name,
      unit: out.unit || null,
      default_value: null,
      description: null,
      formula: out.formula || null,
    }))

    const info: EquationInfo = {
      id: equation.id,
      equation_id: equation.slug,
      name: equation.name,
      formula: equation.formula || null,
      equation_latex: null,
      domain: equation.domain || null,
      description: equation.description || null,
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

    // ── Load equation from Prisma if equation_id provided ──
    if (equation_id) {
      const equation = await db.equation.findFirst({
        where: {
          OR: [
            { id: String(equation_id) },
            { slug: String(equation_id) },
          ]
        },
        include: {
          inputs: { orderBy: { order: 'asc' } },
          outputs: { orderBy: { order: 'asc' } },
        },
      })

      if (!equation) {
        return NextResponse.json(
          { success: false, error: 'Equation not found' },
          { status: 404 }
        )
      }

      formula = formula || equation.formula || ''

      inputDefs = equation.inputs.map(inp => ({
        symbol: inp.symbol || inp.name,
        name: inp.name,
        unit: inp.unit || null,
        default_value: inp.defaultVal != null ? Number(inp.defaultVal) : null,
        description: null,
      }))

      outputDefs = equation.outputs.map(out => ({
        symbol: out.symbol || out.name,
        name: out.name,
        unit: out.unit || null,
        default_value: null,
        description: null,
        formula: out.formula || null,
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
    const inputSymbols = new Set(inputDefs.map(d => d.symbol))
    const outputSymbols = new Set(outputDefs.map(d => d.symbol))

    // If no DB definitions, infer from formula
    if (inputSymbols.size === 0 && outputSymbols.size === 0) {
      for (const stmt of statements) {
        if (stmt.outputVar) {
          outputSymbols.add(stmt.outputVar)
        }
      }
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
      for (const sym of outputSymbols) {
        if (!(sym in values)) {
          targetVar = sym
          break
        }
      }
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

function parseFormulaStatements(formula: string): FormulaStatement[] {
  const formulas = formula.replace(/;/g, '\n').split('\n').map(f => f.trim()).filter(Boolean)
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

function extractVariables(expression: string): string[] {
  const vars: string[] = []
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

function evaluateAllOutputs(
  statements: FormulaStatement[],
  context: Record<string, number>,
  outputDefs: EquationVariable[]
): Record<string, number> {
  const result: Record<string, number> = {}
  const ctx = { ...context }

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

function tryDirectEvaluation(
  targetVar: string,
  statements: FormulaStatement[],
  context: Record<string, number>,
  outputDefs: EquationVariable[]
): number | null {
  for (const stmt of statements) {
    if (stmt.outputVar === targetVar) {
      try {
        const val = evaluateFormula(stmt.expression, context)
        if (isFinite(val)) return val
      } catch {
        // fall through
      }
    }
  }

  for (const out of outputDefs) {
    if (out.symbol === targetVar && out.formula && out.formula.trim()) {
      try {
        const val = evaluateFormula(out.formula, context)
        if (isFinite(val)) return val
      } catch {
        // fall through
      }
    }
  }

  const ctx = { ...context }
  let found = false
  let foundValue = 0

  for (const stmt of statements) {
    if (stmt.outputVar) {
      try {
        const val = evaluateFormula(stmt.expression, ctx)
        if (stmt.outputVar === targetVar && isFinite(val)) {
          found = true
          foundValue = val
        }
        ctx[stmt.outputVar] = val
      } catch {
        if (stmt.outputVar === targetVar) return null
      }
    }
  }

  for (const out of outputDefs) {
    if (out.symbol === targetVar && !(targetVar in ctx) && out.formula?.trim()) {
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

  return found ? foundValue : null
}

function tryNumericalSolving(
  targetVar: string,
  statements: FormulaStatement[],
  context: Record<string, number>,
  outputDefs: EquationVariable[]
): number | null {
  const knownOutputs: { symbol: string; value: number }[] = []

  for (const out of outputDefs) {
    if (out.symbol in context) {
      knownOutputs.push({ symbol: out.symbol, value: context[out.symbol] })
    }
  }

  for (const stmt of statements) {
    if (stmt.outputVar && stmt.outputVar in context) {
      if (!knownOutputs.some(ko => ko.symbol === stmt.outputVar)) {
        knownOutputs.push({ symbol: stmt.outputVar, value: context[stmt.outputVar!] })
      }
    }
  }

  if (knownOutputs.length === 0) {
    const ctxWithoutTarget = { ...context }
    delete ctxWithoutTarget[targetVar]

    for (const stmt of statements) {
      if (stmt.outputVar && stmt.outputVar !== targetVar) {
        try {
          const val = evaluateFormula(stmt.expression, ctxWithoutTarget)
          if (isFinite(val)) ctxWithoutTarget[stmt.outputVar] = val
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

  for (const { symbol: outputSymbol, value: targetValue } of knownOutputs) {
    const matchingStmt = statements.find(s => s.outputVar === outputSymbol)
    const matchingOutDef = outputDefs.find(o => o.symbol === outputSymbol && o.formula)

    let expression: string | null = null
    if (matchingStmt) expression = matchingStmt.expression
    else if (matchingOutDef?.formula) expression = matchingOutDef.formula
    if (!expression) continue

    const varsInExpr = extractVariables(expression)
    if (!varsInExpr.includes(targetVar)) continue

    const solveContext: Record<string, number> = { ...context }
    delete solveContext[targetVar]
    delete solveContext[outputSymbol]

    const result = bisectionSolve(expression, solveContext, targetVar, targetValue)
    if (result !== null) return result
  }

  for (const stmt of statements) {
    if (!stmt.outputVar || stmt.outputVar === targetVar) continue

    const varsInExpr = extractVariables(stmt.expression)
    if (!varsInExpr.includes(targetVar)) continue
    if (!(stmt.outputVar in context)) continue

    const targetValue = context[stmt.outputVar]
    const solveContext: Record<string, number> = { ...context }
    delete solveContext[targetVar]
    delete solveContext[stmt.outputVar]

    const result = bisectionSolve(stmt.expression, solveContext, targetVar, targetValue)
    if (result !== null) return result
  }

  return null
}

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

  const knownValues = Object.values(knownContext)
  const maxAbs = knownValues.length > 0
    ? Math.max(...knownValues.map(Math.abs), 1)
    : 1000

  let low = -maxAbs * 1000
  let high = maxAbs * 1000
  let fLow = evalAt(low) - targetValue
  let fHigh = evalAt(high) - targetValue

  if (isNaN(fLow) || isNaN(fHigh)) {
    for (const range of [1e6, 1e4, 1e3, 100, 10, 1, 0.1]) {
      low = -range
      high = range
      fLow = evalAt(low) - targetValue
      fHigh = evalAt(high) - targetValue
      if (!isNaN(fLow) && !isNaN(fHigh)) break
    }
  }

  if (isNaN(fLow) || isNaN(fHigh)) return null

  if (fLow * fHigh > 0) {
    const expansions = [1e6, 1e4, 1e3, 100, 10, 1, 0.1, 0.01, 0.001]
    let found = false
    for (const scale of expansions) {
      low = -scale
      high = scale
      fLow = evalAt(low) - targetValue
      fHigh = evalAt(high) - targetValue
      if (isNaN(fLow) || isNaN(fHigh)) continue
      if (fLow * fHigh <= 0) { found = true; break }
    }

    if (!found) {
      if (targetValue > 0) { low = 0; high = targetValue * 10 + 100 }
      else { low = targetValue * 10 - 100; high = 0 }
      fLow = evalAt(low) - targetValue
      fHigh = evalAt(high) - targetValue
      if (isNaN(fLow) || isNaN(fHigh) || fLow * fHigh > 0) return null
    }
  }

  for (let i = 0; i < maxIter; i++) {
    const mid = (low + high) / 2
    const fMid = evalAt(mid) - targetValue

    if (isNaN(fMid)) { high = mid; continue }
    if (Math.abs(fMid) < tolerance) return mid

    if (fMid * fLow < 0) { high = mid; fHigh = fMid }
    else { low = mid; fLow = fMid }
  }

  const finalMid = (low + high) / 2
  const finalResidual = Math.abs(evalAt(finalMid) - targetValue)
  if (finalResidual < tolerance * 100) return finalMid

  return null
}
