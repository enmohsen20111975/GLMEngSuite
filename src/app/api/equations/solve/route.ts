import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/database'
import { evaluateFormula } from '@/lib/calculation-engine'

export async function POST(request: NextRequest) {
  try {
    const db = await ensureDatabase()
    const body = await request.json()
    const { equationId, inputs } = body

    if (!equationId || !inputs) {
      return NextResponse.json({ success: false, error: 'equationId and inputs are required' }, { status: 400 })
    }

    // Load equation
    const equation = db.queryOneWorkflow<any>(
      'SELECT * FROM equations WHERE id = ? OR equation_id = ?',
      [equationId, equationId]
    )

    if (!equation) {
      return NextResponse.json({ success: false, error: 'Equation not found' }, { status: 404 })
    }

    // Load inputs/outputs
    const eqInputs = db.queryWorkflows<any>(
      'SELECT * FROM equation_inputs WHERE equation_id = ? ORDER BY input_order',
      [equation.id]
    )
    const eqOutputs = db.queryWorkflows<any>(
      'SELECT * FROM equation_outputs WHERE equation_id = ? ORDER BY output_order',
      [equation.id]
    )

    // Build context from user inputs
    const context: Record<string, number> = {}
    for (const inp of eqInputs) {
      const val = inputs[inp.symbol] ?? inputs[inp.name] ?? inp.default_value
      if (val !== undefined && val !== null) {
        context[inp.symbol] = Number(val)
      }
    }

    // Solve using evaluateFormula
    const outputs: Record<string, number> = {}
    if (equation.equation || equation.formula) {
      const formula = equation.equation || equation.formula
      // Try to evaluate the formula
      try {
        const result = evaluateFormula(formula, context)
        outputs['result'] = result
      } catch {
        outputs['result'] = 0
      }
    }

    // Also try solving individual output formulas
    for (const out of eqOutputs) {
      if (out.formula) {
        try {
          outputs[out.symbol || out.name] = evaluateFormula(out.formula, context)
        } catch {
          // skip
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        equation: {
          id: equation.id,
          name: equation.name,
          formula: equation.equation || equation.formula,
          equation_latex: equation.equation_latex,
        },
        inputs: context,
        outputs,
        inputDefinitions: eqInputs,
        outputDefinitions: eqOutputs,
      }
    })
  } catch (error) {
    console.error('Solve API error:', error)
    return NextResponse.json({ success: false, error: 'Failed to solve equation' }, { status: 500 })
  }
}
