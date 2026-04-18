import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Common engineering variable units mapping
const variableUnits: Record<string, { unit: string; description: string; default: number }> = {
  // Electrical
  'V': { unit: 'V', description: 'Voltage', default: 400 },
  'I': { unit: 'A', description: 'Current', default: 100 },
  'R': { unit: 'Ω', description: 'Resistance', default: 10 },
  'P': { unit: 'W', description: 'Power', default: 1000 },
  'PF': { unit: '', description: 'Power Factor', default: 0.85 },
  'cos_φ': { unit: '', description: 'Power Factor', default: 0.85 },
  'Z': { unit: 'Ω', description: 'Impedance', default: 10 },
  'X': { unit: 'Ω', description: 'Reactance', default: 5 },
  'L': { unit: 'm', description: 'Length / Inductance', default: 100 },
  'f': { unit: 'Hz', description: 'Frequency', default: 50 },
  'A': { unit: 'mm²', description: 'Cross-section Area', default: 25 },
  'rho': { unit: 'Ω·mm²/m', description: 'Resistivity', default: 0.0175 },
  'k': { unit: '', description: 'Factor / Coefficient', default: 1 },
  'k_temp': { unit: '', description: 'Temperature Derating Factor', default: 0.91 },
  'k_group': { unit: '', description: 'Grouping Factor', default: 0.8 },
  'k_install': { unit: '', description: 'Installation Factor', default: 0.9 },
  'I_base': { unit: 'A', description: 'Base Current', default: 100 },
  'R_dc': { unit: 'Ω', description: 'DC Resistance', default: 1.15 },
  'R_ac': { unit: 'Ω', description: 'AC Resistance', default: 1.3 },
  'y_s': { unit: '', description: 'Skin Effect Factor', default: 0.01 },
  'y_p': { unit: '', description: 'Proximity Effect Factor', default: 0.01 },
  'VD_allowable': { unit: 'V', description: 'Allowable Voltage Drop', default: 11.5 },
  'I_sc': { unit: 'A', description: 'Short Circuit Current', default: 10000 },
  'K': { unit: '', description: 'Constant', default: 143 },
  't': { unit: 's', description: 'Time', default: 1 },
  's': { unit: 'mm', description: 'Spacing', default: 20 },
  'd': { unit: 'mm', description: 'Diameter', default: 10 },
  'D': { unit: 'm', description: 'Diameter / Distance', default: 0.1 },
  'J': { unit: 'A/mm²', description: 'Current Density', default: 4 },
  'T_max': { unit: '°C', description: 'Max Temperature', default: 90 },
  'T_amb': { unit: '°C', description: 'Ambient Temperature', default: 30 },
  'T_ref': { unit: '°C', description: 'Reference Temperature', default: 30 },
  'n': { unit: '', description: 'Count / Number', default: 2 },
  'PI': { unit: '', description: 'Pi (3.14159)', default: 3.14159 },
  // Mechanical
  'F': { unit: 'N', description: 'Force', default: 1000 },
  'v': { unit: 'm/s', description: 'Velocity', default: 2 },
  'm': { unit: 'kg', description: 'Mass', default: 10 },
  'g': { unit: 'm/s²', description: 'Gravity', default: 9.81 },
  'W': { unit: 'J', description: 'Work / Energy', default: 100 },
  'Q': { unit: 'W', description: 'Heat / Flow Rate', default: 1000 },
  'T': { unit: '°C', description: 'Temperature', default: 25 },
  'h': { unit: 'W/(m²·K)', description: 'Heat Transfer Coefficient', default: 10 },
  'Re': { unit: '', description: 'Reynolds Number', default: 10000 },
  'Nu': { unit: '', description: 'Nusselt Number', default: 100 },
  'Pr': { unit: '', description: 'Prandtl Number', default: 7 },
  'mu': { unit: 'Pa·s', description: 'Dynamic Viscosity', default: 0.001 },
  'epsilon': { unit: '', description: 'Roughness', default: 0.0001 },
  'delta': { unit: 'm', description: 'Deflection / Thickness', default: 0.01 },
  'sigma': { unit: 'Pa', description: 'Stress', default: 250000000 },
  'E': { unit: 'Pa', description: 'Young Modulus / Energy', default: 200000000000 },
  'w': { unit: 'N/m', description: 'Distributed Load', default: 10000 },
  // Civil
  'M': { unit: 'N·m', description: 'Moment', default: 10000 },
  'b': { unit: 'm', description: 'Width', default: 0.3 },
  'fc': { unit: 'Pa', description: 'Concrete Strength', default: 30000000 },
  'fy': { unit: 'Pa', description: 'Yield Strength', default: 400000000 },
  'As': { unit: 'm²', description: 'Steel Area', default: 0.001 },
  'q': { unit: 'kPa', description: 'Pressure / Load', default: 150 },
  'N': { unit: '', description: 'Count / Force', default: 10 },
  // General
  'r': { unit: 'm', description: 'Radius', default: 0.5 },
  'theta': { unit: 'rad', description: 'Angle', default: 0.785 },
  'alpha': { unit: '', description: 'Coefficient', default: 1 },
  'beta': { unit: '', description: 'Coefficient', default: 1 },
  'gamma': { unit: '', description: 'Coefficient', default: 1 },
  'eta': { unit: '', description: 'Efficiency', default: 0.9 },
}

