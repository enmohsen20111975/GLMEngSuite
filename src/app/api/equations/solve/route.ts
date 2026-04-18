import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/database'
import { evaluateFormula } from '@/lib/calculation-engine'

export async function POST(request: NextRequest) {
  try {
    const db = await ensureDatabase()
    const body = await request.json()
    const { equationId, inputs } = body

    if (!equationId || !inputs) {
      return NextResponse.json(
        { success: false, error: 'equationId and inputs are required' },
        { status: 400 }
      )
    }

    // Load equation from workflows.db - try by id (numeric) or equation_id (string)
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

    // Load inputs joined with equation
    const eqInputs = db.queryWorkflows<Record<string, unknown>>(
      `SELECT ei.* FROM equation_inputs ei
       WHERE ei.equation_id = ?
       ORDER BY ei.input_order`,
      [eqId]
    )

    // Load outputs joined with equation
    const eqOutputs = db.queryWorkflows<Record<string, unknown>>(
      `SELECT eo.* FROM equation_outputs eo
       WHERE eo.equation_id = ?
       ORDER BY eo.output_order`,
      [eqId]
    )

    // Build evaluation context from user inputs + defaults
    const context: Record<string, number> = {}
    for (const inp of eqInputs) {
      const symbol = (inp.symbol as string) || (inp.name as string)
      const val = (inputs as Record<string, unknown>)[symbol] ??
        (inputs as Record<string, unknown>)[inp.name as string] ??
        inp.default_value
      if (val !== undefined && val !== null) {
        context[symbol] = Number(val)
      }
    }

    // Solve the equation using evaluateFormula
    const outputs: Record<string, number> = {}
    const formula = (equation.equation as string) || (equation.formula as string) || ''

    if (formula) {
      // The equation field may contain multiple lines separated by ; or \n
      // Each line may be: output_var = expression OR just an expression
      const formulas = formula.replace(/;/g, '\n').split('\n').map(f => f.trim()).filter(Boolean)

      for (const f of formulas) {
        if (f.includes('=') && !f.includes('==')) {
          const parts = f.split('=')
          if (parts.length >= 2) {
            const varName = parts[0].trim()
            const expr = parts.slice(1).join('=').trim()
            try {
              const result = evaluateFormula(expr, context)
              context[varName] = result
              outputs[varName] = result
            } catch {
              // Skip invalid formulas
            }
          }
        } else {
          try {
            const result = evaluateFormula(f, context)
            outputs['result'] = result
          } catch {
            // Skip invalid formulas
          }
        }
      }
    }

    // Also evaluate individual output formulas if present
    for (const out of eqOutputs) {
      const outFormula = out.formula as string | null
      const symbol = (out.symbol as string) || (out.name as string)
      if (outFormula) {
        try {
          const result = evaluateFormula(outFormula, context)
          outputs[symbol] = result
        } catch {
          // Skip invalid output formulas
        }
      } else if (symbol in outputs) {
        // Already computed from main formula
      } else if (symbol in context) {
        outputs[symbol] = context[symbol]
      }
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
