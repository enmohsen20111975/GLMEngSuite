import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Query course from Prisma
    const course = await db.course.findFirst({
      where: {
        OR: [
          { id: id },
          { slug: id },
        ]
      },
      include: {
        modules: {
          orderBy: { order: 'asc' },
          include: {
            lessons: {
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    })

    if (!course) {
      return NextResponse.json(
        { success: false, error: 'Course not found' },
        { status: 404 }
      )
    }

    // Build full hierarchy: modules → lessons
    // Note: Prisma schema has CourseModule → Lesson (no chapters layer)
    // The old engmastery.db had modules → chapters → lessons + quizzes
    // We map CourseModule directly to modules, and create a virtual chapter per module
    const modulesWithLessons = course.modules.map(mod => {
      const lessonsWithQuiz = mod.lessons.map(lesson => ({
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        type: lesson.type,
        content: lesson.content,
        duration: lesson.duration,
        order_index: lesson.order,
        is_free: lesson.isFree,
        module_id: lesson.moduleId,
        quiz: [], // No quiz data in Prisma
      }))

      // Create a virtual chapter wrapping the module's lessons
      // to maintain compatibility with the old chapters-based structure
      const chapter = {
        id: mod.id,
        title: mod.title,
        description: mod.description,
        order_index: mod.order,
        module_id: mod.courseId,
        lessons: lessonsWithQuiz,
      }

      return {
        id: mod.id,
        title: mod.title,
        description: mod.description,
        order_index: mod.order,
        duration: mod.duration,
        course_id: mod.courseId,
        chapters: [chapter],
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        id: course.id,
        title: course.title,
        slug: course.slug,
        description: course.description,
        discipline: course.domain,
        level: course.level,
        duration: course.duration,
        icon: course.icon,
        image: course.image,
        rating: course.rating,
        enrolled: course.enrolled,
        modules: modulesWithLessons,
      }
    })
  } catch (error) {
    console.error('Course detail API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch course' },
      { status: 500 }
    )
  }
}
