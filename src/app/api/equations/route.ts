import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')
    const categoryId = searchParams.get('category_id')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where clause
    const where: Record<string, unknown> = {}
    if (domain) {
      where.domain = domain
    }
    if (categoryId) {
      where.categoryId = categoryId
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        { tags: { contains: search } },
      ]
    }

    // Fetch equations with inputs, outputs, and category ref
    const [equations, totalCount] = await Promise.all([
      db.equation.findMany({
        where,
        include: {
          inputs: { orderBy: { order: 'asc' } },
          outputs: { orderBy: { order: 'asc' } },
          categoryRef: true,
        },
        orderBy: { name: 'asc' },
        skip: offset,
        take: limit,
      }),
      db.equation.count({ where }),
    ])

    // Map to the format expected by the frontend
    const equationsWithDetails = equations.map(eq => ({
      id: eq.id,
      equation_id: eq.slug,
      name: eq.name,
      description: eq.description,
      domain: eq.domain,
      category_id: eq.categoryId,
      equation: eq.formula,
      equation_latex: null,
      equation_pattern: null,
      difficulty_level: eq.difficulty,
      tags: eq.tags,
      is_active: true,
      category_name: eq.categoryRef?.name || eq.category,
      category_icon: eq.categoryRef?.icon || null,
      category_slug: eq.categoryRef?.slug || null,
      category_color: null,
      inputs: eq.inputs.map(inp => ({
        id: inp.id,
        equation_id: eq.id,
        name: inp.name,
        symbol: inp.symbol,
        unit: inp.unit,
        default_value: inp.defaultVal,
        min: inp.min,
        max: inp.max,
        step: inp.step,
        input_order: inp.order,
      })),
      outputs: eq.outputs.map(out => ({
        id: out.id,
        equation_id: eq.id,
        name: out.name,
        symbol: out.symbol,
        unit: out.unit,
        formula: out.formula,
        output_order: out.order,
      })),
    }))

    return NextResponse.json({
      success: true,
      data: equationsWithDetails,
      total: totalCount,
      page: Math.floor(offset / limit) + 1,
      limit,
    })
  } catch (error) {
    console.error('Equations API error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch equations' }, { status: 500 })
  }
}
