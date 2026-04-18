'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Zap, Trash2, Play, RotateCcw, Plus, Settings2 } from 'lucide-react'

interface CircuitComponent {
  id: string
  type: 'resistor' | 'capacitor' | 'inductor' | 'voltage_source' | 'current_source' | 'ground' | 'wire' | 'diode' | 'led' | 'switch'
  x: number
  y: number
  rotation: number
  value: number
  unit: string
  label: string
  connections: string[] // connected node IDs
}

interface WirePoint {
  id: string
  x: number
  y: number
  connectedTo: string[] // component IDs
}

const COMPONENT_TYPES = [
  { type: 'voltage_source', label: 'Voltage Source', symbol: 'V', unit: 'V', defaultValue: 12 },
  { type: 'current_source', label: 'Current Source', symbol: 'I', unit: 'A', defaultValue: 1 },
  { type: 'resistor', label: 'Resistor', symbol: 'R', unit: 'Ω', defaultValue: 1000 },
  { type: 'capacitor', label: 'Capacitor', symbol: 'C', unit: 'μF', defaultValue: 100 },
  { type: 'inductor', label: 'Inductor', symbol: 'L', unit: 'mH', defaultValue: 10 },
  { type: 'diode', label: 'Diode', symbol: 'D', unit: '', defaultValue: 0.7 },
  { type: 'led', label: 'LED', symbol: 'LED', unit: '', defaultValue: 2 },
  { type: 'switch', label: 'Switch', symbol: 'SW', unit: '', defaultValue: 1 },
  { type: 'ground', label: 'Ground', symbol: 'GND', unit: '', defaultValue: 0 },
] as const

const GRID_SIZE = 20

