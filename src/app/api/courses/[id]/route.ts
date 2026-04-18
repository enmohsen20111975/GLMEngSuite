import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/database'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = await ensureDatabase()

    const course = db.queryOneCourse<any>(
      'SELECT * FROM courses WHERE id = ?',
      [id]
    )

    if (!course) {
      return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 })
    }

    const modules = db.queryCourses<any>(
      'SELECT * FROM modules WHERE course_id = ? ORDER BY order_index',
      [id]
    )

    const modulesWithChapters = modules.map(mod => {
      const chapters = db.queryCourses<any>(
        'SELECT * FROM chapters WHERE module_id = ? ORDER BY order_index',
        [mod.id]
      )

      const chaptersWithLessons = chapters.map(ch => {
        const lessons = db.queryCourses<any>(
          'SELECT * FROM lessons WHERE chapter_id = ? ORDER BY order_index',
          [ch.id]
        )
        return { ...ch, lessons }
      })

      return { ...mod, chapters: chaptersWithLessons }
    })

    return NextResponse.json({
      success: true,
      data: { ...course, modules: modulesWithChapters }
    })
  } catch (error) {
    console.error('Course detail API error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch course' }, { status: 500 })
  }
}
