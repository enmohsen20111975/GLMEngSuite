import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const db = await ensureDatabase()
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const templateType = searchParams.get('type')

    let sql = 'SELECT * FROM report_templates WHERE 1=1'
    const params: unknown[] = []

    if (category) {
      sql += ` AND category = ?`
      params.push(category)
    }
    if (templateType) {
      sql += ` AND template_type = ?`
      params.push(templateType)
    }

    sql += ` ORDER BY category, name`

    const templates = await db.queryWorkflows<Record<string, unknown>>(sql, params)

    // Parse JSON fields (sections, styling)
    const parsedTemplates = templates.map(tmpl => {
      let sections = tmpl.sections
      if (typeof sections === 'string') {
        try {
          sections = JSON.parse(sections as string)
        } catch {
          // Keep as string
        }
      }

      let styling = tmpl.styling
      if (typeof styling === 'string') {
        try {
          styling = JSON.parse(styling as string)
        } catch {
          // Keep as string
        }
      }

      return { ...tmpl, sections, styling }
    })

    return NextResponse.json({ success: true, data: parsedTemplates })
  } catch (error) {
    console.error('Report templates API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch report templates' },
      { status: 500 }
    )
  }
}