export function ElectricalSimulatorSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [components, setComponents] = useState<CircuitComponent[]>([])
  const [wires, setWires] = useState<Array<{ id: string; points: Array<{ x: number; y: number }>; from: string; to: string }>>([])
  const [selectedType, setSelectedType] = useState<string>('resistor')
  const [wiringFrom, setWiringFrom] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null)
  const [simulationResults, setSimulationResults] = useState<Record<string, { voltage: number; current: number; power: number }>>({})

  const snapToGrid = (val: number) => Math.round(val / GRID_SIZE) * GRID_SIZE

  const addComponent = (type: string) => {
    const compType = COMPONENT_TYPES.find(c => c.type === type)
    if (!compType) return
    const id = `comp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`
    const count = components.filter(c => c.type === type).length + 1
    const newComp: CircuitComponent = {
      id,
      type: type as CircuitComponent['type'],
      x: snapToGrid(200 + Math.random() * 300),
      y: snapToGrid(100 + Math.random() * 300),
      rotation: 0,
      value: compType.defaultValue,
      unit: compType.unit,
      label: `${compType.symbol}${count}`,
      connections: [],
    }
    setComponents(prev => [...prev, newComp])
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw grid
    ctx.strokeStyle = '#f0f0f0'
    ctx.lineWidth = 0.5
    for (let x = 0; x < canvas.width; x += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke()
    }
    for (let y = 0; y < canvas.height; y += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke()
    }
    // Major grid
    ctx.strokeStyle = '#e0e0e0'
    ctx.lineWidth = 0.8
    for (let x = 0; x < canvas.width; x += GRID_SIZE * 5) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke()
    }
    for (let y = 0; y < canvas.height; y += GRID_SIZE * 5) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke()
    }

    // Draw wires
    wires.forEach(wire => {
      ctx.strokeStyle = '#374151'
      ctx.lineWidth = 2
      ctx.beginPath()
      if (wire.points.length > 0) {
        ctx.moveTo(wire.points[0].x, wire.points[0].y)
        for (let i = 1; i < wire.points.length; i++) {
          ctx.lineTo(wire.points[i].x, wire.points[i].y)
        }
      }
      ctx.stroke()
    })

    // Draw components
    components.forEach(comp => {
      const isSelected = comp.id === selectedComponent
      const isWiring = comp.id === wiringFrom
      const hasResults = simulationResults[comp.id]

      ctx.save()
      ctx.translate(comp.x, comp.y)
      ctx.rotate((comp.rotation * Math.PI) / 180)

      const w = 60
      const h = 30

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.05)'
      ctx.fillRect(-w / 2 + 2, -h / 2 + 2, w, h)

      // Body
      const bgColor = comp.type === 'voltage_source' ? '#fef3c7' :
                      comp.type === 'current_source' ? '#dbeafe' :
                      comp.type === 'ground' ? '#f3f4f6' :
                      hasResults ? '#d1fae5' : '#ffffff'
      ctx.fillStyle = bgColor
      ctx.fillRect(-w / 2, -h / 2, w, h)

      // Border
      ctx.strokeStyle = isSelected ? '#3b82f6' : isWiring ? '#f59e0b' : '#6b7280'
      ctx.lineWidth = isSelected ? 2.5 : 1.5
      if (isWiring) {
        ctx.setLineDash([4, 4])
      }
      ctx.strokeRect(-w / 2, -h / 2, w, h)
      ctx.setLineDash([])

      // Component symbol drawing
      ctx.fillStyle = '#1f2937'
      ctx.font = 'bold 11px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      switch (comp.type) {
        case 'resistor':
          // Zigzag resistor symbol
          ctx.strokeStyle = '#1f2937'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(-w / 2, 0)
          ctx.lineTo(-w / 4, 0)
          ctx.lineTo(-w / 4 + 5, -8)
          ctx.lineTo(-w / 4 + 12, 8)
          ctx.lineTo(-w / 4 + 19, -8)
          ctx.lineTo(-w / 4 + 26, 8)
          ctx.lineTo(w / 4, 0)
          ctx.lineTo(w / 2, 0)
          ctx.stroke()
          break
        case 'capacitor':
          ctx.strokeStyle = '#1f2937'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(-w / 2, 0); ctx.lineTo(-5, 0)
          ctx.moveTo(-5, -12); ctx.lineTo(-5, 12)
          ctx.moveTo(5, -12); ctx.lineTo(5, 12)
          ctx.moveTo(5, 0); ctx.lineTo(w / 2, 0)
          ctx.stroke()
          break
        case 'inductor':
          ctx.strokeStyle = '#1f2937'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(-w / 2, 0)
          for (let i = 0; i < 4; i++) {
            ctx.arc(-15 + i * 10, 0, 5, Math.PI, 0, false)
          }
          ctx.lineTo(w / 2, 0)
          ctx.stroke()
          break
        case 'voltage_source':
          ctx.strokeStyle = '#1f2937'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(-w / 2, 0); ctx.lineTo(-12, 0)
          ctx.arc(0, 0, 12, Math.PI, 0, false)
          ctx.moveTo(12, 0); ctx.lineTo(w / 2, 0)
          ctx.stroke()
          ctx.fillText('+', -5, -2)
          ctx.fillText('−', 5, -2)
          break
        case 'current_source':
          ctx.strokeStyle = '#1f2937'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(-w / 2, 0); ctx.lineTo(-12, 0)
          ctx.arc(0, 0, 12, Math.PI, 0, false)
          ctx.moveTo(12, 0); ctx.lineTo(w / 2, 0)
          ctx.stroke()
          // Arrow
          ctx.beginPath()
          ctx.moveTo(0, 8); ctx.lineTo(0, -8)
          ctx.moveTo(-4, -4); ctx.lineTo(0, -8); ctx.lineTo(4, -4)
          ctx.stroke()
          break
        case 'diode':
        case 'led':
          ctx.strokeStyle = '#1f2937'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(-w / 2, 0); ctx.lineTo(-5, 0)
          ctx.moveTo(-5, -10); ctx.lineTo(-5, 10); ctx.lineTo(5, 0); ctx.closePath()
          ctx.moveTo(5, -10); ctx.lineTo(5, 10)
          ctx.moveTo(5, 0); ctx.lineTo(w / 2, 0)
          ctx.stroke()
          if (comp.type === 'led') {
            // LED arrows
            ctx.beginPath()
            ctx.moveTo(8, -10); ctx.lineTo(14, -14)
            ctx.moveTo(12, -14); ctx.lineTo(14, -14); ctx.lineTo(14, -12)
            ctx.stroke()
          }
          break
        case 'switch':
          ctx.strokeStyle = '#1f2937'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(-w / 2, 0); ctx.lineTo(-10, 0)
          ctx.arc(-10, 0, 3, 0, Math.PI * 2)
          ctx.moveTo(10, 0); ctx.arc(10, 0, 3, 0, Math.PI * 2)
          if (comp.value === 1) {
            ctx.moveTo(-7, 0); ctx.lineTo(7, 0)
          } else {
            ctx.moveTo(-7, 0); ctx.lineTo(5, -12)
          }
          ctx.moveTo(10, 0); ctx.lineTo(w / 2, 0)
          ctx.stroke()
          break
        case 'ground':
          ctx.strokeStyle = '#1f2937'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(0, -h / 2); ctx.lineTo(0, 0)
          ctx.moveTo(-12, 0); ctx.lineTo(12, 0)
          ctx.moveTo(-8, 5); ctx.lineTo(8, 5)
          ctx.moveTo(-4, 10); ctx.lineTo(4, 10)
          ctx.stroke()
          break
      }

      // Label
      ctx.font = '9px sans-serif'
      ctx.fillStyle = '#6b7280'
      ctx.fillText(comp.label, 0, h / 2 + 10)
      if (comp.unit) {
        ctx.fillText(`${comp.value}${comp.unit}`, 0, -h / 2 - 6)
      }

      // Connection points
      if (comp.type !== 'ground') {
        ctx.fillStyle = comp.connections.length > 0 ? '#10b981' : '#d1d5db'
        ctx.beginPath(); ctx.arc(-w / 2, 0, 3, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(w / 2, 0, 3, 0, Math.PI * 2); ctx.fill()
      }

      ctx.restore()
    })

    // Wiring preview
    if (wiringFrom) {
      const fromComp = components.find(c => c.id === wiringFrom)
      if (fromComp) {
        ctx.strokeStyle = '#f59e0b'
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        ctx.moveTo(fromComp.x + 30, fromComp.y)
        ctx.lineTo(mousePos.x, mousePos.y)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }
  }, [components, wires, wiringFrom, selectedComponent, mousePos, simulationResults])

  useEffect(() => { draw() }, [draw])

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    // Check if clicking on a component
    for (const comp of components) {
      const dx = x - comp.x
      const dy = y - comp.y
      if (Math.abs(dx) < 35 && Math.abs(dy) < 20) {
        if (wiringFrom) {
          // Connect wire
          if (wiringFrom !== comp.id) {
            const fromComp = components.find(c => c.id === wiringFrom)!
            const newWire = {
              id: `wire_${Date.now()}`,
              points: [
                { x: fromComp.x + 30, y: fromComp.y },
                { x: comp.x - 30, y: comp.y },
              ],
              from: wiringFrom,
              to: comp.id,
            }
            setWires(prev => [...prev, newWire])
            setComponents(prev => prev.map(c =>
              c.id === comp.id ? { ...c, connections: [...c.connections, wiringFrom] } :
              c.id === wiringFrom ? { ...c, connections: [...c.connections, comp.id] } : c
            ))
          }
          setWiringFrom(null)
        } else {
          setDragging(comp.id)
          setDragOffset({ x: dx, y: dy })
          setSelectedComponent(comp.id)
        }
        return
      }
    }

    setSelectedComponent(null)
    setWiringFrom(null)
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    setMousePos({ x, y })

    if (dragging) {
      setComponents(prev => prev.map(c =>
        c.id === dragging ? { ...c, x: snapToGrid(x - dragOffset.x), y: snapToGrid(y - dragOffset.y) } : c
      ))
    }
  }

  const handleCanvasMouseUp = () => {
    setDragging(null)
  }

  const startWiring = (compId: string) => {
    setWiringFrom(compId)
  }

  const simulate = () => {
    // Simple circuit analysis - calculate voltage, current, power for each component
    const results: Record<string, { voltage: number; current: number; power: number }> = {}

    const sources = components.filter(c => c.type === 'voltage_source')
    const totalVoltage = sources.reduce((sum, s) => sum + s.value, 0)

    components.forEach(comp => {
      if (comp.type === 'voltage_source') {
        results[comp.id] = { voltage: comp.value, current: totalVoltage / 1000, power: comp.value * totalVoltage / 1000 }
      } else if (comp.type === 'resistor') {
        const current = totalVoltage / comp.value
        results[comp.id] = { voltage: totalVoltage, current, power: totalVoltage * current }
      } else if (comp.type === 'led' || comp.type === 'diode') {
        results[comp.id] = { voltage: comp.value, current: (totalVoltage - comp.value) / 1000, power: comp.value * (totalVoltage - comp.value) / 1000 }
      } else {
        results[comp.id] = { voltage: 0, current: 0, power: 0 }
      }
    })

    setSimulationResults(results)
  }

  const clearAll = () => {
    setComponents([])
    setWires([])
    setWiringFrom(null)
    setSelectedComponent(null)
    setSimulationResults({})
  }

  const removeComponent = (id: string) => {
    setComponents(prev => prev.filter(c => c.id !== id))
    setWires(prev => prev.filter(w => w.from !== id && w.to !== id))
    setComponents(prev => prev.map(c => ({
      ...c,
      connections: c.connections.filter(cid => cid !== id)
    })))
    if (selectedComponent === id) setSelectedComponent(null)
  }

  const updateComponentValue = (id: string, value: number) => {
    setComponents(prev => prev.map(c => c.id === id ? { ...c, value } : c))
  }

  const rotateComponent = (id: string) => {
    setComponents(prev => prev.map(c => c.id === id ? { ...c, rotation: (c.rotation + 90) % 360 } : c))
  }

  const toggleSwitch = (id: string) => {
    setComponents(prev => prev.map(c =>
      c.id === id && c.type === 'switch' ? { ...c, value: c.value === 1 ? 0 : 1 } : c
    ))
  }

  const selectedComp = components.find(c => c.id === selectedComponent)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Electrical Simulator</h1>
        <p className="text-muted-foreground">Build and simulate electrical circuits with components</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Component palette */}
        <div className="lg:w-56 space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Add Components</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {COMPONENT_TYPES.map(ct => (
                <Button key={ct.type} variant="outline" size="sm" className="w-full justify-start text-xs" onClick={() => addComponent(ct.type)}>
                  <span className="font-mono mr-2 w-8 text-center text-emerald-600">{ct.symbol}</span>
                  {ct.label}
                </Button>
              ))}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={simulate} className="flex-1">
              <Play className="h-3 w-3 mr-1" /> Simulate
            </Button>
            <Button variant="outline" size="sm" onClick={clearAll} className="flex-1">
              <Trash2 className="h-3 w-3 mr-1" /> Clear
            </Button>
          </div>

          {wiringFrom && (
            <Badge variant="secondary" className="w-full justify-center">
              Wiring from: {components.find(c => c.id === wiringFrom)?.label}
            </Badge>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Instructions</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1">
              <p>1. Add components from the palette</p>
              <p>2. Click a component then &ldquo;Start Wire&rdquo;</p>
              <p>3. Click another component to connect</p>
              <p>4. Drag components to reposition</p>
              <p>5. Click Simulate to analyze</p>
            </CardContent>
          </Card>
        </div>

        {/* Canvas */}
        <div className="flex-1">
          <canvas
            ref={canvasRef}
            width={900}
            height={650}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            className="border rounded-lg bg-white w-full"
            style={{ maxHeight: 'calc(100vh - 200px)' }}
          />
        </div>

        {/* Properties panel */}
        <div className="lg:w-56 space-y-3">
          {selectedComp ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{selectedComp.label} Properties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Type</Label>
                  <p className="text-sm font-medium capitalize">{selectedComp.type.replace('_', ' ')}</p>
                </div>
                {selectedComp.unit && (
                  <div>
                    <Label className="text-xs">Value ({selectedComp.unit})</Label>
                    <Input
                      type="number"
                      value={selectedComp.value}
                      onChange={e => updateComponentValue(selectedComp.id, Number(e.target.value))}
                      className="h-8 text-sm"
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => rotateComponent(selectedComp.id)}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Rotate
                  </Button>
                  {selectedComp.type === 'switch' && (
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => toggleSwitch(selectedComp.id)}>
                      {selectedComp.value === 1 ? 'Open' : 'Close'}
                    </Button>
                  )}
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={() => startWiring(selectedComp.id)}>
                  <Zap className="h-3 w-3 mr-1" /> Start Wire
                </Button>
                <Button variant="destructive" size="sm" className="w-full" onClick={() => removeComponent(selectedComp.id)}>
                  <Trash2 className="h-3 w-3 mr-1" /> Remove
                </Button>

                {simulationResults[selectedComp.id] && (
                  <div className="pt-2 border-t space-y-1">
                    <p className="text-xs font-semibold text-emerald-600">Simulation Results</p>
                    <p className="text-xs">V = {simulationResults[selectedComp.id].voltage.toFixed(3)} V</p>
                    <p className="text-xs">I = {simulationResults[selectedComp.id].current.toFixed(6)} A</p>
                    <p className="text-xs">P = {simulationResults[selectedComp.id].power.toFixed(6)} W</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-4 text-center text-muted-foreground text-sm">
                Click a component to view its properties
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Components ({components.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {components.map(comp => (
                  <div
                    key={comp.id}
                    className={`flex items-center justify-between text-xs p-1.5 rounded cursor-pointer hover:bg-muted ${selectedComponent === comp.id ? 'bg-emerald-50' : ''}`}
                    onClick={() => setSelectedComponent(comp.id)}
                  >
                    <span className="font-mono">{comp.label}</span>
                    <div className="flex items-center gap-1">
                      {comp.unit && <span className="text-muted-foreground">{comp.value}{comp.unit}</span>}
                      {simulationResults[comp.id] && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500" title="Simulated" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
