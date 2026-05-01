import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getPipelineById } from '@/lib/engineering-pipelines'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pipelineId, inputs } = body

    if (!pipelineId || !inputs) {
      return NextResponse.json(
        { success: false, error: 'pipelineId and inputs are required' },
        { status: 400 }
      )
    }

    // Try local pipeline first (hardcoded engineering pipelines)
    const localPipeline = getPipelineById(pipelineId)
    if (localPipeline) {
      const stepResults: Array<{
        step_number: number
        step_name: string
        inputs: Record<string, number | string>
        outputs: Record<string, number | string | boolean>
        formula_display?: string[]
        standard_ref?: string
        success: boolean
        error?: string
      }> = []
      const accumulatedInputs: Record<string, number | string> = { ...inputs }

      for (const step of localPipeline.steps) {
        // Fill inputs from previous step outputs
        const stepInputs: Record<string, number | string> = {}
        for (const inp of step.inputs) {
          const val = accumulatedInputs[inp.name] ?? inputs[inp.name] ?? inp.default
          if (val !== undefined) stepInputs[inp.name] = val
        }

        try {
          const outputs = step.calculate(stepInputs)
          stepResults.push({
            step_number: step.stepNumber,
            step_name: step.name,
            inputs: stepInputs,
            outputs,
            formula_display: step.formula_display,
            standard_ref: step.standard_ref,
            success: true,
          })
          Object.assign(accumulatedInputs, outputs)
        } catch (err: unknown) {
          stepResults.push({
            step_number: step.stepNumber,
            step_name: step.name,
            inputs: stepInputs,
            outputs: {},
            error: err instanceof Error ? err.message : String(err),
            success: false,
          })
          break
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          pipeline_id: pipelineId,
          pipeline_name: localPipeline.name,
          is_local: true,
          steps: stepResults,
        }
      })
    }

    // Fall back to DB pipeline from Prisma
    const pipeline = await db.calculationPipeline.findFirst({
      where: {
        OR: [
          { id: pipelineId },
          { slug: pipelineId },
        ]
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    })

    if (!pipeline) {
      return NextResponse.json(
        { success: false, error: 'Pipeline not found' },
        { status: 404 }
      )
    }

    // Execute DB pipeline steps sequentially
    const stepResults: Array<{
      step_number: number
      step_name: string
      inputs: Record<string, number | string>
      outputs: Record<string, number | string>
      formula: string | null
      success: boolean
      error?: string
    }> = []

    const ctx: Record<string, number | string> = { ...inputs }

    for (const step of pipeline.steps) {
      const inputSchema: Record<string, { unit?: string; label?: string; default?: number }> =
        step.inputSchema ? JSON.parse(step.inputSchema) : {}

      const stepInputs: Record<string, number | string> = {}
      for (const [key, schema] of Object.entries(inputSchema)) {
        const val = ctx[key] ?? inputs[key] ?? schema.default
        if (val !== undefined) stepInputs[key] = val
      }

      if (!step.formula) {
        stepResults.push({
          step_number: step.order,
          step_name: step.name,
          inputs: stepInputs,
          outputs: {},
          formula: null,
          success: true,
        })
        continue
      }

      try {
        // Simple formula evaluation using Function constructor
        const evalContext: Record<string, number> = {}
        for (const [k, v] of Object.entries(stepInputs)) {
          const num = Number(v)
          if (!isNaN(num)) evalContext[k] = num
        }

        // Parse formula: handle statements like "I = P / (sqrt(3) * V * PF)"
        const formula = step.formula
        const statements = formula.split(';').map(s => s.trim()).filter(Boolean)
        const outputs: Record<string, number | string> = {}

        for (const stmt of statements) {
          if (stmt.includes('=') && !stmt.includes('==')) {
            const eqIdx = stmt.indexOf('=')
            const varName = stmt.substring(0, eqIdx).trim()
            const expr = stmt.substring(eqIdx + 1).trim()
            try {
              const fn = new Function(...Object.keys(evalContext), `sqrt=Math.sqrt;pow=Math.pow;abs=Math.abs;round=Math.round;ceil=Math.ceil;floor=Math.floor;PI=Math.PI;return ${expr}`)
              const val = fn(...Object.values(evalContext))
              if (typeof val === 'number' && isFinite(val)) {
                evalContext[varName] = val
                outputs[varName] = val
                ctx[varName] = val
              }
            } catch {
              // Skip unparseable statements
            }
          }
        }

        stepResults.push({
          step_number: step.order,
          step_name: step.name,
          inputs: stepInputs,
          outputs,
          formula: step.formula,
          success: true,
        })
      } catch (err: unknown) {
        stepResults.push({
          step_number: step.order,
          step_name: step.name,
          inputs: stepInputs,
          outputs: {},
          formula: step.formula,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        })
        break
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        pipeline_id: pipelineId,
        pipeline_name: pipeline.name,
        is_local: false,
        steps: stepResults,
      }
    })
  } catch (error) {
    console.error('Pipeline execute API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to execute pipeline' },
      { status: 500 }
    )
  }
}
