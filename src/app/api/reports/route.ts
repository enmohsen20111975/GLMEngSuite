import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get('category')
    const templateType = searchParams.get('templateType')
    const isPublic = searchParams.get('isPublic')

    const where: Record<string, any> = {}
    if (category) where.category = category
    if (templateType) where.templateType = templateType
    if (isPublic !== null && isPublic !== undefined) {
      where.isPublic = isPublic === 'true'
    } else {
      where.isPublic = true
    }

    const templates = await db.reportTemplate.findMany({
      where,
      orderBy: { name: 'asc' },
    })

    // Parse JSON fields if present
    const enrichedTemplates = templates.map(template => {
      let parsedSections: unknown = null
      let parsedStyling: unknown = null

      if (template.sections) {
        try {
          parsedSections = JSON.parse(template.sections)
        } catch {
          parsedSections = template.sections
        }
      }

      if (template.styling) {
        try {
          parsedStyling = JSON.parse(template.styling)
        } catch {
          parsedStyling = template.styling
        }
      }

      return {
        ...template,
        parsedSections,
        parsedStyling,
      }
    })

    return NextResponse.json(enrichedTemplates)
  } catch (error) {
    console.error('Error fetching report templates:', error)
    return NextResponse.json({ error: 'Failed to fetch report templates' }, { status: 500 })
  }
}
