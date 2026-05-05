/**
 * Engineering Calculation Functions & Formula Evaluator
 * Dead code (CalculationEngine class + sql.js imports) removed for resource optimization.
 */

// Type definitions
interface ExecutionContext {
  [key: string]: number | string | boolean | unknown
}

/**
 * Engineering calculation functions
 */
export class EngineeringCalculations {
  static sqrt(value: number): number | null { return value >= 0 ? Math.sqrt(value) : null }
  static sin(value: number): number { return Math.sin(value * Math.PI / 180) }
  static cos(value: number): number { return Math.cos(value * Math.PI / 180) }
  static tan(value: number): number { return Math.tan(value * Math.PI / 180) }
  static asin(value: number): number { return Math.asin(value) * 180 / Math.PI }
  static acos(value: number): number { return Math.acos(value) * 180 / Math.PI }
  static atan(value: number): number { return Math.atan(value) * 180 / Math.PI }
  static log(value: number): number | null { return value > 0 ? Math.log10(value) : null }
  static ln(value: number): number | null { return value > 0 ? Math.log(value) : null }
  static exp(value: number): number { return Math.exp(value) }
  static pow(base: number, exp: number): number { return Math.pow(base, exp) }
  static abs(value: number): number { return Math.abs(value) }
  static round(value: number, decimals: number = 2): number {
    const factor = Math.pow(10, decimals)
    return Math.round(value * factor) / factor
  }
  static ceil(value: number): number { return Math.ceil(value) }
  static floor(value: number): number { return Math.floor(value) }
  static max(...args: number[]): number { return Math.max(...args) }
  static min(...args: number[]): number { return Math.min(...args) }
  static sum(values: number[]): number { return values.reduce((a, b) => a + b, 0) }
  static avg(values: number[]): number { return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0 }

  static select_cable(required_ampacity: number): number {
    const cableSizes = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400]
    const ampacities = [14, 18, 24, 31, 44, 56, 75, 92, 110, 140, 170, 195, 225, 260, 305, 350, 400]
    for (let i = 0; i < ampacities.length; i++) {
      if (ampacities[i] >= required_ampacity) return cableSizes[i]
    }
    return cableSizes[cableSizes.length - 1]
  }

  static select_standard_size(required_kva: number): number {
    const standardSizes = [15, 25, 30, 50, 75, 100, 150, 200, 250, 315, 400, 500, 630, 750, 1000, 1250, 1600, 2000, 2500]
    for (const size of standardSizes) {
      if (size >= required_kva) return size
    }
    return standardSizes[standardSizes.length - 1]
  }

  static next_standard_size(value: number): number {
    return EngineeringCalculations.select_standard_size(value)
  }

  static apply_demand_factor(total_connected: number): number {
    if (total_connected < 3000) return total_connected * 1.0
    if (total_connected < 12000) return total_connected * 0.8
    return total_connected * 0.7
  }

  static lookup_cu_table(rcr: number, wall_ref: number, ceil_ref: number): number {
    const cuTable: Record<string, number> = {
      '3,50,80': 0.62, '3,50,70': 0.58, '3,40,80': 0.55, '3,40,70': 0.52,
      '5,50,80': 0.50, '5,50,70': 0.47, '5,40,80': 0.45, '5,40,70': 0.42,
    }
    const key = `${Math.round(rcr)},${Math.round(wall_ref)},${Math.round(ceil_ref)}`
    return cuTable[key] || 0.40
  }

  static voltage_drop(current: number, length: number, resistance: number, voltage: number): number {
    const vd = (2 * length * current * resistance) / 1000
    return (vd / voltage) * 100
  }

  static pf_correction_capacitor(p: number, pf_initial: number, pf_target: number): number {
    const tanInitial = Math.tan(Math.acos(pf_initial))
    const tanTarget = Math.tan(Math.acos(pf_target))
    return p * (tanInitial - tanTarget)
  }

  static three_phase_power(voltage: number, current: number, power_factor: number): number {
    return Math.sqrt(3) * voltage * current * power_factor
  }

  static short_circuit_current(transformer_kva: number, transformer_impedance: number, voltage: number): number {
    return (transformer_kva * 1000) / (Math.sqrt(3) * voltage * (transformer_impedance / 100))
  }

  static beam_deflection(load: number, length: number, elasticity: number, inertia: number, loadType: string = 'udl'): number {
    if (loadType === 'udl') return (5 * load * Math.pow(length, 4)) / (384 * elasticity * inertia)
    return (load * Math.pow(length, 3)) / (48 * elasticity * inertia)
  }

  static bending_stress(moment: number, section_modulus: number): number { return moment / section_modulus }
  static shear_stress(shear_force: number, area: number): number { return shear_force / area }
  static reynolds_number(density: number, velocity: number, diameter: number, viscosity: number): number {
    return (density * velocity * diameter) / viscosity
  }

  static darcy_friction_factor(reynolds: number, roughness: number, diameter: number): number {
    if (reynolds < 2300) return 64 / reynolds
    const term1 = Math.pow(roughness / (3.7 * diameter), 10)
    const term2 = Math.pow(5.74 / Math.pow(reynolds, 0.9), 10)
    return Math.pow(-1.8 * Math.log10(term1 + term2), -2)
  }

  static pressure_drop(friction_factor: number, length: number, diameter: number, density: number, velocity: number): number {
    return friction_factor * (length / diameter) * (density * Math.pow(velocity, 2) / 2)
  }

  static heat_transfer_coefficient(reynolds: number, prandtl: number, thermal_conductivity: number, diameter: number): number {
    const nusselt = 0.023 * Math.pow(reynolds, 0.8) * Math.pow(prandtl, 0.4)
    return (nusselt * thermal_conductivity) / diameter
  }
}

