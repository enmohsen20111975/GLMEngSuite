import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')
    const search = searchParams.get('search')

    // Build where clause
    const where: Record<string, unknown> = {}
    if (domain) {
      where.domain = domain
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ]
    }

    // Fetch courses with full hierarchy
    const courses = await db.course.findMany({
      where,
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
      orderBy: { order: 'asc' },
    })

    // Map to the format expected by the frontend (which expects the old engmastery.db format)
    const coursesWithStats = courses.map(course => {
      let totalLessons = 0
      const modulesWithLessons = course.modules.map(mod => {
        totalLessons += mod.lessons.length
        return {
          id: mod.id,
          title: mod.title,
          description: mod.description,
          order_index: mod.order,
          duration: mod.duration,
          course_id: mod.courseId,
          lesson_count: mod.lessons.length,
          lessons: mod.lessons.map(lesson => ({
            id: lesson.id,
            title: lesson.title,
            description: lesson.description,
            type: lesson.type,
            content: lesson.content,
            duration: lesson.duration,
            order_index: lesson.order,
            is_free: lesson.isFree,
            module_id: lesson.moduleId,
          })),
        }
      })

      return {
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
        order_index: course.order,
        module_count: course.modules.length,
        lesson_count: totalLessons,
        modules: modulesWithLessons,
      }
    })

    return NextResponse.json({ success: true, data: coursesWithStats })
  } catch (error) {
    console.error('Courses API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch courses' },
      { status: 500 }
    )
  }
}
