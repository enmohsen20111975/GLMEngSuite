import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')
    const type = searchParams.get('type')

    const where: any = { isActive: true }
    if (domain) where.domain = domain
    if (type) where.standardType = type

    const standards = await db.engineeringStandard.findMany({
      where,
      include: {
        coefficients: {
          orderBy: { coefficientName: 'asc' }
        }
      },
      orderBy: { standardCode: 'asc' }
    })

    return NextResponse.json({ success: true, data: standards })
  } catch (error) {
    console.error('Standards API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch standards' },
      { status: 500 }
    )
  }
}
