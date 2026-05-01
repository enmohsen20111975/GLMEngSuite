import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // No report_templates model in Prisma
    // Return empty array as there is no data source for this
    return NextResponse.json({ success: true, data: [] })
  } catch (error) {
    console.error('Report templates API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch report templates' },
      { status: 500 }
    )
  }
}
