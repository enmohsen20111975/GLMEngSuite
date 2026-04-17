'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  Calculator,
  Search,
  Play,
  RotateCcw,
  ChevronDown,
  Info,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'

interface Equation {
  id: string
  name: string
  formula: string
  description: string | null
  domain: string
  category: string
  difficulty: string
  reference: string | null
  inputs: EquationInput[]
  outputs: EquationOutput[]
  categoryRef?: { name: string; icon: string | null }
}

interface EquationInput {
  id: string
  name: string
  symbol: string
  unit: string | null
  defaultVal: string | null
  min: string | null
  max: string | null
}

interface EquationOutput {
  id: string
  name: string
  symbol: string
  unit: string | null
  formula: string | null
}

const domainColors: Record<string, string> = {
  electrical: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  mechanical: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  civil: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  hvac: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  hydraulic: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  thermodynamics: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  chemical: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  structural: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
}

const difficultyColors: Record<string, string> = {
  beginner: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  intermediate: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  advanced: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export function CalculatorsSection() {
  const [equations, setEquations] = React.useState<Equation[]>([])
  const [categories, setCategories] = React.useState<{ id: string; name: string; slug: string; domain: string; _count: { equations: number } }[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [selectedDomain, setSelectedDomain] = React.useState('all')
  const [selectedEquation, setSelectedEquation] = React.useState<Equation | null>(null)
  const [inputValues, setInputValues] = React.useState<Record<string, string>>({})
  const [solving, setSolving] = React.useState(false)
  const [results, setResults] = React.useState<Record<string, number> | null>(null)

  React.useEffect(() => {
    async function loadData() {
      try {
        const [eqRes, catRes] = await Promise.all([
          fetch('/api/equations'),
          fetch('/api/categories'),
        ])
        if (eqRes.ok) setEquations(await eqRes.json())
        if (catRes.ok) setCategories(await catRes.json())
      } catch (err) {
        console.error('Failed to load data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const filteredEquations = React.useMemo(() => {
    return equations.filter(eq => {
      const matchesSearch = !search || 
        eq.name.toLowerCase().includes(search.toLowerCase()) ||
        eq.description?.toLowerCase().includes(search.toLowerCase()) ||
        eq.formula.toLowerCase().includes(search.toLowerCase())
      const matchesDomain = selectedDomain === 'all' || eq.domain === selectedDomain
      return matchesSearch && matchesDomain
    })
  }, [equations, search, selectedDomain])

  const selectEquation = (eq: Equation) => {
    setSelectedEquation(eq)
    setResults(null)
    const defaults: Record<string, string> = {}
    eq.inputs.forEach(input => {
      defaults[input.symbol] = input.defaultVal || ''
    })
    setInputValues(defaults)
  }

  const handleSolve = async () => {
    if (!selectedEquation) return
    setSolving(true)
    try {
      const numericInputs: Record<string, number> = {}
      for (const [key, val] of Object.entries(inputValues)) {
        if (val !== '' && !isNaN(Number(val))) {
          numericInputs[key] = Number(val)
        }
      }

      const res = await fetch('/api/equations/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equationId: selectedEquation.id,
          inputs: numericInputs,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setResults(data.results)
        toast.success('Equation solved successfully!')
      } else {
        toast.error('Failed to solve equation')
      }
    } catch (err) {
      console.error('Solve error:', err)
      toast.error('Error solving equation')
    } finally {
      setSolving(false)
    }
  }

  const handleReset = () => {
    if (selectedEquation) {
      selectEquation(selectedEquation)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Calculator className="h-5 w-5 text-emerald-600" />
            Engineering Calculators
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Browse and solve {equations.length} engineering equations
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search equations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={selectedDomain} onValueChange={setSelectedDomain}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Domains" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Domains</SelectItem>
            <SelectItem value="electrical">Electrical</SelectItem>
            <SelectItem value="mechanical">Mechanical</SelectItem>
            <SelectItem value="civil">Civil</SelectItem>
            <SelectItem value="hvac">HVAC</SelectItem>
            <SelectItem value="hydraulic">Hydraulic</SelectItem>
            <SelectItem value="thermodynamics">Thermodynamics</SelectItem>
            <SelectItem value="chemical">Chemical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-[300px_1fr] gap-4">
        {/* Equation List */}
        <Card className="lg:max-h-[calc(100vh-220px)] overflow-hidden flex flex-col">
          <CardHeader className="pb-2 shrink-0">
            <CardTitle className="text-sm">
              Equations ({filteredEquations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 overflow-y-auto flex-1">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredEquations.map(eq => (
                  <button
                    key={eq.id}
                    onClick={() => selectEquation(eq)}
                    className={`w-full text-left p-3 rounded-lg transition-all hover:bg-accent ${
                      selectedEquation?.id === eq.id
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                        : 'border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{eq.name}</span>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] shrink-0 ${domainColors[eq.domain] || ''}`}
                      >
                        {eq.domain}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                      {eq.formula}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Calculator Panel */}
        <div className="space-y-4">
          {selectedEquation ? (
            <>
              {/* Equation Details */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{selectedEquation.name}</CardTitle>
                    <div className="flex gap-2">
                      <Badge className={domainColors[selectedEquation.domain] || ''}>
                        {selectedEquation.domain}
                      </Badge>
                      <Badge className={difficultyColors[selectedEquation.difficulty] || ''}>
                        {selectedEquation.difficulty}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription>{selectedEquation.description}</CardDescription>
                  <div className="mt-3 p-3 rounded-lg bg-muted font-mono text-center text-lg">
                    {selectedEquation.formula}
                  </div>
                  {selectedEquation.reference && (
                    <p className="text-xs text-muted-foreground mt-2">
                      📖 Reference: {selectedEquation.reference}
                    </p>
                  )}
                </CardHeader>
              </Card>

              {/* Input/Output Grid */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Inputs */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Inputs</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedEquation.inputs.map(input => (
                      <div key={input.id} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">
                            {input.name}{' '}
                            <span className="text-muted-foreground font-mono">
                              ({input.symbol})
                            </span>
                          </label>
                          {input.unit && (
                            <Badge variant="outline" className="text-[10px]">
                              {input.unit}
                            </Badge>
                          )}
                        </div>
                        <Input
                          type="number"
                          placeholder={input.defaultVal || '0'}
                          value={inputValues[input.symbol] || ''}
                          onChange={(e) =>
                            setInputValues(prev => ({
                              ...prev,
                              [input.symbol]: e.target.value,
                            }))
                          }
                          step="any"
                        />
                        {input.min && input.max && (
                          <p className="text-[10px] text-muted-foreground">
                            Range: {input.min} — {input.max}
                          </p>
                        )}
                      </div>
                    ))}
                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={handleSolve}
                        disabled={solving}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      >
                        {solving ? (
                          <span className="flex items-center gap-2">
                            <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Solving...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <Play className="h-4 w-4" />
                            Solve
                          </span>
                        )}
                      </Button>
                      <Button variant="outline" onClick={handleReset} size="icon">
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Outputs */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                      Results
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {results ? (
                      <div className="space-y-3">
                        {selectedEquation.outputs.map(output => (
                          <div
                            key={output.id}
                            className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                {output.name}{' '}
                                <span className="text-muted-foreground font-mono">
                                  ({output.symbol})
                                </span>
                              </span>
                              {output.unit && (
                                <Badge variant="outline" className="text-[10px]">
                                  {output.unit}
                                </Badge>
                              )}
                            </div>
                            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                              {isNaN(results[output.symbol])
                                ? 'Error'
                                : typeof results[output.symbol] === 'number'
                                ? Number(results[output.symbol].toFixed(6))
                                : results[output.symbol]}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <Calculator className="h-10 w-10 mb-2 opacity-30" />
                        <p className="text-sm">Enter input values and click Solve</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card className="flex flex-col items-center justify-center py-16">
              <Calculator className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <h3 className="text-lg font-medium">Select an Equation</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Choose an equation from the list to start calculating
              </p>
            </Card>
          )}
        </div>
      </div>
    </motion.div>
  )
}
