'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  FileText, AlertTriangle, ArrowRightLeft, Zap, RotateCcw, Info, Variable, Link2
} from 'lucide-react'
import { ENGINEERING_PIPELINES, type EngineeringPipeline, type PipelineStep, type PipelineInput, type PipelineOutput } from '@/lib/engineering-pipelines'

// ═══════════════════════════════════════════════════════════════════════════════
// Bidirectional Solver Functions (adapted from calculators-section.tsx)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Numerical solver using bisection method.
 * Finds the value of unknownVar such that step.calculate() produces targetOutputName = targetOutputValue.
 */
function numericalSolveStep(
  step: PipelineStep,
  knownValues: Record<string, number | string>,
  unknownInputName: string,
  targetOutputName: string,
  targetOutputValue: number,
  tolerance: number = 0.001,
  maxIter: number = 200
): number | null {
  // Determine reasonable search bounds based on other input values
  const numericInputs = Object.values(knownValues).filter(v => typeof v === 'number') as number[]
  const maxAbs = numericInputs.length > 0 ? Math.max(...numericInputs.map(Math.abs), 1) : 100

  let low = -maxAbs * 100
  let high = maxAbs * 100

  // Ensure positive bounds for engineering values (most are positive)
  if (low < 0) low = 0.001

  const evalAt = (x: number): number | null => {
    try {
      const inputs = { ...knownValues, [unknownInputName]: x }
      const outputs = step.calculate(inputs)
      const val = outputs[targetOutputName]
      if (typeof val === 'number' && isFinite(val)) return val
      return null
    } catch {
      return null
    }
  }

  // Evaluate at bounds
  let fLow = evalAt(low)
  let fHigh = evalAt(high)

  if (fLow === null || fHigh === null) {
    // Try wider range
    low = 0.001
    high = maxAbs * 10000
    fLow = evalAt(low)
    fHigh = evalAt(high)
    if (fLow === null || fHigh === null) return null
  }

  const targetDiffLow = fLow - targetOutputValue
  const targetDiffHigh = fHigh - targetOutputValue

  // Check if root is bracketed
  if (targetDiffLow * targetDiffHigh > 0) {
    // Try expanding range
    for (const factor of [1e6, 1e8, 1e10]) {
      high = maxAbs * factor
      fHigh = evalAt(high)
      if (fHigh !== null) {
        const diffHigh = fHigh - targetOutputValue
        if (targetDiffLow * diffHigh <= 0) break
      }
    }
    const finalDiffHigh = fHigh !== null ? fHigh - targetOutputValue : targetDiffHigh
    if (targetDiffLow * finalDiffHigh > 0) return null
  }

  // Bisection
  for (let i = 0; i < maxIter; i++) {
    const mid = (low + high) / 2
    const fMid = evalAt(mid)
    if (fMid === null) {
      // Narrow from the side that works
      high = mid
      continue
    }

    const diffMid = fMid - targetOutputValue

    if (Math.abs(diffMid) < tolerance) return mid

    const diffLowVal = evalAt(low)
    if (diffLowVal === null) {
      low = mid
      continue
    }
    const diffLow2 = diffLowVal - targetOutputValue

    if (diffMid * diffLow2 < 0) {
      high = mid
    } else {
      low = mid
    }
  }

  const result = (low + high) / 2
  return isFinite(result) ? result : null
}

/**
 * Solve a step bidirectionally:
 * - Forward: all inputs provided → calculate outputs
 * - Reverse: one input missing, output provided → numerical solve for missing input
 * - Partial: some outputs missing, all inputs provided → fill missing outputs
 */
