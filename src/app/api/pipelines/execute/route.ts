import { NextRequest, NextResponse } from 'next/server'
import { evaluate } from 'mathjs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pipelineId, stepInputs } = body

    if (!pipelineId) {
      return NextResponse.json({ error: 'Missing pipelineId' }, { status: 400 })
    }

    const { db } = await import('@/lib/db')

    const pipeline = await db.calculationPipeline.findUnique({
      where: { id: pipelineId },
      include: {
        steps: { orderBy: { order: 'asc' } },
      },
    })

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 })
    }

    // Execute each step sequentially
    const scope: Record<string, number> = {}
    const stepResults = []

    for (const step of pipeline.steps) {
      const stepInput = stepInputs?.[step.id] ?? {}

      // Add step inputs to scope
      if (step.inputSchema) {
        try {
          const schema = JSON.parse(step.inputSchema)
          for (const [key, config] of Object.entries(schema as Record<string, unknown>)) {
            const cfg = config as { symbol?: string; default?: number }
            const symbol = cfg.symbol || key
            const value = stepInput[key] ?? cfg.default
            if (value !== undefined) {
              scope[symbol] = Number(value)
            }
          }
        } catch {
          // If schema parsing fails, use raw inputs
          for (const [key, value] of Object.entries(stepInput)) {
            scope[key] = Number(value)
          }
        }
      }

      // Evaluate formula
      let result: Record<string, number> = {}
      if (step.formula) {
        try {
          // Support multiple formulas separated by semicolons
          const formulas = step.formula.split(';').map(f => f.trim()).filter(Boolean)
          for (const formula of formulas) {
            const evaluated = evaluate(formula, scope)
            if (typeof evaluated === 'object' && evaluated !== null) {
              Object.assign(result, evaluated)
              Object.assign(scope, evaluated)
            } else if (formula.includes('=')) {
              const varName = formula.split('=')[0].trim()
              result[varName] = evaluated
              scope[varName] = evaluated
            }
          }
        } catch (err) {
          console.error(`Error evaluating step ${step.name}:`, err)
          result = { error: NaN }
        }
      }

      stepResults.push({
        stepId: step.id,
        stepName: step.name,
        stepOrder: step.order,
        inputs: { ...stepInput },
        outputs: result,
      })
    }

    // Save to history
    try {
      const demoUser = await db.user.findFirst({ where: { email: 'demo@engisuite.com' } })
      if (demoUser) {
        await db.calculationHistory.create({
          data: {
            pipelineId: pipeline.id,
            inputs: JSON.stringify(stepInputs),
            outputs: JSON.stringify(stepResults),
            type: 'pipeline',
            userId: demoUser.id,
          },
        })
      }
    } catch {
      // Non-critical
    }

    return NextResponse.json({
      pipeline: { id: pipeline.id, name: pipeline.name },
      steps: stepResults,
      scope,
    })
  } catch (error) {
    console.error('Error executing pipeline:', error)
    return NextResponse.json({ error: 'Failed to execute pipeline' }, { status: 500 })
  }
}
