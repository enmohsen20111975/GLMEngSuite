'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  GitBranch,
  ChevronRight,
  Play,
  RotateCcw,
  CheckCircle2,
  Circle,
  Loader2,
  FileText,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

interface PipelineStep {
  id: string
  name: string
  description: string | null
  order: number
  formula: string | null
  inputSchema: string | null
  outputSchema: string | null
  helperText: string | null
}

interface Pipeline {
  id: string
  name: string
  description: string | null
  domain: string
  category: string | null
  difficulty: string
  steps: PipelineStep[]
}

const domainColors: Record<string, string> = {
  electrical: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  mechanical: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  civil: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  hvac: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  hydraulic: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
}

export function PipelinesSection() {
  const [pipelines, setPipelines] = React.useState<Pipeline[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedPipeline, setSelectedPipeline] = React.useState<Pipeline | null>(null)
  const [currentStep, setCurrentStep] = React.useState(0)
  const [stepInputs, setStepInputs] = React.useState<Record<string, Record<string, string>>>({})
  const [executing, setExecuting] = React.useState(false)
  const [stepResults, setStepResults] = React.useState<Array<{
    stepName: string
    outputs: Record<string, number>
  }> | null>(null)

  React.useEffect(() => {
    async function loadPipelines() {
      try {
        const res = await fetch('/api/pipelines')
        if (res.ok) {
          setPipelines(await res.json())
        }
      } catch (err) {
        console.error('Failed to load pipelines:', err)
      } finally {
        setLoading(false)
      }
    }
    loadPipelines()
  }, [])

  const selectPipeline = (p: Pipeline) => {
    setSelectedPipeline(p)
    setCurrentStep(0)
    setStepResults(null)
    const inputs: Record<string, Record<string, string>> = {}
    p.steps.forEach(step => {
      if (step.inputSchema) {
        try {
          const schema = JSON.parse(step.inputSchema)
          const defaults: Record<string, string> = {}
          for (const [key, config] of Object.entries(schema as Record<string, unknown>)) {
            const cfg = config as { default?: number; symbol?: string }
            defaults[key] = cfg.default?.toString() || ''
          }
          inputs[step.id] = defaults
        } catch {
          inputs[step.id] = {}
        }
      }
    })
    setStepInputs(inputs)
  }

  const parseInputSchema = (schema: string | null) => {
    if (!schema) return []
    try {
      const parsed = JSON.parse(schema)
      return Object.entries(parsed as Record<string, unknown>).map(([key, config]) => {
        const cfg = config as { symbol?: string; unit?: string; default?: number; description?: string; min?: number; max?: number }
        return {
          key,
          symbol: cfg.symbol || key,
          unit: cfg.unit || '',
          default: cfg.default,
          description: cfg.description || '',
          min: cfg.min,
          max: cfg.max,
        }
      })
    } catch {
      return []
    }
  }

  const handleExecute = async () => {
    if (!selectedPipeline) return
    setExecuting(true)
    try {
      // Convert string inputs to numbers
      const numericInputs: Record<string, Record<string, number>> = {}
      for (const [stepId, inputs] of Object.entries(stepInputs)) {
        numericInputs[stepId] = {}
        for (const [key, val] of Object.entries(inputs)) {
          if (val !== '' && !isNaN(Number(val))) {
            numericInputs[stepId][key] = Number(val)
          }
        }
      }

      const res = await fetch('/api/pipelines/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipelineId: selectedPipeline.id,
          stepInputs: numericInputs,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setStepResults(data.steps)
        setCurrentStep(selectedPipeline.steps.length)
        toast.success('Pipeline executed successfully!')
      } else {
        toast.error('Failed to execute pipeline')
      }
    } catch (err) {
      console.error('Execute error:', err)
      toast.error('Error executing pipeline')
    } finally {
      setExecuting(false)
    }
  }

  const progress = selectedPipeline
    ? Math.round((currentStep / selectedPipeline.steps.length) * 100)
    : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-emerald-600" />
          Calculation Pipelines
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Multi-step engineering calculations with guided workflows
        </p>
      </div>

      <div className="grid lg:grid-cols-[300px_1fr] gap-4">
        {/* Pipeline List */}
        <Card className="lg:max-h-[calc(100vh-220px)] overflow-hidden flex flex-col">
          <CardHeader className="pb-2 shrink-0">
            <CardTitle className="text-sm">Pipelines ({pipelines.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-2 overflow-y-auto flex-1">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {pipelines.map(p => (
                  <button
                    key={p.id}
                    onClick={() => selectPipeline(p)}
                    className={`w-full text-left p-3 rounded-lg transition-all hover:bg-accent ${
                      selectedPipeline?.id === p.id
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                        : 'border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{p.name}</span>
                      <Badge className={`text-[10px] shrink-0 ${domainColors[p.domain] || ''}`}>
                        {p.domain}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {p.description || `${p.steps.length} steps`}
                    </p>
                    <div className="flex items-center gap-1 mt-2">
                      {p.steps.map((_, i) => (
                        <div key={i} className="h-1 flex-1 rounded-full bg-muted" />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pipeline Wizard */}
        <div className="space-y-4">
          {selectedPipeline ? (
            <>
              {/* Pipeline Header */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selectedPipeline.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {selectedPipeline.description || `A ${selectedPipeline.steps.length}-step ${selectedPipeline.domain} calculation pipeline`}
                      </CardDescription>
                    </div>
                    <Badge className={domainColors[selectedPipeline.domain] || ''}>
                      {selectedPipeline.domain}
                    </Badge>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Progress</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                </CardHeader>
              </Card>

              {/* Steps */}
              <div className="space-y-3">
                {selectedPipeline.steps.map((step, idx) => {
                  const isCompleted = stepResults && idx < currentStep
                  const isCurrent = idx === currentStep && !stepResults
                  const fields = parseInputSchema(step.inputSchema)

                  return (
                    <Card
                      key={step.id}
                      className={`transition-all ${
                        isCurrent
                          ? 'border-emerald-300 dark:border-emerald-700 shadow-md'
                          : isCompleted
                          ? 'opacity-75'
                          : 'opacity-50'
                      }`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
                            isCompleted
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : isCurrent
                              ? 'bg-emerald-600 text-white'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {isCompleted ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              idx + 1
                            )}
                          </div>
                          <div className="flex-1">
                            <CardTitle className="text-sm">{step.name}</CardTitle>
                            {step.description && (
                              <CardDescription className="text-xs">{step.description}</CardDescription>
                            )}
                          </div>
                          {step.helperText && (
                            <Badge variant="outline" className="text-[10px]">
                              {step.helperText}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      {(isCurrent || (isCompleted && stepResults)) && (
                        <CardContent>
                          {isCurrent && fields.length > 0 && (
                            <div className="grid sm:grid-cols-2 gap-3 mt-2">
                              {fields.map(field => (
                                <div key={field.key} className="space-y-1">
                                  <label className="text-xs font-medium">
                                    {field.description || field.key}{' '}
                                    <span className="text-muted-foreground font-mono">
                                      ({field.symbol})
                                    </span>
                                    {field.unit && (
                                      <span className="text-muted-foreground"> [{field.unit}]</span>
                                    )}
                                  </label>
                                  <Input
                                    type="number"
                                    placeholder={field.default?.toString() || '0'}
                                    value={stepInputs[step.id]?.[field.key] || ''}
                                    onChange={(e) =>
                                      setStepInputs(prev => ({
                                        ...prev,
                                        [step.id]: {
                                          ...prev[step.id],
                                          [field.key]: e.target.value,
                                        },
                                      }))
                                    }
                                    step="any"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                          {isCompleted && stepResults?.[idx] && (
                            <div className="mt-2 p-2 rounded bg-emerald-50 dark:bg-emerald-900/20">
                              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1">Results:</p>
                              <div className="grid sm:grid-cols-2 gap-2">
                                {Object.entries(stepResults[idx].outputs).map(([key, value]) => (
                                  <div key={key} className="text-xs">
                                    <span className="font-mono">{key}:</span>{' '}
                                    <span className="font-bold">
                                      {typeof value === 'number' ? value.toFixed(4) : value}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  )
                })}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={handleExecute}
                  disabled={executing}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  {executing ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Executing Pipeline...
                    </span>
                  ) : stepResults ? (
                    <span className="flex items-center gap-2">
                      <RotateCcw className="h-4 w-4" />
                      Re-execute Pipeline
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Play className="h-4 w-4" />
                      Execute Pipeline
                    </span>
                  )}
                </Button>
                {stepResults && (
                  <Button variant="outline" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Export Report
                  </Button>
                )}
              </div>
            </>
          ) : (
            <Card className="flex flex-col items-center justify-center py-16">
              <GitBranch className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <h3 className="text-lg font-medium">Select a Pipeline</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Choose a calculation pipeline to get started
              </p>
            </Card>
          )}
        </div>
      </div>
    </motion.div>
  )
}
