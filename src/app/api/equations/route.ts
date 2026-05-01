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
      equation_id: eq.equationId,
      name: eq.name,
      description: eq.description,
      domain: eq.domain,
      category_id: eq.categoryId,
      equation: eq.formula,
      equation_latex: eq.equationLatex,
      equation_pattern: eq.equationPattern,
      difficulty_level: eq.difficulty,
      tags: eq.tags,
      is_active: eq.isActive,
      category_name: eq.categoryRef?.name || eq.category,
      category_icon: eq.categoryRef?.icon || null,
      category_slug: eq.categoryRef?.slug || null,
      category_color: eq.categoryRef?.color || null,
      inputs: eq.inputs.map(inp => ({
        id: inp.id,
        equation_id: eq.id,
        name: inp.name,
        symbol: inp.symbol,
        description: inp.description,
        unit: inp.unit,
        unit_category: inp.unitCategory,
        data_type: inp.dataType,
        required: inp.required,
        default_value: inp.defaultVal,
        min: inp.min,
        max: inp.max,
        validation_regex: inp.validationRegex,
        input_order: inp.order,
        placeholder: inp.placeholder,
        help_text: inp.helpText,
      })),
      outputs: eq.outputs.map(out => ({
        id: out.id,
        equation_id: eq.id,
        name: out.name,
        symbol: out.symbol,
        description: out.description,
        unit: out.unit,
        unit_category: out.unitCategory,
        data_type: out.dataType,
        formula: out.formula,
        output_order: out.order,
        precision: out.precision,
        format_string: out.formatString,
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
