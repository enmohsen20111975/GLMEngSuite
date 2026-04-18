'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Droplets, Play, Square, RotateCcw, Search, Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

interface HydraulicComponent {
  id: string
  type: string
  label: string
  x: number
  y: number
  width: number
  height: number
  isActive: boolean
  pressure: number
  flow: number
  properties: Record<string, string | number>
}

interface HydraulicPipe {
  id: string
  from: string
  to: string
  flowing: boolean
}

const componentLibrary = [
  {
    category: 'Power Sources',
    items: [
      { type: 'pump', label: 'Pump', w: 80, h: 60, props: { flowRate: '50 L/min', maxPressure: '200 bar' } },
      { type: 'compressor', label: 'Compressor', w: 80, h: 60, props: { flowRate: '100 CFM', maxPressure: '10 bar' } },
      { type: 'reservoir', label: 'Reservoir', w: 70, h: 70, props: { capacity: '100 L' } },
    ]
  },
  {
    category: 'Actuators',
    items: [
      { type: 'cylinder_da', label: 'D-A Cylinder', w: 100, h: 40, props: { bore: '50 mm', stroke: '200 mm' } },
      { type: 'cylinder_sa', label: 'S-A Cylinder', w: 100, h: 40, props: { bore: '40 mm', stroke: '150 mm' } },
      { type: 'motor_h', label: 'Hyd. Motor', w: 70, h: 60, props: { displacement: '25 cc/rev' } },
    ]
  },
  {
    category: 'Valves',
    items: [
      { type: 'dcv', label: '4/3 DCV', w: 80, h: 50, props: { ports: '4', positions: '3' } },
      { type: 'relief', label: 'Relief Valve', w: 60, h: 50, props: { setPressure: '150 bar' } },
      { type: 'check', label: 'Check Valve', w: 50, h: 40, props: { crackingPressure: '0.5 bar' } },
      { type: 'flow_ctrl', label: 'Flow Control', w: 60, h: 50, props: { maxFlow: '40 L/min' } },
    ]
  },
  {
    category: 'Instruments',
    items: [
      { type: 'pressure_gauge', label: 'P. Gauge', w: 50, h: 50, props: { range: '0-250 bar' } },
      { type: 'flow_meter', label: 'Flow Meter', w: 50, h: 50, props: { range: '0-100 L/min' } },
    ]
  },
]

