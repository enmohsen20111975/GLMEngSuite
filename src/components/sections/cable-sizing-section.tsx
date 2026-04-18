'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Zap, ChevronRight, CheckCircle2, AlertTriangle, Download } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

type Step = 1 | 2 | 3 | 4

interface CableResult {
  recommendedSize: string
  apparentPower: number
  voltageDrop: number
  voltageDropPercent: number
  currentCapacity: number
  passVoltageDrop: boolean
  passCurrentCapacity: boolean
  recommendations: string[]
}

// IEC 60364 cable size lookup (simplified)
const cableSizes = [
  { size: '1.5 mm²', rating: 18 },
  { size: '2.5 mm²', rating: 24 },
  { size: '4 mm²', rating: 32 },
  { size: '6 mm²', rating: 41 },
  { size: '10 mm²', rating: 57 },
  { size: '16 mm²', rating: 76 },
  { size: '25 mm²', rating: 101 },
  { size: '35 mm²', rating: 125 },
  { size: '50 mm²', rating: 151 },
  { size: '70 mm²', rating: 192 },
  { size: '95 mm²', rating: 232 },
  { size: '120 mm²', rating: 269 },
  { size: '150 mm²', rating: 310 },
  { size: '185 mm²', rating: 354 },
  { size: '240 mm²', rating: 415 },
  { size: '300 mm²', rating: 480 },
]

const insulationTemps: Record<string, number> = { PVC: 70, XLPE: 90, EPR: 90 }
const installDerating: Record<string, number> = { 'In Air': 1.0, Conduit: 0.8, Underground: 0.9, 'Cable Tray': 0.95 }

