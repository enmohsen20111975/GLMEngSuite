'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Label } from '@/components/ui/label'
import {
  Search, Play, BookOpen, RotateCcw, Zap, ChevronRight,
  CheckCircle2, Info, Variable, ArrowRightLeft, AlertCircle,
  Sparkles, Calculator, RefreshCw, X
} from 'lucide-react'

// ============== Types (matching DB schema) ==============
interface EquationInput {
  id: number
  equation_id: number
  name: string
  symbol: string
  description: string | null
  data_type: string | null
  unit: string | null
  required: number | null
  default_value: number | null
  min_value: number | null
  max_value: number | null
  input_order: number | null
  placeholder: string | null
  help_text: string | null
}

interface EquationOutput {
  id: number
  equation_id: number
  name: string
  symbol: string
  description: string | null
  data_type: string | null
  unit: string | null
  output_order: number | null
  precision: number | null
  format_string: string | null
}

interface Equation {
  id: number
  equation_id: string
  name: string
  description: string
  domain: string
  equation: string
  equation_latex: string
  difficulty_level: string
  tags: string
  category_name: string
  category_slug: string
  inputs: EquationInput[]
  outputs: EquationOutput[]
}

// ============== Unified Variable Descriptor ==============
// Merges DB inputs/outputs into a single flat list of "variables"
// that can each be edited. The formula is ONLY used for evaluation.
interface VariableDescriptor {
  symbol: string
  name: string
  unit: string
  description: string
  helpText: string
  placeholder: string
  isOutput: boolean
  defaultValue: number | null
  minValue: number | null
  maxValue: number | null
  precision: number
  formatString: string | null
  order: number
  dbSource: 'input' | 'output' | 'fallback'
}

// ============== Formula Variable Parser (FALLBACK) ==============
// Only used when DB inputs/outputs are empty
function parseFormulaVariables(formula: string): { outputs: string[]; inputs: string[] } {
  if (!formula) return { outputs: [], inputs: [] }

  const knownFunctions = new Set([
    'sqrt', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'log', 'ln', 'exp',
    'pow', 'abs', 'round', 'ceil', 'floor', 'max', 'min', 'sum', 'avg',
    'select_cable', 'select_standard_size', 'next_standard_size', 'apply_demand_factor',
    'lookup_cu_table', 'voltage_drop', 'pf_correction_capacitor', 'three_phase_power',
    'short_circuit_current', 'beam_deflection', 'bending_stress', 'shear_stress',
    'reynolds_number', 'darcy_friction_factor', 'pressure_drop', 'heat_transfer_coefficient',
    'PI', 'E',
  ])

  const allVariables = new Set<string>()
  const outputVariables = new Set<string>()

  const statements = formula.replace(/;/g, '\n').split('\n').map(s => s.trim()).filter(Boolean)

  for (const stmt of statements) {
    const assignMatch = stmt.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/)
    if (assignMatch) {
      const varName = assignMatch[1]
      outputVariables.add(varName)
      const rhs = assignMatch[2]
      const rhsVars = rhs.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || []
      rhsVars.forEach(v => {
        if (!knownFunctions.has(v)) allVariables.add(v)
      })
    } else {
      const vars = stmt.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || []
      vars.forEach(v => {
        if (!knownFunctions.has(v)) allVariables.add(v)
      })
    }
  }

  outputVariables.forEach(v => allVariables.add(v))

  const inputs = [...allVariables].filter(v => !outputVariables.has(v))
  const outputs = [...outputVariables]

  if (outputs.length === 0 && allVariables.size > 0) {
    const commonOutputPatterns = ['VD', 'P', 'I', 'R', 'Z', 'X', 'L', 'C', 'J', 'k', 'A', 'Re', 'delta', 'Q', 'S']
    for (const pattern of commonOutputPatterns) {
      if (allVariables.has(pattern)) {
        outputs.push(pattern)
        const idx = inputs.indexOf(pattern)
        if (idx >= 0) inputs.splice(idx, 1)
        break
      }
    }
  }

  return { outputs, inputs }
}

