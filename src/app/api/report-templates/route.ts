import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    const where: any = {}
    if (category) where.category = category

    const templates = await db.reportTemplate.findMany({
      where,
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({ success: true, data: templates })
  } catch (error) {
    console.error('Report templates API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch report templates' },
      { status: 500 }
    )
  }
}
