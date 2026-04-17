import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get('category')

    const where: Record<string, unknown> = {}
    if (category) where.category = category

    const conversions = await db.unitConversion.findMany({ where })

    // Group by category
    const grouped = conversions.reduce<Record<string, typeof conversions>>((acc, conv) => {
      if (!acc[conv.category]) acc[conv.category] = []
      acc[conv.category].push(conv)
      return acc
    }, {})

    return NextResponse.json({ conversions, grouped })
  } catch (error) {
    console.error('Error fetching unit conversions:', error)
    return NextResponse.json({ error: 'Failed to fetch unit conversions' }, { status: 500 })
  }
}
