import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/database'
import { evaluateFormula } from '@/lib/calculation-engine'

export async function POST(request: NextRequest) {
  try {
    const db = await ensureDatabase()
    const body = await request.json()
    const { equationId, inputs, solveFor } = body

    if (!equationId || !inputs) {
      return NextResponse.json(
        { success: false, error: 'equationId and inputs are required' },
        { status: 400 }
      )
    }

    // Load equation from workflows.db
    const equation = db.queryOneWorkflow<Record<string, unknown>>(
      `SELECT * FROM equations WHERE id = ? OR equation_id = ?`,
      [equationId, String(equationId)]
    )

    if (!equation) {
      return NextResponse.json(
        { success: false, error: 'Equation not found' },
        { status: 404 }
      )
    }

    const eqId = equation.id as number

    // Load inputs and outputs definitions
    const eqInputs = db.queryWorkflows<Record<string, unknown>>(
      `SELECT * FROM equation_inputs WHERE equation_id = ? ORDER BY input_order`,
      [eqId]
    )

    const eqOutputs = db.queryWorkflows<Record<string, unknown>>(
      `SELECT * FROM equation_outputs WHERE equation_id = ? ORDER BY output_order`,
      [eqId]
    )

    // Build evaluation context from user inputs + defaults
    const context: Record<string, number> = {}
    for (const inp of eqInputs) {
      const symbol = (inp.symbol as string) || (inp.name as string)
      const val = (inputs as Record<string, unknown>)[symbol] ??
        (inputs as Record<string, unknown>)[inp.name as string] ??
        inp.default_value
      if (val !== undefined && val !== null && val !== '') {
        context[symbol] = Number(val)
      }
    }

    // Also add any user-provided output values (for reverse calculation)
    for (const out of eqOutputs) {
      const symbol = (out.symbol as string) || (out.name as string)
      const val = (inputs as Record<string, unknown>)[symbol] ??
        (inputs as Record<string, unknown>)[out.name as string]
      if (val !== undefined && val !== null && val !== '') {
        context[symbol] = Number(val)
      }
    }

    // Also add any extra variables from inputs that aren't in DB definitions
    for (const [key, val] of Object.entries(inputs as Record<string, unknown>)) {
      if (val !== undefined && val !== null && val !== '') {
        const num = Number(val)
        if (!isNaN(num)) context[key] = num
      }
    }

    // Solve the equation
    const outputs: Record<string, number> = {}
    const formula = (equation.equation as string) || (equation.formula as string) || ''

    if (formula) {
      // Parse all statements
      const formulas = formula.replace(/;/g, '\n').split('\n').map(f => f.trim()).filter(Boolean)
      const statements: { outputVar: string | null; expression: string }[] = []

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

      // CASE 1: Direct calculation - all inputs present, compute outputs
      let canDirectCalculate = true
      for (const stmt of statements) {
        if (stmt.outputVar && stmt.outputVar in context) continue // already known
        if (stmt.outputVar && !(stmt.outputVar in context)) {
          // Check if we can evaluate the expression with known values
          try {
            const result = evaluateFormula(stmt.expression, context)
            if (result !== 0 || Object.keys(context).length > 0) {
              context[stmt.outputVar] = result
              outputs[stmt.outputVar] = result
            }
          } catch {
            canDirectCalculate = false
          }
        }
      }

      // CASE 2: Reverse calculation - solve for unknown
      if (solveFor && !(solveFor in outputs)) {
        // Find the statement that defines solveFor or contains it
        for (const stmt of statements) {
          if (stmt.outputVar === solveFor) {
            // Direct: solveFor = expression(knowns)
            try {
              const result = evaluateFormula(stmt.expression, context)
              outputs[solveFor] = result
              context[solveFor] = result
            } catch {
              // Expression contains unknowns - try numerical solving
            }
          } else if (stmt.outputVar && stmt.outputVar in context && solveFor !== stmt.outputVar) {
            // Reverse: knownOutput = expression(solveFor, knowns)
            // Use numerical bisection method
            const targetValue = context[stmt.outputVar]
            const result = numericalSolve(stmt.expression, context, solveFor, targetValue)
            if (result !== null) {
              outputs[solveFor] = result
              context[solveFor] = result
            }
          }
        }
      }

      // If no specific solveFor, also try evaluating output formulas
      for (const out of eqOutputs) {
        const outFormula = out.formula as string | null
        const symbol = (out.symbol as string) || (out.name as string)
        if (outFormula) {
          try {
            const result = evaluateFormula(outFormula, context)
            outputs[symbol] = result
            context[symbol] = result
          } catch { /* skip */ }
        } else if (!(symbol in outputs) && symbol in context) {
          outputs[symbol] = context[symbol]
        }
      }
    }

    // Determine which variables were auto-calculated
    const autoCalculated: Record<string, boolean> = {}
    for (const key of Object.keys(outputs)) {
      autoCalculated[key] = true
    }

    return NextResponse.json({
      success: true,
      data: {
        equation: {
          id: equation.id,
          equation_id: equation.equation_id,
          name: equation.name,
          formula: equation.equation || equation.formula,
          equation_latex: equation.equation_latex,
          domain: equation.domain,
        },
        inputs: context,
        outputs,
        autoCalculated,
        inputDefinitions: eqInputs,
        outputDefinitions: eqOutputs,
      }
    })
  } catch (error) {
    console.error('Solve API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to solve equation' },
      { status: 500 }
    )
  }
}

/**
 * Numerical solver using bisection method
 * Solves: expression(context + {unknownVar: x}) = targetValue for x
 */
function numericalSolve(
  expression: string,
  knownContext: Record<string, number>,
  unknownVar: string,
  targetValue: number,
  tolerance: number = 0.0001,
  maxIter: number = 200
): number | null {
  // Find reasonable bounds
  const vals = Object.values(knownContext)
  const maxAbs = vals.length > 0 ? Math.max(...vals.map(Math.abs), 1) : 1000
  let low = -maxAbs * 1000
  let high = maxAbs * 1000

  const evalAt = (x: number): number => {
    const ctx = { ...knownContext, [unknownVar]: x }
    return evaluateFormula(expression, ctx)
  }

  let fLow = evalAt(low) - targetValue
  let fHigh = evalAt(high) - targetValue

  // Try to find bounds where f changes sign
  if (fLow * fHigh > 0) {
    // Try progressively smaller ranges
    for (const range of [1000, 100, 10, 1, 0.1]) {
      low = -range
      high = range
      fLow = evalAt(low) - targetValue
      fHigh = evalAt(high) - targetValue
      if (fLow * fHigh <= 0) break
    }
    if (fLow * fHigh > 0) return null
  }

  for (let i = 0; i < maxIter; i++) {
    const mid = (low + high) / 2
    const fMid = evalAt(mid) - targetValue

    if (Math.abs(fMid) < tolerance) return mid

    if (fMid * fLow < 0) {
      high = mid
      fHigh = fMid
    } else {
      low = mid
      fLow = fMid
    }
  }

  return (low + high) / 2
}
