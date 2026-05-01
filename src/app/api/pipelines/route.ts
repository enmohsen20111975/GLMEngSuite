import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ENGINEERING_PIPELINES } from '@/lib/engineering-pipelines'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')
    const search = searchParams.get('search')

    // Build where clause for Prisma query
    const where: Record<string, unknown> = {}
    if (domain) {
      where.domain = domain
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ]
    }

    // DB pipelines from Prisma with step counts
    const dbPipelines = await db.calculationPipeline.findMany({
      where,
      include: { steps: true },
      orderBy: { name: 'asc' },
    })

    const dbPipelineData = dbPipelines.map(p => ({
      id: p.id,
      pipeline_id: p.slug,
      name: p.name,
      description: p.description,
      domain: p.domain,
      standard_id: null,
      version: null,
      estimated_time: null,
      difficulty_level: p.difficulty,
      tags: p.tags,
      is_active: true,
      step_count: p.steps.length,
      is_local: false,
      icon: p.icon,
      category: p.category,
    }))

    // Local engineering pipelines (hardcoded)
    const localPipelines = ENGINEERING_PIPELINES.map(p => ({
      id: p.id,
      pipeline_id: p.id,
      name: p.name,
      description: p.description,
      domain: p.domain,
      difficulty_level: p.difficulty,
      estimated_time: p.estimated_time,
      step_count: p.steps.length,
      is_local: true,
      icon: p.icon,
    }))

    // Combine DB + local pipelines
    let allPipelines = [
      ...dbPipelineData,
      ...localPipelines,
    ]

    // Apply filters to combined set (in case domain/search wasn't in Prisma where)
    if (domain) {
      allPipelines = allPipelines.filter(p => p.domain === domain)
    }
    if (search) {
      const s = search.toLowerCase()
      allPipelines = allPipelines.filter(p =>
        p.name.toLowerCase().includes(s) || (p.description || '').toLowerCase().includes(s)
      )
    }

    return NextResponse.json({ success: true, data: allPipelines })
  } catch (error) {
    console.error('Pipelines API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pipelines' },
      { status: 500 }
    )
  }
}
