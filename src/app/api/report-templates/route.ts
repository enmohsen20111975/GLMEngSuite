import { NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/database'

export async function GET() {
  try {
    const db = await ensureDatabase()
    const templates = db.queryWorkflows<any>(
      'SELECT * FROM report_templates ORDER BY category, name'
    )

    return NextResponse.json({ success: true, data: templates })
  } catch (error) {
    console.error('Report templates API error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch report templates' }, { status: 500 })
  }
}
