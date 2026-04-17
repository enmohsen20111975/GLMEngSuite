import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const domain = searchParams.get('domain')

    const where: Record<string, unknown> = {}
    if (domain) where.domain = domain

    const pipelines = await db.calculationPipeline.findMany({
      where,
      include: {
        steps: { orderBy: { order: 'asc' } },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(pipelines)
  } catch (error) {
    console.error('Error fetching pipelines:', error)
    return NextResponse.json({ error: 'Failed to fetch pipelines' }, { status: 500 })
  }
}
