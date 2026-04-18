import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/database'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = await ensureDatabase()

    // Query course from engmastery.db
    const course = db.queryOneEngmastery<Record<string, unknown>>(
      'SELECT * FROM courses WHERE id = ?',
      [id]
    )

    if (!course) {
      return NextResponse.json(
        { success: false, error: 'Course not found' },
        { status: 404 }
      )
    }

    // Get modules for this course
    const modules = db.queryEngmastery<Record<string, unknown>>(
      'SELECT * FROM modules WHERE course_id = ? ORDER BY order_index',
      [id]
    )

    // Build full hierarchy: modules → chapters → lessons
    const modulesWithChapters = modules.map(mod => {
      const chapters = db.queryEngmastery<Record<string, unknown>>(
        'SELECT * FROM chapters WHERE module_id = ? ORDER BY order_index',
        [mod.id as string]
      )

      const chaptersWithLessons = chapters.map(ch => {
        const lessons = db.queryEngmastery<Record<string, unknown>>(
          'SELECT * FROM lessons WHERE chapter_id = ? ORDER BY order_index',
          [ch.id as string]
        )

        // Attach quiz for each lesson
        const lessonsWithQuiz = lessons.map(lesson => {
          const quiz = db.queryOneEngmastery<Record<string, unknown>>(
            'SELECT * FROM quizzes WHERE lesson_id = ?',
            [lesson.id as string]
          )
          return {
            ...lesson,
            quiz: quiz ? (typeof quiz.questions === 'string' ? JSON.parse(quiz.questions) : quiz.questions) : [],
          }
        })

        return { ...ch, lessons: lessonsWithQuiz }
      })

      return { ...mod, chapters: chaptersWithLessons }
    })

    return NextResponse.json({
      success: true,
      data: { ...course, modules: modulesWithChapters }
    })
  } catch (error) {
    console.error('Course detail API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch course' },
      { status: 500 }
    )
  }
}