function solveStep(
  step: PipelineStep,
  allValues: Record<string, string>,
  lastEdited: string | null
): { values: Record<string, string>; autoCalculated: Record<string, boolean>; error: string | null } {
  const numericInputDefs = step.inputs.filter(inp => inp.type === 'number')
  const selectInputDefs = step.inputs.filter(inp => inp.type === 'select')
  const outputDefs = step.outputs.filter(out => !out.isCompliance)

  // Collect filled numeric values
  const filledNumeric: Record<string, number> = {}
  const emptyNumericInputs: string[] = []
  const emptyNumericOutputs: string[] = []

  for (const inp of numericInputDefs) {
    const raw = allValues[inp.name]
    if (raw !== '' && raw !== undefined && raw !== null) {
      const num = Number(raw)
      if (!isNaN(num)) filledNumeric[inp.name] = num
      else emptyNumericInputs.push(inp.name)
    } else {
      emptyNumericInputs.push(inp.name)
    }
  }

  // Collect select values
  const selectValues: Record<string, string> = {}
  for (const inp of selectInputDefs) {
    const raw = allValues[inp.name]
    if (raw !== '' && raw !== undefined) selectValues[inp.name] = raw
  }

  // Collect filled output values
  const filledOutputs: Record<string, number> = {}
  for (const out of outputDefs) {
    const raw = allValues[out.name]
    if (raw !== '' && raw !== undefined && raw !== null) {
      const num = Number(raw)
      if (!isNaN(num)) filledOutputs[out.name] = num
      else emptyNumericOutputs.push(out.name)
    } else {
      emptyNumericOutputs.push(out.name)
    }
  }

  const allInputValues: Record<string, number | string> = { ...filledNumeric, ...selectValues }
  const result: Record<string, string> = { ...allValues }
  const autoCalc: Record<string, boolean> = {}
  let error: string | null = null

  // CASE 1: All numeric inputs filled → Forward calculation
  if (emptyNumericInputs.length === 0) {
    try {
      const outputs = step.calculate(allInputValues)
      for (const [key, val] of Object.entries(outputs)) {
        if (typeof val === 'number' && isFinite(val)) {
          // Only overwrite if the output was empty or was auto-calculated
          const currentVal = allValues[key]
          if (currentVal === '' || currentVal === undefined || lastEdited !== key) {
            const outDef = step.outputs.find(o => o.name === key)
            const precision = outDef?.precision ?? 4
            const rounded = Number(val.toFixed(precision))
            result[key] = String(rounded)
            autoCalc[key] = true
          }
        } else if (typeof val === 'boolean') {
          result[key] = val ? 'PASS' : 'FAIL'
          autoCalc[key] = true
        }
      }
      return { values: result, autoCalculated: autoCalc, error: null }
    } catch (err: any) {
      return { values: result, autoCalculated: autoCalc, error: err.message || 'Calculation error' }
    }
  }

  // CASE 2: One numeric input missing, at least one output provided → Reverse solve
  if (emptyNumericInputs.length === 1 && Object.keys(filledOutputs).length > 0) {
    const missingInput = emptyNumericInputs[0]
    // Use the first filled output as target
    const targetOutputName = Object.keys(filledOutputs)[0]
    const targetOutputValue = filledOutputs[targetOutputName]

    try {
      const solvedValue = numericalSolveStep(
        step,
        allInputValues,
        missingInput,
        targetOutputName,
        targetOutputValue
      )

      if (solvedValue !== null && isFinite(solvedValue)) {
        const inpDef = step.inputs.find(i => i.name === missingInput)
        const outDef = step.outputs.find(o => o.name === targetOutputName)
        const precision = inpDef?.type === 'number' ? (outDef?.precision ?? 4) : 4
        const rounded = Number(solvedValue.toFixed(precision))
        result[missingInput] = String(rounded)
        autoCalc[missingInput] = true

        // Now forward-calculate to fill any missing outputs
        const fullInputs = { ...allInputValues, [missingInput]: solvedValue }
        try {
          const outputs = step.calculate(fullInputs)
          for (const [key, val] of Object.entries(outputs)) {
            if (typeof val === 'number' && isFinite(val)) {
              if (key !== targetOutputName || emptyNumericOutputs.includes(key)) {
                const oDef = step.outputs.find(o => o.name === key)
                const prec = oDef?.precision ?? 4
                result[key] = String(Number(val.toFixed(prec)))
                autoCalc[key] = true
              }
            } else if (typeof val === 'boolean') {
              result[key] = val ? 'PASS' : 'FAIL'
              autoCalc[key] = true
            }
          }
        } catch { /* partial success */ }

        return { values: result, autoCalculated: autoCalc, error: null }
      } else {
        error = `Could not solve for ${missingInput}. Try providing a different combination.`
      }
    } catch (err: any) {
      error = `Solver error for ${missingInput}: ${err.message}`
    }

    return { values: result, autoCalculated: autoCalc, error }
  }

  // CASE 3: Multiple missing values → tell user which ones
  if (emptyNumericInputs.length > 1) {
    const missingLabels = emptyNumericInputs.map(name => {
      const inp = step.inputs.find(i => i.name === name)
      return inp?.label || name
    })
    error = `Provide values for: ${missingLabels.join(', ')}`
  }

  return { values: result, autoCalculated: autoCalc, error }
}

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

