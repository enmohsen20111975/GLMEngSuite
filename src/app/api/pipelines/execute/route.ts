import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/database'
import { getCalculationEngine } from '@/lib/calculation-engine'
import { getPipelineById, ENGINEERING_PIPELINES } from '@/lib/engineering-pipelines'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pipelineId, inputs } = body

    if (!pipelineId || !inputs) {
      return NextResponse.json({ success: false, error: 'pipelineId and inputs are required' }, { status: 400 })
    }

    // Try local pipeline first
    const localPipeline = getPipelineById(pipelineId)
    if (localPipeline) {
      const stepResults: any[] = []
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
        } catch (err: any) {
          stepResults.push({
            step_number: step.stepNumber,
            step_name: step.name,
            inputs: stepInputs,
            outputs: {},
            error: err.message,
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

    // Fall back to DB pipeline
    const db = await ensureDatabase()
    const engine = getCalculationEngine()
    const result = engine.executePipeline(pipelineId, inputs)

    return NextResponse.json({
      success: result.success,
      data: {
        pipeline_id: pipelineId,
        is_local: false,
        ...result,
      }
    })
  } catch (error) {
    console.error('Pipeline execute API error:', error)
    return NextResponse.json({ success: false, error: 'Failed to execute pipeline' }, { status: 500 })
  }
}
