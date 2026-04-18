'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileEdit, Type, Pencil, Square, Circle, ArrowRight, Highlighter, Eraser, Download } from 'lucide-react'

interface PDFElement {
  id: string
  type: 'text' | 'rect' | 'circle' | 'arrow' | 'highlight'
  x: number
  y: number
  width?: number
  height?: number
  text?: string
  color: string
  fontSize?: number
}

export function PDFEditorSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [elements, setElements] = useState<PDFElement[]>([])
  const [tool, setTool] = useState<'text' | 'rect' | 'circle' | 'arrow' | 'highlight'>('text')
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [textInput, setTextInput] = useState('')
  const [color, setColor] = useState('#ef4444')
  const [selectedElement, setSelectedElement] = useState<string | null>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // White background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw A4-like paper
    ctx.fillStyle = '#f9fafb'
    ctx.fillRect(40, 20, canvas.width - 80, canvas.height - 40)
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    ctx.strokeRect(40, 20, canvas.width - 80, canvas.height - 40)

    // Draw elements
    elements.forEach(el => {
      ctx.strokeStyle = el.color
      ctx.fillStyle = el.type === 'highlight' ? el.color + '40' : el.color

      switch (el.type) {
        case 'text':
          ctx.font = `${el.fontSize || 16}px sans-serif`
          ctx.fillText(el.text || '', el.x, el.y)
          break
        case 'rect':
          ctx.strokeRect(el.x, el.y, el.width || 100, el.height || 50)
          break
        case 'circle':
          ctx.beginPath()
          ctx.arc(el.x + (el.width || 50) / 2, el.y + (el.height || 50) / 2, (el.width || 50) / 2, 0, Math.PI * 2)
          ctx.stroke()
          break
        case 'arrow':
          ctx.beginPath()
          ctx.moveTo(el.x, el.y)
          ctx.lineTo(el.x + (el.width || 100), el.y + (el.height || 0))
          ctx.stroke()
          // Arrowhead
          const angle = Math.atan2(el.height || 0, el.width || 100)
          ctx.beginPath()
          ctx.moveTo(el.x + (el.width || 100), el.y + (el.height || 0))
          ctx.lineTo(el.x + (el.width || 100) - 10 * Math.cos(angle - 0.5), el.y + (el.height || 0) - 10 * Math.sin(angle - 0.5))
          ctx.moveTo(el.x + (el.width || 100), el.y + (el.height || 0))
          ctx.lineTo(el.x + (el.width || 100) - 10 * Math.cos(angle + 0.5), el.y + (el.height || 0) - 10 * Math.sin(angle + 0.5))
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
        ctx.strokeRect(el.x - 4, el.y - (el.type === 'text' ? 16 : 4), (el.width || 100) + 8, (el.height || 20) + 8)
        ctx.setLineDash([])
      }
    })
  }, [elements, selectedElement])

  useEffect(() => { draw() }, [draw])

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (tool === 'text') {
      const text = prompt('Enter text:')
      if (text) {
        setElements(prev => [...prev, {
          id: `el_${Date.now()}`,
          type: 'text',
          x, y,
          text,
          color,
          fontSize: 16,
        }])
      }
      return
    }

    setIsDrawing(true)
    setStartPos({ x, y })
  }

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const width = x - startPos.x
    const height = y - startPos.y

    if (Math.abs(width) > 5 || Math.abs(height) > 5) {
      setElements(prev => [...prev, {
        id: `el_${Date.now()}`,
        type: tool,
        x: startPos.x,
        y: startPos.y,
        width: Math.abs(width),
        height: Math.abs(height),
        color,
      }])
    }

    setIsDrawing(false)
  }

  const tools = [
    { id: 'text' as const, icon: Type, label: 'Text' },
    { id: 'rect' as const, icon: Square, label: 'Rectangle' },
    { id: 'circle' as const, icon: Circle, label: 'Circle' },
    { id: 'arrow' as const, icon: ArrowRight, label: 'Arrow' },
    { id: 'highlight' as const, icon: Highlighter, label: 'Highlight' },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">PDF Editor</h1>
        <p className="text-muted-foreground">Add text, shapes, and annotations to documents</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {tools.map(t => (
          <Button
            key={t.id}
            variant={tool === t.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTool(t.id)}
          >
            <t.icon className="h-4 w-4 mr-1" /> {t.label}
          </Button>
        ))}
        <div className="h-6 w-px bg-border mx-1" />
        <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-8 h-8 cursor-pointer rounded border" />
        <Button variant="outline" size="sm" onClick={() => setElements(prev => prev.slice(0, -1))}>
          <Eraser className="h-4 w-4 mr-1" /> Undo
        </Button>
        <Button variant="outline" size="sm" onClick={() => setElements([])}>
          Clear All
        </Button>
      </div>

      <canvas
        ref={canvasRef}
        width={900}
        height={700}
        onMouseDown={handleCanvasMouseDown}
        onMouseUp={handleCanvasMouseUp}
        className="border rounded-lg bg-white w-full cursor-crosshair"
      />
    </div>
  )
}

// Need useCallback import
import { useCallback } from 'react'
