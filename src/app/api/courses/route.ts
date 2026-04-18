import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const db = await ensureDatabase()
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')
    const search = searchParams.get('search')

    // Query courses from engmastery.db
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

    sql += ` ORDER BY c.id`
    const courses = await db.queryEngmastery(sql, params)

    // Enrich each course with module/lesson counts and full hierarchy
    const coursesWithStats = await Promise.all(courses.map(async course => {
      const c = course as Record<string, unknown>
      const courseId = c.id as string

      // Get modules
      const modules = await db.queryEngmastery<Record<string, unknown>>(
        'SELECT * FROM modules WHERE course_id = ? ORDER BY order_index',
        [courseId]
      )

      // Count lessons across all modules
      let totalLessons = 0
      const modulesWithLessons = await Promise.all(modules.map(async mod => {
        const chapters = await db.queryEngmastery<Record<string, unknown>>(
          'SELECT * FROM chapters WHERE module_id = ? ORDER BY order_index',
          [mod.id as string]
        )

        let moduleLessonCount = 0
        const chaptersWithLessons = await Promise.all(chapters.map(async ch => {
          const lessons = await db.queryEngmastery<Record<string, unknown>>(
            'SELECT * FROM lessons WHERE chapter_id = ? ORDER BY order_index',
            [ch.id as string]
          )
          moduleLessonCount += lessons.length
          return { ...ch, lessons }
        }))

        totalLessons += moduleLessonCount
        return {
          ...mod,
          chapters: chaptersWithLessons,
          lesson_count: moduleLessonCount,
        }
      }))

      return {
        ...c,
        module_count: modules.length,
        lesson_count: totalLessons,
        modules: modulesWithLessons,
      }
    }))

    return NextResponse.json({ success: true, data: coursesWithStats })
  } catch (error) {
    console.error('Courses API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch courses' },
      { status: 500 }
    )
  }
}