interface StepResult {
  step_number: number
  step_name: string
  inputs: Record<string, number | string>
  outputs: Record<string, number | string | boolean>
  formula_display?: string[]
  standard_ref?: string
  success: boolean
  error?: string
}

// Per-step value state: { [stepNumber]: { [varName]: string } }
type StepValues = Record<number, Record<string, string>>
type StepAutoCalc = Record<number, Record<string, boolean>>

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export function PipelinesSection() {
  const [pipelines, setPipelines] = useState<PipelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [domainFilter, setDomainFilter] = useState('all')
  const [selectedPipeline, setSelectedPipeline] = useState<EngineeringPipeline | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [stepValues, setStepValues] = useState<StepValues>({})
  const [stepAutoCalc, setStepAutoCalc] = useState<StepAutoCalc>({})
  const [stepErrors, setStepErrors] = useState<Record<number, string | null>>({})
  const [stepResults, setStepResults] = useState<StepResult[]>([])
  const [lastEdited, setLastEdited] = useState<{ step: number; varName: string } | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch pipeline list
  useEffect(() => {
    fetch('/api/pipelines')
      .then(r => r.json())
      .then(d => { if (d.success) setPipelines(d.data) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Handle pipeline selection
  const handleSelectPipeline = (p: PipelineItem) => {
    const local = ENGINEERING_PIPELINES.find(ep => ep.id === p.id)
    if (local) {
      setSelectedPipeline(local)
    } else {
      setSelectedPipeline({
        id: p.id,
        name: p.name,
        description: p.description || '',
        domain: p.domain as any,
        difficulty: (p.difficulty_level as any) || 'intermediate',
        estimated_time: p.estimated_time || '',
        icon: p.icon || '📊',
        steps: [],
      })
    }
    setCurrentStep(0)
    setStepValues({})
    setStepAutoCalc({})
    setStepErrors({})
    setStepResults([])
    setLastEdited(null)
  }

  // Initialize defaults for a step when it's first viewed
  const getStepValues = useCallback((stepIdx: number): Record<string, string> => {
    if (!selectedPipeline) return {}
    const step = selectedPipeline.steps[stepIdx]
    if (!step) return {}

    if (stepValues[stepIdx]) return stepValues[stepIdx]

    // Initialize with defaults
    const defaults: Record<string, string> = {}
    for (const inp of step.inputs) {
      if (inp.type === 'select') {
        defaults[inp.name] = String(inp.default ?? inp.options?.[0]?.value ?? '')
      } else {
        defaults[inp.name] = inp.default !== undefined ? String(inp.default) : ''
      }
    }
    for (const out of step.outputs) {
      defaults[out.name] = ''
    }
    return defaults
  }, [selectedPipeline, stepValues])

  // Auto-calculate with debounce
  const triggerAutoCalc = useCallback((stepIdx: number, values: Record<string, string>, editedVar: string) => {
    if (!selectedPipeline) return
    const step = selectedPipeline.steps[stepIdx]
    if (!step) return

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(() => {
      const { values: newValues, autoCalculated, error } = solveStep(step, values, editedVar)

      setStepValues(prev => ({
        ...prev,
        [stepIdx]: newValues,
      }))
      setStepAutoCalc(prev => ({
        ...prev,
        [stepIdx]: autoCalculated,
      }))
      setStepErrors(prev => ({
        ...prev,
        [stepIdx]: error,
      }))

      // Chain propagation: if outputs changed, push to subsequent steps
      if (selectedPipeline) {
        propagateOutputs(stepIdx, newValues, selectedPipeline)
      }
    }, 300)
  }, [selectedPipeline])

  // Propagate outputs to subsequent steps
  const propagateOutputs = useCallback((fromStepIdx: number, values: Record<string, string>, pipeline: EngineeringPipeline) => {
    const fromStep = pipeline.steps[fromStepIdx]
    if (!fromStep) return

    // Get the calculated outputs
    const outputNames = fromStep.outputs.map(o => o.name)
    const propagatedValues: Record<string, string> = {}
    for (const name of outputNames) {
      if (values[name] !== '' && values[name] !== undefined) {
        propagatedValues[name] = values[name]
      }
    }

    if (Object.keys(propagatedValues).length === 0) return

    // Push to subsequent steps
    setStepValues(prev => {
      const updated = { ...prev }
      for (let i = fromStepIdx + 1; i < pipeline.steps.length; i++) {
        const nextStep = pipeline.steps[i]
        const nextValues = { ...(updated[i] || {}) }
        let changed = false

        for (const inp of nextStep.inputs) {
          // Check fromPreviousStep or name match
          const prevStepKey = inp.fromPreviousStep || inp.name
          if (propagatedValues[prevStepKey] !== undefined && nextValues[inp.name] === '') {
            nextValues[inp.name] = propagatedValues[prevStepKey]
            changed = true
          }
        }

        if (changed) updated[i] = nextValues
      }
      return updated
    })
  }, [])

  // Handle value change for a variable in a step
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

  // Explicit calculate step (forward)
  const handleCalculateStep = () => {
    if (!selectedPipeline) return
    const step = selectedPipeline.steps[currentStep]
    if (!step) return

    const values = getStepValues(currentStep)

    // Build inputs from values
    const filledInputs: Record<string, number | string> = {}
    for (const inp of step.inputs) {
      const val = values[inp.name]
      if (val !== '' && val !== undefined) {
        if (inp.type === 'number') {
          filledInputs[inp.name] = Number(val)
        } else {
          filledInputs[inp.name] = val
        }
      } else if (inp.default !== undefined) {
        filledInputs[inp.name] = inp.default
      }
    }

    try {
      const outputs = step.calculate(filledInputs)
      const result: StepResult = {
        step_number: step.stepNumber,
        step_name: step.name,
        inputs: filledInputs,
        outputs,
        formula_display: step.formula_display,
        standard_ref: step.standard_ref,
        success: true,
      }

      // Update step values with calculated outputs
      const newValues = { ...values }
      const autoCalc: Record<string, boolean> = {}
      for (const [key, val] of Object.entries(outputs)) {
        if (typeof val === 'number') {
          const outDef = step.outputs.find(o => o.name === key)
          const precision = outDef?.precision ?? 4
          newValues[key] = String(Number(val.toFixed(precision)))
          autoCalc[key] = true
        } else if (typeof val === 'boolean') {
          newValues[key] = val ? 'PASS' : 'FAIL'
          autoCalc[key] = true
        }
      }

      setStepValues(prev => ({ ...prev, [currentStep]: newValues }))
      setStepAutoCalc(prev => ({ ...prev, [currentStep]: autoCalc }))
      setStepErrors(prev => ({ ...prev, [currentStep]: null }))
      setStepResults(prev => [...prev.filter(r => r.step_number !== step.stepNumber), result])

      // Propagate
      propagateOutputs(currentStep, newValues, selectedPipeline)

      // Auto-advance
      if (currentStep < selectedPipeline.steps.length - 1) {
        setCurrentStep(currentStep + 1)
      }
    } catch (err: any) {
      const result: StepResult = {
        step_number: step.stepNumber,
        step_name: step.name,
        inputs: filledInputs,
        outputs: {},
        success: false,
        error: err.message,
      }
      setStepResults(prev => [...prev.filter(r => r.step_number !== step.stepNumber), result])
      setStepErrors(prev => ({ ...prev, [currentStep]: err.message }))
    }
  }

  // Run all steps
  const handleRunAll = () => {
    if (!selectedPipeline) return
    setStepResults([])

    const allInputs: Record<string, number | string> = {}
    const allResults: StepResult[] = []
    const newStepValues: StepValues = { ...stepValues }
    const newAutoCalc: StepAutoCalc = { ...stepAutoCalc }

    for (let i = 0; i < selectedPipeline.steps.length; i++) {
      const step = selectedPipeline.steps[i]
      const values = getStepValues(i)

      const filledInputs: Record<string, number | string> = {}
      for (const inp of step.inputs) {
        const val = values[inp.name]
        const prevStepKey = inp.fromPreviousStep || inp.name
        if (val !== '' && val !== undefined) {
          filledInputs[inp.name] = inp.type === 'number' ? Number(val) : val
        } else if (allInputs[inp.name] !== undefined) {
          filledInputs[inp.name] = allInputs[inp.name]
        } else if (allInputs[prevStepKey] !== undefined) {
          filledInputs[inp.name] = allInputs[prevStepKey]
        } else if (inp.default !== undefined) {
          filledInputs[inp.name] = inp.default
        }
      }

      try {
        const outputs = step.calculate(filledInputs)
        allResults.push({
          step_number: step.stepNumber,
          step_name: step.name,
          inputs: filledInputs,
          outputs,
          formula_display: step.formula_display,
          standard_ref: step.standard_ref,
          success: true,
        })
        Object.assign(allInputs, filledInputs, outputs)

        // Update step values
        const stepVals = { ...values }
        const stepAuto: Record<string, boolean> = {}
        for (const inp of step.inputs) {
          if (filledInputs[inp.name] !== undefined) {
            stepVals[inp.name] = String(filledInputs[inp.name])
          }
        }
        for (const [key, val] of Object.entries(outputs)) {
          if (typeof val === 'number') {
            const outDef = step.outputs.find(o => o.name === key)
            const precision = outDef?.precision ?? 4
            stepVals[key] = String(Number(val.toFixed(precision)))
            stepAuto[key] = true
          } else if (typeof val === 'boolean') {
            stepVals[key] = val ? 'PASS' : 'FAIL'
            stepAuto[key] = true
          }
        }
        newStepValues[i] = stepVals
        newAutoCalc[i] = stepAuto
      } catch (err: any) {
        allResults.push({
          step_number: step.stepNumber,
          step_name: step.name,
          inputs: filledInputs,
          outputs: {},
          success: false,
          error: err.message,
        })
        break
      }
    }

    setStepResults(allResults)
    setStepValues(newStepValues)
    setStepAutoCalc(newAutoCalc)
    setCurrentStep(selectedPipeline.steps.length - 1)
  }

  // Reset step
  const handleResetStep = () => {
    if (!selectedPipeline) return
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

  // Reset all
  const handleResetAll = () => {
    setStepValues({})
    setStepAutoCalc({})
    setStepErrors({})
    setStepResults([])
    setCurrentStep(0)
    setLastEdited(null)
  }

  const filteredPipelines = pipelines.filter(p => {
    if (domainFilter !== 'all' && p.domain !== domainFilter) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !(p.description || '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Render a single step's variable editor
  const renderStepEditor = (step: PipelineStep, stepIdx: number) => {
    const values = getStepValues(stepIdx)
    const autoCalc = stepAutoCalc[stepIdx] || {}
    const error = stepErrors[stepIdx]

    return (
      <div className="space-y-4">
        {/* Step Header */}
        <div>
          <h3 className="font-semibold text-lg">{step.name}</h3>
          <p className="text-sm text-muted-foreground">{step.description}</p>
          {step.standard_ref && (
            <Badge variant="outline" className="mt-1 text-[10px]">{step.standard_ref}</Badge>
          )}
        </div>

        {/* Formula Display */}
        {step.formula_display && step.formula_display.length > 0 && (
          <div className="bg-muted p-3 rounded-lg font-mono text-xs space-y-1">
            {step.formula_display.map((f, i) => (
              <div key={i}>{f}</div>
            ))}
          </div>
        )}

        <Separator />

        {/* Input Parameters */}
        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Variable className="h-4 w-4 text-emerald-600" />
            Input Parameters
          </h4>
          <div className="grid gap-3 md:grid-cols-2">
            {step.inputs.map(inp => {
              const isAuto = autoCalc[inp.name]
              const prevStepKey = inp.fromPreviousStep || inp.name
              const isPropagated = inp.fromPreviousStep && values[inp.name] !== '' && values[inp.name] !== undefined

              return (
                <div key={inp.name} className="space-y-1">
                  <label className="text-xs font-medium flex items-center gap-1 flex-wrap">
                    <span>{inp.label}</span>
                    {inp.unit && <span className="text-muted-foreground">({inp.unit})</span>}
                    {isAuto && (
                      <Badge className="text-[8px] h-4 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0 px-1">
                        auto
                      </Badge>
                    )}
                    {isPropagated && !isAuto && (
                      <Badge className="text-[8px] h-4 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 border-0 px-1">
                        <Link2 className="h-2.5 w-2.5 mr-0.5" />
                        linked
                      </Badge>
                    )}
                  </label>
                  {inp.type === 'select' && inp.options ? (
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
                        placeholder={`Enter ${inp.label}`}
                        className={`pr-12 ${isAuto ? 'border-emerald-400 bg-emerald-50/60 dark:border-emerald-600 dark:bg-emerald-950/30' : ''}`}
                        step="any"
                      />
                      {inp.unit && (
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                          {inp.unit}
                        </span>
                      )}
                    </div>
                  )}
                  {inp.help && <p className="text-[10px] text-muted-foreground">{inp.help}</p>}
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
          <div className="grid gap-3 md:grid-cols-2">
            {step.outputs.map(out => {
              const isAuto = autoCalc[out.name]
              const isCompliance = out.isCompliance
              const rawVal = values[out.name] ?? ''
              const displayVal = isCompliance && rawVal ? rawVal : rawVal

              if (isCompliance && rawVal) {
                // Compliance badge
                const isPass = rawVal === 'PASS' || rawVal === 'true'
                return (
                  <div key={out.name} className="space-y-1">
                    <label className="text-xs font-medium flex items-center gap-1">
                      <span>{out.label}</span>
                    </label>
                    <div className={`flex items-center gap-2 p-2 rounded-md border ${
                      isPass
                        ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30'
                        : 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30'
                    }`}>
                      {isPass ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span className={`text-sm font-semibold ${isPass ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                        {isPass ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                  </div>
                )
              }

              return (
                <div key={out.name} className="space-y-1">
                  <label className="text-xs font-medium flex items-center gap-1 flex-wrap">
                    <span>{out.label || out.name}</span>
                    {out.unit && <span className="text-muted-foreground">({out.unit})</span>}
                    {isAuto && (
                      <Badge className="text-[8px] h-4 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0 px-1">
                        calculated
                      </Badge>
                    )}
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={displayVal}
                      onChange={e => handleValueChange(stepIdx, out.name, e.target.value)}
                      placeholder={isAuto ? 'Auto-calculated' : `Enter ${out.label || out.name}`}
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
          <Button onClick={handleCalculateStep} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
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
              <SelectItem value="electrical">Electrical</SelectItem>
              <SelectItem value="mechanical">Mechanical</SelectItem>
              <SelectItem value="civil">Civil</SelectItem>
              <SelectItem value="hvac">HVAC</SelectItem>
              <SelectItem value="hydraulics">Hydraulics</SelectItem>
            </SelectContent>
          </Select>

          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="space-y-2">
              {loading ? (
                <p className="text-sm text-muted-foreground p-4">Loading pipelines...</p>
              ) : filteredPipelines.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">No pipelines found</p>
              ) : (
                filteredPipelines.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPipeline(p)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedPipeline?.id === p.id ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{p.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{p.name}</div>
                        <div className="flex gap-1 mt-1">
                          <Badge variant="secondary" className="text-[10px] capitalize">{p.domain}</Badge>
                          <Badge variant="outline" className="text-[10px]">{p.step_count} steps</Badge>
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
          {selectedPipeline ? (
            <div className="space-y-4">
              {/* Pipeline Header */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{selectedPipeline.icon}</span>
                    <div>
                      <CardTitle>{selectedPipeline.name}</CardTitle>
                      <CardDescription>{selectedPipeline.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Badge className="capitalize bg-emerald-600">{selectedPipeline.domain}</Badge>
                    <Badge variant="outline">{selectedPipeline.difficulty}</Badge>
                    <Badge variant="outline">{selectedPipeline.estimated_time}</Badge>
                    <Badge variant="outline">{selectedPipeline.steps.length} steps</Badge>
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
              {selectedPipeline.steps.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    {/* Step Navigation */}
                    <div className="flex items-center justify-between">
                      <Button variant="outline" size="sm" onClick={() => setCurrentStep(Math.max(0, currentStep - 1))} disabled={currentStep === 0}>
                        <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                      </Button>
                      <span className="text-sm font-medium">
                        Step {currentStep + 1} of {selectedPipeline.steps.length}
                      </span>
                      <Button variant="outline" size="sm" onClick={() => setCurrentStep(Math.min(selectedPipeline.steps.length - 1, currentStep + 1))} disabled={currentStep >= selectedPipeline.steps.length - 1}>
                        Next <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>

                    {/* Step Progress Bar */}
                    <Progress value={((currentStep + 1) / selectedPipeline.steps.length) * 100} className="h-1.5" />

                    {/* Step Pills */}
                    <div className="flex gap-1.5 mt-1 overflow-x-auto pb-1">
                      {selectedPipeline.steps.map((s, idx) => {
                        const hasValues = stepValues[idx] && Object.values(stepValues[idx]).some(v => v !== '' && v !== undefined)
                        const hasResult = stepResults.some(r => r.step_number === s.stepNumber && r.success)
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
                            {s.name.length > 18 ? s.name.substring(0, 18) + '...' : s.name}
                            {hasResult && <CheckCircle2 className="h-3 w-3 ml-1 inline" />}
                          </button>
                        )
                      })}
                    </div>
                  </CardHeader>

                  <CardContent>
                    {renderStepEditor(selectedPipeline.steps[currentStep], currentStep)}
                  </CardContent>
                </Card>
              )}

              {/* Run All & Reset */}
              {selectedPipeline.steps.length > 0 && (
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
              )}

              {/* Results Summary */}
              {stepResults.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Calculation Results
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {stepResults.map(result => (
                      <div key={result.step_number} className={`p-3 rounded-lg border ${
                        result.success
                          ? 'border-emerald-200 dark:border-emerald-800'
                          : 'border-red-200 dark:border-red-800'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          {result.success ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          <span className="font-medium text-sm">Step {result.step_number}: {result.step_name}</span>
                        </div>
                        {result.success ? (
                          <div className="grid gap-1 md:grid-cols-2">
                            {Object.entries(result.outputs).map(([key, val]) => (
                              <div key={key} className="flex justify-between text-xs bg-muted p-1.5 rounded">
                                <span>{key}</span>
                                <span className="font-mono">
                                  {typeof val === 'boolean' ? (val ? '✅ PASS' : '❌ FAIL') : String(val)}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-red-600 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> {result.error}
                          </p>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* How It Works */}
              {selectedPipeline.steps.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Info className="h-4 w-4 text-emerald-600" />
                      Bidirectional Solving
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                        <p><strong>Forward:</strong> Fill all input values → outputs are auto-calculated</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                        <p><strong>Reverse:</strong> Fill output + other inputs → missing input is numerically solved</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                        <p><strong>Chain:</strong> Calculated outputs automatically propagate to subsequent steps</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                        <p><strong>Real-time:</strong> Auto-calculates after 300ms debounce as you type</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card className="flex items-center justify-center h-64">
              <div className="text-center text-muted-foreground">
                <GitBranch className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Select a pipeline to begin</p>
                <p className="text-sm mt-1">Fill any variable and the unknown is auto-calculated</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