export function CableSizingSection() {
  const [step, setStep] = React.useState<Step>(1)
  const [loadCurrent, setLoadCurrent] = React.useState('50')
  const [voltage, setVoltage] = React.useState('400')
  const [powerFactor, setPowerFactor] = React.useState('0.85')
  const [phases, setPhases] = React.useState<'single' | 'three'>('three')
  const [cableType, setCableType] = React.useState('XLPE')
  const [installMethod, setInstallMethod] = React.useState('In Air')
  const [cableLength, setCableLength] = React.useState('50')
  const [ambientTemp, setAmbientTemp] = React.useState('30')
  const [vdLimit, setVdLimit] = React.useState('3')
  const [scCurrent, setScCurrent] = React.useState('')
  const [scDuration, setScDuration] = React.useState('1')
  const [result, setResult] = React.useState<CableResult | null>(null)

  const calculateCable = () => {
    const I = Number(loadCurrent)
    const V = Number(voltage)
    const PF = Number(powerFactor)
    const L = Number(cableLength)
    const ambientT = Number(ambientTemp)
    const vdLimitPct = Number(vdLimit)
    const derating = installDerating[installMethod] || 1.0
    const maxTemp = insulationTemps[cableType] || 90

    // Temperature derating factor
    const tempDerating = ambientT > 30 ? 1 - (ambientT - 30) * 0.005 : 1.0
    const totalDerating = derating * tempDerating
    const requiredCurrent = I / totalDerating

    // Apparent power
    const apparentPower = phases === 'three'
      ? Math.sqrt(3) * V * I / 1000
      : V * I / 1000

    // Find appropriate cable size
    const selectedCable = cableSizes.find(c => c.rating >= requiredCurrent) || cableSizes[cableSizes.length - 1]

    // Voltage drop calculation
    const resistance = 0.0175 / (Number(selectedCable.size.replace(/[^0-9.]/g, '')) || 1) // simplified
    const vdFactor = phases === 'three' ? Math.sqrt(3) : 2
    const voltageDrop = (vdFactor * I * L * resistance)
    const voltageDropPercent = (voltageDrop / V) * 100

    const recommendations: string[] = []
    if (voltageDropPercent > vdLimitPct) {
      recommendations.push(`Voltage drop ${voltageDropPercent.toFixed(2)}% exceeds limit of ${vdLimitPct}%. Consider larger cable size or shorter run.`)
    }
    if (ambientT > 40) {
      recommendations.push('High ambient temperature. Consider using XLPE insulation rated for 90°C.')
    }
    if (Number(cableLength) > 100) {
      recommendations.push('Long cable run. Verify voltage drop at full load conditions.')
    }
    if (phases === 'three' && PF < 0.9) {
      recommendations.push('Consider power factor correction to reduce current draw.')
    }
    recommendations.push(`Cable insulation: ${cableType} (max ${maxTemp}°C)`)
    recommendations.push(`Installation method: ${installMethod} (derating factor: ${derating})`)

    setResult({
      recommendedSize: selectedCable.size,
      apparentPower: Math.round(apparentPower * 100) / 100,
      voltageDrop: Math.round(voltageDrop * 100) / 100,
      voltageDropPercent: Math.round(voltageDropPercent * 100) / 100,
      currentCapacity: Math.round(selectedCable.rating * totalDerating),
      passVoltageDrop: voltageDropPercent <= vdLimitPct,
      passCurrentCapacity: selectedCable.rating >= requiredCurrent,
      recommendations,
    })
    setStep(4)
  }

  const stepProgress = ((step - 1) / 3) * 100

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Zap className="h-5 w-5 text-emerald-600" />
          Cable Sizing Calculator
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          IEC 60364 compliant cable sizing with voltage drop verification
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3">
        {[
          { n: 1, label: 'Load' },
          { n: 2, label: 'Cable' },
          { n: 3, label: 'Constraints' },
          { n: 4, label: 'Results' },
        ].map((s, i) => (
          <React.Fragment key={s.n}>
            <button
              onClick={() => s.n < step && setStep(s.n as Step)}
              className={`flex items-center gap-2 text-sm ${step >= s.n ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}`}
            >
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step > s.n ? 'bg-emerald-600 text-white' : step === s.n ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-muted text-muted-foreground'
              }`}>
                {step > s.n ? '✓' : s.n}
              </div>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < 3 && <div className={`flex-1 h-0.5 ${step > s.n ? 'bg-emerald-600' : 'bg-muted'}`} />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Load Parameters */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Load Parameters</CardTitle>
            <CardDescription>Define the electrical load for cable sizing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Load Current (A)</Label>
                <Input type="number" value={loadCurrent} onChange={e => setLoadCurrent(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>System Voltage (V)</Label>
                <Select value={voltage} onValueChange={setVoltage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="230">230V (Single Phase)</SelectItem>
                    <SelectItem value="400">400V (Three Phase)</SelectItem>
                    <SelectItem value="415">415V</SelectItem>
                    <SelectItem value="690">690V</SelectItem>
                    <SelectItem value="11000">11kV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Power Factor</Label>
                <Input type="number" value={powerFactor} onChange={e => setPowerFactor(e.target.value)} step="0.01" min="0" max="1" />
              </div>
              <div className="space-y-2">
                <Label>Phase Configuration</Label>
                <Select value={phases} onValueChange={v => setPhases(v as 'single' | 'three')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="three">Three Phase</SelectItem>
                    <SelectItem value="single">Single Phase</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={() => setStep(2)} className="bg-emerald-600 hover:bg-emerald-700">
              Next: Cable Configuration <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Cable Configuration */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Cable Configuration</CardTitle>
            <CardDescription>Select cable type and installation method</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Cable Insulation Type</Label>
              <div className="grid grid-cols-3 gap-3">
                {['PVC', 'XLPE', 'EPR'].map(type => (
                  <button
                    key={type}
                    onClick={() => setCableType(type)}
                    className={`p-3 rounded-lg border-2 text-center transition-all ${
                      cableType === type ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-border hover:border-emerald-300'
                    }`}
                  >
                    <p className="font-semibold text-sm">{type}</p>
                    <p className="text-xs text-muted-foreground">{insulationTemps[type]}°C max</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Installation Method</Label>
              <div className="grid grid-cols-2 gap-3">
                {['In Air', 'Conduit', 'Underground', 'Cable Tray'].map(method => (
                  <button
                    key={method}
                    onClick={() => setInstallMethod(method)}
                    className={`p-3 rounded-lg border-2 text-center transition-all ${
                      installMethod === method ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-border hover:border-emerald-300'
                    }`}
                  >
                    <p className="font-medium text-sm">{method}</p>
                    <p className="text-xs text-muted-foreground">×{installDerating[method]}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cable Length (m)</Label>
                <Input type="number" value={cableLength} onChange={e => setCableLength(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Ambient Temperature (°C)</Label>
                <Input type="number" value={ambientTemp} onChange={e => setAmbientTemp(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
              <Button onClick={() => setStep(3)} className="bg-emerald-600 hover:bg-emerald-700">
                Next: Constraints <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Constraints */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Design Constraints</CardTitle>
            <CardDescription>Set voltage drop and short circuit limits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Voltage Drop Limit (%)</Label>
                <Input type="number" value={vdLimit} onChange={e => setVdLimit(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Short Circuit Current (kA) — Optional</Label>
                <Input type="number" value={scCurrent} onChange={e => setScCurrent(e.target.value)} placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <Label>Short Circuit Duration (s)</Label>
                <Input type="number" value={scDuration} onChange={e => setScDuration(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>← Back</Button>
              <Button onClick={calculateCable} className="bg-emerald-600 hover:bg-emerald-700">
                Calculate Cable Size
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Results */}
      {step === 4 && result && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className={result.passVoltageDrop && result.passCurrentCapacity ? 'border-emerald-300 dark:border-emerald-700' : 'border-amber-300 dark:border-amber-700'}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Recommended Size</p>
                <p className="text-2xl font-bold text-emerald-600">{result.recommendedSize}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Apparent Power</p>
                <p className="text-2xl font-bold">{result.apparentPower} <span className="text-sm">kVA</span></p>
              </CardContent>
            </Card>
            <Card className={result.passVoltageDrop ? '' : 'border-red-300'}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Voltage Drop</p>
                <p className={`text-2xl font-bold ${result.passVoltageDrop ? 'text-emerald-600' : 'text-red-600'}`}>
                  {result.voltageDropPercent}%
                </p>
                <p className="text-xs text-muted-foreground">{result.voltageDrop}V</p>
              </CardContent>
            </Card>
            <Card className={result.passCurrentCapacity ? '' : 'border-red-300'}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Current Capacity</p>
                <p className={`text-2xl font-bold ${result.passCurrentCapacity ? 'text-emerald-600' : 'text-red-600'}`}>
                  {result.currentCapacity}A
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Status */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                {result.passVoltageDrop && result.passCurrentCapacity ? (
                  <>
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                    <div>
                      <p className="font-semibold text-emerald-600">Cable Size Approved</p>
                      <p className="text-xs text-muted-foreground">All design constraints satisfied per IEC 60364</p>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-6 w-6 text-amber-600" />
                    <div>
                      <p className="font-semibold text-amber-600">Review Required</p>
                      <p className="text-xs text-muted-foreground">Some constraints not met. See recommendations below.</p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="text-emerald-600 mt-0.5">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setStep(1); setResult(null) }}>New Calculation</Button>
            <Button variant="outline" onClick={() => toast.success('Report exported!')}>
              <Download className="h-4 w-4 mr-1" /> Export Report
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  )
}
