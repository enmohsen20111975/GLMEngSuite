import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const db = await ensureDatabase()
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')
    const standardType = searchParams.get('type')

    let sql = `
      SELECT es.*
      FROM engineering_standards es
      WHERE es.is_active = 1
    `
    const params: unknown[] = []

    if (domain) {
      sql += ` AND es.domain = ?`
      params.push(domain)
    }
    if (standardType) {
      sql += ` AND es.standard_type = ?`
      params.push(standardType)
    }

    sql += ` ORDER BY es.domain, es.standard_code`

    const standards = db.queryWorkflows<Record<string, unknown>>(sql, params)

    // Attach coefficients for each standard
    const standardsWithCoefficients = standards.map(std => {
      const coefficients = db.queryWorkflows<Record<string, unknown>>(
        'SELECT * FROM standard_coefficients WHERE standard_id = ?',
        [std.id as number]
      )

      // Parse JSON fields in coefficients
      const parsedCoefficients = coefficients.map(coef => {
        let parsedTable = coef.coefficient_table
        if (typeof parsedTable === 'string') {
          try {
            parsedTable = JSON.parse(parsedTable as string)
          } catch {
            // Keep as string if not valid JSON
          }
        }
        return { ...coef, coefficient_table: parsedTable }
      })

      return { ...std, coefficients: parsedCoefficients }
    })

    return NextResponse.json({ success: true, data: standardsWithCoefficients })
  } catch (error) {
    console.error('Standards API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch standards' },
      { status: 500 }
    )
  }
}
