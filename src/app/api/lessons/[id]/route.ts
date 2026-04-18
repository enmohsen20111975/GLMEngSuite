import { NextRequest, NextResponse } from 'next/server'
import { ensureDatabase } from '@/lib/database'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = await ensureDatabase()

    const lesson = db.queryOneCourse<any>(
      'SELECT * FROM lessons WHERE id = ?',
      [id]
    )

    if (!lesson) {
      return NextResponse.json({ success: false, error: 'Lesson not found' }, { status: 404 })
    }

    // Get quiz
    const quiz = db.queryOneCourse<any>(
      'SELECT * FROM quizzes WHERE lesson_id = ?',
      [id]
    )

    return NextResponse.json({
      success: true,
      data: {
        ...lesson,
        quiz: quiz ? JSON.parse(quiz.questions || '[]') : [],
      }
    })
  } catch (error) {
    console.error('Lesson detail API error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch lesson' }, { status: 500 })
  }
}
