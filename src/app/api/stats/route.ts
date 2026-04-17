import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const [
      totalEquations,
      totalPipelines,
      totalCourses,
      totalCategories,
      recentCalculations,
    ] = await Promise.all([
      db.equation.count(),
      db.calculationPipeline.count(),
      db.course.count(),
      db.equationCategory.count(),
      db.calculationHistory.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true } },
        },
      }),
    ])

    // Count equations per domain
    const equationsByDomain = await db.equation.groupBy({
      by: ['domain'],
      _count: { id: true },
    })

    const domainStats = equationsByDomain.map(d => ({
      domain: d.domain,
      count: d._count.id,
    }))

    return NextResponse.json({
      totalEquations,
      totalPipelines,
      totalCourses,
      totalCategories,
      domainStats,
      recentCalculations,
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
