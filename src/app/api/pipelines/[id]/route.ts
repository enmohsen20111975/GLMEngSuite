import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/database'
import { getPipelineById } from '@/lib/engineering-pipelines'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = await ensureDatabase()

    // Try local pipeline first (hardcoded engineering pipelines)
    const localPipeline = getPipelineById(id)
    if (localPipeline) {
      return NextResponse.json({
        success: true,
        data: {
          id: localPipeline.id,
          pipeline_id: localPipeline.id,
          name: localPipeline.name,
          description: localPipeline.description,
          domain: localPipeline.domain,
          difficulty_level: localPipeline.difficulty,
          estimated_time: localPipeline.estimated_time,
          icon: localPipeline.icon,
          is_local: true,
          steps: localPipeline.steps.map(s => ({
            step_number: s.stepNumber,
            name: s.name,
            description: s.description,
            standard_ref: s.standard_ref,
            formula_display: s.formula_display,
            inputs: s.inputs.map(i => ({
              name: i.name, label: i.label, unit: i.unit, type: i.type,
              options: i.options, min: i.min, max: i.max, default: i.default,
              required: i.required, help: i.help, fromPreviousStep: i.fromPreviousStep,
            })),
            outputs: s.outputs,
          }))
        }
      })
    }

    // Try DB pipeline from workflows.db
    const pipeline = db.queryOneWorkflow<Record<string, unknown>>(
      'SELECT * FROM calculation_pipelines WHERE id = ? OR pipeline_id = ?',
      [parseInt(id), id]
    )

    if (!pipeline) {
      return NextResponse.json(
        { success: false, error: 'Pipeline not found' },
        { status: 404 }
      )
    }

    const pipelineDbId = pipeline.id as number

    // Get pipeline steps
    const steps = db.queryWorkflows<Record<string, unknown>>(
      'SELECT * FROM calculation_steps WHERE pipeline_id = ? AND is_active = 1 ORDER BY step_number',
      [pipelineDbId]
    )

    // Get dependencies between steps
    const dependencies = db.queryWorkflows<Record<string, unknown>>(
      `SELECT cd.* FROM calculation_dependencies cd
       JOIN calculation_steps cs ON cd.step_id = cs.id
       WHERE cs.pipeline_id = ?`,
      [pipelineDbId]
    )

    return NextResponse.json({
      success: true,
      data: {
        ...pipeline,
        is_local: false,
        steps,
        dependencies,
      }
    })
  } catch (error) {
    console.error('Pipeline detail API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pipeline' },
      { status: 500 }
    )
  }
}
