import { NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/database'

export async function GET() {
  try {
    const db = await ensureDatabase()

    // Workflows DB counts
    const eqCount = db.queryWorkflows<{ cnt: number }>('SELECT COUNT(*) as cnt FROM equations WHERE is_active = 1')
    const pipelineCount = db.queryWorkflows<{ cnt: number }>('SELECT COUNT(*) as cnt FROM calculation_pipelines WHERE is_active = 1')
    const categoryCount = db.queryWorkflows<{ cnt: number }>('SELECT COUNT(*) as cnt FROM equation_categories')
    const standardCount = db.queryWorkflows<{ cnt: number }>('SELECT COUNT(*) as cnt FROM engineering_standards WHERE is_active = 1')

    // Engmastery DB counts (courses, modules, chapters, lessons, quizzes)
    const courseCount = db.queryEngmastery<{ cnt: number }>('SELECT COUNT(*) as cnt FROM courses')
    const moduleCount = db.queryEngmastery<{ cnt: number }>('SELECT COUNT(*) as cnt FROM modules')
    const lessonCount = db.queryEngmastery<{ cnt: number }>('SELECT COUNT(*) as cnt FROM lessons')

    // Courses DB counts (disciplines)
    const disciplineCount = db.queryCourses<{ cnt: number }>('SELECT COUNT(*) as cnt FROM disciplines WHERE is_active = 1')

    // Domain distribution from equations
    const domainDist = db.queryWorkflows<{ domain: string; cnt: number }>(
      'SELECT domain, COUNT(*) as cnt FROM equations WHERE is_active = 1 GROUP BY domain ORDER BY cnt DESC'
    )

    // Pipeline domain distribution
    const pipelineDomainDist = db.queryWorkflows<{ domain: string; cnt: number }>(
      'SELECT domain, COUNT(*) as cnt FROM calculation_pipelines WHERE is_active = 1 GROUP BY domain ORDER BY cnt DESC'
    )

    // Course domain distribution from engmastery
    const courseDomainDist = db.queryEngmastery<{ discipline: string; cnt: number }>(
      'SELECT discipline, COUNT(*) as cnt FROM courses GROUP BY discipline ORDER BY cnt DESC'
    )

    return NextResponse.json({
      success: true,
      data: {
        equations: eqCount[0]?.cnt || 0,
        pipelines: pipelineCount[0]?.cnt || 0,
        courses: courseCount[0]?.cnt || 0,
        categories: categoryCount[0]?.cnt || 0,
        modules: moduleCount[0]?.cnt || 0,
        lessons: lessonCount[0]?.cnt || 0,
        standards: standardCount[0]?.cnt || 0,
        disciplines: disciplineCount[0]?.cnt || 0,
        domainDistribution: domainDist,
        pipelineDomainDistribution: pipelineDomainDist,
        courseDomainDistribution: courseDomainDist,
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