// Common output mappings
const outputUnits: Record<string, { unit: string; description: string }> = {
  'V': { unit: 'V', description: 'Voltage' },
  'I': { unit: 'A', description: 'Current' },
  'R': { unit: 'Ω', description: 'Resistance' },
  'P': { unit: 'W', description: 'Power' },
  'Z': { unit: 'Ω', description: 'Impedance' },
  'X': { unit: 'Ω', description: 'Reactance' },
  'A': { unit: 'mm²', description: 'Area' },
  'J': { unit: 'A/mm²', description: 'Current Density' },
  'F': { unit: 'N', description: 'Force' },
  'Q': { unit: 'W', description: 'Heat / Flow' },
  'Re': { unit: '', description: 'Reynolds Number' },
  'delta': { unit: 'm', description: 'Deflection' },
  'sigma': { unit: 'Pa', description: 'Stress' },
  'M': { unit: 'N·m', description: 'Moment' },
  'VD': { unit: 'V', description: 'Voltage Drop' },
  'k_temp': { unit: '', description: 'Temperature Factor' },
  'k_group': { unit: '', description: 'Grouping Factor' },
  'I_sc': { unit: 'A', description: 'Short Circuit Current' },
  'I_req': { unit: 'A', description: 'Required Current' },
  'R_ac': { unit: 'Ω', description: 'AC Resistance' },
  'L': { unit: 'mH', description: 'Inductance' },
  'C': { unit: 'μF', description: 'Capacitance' },
}

function extractVariables(formula: string): string[] {
  // Extract variable names from formula
  // Remove numbers, operators, functions, and constants
  let cleaned = formula
    .replace(/\d+\.?\d*/g, '') // Remove numbers
    .replace(/[+\-*/^=()\\[\]{},;:<>!|&?]/g, ' ') // Remove operators
    .replace(/\b(sqrt|sin|cos|tan|log|ln|exp|abs|PI|pi)\b/gi, ' ') // Remove functions
    .replace(/\\frac|\\sqrt|\\times|\\cdot|\\ln|\\log|\\sin|\\cos|\\tan/g, ' ') // Remove LaTeX
    .replace(/[{}_]/g, ' ') // Remove LaTeX braces

  // Find all word tokens (variable names)
  const tokens = cleaned.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || []
  
  // Filter out common constants and function names
  const exclude = new Set(['PI', 'pi', 'e', 'sqrt', 'sin', 'cos', 'tan', 'log', 'ln', 'exp', 'abs', 'max', 'min', 'undefined', 'NaN', 'Infinity'])
  
  // Deduplicate while preserving order
  const seen = new Set<string>()
  const vars: string[] = []
  for (const token of tokens) {
    if (!exclude.has(token) && !seen.has(token)) {
      seen.add(token)
      vars.push(token)
    }
  }
  return vars
}

function extractOutput(formula: string): string | null {
  // If formula has form "X = ...", extract X as the output
  const match = formula.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=/)
  return match ? match[1] : null
}

async function main() {
  console.log('🔧 Auto-generating equation inputs and outputs...\n')

  const equations = await prisma.equation.findMany({
    include: {
      inputs: true,
      outputs: true,
    },
  })

  let generated = 0
  let skipped = 0

  for (const eq of equations) {
    // Skip equations that already have inputs
    if (eq.inputs.length > 0) {
      skipped++
      continue
    }

    const formula = eq.formula
    if (!formula) {
      skipped++
      continue
    }

    // Extract output variable
    const outputVar = extractOutput(formula)
    
    // Extract input variables (all variables except the output)
    const allVars = extractVariables(formula)
    const inputVars = allVars.filter(v => v !== outputVar)

    if (inputVars.length === 0 && !outputVar) {
      skipped++
      continue
    }

    // Create inputs
    let order = 0
    for (const varName of inputVars) {
      const known = variableUnits[varName]
      await prisma.equationInput.create({
        data: {
          name: known?.description || varName,
          symbol: varName,
          description: known?.description || `Variable ${varName}`,
          dataType: 'number',
          unit: known?.unit || null,
          required: true,
          defaultVal: known?.default?.toString() || null,
          order: order++,
          equationId: eq.id,
        },
      })
    }

    // Create output
    if (outputVar) {
      const knownOutput = outputUnits[outputVar]
      await prisma.equationOutput.create({
        data: {
          name: knownOutput?.description || outputVar,
          symbol: outputVar,
          description: knownOutput?.description || `Result ${outputVar}`,
          dataType: 'number',
          unit: knownOutput?.unit || null,
          formula: outputVar,
          order: 0,
          precision: 4,
          equationId: eq.id,
        },
      })
    }

    generated++
    if (generated % 50 === 0) {
      console.log(`  Generated ${generated} equation definitions...`)
    }
  }

  console.log(`\n✅ Generated inputs/outputs for ${generated} equations (${skipped} skipped)`)
}

main()
  .catch((e) => {
    console.error('❌ Generation failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
