'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { PenTool, Square, Circle, ArrowRight, Type, Minus, Download, Trash2, RotateCcw, Copy, Group, Ungroup, Layers } from 'lucide-react'

interface DiagramElement {
  id: string
  type: 'rect' | 'circle' | 'ellipse' | 'diamond' | 'parallelogram' | 'arrow' | 'line' | 'text' | 'cylinder' | 'cloud'
  x: number
  y: number
  width: number
  height: number
  text: string
  color: string
  fillColor: string
  strokeWidth: number
  fontSize: number
  rotation: number
  groupId?: string
}

const SHAPES = [
  { type: 'rect', label: 'Rectangle', icon: Square },
  { type: 'circle', label: 'Circle', icon: Circle },
  { type: 'diamond', label: 'Diamond', icon: Square },
  { type: 'parallelogram', label: 'Parallelogram', icon: Square },
  { type: 'cylinder', label: 'Cylinder', icon: Layers },
  { type: 'cloud', label: 'Cloud', icon: Circle },
  { type: 'arrow', label: 'Arrow', icon: ArrowRight },
  { type: 'line', label: 'Line', icon: Minus },
  { type: 'text', label: 'Text', icon: Type },
] as const

type ShapeType = typeof SHAPES[number]['type']

const TEMPLATES = {
  flowchart: [
    { type: 'rect' as ShapeType, x: 350, y: 40, width: 120, height: 50, text: 'Start', color: '#059669', fillColor: '#d1fae5' },
    { type: 'diamond' as ShapeType, x: 350, y: 140, width: 140, height: 80, text: 'Condition?', color: '#d97706', fillColor: '#fef3c7' },
    { type: 'rect' as ShapeType, x: 200, y: 270, width: 120, height: 50, text: 'Process A', color: '#2563eb', fillColor: '#dbeafe' },
    { type: 'rect' as ShapeType, x: 500, y: 270, width: 120, height: 50, text: 'Process B', color: '#2563eb', fillColor: '#dbeafe' },
    { type: 'rect' as ShapeType, x: 350, y: 380, width: 120, height: 50, text: 'End', color: '#dc2626', fillColor: '#fee2e2' },
  ],
  network: [
    { type: 'cloud' as ShapeType, x: 320, y: 30, width: 160, height: 80, text: 'Internet', color: '#6366f1', fillColor: '#e0e7ff' },
    { type: 'rect' as ShapeType, x: 370, y: 160, width: 60, height: 40, text: 'Router', color: '#059669', fillColor: '#d1fae5' },
    { type: 'cylinder' as ShapeType, x: 180, y: 260, width: 80, height: 70, text: 'Server', color: '#d97706', fillColor: '#fef3c7' },
    { type: 'rect' as ShapeType, x: 520, y: 260, width: 60, height: 40, text: 'PC', color: '#2563eb', fillColor: '#dbeafe' },
  ],
  erDiagram: [
    { type: 'rect' as ShapeType, x: 150, y: 100, width: 140, height: 120, text: 'Users\nid, name', color: '#059669', fillColor: '#d1fae5' },
    { type: 'rect' as ShapeType, x: 500, y: 100, width: 140, height: 120, text: 'Orders\nid, total', color: '#2563eb', fillColor: '#dbeafe' },
    { type: 'diamond' as ShapeType, x: 325, y: 130, width: 80, height: 50, text: 'has', color: '#d97706', fillColor: '#fef3c7' },
  ],
}

