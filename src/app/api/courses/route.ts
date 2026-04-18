import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const db = await ensureDatabase()
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')
    const search = searchParams.get('search')

    let sql = `SELECT c.* FROM courses c WHERE 1=1`
    const params: unknown[] = []

    if (domain) {
      sql += ` AND c.discipline = ?`
      params.push(domain)
    }
    if (search) {
      sql += ` AND (c.title LIKE ? OR c.description LIKE ?)`
      params.push(`%${search}%`, `%${search}%`)
    }

    sql += ` ORDER BY c.order_index`

    const courses = db.queryCourses(sql, params)

    // Add module count
    const coursesWithStats = courses.map(course => {
      const modules = db.queryCourses<{ cnt: number }>(
        'SELECT COUNT(*) as cnt FROM modules WHERE course_id = ?',
        [(course as any).id]
      )
      const lessons = db.queryCourses<{ cnt: number }>(
        'SELECT COUNT(*) as cnt FROM lessons l JOIN chapters ch ON l.chapter_id = ch.id JOIN modules m ON ch.module_id = m.id WHERE m.course_id = ?',
        [(course as any).id]
      )
      return { ...course, module_count: modules[0]?.cnt || 0, lesson_count: lessons[0]?.cnt || 0 }
    })

    return NextResponse.json({ success: true, data: coursesWithStats })
  } catch (error) {
    console.error('Courses API error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch courses' }, { status: 500 })
  }
}
