'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Search, Play, GitBranch, ChevronRight, ChevronLeft, CheckCircle2, XCircle, FileText, AlertTriangle } from 'lucide-react'
import { ENGINEERING_PIPELINES, type EngineeringPipeline, type PipelineStep } from '@/lib/engineering-pipelines'

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

export function PipelinesSection() {
  const [pipelines, setPipelines] = useState<PipelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [domainFilter, setDomainFilter] = useState('all')
  const [selectedPipeline, setSelectedPipeline] = useState<EngineeringPipeline | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [stepInputs, setStepInputs] = useState<Record<string, Record<string, number | string>>>({})
  const [stepResults, setStepResults] = useState<StepResult[]>([])
  const [accumulated, setAccumulated] = useState<Record<string, number | string>>({})

  useEffect(() => {
    fetch('/api/pipelines')
      .then(r => r.json())
      .then(d => { if (d.success) setPipelines(d.data) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleSelectPipeline = (p: PipelineItem) => {
    const local = ENGINEERING_PIPELINES.find(ep => ep.id === p.id)
    if (local) {
      setSelectedPipeline(local)
    } else {
      // For DB pipelines, create a simplified version
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
    setStepInputs({})
    setStepResults([])
    setAccumulated({})
  }

  const handleCalculateStep = () => {
    if (!selectedPipeline) return
    const step = selectedPipeline.steps[currentStep]
    if (!step) return

    const inputs = stepInputs[currentStep] || {}

    // Fill fromPreviousStep
    const filledInputs: Record<string, number | string> = {}
    for (const inp of step.inputs) {
      const val = inputs[inp.name] ?? accumulated[inp.name] ?? accumulated[inp.fromPreviousStep || ''] ?? inp.default
      if (val !== undefined) filledInputs[inp.name] = val
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
      setStepResults(prev => [...prev.filter(r => r.step_number !== step.stepNumber), result])
      setAccumulated(prev => ({ ...prev, ...filledInputs, ...outputs }))
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
    }
  }

  const handleRunAll = async () => {
    if (!selectedPipeline) return
    setStepResults([])
    setCurrentStep(0)

    const allInputs: Record<string, number | string> = {}
    const allResults: StepResult[] = {}

    for (const step of selectedPipeline.steps) {
      const filledInputs: Record<string, number | string> = {}
      for (const inp of step.inputs) {
        const val = stepInputs[step.stepNumber]?.[inp.name] ?? allInputs[inp.name] ?? allInputs[inp.fromPreviousStep || ''] ?? inp.default
        if (val !== undefined) filledInputs[inp.name] = val
      }

      try {
        const outputs = step.calculate(filledInputs)
        allResults[step.stepNumber] = {
          step_number: step.stepNumber,
          step_name: step.name,
          inputs: filledInputs,
          outputs,
          formula_display: step.formula_display,
          standard_ref: step.standard_ref,
          success: true,
        }
        Object.assign(allInputs, filledInputs, outputs)
      } catch (err: any) {
        allResults[step.stepNumber] = {
          step_number: step.stepNumber,
          step_name: step.name,
          inputs: filledInputs,
          outputs: {},
          success: false,
          error: err.message,
        }
        break
      }
    }

    setStepResults(Object.values(allResults))
    setAccumulated(allInputs)
    setCurrentStep(selectedPipeline.steps.length - 1)
  }

  const filteredPipelines = pipelines.filter(p => {
    if (domainFilter !== 'all' && p.domain !== domainFilter) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !(p.description || '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Engineering Pipelines</h1>
        <p className="text-muted-foreground">Multi-step engineering calculations with IEC/EN/NEC standards compliance</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Pipeline List */}
        <div className="lg:w-80 space-y-4">
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
              {filteredPipelines.map(p => (
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
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Pipeline Detail */}
        <div className="flex-1">
          {selectedPipeline ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{selectedPipeline.icon}</span>
                    <div>
                      <CardTitle>{selectedPipeline.name}</CardTitle>
                      <CardDescription>{selectedPipeline.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Badge className="capitalize">{selectedPipeline.domain}</Badge>
                    <Badge variant="outline">{selectedPipeline.difficulty}</Badge>
                    <Badge variant="outline">{selectedPipeline.estimated_time}</Badge>
                    <Badge variant="outline">{selectedPipeline.steps.length} steps</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {selectedPipeline.steps.length > 0 && (
                    <>
                      <div className="flex items-center justify-between mb-4">
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

                      <Progress value={((currentStep + 1) / selectedPipeline.steps.length) * 100} className="mb-4" />

                      {/* Current Step */}
                      {(() => {
                        const step = selectedPipeline.steps[currentStep]
                        if (!step) return null
                        return (
                          <div className="space-y-4">
                            <div>
                              <h3 className="font-semibold text-lg">{step.name}</h3>
                              <p className="text-sm text-muted-foreground">{step.description}</p>
                              {step.standard_ref && (
                                <Badge variant="outline" className="mt-1 text-[10px]">{step.standard_ref}</Badge>
                              )}
                            </div>

                            {step.formula_display && step.formula_display.length > 0 && (
                              <div className="bg-muted p-3 rounded-lg font-mono text-xs space-y-1">
                                {step.formula_display.map((f, i) => (
                                  <div key={i}>{f}</div>
                                ))}
                              </div>
                            )}

                            <Separator />

                            <div className="grid gap-3 md:grid-cols-2">
                              {step.inputs.map(inp => (
                                <div key={inp.name} className="space-y-1">
                                  <label className="text-xs font-medium">
                                    {inp.label}
                                    {inp.unit && <span className="text-muted-foreground ml-1">({inp.unit})</span>}
                                  </label>
                                  {inp.type === 'select' && inp.options ? (
                                    <Select
                                      value={String(stepInputs[currentStep]?.[inp.name] ?? inp.default ?? '')}
                                      onValueChange={v => setStepInputs(prev => ({
                                        ...prev,
                                        [currentStep]: { ...prev[currentStep], [inp.name]: v }
                                      }))}
                                    >
                                      <SelectTrigger><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        {inp.options.map(opt => (
                                          <SelectItem key={String(opt.value)} value={String(opt.value)}>{opt.label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Input
                                      type="number"
                                      value={stepInputs[currentStep]?.[inp.name] ?? accumulated[inp.name] ?? accumulated[inp.fromPreviousStep || ''] ?? inp.default ?? ''}
                                      onChange={e => setStepInputs(prev => ({
                                        ...prev,
                                        [currentStep]: { ...prev[currentStep], [inp.name]: parseFloat(e.target.value) || 0 }
                                      }))}
                                    />
                                  )}
                                  {inp.help && <p className="text-[10px] text-muted-foreground">{inp.help}</p>}
                                </div>
                              ))}
                            </div>

                            <div className="flex gap-2">
                              <Button onClick={handleCalculateStep} className="flex-1">
                                <Play className="h-4 w-4 mr-2" />
                                Calculate Step {step.stepNumber}
                              </Button>
                              <Button onClick={handleRunAll} variant="outline" className="flex-1">
                                <GitBranch className="h-4 w-4 mr-2" />
                                Run All Steps
                              </Button>
                            </div>
                          </div>
                        )
                      })()}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Results */}
              {stepResults.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Calculation Results
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {stepResults.map(result => (
                      <div key={result.step_number} className={`p-3 rounded-lg border ${result.success ? 'border-emerald-200 dark:border-emerald-800' : 'border-red-200 dark:border-red-800'}`}>
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
                                <span className="font-mono">{typeof val === 'boolean' ? (val ? '✅ PASS' : '❌ FAIL') : String(val)}</span>
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
            </div>
          ) : (
            <Card className="flex items-center justify-center h-64">
              <div className="text-center text-muted-foreground">
                <GitBranch className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Select a pipeline to begin</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
