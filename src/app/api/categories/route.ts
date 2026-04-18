import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const db = await ensureDatabase()
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')

    let sql = `
      SELECT
        ec.id, ec.name, ec.slug, ec.description, ec.domain,
        ec.parent_id, ec.display_order, ec.icon, ec.color,
        COUNT(e.id) as equation_count
      FROM equation_categories ec
      LEFT JOIN equations e ON ec.id = e.category_id AND e.is_active = 1
    `
    const params: unknown[] = []

    if (domain) {
      sql += ` WHERE ec.domain = ?`
      params.push(domain)
    }

    sql += ` GROUP BY ec.id ORDER BY ec.display_order, ec.name`

    const categories = await db.queryWorkflows(sql, params)

    return NextResponse.json({ success: true, data: categories })
  } catch (error) {
    console.error('Categories API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}
