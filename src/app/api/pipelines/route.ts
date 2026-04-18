import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/database'
import { ENGINEERING_PIPELINES } from '@/lib/engineering-pipelines'

export async function GET(request: NextRequest) {
  try {
    const db = await ensureDatabase()
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')
    const search = searchParams.get('search')

    // DB pipelines from workflows.db with step counts
    let sql = `
      SELECT cp.id, cp.pipeline_id, cp.name, cp.description, cp.domain,
             cp.standard_id, cp.version, cp.estimated_time, cp.difficulty_level,
             cp.tags, cp.is_active,
             COUNT(cs.id) as step_count
      FROM calculation_pipelines cp
      LEFT JOIN calculation_steps cs ON cp.id = cs.pipeline_id AND cs.is_active = 1
      WHERE cp.is_active = 1
    `
    const params: unknown[] = []

    if (domain) {
      sql += ` AND cp.domain = ?`
      params.push(domain)
    }
    if (search) {
      sql += ` AND (cp.name LIKE ? OR cp.description LIKE ?)`
      params.push(`%${search}%`, `%${search}%`)
    }

    sql += ` GROUP BY cp.id ORDER BY cp.name`
    const dbPipelines = await db.queryWorkflows(sql, params)

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
      ...dbPipelines.map(p => ({ ...p, is_local: false })),
      ...localPipelines,
    ]

    // Apply filters to combined set
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