const componentSVG: Record<string, (comp: HydraulicComponent) => React.ReactNode> = {
  pump: (c) => (
    <g>
      <circle cx={c.x + c.width/2} cy={c.y + c.height/2} r={c.width/2 - 4} fill={c.isActive ? '#dcfce7' : '#f5f5f5'} stroke={c.isActive ? '#059669' : '#666'} strokeWidth="2" />
      <polygon points={`${c.x+c.width/2},${c.y+8} ${c.x+c.width-12},${c.y+c.height-8} ${c.x+12},${c.y+c.height-8}`} fill={c.isActive ? '#059669' : '#666'} />
      <text x={c.x+c.width/2} y={c.y+c.height+14} textAnchor="middle" className="text-[9px] fill-muted-foreground">{c.label}</text>
    </g>
  ),
  reservoir: (c) => (
    <g>
      <rect x={c.x+5} y={c.y+5} width={c.width-10} height={c.height-10} fill={c.isActive ? '#dcfce7' : '#f5f5f5'} stroke={c.isActive ? '#059669' : '#666'} strokeWidth="2" rx="3" />
      <rect x={c.x+10} y={c.y+c.height/2} width={c.width-20} height={c.height/2-12} fill={c.isActive ? '#93c5fd' : '#e0e0e0'} rx="2" />
      <text x={c.x+c.width/2} y={c.y+c.height+14} textAnchor="middle" className="text-[9px] fill-muted-foreground">{c.label}</text>
    </g>
  ),
  cylinder_da: (c) => (
    <g>
      <rect x={c.x} y={c.y+8} width={c.width} height={c.height-16} fill="#f5f5f5" stroke="#666" strokeWidth="2" rx="3" />
      <rect x={c.x+c.width*0.3} y={c.y+12} width={c.width*0.35} height={c.height-24} fill={c.isActive ? '#93c5fd' : '#ddd'} rx="2" />
      <line x1={c.x+c.width*0.65} y1={c.y+c.height/2} x2={c.x+c.width} y2={c.y+c.height/2} stroke="#666" strokeWidth="3" />
      <text x={c.x+c.width/2} y={c.y+c.height+14} textAnchor="middle" className="text-[9px] fill-muted-foreground">{c.label}</text>
    </g>
  ),
  dcv: (c) => (
    <g>
      <rect x={c.x} y={c.y} width={c.width} height={c.height} fill={c.isActive ? '#dcfce7' : '#f5f5f5'} stroke={c.isActive ? '#059669' : '#666'} strokeWidth="2" rx="3" />
      <line x1={c.x+15} y1={c.y+10} x2={c.x+15} y2={c.y+c.height-10} stroke={c.isActive ? '#059669' : '#666'} strokeWidth="2" />
      <line x1={c.x+c.width-15} y1={c.y+10} x2={c.x+c.width-15} y2={c.y+c.height-10} stroke={c.isActive ? '#059669' : '#666'} strokeWidth="2" />
      <line x1={c.x+15} y1={c.y+c.height/2} x2={c.x+c.width-15} y2={c.y+c.height/2} stroke={c.isActive ? '#059669' : '#666'} strokeWidth="2" />
      <text x={c.x+c.width/2} y={c.y+c.height+14} textAnchor="middle" className="text-[9px] fill-muted-foreground">{c.label}</text>
    </g>
  ),
  relief: (c) => (
    <g>
      <polygon points={`${c.x+10},${c.y} ${c.x+c.width-10},${c.y+c.height*0.6} ${c.x+10},${c.y+c.height*0.6}`} fill={c.isActive ? '#dcfce7' : '#f5f5f5'} stroke={c.isActive ? '#059669' : '#666'} strokeWidth="2" />
      <line x1={c.x+c.width/2-5} y1={c.y+c.height*0.6+5} x2={c.x+c.width/2+5} y2={c.y+c.height*0.6+15} stroke="#666" strokeWidth="2" />
      <text x={c.x+c.width/2} y={c.y+c.height+14} textAnchor="middle" className="text-[9px] fill-muted-foreground">{c.label}</text>
    </g>
  ),
  check: (c) => (
    <g>
      <polygon points={`${c.x+5},${c.y+c.height/2-10} ${c.x+c.width-5},${c.y+c.height/2} ${c.x+5},${c.y+c.height/2+10}`} fill={c.isActive ? '#dcfce7' : '#f5f5f5'} stroke={c.isActive ? '#059669' : '#666'} strokeWidth="2" />
      <line x1={c.x+c.width-5} y1={c.y+c.height/2-10} x2={c.x+c.width-5} y2={c.y+c.height/2+10} stroke={c.isActive ? '#059669' : '#666'} strokeWidth="2" />
      <text x={c.x+c.width/2} y={c.y+c.height+14} textAnchor="middle" className="text-[9px] fill-muted-foreground">{c.label}</text>
    </g>
  ),
  pressure_gauge: (c) => (
    <g>
      <circle cx={c.x+c.width/2} cy={c.y+c.height/2} r={c.width/2-4} fill="#f5f5f5" stroke="#666" strokeWidth="2" />
      <text x={c.x+c.width/2} y={c.y+c.height/2-2} textAnchor="middle" className="text-[8px] font-bold" fill={c.isActive ? '#059669' : '#666'}>
        {c.isActive ? `${c.pressure} bar` : '—'}
      </text>
      <text x={c.x+c.width/2} y={c.y+c.height/2+8} textAnchor="middle" className="text-[7px] fill-muted-foreground">bar</text>
      <text x={c.x+c.width/2} y={c.y+c.height+14} textAnchor="middle" className="text-[9px] fill-muted-foreground">{c.label}</text>
    </g>
  ),
  flow_meter: (c) => (
    <g>
      <circle cx={c.x+c.width/2} cy={c.y+c.height/2} r={c.width/2-4} fill="#f5f5f5" stroke="#666" strokeWidth="2" />
      <text x={c.x+c.width/2} y={c.y+c.height/2-2} textAnchor="middle" className="text-[8px] font-bold" fill={c.isActive ? '#059669' : '#666'}>
        {c.isActive ? `${c.flow}` : '—'}
      </text>
      <text x={c.x+c.width/2} y={c.y+c.height/2+8} textAnchor="middle" className="text-[7px] fill-muted-foreground">L/min</text>
      <text x={c.x+c.width/2} y={c.y+c.height+14} textAnchor="middle" className="text-[9px] fill-muted-foreground">{c.label}</text>
    </g>
  ),
}