/**
 * Enhanced formula evaluator with engineering functions
 */
export function evaluateFormula(formula: string, context: ExecutionContext = {}): number {
  const safeContext: ExecutionContext = {
    PI: Math.PI, E: Math.E,
    sqrt: Math.sqrt,
    sin: (v: number) => Math.sin(v * Math.PI / 180),
    cos: (v: number) => Math.cos(v * Math.PI / 180),
    tan: (v: number) => Math.tan(v * Math.PI / 180),
    asin: (v: number) => Math.asin(v) * 180 / Math.PI,
    acos: (v: number) => Math.acos(v) * 180 / Math.PI,
    atan: (v: number) => Math.atan(v) * 180 / Math.PI,
    log: Math.log10, ln: Math.log, exp: Math.exp,
    pow: Math.pow, abs: Math.abs, round: Math.round,
    ceil: Math.ceil, floor: Math.floor, max: Math.max, min: Math.min,
    select_cable: EngineeringCalculations.select_cable,
    select_standard_size: EngineeringCalculations.select_standard_size,
    next_standard_size: EngineeringCalculations.next_standard_size,
    apply_demand_factor: EngineeringCalculations.apply_demand_factor,
    lookup_cu_table: EngineeringCalculations.lookup_cu_table,
    voltage_drop: EngineeringCalculations.voltage_drop,
    pf_correction_capacitor: EngineeringCalculations.pf_correction_capacitor,
    three_phase_power: EngineeringCalculations.three_phase_power,
    short_circuit_current: EngineeringCalculations.short_circuit_current,
    beam_deflection: EngineeringCalculations.beam_deflection,
    bending_stress: EngineeringCalculations.bending_stress,
    shear_stress: EngineeringCalculations.shear_stress,
    reynolds_number: EngineeringCalculations.reynolds_number,
    darcy_friction_factor: EngineeringCalculations.darcy_friction_factor,
    pressure_drop: EngineeringCalculations.pressure_drop,
    heat_transfer_coefficient: EngineeringCalculations.heat_transfer_coefficient,
    ...context,
  }

  let evaluableFormula = formula
    .replace(/\^/g, '**')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/π/g, 'PI')

  // Replace context variables that are numbers
  for (const [key, value] of Object.entries(safeContext)) {
    if (typeof value === 'number' || typeof value === 'string') {
      const regex = new RegExp(`\\b${key}\\b`, 'g')
      evaluableFormula = evaluableFormula.replace(regex, String(value))
    }
  }

  try {
    const contextKeys = Object.keys(safeContext)
    const contextValues = Object.values(safeContext)
    const fn = new Function(...contextKeys, `return (${evaluableFormula})`)
    const result = fn(...contextValues)
    return Number(result) || 0
  } catch {
    return 0
  }
}
