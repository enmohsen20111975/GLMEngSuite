import { NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/database'

export async function GET() {
  try {
    const db = await ensureDatabase()
    
    // Get equation count
    const eqCount = db.queryWorkflows<{ cnt: number }>('SELECT COUNT(*) as cnt FROM equations')
    const pipelineCount = db.queryWorkflows<{ cnt: number }>('SELECT COUNT(*) as cnt FROM calculation_pipelines')
    const courseCount = db.queryCourses<{ cnt: number }>('SELECT COUNT(*) as cnt FROM courses')
    const categoryCount = db.queryWorkflows<{ cnt: number }>('SELECT COUNT(*) as cnt FROM equation_categories')
    
    // Domain distribution
    const domainDist = db.queryWorkflows<{ domain: string; cnt: number }>(
      'SELECT domain, COUNT(*) as cnt FROM equations GROUP BY domain ORDER BY cnt DESC'
    )

    return NextResponse.json({
      success: true,
      data: {
        equations: eqCount[0]?.cnt || 0,
        pipelines: pipelineCount[0]?.cnt || 0,
        courses: courseCount[0]?.cnt || 0,
        categories: categoryCount[0]?.cnt || 0,
        domainDistribution: domainDist,
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
