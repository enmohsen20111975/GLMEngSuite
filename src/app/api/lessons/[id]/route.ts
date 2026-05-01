import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Query lesson from Prisma
    const lesson = await db.lesson.findFirst({
      where: { id: id },
      include: {
        module: true,
      },
    })

    if (!lesson) {
      return NextResponse.json(
        { success: false, error: 'Lesson not found' },
        { status: 404 }
      )
    }

    // Get all lessons in the same module for navigation (prev/next)
    const moduleLessons = await db.lesson.findMany({
      where: { moduleId: lesson.moduleId },
      orderBy: { order: 'asc' },
      select: { id: true, title: true, type: true, duration: true, order: true },
    })

    const currentIndex = moduleLessons.findIndex(l => l.id === id)
    const prevLesson = currentIndex > 0 ? moduleLessons[currentIndex - 1] : null
    const nextLesson = currentIndex < moduleLessons.length - 1 ? moduleLessons[currentIndex + 1] : null

    // Get chapter (module) info for navigation context
    const chapter = lesson.module ? {
      id: lesson.module.id,
      title: lesson.module.title,
      description: lesson.module.description,
      order_index: lesson.module.order,
      module_id: lesson.module.courseId,
    } : null

    return NextResponse.json({
      success: true,
      data: {
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        type: lesson.type,
        content: lesson.content,
        duration: lesson.duration,
        order_index: lesson.order,
        is_free: lesson.isFree,
        module_id: lesson.moduleId,
        chapter_id: lesson.moduleId,
        quiz: [], // No quiz data in Prisma
        chapter: chapter,
        prevLesson: prevLesson ? {
          id: prevLesson.id,
          title: prevLesson.title,
          type: prevLesson.type,
          duration: prevLesson.duration,
          order_index: prevLesson.order,
        } : null,
        nextLesson: nextLesson ? {
          id: nextLesson.id,
          title: nextLesson.title,
          type: nextLesson.type,
          duration: nextLesson.duration,
          order_index: nextLesson.order,
        } : null,
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
