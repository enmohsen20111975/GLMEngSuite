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
import { Search, Play, BookOpen, ArrowRight, CheckCircle2, XCircle } from 'lucide-react'

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
  inputs: any[]
  outputs: any[]
}

export function CalculatorsSection() {
  const [equations, setEquations] = useState<Equation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [domain, setDomain] = useState('all')
  const [selectedEq, setSelectedEq] = useState<Equation | null>(null)
  const [inputValues, setInputValues] = useState<Record<string, number>>({})
  const [results, setResults] = useState<any>(null)
  const [solving, setSolving] = useState(false)

  const fetchEquations = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (domain !== 'all') params.set('domain', domain)
      params.set('limit', '100')
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

  const handleSelectEquation = (eq: Equation) => {
    setSelectedEq(eq)
    setResults(null)
    const defaults: Record<string, number> = {}
    eq.inputs?.forEach((inp: any) => {
      const val = inp.default_value ?? inp.min_value ?? 0
      defaults[inp.symbol || inp.name] = Number(val)
    })
    setInputValues(defaults)
  }

  const handleSolve = async () => {
    if (!selectedEq) return
    setSolving(true)
    try {
      const res = await fetch('/api/equations/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equationId: selectedEq.id, inputs: inputValues }),
      })
      const data = await res.json()
      if (data.success) setResults(data.data)
    } catch (err) {
      console.error(err)
    } finally {
      setSolving(false)
    }
  }

  const domains = ['all', 'electrical', 'mechanical', 'civil', 'hvac', 'hydraulics', 'chemical', 'thermodynamics', 'structural']

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Engineering Calculators</h1>
        <p className="text-muted-foreground">Solve 450+ engineering equations across all disciplines</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Equation Browser */}
        <div className="lg:w-80 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search equations..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
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
            <div className="space-y-2">
              {loading ? (
                <p className="text-sm text-muted-foreground p-4">Loading equations...</p>
              ) : equations.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">No equations found</p>
              ) : (
                equations.map(eq => (
                  <button
                    key={eq.id}
                    onClick={() => handleSelectEquation(eq)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedEq?.id === eq.id ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="font-medium text-sm">{eq.name}</div>
                    <div className="flex gap-1 mt-1">
                      <Badge variant="secondary" className="text-[10px] capitalize">{eq.domain}</Badge>
                      {eq.difficulty_level && (
                        <Badge variant="outline" className="text-[10px]">{eq.difficulty_level}</Badge>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Equation Detail */}
        <div className="flex-1">
          {selectedEq ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Badge className="capitalize">{selectedEq.domain}</Badge>
                    {selectedEq.category_name && (
                      <Badge variant="outline">{selectedEq.category_name}</Badge>
                    )}
                  </div>
                  <CardTitle className="text-xl">{selectedEq.name}</CardTitle>
                  <CardDescription>{selectedEq.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedEq.equation && (
                    <div className="bg-muted p-3 rounded-lg font-mono text-sm">
                      {selectedEq.equation}
                    </div>
                  )}

                  <Separator />

                  {/* Inputs */}
                  {selectedEq.inputs && selectedEq.inputs.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-sm">Input Parameters</h3>
                      <div className="grid gap-3 md:grid-cols-2">
                        {selectedEq.inputs.map((inp: any) => (
                          <div key={inp.id || inp.symbol} className="space-y-1">
                            <label className="text-xs font-medium">
                              {inp.label || inp.name || inp.symbol}
                              {inp.unit && <span className="text-muted-foreground ml-1">({inp.unit})</span>}
                            </label>
                            <Input
                              type="number"
                              value={inputValues[inp.symbol || inp.name] ?? ''}
                              onChange={(e) => setInputValues(prev => ({
                                ...prev,
                                [inp.symbol || inp.name]: parseFloat(e.target.value) || 0
                              }))}
                              placeholder={inp.placeholder || `Enter ${inp.name || inp.symbol}`}
                            />
                            {inp.help_text && (
                              <p className="text-[10px] text-muted-foreground">{inp.help_text}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button onClick={handleSolve} disabled={solving} className="w-full">
                    <Play className="h-4 w-4 mr-2" />
                    {solving ? 'Solving...' : 'Solve Equation'}
                  </Button>

                  {/* Results */}
                  {results && (
                    <Card className="border-emerald-200 dark:border-emerald-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                          Results
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-2 md:grid-cols-2">
                          {Object.entries(results.outputs || {}).map(([key, val]) => (
                            <div key={key} className="flex justify-between p-2 bg-muted rounded">
                              <span className="text-sm font-medium">{key}</span>
                              <span className="text-sm font-mono">{String(val)}</span>
                            </div>
                          ))}
                          {results.outputDefinitions?.map((out: any) => (
                            <div key={out.id || out.symbol} className="flex justify-between p-2 bg-muted rounded">
                              <span className="text-sm">{out.label || out.name || out.symbol} {out.unit ? `(${out.unit})` : ''}</span>
                              <span className="text-sm font-mono">
                                {results.outputs?.[out.symbol || out.name]?.toFixed(out.precision ?? 4) ?? '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
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