// Default components
const getDefaults = (type: string): (() => React.ReactNode) | undefined => componentSVG[type]

export function HydraulicSimulatorSection() {
  const [components, setComponents] = React.useState<HydraulicComponent[]>([
    { id: '1', type: 'reservoir', label: 'Reservoir', x: 50, y: 300, width: 70, height: 70, isActive: true, pressure: 0, flow: 50, properties: { capacity: '100 L' } },
    { id: '2', type: 'pump', label: 'Pump', x: 200, y: 200, width: 80, height: 60, isActive: true, pressure: 120, flow: 50, properties: { flowRate: '50 L/min', maxPressure: '200 bar' } },
    { id: '3', type: 'relief', label: 'Relief Valve', x: 350, y: 120, width: 60, height: 50, isActive: false, pressure: 0, flow: 0, properties: { setPressure: '150 bar' } },
    { id: '4', type: 'dcv', label: '4/3 DCV', x: 350, y: 220, width: 80, height: 50, isActive: true, pressure: 115, flow: 48, properties: { ports: '4', positions: '3' } },
    { id: '5', type: 'cylinder_da', label: 'D-A Cylinder', x: 520, y: 200, width: 100, height: 40, isActive: true, pressure: 110, flow: 45, properties: { bore: '50 mm', stroke: '200 mm' } },
    { id: '6', type: 'pressure_gauge', label: 'P. Gauge', x: 280, y: 320, width: 50, height: 50, isActive: true, pressure: 120, flow: 0, properties: { range: '0-250 bar' } },
    { id: '7', type: 'flow_meter', label: 'Flow Meter', x: 500, y: 320, width: 50, height: 50, isActive: true, pressure: 0, flow: 48, properties: { range: '0-100 L/min' } },
  ])
  const [pipes] = React.useState<HydraulicPipe[]>([
    { id: 'p1', from: '1', to: '2', flowing: true },
    { id: 'p2', from: '2', to: '3', flowing: false },
    { id: 'p3', from: '2', to: '4', flowing: true },
    { id: 'p4', from: '4', to: '5', flowing: true },
    { id: 'p5', from: '2', to: '6', flowing: true },
    { id: 'p6', from: '4', to: '7', flowing: true },
  ])
  const [simulating, setSimulating] = React.useState(false)
  const [dragging, setDragging] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState('')
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 })

  const svgRef = React.useRef<SVGSVGElement>(null)

  const addComponent = (type: string, label: string, w: number, h: number, props: Record<string, string | number>) => {
    setComponents(prev => [...prev, {
      id: Date.now().toString(), type, label,
      x: 100 + Math.random() * 200, y: 100 + Math.random() * 200,
      width: w, height: h, isActive: false, pressure: 0, flow: 0, properties: props
    }])
  }

  const renderPipe = (pipe: HydraulicPipe) => {
    const fromComp = components.find(c => c.id === pipe.from)
    const toComp = components.find(c => c.id === pipe.to)
    if (!fromComp || !toComp) return null

    const x1 = fromComp.x + fromComp.width / 2
    const y1 = fromComp.y + fromComp.height / 2
    const x2 = toComp.x + toComp.width / 2
    const y2 = toComp.y + toComp.height / 2
    const mx = (x1 + x2) / 2

    return (
      <g key={pipe.id}>
        <path
          d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
          fill="none" stroke={pipe.flowing && simulating ? '#3b82f6' : '#999'}
          strokeWidth={pipe.flowing ? 3 : 2}
          strokeDasharray={pipe.flowing && simulating ? '8 4' : 'none'}
        />
        {pipe.flowing && simulating && (
          <circle r="3" fill="#3b82f6">
            <animateMotion dur="2s" repeatCount="indefinite"
              path={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} />
          </circle>
        )}
      </g>
    )
  }

  const renderComponent = (comp: HydraulicComponent) => {
    const renderer = componentSVG[comp.type]
    if (!renderer) {
      return (
        <g key={comp.id}>
          <rect x={comp.x} y={comp.y} width={comp.width} height={comp.height}
            fill={comp.isActive ? '#dcfce7' : '#f5f5f5'} stroke={comp.isActive ? '#059669' : '#666'} strokeWidth="2" rx="3" />
          <text x={comp.x+comp.width/2} y={comp.y+comp.height/2+4} textAnchor="middle" className="text-[10px]">{comp.label}</text>
        </g>
      )
    }
    return <g key={comp.id}>{renderer(comp)}</g>
  }

  const filteredCategories = componentLibrary.map(cat => ({
    ...cat,
    items: cat.items.filter(item => item.label.toLowerCase().includes(search.toLowerCase()))
  })).filter(cat => cat.items.length > 0)

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    for (const comp of [...components].reverse()) {
      if (mx >= comp.x && mx <= comp.x + comp.width && my >= comp.y && my <= comp.y + comp.height) {
        setDragging(comp.id)
        setDragOffset({ x: mx - comp.x, y: my - comp.y })
        break
      }
    }
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragging || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    setComponents(prev => prev.map(c =>
      c.id === dragging ? { ...c, x: mx - dragOffset.x, y: my - dragOffset.y } : c
    ))
  }

  const handleMouseUp = () => setDragging(null)

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Droplets className="h-5 w-5 text-emerald-600" />
            Hydraulic / Pneumatic Simulator
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Design and simulate hydraulic and pneumatic circuits
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={simulating ? 'destructive' : 'default'} size="sm" onClick={() => setSimulating(!simulating)}
            className={simulating ? '' : 'bg-emerald-600 hover:bg-emerald-700'}>
            {simulating ? <><Square className="h-3 w-3 mr-1" /> Stop</> : <><Play className="h-3 w-3 mr-1" /> Run</>}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSimulating(false)}>
            <RotateCcw className="h-3 w-3 mr-1" /> Reset
          </Button>
        </div>
      </div>

      {simulating && (
        <Card className="border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20">
          <CardContent className="p-3 flex items-center gap-4 text-sm">
            <Badge className="bg-blue-600 animate-pulse">FLOW</Badge>
            <span>System Pressure: 120 bar</span>
            <span>Flow Rate: 48 L/min</span>
            <span>Active Components: {components.filter(c => c.isActive).length}/{components.length}</span>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-[200px_1fr] gap-4">
        {/* Component Palette */}
        <Card className="lg:max-h-[calc(100vh-300px)] overflow-hidden flex flex-col">
          <CardHeader className="pb-2 shrink-0 p-3">
            <div className="relative">
              <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
              <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-7 h-8 text-xs" />
            </div>
          </CardHeader>
          <ScrollArea className="flex-1 p-2">
            {filteredCategories.map(cat => (
              <div key={cat.category} className="mb-3">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground px-1 mb-1">{cat.category}</p>
                {cat.items.map(item => (
                  <button key={item.type} onClick={() => addComponent(item.type, item.label, item.w, item.h, item.props)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors">
                    <Droplets className="h-3 w-3 text-blue-500" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </ScrollArea>
        </Card>

        {/* Canvas */}
        <Card className="overflow-hidden">
          <svg
            ref={svgRef}
            className="w-full h-[calc(100vh-300px)] min-h-[400px] bg-background"
            style={{ backgroundSize: '20px 20px', backgroundImage: 'radial-gradient(circle, hsl(var(--border)) 0.5px, transparent 0.5px)' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {pipes.map(renderPipe)}
            {components.map(renderComponent)}
          </svg>
        </Card>
      </div>
    </motion.div>
  )
}
