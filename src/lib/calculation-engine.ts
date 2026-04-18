/**
 * Calculation Pipeline Engine - DAG-based execution for engineering calculations
 * Ported from original EngiSuite-Analytics backend
 */

import { getWorkflowsDb, query as dbQuery, queryOne as dbQueryOne } from './database'
import type { Database as SqlJsDatabase } from 'sql.js'

// Type definitions
interface CalculationStep {
  id: number
  pipeline_id: number
  step_id: string
  step_number: number
  name: string
  description: string | null
  standard_id: number | null
  formula_ref: string | null
  formula: string | null
  input_config: string | null
  output_config: string | null
  calculation_type: string | null
  precision: number | null
  step_type: string | null
  validation_config: string | null
  is_active: number
}

interface CalculationDependency {
  id: number
  pipeline_id: number
  step_id: number
  depends_on_step_id: number
  input_mapping: string | null
}

interface CalculationPipeline {
  id: number
  pipeline_id: string
  name: string
  description: string | null
  domain: string | null
  standard_id: number | null
  version: string | null
  estimated_time: number | null
  difficulty_level: string | null
  tags: string | null
  is_active: number
}

interface ExecutionContext {
  [key: string]: number | string | boolean | unknown
}

interface StepResult {
  success: boolean
  step_id: string
  name: string
  inputs: Record<string, unknown>
  outputs: Record<string, unknown>
  execution_time: string
  validation?: { passed: boolean; errors: string[]; validations_checked: number }
  error?: string
}

interface PipelineResult {
  success: boolean
  execution_id: string
  results: ExecutionContext
  status: string
  execution_time: string
  steps: Record<string, StepResult>
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

/**
 * Calculation Engine - DAG-based pipeline execution
 */
export class CalculationEngine {
  private mathFunctions: Record<string, unknown> = {
    sqrt: EngineeringCalculations.sqrt, sin: EngineeringCalculations.sin,
    cos: EngineeringCalculations.cos, tan: EngineeringCalculations.tan,
    asin: EngineeringCalculations.asin, acos: EngineeringCalculations.acos,
    atan: EngineeringCalculations.atan, log: EngineeringCalculations.log,
    ln: EngineeringCalculations.ln, exp: EngineeringCalculations.exp,
    pow: EngineeringCalculations.pow, abs: EngineeringCalculations.abs,
    round: EngineeringCalculations.round, ceil: EngineeringCalculations.ceil,
    floor: EngineeringCalculations.floor, max: EngineeringCalculations.max,
    min: EngineeringCalculations.min, sum: EngineeringCalculations.sum,
    avg: EngineeringCalculations.avg,
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
    PI: Math.PI, E: Math.E,
  }

  loadPipeline(pipelineId: string): CalculationPipeline | null {
    try {
      const results = dbQuery<CalculationPipeline>(getWorkflowsDb(),
        `SELECT * FROM calculation_pipelines WHERE pipeline_id = ? AND is_active = 1`, [pipelineId])
      return results[0] || null
    } catch { return null }
  }

  loadPipelineById(id: number): CalculationPipeline | null {
    try {
      const results = dbQuery<CalculationPipeline>(getWorkflowsDb(),
        `SELECT * FROM calculation_pipelines WHERE id = ? AND is_active = 1`, [id])
      return results[0] || null
    } catch { return null }
  }

  getSteps(pipelineDbId: number): CalculationStep[] {
    try {
      return dbQuery<CalculationStep>(getWorkflowsDb(),
        `SELECT * FROM calculation_steps WHERE pipeline_id = ? AND is_active = 1 ORDER BY step_number ASC`, [pipelineDbId])
    } catch { return [] }
  }

  getDependencies(pipelineDbId: number): CalculationDependency[] {
    try {
      return dbQuery<CalculationDependency>(getWorkflowsDb(),
        `SELECT cd.* FROM calculation_dependencies cd JOIN calculation_steps cs ON cd.step_id = cs.id WHERE cs.pipeline_id = ?`, [pipelineDbId])
    } catch { return [] }
  }

  buildExecutionOrder(steps: CalculationStep[], dependencies: CalculationDependency[]): string[] {
    const graph: Record<string, string[]> = {}
    const inDegree: Record<string, number> = {}

    for (const step of steps) {
      graph[step.step_id] = []
      inDegree[step.step_id] = 0
    }

    for (const dep of dependencies) {
      const fromStep = steps.find(s => s.id === dep.depends_on_step_id)
      const toStep = steps.find(s => s.id === dep.step_id)
      if (fromStep && toStep && fromStep.step_id !== toStep.step_id) {
        graph[fromStep.step_id].push(toStep.step_id)
        inDegree[toStep.step_id]++
      }
    }

    const queue: string[] = []
    const result: string[] = []

    for (const stepId in inDegree) {
      if (inDegree[stepId] === 0) queue.push(stepId)
    }

    while (queue.length > 0) {
      const current = queue.shift()!
      result.push(current)
      for (const neighbor of graph[current]) {
        inDegree[neighbor]--
        if (inDegree[neighbor] === 0) queue.push(neighbor)
      }
    }

    if (result.length !== steps.length) {
      throw new Error('Pipeline has cyclic dependencies - cannot execute')
    }

    return result
  }