// ============== Client-side Expression Evaluator ==============
function clientEval(expr: string, context: Record<string, number>): number {
  const safeContext: Record<string, unknown> = {
    PI: Math.PI, E: Math.E,
    sqrt: Math.sqrt, sin: (v: number) => Math.sin(v * Math.PI / 180),
    cos: (v: number) => Math.cos(v * Math.PI / 180), tan: (v: number) => Math.tan(v * Math.PI / 180),
    log: Math.log10, ln: Math.log, exp: Math.exp,
    pow: Math.pow, abs: Math.abs, round: Math.round,
    ceil: Math.ceil, floor: Math.floor, max: Math.max, min: Math.min,
    ...context,
  }

  let processed = expr.replace(/\^/g, '**').replace(/×/g, '*').replace(/÷/g, '/').replace(/π/g, 'PI')

  try {
    const keys = Object.keys(safeContext)
    const vals = Object.values(safeContext)
    const fn = new Function(...keys, `return (${processed})`)
    const result = fn(...vals)
    const num = Number(result)
    if (isNaN(num) || !isFinite(num)) return NaN
    return num
  } catch {
    return NaN
  }
}

// ============== Numerical Solver (Bisection) ==============
function numericalSolve(
  expression: string,
  knownValues: Record<string, number>,
  unknownVar: string,
  targetOutput: number,
  tolerance: number = 1e-6,
  maxIter: number = 200
): number | null {
  // Determine reasonable bounds
  let low = -1e10, high = 1e10

  const vals = Object.values(knownValues)
  if (vals.length > 0) {
    const maxAbs = Math.max(...vals.map(Math.abs), 1)
    low = -maxAbs * 10000
    high = maxAbs * 10000
  }

  const evalAt = (x: number): number => {
    const ctx = { ...knownValues, [unknownVar]: x }
    return clientEval(expression, ctx)
  }

  // Check if we can find a sign change
  let fLow = evalAt(low) - targetOutput
  let fHigh = evalAt(high) - targetOutput

  // If same sign, try narrower bounds progressively
  if (fLow * fHigh > 0) {
    const ranges = [[-1e6, 1e6], [-1e3, 1e3], [-100, 100], [0, 1e6], [0, 1e3], [0.001, 100]]
    for (const [lo, hi] of ranges) {
      low = lo; high = hi
      fLow = evalAt(low) - targetOutput
      fHigh = evalAt(high) - targetOutput
      if (fLow * fHigh <= 0) break
    }
    if (fLow * fHigh > 0) return null
  }

  // Bisection loop
  for (let i = 0; i < maxIter; i++) {
    const mid = (low + high) / 2
    const fMid = evalAt(mid) - targetOutput

    if (Math.abs(fMid) < tolerance) return mid
    if (!isFinite(fMid)) return null

    if (fMid * fLow < 0) {
      high = mid
      fHigh = fMid
    } else {
      low = mid
      fLow = fMid
    }
  }

  return (low + high) / 2
}

// ============== Evaluate Full Formula (all statements) ==============
function evaluateFullFormula(formula: string, context: Record<string, number>): Record<string, number> {
  const outputs: Record<string, number> = {}
  const statements = formula.replace(/;/g, '\n').split('\n').map(s => s.trim()).filter(Boolean)

  for (const stmt of statements) {
    const assignMatch = stmt.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/)
    if (assignMatch) {
      const varName = assignMatch[1]
      const rhs = assignMatch[2]
      try {
        const result = clientEval(rhs, context)
        if (!isNaN(result)) {
          context[varName] = result
          outputs[varName] = result
        }
      } catch { /* skip */ }
    } else {
      try {
        const result = clientEval(stmt, context)
        if (!isNaN(result)) {
          outputs['result'] = result
        }
      } catch { /* skip */ }
    }
  }

  return outputs
}

