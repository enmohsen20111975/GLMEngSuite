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

    // Fetch courses with full hierarchy (modules → chapters → lessons)
    const courses = await db.course.findMany({
      where,
      include: {
        modules: {
          orderBy: { order: 'asc' },
          include: {
            chapters: {
              orderBy: { order: 'asc' },
              include: {
                lessons: {
                  orderBy: { order: 'asc' },
                },
              },
            },
            lessons: {
              orderBy: { order: 'asc' },
            },
          },
        },
      },
      orderBy: { order: 'asc' },
    })

    // Map to the format expected by the frontend
    const coursesWithStats = courses.map(course => {
      let totalLessons = 0
      let totalChapters = 0
      const modulesWithDetails = course.modules.map(mod => {
        const chapterLessons = mod.chapters.reduce((sum, ch) => sum + ch.lessons.length, 0)
        const directLessons = mod.lessons.length
        totalLessons += chapterLessons + directLessons
        totalChapters += mod.chapters.length

        return {
          id: mod.id,
          title: mod.title,
          description: mod.description,
          order_index: mod.order,
          duration: mod.duration,
          course_id: mod.courseId,
          lesson_count: chapterLessons + directLessons,
          chapter_count: mod.chapters.length,
          chapters: mod.chapters.map(ch => ({
            id: ch.id,
            title: ch.title,
            order_index: ch.order,
            lesson_count: ch.lessons.length,
            lessons: ch.lessons.map(lesson => ({
              id: lesson.id,
              title: lesson.title,
              description: lesson.description,
              type: lesson.type,
              content: lesson.content,
              duration: lesson.duration,
              order_index: lesson.order,
              is_free: lesson.isFree,
              chapter_id: lesson.chapterId,
            })),
          })),
          // Direct lessons (legacy, for modules without chapters)
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
        discipline: course.discipline || course.domain,
        domain: course.domain,
        level: course.level,
        duration: course.duration,
        icon: course.icon,
        image: course.image,
        rating: course.rating,
        enrolled: course.enrolled,
        order_index: course.order,
        module_count: course.modules.length,
        chapter_count: totalChapters,
        lesson_count: totalLessons,
        modules: modulesWithDetails,
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