export function DiagramStudioSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [elements, setElements] = useState<DiagramElement[]>([])
  const [selectedShape, setSelectedShape] = useState<ShapeType>('rect')
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [selectedElement, setSelectedElement] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [color, setColor] = useState('#374151')
  const [fillColor, setFillColor] = useState('#ffffff')
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [fontSize, setFontSize] = useState(14)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Background
    ctx.fillStyle = '#f9fafb'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Grid
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 0.5
    for (let x = 0; x < canvas.width; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke()
    }
    for (let y = 0; y < canvas.height; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke()
    }

    // Draw elements
    elements.forEach(el => {
      ctx.save()
      ctx.translate(el.x + el.width / 2, el.y + el.height / 2)
      ctx.rotate((el.rotation * Math.PI) / 180)
      ctx.translate(-el.width / 2, -el.height / 2)

      ctx.strokeStyle = el.color
      ctx.fillStyle = el.fillColor
      ctx.lineWidth = el.strokeWidth

      switch (el.type) {
        case 'rect':
          ctx.fillRect(0, 0, el.width, el.height)
          ctx.strokeRect(0, 0, el.width, el.height)
          break
        case 'circle':
          ctx.beginPath()
          ctx.ellipse(el.width / 2, el.height / 2, Math.max(1, el.width / 2), Math.max(1, el.height / 2), 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
          break
        case 'ellipse':
          ctx.beginPath()
          ctx.ellipse(el.width / 2, el.height / 2, Math.max(1, el.width / 2), Math.max(1, el.height / 3), 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
          break
        case 'diamond':
          ctx.beginPath()
          ctx.moveTo(el.width / 2, 0)
          ctx.lineTo(el.width, el.height / 2)
          ctx.lineTo(el.width / 2, el.height)
          ctx.lineTo(0, el.height / 2)
          ctx.closePath()
          ctx.fill()
          ctx.stroke()
          break
        case 'parallelogram':
          ctx.beginPath()
          ctx.moveTo(el.width * 0.2, 0)
          ctx.lineTo(el.width, 0)
          ctx.lineTo(el.width * 0.8, el.height)
          ctx.lineTo(0, el.height)
          ctx.closePath()
          ctx.fill()
          ctx.stroke()
          break
        case 'cylinder': {
          const ellipseH = Math.min(20, el.height / 4)
          // Body
          ctx.fillRect(0, ellipseH, el.width, el.height - ellipseH * 2)
          ctx.beginPath()
          ctx.moveTo(0, ellipseH); ctx.lineTo(0, el.height - ellipseH)
          ctx.moveTo(el.width, ellipseH); ctx.lineTo(el.width, el.height - ellipseH)
          ctx.stroke()
          // Top ellipse
          ctx.beginPath()
          ctx.ellipse(el.width / 2, ellipseH, Math.max(1, el.width / 2), Math.max(1, ellipseH), 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
          // Bottom ellipse
          ctx.beginPath()
          ctx.ellipse(el.width / 2, el.height - ellipseH, Math.max(1, el.width / 2), Math.max(1, ellipseH), 0, 0, Math.PI)
          ctx.stroke()
          break
        }
        case 'cloud': {
          const cx = el.width / 2
          const cy = el.height / 2
          ctx.beginPath()
          ctx.arc(cx, cy, Math.max(1, el.height / 3), 0, Math.PI * 2)
          ctx.arc(cx - el.width / 4, cy + 5, Math.max(1, el.height / 4), 0, Math.PI * 2)
          ctx.arc(cx + el.width / 4, cy + 5, Math.max(1, el.height / 4), 0, Math.PI * 2)
          ctx.arc(cx - el.width / 6, cy - el.height / 5, Math.max(1, el.height / 4), 0, Math.PI * 2)
          ctx.arc(cx + el.width / 6, cy - el.height / 5, Math.max(1, el.height / 4), 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
          break
        }
        case 'arrow': {
          ctx.beginPath()
          ctx.moveTo(0, el.height / 2)
          ctx.lineTo(el.width, el.height / 2)
          ctx.stroke()
          // Arrowhead
          ctx.beginPath()
          ctx.moveTo(el.width, el.height / 2)
          ctx.lineTo(el.width - 12, el.height / 2 - 6)
          ctx.moveTo(el.width, el.height / 2)
          ctx.lineTo(el.width - 12, el.height / 2 + 6)
          ctx.stroke()
          break
        }
        case 'line':
          ctx.beginPath()
          ctx.moveTo(0, 0)
          ctx.lineTo(el.width, el.height)
          ctx.stroke()
          break
        case 'text':
          ctx.font = `${el.fontSize}px sans-serif`
          ctx.fillStyle = el.color
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const lines = el.text.split('\n')
          lines.forEach((line, i) => {
            ctx.fillText(line, el.width / 2, el.height / 2 + (i - (lines.length - 1) / 2) * (el.fontSize + 2))
          })
          break
      }

      // Text inside shapes
      if (el.type !== 'text' && el.text) {
        ctx.font = `${el.fontSize}px sans-serif`
        ctx.fillStyle = '#1f2937'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const lines = el.text.split('\n')
        lines.forEach((line, i) => {
          ctx.fillText(line, el.width / 2, el.height / 2 + (i - (lines.length - 1) / 2) * (el.fontSize + 2))
        })
      }

      // Selection highlight
      if (el.id === selectedElement) {
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        ctx.strokeRect(-4, -4, el.width + 8, el.height + 8)
        ctx.setLineDash([])
        // Resize handles
        const handles = [[0, 0], [el.width, 0], [0, el.height], [el.width, el.height]]
        ctx.fillStyle = '#3b82f6'
        handles.forEach(([hx, hy]) => {
          ctx.fillRect(hx - 3, hy - 3, 6, 6)
        })
      }

      ctx.restore()
    })
  }, [elements, selectedElement])

  useEffect(() => { draw() }, [draw])

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e)

    // Check if clicking on existing element
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i]
      if (pos.x >= el.x && pos.x <= el.x + el.width && pos.y >= el.y && pos.y <= el.y + el.height) {
        setSelectedElement(el.id)
        setDragging(el.id)
        setDragOffset({ x: pos.x - el.x, y: pos.y - el.y })
        return
      }
    }

    setSelectedElement(null)

    if (selectedShape === 'text') {
      const text = prompt('Enter text:')
      if (text) {
        const newEl: DiagramElement = {
          id: `el_${Date.now()}`,
          type: 'text',
          x: pos.x,
          y: pos.y,
          width: Math.max(80, text.length * fontSize * 0.6),
          height: fontSize + 10,
          text,
          color,
          fillColor: 'transparent',
          strokeWidth: 0,
          fontSize,
          rotation: 0,
        }
        setElements(prev => [...prev, newEl])
      }
      return
    }

    setIsDrawing(true)
    setStartPos(pos)
  }

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragging) {
      setDragging(null)
      return
    }

    if (!isDrawing) return
    const pos = getCanvasPos(e)

    const width = Math.abs(pos.x - startPos.x)
    const height = Math.abs(pos.y - startPos.y)

    if (width > 10 || height > 10) {
      const newEl: DiagramElement = {
        id: `el_${Date.now()}`,
        type: selectedShape,
        x: Math.min(pos.x, startPos.x),
        y: Math.min(pos.y, startPos.y),
        width: Math.max(20, width),
        height: Math.max(20, height),
        text: '',
        color,
        fillColor,
        strokeWidth,
        fontSize,
        rotation: 0,
      }
      setElements(prev => [...prev, newEl])
      setSelectedElement(newEl.id)
    }

    setIsDrawing(false)
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragging) {
      const pos = getCanvasPos(e)
      setElements(prev => prev.map(el =>
        el.id === dragging ? { ...el, x: pos.x - dragOffset.x, y: pos.y - dragOffset.y } : el
      ))
    }
  }

  const updateSelectedElement = (updates: Partial<DiagramElement>) => {
    if (!selectedElement) return
    setElements(prev => prev.map(el =>
      el.id === selectedElement ? { ...el, ...updates } : el
    ))
  }

  const duplicateElement = () => {
    const el = elements.find(e => e.id === selectedElement)
    if (!el) return
    setElements(prev => [...prev, { ...el, id: `el_${Date.now()}`, x: el.x + 20, y: el.y + 20 }])
  }

  const loadTemplate = (name: keyof typeof TEMPLATES) => {
    const template = TEMPLATES[name]
    const newElements = template.map((t, i) => ({
      id: `el_${Date.now()}_${i}`,
      type: t.type,
      x: t.x,
      y: t.y,
      width: t.width,
      height: t.height,
      text: t.text,
      color: t.color,
      fillColor: t.fillColor,
      strokeWidth: 2,
      fontSize: 13,
      rotation: 0,
    }))
    setElements(newElements)
  }

  const exportCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = 'engisuite-diagram.png'
    link.href = canvas.toDataURL()
    link.click()
  }

  const selectedEl = elements.find(e => e.id === selectedElement)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Diagram Studio</h1>
          <p className="text-muted-foreground">Create flowcharts, network diagrams, ER diagrams, and more</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => loadTemplate('flowchart')}>Flowchart</Button>
          <Button variant="outline" size="sm" onClick={() => loadTemplate('network')}>Network</Button>
          <Button variant="outline" size="sm" onClick={() => loadTemplate('erDiagram')}>ER Diagram</Button>
          <Button variant="outline" size="sm" onClick={exportCanvas}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Shape palette */}
        <div className="lg:w-48 space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Shapes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {SHAPES.map(s => {
                const Icon = s.icon
                return (
                  <Button key={s.type} variant={selectedShape === s.type ? 'default' : 'ghost'} size="sm" className="w-full justify-start text-xs" onClick={() => setSelectedShape(s.type)}>
                    <Icon className="h-3 w-3 mr-2" /> {s.label}
                  </Button>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Style</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs w-14">Stroke</Label>
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-7 h-7 cursor-pointer rounded border" />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs w-14">Fill</Label>
                <input type="color" value={fillColor} onChange={e => setFillColor(e.target.value)} className="w-7 h-7 cursor-pointer rounded border" />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs w-14">Width</Label>
                <Input type="number" value={strokeWidth} onChange={e => setStrokeWidth(Number(e.target.value))} className="h-7 text-xs w-16" min={1} max={10} />
              </div>
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
            onMouseUp={handleCanvasMouseUp}
            onMouseMove={handleCanvasMouseMove}
            className="border rounded-lg w-full cursor-crosshair"
            style={{ maxHeight: 'calc(100vh - 200px)' }}
          />
        </div>

        {/* Properties */}
        <div className="lg:w-56 space-y-3">
          {selectedEl ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Properties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <Label className="text-xs">Text</Label>
                  <Input
                    value={selectedEl.text}
                    onChange={e => updateSelectedElement({ text: e.target.value })}
                    className="h-7 text-xs"
                    placeholder="Enter text..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">X</Label>
                    <Input type="number" value={Math.round(selectedEl.x)} onChange={e => updateSelectedElement({ x: Number(e.target.value) })} className="h-7 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Y</Label>
                    <Input type="number" value={Math.round(selectedEl.y)} onChange={e => updateSelectedElement({ y: Number(e.target.value) })} className="h-7 text-xs" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Width</Label>
                    <Input type="number" value={Math.round(selectedEl.width)} onChange={e => updateSelectedElement({ width: Number(e.target.value) })} className="h-7 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Height</Label>
                    <Input type="number" value={Math.round(selectedEl.height)} onChange={e => updateSelectedElement({ height: Number(e.target.value) })} className="h-7 text-xs" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs w-14">Stroke</Label>
                  <input type="color" value={selectedEl.color} onChange={e => updateSelectedElement({ color: e.target.value })} className="w-7 h-7 cursor-pointer rounded border" />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs w-14">Fill</Label>
                  <input type="color" value={selectedEl.fillColor} onChange={e => updateSelectedElement({ fillColor: e.target.value })} className="w-7 h-7 cursor-pointer rounded border" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => updateSelectedElement({ rotation: (selectedEl.rotation + 45) % 360 })}>
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={duplicateElement}>
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button variant="destructive" size="sm" className="flex-1" onClick={() => {
                    setElements(prev => prev.filter(e => e.id !== selectedElement))
                    setSelectedElement(null)
                  }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-4 text-center text-muted-foreground text-sm">
                Select an element to edit its properties, or draw a shape on the canvas
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Elements ({elements.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {elements.map(el => (
                  <div
                    key={el.id}
                    className={`flex items-center justify-between text-xs p-1.5 rounded cursor-pointer hover:bg-muted ${selectedElement === el.id ? 'bg-emerald-50' : ''}`}
                    onClick={() => setSelectedElement(el.id)}
                  >
                    <span className="truncate">{el.text || el.type}</span>
                    <Badge variant="outline" className="text-[10px] px-1 py-0">{el.type}</Badge>
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