// ============== Solve for a single unknown ==============
function solveForUnknown(
  formula: string,
  knownValues: Record<string, number>,
  unknownVar: string
): number | null {
  const statements = formula.replace(/;/g, '\n').split('\n').map(s => s.trim()).filter(Boolean)
  const knownFunctions = new Set(['sqrt', 'sin', 'cos', 'tan', 'log', 'ln', 'exp', 'pow', 'abs', 'round', 'ceil', 'floor', 'max', 'min', 'PI', 'E'])

  for (const stmt of statements) {
    const assignMatch = stmt.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/)
    if (assignMatch) {
      const varName = assignMatch[1]
      const rhs = assignMatch[2]

      // Direct: unknown is the LHS output variable
      if (varName === unknownVar) {
        try {
          const result = clientEval(rhs, knownValues)
          if (!isNaN(result) && isFinite(result)) return result
        } catch { /* try next */ }
      }

      // Reverse: unknown appears in the RHS, and the LHS is known
      const rhsVars = rhs.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || []
      if (rhsVars.includes(unknownVar) && varName in knownValues) {
        const result = numericalSolve(rhs, knownValues, unknownVar, knownValues[varName])
        if (result !== null && isFinite(result)) return result
      }
    }
  }

  return null
}

// ============== Helper: Guess unit from symbol (fallback) ==============
function guessUnit(symbol: string): string {
  const unitMap: Record<string, string> = {
    'I': 'A', 'V': 'V', 'R': 'Ω', 'P': 'W', 'Q': 'VAR', 'S': 'VA',
    'L': 'm', 'A': 'mm²', 'd': 'mm', 'D': 'mm', 'f': 'Hz', 't': 's',
    'T': '°C', 'rho': 'Ω·mm²/m', 'J': 'A/mm²', 'k': '',
    'VD': 'V', 'VD_allowable': 'V', 'X': 'Ω', 'Z': 'Ω',
    'Re': '', 'delta': 'm', 'C': 'F', 'VD_percent': '%',
    'I_base': 'A', 'R_dc': 'Ω/km', 'R_ac': 'Ω/km',
  }
  return unitMap[symbol] || ''
}

// ============== Build Variable Descriptors from DB + fallback ==============
function buildVariableDescriptors(eq: Equation): VariableDescriptor[] {
  const descriptors: VariableDescriptor[] = []
  const seenSymbols = new Set<string>()

  // PRIMARY: DB inputs
  if (eq.inputs && eq.inputs.length > 0) {
    for (const inp of eq.inputs) {
      const symbol = inp.symbol || inp.name
      if (seenSymbols.has(symbol)) continue
      seenSymbols.add(symbol)
      descriptors.push({
        symbol,
        name: inp.name || symbol,
        unit: inp.unit || '',
        description: inp.description || '',
        helpText: inp.help_text || '',
        placeholder: inp.placeholder || `Enter ${inp.name || symbol}`,
        isOutput: false,
        defaultValue: inp.default_value ?? null,
        minValue: inp.min_value ?? null,
        maxValue: inp.max_value ?? null,
        precision: 4,
        formatString: null,
        order: inp.input_order ?? descriptors.length,
        dbSource: 'input',
      })
    }
  }

  // PRIMARY: DB outputs
  if (eq.outputs && eq.outputs.length > 0) {
    for (const out of eq.outputs) {
      const symbol = out.symbol || out.name
      if (seenSymbols.has(symbol)) continue
      seenSymbols.add(symbol)
      descriptors.push({
        symbol,
        name: out.name || symbol,
        unit: out.unit || '',
        description: out.description || '',
        helpText: '',
        placeholder: `Calculated`,
        isOutput: true,
        defaultValue: null,
        minValue: null,
        maxValue: null,
        precision: out.precision ?? 4,
        formatString: out.format_string ?? null,
        order: (out.output_order ?? 0) + 100, // outputs come after inputs
        dbSource: 'output',
      })
    }
  }

  // FALLBACK: If DB has no inputs/outputs, parse the formula
  if (descriptors.length === 0 && eq.equation) {
    const parsed = parseFormulaVariables(eq.equation)
    for (const sym of parsed.inputs) {
      if (seenSymbols.has(sym)) continue
      seenSymbols.add(sym)
      descriptors.push({
        symbol: sym,
        name: sym,
        unit: guessUnit(sym),
        description: '',
        helpText: '',
        placeholder: `Enter ${sym}`,
        isOutput: false,
        defaultValue: null,
        minValue: null,
        maxValue: null,
        precision: 4,
        formatString: null,
        order: descriptors.length,
        dbSource: 'fallback',
      })
    }
    for (const sym of parsed.outputs) {
      if (seenSymbols.has(sym)) continue
      seenSymbols.add(sym)
      descriptors.push({
        symbol: sym,
        name: sym,
        unit: guessUnit(sym),
        description: '',
        helpText: '',
        placeholder: 'Calculated',
        isOutput: true,
        defaultValue: null,
        minValue: null,
        maxValue: null,
        precision: 4,
        formatString: null,
        order: descriptors.length,
        dbSource: 'fallback',
      })
    }
  }

  // Also check for formula variables not in DB and add them as fallback
  if (eq.equation && descriptors.length > 0) {
    const parsed = parseFormulaVariables(eq.equation)
    const allParsed = [...parsed.inputs, ...parsed.outputs]
    for (const sym of allParsed) {
      if (!seenSymbols.has(sym)) {
        seenSymbols.add(sym)
        const isOutput = parsed.outputs.includes(sym)
        descriptors.push({
          symbol: sym,
          name: sym,
          unit: guessUnit(sym),
          description: '',
          helpText: '',
          placeholder: isOutput ? 'Calculated' : `Enter ${sym}`,
          isOutput,
          defaultValue: null,
          minValue: null,
          maxValue: null,
          precision: 4,
          formatString: null,
          order: descriptors.length,
          dbSource: 'fallback',
        })
      }
    }
  }

  return descriptors.sort((a, b) => a.order - b.order)
}

