import { PrismaClient } from '@prisma/client'
import initSqlJs from 'sql.js'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

async function loadSqlDb(dbPath: string) {
  const SQL = await initSqlJs({
    locateFile: (file: string) => path.resolve(process.cwd(), `node_modules/sql.js/dist/${file}`)
  })
  const buffer = fs.readFileSync(dbPath)
  return new SQL.Database(buffer)
}

function query(db: any, sql: string, params: unknown[] = []): Record<string, unknown>[] {
  const result = db.exec(sql, params as (string | number | null | Uint8Array)[])
  if (result.length === 0) return []
  const columns = result[0].columns
  const values = result[0].values
  return values.map(row => {
    const obj: Record<string, unknown> = {}
    columns.forEach((col, i) => { obj[col] = row[i] })
    return obj
  })
}

function safeString(val: unknown, fallback: string = ''): string {
  if (val === null || val === undefined) return fallback
  return String(val)
}

function safeInt(val: unknown, fallback: number = 0): number {
  if (val === null || val === undefined) return fallback
  const n = Number(val)
  return isNaN(n) ? fallback : n
}

function safeFloat(val: unknown, fallback: number = 0): number {
  if (val === null || val === undefined) return fallback
  const n = Number(val)
  return isNaN(n) ? fallback : n
}

