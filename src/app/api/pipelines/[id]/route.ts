import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getPipelineById } from '@/lib/engineering-pipelines'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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

    // Try DB pipeline from Prisma
    const pipeline = await db.calculationPipeline.findFirst({
      where: {
        OR: [
          { id: id },
          { slug: id },
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

    return NextResponse.json({
      success: true,
      data: {
        id: pipeline.id,
        pipeline_id: pipeline.slug,
        name: pipeline.name,
        description: pipeline.description,
        domain: pipeline.domain,
        difficulty_level: pipeline.difficulty,
        icon: pipeline.icon,
        tags: pipeline.tags,
        is_local: pipeline.isLocal,
        steps: pipeline.steps.map(s => ({
          id: s.id,
          step_number: s.order,
          name: s.name,
          description: s.description,
          formula: s.formula,
          input_schema: s.inputSchema ? JSON.parse(s.inputSchema) : null,
          output_schema: s.outputSchema ? JSON.parse(s.outputSchema) : null,
          helper_text: s.helperText,
        })),
        dependencies: [],
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
