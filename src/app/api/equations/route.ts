import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const db = await ensureDatabase()
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')
    const categoryId = searchParams.get('category_id')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query with JOINs to equation_inputs and equation_outputs
    let sql = `
      SELECT
        e.id, e.equation_id, e.name, e.description, e.domain,
        e.category_id, e.equation, e.equation_latex, e.equation_pattern,
        e.difficulty_level, e.tags, e.is_active,
        ec.name as category_name, ec.icon as category_icon, ec.slug as category_slug, ec.color as category_color
      FROM equations e
      LEFT JOIN equation_categories ec ON e.category_id = ec.id
      WHERE e.is_active = 1
    `
    const params: unknown[] = []

    if (domain) {
      sql += ` AND e.domain = ?`
      params.push(domain)
    }
    if (categoryId) {
      sql += ` AND e.category_id = ?`
      params.push(parseInt(categoryId))
    }
    if (search) {
      sql += ` AND (e.name LIKE ? OR e.description LIKE ? OR e.tags LIKE ?)`
      params.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }

    sql += ` ORDER BY e.name LIMIT ? OFFSET ?`
    params.push(limit, offset)

    const equations = db.queryWorkflows(sql, params)

    // Get inputs and outputs for each equation via JOIN
    const equationsWithDetails = equations.map(eq => {
      const id = (eq as Record<string, unknown>).id as number
      const inputs = db.queryWorkflows(
        'SELECT * FROM equation_inputs WHERE equation_id = ? ORDER BY input_order',
        [id]
      )
      const outputs = db.queryWorkflows(
        'SELECT * FROM equation_outputs WHERE equation_id = ? ORDER BY output_order',
        [id]
      )
      return { ...eq, inputs, outputs }
    })

    // Get total count for pagination
    let countSql = `SELECT COUNT(*) as cnt FROM equations WHERE is_active = 1`
    const countParams: unknown[] = []
    if (domain) { countSql += ` AND domain = ?`; countParams.push(domain) }
    if (categoryId) { countSql += ` AND category_id = ?`; countParams.push(parseInt(categoryId)) }
    if (search) {
      countSql += ` AND (name LIKE ? OR description LIKE ? OR tags LIKE ?)`
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }
    const total = db.queryWorkflows<{ cnt: number }>(countSql, countParams)

    return NextResponse.json({
      success: true,
      data: equationsWithDetails,
      total: total[0]?.cnt || 0,
      page: Math.floor(offset / limit) + 1,
      limit,
    })
  } catch (error) {
    console.error('Equations API error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch equations' }, { status: 500 })
  }
}