function safeBool(val: unknown, fallback: boolean = true): boolean {
  if (val === null || val === undefined) return fallback
  return Number(val) === 1 || val === true
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function main() {
  console.log('🔄 Full Data Migration: workflows.db + engmastery.db → Prisma')
  console.log('='.repeat(60))

  // ========================================
  // 1. MIGRATE WORKFLOWS.DB
  // ========================================
  console.log('\n📦 Migrating workflows.db...')

  const workflowsDb = await loadSqlDb('upload/workflows.db')

  // --- 1a. Equation Categories ---
  console.log('  📂 Migrating equation categories...')
  const wfCategories = query(workflowsDb, 'SELECT * FROM equation_categories ORDER BY id')
  const catIdMap: Record<number, string> = {}

  for (const cat of wfCategories) {
    const slug = safeString(cat.slug) || slugify(safeString(cat.name))
    try {
      const created = await prisma.equationCategory.create({
        data: {
          name: safeString(cat.name),
          slug,
          icon: safeString(cat.icon) || null,
          description: safeString(cat.description) || null,
          domain: safeString(cat.domain),
          color: safeString(cat.color) || null,
          parentId: null,
          order: safeInt(cat.display_order),
        }
      })
      catIdMap[safeInt(cat.id)] = created.id
      console.log(`    ✓ ${created.name}`)
    } catch (e: any) {
      if (e.code === 'P2002') {
        // Unique constraint - try with suffix
        const existing = await prisma.equationCategory.findFirst({ where: { slug } })
        if (existing) catIdMap[safeInt(cat.id)] = existing.id
      } else {
        console.log(`    ⚠ Skipped category: ${safeString(cat.name)} - ${e.message}`)
      }
    }
  }
  console.log(`    Total categories: ${Object.keys(catIdMap).length}`)

  // --- 1b. Equations ---
  console.log('  📐 Migrating equations...')
  const wfEquations = query(workflowsDb, 'SELECT * FROM equations WHERE is_active = 1 ORDER BY id')
  const eqIdMap: Record<number, string> = {}
  let eqCount = 0

  for (const eq of wfEquations) {
    const eqId = safeString(eq.equation_id)
    const slug = slugify(safeString(eq.name))
    const dbCatId = safeInt(eq.category_id)
    const prismaCatId = catIdMap[dbCatId] || null

    try {
      const created = await prisma.equation.create({
        data: {
          equationId: eqId || `eq_${Date.now()}_${eqCount}`,
          name: safeString(eq.name),
          formula: safeString(eq.equation),
          description: safeString(eq.description) || null,
          domain: safeString(eq.domain),
          difficulty: safeString(eq.difficulty_level) || 'intermediate',
          equationLatex: safeString(eq.equation_latex) || null,
          equationPattern: safeString(eq.equation_pattern) || null,
          tags: safeString(eq.tags) || null,
          isActive: safeBool(eq.is_active),
          category: safeString(eq.domain), // denormalized
          categoryId: prismaCatId,
        }
      })
      eqIdMap[safeInt(eq.id)] = created.id
      eqCount++
    } catch (e: any) {
      if (e.code === 'P2002') {
        // Try find existing
        const existing = await prisma.equation.findFirst({ where: { equationId: eqId } })
        if (existing) eqIdMap[safeInt(eq.id)] = existing.id
      } else {
        console.log(`    ⚠ Skipped equation: ${safeString(eq.name)} - ${e.message}`)
      }
    }
  }
  console.log(`    Total equations: ${eqCount}`)

  // --- 1c. Equation Inputs ---
  console.log('  📥 Migrating equation inputs...')
  const wfInputs = query(workflowsDb, 'SELECT * FROM equation_inputs ORDER BY equation_id, input_order')
  let inputCount = 0

  for (const inp of wfInputs) {
    const dbEqId = safeInt(inp.equation_id)
    const prismaEqId = eqIdMap[dbEqId]
    if (!prismaEqId) continue

    try {
      await prisma.equationInput.create({
        data: {
          name: safeString(inp.name),
          symbol: safeString(inp.symbol) || null,
          description: safeString(inp.description) || null,
          unit: safeString(inp.unit) || null,
          unitCategory: safeString(inp.unit_category) || null,
          dataType: safeString(inp.data_type) || 'number',
          required: safeBool(inp.required),
          defaultVal: inp.default_value !== null && inp.default_value !== undefined ? String(inp.default_value) : null,
          min: inp.min_value !== null && inp.min_value !== undefined ? String(inp.min_value) : null,
          max: inp.max_value !== null && inp.max_value !== undefined ? String(inp.max_value) : null,
          validationRegex: safeString(inp.validation_regex) || null,
          order: safeInt(inp.input_order),
          placeholder: safeString(inp.placeholder) || null,
          helpText: safeString(inp.help_text) || null,
          equationId: prismaEqId,
        }
      })
      inputCount++
    } catch (e: any) {
      console.log(`    ⚠ Skipped input: ${safeString(inp.name)} - ${e.message}`)
    }
  }
  console.log(`    Total inputs: ${inputCount}`)

  // --- 1d. Equation Outputs ---
  console.log('  📤 Migrating equation outputs...')
  const wfOutputs = query(workflowsDb, 'SELECT * FROM equation_outputs ORDER BY equation_id, output_order')
  let outputCount = 0

  for (const out of wfOutputs) {
    const dbEqId = safeInt(out.equation_id)
    const prismaEqId = eqIdMap[dbEqId]
    if (!prismaEqId) continue

    try {
      await prisma.equationOutput.create({
        data: {
          name: safeString(out.name),
          symbol: safeString(out.symbol) || null,
          description: safeString(out.description) || null,
          unit: safeString(out.unit) || null,
          unitCategory: safeString(out.unit_category) || null,
          dataType: safeString(out.data_type) || 'number',
          formula: safeString(out.formula) || null, // Not in wf db but just in case
          order: safeInt(out.output_order),
          precision: safeInt(out.precision, 4),
          formatString: safeString(out.format_string) || null,
          equationId: prismaEqId,
        }
      })
      outputCount++
    } catch (e: any) {
      console.log(`    ⚠ Skipped output: ${safeString(out.name)} - ${e.message}`)
    }
  }
  console.log(`    Total outputs: ${outputCount}`)

  // --- 1e. Engineering Standards ---
  console.log('  📋 Migrating engineering standards...')
  const wfStandards = query(workflowsDb, 'SELECT * FROM engineering_standards WHERE is_active = 1 ORDER BY id')
  const stdIdMap: Record<number, string> = {}

  for (const std of wfStandards) {
    try {
      const created = await prisma.engineeringStandard.create({
        data: {
          standardCode: safeString(std.standard_code),
          name: safeString(std.name),
          description: safeString(std.description) || null,
          standardType: safeString(std.standard_type),
          domain: safeString(std.domain),
          isActive: safeBool(std.is_active),
        }
      })
      stdIdMap[safeInt(std.id)] = created.id
    } catch (e: any) {
      if (e.code === 'P2002') {
        const existing = await prisma.engineeringStandard.findFirst({ where: { standardCode: safeString(std.standard_code) } })
        if (existing) stdIdMap[safeInt(std.id)] = existing.id
      } else {
        console.log(`    ⚠ Skipped standard: ${safeString(std.name)} - ${e.message}`)
      }
    }
  }
  console.log(`    Total standards: ${Object.keys(stdIdMap).length}`)

  // --- 1f. Standard Coefficients ---
  console.log('  📊 Migrating standard coefficients...')
  const wfCoeffs = query(workflowsDb, 'SELECT * FROM standard_coefficients ORDER BY id')
  let coeffCount = 0

  for (const coeff of wfCoeffs) {
    const dbStdId = safeInt(coeff.standard_id)
    const prismaStdId = stdIdMap[dbStdId]
    if (!prismaStdId) continue

    try {
      await prisma.standardCoefficient.create({
        data: {
          coefficientName: safeString(coeff.coefficient_name),
          coefficientType: safeString(coeff.coefficient_type),
          dataSource: safeString(coeff.data_source),
          coefficientTable: safeString(coeff.coefficient_table) || null,
          formula: safeString(coeff.formula) || null,
          externalReference: safeString(coeff.external_reference) || null,
          standardId: prismaStdId,
        }
      })
      coeffCount++
    } catch (e: any) {
      console.log(`    ⚠ Skipped coefficient: ${safeString(coeff.coefficient_name)} - ${e.message}`)
    }
  }
  console.log(`    Total coefficients: ${coeffCount}`)

  // --- 1g. Calculation Pipelines ---
  console.log('  🔗 Migrating calculation pipelines...')
  const wfPipelines = query(workflowsDb, 'SELECT * FROM calculation_pipelines WHERE is_active = 1 ORDER BY id')
  const pipeIdMap: Record<number, string> = {}

  for (const pipe of wfPipelines) {
    const pipelineId = safeString(pipe.pipeline_id)
    const slug = slugify(safeString(pipe.name))

    try {
      const created = await prisma.calculationPipeline.create({
        data: {
          pipelineId: pipelineId || `pipe_${Date.now()}`,
          name: safeString(pipe.name),
          slug: slug || `pipeline-${Date.now()}`,
          description: safeString(pipe.description) || null,
          domain: safeString(pipe.domain),
          difficulty: safeString(pipe.difficulty_level) || 'intermediate',
          tags: safeString(pipe.tags) || null,
          standardId: stdIdMap[safeInt(pipe.standard_id)] || null,
          version: safeString(pipe.version) || null,
          estimatedTime: pipe.estimated_time ? String(pipe.estimated_time) : null,
          isActive: safeBool(pipe.is_active),
        }
      })
      pipeIdMap[safeInt(pipe.id)] = created.id
    } catch (e: any) {
      if (e.code === 'P2002') {
        const existing = await prisma.calculationPipeline.findFirst({
          where: { OR: [{ pipelineId }, { slug }] }
        })
        if (existing) pipeIdMap[safeInt(pipe.id)] = existing.id
      } else {
        console.log(`    ⚠ Skipped pipeline: ${safeString(pipe.name)} - ${e.message}`)
      }
    }
  }
  console.log(`    Total pipelines: ${Object.keys(pipeIdMap).length}`)

  // --- 1h. Calculation Steps ---
  console.log('  📝 Migrating calculation steps...')
  const wfSteps = query(workflowsDb, 'SELECT * FROM calculation_steps WHERE is_active = 1 ORDER BY pipeline_id, step_number')
  const stepIdMap: Record<number, string> = {}
  let stepCount = 0

  for (const step of wfSteps) {
    const dbPipeId = safeInt(step.pipeline_id)
    const prismaPipeId = pipeIdMap[dbPipeId]
    if (!prismaPipeId) continue

    try {
      const created = await prisma.pipelineStep.create({
        data: {
          stepId: safeString(step.step_id) || null,
          name: safeString(step.name),
          description: safeString(step.description) || null,
          order: safeInt(step.step_number),
          formula: safeString(step.formula) || null,
          formulaRef: safeString(step.formula_ref) || null,
          inputConfig: safeString(step.input_config) || null,
          outputConfig: safeString(step.output_config) || null,
          calculationType: safeString(step.calculation_type) || null,
          stepType: safeString(step.step_type) || null,
          precision: safeInt(step.precision) || null,
          validationConfig: safeString(step.validation_config) || null,
          pipelineId: prismaPipeId,
        }
      })
      stepIdMap[safeInt(step.id)] = created.id
      stepCount++
    } catch (e: any) {
      console.log(`    ⚠ Skipped step: ${safeString(step.name)} - ${e.message}`)
    }
  }
  console.log(`    Total steps: ${stepCount}`)

  // --- 1i. Calculation Dependencies ---
  console.log('  🔀 Migrating calculation dependencies...')
  const wfDeps = query(workflowsDb, 'SELECT * FROM calculation_dependencies ORDER BY id')
  let depCount = 0

  for (const dep of wfDeps) {
    const prismaPipeId = pipeIdMap[safeInt(dep.pipeline_id)]
    const prismaStepId = stepIdMap[safeInt(dep.step_id)]
    const prismaDepId = stepIdMap[safeInt(dep.depends_on_step_id)]
    if (!prismaPipeId || !prismaStepId || !prismaDepId) continue

    try {
      await prisma.pipelineDependency.create({
        data: {
          inputMapping: safeString(dep.input_mapping) || null,
          pipelineId: prismaPipeId,
          stepId: prismaStepId,
          dependsOnId: prismaDepId,
        }
      })
      depCount++
    } catch (e: any) {
      // Skip silently - dependencies are nice-to-have
    }
  }
  console.log(`    Total dependencies: ${depCount}`)

  // --- 1j. Report Templates ---
  console.log('  📄 Migrating report templates...')
  const wfReports = query(workflowsDb, 'SELECT * FROM report_templates ORDER BY id')
  let reportCount = 0

  for (const rpt of wfReports) {
    const slug = safeString(rpt.slug) || slugify(safeString(rpt.name))
    try {
      await prisma.reportTemplate.create({
        data: {
          name: safeString(rpt.name),
          slug,
          description: safeString(rpt.description) || null,
          category: safeString(rpt.category) || null,
          templateType: safeString(rpt.template_type) || 'technical',
          sections: safeString(rpt.sections) || null,
          styling: safeString(rpt.styling) || null,
          isPublic: safeBool(rpt.is_public, true),
        }
      })
      reportCount++
    } catch (e: any) {
      if (e.code === 'P2002') {
        // Skip duplicate
      } else {
        console.log(`    ⚠ Skipped report: ${safeString(rpt.name)} - ${e.message}`)
      }
    }
  }
  console.log(`    Total report templates: ${reportCount}`)

  workflowsDb.close()

  // ========================================
  // 2. MIGRATE ENGMASTERY.DB
  // ========================================
  console.log('\n📚 Migrating engmastery.db...')

  const engmasteryDb = await loadSqlDb('upload/engmastery.db')

  // --- 2a. Courses ---
  console.log('  🎓 Migrating courses...')
  const emCourses = query(engmasteryDb, 'SELECT * FROM courses ORDER BY id')
  const courseIdMap: Record<string, string> = {}

  for (const crs of emCourses) {
    const emId = safeString(crs.id)
    const slug = slugify(safeString(crs.title))
    try {
      const created = await prisma.course.create({
        data: {
          title: safeString(crs.title),
          slug: slug || `course-${Date.now()}`,
          description: safeString(crs.description) || null,
          domain: safeString(crs.discipline),
          discipline: safeString(crs.discipline),
          level: 'beginner',
          order: Object.keys(courseIdMap).length,
        }
      })
      courseIdMap[emId] = created.id
      console.log(`    ✓ ${created.title}`)
    } catch (e: any) {
      if (e.code === 'P2002') {
        const existing = await prisma.course.findFirst({ where: { slug } })
        if (existing) courseIdMap[emId] = existing.id
      } else {
        console.log(`    ⚠ Skipped course: ${safeString(crs.title)} - ${e.message}`)
      }
    }
  }
  console.log(`    Total courses: ${Object.keys(courseIdMap).length}`)

  // --- 2b. Modules ---
  console.log('  📦 Migrating modules...')
  const emModules = query(engmasteryDb, 'SELECT * FROM modules ORDER BY order_index')
  const moduleIdMap: Record<string, string> = {}

  for (const mod of emModules) {
    const emId = safeString(mod.id)
    const prismaCourseId = courseIdMap[safeString(mod.course_id)]
    if (!prismaCourseId) continue

    try {
      const created = await prisma.courseModule.create({
        data: {
          title: safeString(mod.title),
          order: safeInt(mod.order_index),
          courseId: prismaCourseId,
        }
      })
      moduleIdMap[emId] = created.id
    } catch (e: any) {
      console.log(`    ⚠ Skipped module: ${safeString(mod.title)} - ${e.message}`)
    }
  }
  console.log(`    Total modules: ${Object.keys(moduleIdMap).length}`)

  // --- 2c. Chapters ---
  console.log('  📖 Migrating chapters...')
  const emChapters = query(engmasteryDb, 'SELECT * FROM chapters ORDER BY order_index')
  const chapterIdMap: Record<string, string> = {}
  let chapterCount = 0

  for (const ch of emChapters) {
    const emId = safeString(ch.id)
    const prismaModuleId = moduleIdMap[safeString(ch.module_id)]
    if (!prismaModuleId) continue

    try {
      const created = await prisma.chapter.create({
        data: {
          title: safeString(ch.title),
          order: safeInt(ch.order_index),
          moduleId: prismaModuleId,
        }
      })
      chapterIdMap[emId] = created.id
      chapterCount++
    } catch (e: any) {
      console.log(`    ⚠ Skipped chapter: ${safeString(ch.title)} - ${e.message}`)
    }
  }
  console.log(`    Total chapters: ${chapterCount}`)

  // --- 2d. Lessons ---
  console.log('  📝 Migrating lessons (this may take a while)...')
  const emLessons = query(engmasteryDb, 'SELECT * FROM lessons ORDER BY order_index')
  const lessonIdMap: Record<string, string> = {}
  let lessonCount = 0

  // Process in batches to avoid memory issues
  const BATCH_SIZE = 100
  for (let i = 0; i < emLessons.length; i += BATCH_SIZE) {
    const batch = emLessons.slice(i, i + BATCH_SIZE)

    for (const les of batch) {
      const emId = safeString(les.id)
      const prismaChapterId = chapterIdMap[safeString(les.chapter_id)]

      if (!prismaChapterId) {
        // Try to find module from chapter's parent
        continue
      }

      try {
        const created = await prisma.lesson.create({
          data: {
            title: safeString(les.title),
            type: safeString(les.type) || 'article',
            content: safeString(les.content) || null,
            duration: les.duration ? String(les.duration) : null,
            order: safeInt(les.order_index),
            isFree: true,
            chapterId: prismaChapterId,
          }
        })
        lessonIdMap[emId] = created.id
        lessonCount++
      } catch (e: any) {
        // Skip silently for lessons - there are 1211 of them
      }
    }

    if ((i + BATCH_SIZE) % 500 === 0) {
      console.log(`    ... processed ${Math.min(i + BATCH_SIZE, emLessons.length)} / ${emLessons.length}`)
    }
  }
  console.log(`    Total lessons: ${lessonCount}`)

  // --- 2e. Quizzes ---
  console.log('  ❓ Migrating quizzes...')
  const emQuizzes = query(engmasteryDb, 'SELECT * FROM quizzes')
  let quizCount = 0

  for (const qz of emQuizzes) {
    const prismaLessonId = lessonIdMap[safeString(qz.lesson_id)]
    if (!prismaLessonId) continue

    try {
      await prisma.quiz.create({
        data: {
          questions: safeString(qz.questions),
          lessonId: prismaLessonId,
        }
      })
      quizCount++
    } catch (e: any) {
      // Skip silently
    }
  }
  console.log(`    Total quizzes: ${quizCount}`)

  engmasteryDb.close()

  // ========================================
  // 3. SEED ENGINEERING REFERENCE DATA
  // ========================================
  console.log('\n⚡ Seeding engineering reference data...')
  try {
    // Use dynamic import for the engineering seed
    const { seedEngineeringData } = await import('./seed-engineering.js')
    if (typeof seedEngineeringData === 'function') {
      await seedEngineeringData()
    }
  } catch (e: any) {
    console.log('  ⚠ Engineering seed skipped:', e.message)
  }

  // ========================================
  // 4. SEED UNIT CONVERSIONS
  // ========================================
  console.log('\n🔄 Seeding unit conversions...')
  const unitConversions = [
    { category: 'Length', fromUnit: 'm', toUnit: 'ft', factor: '3.28084', fromSymbol: 'm', toSymbol: 'ft' },
    { category: 'Length', fromUnit: 'm', toUnit: 'in', factor: '39.3701', fromSymbol: 'm', toSymbol: 'in' },
    { category: 'Length', fromUnit: 'ft', toUnit: 'm', factor: '0.3048', fromSymbol: 'ft', toSymbol: 'm' },
    { category: 'Length', fromUnit: 'km', toUnit: 'mi', factor: '0.621371', fromSymbol: 'km', toSymbol: 'mi' },
    { category: 'Length', fromUnit: 'mm', toUnit: 'in', factor: '0.0393701', fromSymbol: 'mm', toSymbol: 'in' },
    { category: 'Area', fromUnit: 'm²', toUnit: 'ft²', factor: '10.7639', fromSymbol: 'm²', toSymbol: 'ft²' },
    { category: 'Area', fromUnit: 'ft²', toUnit: 'm²', factor: '0.092903', fromSymbol: 'ft²', toSymbol: 'm²' },
    { category: 'Area', fromUnit: 'mm²', toUnit: 'in²', factor: '0.00155', fromSymbol: 'mm²', toSymbol: 'in²' },
    { category: 'Volume', fromUnit: 'm³', toUnit: 'ft³', factor: '35.3147', fromSymbol: 'm³', toSymbol: 'ft³' },
    { category: 'Volume', fromUnit: 'L', toUnit: 'gal', factor: '0.264172', fromSymbol: 'L', toSymbol: 'gal' },
    { category: 'Volume', fromUnit: 'L', toUnit: 'ft³', factor: '0.0353147', fromSymbol: 'L', toSymbol: 'ft³' },
    { category: 'Mass', fromUnit: 'kg', toUnit: 'lb', factor: '2.20462', fromSymbol: 'kg', toSymbol: 'lb' },
    { category: 'Mass', fromUnit: 'lb', toUnit: 'kg', factor: '0.453592', fromSymbol: 'lb', toSymbol: 'kg' },
    { category: 'Mass', fromUnit: 'g', toUnit: 'oz', factor: '0.035274', fromSymbol: 'g', toSymbol: 'oz' },
    { category: 'Force', fromUnit: 'N', toUnit: 'lbf', factor: '0.224809', fromSymbol: 'N', toSymbol: 'lbf' },
    { category: 'Force', fromUnit: 'kN', toUnit: 'lbf', factor: '224.809', fromSymbol: 'kN', toSymbol: 'lbf' },
    { category: 'Pressure', fromUnit: 'Pa', toUnit: 'psi', factor: '0.000145038', fromSymbol: 'Pa', toSymbol: 'psi' },
    { category: 'Pressure', fromUnit: 'kPa', toUnit: 'psi', factor: '0.145038', fromSymbol: 'kPa', toSymbol: 'psi' },
    { category: 'Pressure', fromUnit: 'bar', toUnit: 'psi', factor: '14.5038', fromSymbol: 'bar', toSymbol: 'psi' },
    { category: 'Pressure', fromUnit: 'MPa', toUnit: 'psi', factor: '145.038', fromSymbol: 'MPa', toSymbol: 'psi' },
    { category: 'Power', fromUnit: 'W', toUnit: 'hp', factor: '0.00134102', fromSymbol: 'W', toSymbol: 'hp' },
    { category: 'Power', fromUnit: 'kW', toUnit: 'hp', factor: '1.34102', fromSymbol: 'kW', toSymbol: 'hp' },
    { category: 'Power', fromUnit: 'kW', toUnit: 'BTU/hr', factor: '3412.14', fromSymbol: 'kW', toSymbol: 'BTU/hr' },
    { category: 'Energy', fromUnit: 'J', toUnit: 'BTU', factor: '0.000947817', fromSymbol: 'J', toSymbol: 'BTU' },
    { category: 'Energy', fromUnit: 'kJ', toUnit: 'BTU', factor: '0.947817', fromSymbol: 'kJ', toSymbol: 'BTU' },
    { category: 'Energy', fromUnit: 'kWh', toUnit: 'MJ', factor: '3.6', fromSymbol: 'kWh', toSymbol: 'MJ' },
    { category: 'Temperature', fromUnit: '°C', toUnit: '°F', factor: '1.8', offset: '32', fromSymbol: '°C', toSymbol: '°F' },
    { category: 'Temperature', fromUnit: '°F', toUnit: '°C', factor: '0.555556', offset: '-17.7778', fromSymbol: '°F', toSymbol: '°C' },
    { category: 'Temperature', fromUnit: '°C', toUnit: 'K', factor: '1', offset: '273.15', fromSymbol: '°C', toSymbol: 'K' },
    { category: 'Velocity', fromUnit: 'm/s', toUnit: 'ft/s', factor: '3.28084', fromSymbol: 'm/s', toSymbol: 'ft/s' },
    { category: 'Velocity', fromUnit: 'm/s', toUnit: 'mph', factor: '2.23694', fromSymbol: 'm/s', toSymbol: 'mph' },
    { category: 'Velocity', fromUnit: 'km/h', toUnit: 'mph', factor: '0.621371', fromSymbol: 'km/h', toSymbol: 'mph' },
    { category: 'Flow Rate', fromUnit: 'm³/s', toUnit: 'gpm', factor: '15850.3', fromSymbol: 'm³/s', toSymbol: 'gpm' },
    { category: 'Flow Rate', fromUnit: 'L/s', toUnit: 'gpm', factor: '15.8503', fromSymbol: 'L/s', toSymbol: 'gpm' },
    { category: 'Flow Rate', fromUnit: 'L/min', toUnit: 'gpm', factor: '0.264172', fromSymbol: 'L/min', toSymbol: 'gpm' },
    { category: 'Torque', fromUnit: 'N·m', toUnit: 'lbf·ft', factor: '0.737562', fromSymbol: 'N·m', toSymbol: 'lbf·ft' },
    { category: 'Electrical', fromUnit: 'A', toUnit: 'mA', factor: '1000', fromSymbol: 'A', toSymbol: 'mA' },
    { category: 'Electrical', fromUnit: 'kVA', toUnit: 'VA', factor: '1000', fromSymbol: 'kVA', toSymbol: 'VA' },
  ]

  for (const uc of unitConversions) {
    try {
      await prisma.unitConversion.create({ data: uc })
    } catch (e) {
      // Skip duplicate
    }
  }
  console.log(`  ✓ Created ${unitConversions.length} unit conversions`)

  // ========================================
  // 5. CREATE DEMO USER
  // ========================================
  console.log('\n👤 Creating demo user...')
  try {
    await prisma.user.create({
      data: {
        email: 'demo@engisuite.com',
        name: 'Demo User',
        role: 'user',
        tier: 'pro',
      }
    })
    console.log('  ✓ Demo user created')
  } catch (e) {
    console.log('  ⚠ Demo user already exists or skipped')
  }

  // ========================================
  // FINAL SUMMARY
  // ========================================
  const finalCounts = {
    equations: await prisma.equation.count(),
    categories: await prisma.equationCategory.count(),
    inputs: await prisma.equationInput.count(),
    outputs: await prisma.equationOutput.count(),
    pipelines: await prisma.calculationPipeline.count(),
    steps: await prisma.pipelineStep.count(),
    dependencies: await prisma.pipelineDependency.count(),
    standards: await prisma.engineeringStandard.count(),
    coefficients: await prisma.standardCoefficient.count(),
    reports: await prisma.reportTemplate.count(),
    courses: await prisma.course.count(),
    modules: await prisma.courseModule.count(),
    chapters: await prisma.chapter.count(),
    lessons: await prisma.lesson.count(),
    quizzes: await prisma.quiz.count(),
    units: await prisma.unitConversion.count(),
    engRefData: await prisma.engineeringReferenceData.count(),
    users: await prisma.user.count(),
  }

  console.log('\n' + '='.repeat(60))
  console.log('🎉 Migration Complete!')
  console.log('='.repeat(60))
  console.log(`  📐 Equations:        ${finalCounts.equations}`)
  console.log(`  📂 Categories:       ${finalCounts.categories}`)
  console.log(`  📥 Inputs:           ${finalCounts.inputs}`)
  console.log(`  📤 Outputs:          ${finalCounts.outputs}`)
  console.log(`  🔗 Pipelines:        ${finalCounts.pipelines}`)
  console.log(`  📝 Pipeline Steps:   ${finalCounts.steps}`)
  console.log(`  🔀 Dependencies:     ${finalCounts.dependencies}`)
  console.log(`  📋 Standards:        ${finalCounts.standards}`)
  console.log(`  📊 Coefficients:     ${finalCounts.coefficients}`)
  console.log(`  📄 Report Templates: ${finalCounts.reports}`)
  console.log(`  🎓 Courses:          ${finalCounts.courses}`)
  console.log(`  📦 Modules:          ${finalCounts.modules}`)
  console.log(`  📖 Chapters:         ${finalCounts.chapters}`)
  console.log(`  📝 Lessons:          ${finalCounts.lessons}`)
  console.log(`  ❓ Quizzes:          ${finalCounts.quizzes}`)
  console.log(`  🔄 Unit Conversions: ${finalCounts.units}`)
  console.log(`  ⚡ Eng Ref Data:     ${finalCounts.engRefData}`)
  console.log(`  👤 Users:            ${finalCounts.users}`)
  console.log('='.repeat(60))
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