// ============== Component ==============
export function CalculatorsSection() {
  const [equations, setEquations] = useState<Equation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [domain, setDomain] = useState('all')
  const [selectedEq, setSelectedEq] = useState<Equation | null>(null)

  // Calculator state
  const [variableValues, setVariableValues] = useState<Record<string, string>>({})
  const [autoCalculated, setAutoCalculated] = useState<Record<string, boolean>>({})
  const [manuallyOverridden, setManuallyOverridden] = useState<Record<string, boolean>>({})
  const [solveError, setSolveError] = useState<string | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const lastEditedRef = useRef<string | null>(null)

  // Build variable descriptors from DB (primary) + formula fallback
  const variables = useMemo(() => {
    if (!selectedEq) return []
    return buildVariableDescriptors(selectedEq)
  }, [selectedEq])

  const inputVars = useMemo(() => variables.filter(v => !v.isOutput), [variables])
  const outputVars = useMemo(() => variables.filter(v => v.isOutput), [variables])

  // Fetch equations from API
  const fetchEquations = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (domain !== 'all') params.set('domain', domain)
      params.set('limit', '200')
      const res = await fetch(`/api/equations?${params}`)
      const data = await res.json()
      if (data.success) setEquations(data.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [search, domain])

  useEffect(() => { fetchEquations() }, [fetchEquations])

  // Select an equation and initialize fields
  const handleSelectEquation = useCallback((eq: Equation) => {
    setSelectedEq(eq)
    setAutoCalculated({})
    setManuallyOverridden({})
    setSolveError(null)
    lastEditedRef.current = null

    const descriptors = buildVariableDescriptors(eq)
    const defaults: Record<string, string> = {}

    for (const v of descriptors) {
      if (v.isOutput) {
        defaults[v.symbol] = '' // outputs start empty
      } else if (v.defaultValue !== null && v.defaultValue !== undefined) {
        defaults[v.symbol] = String(v.defaultValue)
      } else {
        defaults[v.symbol] = ''
      }
    }

    setVariableValues(defaults)
  }, [])

  // Handle value change in any field
  const handleValueChange = useCallback((symbol: string, value: string) => {
    setVariableValues(prev => ({ ...prev, [symbol]: value }))
    lastEditedRef.current = symbol

    // If user manually types in an output field, mark it as manually overridden
    const isOutputVar = outputVars.some(v => v.symbol === symbol)
    if (isOutputVar && value !== '') {
      setAutoCalculated(prev => ({ ...prev, [symbol]: false }))
      setManuallyOverridden(prev => ({ ...prev, [symbol]: true }))
    } else {
      setManuallyOverridden(prev => ({ ...prev, [symbol]: false }))
    }

    setSolveError(null)
  }, [outputVars])

  // Core calculation logic
  const calculate = useCallback(() => {
    if (!selectedEq?.equation || variables.length === 0) return

    const numValues: Record<string, number> = {}
    const emptyVars: string[] = []

    for (const v of variables) {
      const val = variableValues[v.symbol]
      if (val !== '' && val !== null && val !== undefined) {
        const num = Number(val)
        if (!isNaN(num) && isFinite(num)) {
          numValues[v.symbol] = num
        } else {
          emptyVars.push(v.symbol)
        }
      } else {
        emptyVars.push(v.symbol)
      }
    }

    // CASE 1: No empty variables - just recalculate outputs from inputs
    if (emptyVars.length === 0) {
      try {
        const results = evaluateFullFormula(selectedEq.equation, { ...numValues })
        const newAuto: Record<string, boolean> = {}
        const newValues = { ...variableValues }

        for (const v of outputVars) {
          if (results[v.symbol] !== undefined && !manuallyOverridden[v.symbol]) {
            const prec = v.precision || 4
            newValues[v.symbol] = String(Math.round(results[v.symbol] * Math.pow(10, prec)) / Math.pow(10, prec))
            newAuto[v.symbol] = true
          }
        }

        setVariableValues(newValues)
        setAutoCalculated(prev => ({ ...prev, ...newAuto }))
        setSolveError(null)
      } catch (err) {
        setSolveError('Calculation error: ' + (err instanceof Error ? err.message : String(err)))
      }
      return
    }

    // CASE 2: Exactly one empty variable - solve for it
    if (emptyVars.length === 1) {
      const unknown = emptyVars[0]
      const unknownDescriptor = variables.find(v => v.symbol === unknown)
      const isOutputUnknown = unknownDescriptor?.isOutput ?? false

      // Forward solve: unknown is an output
      if (isOutputUnknown) {
        try {
          const results = evaluateFullFormula(selectedEq.equation, { ...numValues })
          if (results[unknown] !== undefined && !isNaN(results[unknown]) && isFinite(results[unknown])) {
            const prec = unknownDescriptor?.precision || 4
            const rounded = Math.round(results[unknown] * Math.pow(10, prec)) / Math.pow(10, prec)
            setVariableValues(prev => ({ ...prev, [unknown]: String(rounded) }))
            setAutoCalculated(prev => ({ ...prev, [unknown]: true }))
            setManuallyOverridden(prev => ({ ...prev, [unknown]: false }))
            // Also fill any other outputs
            const newValues: Record<string, string> = {}
            const newAuto: Record<string, boolean> = {}
            for (const v of outputVars) {
              if (v.symbol !== unknown && results[v.symbol] !== undefined && !manuallyOverridden[v.symbol]) {
                const p = v.precision || 4
                newValues[v.symbol] = String(Math.round(results[v.symbol] * Math.pow(10, p)) / Math.pow(10, p))
                newAuto[v.symbol] = true
              }
            }
            if (Object.keys(newValues).length > 0) {
              setVariableValues(prev => ({ ...prev, ...newValues }))
              setAutoCalculated(prev => ({ ...prev, ...newAuto }))
            }
            setSolveError(null)
          } else {
            setSolveError(`Calculation resulted in an invalid value for ${unknown}. Check your inputs.`)
          }
        } catch (err) {
          setSolveError('Calculation error: ' + (err instanceof Error ? err.message : String(err)))
        }
      } else {
        // Reverse solve: unknown is an input, try to find it
        const result = solveForUnknown(selectedEq.equation, numValues, unknown)
        if (result !== null && isFinite(result)) {
          const prec = unknownDescriptor?.precision || 4
          const rounded = Math.round(result * Math.pow(10, prec)) / Math.pow(10, prec)
          setVariableValues(prev => ({ ...prev, [unknown]: String(rounded) }))
          setAutoCalculated(prev => ({ ...prev, [unknown]: true }))
          setManuallyOverridden(prev => ({ ...prev, [unknown]: false }))
          setSolveError(null)
        } else {
          setSolveError(`Could not solve for ${unknown}. The equation may not be solvable for this variable using numerical methods. Try providing a different combination of values.`)
        }
      }
      return
    }

    // CASE 3: Multiple empty variables
    const emptyInputNames = emptyVars
      .filter(sym => {
        const desc = variables.find(v => v.symbol === sym)
        return desc && !desc.isOutput
      })
      .map(sym => {
        const desc = variables.find(v => v.symbol === sym)
        return desc?.name || sym
      })

    if (emptyInputNames.length > 0) {
      setSolveError(`Please provide values for more variables. Missing: ${emptyInputNames.join(', ')}. Leave exactly one field empty to auto-calculate it.`)
    } else {
      setSolveError(`Multiple output fields are empty. Provide at least one output value to enable reverse calculation, or fill all inputs.`)
    }
  }, [selectedEq, variables, variableValues, outputVars, manuallyOverridden])

  // Auto-calculate with debounce
  useEffect(() => {
    if (!selectedEq?.equation || variables.length === 0) return
    if (!lastEditedRef.current) return

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(() => {
      setIsCalculating(true)
      // Use a microtask to let the state update settle
      requestAnimationFrame(() => {
        calculate()
        setIsCalculating(false)
      })
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [variableValues, selectedEq, calculate, variables])

  // Reset all fields to defaults
  const handleReset = useCallback(() => {
    if (!selectedEq) return
    handleSelectEquation(selectedEq)
  }, [selectedEq, handleSelectEquation])

  // Unique domains from loaded equations
  const domains = useMemo(() => {
    const domainSet = new Set<string>()
    equations.forEach(eq => { if (eq.domain) domainSet.add(eq.domain) })
    const staticDomains = ['all', 'electrical', 'mechanical', 'civil', 'hvac', 'hydraulics', 'chemical', 'thermodynamics', 'structural']
    const combined = new Set([...staticDomains, ...domainSet])
    return [...combined]
  }, [equations])

  // Get the formula display string
  const formulaDisplay = useMemo(() => {
    if (!selectedEq) return ''
    return selectedEq.equation_latex || selectedEq.equation || ''
  }, [selectedEq])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Engineering Calculators</h1>
        <p className="text-muted-foreground">
          Solve 450+ equations — fill any values and the unknown is auto-calculated
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ========== Equation Browser Sidebar ========== */}
        <div className="lg:w-80 space-y-4 shrink-0">
          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search equations..."
                className="pl-8"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Domain Filter */}
          <Select value={domain} onValueChange={setDomain}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by domain" />
            </SelectTrigger>
            <SelectContent>
              {domains.map(d => (
                <SelectItem key={d} value={d} className="capitalize">
                  {d === 'all' ? 'All Domains' : d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Equation List */}
          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="space-y-1 pr-1">
              {loading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-14 bg-muted/50 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : equations.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">No equations found</p>
              ) : (
                equations.map(eq => (
                  <button
                    key={eq.id}
                    onClick={() => handleSelectEquation(eq)}
                    className={`w-full text-left p-3 rounded-lg border transition-all text-sm group ${
                      selectedEq?.id === eq.id
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-sm'
                        : 'hover:bg-muted/50 border-transparent hover:border-border'
                    }`}
                  >
                    <div className="font-medium text-sm leading-tight group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                      {eq.name}
                    </div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      <Badge variant="secondary" className="text-[9px] capitalize">{eq.domain}</Badge>
                      {eq.category_name && (
                        <Badge variant="outline" className="text-[9px]">{eq.category_name}</Badge>
                      )}
                      {eq.inputs && eq.inputs.length > 0 && (
                        <Badge variant="outline" className="text-[9px]">
                          {eq.inputs.length}in / {eq.outputs?.length || 0}out
                        </Badge>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* ========== Equation Detail with Calculator ========== */}
        <div className="flex-1 min-w-0">
          {selectedEq ? (
            <div className="space-y-4">
              {/* Equation Header Card */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="capitalize bg-emerald-600 text-white">{selectedEq.domain}</Badge>
                    {selectedEq.category_name && <Badge variant="outline">{selectedEq.category_name}</Badge>}
                    {selectedEq.difficulty_level && (
                      <Badge variant="secondary" className="text-[10px]">{selectedEq.difficulty_level}</Badge>
                    )}
                  </div>
                  <CardTitle className="text-xl">{selectedEq.name}</CardTitle>
                  {selectedEq.description && <CardDescription>{selectedEq.description}</CardDescription>}
                </CardHeader>
                <CardContent>
                  {/* Formula Display */}
                  {formulaDisplay && (
                    <div className="bg-muted/80 p-4 rounded-lg border border-border/50">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 font-medium">
                        Formula
                      </div>
                      {selectedEq.equation_latex ? (
                        <div className="text-lg font-mono">{selectedEq.equation_latex}</div>
                      ) : (
                        <div className="text-lg font-mono">{selectedEq.equation}</div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Smart Calculator Card */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Zap className="h-4 w-4 text-emerald-600" />
                      Smart Calculator
                      {isCalculating && (
                        <RefreshCw className="h-3.5 w-3.5 text-emerald-500 animate-spin" />
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <Info className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">
                            <p>Fill in the values you know. Leave one field empty and it will be auto-calculated after 300ms.</p>
                            <p className="mt-1 text-muted-foreground">You can also fill an output value to reverse-calculate a missing input.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                  <CardDescription>
                    Fill any values you know — leave one empty and it&apos;s auto-calculated
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* ---- Input Parameters ---- */}
                  {inputVars.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Variable className="h-4 w-4 text-emerald-500" />
                        Input Parameters
                        <span className="text-[10px] text-muted-foreground font-normal">
                          ({inputVars.length} variable{inputVars.length !== 1 ? 's' : ''})
                        </span>
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {inputVars.map(v => {
                          const isAuto = autoCalculated[v.symbol]
                          const hasValue = variableValues[v.symbol] !== '' && variableValues[v.symbol] !== undefined
                          return (
                            <div key={v.symbol} className="space-y-1.5">
                              <Label className="text-xs font-medium flex items-center gap-1.5">
                                <span className="font-mono text-emerald-700 dark:text-emerald-400">{v.symbol}</span>
                                <span>{v.name !== v.symbol ? v.name : ''}</span>
                                {v.unit && (
                                  <span className="text-muted-foreground font-normal">({v.unit})</span>
                                )}
                                {isAuto && (
                                  <Badge className="text-[8px] h-4 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0 px-1.5 gap-0.5">
                                    <Sparkles className="h-2.5 w-2.5" />
                                    auto
                                  </Badge>
                                )}
                              </Label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  value={variableValues[v.symbol] ?? ''}
                                  onChange={e => handleValueChange(v.symbol, e.target.value)}
                                  placeholder={v.placeholder || `Enter ${v.name}`}
                                  className={`pr-12 transition-colors ${
                                    isAuto
                                      ? 'border-emerald-400 bg-emerald-50/60 dark:border-emerald-600 dark:bg-emerald-950/30'
                                      : hasValue
                                        ? 'border-border'
                                        : 'border-dashed'
                                  }`}
                                  step="any"
                                  min={v.minValue ?? undefined}
                                  max={v.maxValue ?? undefined}
                                />
                                {v.unit && (
                                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
                                    {v.unit}
                                  </span>
                                )}
                              </div>
                              {/* Help text or description */}
                              {(v.helpText || v.description) && (
                                <p className="text-[10px] text-muted-foreground leading-tight">
                                  {v.helpText || v.description}
                                </p>
                              )}
                              {/* Min/Max constraints */}
                              {(v.minValue !== null || v.maxValue !== null) && (
                                <p className="text-[9px] text-muted-foreground/70">
                                  {v.minValue !== null && v.maxValue !== null
                                    ? `Range: ${v.minValue} – ${v.maxValue}`
                                    : v.minValue !== null
                                      ? `Min: ${v.minValue}`
                                      : `Max: ${v.maxValue}`}
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* ---- Output Parameters (editable for reverse solving) ---- */}
                  {outputVars.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <ArrowRightLeft className="h-4 w-4 text-amber-500" />
                        Output Results
                        <span className="text-[10px] text-muted-foreground font-normal">
                          (editable for reverse calculation)
                        </span>
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {outputVars.map(v => {
                          const isAuto = autoCalculated[v.symbol]
                          const isOverridden = manuallyOverridden[v.symbol]
                          const hasValue = variableValues[v.symbol] !== '' && variableValues[v.symbol] !== undefined
                          return (
                            <div key={v.symbol} className="space-y-1.5">
                              <Label className="text-xs font-medium flex items-center gap-1.5">
                                <span className="font-mono text-amber-700 dark:text-amber-400">{v.symbol}</span>
                                <span>{v.name !== v.symbol ? v.name : ''}</span>
                                {v.unit && (
                                  <span className="text-muted-foreground font-normal">({v.unit})</span>
                                )}
                                {isAuto && (
                                  <Badge className="text-[8px] h-4 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0 px-1.5 gap-0.5">
                                    <Sparkles className="h-2.5 w-2.5" />
                                    auto
                                  </Badge>
                                )}
                                {isOverridden && !isAuto && (
                                  <Badge className="text-[8px] h-4 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-0 px-1.5">
                                    manual
                                  </Badge>
                                )}
                              </Label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  value={variableValues[v.symbol] ?? ''}
                                  onChange={e => handleValueChange(v.symbol, e.target.value)}
                                  placeholder={isAuto ? 'Auto-calculated' : v.placeholder || `Enter ${v.name}`}
                                  className={`pr-12 transition-colors ${
                                    isAuto
                                      ? 'border-emerald-400 bg-emerald-50/60 dark:border-emerald-600 dark:bg-emerald-950/30 font-semibold'
                                      : isOverridden
                                        ? 'border-amber-400 bg-amber-50/40 dark:border-amber-600 dark:bg-amber-950/20'
                                        : 'border-amber-200 bg-amber-50/20 dark:border-amber-800/50 dark:bg-amber-950/10'
                                  }`}
                                  step="any"
                                />
                                {v.unit && (
                                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
                                    {v.unit}
                                  </span>
                                )}
                              </div>
                              {(v.description || v.helpText) && (
                                <p className="text-[10px] text-muted-foreground leading-tight">
                                  {v.description || v.helpText}
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* ---- Fallback: No variables detected ---- */}
                  {variables.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <Calculator className="h-10 w-10 mx-auto mb-2 opacity-40" />
                      <p>No variables detected for this equation.</p>
                      <p className="text-xs mt-1">The formula format may not be supported for auto-parsing.</p>
                    </div>
                  )}

                  {/* ---- Error Message ---- */}
                  {solveError && (
                    <div className="flex items-start gap-2.5 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-sm text-amber-800 dark:text-amber-200">{solveError}</p>
                    </div>
                  )}

                  {/* ---- Action Buttons ---- */}
                  <div className="flex gap-2 pt-1">
                    <Button
                      onClick={() => {
                        setIsCalculating(true)
                        calculate()
                        setIsCalculating(false)
                      }}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Calculate
                    </Button>
                    <Button variant="outline" onClick={handleReset}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reset
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* How It Works Card */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    How It Works
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2.5 text-xs text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      <p><strong>Forward:</strong> Fill all input values → outputs are auto-calculated instantly</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      <p><strong>Reverse:</strong> Fill an output + all inputs except one → missing input is calculated via numerical solving</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      <p><strong>Bidirectional:</strong> Leave exactly ONE field empty (input or output) and it gets auto-solved</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                      <p><strong>Override:</strong> Type in an output field to override it (amber border) and reverse-solve for a missing input</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            /* Empty State */
            <Card className="flex items-center justify-center min-h-[400px]">
              <div className="text-center text-muted-foreground p-8">
                <BookOpen className="h-14 w-14 mx-auto mb-4 opacity-40" />
                <p className="text-lg font-medium">Select an equation to begin</p>
                <p className="text-sm mt-1">Browse 450+ equations across 8 engineering domains</p>
                <div className="flex flex-wrap gap-2 justify-center mt-4">
                  {['electrical', 'mechanical', 'civil', 'hvac'].map(d => (
                    <Badge
                      key={d}
                      variant="outline"
                      className="cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors capitalize"
                      onClick={() => setDomain(d)}
                    >
                      {d}
                    </Badge>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
