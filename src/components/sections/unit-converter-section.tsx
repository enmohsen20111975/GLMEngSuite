'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeftRight,
  ArrowUpDown,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface UnitConversion {
  id: string
  category: string
  fromUnit: string
  toUnit: string
  factor: string
  offset: string
  fromSymbol: string | null
  toSymbol: string | null
}

export function UnitConverterSection() {
  const [conversions, setConversions] = React.useState<UnitConversion[]>([])
  const [grouped, setGrouped] = React.useState<Record<string, UnitConversion[]>>({})
  const [loading, setLoading] = React.useState(true)
  const [selectedCategory, setSelectedCategory] = React.useState('Length')
  const [fromValue, setFromValue] = React.useState('1')
  const [fromUnit, setFromUnit] = React.useState('')
  const [toUnit, setToUnit] = React.useState('')
  const [result, setResult] = React.useState<number | null>(null)

  React.useEffect(() => {
    async function loadUnits() {
      try {
        const res = await fetch('/api/units')
        if (res.ok) {
          const data = await res.json()
          setConversions(data.conversions)
          setGrouped(data.grouped)
        }
      } catch (err) {
        console.error('Failed to load units:', err)
      } finally {
        setLoading(false)
      }
    }
    loadUnits()
  }, [])

  const categoryUnits = React.useMemo(() => {
    const units = new Set<string>()
    const catConversions = grouped[selectedCategory] || []
    catConversions.forEach(c => {
      units.add(c.fromUnit)
      units.add(c.toUnit)
    })
    return Array.from(units)
  }, [grouped, selectedCategory])

  React.useEffect(() => {
    if (categoryUnits.length >= 2) {
      setFromUnit(categoryUnits[0])
      setToUnit(categoryUnits[1])
    }
  }, [selectedCategory, categoryUnits])

  const convert = React.useCallback(() => {
    const val = Number(fromValue)
    if (isNaN(val) || !fromUnit || !toUnit) {
      setResult(null)
      return
    }

    if (fromUnit === toUnit) {
      setResult(val)
      return
    }

    // Try direct conversion
    const direct = conversions.find(
      c => c.category === selectedCategory && c.fromUnit === fromUnit && c.toUnit === toUnit
    )
    if (direct) {
      setResult(val * Number(direct.factor) + Number(direct.offset))
      return
    }

    // Try reverse conversion
    const reverse = conversions.find(
      c => c.category === selectedCategory && c.fromUnit === toUnit && c.toUnit === fromUnit
    )
    if (reverse) {
      setResult((val - Number(reverse.offset)) / Number(reverse.factor))
      return
    }

    // Try two-step conversion through a common unit
    const fromConvs = conversions.filter(
      c => c.category === selectedCategory && c.fromUnit === fromUnit
    )
    const toConvs = conversions.filter(
      c => c.category === selectedCategory && c.toUnit === toUnit
    )

    for (const fc of fromConvs) {
      const tc = toConvs.find(t => t.fromUnit === fc.toUnit)
      if (tc) {
        const intermediate = val * Number(fc.factor) + Number(fc.offset)
        setResult(intermediate * Number(tc.factor) + Number(tc.offset))
        return
      }
    }

    setResult(null)
  }, [fromValue, fromUnit, toUnit, selectedCategory, conversions])

  React.useEffect(() => {
    convert()
  }, [convert])

  const swapUnits = () => {
    setFromUnit(toUnit)
    setToUnit(fromUnit)
  }

  const categories = Object.keys(grouped).sort()

  const popularConversions = [
    { label: 'm → ft', category: 'Length', from: 'meter', to: 'foot' },
    { label: 'kg → lb', category: 'Mass', from: 'kilogram', to: 'pound' },
    { label: '°C → °F', category: 'Temperature', from: 'celsius', to: 'fahrenheit' },
    { label: 'bar → psi', category: 'Pressure', from: 'bar', to: 'psi' },
    { label: 'kW → hp', category: 'Power', from: 'kilowatt', to: 'horsepower' },
    { label: 'kJ → kcal', category: 'Energy', from: 'kilojoule', to: 'kilocalorie' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <ArrowLeftRight className="h-5 w-5 text-emerald-600" />
          Unit Converter
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Convert between {conversions.length} units across {categories.length} categories
        </p>
      </div>

      {/* Popular Quick Conversions */}
      <div className="flex flex-wrap gap-2">
        {popularConversions.map(pc => (
          <Button
            key={pc.label}
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => {
              setSelectedCategory(pc.category)
              setFromUnit(pc.from)
              setToUnit(pc.to)
              setFromValue('1')
            }}
          >
            {pc.label}
          </Button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-4">
        {/* Main Converter */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Convert Units</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Category Selection */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* From */}
            <div className="space-y-2">
              <label className="text-sm font-medium">From</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={fromValue}
                  onChange={(e) => setFromValue(e.target.value)}
                  className="flex-1"
                  step="any"
                />
                <Select value={fromUnit} onValueChange={setFromUnit}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryUnits.map(unit => (
                      <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Swap Button */}
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={swapUnits}
                className="rounded-full h-10 w-10"
              >
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </div>

            {/* To */}
            <div className="space-y-2">
              <label className="text-sm font-medium">To</label>
              <div className="flex gap-2">
                <div className="flex-1 h-9 px-3 flex items-center rounded-md border bg-emerald-50 dark:bg-emerald-900/20 text-lg font-bold text-emerald-700 dark:text-emerald-400">
                  {result !== null ? Number(result.toFixed(6)) : '—'}
                </div>
                <Select value={toUnit} onValueChange={setToUnit}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryUnits.map(unit => (
                      <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {result !== null && (
              <div className="p-3 rounded-lg bg-muted text-sm">
                <span className="font-medium">{fromValue} {fromUnit}</span>
                {' = '}
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {Number(result.toFixed(6))} {toUnit}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Reference */}
        <Card className="lg:max-h-[calc(100vh-280px)] overflow-hidden flex flex-col">
          <CardHeader className="pb-2 shrink-0">
            <CardTitle className="text-sm">Conversion Tables</CardTitle>
          </CardHeader>
          <CardContent className="p-2 overflow-y-auto flex-1">
            {categories.map(cat => (
              <div key={cat} className="mb-3">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground px-2 py-1">
                  {cat}
                </h4>
                <div className="space-y-0.5">
                  {(grouped[cat] || []).slice(0, 8).map(c => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between px-2 py-1 text-xs rounded hover:bg-accent"
                    >
                      <span>{c.fromUnit} → {c.toUnit}</span>
                      <span className="font-mono text-muted-foreground">×{Number(c.factor).toFixed(4)}</span>
                    </div>
                  ))}
                  {(grouped[cat] || []).length > 8 && (
                    <p className="text-[10px] text-muted-foreground px-2 py-1">
                      +{(grouped[cat] || []).length - 8} more
                    </p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}
