import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting EngiSuite Analytics seed...')

  // ========================================
  // Clean existing data (idempotent)
  // ========================================
  console.log('🧹 Cleaning existing data...')

  // Delete in correct order to respect foreign key constraints
  await prisma.lesson.deleteMany()
  await prisma.courseModule.deleteMany()
  await prisma.course.deleteMany()
  await prisma.pipelineStep.deleteMany()
  await prisma.calculationPipeline.deleteMany()
  await prisma.equationOutput.deleteMany()
  await prisma.equationInput.deleteMany()
  await prisma.equation.deleteMany()
  await prisma.equationCategory.deleteMany()
  await prisma.unitConversion.deleteMany()
  await prisma.userSavedData.deleteMany()
  await prisma.calculationHistory.deleteMany()
  await prisma.user.deleteMany()

  console.log('✅ Existing data cleaned.')

  // ========================================
  // 1. Demo User
  // ========================================
  console.log('👤 Creating demo user...')
  const demoUser = await prisma.user.create({
    data: {
      email: 'demo@engisuite.com',
      name: 'Demo User',
      role: 'user',
      tier: 'pro',
    },
  })
  console.log(`  ✓ Created user: ${demoUser.email}`)

  // ========================================
  // 2. Equation Categories
  // ========================================
  console.log('📂 Creating equation categories...')

  const categoriesData = [
    { name: 'Electrical Engineering', slug: 'electrical-engineering', icon: 'Zap', description: 'Electrical circuits, power systems, and electromagnetic calculations', domain: 'electrical', order: 1 },
    { name: 'Mechanical Engineering', slug: 'mechanical-engineering', icon: 'Cog', description: 'Mechanics, materials science, and machine design calculations', domain: 'mechanical', order: 2 },
    { name: 'Civil Engineering', slug: 'civil-engineering', icon: 'Building2', description: 'Structural, geotechnical, and construction calculations', domain: 'civil', order: 3 },
    { name: 'HVAC Engineering', slug: 'hvac-engineering', icon: 'Thermometer', description: 'Heating, ventilation, air conditioning, and refrigeration calculations', domain: 'hvac', order: 4 },
    { name: 'Hydraulic Engineering', slug: 'hydraulic-engineering', icon: 'Droplets', description: 'Fluid mechanics, pipe flow, and hydraulic system calculations', domain: 'hydraulic', order: 5 },
    { name: 'Chemical Engineering', slug: 'chemical-engineering', icon: 'FlaskConical', description: 'Chemical processes, reactions, and material balance calculations', domain: 'chemical', order: 6 },
    { name: 'Thermodynamics', slug: 'thermodynamics', icon: 'Flame', description: 'Heat transfer, energy conversion, and thermal system calculations', domain: 'thermodynamics', order: 7 },
    { name: 'Structural Engineering', slug: 'structural-engineering', icon: 'Triangle', description: 'Structural analysis, load calculations, and material strength', domain: 'structural', order: 8 },
  ]

  const categories: Record<string, Awaited<ReturnType<typeof prisma.equationCategory.create>>> = {}
  for (const catData of categoriesData) {
    const cat = await prisma.equationCategory.create({ data: catData })
    categories[catData.domain] = cat
    console.log(`  ✓ Created category: ${cat.name}`)
  }

  // ========================================
  // 3. Equations with Inputs and Outputs
  // ========================================
  console.log('📐 Creating equations...')

  // --- Electrical Engineering ---
  const ohmsLaw = await prisma.equation.create({
    data: {
      name: "Ohm's Law",
      slug: 'ohms-law',
      formula: 'V = I * R',
      description: 'Relates voltage, current, and resistance in an electrical circuit. One of the most fundamental equations in electrical engineering.',
      category: 'Electrical Engineering',
      domain: 'electrical',
      difficulty: 'beginner',
      tags: 'voltage,current,resistance,circuit,basic',
      reference: 'Georg Simon Ohm, 1827',
      categoryId: categories.electrical.id,
      inputs: {
        create: [
          { name: 'Current', symbol: 'I', unit: 'A', defaultVal: '1', min: '0', step: '0.1', order: 1 },
          { name: 'Resistance', symbol: 'R', unit: 'Ω', defaultVal: '10', min: '0', step: '1', order: 2 },
        ],
      },
      outputs: {
        create: [
          { name: 'Voltage', symbol: 'V', unit: 'V', formula: 'I * R', order: 1 },
        ],
      },
    },
  })
  console.log(`  ✓ Ohm's Law`)

  const powerLaw = await prisma.equation.create({
    data: {
      name: 'Power Law',
      slug: 'power-law',
      formula: 'P = V * I',
      description: 'Calculates electrical power from voltage and current. Fundamental for power system analysis and circuit design.',
      category: 'Electrical Engineering',
      domain: 'electrical',
      difficulty: 'beginner',
      tags: 'power,voltage,current,electrical',
      reference: 'Joule, 1841',
      categoryId: categories.electrical.id,
      inputs: {
        create: [
          { name: 'Voltage', symbol: 'V', unit: 'V', defaultVal: '220', min: '0', step: '1', order: 1 },
          { name: 'Current', symbol: 'I', unit: 'A', defaultVal: '10', min: '0', step: '0.1', order: 2 },
        ],
      },
      outputs: {
        create: [
          { name: 'Power', symbol: 'P', unit: 'W', formula: 'V * I', order: 1 },
        ],
      },
    },
  })
  console.log(`  ✓ Power Law`)

  const cableVoltageDrop = await prisma.equation.create({
    data: {
      name: 'Cable Voltage Drop',
      slug: 'cable-voltage-drop',
      formula: 'Vd = (2 * L * I * R) / 1000',
      description: 'Calculates the voltage drop across a cable given its length, current, and resistance per kilometer. Essential for cable sizing and ensuring equipment receives adequate voltage.',
      category: 'Electrical Engineering',
      domain: 'electrical',
      difficulty: 'intermediate',
      tags: 'voltage drop,cable,sizing,power distribution',
      reference: 'IEC 60364-5-52',
      categoryId: categories.electrical.id,
      inputs: {
        create: [
          { name: 'Cable Length', symbol: 'L', unit: 'm', defaultVal: '100', min: '0', step: '1', order: 1 },
          { name: 'Current', symbol: 'I', unit: 'A', defaultVal: '20', min: '0', step: '0.1', order: 2 },
          { name: 'Resistance per km', symbol: 'R', unit: 'Ω/km', defaultVal: '0.927', min: '0', step: '0.001', order: 3 },
        ],
      },
      outputs: {
        create: [
          { name: 'Voltage Drop', symbol: 'Vd', unit: 'V', formula: '(2 * L * I * R) / 1000', order: 1 },
        ],
      },
    },
  })
  console.log(`  ✓ Cable Voltage Drop`)

  const powerFactor = await prisma.equation.create({
    data: {
      name: 'Power Factor',
      slug: 'power-factor',
      formula: 'PF = P / (V * I)',
      description: 'Calculates the power factor of an AC electrical system. Power factor indicates how effectively electrical power is being converted to useful work.',
      category: 'Electrical Engineering',
      domain: 'electrical',
      difficulty: 'intermediate',
      tags: 'power factor,AC,efficiency,reactive power',
      reference: 'IEEE Std 1459',
      categoryId: categories.electrical.id,
      inputs: {
        create: [
          { name: 'Real Power', symbol: 'P', unit: 'W', defaultVal: '8000', min: '0', step: '100', order: 1 },
          { name: 'Voltage', symbol: 'V', unit: 'V', defaultVal: '400', min: '0', step: '1', order: 2 },
          { name: 'Current', symbol: 'I', unit: 'A', defaultVal: '25', min: '0', step: '0.1', order: 3 },
        ],
      },
      outputs: {
        create: [
          { name: 'Power Factor', symbol: 'PF', unit: '', formula: 'P / (V * I)', order: 1 },
        ],
      },
    },
  })
  console.log(`  ✓ Power Factor`)

  const threePhasePower = await prisma.equation.create({
    data: {
      name: 'Three-Phase Power',
      slug: 'three-phase-power',
      formula: 'P = sqrt(3) * V * I * PF',
      description: 'Calculates total active power in a three-phase AC system. The most common power calculation for industrial and commercial electrical systems.',
      category: 'Electrical Engineering',
      domain: 'electrical',
      difficulty: 'intermediate',
      tags: 'three-phase,power,AC,industrial',
      reference: 'IEC 60038',
      categoryId: categories.electrical.id,
      inputs: {
        create: [
          { name: 'Line Voltage', symbol: 'V', unit: 'V', defaultVal: '400', min: '0', step: '1', order: 1 },
          { name: 'Line Current', symbol: 'I', unit: 'A', defaultVal: '50', min: '0', step: '0.1', order: 2 },
          { name: 'Power Factor', symbol: 'PF', unit: '', defaultVal: '0.85', min: '0', max: '1', step: '0.01', order: 3 },
        ],
      },
      outputs: {
        create: [
          { name: 'Total Power', symbol: 'P', unit: 'W', formula: 'sqrt(3) * V * I * PF', order: 1 },
        ],
      },
    },
  })
  console.log(`  ✓ Three-Phase Power`)

  // --- Mechanical Engineering ---
  const stress = await prisma.equation.create({
    data: {
      name: 'Stress',
      slug: 'stress',
      formula: 'σ = F / A',
      description: 'Calculates mechanical stress as force per unit area. Stress analysis is fundamental to mechanical design and structural integrity assessment.',
      category: 'Mechanical Engineering',
      domain: 'mechanical',
      difficulty: 'beginner',
      tags: 'stress,force,area,mechanics',
      reference: 'Fundamentals of Mechanics of Materials',
      categoryId: categories.mechanical.id,
      inputs: {
        create: [
          { name: 'Force', symbol: 'F', unit: 'N', defaultVal: '1000', min: '0', step: '10', order: 1 },
          { name: 'Cross-Sectional Area', symbol: 'A', unit: 'm²', defaultVal: '0.001', min: '0.000001', step: '0.0001', order: 2 },
        ],
      },
      outputs: {
        create: [
          { name: 'Stress', symbol: 'σ', unit: 'Pa', formula: 'F / A', order: 1 },
        ],
      },
    },
  })
  console.log(`  ✓ Stress`)

  const strain = await prisma.equation.create({
    data: {
      name: 'Strain',
      slug: 'strain',
      formula: 'ε = ΔL / L',
      description: 'Calculates engineering strain as the ratio of change in length to original length. A dimensionless quantity used in material deformation analysis.',
      category: 'Mechanical Engineering',
      domain: 'mechanical',
      difficulty: 'beginner',
      tags: 'strain,deformation,elongation,mechanics',
      reference: 'Fundamentals of Mechanics of Materials',
      categoryId: categories.mechanical.id,
      inputs: {
        create: [
          { name: 'Change in Length', symbol: 'ΔL', unit: 'm', defaultVal: '0.002', min: '0', step: '0.0001', order: 1 },
          { name: 'Original Length', symbol: 'L', unit: 'm', defaultVal: '1', min: '0.000001', step: '0.01', order: 2 },
        ],
      },
      outputs: {
        create: [
          { name: 'Strain', symbol: 'ε', unit: '', formula: 'ΔL / L', order: 1 },
        ],
      },
    },
  })
  console.log(`  ✓ Strain`)

  const beamDeflection = await prisma.equation.create({
    data: {
      name: 'Beam Deflection (Simply Supported, Center Load)',
      slug: 'beam-deflection-simply-supported',
      formula: 'δ = (F * L³) / (48 * E * I)',
      description: 'Calculates maximum deflection of a simply supported beam with a center point load. Used in structural and mechanical design to ensure deflection stays within acceptable limits.',
      category: 'Mechanical Engineering',
      domain: 'mechanical',
      difficulty: 'intermediate',
      tags: 'beam,deflection,simply supported,bending',
      reference: 'Mechanics of Materials, Gere & Goodno',
      categoryId: categories.mechanical.id,
      inputs: {
        create: [
          { name: 'Applied Force', symbol: 'F', unit: 'N', defaultVal: '10000', min: '0', step: '100', order: 1 },
          { name: 'Beam Length', symbol: 'L', unit: 'm', defaultVal: '5', min: '0', step: '0.1', order: 2 },
          { name: 'Elastic Modulus', symbol: 'E', unit: 'Pa', defaultVal: '200000000000', min: '0', step: '1000000', order: 3 },
          { name: 'Moment of Inertia', symbol: 'I', unit: 'm⁴', defaultVal: '0.0001', min: '0', step: '0.000001', order: 4 },
        ],
      },
      outputs: {
        create: [
          { name: 'Deflection', symbol: 'δ', unit: 'm', formula: '(F * L^3) / (48 * E * I)', order: 1 },
        ],
      },
    },
  })
  console.log(`  ✓ Beam Deflection`)

  const reynoldsNumber = await prisma.equation.create({
    data: {
      name: 'Reynolds Number',
      slug: 'reynolds-number',
      formula: 'Re = (ρ * v * D) / μ',
      description: 'Calculates the Reynolds number, a dimensionless quantity used to predict flow patterns (laminar vs turbulent). Critical for fluid mechanics and heat transfer analysis.',
      category: 'Mechanical Engineering',
      domain: 'mechanical',
      difficulty: 'intermediate',
      tags: 'reynolds,fluid,turbulent,laminar,flow',
      reference: 'Osborne Reynolds, 1883',
      categoryId: categories.mechanical.id,
      inputs: {
        create: [
          { name: 'Fluid Density', symbol: 'ρ', unit: 'kg/m³', defaultVal: '1000', min: '0', step: '1', order: 1 },
          { name: 'Flow Velocity', symbol: 'v', unit: 'm/s', defaultVal: '2', min: '0', step: '0.1', order: 2 },
          { name: 'Pipe Diameter', symbol: 'D', unit: 'm', defaultVal: '0.05', min: '0', step: '0.001', order: 3 },
          { name: 'Dynamic Viscosity', symbol: 'μ', unit: 'Pa·s', defaultVal: '0.001', min: '0', step: '0.0001', order: 4 },
        ],
      },
      outputs: {
        create: [
          { name: 'Reynolds Number', symbol: 'Re', unit: '', formula: '(ρ * v * D) / μ', order: 1 },
        ],
      },
    },
  })
  console.log(`  ✓ Reynolds Number`)

  const torque = await prisma.equation.create({
    data: {
      name: 'Torque',
      slug: 'torque',
      formula: 'T = F * r',
      description: 'Calculates torque as the product of force and the perpendicular distance from the axis of rotation. Fundamental in machine design and power transmission.',
      category: 'Mechanical Engineering',
      domain: 'mechanical',
      difficulty: 'beginner',
      tags: 'torque,force,rotation,machine design',
      reference: 'Fundamentals of Machine Design',
      categoryId: categories.mechanical.id,
      inputs: {
        create: [
          { name: 'Force', symbol: 'F', unit: 'N', defaultVal: '500', min: '0', step: '10', order: 1 },
          { name: 'Radius (Lever Arm)', symbol: 'r', unit: 'm', defaultVal: '0.3', min: '0', step: '0.01', order: 2 },
        ],
      },
      outputs: {
        create: [
          { name: 'Torque', symbol: 'T', unit: 'N·m', formula: 'F * r', order: 1 },
        ],
      },
    },
  })
  console.log(`  ✓ Torque`)

  // --- Civil Engineering ---
  const concreteMixRatio = await prisma.equation.create({
    data: {
      name: 'Concrete Water-Cement Ratio',
      slug: 'concrete-water-cement-ratio',
      formula: 'w/c = W / C',
      description: 'Calculates the water-cement ratio, a key parameter in concrete mix design that directly affects strength and workability. Lower w/c ratios produce stronger but less workable concrete.',
      category: 'Civil Engineering',
      domain: 'civil',
      difficulty: 'beginner',
      tags: 'concrete,mix design,water-cement,strength',
      reference: 'ACI 318',
      categoryId: categories.civil.id,
      inputs: {
        create: [
          { name: 'Water Content', symbol: 'W', unit: 'kg', defaultVal: '180', min: '0', step: '1', order: 1 },
          { name: 'Cement Content', symbol: 'C', unit: 'kg', defaultVal: '360', min: '0', step: '1', order: 2 },
        ],
      },
      outputs: {
        create: [
          { name: 'Water-Cement Ratio', symbol: 'w/c', unit: '', formula: 'W / C', order: 1 },
        ],
      },
    },
  })
  console.log(`  ✓ Concrete Water-Cement Ratio`)

  const soilBearingCapacity = await prisma.equation.create({
    data: {
      name: 'Soil Bearing Capacity (Simplified)',
      slug: 'soil-bearing-capacity',
      formula: 'q_ult = c*Nc + γ*Df*Nq + 0.5*γ*B*Nγ',
      description: 'Calculates the ultimate bearing capacity of soil using Terzaghi\'s simplified equation. Used in foundation design to ensure the soil can support the structure\'s load.',
      category: 'Civil Engineering',
      domain: 'civil',
      difficulty: 'advanced',
      tags: 'soil,bearing capacity,foundation,geotechnical',
      reference: 'Terzaghi, 1943',
      categoryId: categories.civil.id,
      inputs: {
        create: [
          { name: 'Cohesion', symbol: 'c', unit: 'kPa', defaultVal: '25', min: '0', step: '1', order: 1 },
          { name: 'Bearing Capacity Factor Nc', symbol: 'Nc', unit: '', defaultVal: '25.13', min: '0', step: '0.01', order: 2 },
          { name: 'Soil Unit Weight', symbol: 'γ', unit: 'kN/m³', defaultVal: '18', min: '0', step: '0.1', order: 3 },
          { name: 'Foundation Depth', symbol: 'Df', unit: 'm', defaultVal: '1.5', min: '0', step: '0.1', order: 4 },
          { name: 'Bearing Capacity Factor Nq', symbol: 'Nq', unit: '', defaultVal: '12.75', min: '0', step: '0.01', order: 5 },
          { name: 'Foundation Width', symbol: 'B', unit: 'm', defaultVal: '2', min: '0', step: '0.1', order: 6 },
          { name: 'Bearing Capacity Factor Nγ', symbol: 'Nγ', unit: '', defaultVal: '9.7', min: '0', step: '0.01', order: 7 },
        ],
      },
      outputs: {
        create: [
          { name: 'Ultimate Bearing Capacity', symbol: 'q_ult', unit: 'kPa', formula: 'c*Nc + γ*Df*Nq + 0.5*γ*B*Nγ', order: 1 },
        ],
      },
    },
  })
  console.log(`  ✓ Soil Bearing Capacity`)

  const beamMoment = await prisma.equation.create({
    data: {
      name: 'Beam Bending Moment (Uniform Load)',
      slug: 'beam-bending-moment',
      formula: 'M = (w * L²) / 8',
      description: 'Calculates the maximum bending moment for a simply supported beam with a uniformly distributed load. Used in structural design to determine required section properties.',
      category: 'Civil Engineering',
      domain: 'civil',
      difficulty: 'beginner',
      tags: 'beam,moment,bending,uniform load,structural',
      reference: 'Structural Analysis, Hibbeler',
      categoryId: categories.civil.id,
      inputs: {
        create: [
          { name: 'Distributed Load', symbol: 'w', unit: 'N/m', defaultVal: '5000', min: '0', step: '100', order: 1 },
          { name: 'Beam Length', symbol: 'L', unit: 'm', defaultVal: '6', min: '0', step: '0.1', order: 2 },
        ],
      },
      outputs: {
        create: [
          { name: 'Maximum Bending Moment', symbol: 'M', unit: 'N·m', formula: '(w * L^2) / 8', order: 1 },
        ],
      },
    },
  })
  console.log(`  ✓ Beam Bending Moment`)

  // --- HVAC Engineering ---
  const sensibleHeat = await prisma.equation.create({
    data: {
      name: 'Sensible Heat',
      slug: 'sensible-heat',
      formula: 'Q = 1.08 * CFM * ΔT',
      description: 'Calculates sensible heat in BTU/hr using the standard HVAC formula. Used for heating and cooling load calculations in Imperial units.',
      category: 'HVAC Engineering',
      domain: 'hvac',
      difficulty: 'beginner',
      tags: 'sensible heat,HVAC,cooling,heating',
      reference: 'ASHRAE Fundamentals',
      categoryId: categories.hvac.id,
      inputs: {
        create: [
          { name: 'Airflow', symbol: 'CFM', unit: 'cfm', defaultVal: '2000', min: '0', step: '10', order: 1 },
          { name: 'Temperature Difference', symbol: 'ΔT', unit: '°F', defaultVal: '20', min: '0', step: '0.5', order: 2 },
        ],
      },
      outputs: {
        create: [
          { name: 'Sensible Heat', symbol: 'Q', unit: 'BTU/hr', formula: '1.08 * CFM * ΔT', order: 1 },
        ],
      },
    },
  })
  console.log(`  ✓ Sensible Heat`)

  const coolingLoad = await prisma.equation.create({
    data: {
      name: 'Cooling Load',
      slug: 'cooling-load',
      formula: 'Q = m * Cp * ΔT',
      description: 'Calculates cooling load using mass flow rate, specific heat capacity, and temperature difference. A fundamental equation for HVAC system sizing in SI units.',
      category: 'HVAC Engineering',
      domain: 'hvac',
      difficulty: 'intermediate',
      tags: 'cooling load,HVAC,specific heat,mass flow',
      reference: 'ASHRAE Fundamentals',
      categoryId: categories.hvac.id,
      inputs: {
        create: [
          { name: 'Mass Flow Rate', symbol: 'm', unit: 'kg/s', defaultVal: '0.5', min: '0', step: '0.01', order: 1 },
          { name: 'Specific Heat Capacity', symbol: 'Cp', unit: 'J/kg·K', defaultVal: '1005', min: '0', step: '1', order: 2 },
          { name: 'Temperature Difference', symbol: 'ΔT', unit: 'K', defaultVal: '10', min: '0', step: '0.5', order: 3 },
        ],
      },
      outputs: {
        create: [
          { name: 'Cooling Load', symbol: 'Q', unit: 'W', formula: 'm * Cp * ΔT', order: 1 },
        ],
      },
    },
  })
  console.log(`  ✓ Cooling Load`)

  const airChangesPerHour = await prisma.equation.create({
    data: {
      name: 'Air Changes per Hour',
      slug: 'air-changes-per-hour',
      formula: 'ACH = (CFM * 60) / Volume',
      description: 'Calculates the air changes per hour, a measure of how many times the air within a room is replaced per hour. Important for ventilation design and indoor air quality assessment.',
      category: 'HVAC Engineering',
      domain: 'hvac',
      difficulty: 'beginner',
      tags: 'ACH,ventilation,air quality,HVAC',
      reference: 'ASHRAE Standard 62.1',
      categoryId: categories.hvac.id,
      inputs: {
        create: [
          { name: 'Airflow', symbol: 'CFM', unit: 'cfm', defaultVal: '500', min: '0', step: '10', order: 1 },
          { name: 'Room Volume', symbol: 'Volume', unit: 'ft³', defaultVal: '3000', min: '0', step: '10', order: 2 },
        ],
      },
      outputs: {
        create: [
          { name: 'Air Changes per Hour', symbol: 'ACH', unit: '/hr', formula: '(CFM * 60) / Volume', order: 1 },
        ],
      },
    },
  })
  console.log(`  ✓ Air Changes per Hour`)

  // --- Hydraulic Engineering ---
  const flowRate = await prisma.equation.create({
    data: {
      name: 'Flow Rate (Continuity)',
      slug: 'flow-rate',
      formula: 'Q = A * v',
      description: 'Calculates volumetric flow rate from cross-sectional area and flow velocity. Based on the continuity equation, fundamental in fluid mechanics.',
      category: 'Hydraulic Engineering',
      domain: 'hydraulic',
      difficulty: 'beginner',
      tags: 'flow rate,continuity,fluid,velocity',
      reference: 'Fluid Mechanics, White',
      categoryId: categories.hydraulic.id,
      inputs: {
        create: [
          { name: 'Cross-Sectional Area', symbol: 'A', unit: 'm²', defaultVal: '0.01', min: '0', step: '0.001', order: 1 },
          { name: 'Flow Velocity', symbol: 'v', unit: 'm/s', defaultVal: '2', min: '0', step: '0.1', order: 2 },
        ],
      },
      outputs: {
        create: [
          { name: 'Flow Rate', symbol: 'Q', unit: 'm³/s', formula: 'A * v', order: 1 },
        ],
      },
    },
  })
  console.log(`  ✓ Flow Rate`)

  const hydraulicPressure = await prisma.equation.create({
    data: {
      name: 'Hydraulic Pressure',
      slug: 'hydraulic-pressure',
      formula: 'P = F / A',
      description: 'Calculates pressure as force per unit area. The basis of Pascal\'s law and hydraulic systems design.',
      category: 'Hydraulic Engineering',
      domain: 'hydraulic',
      difficulty: 'beginner',
      tags: 'pressure,force,hydraulic,Pascal',
      reference: "Pascal's Law",
      categoryId: categories.hydraulic.id,
      inputs: {
        create: [
          { name: 'Force', symbol: 'F', unit: 'N', defaultVal: '5000', min: '0', step: '10', order: 1 },
          { name: 'Area', symbol: 'A', unit: 'm²', defaultVal: '0.02', min: '0.000001', step: '0.001', order: 2 },
        ],
      },
      outputs: {
        create: [
          { name: 'Pressure', symbol: 'P', unit: 'Pa', formula: 'F / A', order: 1 },
        ],
      },
    },
  })
  console.log(`  ✓ Hydraulic Pressure`)

  const bernoulli = await prisma.equation.create({
    data: {
      name: 'Bernoulli Equation (Simplified)',
      slug: 'bernoulli-equation',
      formula: 'P1 + 0.5*ρ*v1² = P2 + 0.5*ρ*v2²',
      description: 'Simplified Bernoulli equation neglecting elevation changes. Relates pressure and velocity between two points in a steady, incompressible flow. Fundamental for pipe flow analysis and flow measurement.',
      category: 'Hydraulic Engineering',
      domain: 'hydraulic',
      difficulty: 'intermediate',
      tags: 'bernoulli,pressure,velocity,fluid,energy',
      reference: 'Daniel Bernoulli, 1738',
      categoryId: categories.hydraulic.id,
      inputs: {
        create: [
          { name: 'Pressure at Point 1', symbol: 'P1', unit: 'Pa', defaultVal: '200000', min: '0', step: '1000', order: 1 },
          { name: 'Fluid Density', symbol: 'ρ', unit: 'kg/m³', defaultVal: '1000', min: '0', step: '1', order: 2 },
          { name: 'Velocity at Point 1', symbol: 'v1', unit: 'm/s', defaultVal: '2', min: '0', step: '0.1', order: 3 },
          { name: 'Velocity at Point 2', symbol: 'v2', unit: 'm/s', defaultVal: '4', min: '0', step: '0.1', order: 4 },
        ],
      },
      outputs: {
        create: [
          { name: 'Pressure at Point 2', symbol: 'P2', unit: 'Pa', formula: 'P1 + 0.5*ρ*(v1^2 - v2^2)', order: 1 },
        ],
      },
    },
  })
  console.log(`  ✓ Bernoulli Equation`)

  // --- Thermodynamics ---
  const idealGasLaw = await prisma.equation.create({
    data: {
      name: 'Ideal Gas Law',
      slug: 'ideal-gas-law',
      formula: 'PV = nRT',
      description: 'The ideal gas law relates pressure, volume, amount of gas, and temperature. R is the universal gas constant (8.314 J/mol·K). One of the most important equations in thermodynamics.',
      category: 'Thermodynamics',
      domain: 'thermodynamics',
      difficulty: 'intermediate',
      tags: 'ideal gas,pressure,volume,temperature,thermodynamics',
      reference: 'Clapeyron, 1834',
      categoryId: categories.thermodynamics.id,
      inputs: {
        create: [
          { name: 'Amount of Substance', symbol: 'n', unit: 'mol', defaultVal: '1', min: '0', step: '0.1', order: 1 },
          { name: 'Temperature', symbol: 'T', unit: 'K', defaultVal: '300', min: '0', step: '1', order: 2 },
          { name: 'Volume', symbol: 'V', unit: 'm³', defaultVal: '0.025', min: '0', step: '0.001', order: 3 },
        ],
      },
      outputs: {
        create: [
          { name: 'Pressure', symbol: 'P', unit: 'Pa', formula: '(n * 8.314 * T) / V', order: 1 },
        ],
      },
    },
  })
  console.log(`  ✓ Ideal Gas Law`)

  const carnotEfficiency = await prisma.equation.create({
    data: {
      name: 'Carnot Efficiency',
      slug: 'carnot-efficiency',
      formula: 'η = 1 - (Tc / Th)',
      description: 'Calculates the maximum theoretical efficiency of a heat engine operating between two temperatures. Sets the upper limit for any real engine efficiency.',
      category: 'Thermodynamics',
      domain: 'thermodynamics',
      difficulty: 'intermediate',
      tags: 'carnot,efficiency,heat engine,thermodynamics',
      reference: 'Sadi Carnot, 1824',
      categoryId: categories.thermodynamics.id,
      inputs: {
        create: [
          { name: 'Cold Reservoir Temperature', symbol: 'Tc', unit: 'K', defaultVal: '300', min: '0', step: '1', order: 1 },
          { name: 'Hot Reservoir Temperature', symbol: 'Th', unit: 'K', defaultVal: '600', min: '0', step: '1', order: 2 },
        ],
      },
      outputs: {
        create: [
          { name: 'Carnot Efficiency', symbol: 'η', unit: '', formula: '1 - (Tc / Th)', order: 1 },
        ],
      },
    },
  })
  console.log(`  ✓ Carnot Efficiency`)

  // --- Chemical Engineering ---
  const molarity = await prisma.equation.create({
    data: {
      name: 'Molarity',
      slug: 'molarity',
      formula: 'M = n / V',
      description: 'Calculates molar concentration (molarity) as moles of solute per liter of solution. A fundamental concept in chemical engineering and analytical chemistry.',
      category: 'Chemical Engineering',
      domain: 'chemical',
      difficulty: 'beginner',
      tags: 'molarity,concentration,solution,chemical',
      reference: 'General Chemistry',
      categoryId: categories.chemical.id,
      inputs: {
        create: [
          { name: 'Moles of Solute', symbol: 'n', unit: 'mol', defaultVal: '0.5', min: '0', step: '0.01', order: 1 },
          { name: 'Volume of Solution', symbol: 'V', unit: 'L', defaultVal: '1', min: '0.000001', step: '0.1', order: 2 },
        ],
      },
      outputs: {
        create: [
          { name: 'Molarity', symbol: 'M', unit: 'mol/L', formula: 'n / V', order: 1 },
        ],
      },
    },
  })
  console.log(`  ✓ Molarity`)

  const massTransferRate = await prisma.equation.create({
    data: {
      name: 'Mass Transfer Rate',
      slug: 'mass-transfer-rate',
      formula: 'N = k * A * ΔC',
      description: 'Calculates the mass transfer rate using the mass transfer coefficient, interfacial area, and concentration difference. Key in separation processes and reactor design.',
      category: 'Chemical Engineering',
      domain: 'chemical',
      difficulty: 'advanced',
      tags: 'mass transfer,separation,diffusion,chemical',
      reference: 'Transport Phenomena, Bird, Stewart & Lightfoot',
      categoryId: categories.chemical.id,
      inputs: {
        create: [
          { name: 'Mass Transfer Coefficient', symbol: 'k', unit: 'm/s', defaultVal: '0.001', min: '0', step: '0.0001', order: 1 },
          { name: 'Interfacial Area', symbol: 'A', unit: 'm²', defaultVal: '10', min: '0', step: '0.1', order: 2 },
          { name: 'Concentration Difference', symbol: 'ΔC', unit: 'mol/m³', defaultVal: '50', min: '0', step: '1', order: 3 },
        ],
      },
      outputs: {
        create: [
          { name: 'Mass Transfer Rate', symbol: 'N', unit: 'mol/s', formula: 'k * A * ΔC', order: 1 },
        ],
      },
    },
  })
  console.log(`  ✓ Mass Transfer Rate`)

  console.log(`  📊 Total equations created: 21`)

  // ========================================
  // 4. Calculation Pipelines with Steps
  // ========================================
  console.log('🔗 Creating calculation pipelines...')

  // Pipeline 1: Cable Sizing & Voltage Drop
  const cableSizingPipeline = await prisma.calculationPipeline.create({
    data: {
      name: 'Cable Sizing & Voltage Drop',
      slug: 'cable-sizing-voltage-drop',
      description: 'Complete cable sizing procedure including load current calculation, cable selection, voltage drop verification, short circuit rating check, and final cable specification.',
      domain: 'electrical',
      category: 'Electrical Engineering',
      difficulty: 'advanced',
      icon: 'Cable',
      tags: 'cable,sizing,voltage drop,electrical,power distribution',
      steps: {
        create: [
          { name: 'Determine Load Current', description: 'Calculate the full load current based on connected load and system voltage.', order: 1, formula: 'I = P / (sqrt(3) * V * PF)', inputSchema: '{"P": {"unit": "W", "label": "Total Load"}, "V": {"unit": "V", "label": "System Voltage"}, "PF": {"unit": "", "label": "Power Factor"}}', outputSchema: '{"I": {"unit": "A", "label": "Load Current"}}', helperText: 'Consider demand factor and diversity factor for realistic load current.' },
          { name: 'Select Cable Type and Rating', description: 'Choose cable type based on installation method, ambient temperature, and required current rating.', order: 2, formula: 'Iz >= Ib / (Ca * Cg * Ci)', inputSchema: '{"Ib": {"unit": "A", "label": "Design Current"}, "Ca": {"unit": "", "label": "Temp Correction"}, "Cg": {"unit": "", "label": "Grouping Correction"}, "Ci": {"unit": "", "label": "Insulation Correction"}}', outputSchema: '{"Iz": {"unit": "A", "label": "Required Cable Rating"}}', helperText: 'Refer to IEC 60364-5-52 for correction factors.' },
          { name: 'Calculate Voltage Drop', description: 'Verify that voltage drop is within acceptable limits (typically <4% for power, <2.5% for lighting).', order: 3, formula: 'Vd = (2 * L * I * R) / 1000', inputSchema: '{"L": {"unit": "m", "label": "Cable Length"}, "I": {"unit": "A", "label": "Load Current"}, "R": {"unit": "Ω/km", "label": "Resistance per km"}}', outputSchema: '{"Vd": {"unit": "V", "label": "Voltage Drop"}, "Vd_pct": {"unit": "%", "label": "Voltage Drop %"}}', helperText: 'Check against maximum allowable voltage drop percentage.' },
          { name: 'Check Short Circuit Rating', description: 'Verify cable can withstand the prospective short circuit current for the required disconnection time.', order: 4, formula: 'K² * S² >= I² * t', inputSchema: '{"K": {"unit": "", "label": "Cable Constant"}, "S": {"unit": "mm²", "label": "Cross-Section"}, "I": {"unit": "A", "label": "Fault Current"}, "t": {"unit": "s", "label": "Disconnection Time"}}', outputSchema: '{"result": {"unit": "", "label": "Pass/Fail Check"}}', helperText: 'Cable must withstand the thermal effects of short circuit current.' },
          { name: 'Final Cable Selection', description: 'Select the final cable specification based on all checks. Document the chosen cable size, type, and installation method.', order: 5, inputSchema: '{"size": {"unit": "mm²", "label": "Selected Size"}, "type": {"unit": "", "label": "Cable Type"}, "method": {"unit": "", "label": "Installation Method"}}', outputSchema: '{"specification": {"unit": "", "label": "Final Cable Spec"}}', helperText: 'Document all assumptions and reference standards used.' },
        ],
      },
    },
  })
  console.log(`  ✓ Cable Sizing & Voltage Drop pipeline (5 steps)`)

  // Pipeline 2: Power Factor Correction
  const powerFactorPipeline = await prisma.calculationPipeline.create({
    data: {
      name: 'Power Factor Correction',
      slug: 'power-factor-correction',
      description: 'Step-by-step procedure for calculating and correcting power factor in industrial installations using capacitor banks.',
      domain: 'electrical',
      category: 'Electrical Engineering',
      difficulty: 'intermediate',
      icon: 'Zap',
      tags: 'power factor,capacitor,correction,reactive power',
      steps: {
        create: [
          { name: 'Calculate Existing Power Factor', description: 'Determine the current power factor from real and apparent power measurements.', order: 1, formula: 'PF = P / S = P / (V * I)', inputSchema: '{"P": {"unit": "W", "label": "Real Power"}, "V": {"unit": "V", "label": "Voltage"}, "I": {"unit": "A", "label": "Current"}}', outputSchema: '{"PF": {"unit": "", "label": "Current Power Factor"}, "S": {"unit": "VA", "label": "Apparent Power"}}', helperText: 'Measure at peak load conditions for worst-case power factor.' },
          { name: 'Determine Target Power Factor', description: 'Set the desired power factor based on utility requirements (typically 0.95 or higher).', order: 2, inputSchema: '{"PF_existing": {"unit": "", "label": "Existing PF"}, "PF_target": {"unit": "", "label": "Target PF"}, "P": {"unit": "W", "label": "Real Power"}}', outputSchema: '{"delta_PF": {"unit": "", "label": "Required PF Improvement"}}', helperText: 'Check local utility regulations for minimum power factor requirements.' },
          { name: 'Calculate Required Capacitance', description: 'Determine the reactive power compensation needed to achieve the target power factor.', order: 3, formula: 'Qc = P * (tan(acos(PF1)) - tan(acos(PF2)))', inputSchema: '{"P": {"unit": "W", "label": "Real Power"}, "PF1": {"unit": "", "label": "Existing PF"}, "PF2": {"unit": "", "label": "Target PF"}}', outputSchema: '{"Qc": {"unit": "VAR", "label": "Required Capacitive Reactive Power"}}', helperText: 'Consider adding 10-15% margin for future load growth.' },
          { name: 'Select Capacitor Bank', description: 'Choose appropriate capacitor bank size and configuration from manufacturer catalogs.', order: 4, inputSchema: '{"Qc": {"unit": "VAR", "label": "Required kVAR"}, "V": {"unit": "V", "label": "System Voltage"}, "steps": {"unit": "", "label": "Number of Steps"}}', outputSchema: '{"Q_selected": {"unit": "VAR", "label": "Selected kVAR"}, "C": {"unit": "μF", "label": "Capacitance per Phase"}}', helperText: 'Consider automatic vs. fixed capacitor banks based on load variation.' },
        ],
      },
    },
  })
  console.log(`  ✓ Power Factor Correction pipeline (4 steps)`)

  // Pipeline 3: Beam Design
  const beamDesignPipeline = await prisma.calculationPipeline.create({
    data: {
      name: 'Beam Design',
      slug: 'beam-design',
      description: 'Complete beam design procedure from load determination through section selection and deflection checking.',
      domain: 'mechanical',
      category: 'Mechanical Engineering',
      difficulty: 'intermediate',
      icon: 'Ruler',
      tags: 'beam,design,deflection,bending,stress',
      steps: {
        create: [
          { name: 'Determine Loads and Support Conditions', description: 'Identify all applied loads (point loads, distributed loads, moments) and support conditions (simply supported, fixed, cantilever).', order: 1, inputSchema: '{"load_type": {"unit": "", "label": "Load Type"}, "magnitude": {"unit": "N/m or N", "label": "Load Magnitude"}, "support": {"unit": "", "label": "Support Type"}}', outputSchema: '{"loads": {"unit": "", "label": "Load Summary"}}', helperText: 'Apply appropriate load factors per design code (LRFD or ASD).' },
          { name: 'Calculate Bending Moment and Shear Force', description: 'Compute the maximum bending moment and shear force using structural analysis methods.', order: 2, formula: 'M_max = (w * L²) / 8', inputSchema: '{"w": {"unit": "N/m", "label": "Distributed Load"}, "L": {"unit": "m", "label": "Beam Span"}}', outputSchema: '{"M_max": {"unit": "N·m", "label": "Max Bending Moment"}, "V_max": {"unit": "N", "label": "Max Shear Force"}}', helperText: 'Consider load combinations per applicable design code.' },
          { name: 'Select Section Properties', description: 'Choose a cross-section with adequate section modulus and shear area.', order: 3, formula: 'S_required = M_max / F_b', inputSchema: '{"M_max": {"unit": "N·m", "label": "Max Moment"}, "F_b": {"unit": "Pa", "label": "Allowable Bending Stress"}}', outputSchema: '{"S_required": {"unit": "m³", "label": "Required Section Modulus"}}', helperText: 'Select from standard section tables (W-shapes, HSS, etc.).' },
          { name: 'Check Deflection Limits', description: 'Verify that the calculated deflection is within code-specified limits (typically L/360 for floors, L/240 for roofs).', order: 4, formula: 'δ = (5 * w * L⁴) / (384 * E * I)', inputSchema: '{"w": {"unit": "N/m", "label": "Service Load"}, "L": {"unit": "m", "label": "Beam Span"}, "E": {"unit": "Pa", "label": "Elastic Modulus"}, "I": {"unit": "m⁴", "label": "Moment of Inertia"}}', outputSchema: '{"delta": {"unit": "m", "label": "Actual Deflection"}, "delta_limit": {"unit": "m", "label": "Allowable Deflection"}}', helperText: 'Use service (unfactored) loads for deflection checks.' },
        ],
      },
    },
  })
  console.log(`  ✓ Beam Design pipeline (4 steps)`)

  // Pipeline 4: Cooling Load Calculation
  const coolingLoadPipeline = await prisma.calculationPipeline.create({
    data: {
      name: 'Cooling Load Calculation',
      slug: 'cooling-load-calculation',
      description: 'Comprehensive cooling load calculation procedure following ASHRAE methods for HVAC system design.',
      domain: 'hvac',
      category: 'HVAC Engineering',
      difficulty: 'advanced',
      icon: 'Snowflake',
      tags: 'cooling load,HVAC,ASHRAE,heat gain',
      steps: {
        create: [
          { name: 'Calculate Wall/Roof Heat Gain', description: 'Determine heat transfer through building envelope using U-values and temperature differences.', order: 1, formula: 'Q = U * A * CLTD', inputSchema: '{"U": {"unit": "W/m²·K", "label": "Overall U-Value"}, "A": {"unit": "m²", "label": "Area"}, "CLTD": {"unit": "K", "label": "Cooling Load Temp Diff"}}', outputSchema: '{"Q_envelope": {"unit": "W", "label": "Envelope Heat Gain"}}', helperText: 'Use CLTD/SCL/CLF method or RTS method per ASHRAE.' },
          { name: 'Calculate Window Solar Heat Gain', description: 'Calculate solar heat gain through glazing using SHGC and solar angles.', order: 2, formula: 'Q = A * SHGC * SCF', inputSchema: '{"A": {"unit": "m²", "label": "Window Area"}, "SHGC": {"unit": "", "label": "Solar Heat Gain Coeff"}, "SCF": {"unit": "W/m²", "label": "Solar Cooling Factor"}}', outputSchema: '{"Q_solar": {"unit": "W", "label": "Solar Heat Gain"}}', helperText: 'Consider shading devices and window orientation.' },
          { name: 'Calculate Internal Heat Gains', description: 'Sum heat gains from occupants, lighting, and equipment.', order: 3, formula: 'Q_total = Q_people + Q_lights + Q_equipment', inputSchema: '{"Q_people": {"unit": "W", "label": "People Heat Gain"}, "Q_lights": {"unit": "W", "label": "Lighting Heat Gain"}, "Q_equipment": {"unit": "W", "label": "Equipment Heat Gain"}}', outputSchema: '{"Q_internal": {"unit": "W", "label": "Total Internal Heat Gain"}}', helperText: 'Apply diversity factors for simultaneous usage.' },
          { name: 'Calculate Ventilation Load', description: 'Determine the load from outside air required for ventilation.', order: 4, formula: 'Q = m_dot * (ho - hi)', inputSchema: '{"m_dot": {"unit": "kg/s", "label": "OA Mass Flow"}, "ho": {"unit": "J/kg", "label": "OA Enthalpy"}, "hi": {"unit": "J/kg", "label": "Indoor Enthalpy"}}', outputSchema: '{"Q_ventilation": {"unit": "W", "label": "Ventilation Load"}}', helperText: 'Follow ASHRAE 62.1 for minimum ventilation rates.' },
          { name: 'Total Cooling Load Summary', description: 'Sum all cooling load components and apply safety factors to determine equipment size.', order: 5, formula: 'Q_total = Q_envelope + Q_solar + Q_internal + Q_ventilation', inputSchema: '{"Q_envelope": {"unit": "W", "label": "Envelope Gain"}, "Q_solar": {"unit": "W", "label": "Solar Gain"}, "Q_internal": {"unit": "W", "label": "Internal Gain"}, "Q_ventilation": {"unit": "W", "label": "Ventilation Load"}, "safety_factor": {"unit": "", "label": "Safety Factor"}}', outputSchema: '{"Q_total": {"unit": "W", "label": "Total Cooling Load"}, "Q_equipment": {"unit": "W", "label": "Equipment Size"}}', helperText: 'Apply 10-15% safety factor for equipment selection.' },
        ],
      },
    },
  })
  console.log(`  ✓ Cooling Load Calculation pipeline (5 steps)`)

  // Pipeline 5: Pipe Sizing
  const pipeSizingPipeline = await prisma.calculationPipeline.create({
    data: {
      name: 'Pipe Sizing',
      slug: 'pipe-sizing',
      description: 'Systematic pipe sizing procedure including flow rate determination, diameter calculation, pressure loss analysis, and specification selection.',
      domain: 'hydraulic',
      category: 'Hydraulic Engineering',
      difficulty: 'intermediate',
      icon: 'Disc',
      tags: 'pipe,sizing,flow,pressure,hydraulic',
      steps: {
        create: [
          { name: 'Determine Flow Rate Requirements', description: 'Calculate design flow rate based on demand, fixture units, or process requirements.', order: 1, formula: 'Q = A * v', inputSchema: '{"demand": {"unit": "L/s", "label": "Peak Demand"}, "diversity": {"unit": "", "label": "Diversity Factor"}}', outputSchema: '{"Q_design": {"unit": "m³/s", "label": "Design Flow Rate"}}', helperText: 'Consider peak demand and future expansion requirements.' },
          { name: 'Calculate Pipe Diameter', description: 'Determine minimum pipe diameter for acceptable flow velocity.', order: 2, formula: 'D = sqrt(4 * Q / (π * v_max))', inputSchema: '{"Q": {"unit": "m³/s", "label": "Design Flow Rate"}, "v_max": {"unit": "m/s", "label": "Max Allowable Velocity"}}', outputSchema: '{"D_min": {"unit": "m", "label": "Minimum Diameter"}}', helperText: 'Typical max velocities: 1.5-3 m/s for water supply.' },
          { name: 'Calculate Pressure Losses', description: 'Compute friction losses (Darcy-Weisbach) and minor losses (fittings, valves).', order: 3, formula: 'hf = f * (L/D) * (v²/2g)', inputSchema: '{"f": {"unit": "", "label": "Friction Factor"}, "L": {"unit": "m", "label": "Pipe Length"}, "D": {"unit": "m", "label": "Pipe Diameter"}, "v": {"unit": "m/s", "label": "Flow Velocity"}}', outputSchema: '{"hf": {"unit": "m", "label": "Friction Head Loss"}, "minor_losses": {"unit": "m", "label": "Minor Losses"}}', helperText: 'Use Moody chart or Colebrook equation for friction factor.' },
          { name: 'Select Pipe Specification', description: 'Choose pipe material, schedule/rating, and finalize specifications.', order: 4, inputSchema: '{"material": {"unit": "", "label": "Pipe Material"}, "pressure_rating": {"unit": "Pa", "label": "Required Pressure Rating"}, "corrosion_allowance": {"unit": "mm", "label": "Corrosion Allowance"}}', outputSchema: '{"specification": {"unit": "", "label": "Final Pipe Spec"}, "actual_D": {"unit": "m", "label": "Actual Internal Diameter"}}', helperText: 'Select next larger standard pipe size above calculated minimum.' },
        ],
      },
    },
  })
  console.log(`  ✓ Pipe Sizing pipeline (4 steps)`)

  // Pipeline 6: Foundation Design
  const foundationDesignPipeline = await prisma.calculationPipeline.create({
    data: {
      name: 'Foundation Design',
      slug: 'foundation-design',
      description: 'Complete shallow foundation design procedure from soil investigation through bearing capacity and settlement verification.',
      domain: 'civil',
      category: 'Civil Engineering',
      difficulty: 'advanced',
      icon: 'Construction',
      tags: 'foundation,design,bearing capacity,settlement,geotechnical',
      steps: {
        create: [
          { name: 'Determine Soil Properties', description: 'Establish soil parameters from geotechnical investigation data including cohesion, friction angle, and unit weight.', order: 1, inputSchema: '{"c": {"unit": "kPa", "label": "Cohesion"}, "phi": {"unit": "°", "label": "Friction Angle"}, "gamma": {"unit": "kN/m³", "label": "Soil Unit Weight"}, "GWT": {"unit": "m", "label": "Ground Water Table Depth"}}', outputSchema: '{"soil_params": {"unit": "", "label": "Soil Parameters Summary"}}', helperText: 'Use borehole data and laboratory test results.' },
          { name: 'Calculate Bearing Capacity', description: 'Determine ultimate and allowable bearing capacity using Terzaghi or Meyerhof method.', order: 2, formula: 'q_ult = c*Nc + γ*Df*Nq + 0.5*γ*B*Nγ', inputSchema: '{"c": {"unit": "kPa", "label": "Cohesion"}, "Nc": {"unit": "", "label": "Bearing Factor Nc"}, "gamma": {"unit": "kN/m³", "label": "Unit Weight"}, "Df": {"unit": "m", "label": "Foundation Depth"}, "Nq": {"unit": "", "label": "Bearing Factor Nq"}, "B": {"unit": "m", "label": "Foundation Width"}, "Ngamma": {"unit": "", "label": "Bearing Factor Nγ"}}', outputSchema: '{"q_ult": {"unit": "kPa", "label": "Ultimate Bearing Capacity"}, "q_all": {"unit": "kPa", "label": "Allowable Bearing Capacity"}}', helperText: 'Apply factor of safety (typically 2.5-3.0) to ultimate capacity.' },
          { name: 'Determine Foundation Dimensions', description: 'Size the foundation to support the applied loads within allowable bearing pressure.', order: 3, formula: 'A_required = P / q_all', inputSchema: '{"P": {"unit": "kN", "label": "Column Load"}, "q_all": {"unit": "kPa", "label": "Allowable Bearing Pressure"}, "M": {"unit": "kN·m", "label": "Applied Moment"}}', outputSchema: '{"A_required": {"unit": "m²", "label": "Required Area"}, "B": {"unit": "m", "label": "Width"}, "L": {"unit": "m", "label": "Length"}}', helperText: 'Consider eccentricity of loading for combined axial and moment loads.' },
          { name: 'Check Settlement Criteria', description: 'Verify that estimated settlement is within tolerable limits for the structure type.', order: 4, formula: 'S = (q * B * (1-ν²)) / (Es * Iw)', inputSchema: '{"q": {"unit": "kPa", "label": "Net Pressure"}, "B": {"unit": "m", "label": "Foundation Width"}, "nu": {"unit": "", "label": "Poisson Ratio"}, "Es": {"unit": "kPa", "label": "Elastic Modulus"}, "Iw": {"unit": "", "label": "Influence Factor"}}', outputSchema: '{"S": {"unit": "m", "label": "Estimated Settlement"}, "S_allow": {"unit": "m", "label": "Allowable Settlement"}}', helperText: 'Typical allowable settlement: 25mm for isolated footings, 50mm for rafts.' },
        ],
      },
    },
  })
  console.log(`  ✓ Foundation Design pipeline (4 steps)`)

  console.log(`  📊 Total pipelines created: 6`)

  // ========================================
  // 5. Courses with Modules and Lessons
  // ========================================
  console.log('📚 Creating courses...')

  // Course 1: Electrical Power Systems
  const electricalCourse = await prisma.course.create({
    data: {
      title: 'Electrical Power Systems',
      slug: 'electrical-power-systems',
      description: 'Comprehensive course covering electrical power generation, transmission, distribution, and utilization. From basic circuit analysis to three-phase systems and power factor correction.',
      domain: 'electrical',
      level: 'intermediate',
      duration: '40 hours',
      icon: 'Zap',
      rating: '4.8',
      enrolled: 1250,
      order: 1,
      modules: {
        create: [
          {
            title: 'Fundamentals of Electrical Circuits',
            description: 'Core concepts of electrical circuit theory',
            order: 1,
            duration: '14 hours',
            lessons: {
              create: [
                { title: "Ohm's Law and Circuit Basics", description: 'Understanding voltage, current, and resistance relationships', type: 'article', content: 'Introduction to Ohm\'s Law and its applications in DC and AC circuits.', duration: '45 min', order: 1, isFree: true },
                { title: 'Series and Parallel Circuits', description: 'Analyzing circuits with series and parallel connections', type: 'article', content: 'Methods for solving series, parallel, and combination circuits.', duration: '60 min', order: 2, isFree: true },
                { title: 'Kirchhoff\'s Laws Practice', description: 'Hands-on practice with Kirchhoff\'s voltage and current laws', type: 'interactive', content: 'Work through real circuit problems using KVL and KCL.', duration: '90 min', order: 3, isFree: false },
              ],
            },
          },
          {
            title: 'Three-Phase Power Systems',
            description: 'Analysis and design of three-phase electrical systems',
            order: 2,
            duration: '14 hours',
            lessons: {
              create: [
                { title: 'Three-Phase System Fundamentals', description: 'Understanding three-phase voltage and current relationships', type: 'article', content: 'Introduction to three-phase systems, wye and delta configurations.', duration: '60 min', order: 1, isFree: true },
                { title: 'Power Calculations in Three-Phase', description: 'Active, reactive, and apparent power in three-phase systems', type: 'article', content: 'Calculating power in balanced and unbalanced three-phase systems.', duration: '75 min', order: 2, isFree: false },
                { title: 'Three-Phase Power Lab', description: 'Interactive calculation workshop', type: 'interactive', content: 'Hands-on three-phase power calculations and measurements.', duration: '90 min', order: 3, isFree: false },
              ],
            },
          },
          {
            title: 'Power Factor and Cable Sizing',
            description: 'Power factor correction and cable selection for power distribution',
            order: 3,
            duration: '12 hours',
            lessons: {
              create: [
                { title: 'Understanding Power Factor', description: 'Power factor concepts and correction methods', type: 'article', content: 'Causes of low power factor and methods for improvement.', duration: '45 min', order: 1, isFree: true },
                { title: 'Cable Sizing and Voltage Drop', description: 'Proper cable selection for power distribution', type: 'article', content: 'Step-by-step cable sizing procedure per IEC standards.', duration: '60 min', order: 2, isFree: false },
              ],
            },
          },
        ],
      },
    },
  })
  console.log(`  ✓ Electrical Power Systems course (3 modules, 8 lessons)`)

  // Course 2: Mechanical Design Fundamentals
  const mechanicalCourse = await prisma.course.create({
    data: {
      title: 'Mechanical Design Fundamentals',
      slug: 'mechanical-design-fundamentals',
      description: 'Master the core principles of mechanical design including stress analysis, material selection, beam design, and fluid mechanics fundamentals.',
      domain: 'mechanical',
      level: 'intermediate',
      duration: '35 hours',
      icon: 'Cog',
      rating: '4.6',
      enrolled: 980,
      order: 2,
      modules: {
        create: [
          {
            title: 'Stress and Strain Analysis',
            description: 'Understanding material behavior under loading',
            order: 1,
            duration: '12 hours',
            lessons: {
              create: [
                { title: 'Introduction to Stress and Strain', description: 'Fundamental concepts of stress, strain, and material properties', type: 'article', content: 'Normal stress, shear stress, and their relationship to deformation.', duration: '50 min', order: 1, isFree: true },
                { title: 'Stress-Strain Diagrams', description: 'Interpreting material test data', type: 'article', content: 'Understanding elastic region, yield point, and ultimate strength.', duration: '40 min', order: 2, isFree: true },
                { title: 'Stress Analysis Workshop', description: 'Practice problems in stress calculation', type: 'interactive', content: 'Work through real-world stress analysis problems.', duration: '90 min', order: 3, isFree: false },
              ],
            },
          },
          {
            title: 'Beam Design and Analysis',
            description: 'Design of beams for bending, shear, and deflection',
            order: 2,
            duration: '12 hours',
            lessons: {
              create: [
                { title: 'Bending Moment and Shear Force', description: 'Drawing and interpreting bending moment and shear force diagrams', type: 'article', content: 'Methods for constructing BM and SF diagrams for various loading conditions.', duration: '60 min', order: 1, isFree: true },
                { title: 'Beam Deflection Analysis', description: 'Calculating and limiting beam deflection', type: 'article', content: 'Double integration, moment-area, and conjugate beam methods.', duration: '75 min', order: 2, isFree: false },
              ],
            },
          },
          {
            title: 'Fluid Mechanics Essentials',
            description: 'Core fluid mechanics concepts for mechanical engineers',
            order: 3,
            duration: '11 hours',
            lessons: {
              create: [
                { title: 'Fluid Properties and Statics', description: 'Understanding fluid behavior at rest', type: 'article', content: 'Density, viscosity, pressure, and hydrostatic forces.', duration: '45 min', order: 1, isFree: true },
                { title: 'Reynolds Number and Flow Regimes', description: 'Characterizing laminar and turbulent flow', type: 'interactive', content: 'Calculate Reynolds numbers and predict flow behavior.', duration: '60 min', order: 2, isFree: false },
                { title: 'Pipe Flow Calculations', description: 'Pressure drop and flow rate in piping systems', type: 'article', content: 'Darcy-Weisbach equation and friction factor determination.', duration: '90 min', order: 3, isFree: false },
              ],
            },
          },
        ],
      },
    },
  })
  console.log(`  ✓ Mechanical Design Fundamentals course (3 modules, 8 lessons)`)

  // Course 3: HVAC System Design
  const hvacCourse = await prisma.course.create({
    data: {
      title: 'HVAC System Design',
      slug: 'hvac-system-design',
      description: 'Learn to design efficient HVAC systems from cooling load calculations to equipment selection and duct design. Based on ASHRAE standards and best practices.',
      domain: 'hvac',
      level: 'intermediate',
      duration: '45 hours',
      icon: 'Thermometer',
      rating: '4.7',
      enrolled: 870,
      order: 3,
      modules: {
        create: [
          {
            title: 'Cooling Load Fundamentals',
            description: 'Understanding and calculating building cooling loads',
            order: 1,
            duration: '16 hours',
            lessons: {
              create: [
                { title: 'Introduction to Cooling Loads', description: 'Overview of heat gain sources and cooling load concepts', type: 'article', content: 'Sensible vs latent heat, external vs internal gains.', duration: '40 min', order: 1, isFree: true },
                { title: 'Envelope Heat Transfer', description: 'Heat gain through walls, roofs, and windows', type: 'article', content: 'U-values, sol-air temperature, and CLTD method.', duration: '60 min', order: 2, isFree: true },
                { title: 'Cooling Load Calculation Lab', description: 'Hands-on cooling load calculation', type: 'interactive', content: 'Complete cooling load calculation for a sample building.', duration: '120 min', order: 3, isFree: false },
              ],
            },
          },
          {
            title: 'Psychrometrics and Air Processes',
            description: 'Understanding moist air properties and conditioning processes',
            order: 2,
            duration: '14 hours',
            lessons: {
              create: [
                { title: 'Psychrometric Chart Basics', description: 'Reading and using the psychrometric chart', type: 'article', content: 'Dry bulb, wet bulb, humidity ratio, and enthalpy relationships.', duration: '50 min', order: 1, isFree: true },
                { title: 'Air Conditioning Processes', description: 'Sensible heating, cooling, humidification, and dehumidification', type: 'article', content: 'Analyzing HVAC processes on the psychrometric chart.', duration: '70 min', order: 2, isFree: false },
              ],
            },
          },
          {
            title: 'Equipment Selection and Duct Design',
            description: 'Selecting HVAC equipment and designing air distribution',
            order: 3,
            duration: '15 hours',
            lessons: {
              create: [
                { title: 'Air Handling Unit Selection', description: 'Criteria for selecting AHUs and fan coils', type: 'article', content: 'Capacity, static pressure, efficiency, and noise considerations.', duration: '55 min', order: 1, isFree: false },
                { title: 'Duct Design Methods', description: 'Equal friction and static regain methods', type: 'article', content: 'Sizing ductwork for balanced air distribution.', duration: '65 min', order: 2, isFree: false },
                { title: 'HVAC Design Project', description: 'Complete HVAC design for a commercial building', type: 'interactive', content: 'Apply all concepts in a comprehensive design exercise.', duration: '180 min', order: 3, isFree: false },
              ],
            },
          },
        ],
      },
    },
  })
  console.log(`  ✓ HVAC System Design course (3 modules, 8 lessons)`)

  // Course 4: Structural Analysis
  const structuralCourse = await prisma.course.create({
    data: {
      title: 'Structural Analysis',
      slug: 'structural-analysis',
      description: 'Learn structural analysis from basic determinate structures to advanced indeterminate analysis. Covers influence lines, matrix methods, and practical applications.',
      domain: 'structural',
      level: 'advanced',
      duration: '50 hours',
      icon: 'Triangle',
      rating: '4.5',
      enrolled: 640,
      order: 4,
      modules: {
        create: [
          {
            title: 'Analysis of Determinate Structures',
            description: 'Methods for analyzing statically determinate beams and frames',
            order: 1,
            duration: '18 hours',
            lessons: {
              create: [
                { title: 'Support Reactions and Free Body Diagrams', description: 'Setting up and solving for support reactions', type: 'article', content: 'Types of supports, equilibrium equations, and FBD construction.', duration: '50 min', order: 1, isFree: true },
                { title: 'Internal Forces in Beams', description: 'Shear force and bending moment diagrams', type: 'article', content: 'Methods for constructing SFD and BMD for various loading conditions.', duration: '70 min', order: 2, isFree: true },
                { title: 'Beam Analysis Practice', description: 'Solve determinate beam problems', type: 'interactive', content: 'Practice problems with step-by-step solutions.', duration: '90 min', order: 3, isFree: false },
              ],
            },
          },
          {
            title: 'Deflection and Energy Methods',
            description: 'Calculating structural deflections using classical and energy methods',
            order: 2,
            duration: '16 hours',
            lessons: {
              create: [
                { title: 'Double Integration Method', description: 'Finding deflections using the moment-curvature relationship', type: 'article', content: 'Setting up and solving differential equations for beam deflection.', duration: '60 min', order: 1, isFree: false },
                { title: 'Virtual Work Method', description: 'Using principle of virtual work for deflections', type: 'article', content: 'Unit load method for beams, trusses, and frames.', duration: '75 min', order: 2, isFree: false },
              ],
            },
          },
          {
            title: 'Indeterminate Structures',
            description: 'Analysis of statically indeterminate structures',
            order: 3,
            duration: '16 hours',
            lessons: {
              create: [
                { title: 'Force Method Introduction', description: 'Analyzing indeterminate structures using compatibility', type: 'article', content: 'Choosing redundants and establishing compatibility conditions.', duration: '60 min', order: 1, isFree: false },
                { title: 'Moment Distribution Method', description: 'Iterative analysis for continuous beams and frames', type: 'article', content: 'Distribution factors, carry-over, and convergence.', duration: '80 min', order: 2, isFree: false },
                { title: 'Structural Analysis Capstone', description: 'Comprehensive analysis of a multi-story frame', type: 'interactive', content: 'Apply all methods to analyze a real-world structure.', duration: '150 min', order: 3, isFree: false },
              ],
            },
          },
        ],
      },
    },
  })
  console.log(`  ✓ Structural Analysis course (3 modules, 8 lessons)`)

  console.log(`  📊 Total courses created: 4`)

  // ========================================
  // 6. Unit Conversions (30+ entries)
  // ========================================
  console.log('🔄 Creating unit conversions...')

  const unitConversions = [
    // Length
    { category: 'Length', fromUnit: 'meter', toUnit: 'foot', factor: '3.28084', offset: '0', fromSymbol: 'm', toSymbol: 'ft' },
    { category: 'Length', fromUnit: 'meter', toUnit: 'inch', factor: '39.3701', offset: '0', fromSymbol: 'm', toSymbol: 'in' },
    { category: 'Length', fromUnit: 'meter', toUnit: 'millimeter', factor: '1000', offset: '0', fromSymbol: 'm', toSymbol: 'mm' },
    { category: 'Length', fromUnit: 'foot', toUnit: 'meter', factor: '0.3048', offset: '0', fromSymbol: 'ft', toSymbol: 'm' },
    { category: 'Length', fromUnit: 'inch', toUnit: 'millimeter', factor: '25.4', offset: '0', fromSymbol: 'in', toSymbol: 'mm' },

    // Mass
    { category: 'Mass', fromUnit: 'kilogram', toUnit: 'pound', factor: '2.20462', offset: '0', fromSymbol: 'kg', toSymbol: 'lb' },
    { category: 'Mass', fromUnit: 'pound', toUnit: 'kilogram', factor: '0.453592', offset: '0', fromSymbol: 'lb', toSymbol: 'kg' },
    { category: 'Mass', fromUnit: 'kilogram', toUnit: 'gram', factor: '1000', offset: '0', fromSymbol: 'kg', toSymbol: 'g' },
    { category: 'Mass', fromUnit: 'ton', toUnit: 'kilogram', factor: '1000', offset: '0', fromSymbol: 't', toSymbol: 'kg' },

    // Temperature
    { category: 'Temperature', fromUnit: 'celsius', toUnit: 'fahrenheit', factor: '1.8', offset: '32', fromSymbol: '°C', toSymbol: '°F' },
    { category: 'Temperature', fromUnit: 'fahrenheit', toUnit: 'celsius', factor: '0.555556', offset: '-17.7778', fromSymbol: '°F', toSymbol: '°C' },
    { category: 'Temperature', fromUnit: 'celsius', toUnit: 'kelvin', factor: '1', offset: '273.15', fromSymbol: '°C', toSymbol: 'K' },
    { category: 'Temperature', fromUnit: 'kelvin', toUnit: 'celsius', factor: '1', offset: '-273.15', fromSymbol: 'K', toSymbol: '°C' },
    { category: 'Temperature', fromUnit: 'fahrenheit', toUnit: 'kelvin', factor: '0.555556', offset: '255.372', fromSymbol: '°F', toSymbol: 'K' },

    // Pressure
    { category: 'Pressure', fromUnit: 'pascal', toUnit: 'bar', factor: '0.00001', offset: '0', fromSymbol: 'Pa', toSymbol: 'bar' },
    { category: 'Pressure', fromUnit: 'bar', toUnit: 'psi', factor: '14.5038', offset: '0', fromSymbol: 'bar', toSymbol: 'psi' },
    { category: 'Pressure', fromUnit: 'pascal', toUnit: 'psi', factor: '0.000145038', offset: '0', fromSymbol: 'Pa', toSymbol: 'psi' },
    { category: 'Pressure', fromUnit: 'psi', toUnit: 'pascal', factor: '6894.76', offset: '0', fromSymbol: 'psi', toSymbol: 'Pa' },
    { category: 'Pressure', fromUnit: 'atm', toUnit: 'pascal', factor: '101325', offset: '0', fromSymbol: 'atm', toSymbol: 'Pa' },

    // Power
    { category: 'Power', fromUnit: 'watt', toUnit: 'horsepower', factor: '0.00134102', offset: '0', fromSymbol: 'W', toSymbol: 'hp' },
    { category: 'Power', fromUnit: 'horsepower', toUnit: 'watt', factor: '745.7', offset: '0', fromSymbol: 'hp', toSymbol: 'W' },
    { category: 'Power', fromUnit: 'watt', toUnit: 'BTU/hr', factor: '3.41214', offset: '0', fromSymbol: 'W', toSymbol: 'BTU/hr' },
    { category: 'Power', fromUnit: 'BTU/hr', toUnit: 'watt', factor: '0.293071', offset: '0', fromSymbol: 'BTU/hr', toSymbol: 'W' },
    { category: 'Power', fromUnit: 'kilowatt', toUnit: 'watt', factor: '1000', offset: '0', fromSymbol: 'kW', toSymbol: 'W' },

    // Energy
    { category: 'Energy', fromUnit: 'joule', toUnit: 'BTU', factor: '0.000947817', offset: '0', fromSymbol: 'J', toSymbol: 'BTU' },
    { category: 'Energy', fromUnit: 'BTU', toUnit: 'joule', factor: '1055.06', offset: '0', fromSymbol: 'BTU', toSymbol: 'J' },
    { category: 'Energy', fromUnit: 'joule', toUnit: 'kWh', factor: '0.000000277778', offset: '0', fromSymbol: 'J', toSymbol: 'kWh' },
    { category: 'Energy', fromUnit: 'kWh', toUnit: 'joule', factor: '3600000', offset: '0', fromSymbol: 'kWh', toSymbol: 'J' },
    { category: 'Energy', fromUnit: 'calorie', toUnit: 'joule', factor: '4.184', offset: '0', fromSymbol: 'cal', toSymbol: 'J' },

    // Force
    { category: 'Force', fromUnit: 'newton', toUnit: 'pound-force', factor: '0.224809', offset: '0', fromSymbol: 'N', toSymbol: 'lbf' },
    { category: 'Force', fromUnit: 'pound-force', toUnit: 'newton', factor: '4.44822', offset: '0', fromSymbol: 'lbf', toSymbol: 'N' },
    { category: 'Force', fromUnit: 'kilonewton', toUnit: 'newton', factor: '1000', offset: '0', fromSymbol: 'kN', toSymbol: 'N' },
    { category: 'Force', fromUnit: 'newton', toUnit: 'kilogram-force', factor: '0.101972', offset: '0', fromSymbol: 'N', toSymbol: 'kgf' },

    // Volume
    { category: 'Volume', fromUnit: 'cubic meter', toUnit: 'liter', factor: '1000', offset: '0', fromSymbol: 'm³', toSymbol: 'L' },
    { category: 'Volume', fromUnit: 'liter', toUnit: 'gallon (US)', factor: '0.264172', offset: '0', fromSymbol: 'L', toSymbol: 'gal' },
    { category: 'Volume', fromUnit: 'gallon (US)', toUnit: 'liter', factor: '3.78541', offset: '0', fromSymbol: 'gal', toSymbol: 'L' },
    { category: 'Volume', fromUnit: 'cubic foot', toUnit: 'cubic meter', factor: '0.0283168', offset: '0', fromSymbol: 'ft³', toSymbol: 'm³' },
    { category: 'Volume', fromUnit: 'cubic meter', toUnit: 'cubic foot', factor: '35.3147', offset: '0', fromSymbol: 'm³', toSymbol: 'ft³' },
  ]

  for (const uc of unitConversions) {
    await prisma.unitConversion.create({ data: uc })
  }
  console.log(`  ✓ Created ${unitConversions.length} unit conversions across 8 categories`)

  // ========================================
  // Seed Complete Summary
  // ========================================
  console.log('\n🎉 Seed completed successfully!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  👤 Users:          1 (demo@engisuite.com)')
  console.log('  📂 Categories:     8')
  console.log('  📐 Equations:      21')
  console.log('  🔗 Pipelines:      6')
  console.log('  📚 Courses:        4')
  console.log('  🔄 Conversions:    ' + unitConversions.length)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
