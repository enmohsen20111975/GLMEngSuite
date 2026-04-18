'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Search, Play, GitBranch, ChevronRight, ChevronLeft, CheckCircle2, XCircle,
  FileText, AlertTriangle, ArrowRightLeft, Zap, RotateCcw, Info, Variable, Link2,
  Loader2
} from 'lucide-react'
import {
  parseFormula,
  evaluateFormula,
  solveForUnknown,
  type InputConfig,
  type OutputConfig,
  type ParsedStepFormula,
} from '@/lib/formula-solver'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface PipelineItem {
  id: string
  name: string
  description: string
  domain: string
  difficulty_level: string
  estimated_time: string
  step_count: number
  is_local: boolean
  icon: string
}

interface StepInput {
  name: string
  symbol: string
  unit: string
  type: string
  required: boolean
  default?: number | string
  min_value?: number
  max_value?: number
  help_text?: string
  options?: { value: string | number; label: string }[]
}

interface StepOutput {
  name: string
  symbol: string
  unit: string
  type: string
  precision: number
}

interface PipelineStepData {
  step_number: number
  name: string
  description?: string
  formula?: string
  formula_ref?: string
  standard_ref?: string
  formula_display?: string[]
  input_config: StepInput[] | string
  output_config: StepOutput[] | string
  calculation_type?: string
  precision?: number
}

interface PipelineDetail {
  id: string
  pipeline_id: string
  name: string
  description: string
  domain: string
  difficulty_level: string
  estimated_time: string
  icon?: string
  is_local: boolean
  steps: PipelineStepData[]
}

// Runtime step info with parsed formula
interface ResolvedStep {
  stepNumber: number
  name: string
  description: string
  formulaDisplay: string[]
  standardRef: string
  inputs: StepInput[]
  outputs: StepOutput[]
  parsedFormula: ParsedStepFormula | null
}

// Per-step value state
type StepValues = Record<number, Record<string, string>>
type StepAutoCalc = Record<number, Record<string, boolean>>

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function parseJsonConfig<T>(config: T[] | string | undefined | null): T[] {
  if (!config) return []
  if (Array.isArray(config)) return config
  if (typeof config === 'string') {
    try { return JSON.parse(config) } catch { return [] }
  }
  return []
}

function resolveSteps(rawSteps: PipelineStepData[]): ResolvedStep[] {
  return rawSteps.map((s, idx) => {
    const inputs = parseJsonConfig<StepInput>(s.input_config)
    const outputs = parseJsonConfig<StepOutput>(s.output_config)
    const formula = s.formula || ''
    const parsedFormula = formula.trim()
      ? parseFormula(formula, inputs as InputConfig[], outputs as OutputConfig[])
      : null

    // Build formula display
    const formulaDisplay: string[] = []
    if (s.formula_display && Array.isArray(s.formula_display)) {
      formulaDisplay.push(...s.formula_display)
    } else if (formula) {
      formulaDisplay.push(formula)
    }
    if (parsedFormula?.equations) {
      for (const eq of parsedFormula.equations) {
        if (!formulaDisplay.includes(eq.originalFormula)) {
          formulaDisplay.push(eq.originalFormula)
        }
      }
    }

    return {
      stepNumber: s.step_number || idx + 1,
      name: s.name || `Step ${idx + 1}`,
      description: s.description || '',
      formulaDisplay,
      standardRef: s.standard_ref || s.formula_ref || '',
      inputs,
      outputs,
      parsedFormula,
    }
  })
}

function formatResult(value: number, precision: number = 4): string {
  const rounded = Number(value.toFixed(precision))
  return String(rounded)
}

// ═══════════════════════════════════════════════════════════════════════════════
// Solve Step — Bidirectional
// ═══════════════════════════════════════════════════════════════════════════════