  executePipeline(pipelineId: string, inputs: ExecutionContext): PipelineResult {
    const pipelineStart = performance.now()
    const executionId = `exec_${Date.now()}`

    const pipeline = this.loadPipeline(pipelineId)
    if (!pipeline) {
      return {
        success: false, execution_id: executionId, results: {},
        status: 'failed',
        execution_time: `${((performance.now() - pipelineStart) / 1000).toFixed(2)} seconds`,
        steps: {},
      }
    }

    const steps = this.getSteps(pipeline.id)
    const dependencies = this.getDependencies(pipeline.id)

    let executionOrder: string[]
    try {
      executionOrder = this.buildExecutionOrder(steps, dependencies)
    } catch {
      return {
        success: false, execution_id: executionId, results: {},
        status: 'failed',
        execution_time: `${((performance.now() - pipelineStart) / 1000).toFixed(2)} seconds`,
        steps: {},
      }
    }

    const stepResults: Record<string, StepResult> = {}
    const pipelineState: ExecutionContext = { ...inputs }
    const stepLookup: Record<string, CalculationStep> = {}
    for (const step of steps) stepLookup[step.step_id] = step

    let failed = false
    for (const stepId of executionOrder) {
      const step = stepLookup[stepId]
      if (!step) continue
      const stepResult = this.executeStep(step, pipelineState)
      stepResults[stepId] = stepResult
      if (!stepResult.success) { failed = true; break }
      if (stepResult.outputs) Object.assign(pipelineState, stepResult.outputs)
    }

    return {
      success: !failed,
      execution_id: executionId,
      results: pipelineState,
      status: failed ? 'failed' : 'completed',
      execution_time: `${((performance.now() - pipelineStart) / 1000).toFixed(2)} seconds`,
      steps: stepResults,
    }
  }

  private executeStep(step: CalculationStep, pipelineState: ExecutionContext): StepResult {
    const startTime = performance.now()
    try {
      const stepInputs = this.collectStepInputs(step, pipelineState)
      const calculationResult = this.executeFormulaCalculation(step, stepInputs)
      const executionTime = (performance.now() - startTime) / 1000
      return {
        success: true, step_id: step.step_id, name: step.name,
        inputs: stepInputs, outputs: calculationResult,
        execution_time: `${executionTime.toFixed(2)} seconds`,
      }
    } catch (error) {
      const executionTime = (performance.now() - startTime) / 1000
      return {
        success: false, step_id: step.step_id, name: step.name,
        inputs: {}, outputs: {},
        execution_time: `${executionTime.toFixed(2)} seconds`,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private collectStepInputs(step: CalculationStep, pipelineState: ExecutionContext): ExecutionContext {
    const stepInputs: ExecutionContext = {}
    if (step.input_config) {
      try {
        const inputConfig = typeof step.input_config === 'string'
          ? JSON.parse(step.input_config) : step.input_config
        const inputsList = inputConfig.inputs || inputConfig.coefficients || inputConfig
        if (Array.isArray(inputsList)) {
          for (const paramName of inputsList) {
            const name = typeof paramName === 'string' ? paramName : paramName.name
            if (name && name in pipelineState) stepInputs[name] = pipelineState[name]
          }
        }
      } catch { /* ignore */ }
    }
    return stepInputs
  }

  private executeFormulaCalculation(step: CalculationStep, inputs: ExecutionContext): ExecutionContext {
    if (!step.formula) throw new Error(`No formula defined for step '${step.name}'`)

    const context: ExecutionContext = { ...this.mathFunctions, ...inputs }
    const formula = step.formula
    const results: ExecutionContext = {}
    const formulas = formula.replace(/;/g, '\n').split('\n')

    for (const f of formulas) {
      const trimmed = f.trim()
      if (!trimmed) continue

      if (trimmed.includes('=') && !trimmed.includes('==')) {
        const parts = trimmed.split('=')
        if (parts.length >= 2) {
          const varName = parts[0].trim()
          const expr = parts.slice(1).join('=').trim()
          const result = evaluateFormula(expr, context)
          context[varName] = result
          results[varName] = result
        }
      } else {
        const result = evaluateFormula(trimmed, context)
        if (result !== null && result !== undefined) results['result'] = result
      }
    }

    // Filter to output config if available
    if (step.output_config) {
      try {
        const outputConfig = typeof step.output_config === 'string'
          ? JSON.parse(step.output_config) : step.output_config
        const outputNames = (outputConfig.outputs || outputConfig).map((o: any) => o.name || o.symbol || o)
        const filtered: ExecutionContext = {}
        for (const name of outputNames) {
          if (name in results) filtered[name] = results[name]
          else if (name in context) filtered[name] = context[name]
        }
        if (Object.keys(filtered).length > 0) return filtered
      } catch { /* return all */ }
    }

    return results
  }
}

// Singleton
let _calculationEngine: CalculationEngine | null = null

export function getCalculationEngine(): CalculationEngine {
  if (!_calculationEngine) _calculationEngine = new CalculationEngine()
  return _calculationEngine
}
