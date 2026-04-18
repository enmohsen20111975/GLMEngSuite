'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileEdit, Type, Pencil, Square, Circle, ArrowRight, Highlighter, Eraser, Download, Upload, Minus } from 'lucide-react'

interface PDFElement {
  id: string
  type: 'text' | 'rect' | 'circle' | 'arrow' | 'highlight' | 'line'
  x: number
  y: number
  width?: number
  height?: number
  text?: string
  color: string
  fontSize?: number
  strokeWidth?: number
}

const TOOL_LIST = [
  { id: 'text' as const, icon: Type, label: 'Text' },
  { id: 'rect' as const, icon: Square, label: 'Rectangle' },
  { id: 'circle' as const, icon: Circle, label: 'Circle' },
  { id: 'arrow' as const, icon: ArrowRight, label: 'Arrow' },
  { id: 'line' as const, icon: Minus, label: 'Line' },
  { id: 'highlight' as const, icon: Highlighter, label: 'Highlight' },
]

type ToolType = typeof TOOL_LIST[number]['id']

export function PDFEditorSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [elements, setElements] = useState<PDFElement[]>([])
  const [tool, setTool] = useState<ToolType>('text')
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [color, setColor] = useState('#ef4444')
  const [selectedElement, setSelectedElement] = useState<string | null>(null)
  const [fontSize, setFontSize] = useState(16)
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw background paper
    ctx.fillStyle = '#f3f4f6'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.save()
    ctx.translate(panOffset.x, panOffset.y)
    ctx.scale(zoom, zoom)

    // Draw A4-like paper
    const pageX = 40
    const pageY = 20
    const pageW = canvas.width / zoom - 80
    const pageH = canvas.height / zoom - 40

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(pageX, pageY, pageW, pageH)
    ctx.strokeStyle = '#d1d5db'
    ctx.lineWidth = 1
    ctx.strokeRect(pageX, pageY, pageW, pageH)

    // Draw background image if loaded
    if (backgroundImage) {
      ctx.drawImage(backgroundImage, pageX + 10, pageY + 10, pageW - 20, pageH - 20)
    }

    // Draw elements
    elements.forEach(el => {
      ctx.strokeStyle = el.color
      ctx.fillStyle = el.type === 'highlight' ? el.color + '40' : el.color
      ctx.lineWidth = el.strokeWidth || 2

      switch (el.type) {
        case 'text':
          ctx.font = `${el.fontSize || 16}px sans-serif`
          ctx.fillText(el.text || '', el.x, el.y)
          break
        case 'rect':
          if (el.type === 'rect') {
            ctx.strokeRect(el.x, el.y, el.width || 100, el.height || 50)
          }
          break
        case 'circle':
          ctx.beginPath()
          ctx.arc(el.x + (el.width || 50) / 2, el.y + (el.height || 50) / 2, Math.max(1, (el.width || 50) / 2), 0, Math.PI * 2)
          ctx.stroke()
          break
        case 'arrow': {
          ctx.beginPath()
          ctx.moveTo(el.x, el.y)
          ctx.lineTo(el.x + (el.width || 100), el.y + (el.height || 0))
          ctx.stroke()
          // Arrowhead
          const angle = Math.atan2(el.height || 0, el.width || 100)
          const headLen = 12
          ctx.beginPath()
          ctx.moveTo(el.x + (el.width || 100), el.y + (el.height || 0))
          ctx.lineTo(el.x + (el.width || 100) - headLen * Math.cos(angle - 0.5), el.y + (el.height || 0) - headLen * Math.sin(angle - 0.5))
          ctx.moveTo(el.x + (el.width || 100), el.y + (el.height || 0))
          ctx.lineTo(el.x + (el.width || 100) - headLen * Math.cos(angle + 0.5), el.y + (el.height || 0) - headLen * Math.sin(angle + 0.5))
          ctx.stroke()
          break
        }
        case 'line':
          ctx.beginPath()
          ctx.moveTo(el.x, el.y)
          ctx.lineTo(el.x + (el.width || 100), el.y + (el.height || 0))
          ctx.stroke()
          break
        case 'highlight':
          ctx.fillRect(el.x, el.y, el.width || 200, el.height || 30)
          break
      }

      // Selection indicator
      if (el.id === selectedElement) {
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        const selX = el.type === 'text' ? el.x - 2 : el.x - 4
        const selY = el.type === 'text' ? el.y - (el.fontSize || 16) : el.y - 4
        const selW = el.type === 'text' ? (el.text?.length || 5) * (el.fontSize || 16) * 0.6 + 4 : (el.width || 100) + 8
        const selH = el.type === 'text' ? (el.fontSize || 16) + 4 : (el.height || 20) + 8
        ctx.strokeRect(selX, selY, selW, selH)
        ctx.setLineDash([])
      }
    })

    ctx.restore()
  }, [elements, selectedElement, backgroundImage, zoom, panOffset])

  useEffect(() => { draw() }, [draw])

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX / zoom - panOffset.x / zoom,
      y: (e.clientY - rect.top) * scaleY / zoom - panOffset.y / zoom,
    }
  }

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle click or Alt+click for panning
      setIsPanning(true)
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y })
      return
    }

    const pos = getCanvasPos(e)

    if (tool === 'text') {
      const text = prompt('Enter text:')
      if (text) {
        setElements(prev => [...prev, {
          id: `el_${Date.now()}`,
          type: 'text',
          x: pos.x, y: pos.y,
          text,
          color,
          fontSize,
        }])
      }
      return
    }

    setIsDrawing(true)
    setStartPos(pos)
  }

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setIsPanning(false)
      return
    }

    if (!isDrawing) return
    const pos = getCanvasPos(e)

    const width = pos.x - startPos.x
    const height = pos.y - startPos.y

    if (Math.abs(width) > 3 || Math.abs(height) > 3) {
      setElements(prev => [...prev, {
        id: `el_${Date.now()}`,
        type: tool,
        x: startPos.x,
        y: startPos.y,
        width: Math.abs(width),
        height: Math.abs(height),
        color,
        strokeWidth: 2,
      }])
    }

    setIsDrawing(false)
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      })
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => setBackgroundImage(img)
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  const exportCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = 'engisuite-document.png'
    link.href = canvas.toDataURL()
    link.click()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">PDF Editor</h1>
          <p className="text-muted-foreground">Add text, shapes, and annotations to documents</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" /> Upload Image
          </Button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
          <Button variant="outline" size="sm" onClick={exportCanvas}>
            <Download className="h-4 w-4 mr-1" /> Export PNG
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap border rounded-lg p-2 bg-card">
        {TOOL_LIST.map(t => (
          <Button
            key={t.id}
            variant={tool === t.id ? 'default' : 'ghost'}
            size="sm"
            onClick={() => { setTool(t.id); setSelectedElement(null) }}
          >
            <t.icon className="h-4 w-4 mr-1" /> {t.label}
          </Button>
        ))}
        <div className="h-6 w-px bg-border mx-1" />
        <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-8 h-8 cursor-pointer rounded border" title="Color" />
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Size:</span>
          <Input type="number" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="w-16 h-8 text-xs" min={8} max={72} />
        </div>
        <div className="h-6 w-px bg-border mx-1" />
        <Button variant="outline" size="sm" onClick={() => setElements(prev => prev.slice(0, -1))}>
          <Eraser className="h-4 w-4 mr-1" /> Undo
        </Button>
        <Button variant="outline" size="sm" onClick={() => { setElements([]); setSelectedElement(null) }}>
          Clear All
        </Button>
        <div className="h-6 w-px bg-border mx-1" />
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Zoom:</span>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}>−</Button>
          <span className="text-xs font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setZoom(z => Math.min(3, z + 0.25))}>+</Button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={1000}
        height={700}
        onMouseDown={handleCanvasMouseDown}
        onMouseUp={handleCanvasMouseUp}
        onMouseMove={handleCanvasMouseMove}
        className="border rounded-lg w-full cursor-crosshair"
        style={{ maxHeight: 'calc(100vh - 260px)' }}
      />

      {selectedElement && (
        <Card>
          <CardContent className="p-3 flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">Selected: {elements.find(e => e.id === selectedElement)?.type}</span>
            <Button variant="destructive" size="sm" onClick={() => {
              setElements(prev => prev.filter(e => e.id !== selectedElement))
              setSelectedElement(null)
            }}>Delete</Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
