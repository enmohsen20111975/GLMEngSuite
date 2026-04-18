'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Search, Play, BookOpen, RotateCcw, Zap, ChevronRight,
  CheckCircle2, Info, Variable, ArrowRightLeft, AlertCircle
} from 'lucide-react'

// ============== Types ==============
interface EquationInput {
  id?: number
  name: string
  symbol: string
  description?: string
  unit?: string
  default_value?: number | null
  min_value?: number | null
  max_value?: number | null
  data_type?: string
  help_text?: string
  placeholder?: string
}

interface EquationOutput {
  id?: number
  name: string
  symbol: string
  description?: string
  unit?: string
  precision?: number
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

// ============== Formula Variable Parser ==============
// Extracts all variable names from a formula string
// e.g., "R_dc = (rho * L) / A" → { outputs: ['R_dc'], inputs: ['rho', 'L', 'A'] }
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

  // Split multi-assignment formulas (separated by ; or \n)
  const statements = formula.replace(/;/g, '\n').split('\n').map(s => s.trim()).filter(Boolean)

  for (const stmt of statements) {
    // Match "VAR = expression" pattern (but not ==)
    const assignMatch = stmt.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/)
    if (assignMatch) {
      const varName = assignMatch[1]
      outputVariables.add(varName)
      // Parse the right-hand side for variables
      const rhs = assignMatch[2]
      const rhsVars = rhs.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || []
      rhsVars.forEach(v => {
        if (!knownFunctions.has(v)) allVariables.add(v)
      })
    } else {
      // No assignment - just an expression, result is implicit
      const vars = stmt.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || []
      vars.forEach(v => {
        if (!knownFunctions.has(v)) allVariables.add(v)
      })
    }
  }

  // Also add output vars to all vars
  outputVariables.forEach(v => allVariables.add(v))

  // Inputs = all variables that are NOT outputs
  const inputs = [...allVariables].filter(v => !outputVariables.has(v))
  const outputs = [...outputVariables]

  // If no outputs detected, treat the last variable or 'result' as output
  if (outputs.length === 0 && allVariables.size > 0) {
    // Check if any variable looks like an output (common patterns)
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

// Extract ALL unique variable symbols from a formula (for the smart calculator)
function extractAllVariables(formula: string): string[] {
  const { inputs, outputs } = parseFormulaVariables(formula)
  return [...inputs, ...outputs]
}

// ============== Client-side Formula Solver ==============
// Tries to solve for the ONE unknown variable
function solveForUnknown(
  formula: string,
  values: Record<string, number>,
  unknownVar: string
): number | null {
  // Try direct evaluation first (unknown is an output)
  const statements = formula.replace(/;/g, '\n').split('\n').map(s => s.trim()).filter(Boolean)

  for (const stmt of statements) {
    const assignMatch = stmt.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/)
    if (assignMatch) {
      const varName = assignMatch[1]
      const rhs = assignMatch[2]

      if (varName === unknownVar) {
        // Direct: unknown = expression(knowns)
        try {
          const result = clientEval(rhs, values)
          return result
        } catch { return null }
      }

      // Reverse: known_output = expression(unknown, knowns)
      // We need to check if unknownVar appears in the RHS
      const rhsVars = rhs.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || []
      const knownFunctions = new Set(['sqrt', 'sin', 'cos', 'tan', 'log', 'ln', 'exp', 'pow', 'abs', 'round', 'ceil', 'floor', 'max', 'min', 'PI', 'E'])

      if (rhsVars.includes(unknownVar) && varName in values) {
        // Try numerical solving (bisection method)
        return numericalSolve(rhs, values, unknownVar, values[varName])
      }
    }
  }

  return null
}

