import { NextRequest, NextResponse } from 'next/server'
import { evaluate } from 'mathjs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { equationId, inputs: inputValues } = body

    if (!equationId || !inputValues) {
      return NextResponse.json({ error: 'Missing equationId or inputs' }, { status: 400 })
    }

    // Import db dynamically to avoid issues
    const { db } = await import('@/lib/db')

    const equation = await db.equation.findUnique({
      where: { id: equationId },
      include: {
        inputs: { orderBy: { order: 'asc' } },
        outputs: { orderBy: { order: 'asc' } },
      },
    })

    if (!equation) {
      return NextResponse.json({ error: 'Equation not found' }, { status: 404 })
    }

    // Solve each output
    const results: Record<string, number> = {}
    const scope: Record<string, number> = {}

    // Map input values to symbols
    for (const input of equation.inputs) {
      const val = inputValues[input.symbol] ?? inputValues[input.name]
      if (val !== undefined) {
        scope[input.symbol] = Number(val)
      }
    }

    // Evaluate each output
    for (const output of equation.outputs) {
      try {
        if (output.formula) {
          results[output.symbol] = evaluate(output.formula, scope)
          scope[output.symbol] = results[output.symbol]
        } else {
          // Use the main formula
          results[output.symbol] = evaluate(equation.formula, scope)
          scope[output.symbol] = results[output.symbol]
        }
      } catch (err) {
        console.error(`Error evaluating output ${output.symbol}:`, err)
        results[output.symbol] = NaN
      }
    }

    // Save to calculation history (use demo user)
    try {
      const demoUser = await db.user.findFirst({ where: { email: 'demo@engisuite.com' } })
      if (demoUser) {
        await db.calculationHistory.create({
          data: {
            equationId: equation.id,
            inputs: JSON.stringify(inputValues),
            outputs: JSON.stringify(results),
            type: 'equation',
            userId: demoUser.id,
          },
        })
      }
    } catch {
      // Non-critical, don't fail the request
    }

    return NextResponse.json({
      equation: {
        id: equation.id,
        name: equation.name,
        formula: equation.formula,
      },
      inputs: equation.inputs.map(i => ({
        name: i.name,
        symbol: i.symbol,
        unit: i.unit,
        value: scope[i.symbol],
      })),
      outputs: equation.outputs.map(o => ({
        name: o.name,
        symbol: o.symbol,
        unit: o.unit,
        value: results[o.symbol],
      })),
      results,
    })
  } catch (error) {
    console.error('Error solving equation:', error)
    return NextResponse.json({ error: 'Failed to solve equation' }, { status: 500 })
  }
}
