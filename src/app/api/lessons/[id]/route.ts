import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/database'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = await ensureDatabase()

    // Query lesson from engmastery.db
    const lesson = db.queryOneEngmastery<Record<string, unknown>>(
      'SELECT * FROM lessons WHERE id = ?',
      [id]
    )

    if (!lesson) {
      return NextResponse.json(
        { success: false, error: 'Lesson not found' },
        { status: 404 }
      )
    }

    // Get quiz for this lesson
    const quiz = db.queryOneEngmastery<Record<string, unknown>>(
      'SELECT * FROM quizzes WHERE lesson_id = ?',
      [id]
    )

    // Parse quiz questions if available
    let quizData: unknown[] = []
    if (quiz) {
      try {
        quizData = typeof quiz.questions === 'string'
          ? JSON.parse(quiz.questions as string)
          : (quiz.questions as unknown[]) || []
      } catch {
        quizData = []
      }
    }

    // Get chapter info for navigation context
    const chapterId = lesson.chapter_id as string
    const chapter = db.queryOneEngmastery<Record<string, unknown>>(
      'SELECT * FROM chapters WHERE id = ?',
      [chapterId]
    )

    // Get previous/next lessons for navigation
    let prevLesson: Record<string, unknown> | undefined
    let nextLesson: Record<string, unknown> | undefined
    if (chapter) {
      const chapterLessons = db.queryEngmastery<Record<string, unknown>>(
        'SELECT id, title, type, duration, order_index FROM lessons WHERE chapter_id = ? ORDER BY order_index',
        [chapterId]
      )
      const currentIndex = chapterLessons.findIndex(l => (l as Record<string, unknown>).id === id)
      if (currentIndex > 0) prevLesson = chapterLessons[currentIndex - 1]
      if (currentIndex < chapterLessons.length - 1) nextLesson = chapterLessons[currentIndex + 1]
    }

    return NextResponse.json({
      success: true,
      data: {
        ...lesson,
        quiz: quizData,
        chapter: chapter || null,
        prevLesson: prevLesson || null,
        nextLesson: nextLesson || null,
      }
    })
  } catch (error) {
    console.error('Lesson detail API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch lesson' },
      { status: 500 }
    )
  }
}