// Simple numerical solver using bisection
function numericalSolve(
  expression: string,
  knownValues: Record<string, number>,
  unknownVar: string,
  targetOutput: number,
  tolerance: number = 0.0001,
  maxIter: number = 100
): number | null {
  // Find reasonable bounds
  let low = -1e10, high = 1e10

  // Try to narrow bounds based on known values
  const vals = Object.values(knownValues)
  if (vals.length > 0) {
    const maxAbs = Math.max(...vals.map(Math.abs), 1)
    low = -maxAbs * 1000
    high = maxAbs * 1000
  }

  // Substitute and evaluate
  const evalAt = (x: number): number => {
    const ctx = { ...knownValues, [unknownVar]: x }
    return clientEval(expression, ctx)
  }

  // Bisection
  let fLow = evalAt(low) - targetOutput
  let fHigh = evalAt(high) - targetOutput

  // If same sign, try different bounds
  if (fLow * fHigh > 0) {
    // Try smaller range
    low = -1000
    high = 1000
    fLow = evalAt(low) - targetOutput
    fHigh = evalAt(high) - targetOutput
    if (fLow * fHigh > 0) return null
  }

  for (let i = 0; i < maxIter; i++) {
    const mid = (low + high) / 2
    const fMid = evalAt(mid) - targetOutput

    if (Math.abs(fMid) < tolerance) return mid

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

// Client-side expression evaluator (safe subset of math)
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
    return Number(result) || 0
  } catch {
    return 0
  }
}

// Evaluate full formula (all statements) with given inputs, return outputs
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
        context[varName] = result
        outputs[varName] = result
      } catch { /* skip */ }
    } else {
      try {
        const result = clientEval(stmt, context)
        outputs['result'] = result
      } catch { /* skip */ }
    }
  }

  return outputs
}

