import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')

    // Build where clause
    const where: Record<string, unknown> = {}
    if (domain) {
      where.domain = domain
    }

    // Fetch categories with equation counts
    const categories = await db.equationCategory.findMany({
      where,
      include: {
        _count: { select: { equations: true } },
      },
      orderBy: [
        { order: 'asc' },
        { name: 'asc' },
      ],
    })

    const mapped = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      domain: cat.domain,
      parent_id: null,
      display_order: cat.order,
      icon: cat.icon,
      color: null,
      equation_count: cat._count.equations,
    }))

    return NextResponse.json({ success: true, data: mapped })
  } catch (error) {
    console.error('Categories API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}
