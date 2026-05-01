import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // No engineering_standards or standard_coefficients models in Prisma
    // Return empty array as there is no data source for this
    return NextResponse.json({ success: true, data: [] })
  } catch (error) {
    console.error('Standards API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch standards' },
      { status: 500 }
    )
  }
}
