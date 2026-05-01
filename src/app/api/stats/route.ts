import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // Fetch all counts from Prisma in parallel
    const [
      equationCount,
      pipelineCount,
      categoryCount,
      courseCount,
      moduleCount,
      lessonCount,
      domainDistribution,
      pipelineDomainDistribution,
      courseDomainDistribution,
    ] = await Promise.all([
      db.equation.count(),
      db.calculationPipeline.count(),
      db.equationCategory.count(),
      db.course.count(),
      db.courseModule.count(),
      db.lesson.count(),
      db.equation.groupBy({ by: ['domain'], _count: { domain: true }, orderBy: { _count: { domain: 'desc' } } }),
      db.calculationPipeline.groupBy({ by: ['domain'], _count: { domain: true }, orderBy: { _count: { domain: 'desc' } } }),
      db.course.groupBy({ by: ['domain'], _count: { domain: true }, orderBy: { _count: { domain: 'desc' } } }),
    ])

    // No engineering_standards or disciplines tables in Prisma — return 0 / sensible defaults
    const standards = 0
    const disciplines = 0

    return NextResponse.json({
      success: true,
      data: {
        equations: equationCount,
        pipelines: pipelineCount,
        courses: courseCount,
        categories: categoryCount,
        modules: moduleCount,
        lessons: lessonCount,
        standards,
        disciplines,
        domainDistribution: domainDistribution.map(d => ({ domain: d.domain, cnt: d._count.domain })),
        pipelineDomainDistribution: pipelineDomainDistribution.map(d => ({ domain: d.domain, cnt: d._count.domain })),
        courseDomainDistribution: courseDomainDistribution.map(d => ({ discipline: d.domain, cnt: d._count.domain })),
      }
    })
  } catch (error) {
    console.error('Stats API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
