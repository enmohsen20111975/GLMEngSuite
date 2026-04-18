'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CircuitBoard, Trash2, Play, RotateCcw } from 'lucide-react'

interface GateNode {
  id: string
  type: 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'XOR' | 'INPUT' | 'OUTPUT'
  x: number
  y: number
  value: boolean
  label: string
  inputs: string[]  // connected node IDs
}

const GATE_TYPES = ['INPUT', 'OUTPUT', 'AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR'] as const

const GATE_SYMBOLS: Record<string, string> = {
  INPUT: '⬇️', OUTPUT: '⬆️', AND: '&', OR: '≥1', NOT: '1', NAND: '&̄', NOR: '≥1̄', XOR: '=1',
}

export function LogicSimulatorSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [nodes, setNodes] = useState<GateNode[]>([])
  const [selectedGate, setSelectedGate] = useState<string>('AND')
  const [wiringFrom, setWiringFrom] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  const addNode = (type: string) => {
    const id = `node_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`
    const newNode: GateNode = {
      id,
      type: type as GateNode['type'],
      x: 200 + Math.random() * 300,
      y: 100 + Math.random() * 300,
      value: false,
      label: type === 'INPUT' ? `IN${nodes.filter(n => n.type === 'INPUT').length + 1}` :
             type === 'OUTPUT' ? `OUT${nodes.filter(n => n.type === 'OUTPUT').length + 1}` :
             type,
      inputs: [],
    }
    setNodes(prev => [...prev, newNode])
  }

  const toggleInput = (nodeId: string) => {
    setNodes(prev => prev.map(n =>
      n.id === nodeId && n.type === 'INPUT' ? { ...n, value: !n.value } : n
    ))
  }

  const simulate = useCallback(() => {
    setNodes(prevNodes => {
      const newNodes = [...prevNodes.map(n => ({ ...n }))]
      // Reset non-input values
      newNodes.forEach(n => { if (n.type !== 'INPUT') n.value = false })

      // Simulate for multiple passes (to handle feedback)
      for (let pass = 0; pass < 10; pass++) {
        newNodes.forEach(node => {
          if (node.type === 'INPUT') return
          const inputValues = node.inputs.map(inputId => {
            const inputNode = newNodes.find(n => n.id === inputId)
            return inputNode?.value ?? false
          })

          switch (node.type) {
            case 'AND': node.value = inputValues.length > 0 && inputValues.every(v => v); break
            case 'OR': node.value = inputValues.length > 0 && inputValues.some(v => v); break
            case 'NOT': node.value = inputValues.length > 0 ? !inputValues[0] : true; break
            case 'NAND': node.value = !(inputValues.length > 0 && inputValues.every(v => v)); break
            case 'NOR': node.value = !(inputValues.length > 0 && inputValues.some(v => v)); break
            case 'XOR': node.value = inputValues.length > 0 && inputValues.reduce((a, b) => a !== b, false); break
            case 'OUTPUT': node.value = inputValues.length > 0 ? inputValues[0] : false; break
          }
        })
      }
      return newNodes
    })
  }, [])

  useEffect(() => {
    simulate()
  }, [nodes, simulate])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Check if clicking on a node
    for (const node of nodes) {
      const dx = x - node.x
      const dy = y - node.y
      if (Math.abs(dx) < 40 && Math.abs(dy) < 25) {
        if (node.type === 'INPUT') {
          toggleInput(node.id)
          return
        }
        if (wiringFrom) {
          // Connect wire
          if (wiringFrom !== node.id && node.type !== 'INPUT') {
            setNodes(prev => prev.map(n =>
              n.id === node.id && !n.inputs.includes(wiringFrom)
                ? { ...n, inputs: [...n.inputs, wiringFrom] }
                : n
            ))
          }
          setWiringFrom(null)
          return
        }
        // Start wiring
        if (node.type !== 'OUTPUT') {
          setWiringFrom(node.id)
        }
        return
      }
    }
    setWiringFrom(null)
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw grid
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 0.5
    for (let x = 0; x < canvas.width; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke()
    }
    for (let y = 0; y < canvas.height; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke()
    }

    // Draw wires
    nodes.forEach(node => {
      node.inputs.forEach(inputId => {
        const inputNode = nodes.find(n => n.id === inputId)
        if (!inputNode) return
        ctx.beginPath()
        ctx.strokeStyle = inputNode.value ? '#10b981' : '#94a3b8'
        ctx.lineWidth = 2
        ctx.moveTo(inputNode.x + 40, inputNode.y)
        ctx.lineTo(node.x - 40, node.y)
        ctx.stroke()
      })
    })

    // Draw nodes
    nodes.forEach(node => {
      const w = 80
      const h = 50

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.1)'
      ctx.fillRect(node.x - w/2 + 2, node.y - h/2 + 2, w, h)

      // Body
      const bgColor = node.type === 'INPUT' ? (node.value ? '#d1fae5' : '#f3f4f6') :
                      node.type === 'OUTPUT' ? (node.value ? '#fef3c7' : '#f3f4f6') :
                      '#ffffff'
      ctx.fillStyle = bgColor
      ctx.fillRect(node.x - w/2, node.y - h/2, w, h)

      // Border
      ctx.strokeStyle = node.value ? '#10b981' : '#6b7280'
      ctx.lineWidth = node.type === 'INPUT' || node.type === 'OUTPUT' ? 2 : 1.5
      ctx.strokeRect(node.x - w/2, node.y - h/2, w, h)

      // Label
      ctx.fillStyle = '#1f2937'
      ctx.font = 'bold 12px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(GATE_SYMBOLS[node.type] || node.type, node.x, node.y - 6)
      ctx.font = '9px sans-serif'
      ctx.fillText(node.label, node.x, node.y + 10)

      // Input/output dots
      if (node.type !== 'INPUT') {
        ctx.fillStyle = node.inputs.length > 0 ? '#10b981' : '#d1d5db'
        ctx.beginPath(); ctx.arc(node.x - w/2, node.y, 4, 0, Math.PI * 2); ctx.fill()
      }
      if (node.type !== 'OUTPUT') {
        ctx.fillStyle = node.value ? '#10b981' : '#d1d5db'
        ctx.beginPath(); ctx.arc(node.x + w/2, node.y, 4, 0, Math.PI * 2); ctx.fill()
      }

      // Value indicator
      if (node.value) {
        ctx.fillStyle = '#10b981'
        ctx.beginPath(); ctx.arc(node.x + w/2 - 6, node.y - h/2 + 6, 4, 0, Math.PI * 2); ctx.fill()
      }
    })

    // Wiring mode indicator
    if (wiringFrom) {
      const fromNode = nodes.find(n => n.id === wiringFrom)
      if (fromNode) {
        ctx.strokeStyle = '#f59e0b'
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        ctx.arc(fromNode.x + 40, fromNode.y, 8, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }
  }, [nodes, wiringFrom])

  useEffect(() => {
    draw()
  }, [draw])

  const clearAll = () => {
    setNodes([])
    setWiringFrom(null)
  }

  const removeNode = (id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id).map(n => ({
      ...n,
      inputs: n.inputs.filter(inputId => inputId !== id)
    })))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Logic Simulator</h1>
        <p className="text-muted-foreground">Design and simulate digital logic circuits with gates and wiring</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Toolbar */}
        <div className="lg:w-64 space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Add Components</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {GATE_TYPES.map(type => (
                <Button key={type} variant="outline" size="sm" className="w-full justify-start text-xs" onClick={() => addNode(type)}>
                  <span className="font-mono mr-2 w-6 text-center">{GATE_SYMBOLS[type]}</span>
                  {type}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Instructions</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1">
              <p>1. Add gates and inputs/outputs</p>
              <p>2. Click an output dot to start wiring</p>
              <p>3. Click an input dot to connect</p>
              <p>4. Click INPUT nodes to toggle</p>
              <p>5. Simulation runs automatically</p>
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
              Wiring from: {nodes.find(n => n.id === wiringFrom)?.label}
            </Badge>
          )}
        </div>

        {/* Canvas */}
        <div className="flex-1">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            onClick={handleCanvasClick}
            className="border rounded-lg bg-white w-full cursor-crosshair"
            style={{ maxHeight: 'calc(100vh - 200px)' }}
          />
        </div>

        {/* Node list */}
        <div className="lg:w-48">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Nodes ({nodes.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {nodes.map(node => (
                  <div key={node.id} className="flex items-center justify-between text-xs p-1 rounded hover:bg-muted">
                    <span className="font-mono">{node.label}</span>
                    <div className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${node.value ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                      <button onClick={() => removeNode(node.id)} className="text-red-400 hover:text-red-600">×</button>
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
