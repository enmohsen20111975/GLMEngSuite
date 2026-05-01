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
      chapterCount,
      quizCount,
      standardCount,
      coefficientCount,
      reportTemplateCount,
      engRefCount,
      unitCount,
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
      db.chapter.count(),
      db.quiz.count(),
      db.engineeringStandard.count(),
      db.standardCoefficient.count(),
      db.reportTemplate.count(),
      db.engineeringReferenceData.count(),
      db.unitConversion.count(),
      db.equation.groupBy({ by: ['domain'], _count: { domain: true }, orderBy: { _count: { domain: 'desc' } } }),
      db.calculationPipeline.groupBy({ by: ['domain'], _count: { domain: true }, orderBy: { _count: { domain: 'desc' } } }),
      db.course.groupBy({ by: ['domain'], _count: { domain: true }, orderBy: { _count: { domain: 'desc' } } }),
    ])

    // Count distinct disciplines from courses
    const disciplines = courseDomainDistribution.length

    return NextResponse.json({
      success: true,
      data: {
        equations: equationCount,
        pipelines: pipelineCount,
        courses: courseCount,
        categories: categoryCount,
        modules: moduleCount,
        lessons: lessonCount,
        chapters: chapterCount,
        quizzes: quizCount,
        standards: standardCount,
        coefficients: coefficientCount,
        reportTemplates: reportTemplateCount,
        engineeringRefData: engRefCount,
        unitConversions: unitCount,
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
