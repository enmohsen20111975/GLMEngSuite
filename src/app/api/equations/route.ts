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

    // Build query
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

    const equations = await db.queryWorkflows(sql, params)

    // Batch-fetch inputs and outputs for ALL equations in one query each
    const eqIds = equations.map(eq => (eq as Record<string, unknown>).id as number)

    let inputsMap: Record<number, unknown[]> = {}
    let outputsMap: Record<number, unknown[]> = {}

    if (eqIds.length > 0) {
      // Batch fetch all inputs for these equations
      const placeholders = eqIds.map(() => '?').join(',')
      const allInputs = await db.queryWorkflows(
        `SELECT * FROM equation_inputs WHERE equation_id IN (${placeholders}) ORDER BY input_order`,
        eqIds
      )
      // Group by equation_id
      for (const inp of allInputs) {
        const eqId = (inp as Record<string, unknown>).equation_id as number
        if (!inputsMap[eqId]) inputsMap[eqId] = []
        inputsMap[eqId].push(inp)
      }

      // Batch fetch all outputs for these equations
      const allOutputs = await db.queryWorkflows(
        `SELECT * FROM equation_outputs WHERE equation_id IN (${placeholders}) ORDER BY output_order`,
        eqIds
      )
      // Group by equation_id
      for (const out of allOutputs) {
        const eqId = (out as Record<string, unknown>).equation_id as number
        if (!outputsMap[eqId]) outputsMap[eqId] = []
        outputsMap[eqId].push(out)
      }
    }

    // Merge inputs/outputs into equations
    const equationsWithDetails = equations.map(eq => {
      const id = (eq as Record<string, unknown>).id as number
      return {
        ...eq,
        inputs: inputsMap[id] || [],
        outputs: outputsMap[id] || [],
      }
    })

    // Get total count
    let countSql = `SELECT COUNT(*) as cnt FROM equations WHERE is_active = 1`
    const countParams: unknown[] = []
    if (domain) { countSql += ` AND domain = ?`; countParams.push(domain) }
    if (categoryId) { countSql += ` AND category_id = ?`; countParams.push(parseInt(categoryId)) }
    if (search) {
      countSql += ` AND (name LIKE ? OR description LIKE ? OR tags LIKE ?)`
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }
    const total = await db.queryWorkflows<{ cnt: number }>(countSql, countParams)

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
