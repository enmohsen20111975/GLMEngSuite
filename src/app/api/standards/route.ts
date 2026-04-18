import { NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/database'

export async function GET() {
  try {
    const db = await ensureDatabase()
    const standards = db.queryWorkflows<any>(
      'SELECT * FROM engineering_standards WHERE is_active = 1 ORDER BY domain, standard_code'
    )

    // Add coefficients for each standard
    const standardsWithCoefficients = standards.map(std => {
      const coefficients = db.queryWorkflows<any>(
        'SELECT * FROM standard_coefficients WHERE standard_id = ?',
        [std.id]
      )
      return { ...std, coefficients }
    })

    return NextResponse.json({ success: true, data: standardsWithCoefficients })
  } catch (error) {
    console.error('Standards API error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch standards' }, { status: 500 })
  }
}