// ============== Component ==============
export function CalculatorsSection() {
  const [equations, setEquations] = useState<Equation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [domain, setDomain] = useState('all')
  const [selectedEq, setSelectedEq] = useState<Equation | null>(null)

  // Smart calculator state: ALL variables (inputs + outputs) as editable fields
  const [variableValues, setVariableValues] = useState<Record<string, string>>({})
  const [computedOutputs, setComputedOutputs] = useState<Record<string, number>>({})
  const [autoCalculated, setAutoCalculated] = useState<Record<string, boolean>>({})
  const [lastEdited, setLastEdited] = useState<string | null>(null)
  const [solveError, setSolveError] = useState<string | null>(null)

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

  // Parse the formula to get all variables when selecting an equation
  const formulaVariables = useMemo(() => {
    if (!selectedEq?.equation) return { inputs: [] as string[], outputs: [] as string[] }
    return parseFormulaVariables(selectedEq.equation)
  }, [selectedEq?.equation])

  const allVariables = useMemo(() => {
    return [...formulaVariables.inputs, ...formulaVariables.outputs]
  }, [formulaVariables])

  const handleSelectEquation = (eq: Equation) => {
    setSelectedEq(eq)
    setComputedOutputs({})
    setAutoCalculated({})
    setSolveError(null)
    setLastEdited(null)

    // Initialize ALL variables with defaults
    const defaults: Record<string, string> = {}

    // First, set defaults from DB inputs
    if (eq.inputs && eq.inputs.length > 0) {
      eq.inputs.forEach((inp: any) => {
        const symbol = inp.symbol || inp.name
        const val = inp.default_value ?? ''
        defaults[symbol] = val !== null && val !== undefined ? String(val) : ''
      })
    }

    // Parse formula for variables not in DB inputs
    const parsed = parseFormulaVariables(eq.equation || '')
    const allVars = [...parsed.inputs, ...parsed.outputs]

    allVars.forEach(v => {
      if (!(v in defaults)) {
        defaults[v] = ''
      }
    })

    // Set output fields as empty (to be calculated)
    parsed.outputs.forEach(v => {
      defaults[v] = ''
    })

    setVariableValues(defaults)
  }

  // Auto-calculate whenever a value changes
  const handleValueChange = (symbol: string, value: string) => {
    setVariableValues(prev => ({ ...prev, [symbol]: value }))
    setLastEdited(symbol)
    setSolveError(null)
  }

  // Perform calculation
  const calculate = useCallback(() => {
    if (!selectedEq?.equation) return

    const parsed = parseFormulaVariables(selectedEq.equation)
    const numValues: Record<string, number> = {}
    const emptyVars: string[] = []

    // Convert all string values to numbers
    for (const [key, val] of Object.entries(variableValues)) {
      if (val !== '' && val !== null && val !== undefined) {
        const num = Number(val)
        if (!isNaN(num)) {
          numValues[key] = num
        } else {
          emptyVars.push(key)
        }
      } else {
        emptyVars.push(key)
      }
    }

    // CASE 1: All inputs provided, calculate outputs directly
    const allInputsProvided = parsed.inputs.every(v => v in numValues)
    if (allInputsProvided) {
      try {
        const results = evaluateFullFormula(selectedEq.equation, { ...numValues })
        setComputedOutputs(results)
        const autoCalc: Record<string, boolean> = {}
        Object.keys(results).forEach(k => autoCalc[k] = true)
        setAutoCalculated(autoCalc)
        setSolveError(null)
        return
      } catch (err) {
        setSolveError('Calculation error: ' + (err instanceof Error ? err.message : String(err)))
        return
      }
    }

    // CASE 2: Missing exactly one variable - solve for it
    if (emptyVars.length === 1) {
      const unknown = emptyVars[0]
      const result = solveForUnknown(selectedEq.equation, numValues, unknown)
      if (result !== null && isFinite(result)) {
        setComputedOutputs({ [unknown]: result })
        setAutoCalculated({ [unknown]: true })
        setVariableValues(prev => ({ ...prev, [unknown]: String(Math.round(result * 10000) / 10000) }))
        setSolveError(null)
        return
      } else {
        setSolveError(`Could not solve for ${unknown}. The equation may not be solvable for this variable.`)
        return
      }
    }

    // CASE 3: Multiple unknowns - tell user which ones need values
    const missingInputs = parsed.inputs.filter(v => !(v in numValues))
    if (missingInputs.length > 0) {
      setSolveError(`Please provide values for: ${missingInputs.join(', ')}`)
    }
  }, [selectedEq, variableValues])

  // Auto-calculate on value change (with debounce)
  useEffect(() => {
    if (!selectedEq?.equation || !lastEdited) return
    const timer = setTimeout(() => {
      calculate()
    }, 300)
    return () => clearTimeout(timer)
  }, [variableValues, selectedEq, calculate, lastEdited])

  // Get variable metadata (unit, description) from DB or generate
  const getVariableInfo = (symbol: string): { label: string; unit: string; description: string; isOutput: boolean } => {
    // Check DB inputs
    const dbInput = selectedEq?.inputs?.find((inp: any) => (inp.symbol || inp.name) === symbol)
    if (dbInput) {
      return {
        label: dbInput.name || symbol,
        unit: dbInput.unit || '',
        description: dbInput.description || dbInput.help_text || '',
        isOutput: false,
      }
    }

    // Check DB outputs
    const dbOutput = selectedEq?.outputs?.find((out: any) => (out.symbol || out.name) === symbol)
    if (dbOutput) {
      return {
        label: dbOutput.name || symbol,
        unit: dbOutput.unit || '',
        description: dbOutput.description || '',
        isOutput: true,
      }
    }

    // Auto-detect from formula
    const isOutput = formulaVariables.outputs.includes(symbol)
    return {
      label: symbol,
      unit: guessUnit(symbol),
      description: '',
      isOutput,
    }
  }

  const domains = ['all', 'electrical', 'mechanical', 'civil', 'hvac', 'hydraulics', 'chemical', 'thermodynamics', 'structural']

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Engineering Calculators</h1>
        <p className="text-muted-foreground">Solve 450+ equations — fill any values and the unknown is auto-calculated</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Equation Browser */}
        <div className="lg:w-80 space-y-4 shrink-0">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search equations..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <Select value={domain} onValueChange={setDomain}>
            <SelectTrigger><SelectValue placeholder="Filter by domain" /></SelectTrigger>
            <SelectContent>
              {domains.map(d => (
                <SelectItem key={d} value={d} className="capitalize">{d === 'all' ? 'All Domains' : d}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="space-y-1">
              {loading ? (
                <p className="text-sm text-muted-foreground p-4">Loading equations...</p>
              ) : equations.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">No equations found</p>
              ) : (
                equations.map(eq => (
                  <button
                    key={eq.id}
                    onClick={() => handleSelectEquation(eq)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors text-sm ${
                      selectedEq?.id === eq.id
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                        : 'hover:bg-muted/50 border-transparent'
                    }`}
                  >
                    <div className="font-medium text-sm leading-tight">{eq.name}</div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      <Badge variant="secondary" className="text-[9px] capitalize">{eq.domain}</Badge>
                      {eq.equation && (
                        <Badge variant="outline" className="text-[9px] font-mono truncate max-w-[180px]">
                          {eq.equation.substring(0, 30)}{eq.equation.length > 30 ? '...' : ''}
                        </Badge>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Equation Detail with Smart Calculator */}
        <div className="flex-1 min-w-0">
          {selectedEq ? (
            <div className="space-y-4">
              {/* Equation Header */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="capitalize bg-emerald-600">{selectedEq.domain}</Badge>
                    {selectedEq.category_name && <Badge variant="outline">{selectedEq.category_name}</Badge>}
                    {selectedEq.difficulty_level && <Badge variant="secondary" className="text-[10px]">{selectedEq.difficulty_level}</Badge>}
                  </div>
                  <CardTitle className="text-xl">{selectedEq.name}</CardTitle>
                  {selectedEq.description && <CardDescription>{selectedEq.description}</CardDescription>}
                </CardHeader>
                <CardContent>
                  {/* Formula Display */}
                  {selectedEq.equation && (
                    <div className="bg-muted/80 p-4 rounded-lg font-mono text-sm border border-border/50">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Formula</div>
                      {selectedEq.equation_latex ? (
                        <div className="text-lg">{selectedEq.equation_latex}</div>
                      ) : (
                        <div className="text-lg">{selectedEq.equation}</div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Smart Calculator - ALL Variables */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Zap className="h-4 w-4 text-emerald-600" />
                      Smart Calculator
                    </CardTitle>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <Info className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm">
                          <p>Fill in the values you know. Leave one field empty and it will be auto-calculated.</p>
                          <p className="mt-1 text-muted-foreground">You can also fill an output value to reverse-calculate a missing input.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <CardDescription>
                    Fill any values you know — the unknown is auto-calculated
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Input Parameters */}
                  {formulaVariables.inputs.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Variable className="h-4 w-4 text-blue-500" />
                        Input Parameters
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {formulaVariables.inputs.map(symbol => {
                          const info = getVariableInfo(symbol)
                          const isAuto = autoCalculated[symbol]
                          return (
                            <div key={symbol} className="space-y-1">
                              <label className="text-xs font-medium flex items-center gap-1">
                                <span>{info.label}</span>
                                {info.unit && <span className="text-muted-foreground">({info.unit})</span>}
                                {isAuto && (
                                  <Badge className="text-[8px] h-4 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0 px-1">
                                    auto
                                  </Badge>
                                )}
                              </label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  value={variableValues[symbol] ?? ''}
                                  onChange={e => handleValueChange(symbol, e.target.value)}
                                  placeholder={`Enter ${info.label}`}
                                  className={`pr-10 ${isAuto ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-950/20' : ''}`}
                                  step="any"
                                />
                                {info.unit && (
                                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                                    {info.unit}
                                  </span>
                                )}
                              </div>
                              {info.description && (
                                <p className="text-[10px] text-muted-foreground">{info.description}</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Output Parameters (also editable for reverse calculation) */}
                  {formulaVariables.outputs.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <ArrowRightLeft className="h-4 w-4 text-emerald-500" />
                        Output Results
                        <span className="text-[10px] text-muted-foreground font-normal">(editable for reverse calculation)</span>
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {formulaVariables.outputs.map(symbol => {
                          const info = getVariableInfo(symbol)
                          const isAuto = autoCalculated[symbol]
                          const computed = computedOutputs[symbol]
                          return (
                            <div key={symbol} className="space-y-1">
                              <label className="text-xs font-medium flex items-center gap-1">
                                <span>{info.label}</span>
                                {info.unit && <span className="text-muted-foreground">({info.unit})</span>}
                                {isAuto && (
                                  <Badge className="text-[8px] h-4 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0 px-1">
                                    calculated
                                  </Badge>
                                )}
                              </label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  value={variableValues[symbol] ?? ''}
                                  onChange={e => handleValueChange(symbol, e.target.value)}
                                  placeholder={isAuto ? 'Auto-calculated' : `Enter ${info.label}`}
                                  className={`pr-10 ${isAuto ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/30 font-semibold' : 'border-amber-300 bg-amber-50/30 dark:border-amber-700 dark:bg-amber-950/20'}`}
                                  step="any"
                                />
                                {info.unit && (
                                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                                    {info.unit}
                                  </span>
                                )}
                              </div>
                              {info.description && (
                                <p className="text-[10px] text-muted-foreground">{info.description}</p>
                              )}
                              {isAuto && computed !== undefined && (
                                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                  = {computed.toFixed(6)}
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Fallback: If formula parsing found no variables, show raw solve button */}
                  {formulaVariables.inputs.length === 0 && formulaVariables.outputs.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      Could not auto-detect variables from formula. Use the solve button below.
                    </div>
                  )}

                  {/* Error/Info Message */}
                  {solveError && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-sm text-amber-800 dark:text-amber-200">{solveError}</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button onClick={calculate} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                      <Play className="h-4 w-4 mr-2" />
                      Calculate
                    </Button>
                    <Button variant="outline" onClick={() => handleSelectEquation(selectedEq)}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reset
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Examples */}
              {selectedEq.equation && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">How It Works</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                        <p><strong>Direct:</strong> Fill all input values → outputs are auto-calculated</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                        <p><strong>Reverse:</strong> Fill output + some inputs → missing input is calculated</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                        <p><strong>Any variable:</strong> Leave exactly ONE field empty and it will be solved</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card className="flex items-center justify-center h-64">
              <div className="text-center text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Select an equation from the list to begin</p>
                <p className="text-sm">Browse 450+ equations across 8 engineering domains</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

// ============== Helper: Guess unit from variable symbol ==============
function guessUnit(symbol: string): string {
  const unitMap: Record<string, string> = {
    'I': 'A', 'V': 'V', 'R': 'Ω', 'P': 'W', 'Q': 'VAR', 'S': 'VA',
    'L': 'm', 'A': 'mm²', 'd': 'mm', 'D': 'mm', 'f': 'Hz', 't': 's',
    'T': '°C', 'rho': 'Ω·mm²/m', 'J': 'A/mm²', 'k': '',
    'VD': 'V', 'VD_allowable': 'V', 'X': 'Ω', 'Z': 'Ω',
    'Re': '', 'delta': 'm', 'C': 'F', 'VD_percent': '%',
    'I_base': 'A', 'k_temp': '', 'k_group': '', 'k_install': '',
    'R_dc': 'Ω/km', 'R_ac': 'Ω/km', 'y_s': '', 'y_p': '',
    's': 'mm', 'epsilon': '', 'epsilon_0': 'F/m',
  }
  return unitMap[symbol] || ''
}