function solveStep(
  step: ResolvedStep,
  allValues: Record<string, string>,
  _lastEdited: string | null,
): { values: Record<string, string>; autoCalculated: Record<string, boolean>; error: string | null } {
  const result: Record<string, string> = { ...allValues }
  const autoCalc: Record<string, boolean> = {}
  let error: string | null = null

  // Collect filled numeric inputs
  const filledNumeric: Record<string, number> = {}
  const emptyNumericInputs: string[] = []

  for (const inp of step.inputs) {
    if (inp.type === 'select') continue
    const raw = allValues[inp.name]
    if (raw !== '' && raw !== undefined && raw !== null) {
      const num = Number(raw)
      if (!isNaN(num) && isFinite(num)) {
        filledNumeric[inp.name] = num
      } else {
        emptyNumericInputs.push(inp.name)
      }
    } else {
      emptyNumericInputs.push(inp.name)
    }
  }

  // Collect filled output values
  const filledOutputs: Record<string, number> = {}
  const emptyOutputs: string[] = []

  for (const out of step.outputs) {
    const raw = allValues[out.name]
    if (raw !== '' && raw !== undefined && raw !== null) {
      const num = Number(raw)
      if (!isNaN(num) && isFinite(num)) {
        filledOutputs[out.name] = num
      } else {
        emptyOutputs.push(out.name)
      }
    } else {
      emptyOutputs.push(out.name)
    }
  }

  if (!step.parsedFormula || !step.parsedFormula.isComputable) {
    // Non-computable step — no auto-calculation
    if (emptyNumericInputs.length > 0) {
      const labels = emptyNumericInputs.map(n => {
        const inp = step.inputs.find(i => i.name === n)
        return inp?.symbol || inp?.name || n
      })
      error = `Provide values for: ${labels.join(', ')}`
    }
    return { values: result, autoCalculated: autoCalc, error }
  }

  // CASE 1: All numeric inputs filled → Forward calculation
  if (emptyNumericInputs.length === 0) {
    const evalResult = evaluateFormula(step.parsedFormula, filledNumeric)
    if (evalResult.error) {
      error = evalResult.error
    } else {
      for (const [key, val] of Object.entries(evalResult.values)) {
        const outDef = step.outputs.find(o => o.name === key)
        const precision = outDef?.precision ?? 4
        const numVal = Number(val)
        if (!isNaN(numVal) && isFinite(numVal)) {
          result[key] = formatResult(numVal, precision)
          autoCalc[key] = true
        }
      }
    }
    return { values: result, autoCalculated: autoCalc, error }
  }

  // CASE 2: One numeric input missing, at least one output provided → Reverse solve
  if (emptyNumericInputs.length === 1 && Object.keys(filledOutputs).length > 0) {
    const missingInput = emptyNumericInputs[0]
    const targetOutputName = Object.keys(filledOutputs)[0]
    const targetOutputValue = filledOutputs[targetOutputName]

    const solveResult = solveForUnknown(
      step.parsedFormula,
      { ...filledNumeric, ...filledOutputs },
      missingInput,
      targetOutputName,
      targetOutputValue,
    )

    if (solveResult.error) {
      error = solveResult.error
    } else {
      for (const [key, val] of Object.entries(solveResult.values)) {
        const numVal = Number(val)
        if (!isNaN(numVal) && isFinite(numVal)) {
          const outDef = step.outputs.find(o => o.name === key)
          const inpDef = step.inputs.find(i => i.name === key)
          const precision = outDef?.precision ?? inpDef ? 4 : 4
          result[key] = formatResult(numVal, precision)
          autoCalc[key] = true
        }
      }

      // Now forward-calculate to fill remaining outputs
      const allInputsFilled: Record<string, number | string> = {}
      for (const [k, v] of Object.entries(result)) {
        if (v !== '' && v !== undefined) {
          const num = Number(v)
          if (!isNaN(num)) allInputsFilled[k] = num
          else allInputsFilled[k] = v
        }
      }

      const forwardResult = evaluateFormula(step.parsedFormula, allInputsFilled)
      if (!forwardResult.error) {
        for (const [key, val] of Object.entries(forwardResult.values)) {
          const numVal = Number(val)
          if (!isNaN(numVal) && isFinite(numVal) && (emptyOutputs.includes(key) || !result[key])) {
            const outDef = step.outputs.find(o => o.name === key)
            const precision = outDef?.precision ?? 4
            result[key] = formatResult(numVal, precision)
            autoCalc[key] = true
          }
        }
      }
    }

    return { values: result, autoCalculated: autoCalc, error }
  }

  // CASE 3: Multiple missing values
  if (emptyNumericInputs.length > 1) {
    const labels = emptyNumericInputs.map(n => {
      const inp = step.inputs.find(i => i.name === n)
      return `${inp?.symbol || n} (${inp?.unit || ''})`
    })
    error = `Provide values for: ${labels.join(', ')}`
  }

  return { values: result, autoCalculated: autoCalc, error }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export function PipelinesSection() {
  const [pipelines, setPipelines] = useState<PipelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [domainFilter, setDomainFilter] = useState('all')

  // Selected pipeline + resolved steps
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pipelineDetail, setPipelineDetail] = useState<PipelineDetail | null>(null)
  const [resolvedSteps, setResolvedSteps] = useState<ResolvedStep[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  // Step navigation
  const [currentStep, setCurrentStep] = useState(0)

  // Per-step value state
  const [stepValues, setStepValues] = useState<StepValues>({})
  const [stepAutoCalc, setStepAutoCalc] = useState<StepAutoCalc>({})
  const [stepErrors, setStepErrors] = useState<Record<number, string | null>>({})
  const [lastEdited, setLastEdited] = useState<{ step: number; varName: string } | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Run-all results
  const [stepResults, setStepResults] = useState<{
    stepNumber: number
    success: boolean
    outputs: Record<string, string>
  }[]>([])

  // ─── Fetch pipeline list ───────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/pipelines')
      .then(r => r.json())
      .then(d => { if (d.success) setPipelines(d.data) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // ─── Fetch pipeline detail when selected ──────────────────────────────────
  useEffect(() => {
    if (!selectedId) return

    setLoadingDetail(true)
    setDetailError(null)

    fetch(`/api/pipelines/${selectedId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) {
          setPipelineDetail(d.data)
          const steps = resolveSteps(d.data.steps || [])
          setResolvedSteps(steps)
        } else {
          setDetailError(d.error || 'Pipeline not found')
          setPipelineDetail(null)
          setResolvedSteps([])
        }
      })
      .catch(err => {
        setDetailError('Failed to load pipeline')
        setPipelineDetail(null)
        setResolvedSteps([])
      })
      .finally(() => setLoadingDetail(false))
  }, [selectedId])

  // Reset step state when pipeline changes
  useEffect(() => {
    setCurrentStep(0)
    setStepValues({})
    setStepAutoCalc({})
    setStepErrors({})
    setStepResults([])
    setLastEdited(null)
  }, [selectedId])

  // ─── Get current step values (with defaults) ──────────────────────────────
  const getStepValues = useCallback((stepIdx: number): Record<string, string> => {
    if (stepValues[stepIdx]) return stepValues[stepIdx]
    const step = resolvedSteps[stepIdx]
    if (!step) return {}

    const defaults: Record<string, string> = {}
    for (const inp of step.inputs) {
      if (inp.type === 'select' && inp.options && inp.options.length > 0) {
        defaults[inp.name] = String(inp.default ?? inp.options[0].value ?? '')
      } else {
        defaults[inp.name] = inp.default !== undefined ? String(inp.default) : ''
      }
    }
    for (const out of step.outputs) {
      defaults[out.name] = ''
    }
    return defaults
  }, [resolvedSteps, stepValues])

  // ─── Auto-calculate with debounce ─────────────────────────────────────────
  const triggerAutoCalc = useCallback((stepIdx: number, values: Record<string, string>, editedVar: string) => {
    const step = resolvedSteps[stepIdx]
    if (!step) return

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(() => {
      const { values: newValues, autoCalculated, error } = solveStep(step, values, editedVar)

      setStepValues(prev => ({ ...prev, [stepIdx]: newValues }))
      setStepAutoCalc(prev => ({ ...prev, [stepIdx]: autoCalculated }))
      setStepErrors(prev => ({ ...prev, [stepIdx]: error }))

      // Propagate outputs to subsequent steps
      propagateOutputs(stepIdx, newValues)
    }, 300)
  }, [resolvedSteps])

  // ─── Propagate outputs to subsequent steps ────────────────────────────────
  const propagateOutputs = useCallback((fromStepIdx: number, values: Record<string, string>) => {
    const fromStep = resolvedSteps[fromStepIdx]
    if (!fromStep) return

    const outputNames = fromStep.outputs.map(o => o.name)
    const propagatedValues: Record<string, string> = {}
    for (const name of outputNames) {
      if (values[name] !== '' && values[name] !== undefined) {
        propagatedValues[name] = values[name]
      }
    }

    if (Object.keys(propagatedValues).length === 0) return

    setStepValues(prev => {
      const updated = { ...prev }
      for (let i = fromStepIdx + 1; i < resolvedSteps.length; i++) {
        const nextStep = resolvedSteps[i]
        const nextValues = { ...(updated[i] || {}) }
        let changed = false

        for (const inp of nextStep.inputs) {
          if (propagatedValues[inp.name] !== undefined && (nextValues[inp.name] === '' || nextValues[inp.name] === undefined)) {
            nextValues[inp.name] = propagatedValues[inp.name]
            changed = true
          }
        }

        if (changed) updated[i] = nextValues
      }
      return updated
    })
  }, [resolvedSteps])

  // ─── Handle value change ──────────────────────────────────────────────────
  const handleValueChange = (stepIdx: number, varName: string, value: string) => {
    const currentValues = getStepValues(stepIdx)
    const newValues = { ...currentValues, [varName]: value }

    setStepValues(prev => ({ ...prev, [stepIdx]: newValues }))
    setLastEdited({ step: stepIdx, varName })
    setStepAutoCalc(prev => {
      const updated = { ...prev }
      if (updated[stepIdx]) {
        updated[stepIdx] = { ...updated[stepIdx], [varName]: false }
      }
      return updated
    })

    triggerAutoCalc(stepIdx, newValues, varName)
  }

  // ─── Explicit calculate step ──────────────────────────────────────────────
  const handleCalculateStep = () => {
    if (!resolvedSteps.length) return
    const step = resolvedSteps[currentStep]
    if (!step) return

    const values = getStepValues(currentStep)
    const { values: newValues, autoCalculated, error } = solveStep(step, values, null)

    setStepValues(prev => ({ ...prev, [currentStep]: newValues }))
    setStepAutoCalc(prev => ({ ...prev, [currentStep]: autoCalculated }))
    setStepErrors(prev => ({ ...prev, [currentStep]: error }))

    if (!error) {
      const outputs: Record<string, string> = {}
      for (const out of step.outputs) {
        if (newValues[out.name] !== '' && newValues[out.name] !== undefined) {
          outputs[out.name] = newValues[out.name]
        }
      }
      setStepResults(prev => [
        ...prev.filter(r => r.stepNumber !== step.stepNumber),
        { stepNumber: step.stepNumber, success: true, outputs }
      ])

      propagateOutputs(currentStep, newValues)

      // Auto-advance
      if (currentStep < resolvedSteps.length - 1) {
        setCurrentStep(currentStep + 1)
      }
    }
  }

  // ─── Run all steps ────────────────────────────────────────────────────────
  const handleRunAll = () => {
    if (!resolvedSteps.length) return

    const allResults: { stepNumber: number; success: boolean; outputs: Record<string, string> }[] = []
    const newStepValues: StepValues = { ...stepValues }
    const newAutoCalc: StepAutoCalc = { ...stepAutoCalc }

    for (let i = 0; i < resolvedSteps.length; i++) {
      const step = resolvedSteps[i]
      const values = getStepValues(i)

      // Also try to propagate from previous results
      const enrichedValues = { ...values }
      if (i > 0) {
        const prevOutputs = allResults[i - 1]?.outputs || {}
        for (const inp of step.inputs) {
          if ((enrichedValues[inp.name] === '' || enrichedValues[inp.name] === undefined) && prevOutputs[inp.name]) {
            enrichedValues[inp.name] = prevOutputs[inp.name]
          }
        }
      }

      const { values: newValues, autoCalculated, error } = solveStep(step, enrichedValues, null)

      newStepValues[i] = newValues
      newAutoCalc[i] = autoCalculated

      const outputs: Record<string, string> = {}
      for (const out of step.outputs) {
        if (newValues[out.name] !== '' && newValues[out.name] !== undefined) {
          outputs[out.name] = newValues[out.name]
        }
      }

      allResults.push({
        stepNumber: step.stepNumber,
        success: !error,
        outputs,
      })

      if (error) break
    }

    setStepResults(allResults)
    setStepValues(newStepValues)
    setStepAutoCalc(newAutoCalc)
    setCurrentStep(resolvedSteps.length - 1)
  }

  // ─── Reset step ───────────────────────────────────────────────────────────
  const handleResetStep = () => {
    setStepValues(prev => {
      const updated = { ...prev }
      delete updated[currentStep]
      return updated
    })
    setStepAutoCalc(prev => {
      const updated = { ...prev }
      delete updated[currentStep]
      return updated
    })
    setStepErrors(prev => ({ ...prev, [currentStep]: null }))
  }

  // ─── Reset all ────────────────────────────────────────────────────────────
  const handleResetAll = () => {
    setStepValues({})
    setStepAutoCalc({})
    setStepErrors({})
    setStepResults([])
    setCurrentStep(0)
    setLastEdited(null)
  }

  // ─── Filtered pipelines ───────────────────────────────────────────────────
  const filteredPipelines = useMemo(() =>
    pipelines.filter(p => {
      if (domainFilter !== 'all' && p.domain !== domainFilter) return false
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !(p.description || '').toLowerCase().includes(search.toLowerCase())) return false
      return true
    }),
    [pipelines, domainFilter, search]
  )

  // ─── Domain list ──────────────────────────────────────────────────────────
  const domains = useMemo(() => {
    const set = new Set(pipelines.map(p => p.domain).filter(Boolean))
    return Array.from(set).sort()
  }, [pipelines])

  // ─── Render a single step's variable editor ──────────────────────────────
  const renderStepEditor = (step: ResolvedStep, stepIdx: number) => {
    const values = getStepValues(stepIdx)
    const autoCalc = stepAutoCalc[stepIdx] || {}
    const error = stepErrors[stepIdx]

    return (
      <div className="space-y-4">
        {/* Step Header */}
        <div>
          <h3 className="font-semibold text-lg">Step {step.stepNumber}: {step.name}</h3>
          {step.description && (
            <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
          )}
          {step.standardRef && (
            <Badge variant="outline" className="mt-1.5 text-[10px]">{step.standardRef}</Badge>
          )}
        </div>

        {/* Formula Display */}
        {step.formulaDisplay.length > 0 && (
          <div className="bg-muted/80 p-3 rounded-lg font-mono text-xs space-y-1 border">
            {step.formulaDisplay.map((f, i) => (
              <div key={i} className="text-foreground/90">{f}</div>
            ))}
          </div>
        )}

        {/* Computable status */}
        {step.parsedFormula && !step.parsedFormula.isComputable && step.formulaDisplay.length > 0 && (
          <div className="flex items-center gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <Info className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              This step uses a descriptive formula. Enter input values and the output will be calculated where possible.
            </p>
          </div>
        )}

        <Separator />

        {/* Input Parameters */}
        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Variable className="h-4 w-4 text-emerald-600" />
            Input Parameters
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {step.inputs.map(inp => {
              const isAuto = autoCalc[inp.name]
              const isPropagated = stepIdx > 0 && values[inp.name] !== '' && values[inp.name] !== undefined && !isAuto

              return (
                <div key={inp.name} className="space-y-1">
                  <label className="text-xs font-medium flex items-center gap-1 flex-wrap">
                    <span>{inp.symbol || inp.name}</span>
                    {inp.symbol !== inp.name && <span className="text-muted-foreground">({inp.name})</span>}
                    {inp.unit && <span className="text-muted-foreground">[{inp.unit}]</span>}
                    {isAuto && (
                      <Badge className="text-[8px] h-4 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0 px-1">
                        auto
                      </Badge>
                    )}
                    {isPropagated && (
                      <Badge className="text-[8px] h-4 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 border-0 px-1">
                        <Link2 className="h-2.5 w-2.5 mr-0.5" />
                        linked
                      </Badge>
                    )}
                  </label>
                  {inp.type === 'select' && inp.options && inp.options.length > 0 ? (
                    <Select
                      value={String(values[inp.name] ?? inp.default ?? '')}
                      onValueChange={v => handleValueChange(stepIdx, inp.name, v)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {inp.options.map(opt => (
                          <SelectItem key={String(opt.value)} value={String(opt.value)}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="relative">
                      <Input
                        type="number"
                        value={values[inp.name] ?? ''}
                        onChange={e => handleValueChange(stepIdx, inp.name, e.target.value)}
                        placeholder={`Enter ${inp.symbol || inp.name}`}
                        className={`pr-12 ${isAuto
                          ? 'border-emerald-400 bg-emerald-50/60 dark:border-emerald-600 dark:bg-emerald-950/30'
                          : isPropagated
                            ? 'border-blue-300 bg-blue-50/30 dark:border-blue-700 dark:bg-blue-950/20'
                            : ''
                        }`}
                        step="any"
                      />
                      {inp.unit && (
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                          {inp.unit}
                        </span>
                      )}
                    </div>
                  )}
                  {inp.help_text && <p className="text-[10px] text-muted-foreground">{inp.help_text}</p>}
                </div>
              )
            })}
          </div>
        </div>

        <Separator />

        {/* Output Parameters (editable for reverse calculation) */}
        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-amber-500" />
            Output Results
            <span className="text-[10px] text-muted-foreground font-normal">(editable for reverse calculation)</span>
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {step.outputs.map(out => {
              const isAuto = autoCalc[out.name]
              const rawVal = values[out.name] ?? ''

              return (
                <div key={out.name} className="space-y-1">
                  <label className="text-xs font-medium flex items-center gap-1 flex-wrap">
                    <span>{out.symbol || out.name}</span>
                    {out.symbol !== out.name && <span className="text-muted-foreground">({out.name})</span>}
                    {out.unit && <span className="text-muted-foreground">[{out.unit}]</span>}
                    {isAuto && (
                      <Badge className="text-[8px] h-4 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0 px-1">
                        calculated
                      </Badge>
                    )}
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={rawVal}
                      onChange={e => handleValueChange(stepIdx, out.name, e.target.value)}
                      placeholder={isAuto ? 'Auto-calculated' : `Enter ${out.symbol || out.name}`}
                      className={`pr-12 ${
                        isAuto
                          ? 'border-emerald-400 bg-emerald-50/60 dark:border-emerald-600 dark:bg-emerald-950/30 font-semibold'
                          : 'border-amber-300 bg-amber-50/30 dark:border-amber-700 dark:bg-amber-950/20'
                      }`}
                      step="any"
                    />
                    {out.unit && (
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                        {out.unit}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Error/Info Message */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-200">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button onClick={handleCalculateStep} className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={!step.parsedFormula?.isComputable && step.inputs.length === 0}>
            <Play className="h-4 w-4 mr-2" />
            Calculate Step {step.stepNumber}
          </Button>
          <Button onClick={handleResetStep} variant="outline" size="icon" title="Reset this step">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Engineering Pipelines</h1>
        <p className="text-muted-foreground">Multi-step calculations with bidirectional solving — fill any variable and the unknown is auto-calculated</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Pipeline List */}
        <div className="lg:w-80 space-y-4 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search pipelines..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={domainFilter} onValueChange={setDomainFilter}>
            <SelectTrigger><SelectValue placeholder="Filter by domain" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Domains</SelectItem>
              {domains.map(d => (
                <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="space-y-2">
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
                </div>
              ) : filteredPipelines.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">No pipelines found</p>
              ) : (
                filteredPipelines.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedId === p.id ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{p.icon || '📊'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{p.name}</div>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          <Badge variant="secondary" className="text-[10px] capitalize">{p.domain}</Badge>
                          <Badge variant="outline" className="text-[10px]">{p.step_count} steps</Badge>
                          {p.is_local && <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-0">local</Badge>}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Pipeline Detail */}
        <div className="flex-1 min-w-0">
          {loadingDetail ? (
            <Card>
              <CardContent className="p-8 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                <span className="ml-3 text-muted-foreground">Loading pipeline details...</span>
              </CardContent>
            </Card>
          ) : detailError ? (
            <Card>
              <CardContent className="p-8 text-center">
                <AlertTriangle className="h-8 w-8 mx-auto text-amber-500" />
                <p className="mt-2 text-muted-foreground">{detailError}</p>
                <Button variant="outline" className="mt-4" onClick={() => setSelectedId(null)}>Go Back</Button>
              </CardContent>
            </Card>
          ) : selectedId && pipelineDetail ? (
            <div className="space-y-4">
              {/* Pipeline Header */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{pipelineDetail.icon || '📊'}</span>
                    <div>
                      <CardTitle>{pipelineDetail.name}</CardTitle>
                      <CardDescription>{pipelineDetail.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Badge className="capitalize bg-emerald-600">{pipelineDetail.domain}</Badge>
                    {pipelineDetail.difficulty_level && <Badge variant="outline">{pipelineDetail.difficulty_level}</Badge>}
                    {pipelineDetail.estimated_time && <Badge variant="outline">{pipelineDetail.estimated_time}</Badge>}
                    <Badge variant="outline">{resolvedSteps.length} steps</Badge>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary" className="cursor-help">
                            <Zap className="h-3 w-3 mr-1" />
                            Bidirectional
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>All variables are editable. Fill any combination and the missing value is auto-calculated.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </CardHeader>
              </Card>

              {/* Steps Navigation + Editor */}
              {resolvedSteps.length > 0 ? (
                <>
                  <Card>
                    <CardHeader className="pb-3">
                      {/* Step Navigation */}
                      <div className="flex items-center justify-between">
                        <Button variant="outline" size="sm" onClick={() => setCurrentStep(Math.max(0, currentStep - 1))} disabled={currentStep === 0}>
                          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                        </Button>
                        <span className="text-sm font-medium">
                          Step {currentStep + 1} of {resolvedSteps.length}
                        </span>
                        <Button variant="outline" size="sm" onClick={() => setCurrentStep(Math.min(resolvedSteps.length - 1, currentStep + 1))} disabled={currentStep >= resolvedSteps.length - 1}>
                          Next <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>

                      {/* Step Progress Bar */}
                      <Progress value={((currentStep + 1) / resolvedSteps.length) * 100} className="h-1.5" />

                      {/* Step Pills */}
                      <div className="flex gap-1.5 mt-1 overflow-x-auto pb-1">
                        {resolvedSteps.map((s, idx) => {
                          const hasValues = stepValues[idx] && Object.values(stepValues[idx]).some(v => v !== '' && v !== undefined)
                          const hasResult = stepResults.some(r => r.stepNumber === s.stepNumber && r.success)
                          return (
                            <button
                              key={s.stepNumber}
                              onClick={() => setCurrentStep(idx)}
                              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                idx === currentStep
                                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                  : hasResult
                                    ? 'border-emerald-300 bg-emerald-50/50 text-emerald-600 dark:border-emerald-700 dark:bg-emerald-950/20'
                                    : hasValues
                                      ? 'border-amber-300 bg-amber-50/50 text-amber-600 dark:border-amber-700 dark:bg-amber-950/20'
                                      : 'border-border hover:bg-muted/50 text-muted-foreground'
                              }`}
                            >
                              <span className="mr-1">{s.stepNumber}.</span>
                              {s.name.length > 20 ? s.name.substring(0, 20) + '...' : s.name}
                              {hasResult && <CheckCircle2 className="h-3 w-3 ml-1 inline" />}
                            </button>
                          )
                        })}
                      </div>
                    </CardHeader>

                    <CardContent>
                      {renderStepEditor(resolvedSteps[currentStep], currentStep)}
                    </CardContent>
                  </Card>

                  {/* Run All & Reset */}
                  <div className="flex gap-2">
                    <Button onClick={handleRunAll} variant="outline" className="flex-1">
                      <GitBranch className="h-4 w-4 mr-2" />
                      Run All Steps
                    </Button>
                    <Button onClick={handleResetAll} variant="outline">
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reset All
                    </Button>
                  </div>

                  {/* Results Summary */}
                  {stepResults.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Pipeline Results Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3 max-h-72 overflow-y-auto">
                          {stepResults.map(r => {
                            const step = resolvedSteps.find(s => s.stepNumber === r.stepNumber)
                            return (
                              <div key={r.stepNumber} className="flex items-start gap-3 text-sm">
                                <div className={`mt-0.5 ${r.success ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {r.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="font-medium">Step {r.stepNumber}: {step?.name || 'Unknown'}</span>
                                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                    {Object.entries(r.outputs).map(([key, val]) => {
                                      const outDef = step?.outputs.find(o => o.name === key)
                                      return (
                                        <span key={key} className="text-xs text-muted-foreground">
                                          {outDef?.symbol || key}: <span className="font-medium text-foreground">{val}</span> {outDef?.unit || ''}
                                        </span>
                                      )
                                    })}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="mt-2 text-muted-foreground">This pipeline has no steps defined yet.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <GitBranch className="h-12 w-12 mx-auto text-muted-foreground/30" />
                <h3 className="mt-4 text-lg font-semibold">Select a Pipeline</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  Choose a pipeline from the list to start an interactive multi-step calculation.
                  All variables are editable — fill any combination and the unknown is auto-calculated.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
