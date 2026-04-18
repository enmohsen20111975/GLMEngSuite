import initSqlJs, { Database } from 'sql.js';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// Helper to read a SQLite file and return all rows
function queryDb(db: Database, sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

async function main() {
  console.log('🚀 Starting data import from original databases...\n');

  // Initialize sql.js
  const SQL = await initSqlJs();

  // Load databases
  const dbPath = (name: string) =>
    path.join(__dirname, '..', 'upload', 'Databases_extracted', 'Databases', name);

  console.log('📂 Loading databases...');
  const workflowsDb = new SQL.Database(fs.readFileSync(dbPath('workflows.db')));
  const engmasteryDb = new SQL.Database(fs.readFileSync(dbPath('engmastery.db')));
  console.log('✅ Databases loaded\n');

  // Clean existing data
  console.log('🧹 Cleaning existing data...');
  await prisma.lessonQuiz.deleteMany();
  await prisma.courseLesson.deleteMany();
  await prisma.courseChapter.deleteMany();
  await prisma.courseModule.deleteMany();
  await prisma.course.deleteMany();
  await prisma.pipelineDependency.deleteMany();
  await prisma.pipelineStep.deleteMany();
  await prisma.calculationPipeline.deleteMany();
  await prisma.standardCoefficient.deleteMany();
  await prisma.engineeringStandard.deleteMany();
  await prisma.reportTemplate.deleteMany();
  await prisma.equationOutput.deleteMany();
  await prisma.equationInput.deleteMany();
  await prisma.equation.deleteMany();
  await prisma.equationCategory.deleteMany();
  await prisma.unitConversion.deleteMany();
  console.log('✅ Data cleaned\n');

  // ============ IMPORT EQUATION CATEGORIES ============
  console.log('📊 Importing equation categories...');
  const categories = queryDb(workflowsDb, 'SELECT * FROM equation_categories ORDER BY display_order');
  const categoryMap: Record<number, string> = {};

  for (const cat of categories) {
    const created = await prisma.equationCategory.create({
      data: {
        name: cat.name as string,
        slug: (cat.slug as string) || (cat.name as string).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        icon: cat.icon as string || null,
        description: cat.description as string || null,
        domain: cat.domain as string || 'general',
        color: cat.color as string || null,
        parentId: cat.parent_id ? String(cat.parent_id) : null,
        order: (cat.display_order as number) || 0,
      },
    });
    categoryMap[cat.id as number] = created.id;
    console.log(`  ✓ ${cat.name} (${cat.domain})`);
  }
  console.log(`  Total: ${categories.length} categories\n`);

  // ============ IMPORT EQUATIONS ============
  console.log('📐 Importing equations...');
  const equations = queryDb(workflowsDb, 'SELECT * FROM equations ORDER BY id');
  const equationMap: Record<number, string> = {};
  let eqCount = 0;

  for (const eq of equations) {
    const categoryId = eq.category_id as number | null;
    const categoryRefId = categoryId ? categoryMap[categoryId] : null;

    const slug = (eq.equation_id as string)
      .replace(/^eq_/, '')
      .replace(/_/g, '-')
      .toLowerCase();

    const created = await prisma.equation.create({
      data: {
        equationId: eq.equation_id as string,
        name: eq.name as string,
        slug,
        formula: eq.equation as string || '',
        equationLatex: eq.equation_latex as string || null,
        equationPattern: eq.equation_pattern as string || null,
        description: eq.description as string || null,
        category: (eq.domain as string) || 'general',
        domain: (eq.domain as string) || 'general',
        difficulty: (eq.difficulty_level as string) || 'intermediate',
        tags: eq.tags as string || null,
        isActive: (eq.is_active as number) !== 0,
        categoryId: categoryRefId,
      },
    });
    equationMap[eq.id as number] = created.id;
    eqCount++;
  }
  console.log(`  Total: ${eqCount} equations\n`);

  // ============ IMPORT EQUATION INPUTS ============
  console.log('📥 Importing equation inputs...');
  const eqInputs = queryDb(workflowsDb, 'SELECT * FROM equation_inputs ORDER BY equation_id, input_order');
  let inpCount = 0;

  for (const inp of eqInputs) {
    const eqDbId = inp.equation_id as number;
    const prismaEqId = equationMap[eqDbId];
    if (!prismaEqId) {
      console.log(`  ⚠ Skipping input for unknown equation DB id ${eqDbId}`);
      continue;
    }
    await prisma.equationInput.create({
      data: {
        name: inp.name as string || '',
        symbol: inp.symbol as string || '',
        description: inp.description as string || null,
        dataType: inp.data_type as string || 'number',
        unit: inp.unit as string || null,
        unitCategory: inp.unit_category as string || null,
        required: (inp.required as number) !== 0,
        defaultVal: inp.default_value != null ? String(inp.default_value) : null,
        min: inp.min_value != null ? String(inp.min_value) : null,
        max: inp.max_value != null ? String(inp.max_value) : null,
        validationRegex: inp.validation_regex as string || null,
        order: (inp.input_order as number) || 0,
        placeholder: inp.placeholder as string || null,
        helpText: inp.help_text as string || null,
        equationId: prismaEqId,
      },
    });
    inpCount++;
  }
  console.log(`  Total: ${inpCount} equation inputs\n`);

  // ============ IMPORT EQUATION OUTPUTS ============
  console.log('📤 Importing equation outputs...');
  const eqOutputs = queryDb(workflowsDb, 'SELECT * FROM equation_outputs ORDER BY equation_id, output_order');
  let outCount = 0;

  for (const out of eqOutputs) {
    const eqDbId = out.equation_id as number;
    const prismaEqId = equationMap[eqDbId];
    if (!prismaEqId) {
      console.log(`  ⚠ Skipping output for unknown equation DB id ${eqDbId}`);
      continue;
    }
    await prisma.equationOutput.create({
      data: {
        name: out.name as string || '',
        symbol: out.symbol as string || '',
        description: out.description as string || null,
        dataType: out.data_type as string || 'number',
        unit: out.unit as string || null,
        unitCategory: out.unit_category as string || null,
        formula: out.format_string as string || null,
        order: (out.output_order as number) || 0,
        precision: (out.precision as number) ?? 2,
        formatString: out.format_string as string || null,
        equationId: prismaEqId,
      },
    });
    outCount++;
  }
  console.log(`  Total: ${outCount} equation outputs\n`);

  // ============ IMPORT ENGINEERING STANDARDS ============
  console.log('📋 Importing engineering standards...');
  const standards = queryDb(workflowsDb, 'SELECT * FROM engineering_standards ORDER BY id');
  const standardMap: Record<number, string> = {};

  for (const std of standards) {
    const created = await prisma.engineeringStandard.create({
      data: {
        standardCode: std.standard_code as string,
        name: std.name as string,
        description: std.description as string || null,
        standardType: std.standard_type as string || null,
        domain: std.domain as string || 'general',
        isActive: (std.is_active as number) !== 0,
      },
    });
    standardMap[std.id as number] = created.id;
    console.log(`  ✓ ${std.standard_code}: ${std.name}`);
  }
  console.log(`  Total: ${standards.length} standards\n`);

  // ============ IMPORT STANDARD COEFFICIENTS ============
  console.log('🔬 Importing standard coefficients...');
  const coefficients = queryDb(workflowsDb, 'SELECT * FROM standard_coefficients ORDER BY id');
  let coeffCount = 0;

  for (const coeff of coefficients) {
    const stdDbId = coeff.standard_id as number;
    const prismaStdId = standardMap[stdDbId];
    if (!prismaStdId) {
      console.log(`  ⚠ Skipping coefficient for unknown standard DB id ${stdDbId}`);
      continue;
    }
    await prisma.standardCoefficient.create({
      data: {
        coefficientName: coeff.coefficient_name as string || '',
        coefficientType: coeff.coefficient_type as string || null,
        dataSource: coeff.data_source as string || null,
        coefficientTable: coeff.coefficient_table as string || null,
        formula: coeff.formula as string || null,
        externalReference: coeff.external_reference as string || null,
        standardId: prismaStdId,
      },
    });
    coeffCount++;
  }
  console.log(`  Total: ${coeffCount} coefficients\n`);

  // ============ IMPORT CALCULATION PIPELINES ============
  console.log('🔗 Importing calculation pipelines...');
  const pipelines = queryDb(workflowsDb, 'SELECT * FROM calculation_pipelines ORDER BY id');
  const pipelineMap: Record<string, string> = {};

  for (const pipe of pipelines) {
    const stdDbId = pipe.standard_id as number | null;
    const prismaStdId = stdDbId ? standardMap[stdDbId] : null;

    const slug = (pipe.pipeline_id as string)
      .replace(/_/g, '-')
      .toLowerCase();

    const created = await prisma.calculationPipeline.create({
      data: {
        pipelineId: pipe.pipeline_id as string,
        name: pipe.name as string,
        slug,
        description: pipe.description as string || null,
        domain: pipe.domain as string || 'general',
        category: pipe.tags as string || null,
        standardId: prismaStdId,
        version: pipe.version as string || null,
        estimatedTime: pipe.estimated_time != null ? String(pipe.estimated_time) : null,
        difficulty: pipe.difficulty_level as string || 'intermediate',
        tags: pipe.tags as string || null,
        isActive: (pipe.is_active as number) !== 0,
      },
    });
    pipelineMap[pipe.pipeline_id as string] = created.id;
    pipelineMap[String(pipe.id)] = created.id; // Also map numeric ID for steps/deps
  }
  console.log(`  Total: ${pipelines.length} pipelines\n`);

  // ============ IMPORT CALCULATION STEPS ============
  console.log('📝 Importing calculation steps...');
  const steps = queryDb(workflowsDb, 'SELECT * FROM calculation_steps ORDER BY pipeline_id, step_number');
  const stepMap: Record<string, string> = {};
  let stepCount = 0;

  for (const step of steps) {
    const pipelineDbId = String(step.pipeline_id); // Numeric ID in steps table
    const prismaPipelineId = pipelineMap[pipelineDbId];
    if (!prismaPipelineId) {
      console.log(`  ⚠ Skipping step for unknown pipeline ${pipelineDbId}`);
      continue;
    }

    const stepKey = `${pipelineDbId}_${step.step_id}`;
    const created = await prisma.pipelineStep.create({
      data: {
        stepId: step.step_id as string || `step_${step.step_number}`,
        name: step.name as string,
        description: step.description as string || null,
        order: (step.step_number as number) || 0,
        formula: step.formula as string || null,
        formulaRef: step.formula_ref as string || null,
        inputConfig: step.input_config as string || null,
        outputConfig: step.output_config as string || null,
        calculationType: step.calculation_type as string || null,
        stepType: step.step_type as string || null,
        precision: step.precision as number || null,
        validationConfig: step.validation_config as string || null,
        isActive: (step.is_active as number) !== 0,
        pipelineId: prismaPipelineId,
      },
    });
    stepMap[stepKey] = created.id;
    stepCount++;
  }
  console.log(`  Total: ${stepCount} steps\n`);

  // ============ IMPORT CALCULATION DEPENDENCIES ============
  console.log('🔗 Importing calculation dependencies...');
  const deps = queryDb(workflowsDb, 'SELECT * FROM calculation_dependencies ORDER BY pipeline_id');
  let depCount = 0;

  for (const dep of deps) {
    const pipelineDbId = String(dep.pipeline_id); // Numeric ID in deps table
    const prismaPipelineId = pipelineMap[pipelineDbId];
    if (!prismaPipelineId) {
      console.log(`  ⚠ Skipping dep for unknown pipeline ${pipelineDbId}`);
      continue;
    }
    await prisma.pipelineDependency.create({
      data: {
        stepId: String(dep.step_id),
        dependsOnStepId: String(dep.depends_on_step_id),
        inputMapping: dep.input_mapping as string || null,
        pipelineId: prismaPipelineId,
      },
    });
    depCount++;
  }
  console.log(`  Total: ${depCount} dependencies\n`);

  // ============ IMPORT REPORT TEMPLATES ============
  console.log('📄 Importing report templates...');
  const templates = queryDb(workflowsDb, 'SELECT * FROM report_templates ORDER BY id');

  for (const tmpl of templates) {
    await prisma.reportTemplate.create({
      data: {
        name: tmpl.name as string,
        slug: (tmpl.slug as string) || (tmpl.name as string).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description: tmpl.description as string || null,
        category: tmpl.category as string || null,
        templateType: tmpl.template_type as string || null,
        sections: tmpl.sections as string || null,
        styling: tmpl.styling as string || null,
        isPublic: true,
      },
    });
    console.log(`  ✓ ${tmpl.name}`);
  }
  console.log(`  Total: ${templates.length} report templates\n`);

  // ============ IMPORT COURSES FROM ENGMASTERY ============
  console.log('🎓 Importing courses from engmastery.db...');
  const courses = queryDb(engmasteryDb, 'SELECT * FROM courses ORDER BY id');
  const courseMap: Record<string, string> = {};

  for (const course of courses) {
    const slug = (course.discipline as string || 'course').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const created = await prisma.course.create({
      data: {
        title: course.title as string,
        slug: `${slug}-engineering`,
        description: course.description as string || null,
        domain: course.discipline as string || 'general',
        level: 'beginner',
        icon: course.discipline as string || null,
        order: Object.keys(courseMap).length,
      },
    });
    courseMap[course.id as string] = created.id;
    console.log(`  ✓ ${course.title}`);
  }
  console.log(`  Total: ${courses.length} courses\n`);

  // ============ IMPORT MODULES ============
  console.log('📦 Importing modules...');
  const modules = queryDb(engmasteryDb, 'SELECT * FROM modules ORDER BY course_id, order_index');
  const moduleMap: Record<string, string> = {};
  let modCount = 0;

  for (const mod of modules) {
    const courseId = courseMap[mod.course_id as string];
    if (!courseId) {
      console.log(`  ⚠ Skipping module for unknown course ${mod.course_id}`);
      continue;
    }
    const created = await prisma.courseModule.create({
      data: {
        title: mod.title as string,
        order: (mod.order_index as number) || modCount,
        courseId,
      },
    });
    moduleMap[mod.id as string] = created.id;
    modCount++;
  }
  console.log(`  Total: ${modCount} modules\n`);

  // ============ IMPORT CHAPTERS ============
  console.log('📖 Importing chapters...');
  const chapters = queryDb(engmasteryDb, 'SELECT * FROM chapters ORDER BY module_id, order_index');
  const chapterMap: Record<string, string> = {};
  let chapCount = 0;

  for (const chap of chapters) {
    const moduleId = moduleMap[chap.module_id as string];
    if (!moduleId) {
      console.log(`  ⚠ Skipping chapter for unknown module ${chap.module_id}`);
      continue;
    }
    const created = await prisma.courseChapter.create({
      data: {
        title: chap.title as string,
        order: (chap.order_index as number) || chapCount,
        moduleId,
      },
    });
    chapterMap[chap.id as string] = created.id;
    chapCount++;
  }
  console.log(`  Total: ${chapCount} chapters\n`);

  // ============ IMPORT LESSONS ============
  console.log('📚 Importing lessons...');
  const lessons = queryDb(engmasteryDb, 'SELECT * FROM lessons ORDER BY chapter_id, order_index');
  let lesCount = 0;
  let quizCount = 0;

  for (const les of lessons) {
    const chapterId = chapterMap[les.chapter_id as string];
    if (!chapterId) {
      console.log(`  ⚠ Skipping lesson for unknown chapter ${les.chapter_id}`);
      continue;
    }
    const created = await prisma.courseLesson.create({
      data: {
        title: les.title as string,
        type: (les.type as string) || 'interactive',
        content: les.content as string || null,
        duration: les.duration != null ? String(les.duration) : null,
        order: (les.order_index as number) || lesCount,
        isFree: lesCount < 10,
        chapterId,
      },
    });

    // Import quiz if exists
    const quizData = queryDb(engmasteryDb, 'SELECT * FROM quizzes WHERE lesson_id = ?', [les.id]);
    if (quizData.length > 0 && quizData[0].questions) {
      await prisma.lessonQuiz.create({
        data: {
          questions: quizData[0].questions as string,
          lessonId: created.id,
        },
      });
      quizCount++;
    }
    lesCount++;
  }
  console.log(`  Total: ${lesCount} lessons, ${quizCount} quizzes\n`);

  // ============ CREATE DEMO USER ============
  console.log('👤 Creating demo user...');
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@engisuite.com' },
    update: {},
    create: {
      email: 'demo@engisuite.com',
      name: 'Demo User',
      role: 'admin',
      tier: 'premium',
    },
  });
  console.log(`  ✓ Demo user: ${demoUser.email}\n`);

  // ============ SEED UNIT CONVERSIONS ============
  console.log('🔄 Seeding unit conversions...');
  const unitConversions = [
    // Length
    { category: 'length', fromUnit: 'meter', toUnit: 'foot', factor: '3.28084', fromSymbol: 'm', toSymbol: 'ft' },
    { category: 'length', fromUnit: 'meter', toUnit: 'inch', factor: '39.3701', fromSymbol: 'm', toSymbol: 'in' },
    { category: 'length', fromUnit: 'meter', toUnit: 'millimeter', factor: '1000', fromSymbol: 'm', toSymbol: 'mm' },
    { category: 'length', fromUnit: 'meter', toUnit: 'centimeter', factor: '100', fromSymbol: 'm', toSymbol: 'cm' },
    { category: 'length', fromUnit: 'meter', toUnit: 'kilometer', factor: '0.001', fromSymbol: 'm', toSymbol: 'km' },
    { category: 'length', fromUnit: 'meter', toUnit: 'mile', factor: '0.000621371', fromSymbol: 'm', toSymbol: 'mi' },
    { category: 'length', fromUnit: 'meter', toUnit: 'yard', factor: '1.09361', fromSymbol: 'm', toSymbol: 'yd' },
    // Pressure
    { category: 'pressure', fromUnit: 'pascal', toUnit: 'bar', factor: '0.00001', fromSymbol: 'Pa', toSymbol: 'bar' },
    { category: 'pressure', fromUnit: 'pascal', toUnit: 'psi', factor: '0.000145038', fromSymbol: 'Pa', toSymbol: 'psi' },
    { category: 'pressure', fromUnit: 'pascal', toUnit: 'atm', factor: '9.86923e-6', fromSymbol: 'Pa', toSymbol: 'atm' },
    { category: 'pressure', fromUnit: 'pascal', toUnit: 'kPa', factor: '0.001', fromSymbol: 'Pa', toSymbol: 'kPa' },
    { category: 'pressure', fromUnit: 'pascal', toUnit: 'MPa', factor: '0.000001', fromSymbol: 'Pa', toSymbol: 'MPa' },
    { category: 'pressure', fromUnit: 'bar', toUnit: 'psi', factor: '14.5038', fromSymbol: 'bar', toSymbol: 'psi' },
    // Temperature
    { category: 'temperature', fromUnit: 'celsius', toUnit: 'fahrenheit', factor: '1.8', offset: '32', fromSymbol: '°C', toSymbol: '°F' },
    { category: 'temperature', fromUnit: 'celsius', toUnit: 'kelvin', factor: '1', offset: '273.15', fromSymbol: '°C', toSymbol: 'K' },
    { category: 'temperature', fromUnit: 'fahrenheit', toUnit: 'celsius', factor: '0.555556', offset: '-17.7778', fromSymbol: '°F', toSymbol: '°C' },
    { category: 'temperature', fromUnit: 'kelvin', toUnit: 'celsius', factor: '1', offset: '-273.15', fromSymbol: 'K', toSymbol: '°C' },
    // Power
    { category: 'power', fromUnit: 'watt', toUnit: 'kilowatt', factor: '0.001', fromSymbol: 'W', toSymbol: 'kW' },
    { category: 'power', fromUnit: 'watt', toUnit: 'horsepower', factor: '0.00134102', fromSymbol: 'W', toSymbol: 'hp' },
    { category: 'power', fromUnit: 'watt', toUnit: 'BTU/hour', factor: '3.41214', fromSymbol: 'W', toSymbol: 'BTU/h' },
    { category: 'power', fromUnit: 'kilowatt', toUnit: 'megawatt', factor: '0.001', fromSymbol: 'kW', toSymbol: 'MW' },
    { category: 'power', fromUnit: 'horsepower', toUnit: 'kilowatt', factor: '0.7457', fromSymbol: 'hp', toSymbol: 'kW' },
    // Energy
    { category: 'energy', fromUnit: 'joule', toUnit: 'kilojoule', factor: '0.001', fromSymbol: 'J', toSymbol: 'kJ' },
    { category: 'energy', fromUnit: 'joule', toUnit: 'BTU', factor: '0.000947817', fromSymbol: 'J', toSymbol: 'BTU' },
    { category: 'energy', fromUnit: 'joule', toUnit: 'kilowatt-hour', factor: '2.77778e-7', fromSymbol: 'J', toSymbol: 'kWh' },
    { category: 'energy', fromUnit: 'joule', toUnit: 'calorie', factor: '0.239006', fromSymbol: 'J', toSymbol: 'cal' },
    { category: 'energy', fromUnit: 'kWh', toUnit: 'MJ', factor: '3.6', fromSymbol: 'kWh', toSymbol: 'MJ' },
    // Force
    { category: 'force', fromUnit: 'newton', toUnit: 'kilonewton', factor: '0.001', fromSymbol: 'N', toSymbol: 'kN' },
    { category: 'force', fromUnit: 'newton', toUnit: 'pound-force', factor: '0.224809', fromSymbol: 'N', toSymbol: 'lbf' },
    { category: 'force', fromUnit: 'newton', toUnit: 'kilogram-force', factor: '0.101972', fromSymbol: 'N', toSymbol: 'kgf' },
    { category: 'force', fromUnit: 'kilonewton', toUnit: 'ton-force', factor: '0.000101972', fromSymbol: 'kN', toSymbol: 'tf' },
    // Flow Rate
    { category: 'flow', fromUnit: 'm³/s', toUnit: 'L/s', factor: '1000', fromSymbol: 'm³/s', toSymbol: 'L/s' },
    { category: 'flow', fromUnit: 'm³/s', toUnit: 'gpm', factor: '15850.3', fromSymbol: 'm³/s', toSymbol: 'gpm' },
    { category: 'flow', fromUnit: 'm³/s', toUnit: 'm³/h', factor: '3600', fromSymbol: 'm³/s', toSymbol: 'm³/h' },
    { category: 'flow', fromUnit: 'L/s', toUnit: 'gpm', factor: '15.8503', fromSymbol: 'L/s', toSymbol: 'gpm' },
    // Area
    { category: 'area', fromUnit: 'm²', toUnit: 'ft²', factor: '10.7639', fromSymbol: 'm²', toSymbol: 'ft²' },
    { category: 'area', fromUnit: 'm²', toUnit: 'acre', factor: '0.000247105', fromSymbol: 'm²', toSymbol: 'ac' },
    { category: 'area', fromUnit: 'm²', toUnit: 'hectare', factor: '0.0001', fromSymbol: 'm²', toSymbol: 'ha' },
    { category: 'area', fromUnit: 'm²', toUnit: 'cm²', factor: '10000', fromSymbol: 'm²', toSymbol: 'cm²' },
    { category: 'area', fromUnit: 'm²', toUnit: 'in²', factor: '1550.0031', fromSymbol: 'm²', toSymbol: 'in²' },
    // Volume
    { category: 'volume', fromUnit: 'm³', toUnit: 'liter', factor: '1000', fromSymbol: 'm³', toSymbol: 'L' },
    { category: 'volume', fromUnit: 'm³', toUnit: 'gallon', factor: '264.172', fromSymbol: 'm³', toSymbol: 'gal' },
    { category: 'volume', fromUnit: 'm³', toUnit: 'ft³', factor: '35.3147', fromSymbol: 'm³', toSymbol: 'ft³' },
    { category: 'volume', fromUnit: 'liter', toUnit: 'gallon', factor: '0.264172', fromSymbol: 'L', toSymbol: 'gal' },
    { category: 'volume', fromUnit: 'liter', toUnit: 'cm³', factor: '1000', fromSymbol: 'L', toSymbol: 'cm³' },
  ];

  for (const uc of unitConversions) {
    await prisma.unitConversion.create({
      data: {
        category: uc.category,
        fromUnit: uc.fromUnit,
        toUnit: uc.toUnit,
        factor: uc.factor,
        offset: uc.offset || '0',
        fromSymbol: uc.fromSymbol || null,
        toSymbol: uc.toSymbol || null,
      },
    });
  }
  console.log(`  Total: ${unitConversions.length} unit conversions\n`);

  // Clean up
  workflowsDb.close();
  engmasteryDb.close();

  // Print summary
  const totalEqs = await prisma.equation.count();
  const totalCats = await prisma.equationCategory.count();
  const totalPipes = await prisma.calculationPipeline.count();
  const totalSteps = await prisma.pipelineStep.count();
  const totalStds = await prisma.engineeringStandard.count();
  const totalCoeffs = await prisma.standardCoefficient.count();
  const totalCourses = await prisma.course.count();
  const totalModules = await prisma.courseModule.count();
  const totalChapters = await prisma.courseChapter.count();
  const totalLessons = await prisma.courseLesson.count();
  const totalQuizzes = await prisma.lessonQuiz.count();
  const totalTemplates = await prisma.reportTemplate.count();
  const totalUnits = await prisma.unitConversion.count();
  const totalDeps = await prisma.pipelineDependency.count();

  console.log('\n' + '='.repeat(50));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(50));
  console.log(`  Equation Categories: ${totalCats}`);
  console.log(`  Equations: ${totalEqs}`);
  console.log(`  Calculation Pipelines: ${totalPipes}`);
  console.log(`  Pipeline Steps: ${totalSteps}`);
  console.log(`  Pipeline Dependencies: ${totalDeps}`);
  console.log(`  Engineering Standards: ${totalStds}`);
  console.log(`  Standard Coefficients: ${totalCoeffs}`);
  console.log(`  Report Templates: ${totalTemplates}`);
  console.log(`  Courses: ${totalCourses}`);
  console.log(`  Modules: ${totalModules}`);
  console.log(`  Chapters: ${totalChapters}`);
  console.log(`  Lessons: ${totalLessons}`);
  console.log(`  Quizzes: ${totalQuizzes}`);
  console.log(`  Unit Conversions: ${totalUnits}`);
  console.log('='.repeat(50));
  console.log('\n✅ Data import completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Import failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
