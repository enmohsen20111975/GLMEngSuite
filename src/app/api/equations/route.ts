import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const domain = searchParams.get('domain')
    const category = searchParams.get('category')
    const search = searchParams.get('search')

    const where: Record<string, unknown> = {}
    if (domain) where.domain = domain
    if (category) where.category = category
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        { tags: { contains: search } },
      ]
    }

    const equations = await db.equation.findMany({
      where,
      include: {
        inputs: { orderBy: { order: 'asc' } },
        outputs: { orderBy: { order: 'asc' } },
        categoryRef: true,
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(equations)
  } catch (error) {
    console.error('Error fetching equations:', error)
    return NextResponse.json({ error: 'Failed to fetch equations' }, { status: 500 })
  }
}
