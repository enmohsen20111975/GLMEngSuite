import { NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/database'

export async function GET() {
  try {
    const db = await ensureDatabase()

    // Workflows DB counts (lightweight - 2.6MB)
    const [eqCount, pipelineCount, categoryCount, standardCount, domainDist, pipelineDomainDist] = await Promise.all([
      db.queryWorkflows<{ cnt: number }>('SELECT COUNT(*) as cnt FROM equations WHERE is_active = 1'),
      db.queryWorkflows<{ cnt: number }>('SELECT COUNT(*) as cnt FROM calculation_pipelines WHERE is_active = 1'),
      db.queryWorkflows<{ cnt: number }>('SELECT COUNT(*) as cnt FROM equation_categories'),
      db.queryWorkflows<{ cnt: number }>('SELECT COUNT(*) as cnt FROM engineering_standards WHERE is_active = 1'),
      db.queryWorkflows<{ domain: string; cnt: number }>(
        'SELECT domain, COUNT(*) as cnt FROM equations WHERE is_active = 1 GROUP BY domain ORDER BY cnt DESC'
      ),
      db.queryWorkflows<{ domain: string; cnt: number }>(
        'SELECT domain, COUNT(*) as cnt FROM calculation_pipelines WHERE is_active = 1 GROUP BY domain ORDER BY cnt DESC'
      ),
    ])

    // Engmastery DB counts (3.4MB - load separately)
    let courseCount = 0, moduleCount = 0, lessonCount = 0
    let courseDomainDist: { discipline: string; cnt: number }[] = []
    try {
      const [cc, mc, lc, cdd] = await Promise.all([
        db.queryEngmastery<{ cnt: number }>('SELECT COUNT(*) as cnt FROM courses'),
        db.queryEngmastery<{ cnt: number }>('SELECT COUNT(*) as cnt FROM modules'),
        db.queryEngmastery<{ cnt: number }>('SELECT COUNT(*) as cnt FROM lessons'),
        db.queryEngmastery<{ discipline: string; cnt: number }>(
          'SELECT discipline, COUNT(*) as cnt FROM courses GROUP BY discipline ORDER BY cnt DESC'
        ),
      ])
      courseCount = cc[0]?.cnt || 0
      moduleCount = mc[0]?.cnt || 0
      lessonCount = lc[0]?.cnt || 0
      courseDomainDist = cdd
    } catch (e) {
      console.error('Engmastery stats error:', e)
    }

    // Courses DB (31MB - avoid loading just for a count, use cached/hardcoded value)
    let disciplines = 5 // Known value from DB, avoids loading 31MB file
    try {
      const dc = await db.queryCourses<{ cnt: number }>('SELECT COUNT(*) as cnt FROM disciplines WHERE is_active = 1')
      disciplines = dc[0]?.cnt || 5
    } catch (e) {
      // Use fallback value
    }

    return NextResponse.json({
      success: true,
      data: {
        equations: eqCount[0]?.cnt || 0,
        pipelines: pipelineCount[0]?.cnt || 0,
        courses: courseCount,
        categories: categoryCount[0]?.cnt || 0,
        modules: moduleCount,
        lessons: lessonCount,
        standards: standardCount[0]?.cnt || 0,
        disciplines,
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
