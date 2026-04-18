import { NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/database'

export async function GET() {
  try {
    const db = await ensureDatabase()
    const categories = db.queryWorkflows<any>(
      `SELECT ec.*, COUNT(e.id) as equation_count
       FROM equation_categories ec
       LEFT JOIN equations e ON ec.id = e.category_id AND e.is_active = 1
       GROUP BY ec.id
       ORDER BY ec.display_order, ec.name`
    )

    return NextResponse.json({ success: true, data: categories })
  } catch (error) {
    console.error('Categories API error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch categories' }, { status: 500 })
  }
}
