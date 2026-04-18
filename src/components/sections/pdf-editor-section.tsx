'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Type, Pencil, Square, Circle, ArrowRight, Highlighter, Eraser, Minus,
  Download, Upload, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, RotateCcw,
  RotateCw, Printer, Save, FolderOpen, Hand, Plus, Trash2, Stamp,
  FileText, MousePointer2, X, Check, MoveVertical
} from 'lucide-react'
import type { PDFDocumentProxy } from 'pdfjs-dist'

// Lazy-load pdfjs-dist (avoids DOMMatrix SSR error)
let pdfjsLib: typeof import('pdfjs-dist') | null = null
async function getPdfjsLib() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
  }
  return pdfjsLib
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface Point { x: number; y: number }

interface BaseAnnotation {
  id: string
  pageIdx: number
}

interface TextAnnotation extends BaseAnnotation {
  type: 'text'
  x: number; y: number
  text: string
  color: string
  fontSize: number
}

interface FreehandAnnotation extends BaseAnnotation {
  type: 'freehand'
  points: Point[]
  color: string
  strokeWidth: number
}

interface RectAnnotation extends BaseAnnotation {
  type: 'rect'
  x: number; y: number; width: number; height: number
  color: string
  strokeWidth: number
}

interface CircleAnnotation extends BaseAnnotation {
  type: 'circle'
  x: number; y: number; width: number; height: number
  color: string
  strokeWidth: number
}

interface LineAnnotation extends BaseAnnotation {
  type: 'line'
  x1: number; y1: number; x2: number; y2: number
  color: string
  strokeWidth: number
}

interface ArrowAnnotation extends BaseAnnotation {
  type: 'arrow'
  x1: number; y1: number; x2: number; y2: number
  color: string
  strokeWidth: number
}

interface HighlightAnnotation extends BaseAnnotation {
  type: 'highlight'
  x: number; y: number; width: number; height: number
  color: string
  opacity: number
}

interface StampAnnotation extends BaseAnnotation {
  type: 'stamp'
  x: number; y: number
  stampType: StampType
  color: string
}

type Annotation =
  | TextAnnotation
  | FreehandAnnotation
  | RectAnnotation
  | CircleAnnotation
  | LineAnnotation
  | ArrowAnnotation
  | HighlightAnnotation
  | StampAnnotation

type ToolType = 'select' | 'pan' | 'text' | 'freehand' | 'rect' | 'circle' | 'line' | 'arrow' | 'highlight' | 'eraser' | 'stamp'

type StampType = 'APPROVED' | 'REJECTED' | 'DRAFT' | 'CONFIDENTIAL' | 'FINAL' | 'COPY'

interface PageData {
  id: string
  pdfPageIdx: number | null // null = blank page
  annotations: Annotation[]
  width: number
  height: number
}

interface ToolDef {
  id: ToolType
  icon: React.ElementType
  label: string
}

// ─── Constants ──────────────────────────────────────────────────────────────

const TOOLS: ToolDef[] = [
  { id: 'select', icon: MousePointer2, label: 'Select' },
  { id: 'pan', icon: Hand, label: 'Pan' },
  { id: 'text', icon: Type, label: 'Text' },
  { id: 'freehand', icon: Pencil, label: 'Draw' },
  { id: 'rect', icon: Square, label: 'Rectangle' },
  { id: 'circle', icon: Circle, label: 'Circle' },
  { id: 'line', icon: Minus, label: 'Line' },
  { id: 'arrow', icon: ArrowRight, label: 'Arrow' },
  { id: 'highlight', icon: Highlighter, label: 'Highlight' },
  { id: 'eraser', icon: Eraser, label: 'Eraser' },
  { id: 'stamp', icon: Stamp, label: 'Stamp' },
]

const STAMP_TYPES: StampType[] = ['APPROVED', 'REJECTED', 'DRAFT', 'CONFIDENTIAL', 'FINAL', 'COPY']

const STAMP_COLORS: Record<StampType, string> = {
  APPROVED: '#16a34a',
  REJECTED: '#dc2626',
  DRAFT: '#d97706',
  CONFIDENTIAL: '#7c3aed',
  FINAL: '#0891b2',
  COPY: '#64748b',
}

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48]
const STROKE_WIDTHS = [1, 2, 3, 4, 5, 6, 8, 10]
const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4]

const DEFAULT_PAGE_W = 612
const DEFAULT_PAGE_H = 792

// ─── Helpers ────────────────────────────────────────────────────────────────

function uid(): string {
  return `ann_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function pageUid(): string {
  return `page_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// ─── Component ──────────────────────────────────────────────────────────────

export function PDFEditorSection() {
  // PDF state
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [pages, setPages] = useState<PageData[]>([
    { id: pageUid(), pdfPageIdx: 0, annotations: [], width: DEFAULT_PAGE_W, height: DEFAULT_PAGE_H }
  ])
  const [currentPageIdx, setCurrentPageIdx] = useState(0)
  const [pdfFileName, setPdfFileName] = useState<string>('Untitled')

  // View state
  const [zoom, setZoom] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  // Tool state
  const [tool, setTool] = useState<ToolType>('select')
  const [color, setColor] = useState('#ef4444')
  const [fontSize, setFontSize] = useState(16)
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [opacity, setOpacity] = useState(0.4)
  const [selectedStamp, setSelectedStamp] = useState<StampType>('APPROVED')
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null)

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState<Point>({ x: 0, y: 0 })
  const [currentFreehand, setCurrentFreehand] = useState<Point[]>([])
  const [drawCurrent, setDrawCurrent] = useState<Point>({ x: 0, y: 0 })
  const [textInput, setTextInput] = useState<{ visible: boolean; x: number; y: number; value: string }>({
    visible: false, x: 0, y: 0, value: ''
  })

  // Undo/Redo
  const [undoStack, setUndoStack] = useState<Annotation[][]>([])
  const [redoStack, setRedoStack] = useState<Annotation[][]>([])

  // Refs
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null)
  const annotCanvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const textInputRef = useRef<HTMLInputElement>(null)

  const currentPage = pages[currentPageIdx]

  // ─── PDF Rendering ───────────────────────────────────────────────────────

  const renderPdfPage = useCallback(async () => {
    if (!pdfDoc || !currentPage) return

    const pdfPageIdx = currentPage.pdfPageIdx
    if (pdfPageIdx === null) return

    try {
      const page = await pdfDoc.getPage(pdfPageIdx + 1) // PDF.js uses 1-based
      const canvas = pdfCanvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const viewport = page.getViewport({ scale: zoom * 1.5 }) // 1.5 for better quality
      canvas.width = viewport.width
      canvas.height = viewport.height

      await page.render({ canvasContext: ctx, viewport }).promise
    } catch (err) {
      console.error('PDF render error:', err)
    }
  }, [pdfDoc, currentPageIdx, currentPage, zoom])

  // ─── Annotation Rendering ────────────────────────────────────────────────

  const renderAnnotations = useCallback(() => {
    const canvas = annotCanvasRef.current
    const pdfCanvas = pdfCanvasRef.current
    if (!canvas || !pdfCanvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = pdfCanvas.width
    canvas.height = pdfCanvas.height

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (!currentPage) return

    const scale = zoom * 1.5

    currentPage.annotations.forEach(ann => {
      switch (ann.type) {
        case 'text': {
          ctx.font = `${ann.fontSize * scale}px sans-serif`
          ctx.fillStyle = ann.color
          ctx.fillText(ann.text, ann.x * scale, ann.y * scale)
          break
        }
        case 'freehand': {
          if (ann.points.length < 2) break
          ctx.beginPath()
          ctx.strokeStyle = ann.color
          ctx.lineWidth = ann.strokeWidth * scale
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          ctx.moveTo(ann.points[0].x * scale, ann.points[0].y * scale)
          for (let i = 1; i < ann.points.length; i++) {
            ctx.lineTo(ann.points[i].x * scale, ann.points[i].y * scale)
          }
          ctx.stroke()
          break
        }
        case 'rect': {
          ctx.strokeStyle = ann.color
          ctx.lineWidth = ann.strokeWidth * scale
          ctx.strokeRect(ann.x * scale, ann.y * scale, ann.width * scale, ann.height * scale)
          break
        }
        case 'circle': {
          ctx.strokeStyle = ann.color
          ctx.lineWidth = ann.strokeWidth * scale
          const rx = Math.max(1, (ann.width * scale) / 2)
          const ry = Math.max(1, (ann.height * scale) / 2)
          ctx.beginPath()
          ctx.ellipse(ann.x * scale + rx, ann.y * scale + ry, rx, ry, 0, 0, Math.PI * 2)
          ctx.stroke()
          break
        }
        case 'line': {
          ctx.strokeStyle = ann.color
          ctx.lineWidth = ann.strokeWidth * scale
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(ann.x1 * scale, ann.y1 * scale)
          ctx.lineTo(ann.x2 * scale, ann.y2 * scale)
          ctx.stroke()
          break
        }
        case 'arrow': {
          ctx.strokeStyle = ann.color
          ctx.fillStyle = ann.color
          ctx.lineWidth = ann.strokeWidth * scale
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(ann.x1 * scale, ann.y1 * scale)
          ctx.lineTo(ann.x2 * scale, ann.y2 * scale)
          ctx.stroke()
          // Arrowhead
          const angle = Math.atan2(ann.y2 - ann.y1, ann.x2 - ann.x1)
          const headLen = 12 * scale
          ctx.beginPath()
          ctx.moveTo(ann.x2 * scale, ann.y2 * scale)
          ctx.lineTo(ann.x2 * scale - headLen * Math.cos(angle - 0.4), ann.y2 * scale - headLen * Math.sin(angle - 0.4))
          ctx.lineTo(ann.x2 * scale - headLen * Math.cos(angle + 0.4), ann.y2 * scale - headLen * Math.sin(angle + 0.4))
          ctx.closePath()
          ctx.fill()
          break
        }
        case 'highlight': {
          ctx.fillStyle = ann.color
          ctx.globalAlpha = ann.opacity
          ctx.fillRect(ann.x * scale, ann.y * scale, ann.width * scale, ann.height * scale)
          ctx.globalAlpha = 1
          break
        }
        case 'stamp': {
          const stampColor = STAMP_COLORS[ann.stampType]
          const stampW = 160 * scale
          const stampH = 50 * scale
          const sx = ann.x * scale
          const sy = ann.y * scale

          ctx.save()
          ctx.strokeStyle = stampColor
          ctx.lineWidth = 3 * scale
          ctx.strokeRect(sx, sy, stampW, stampH)

          // Diagonal lines
          ctx.beginPath()
          ctx.moveTo(sx, sy)
          ctx.lineTo(sx + stampW, sy + stampH)
          ctx.moveTo(sx + stampW, sy)
          ctx.lineTo(sx, sy + stampH)
          ctx.globalAlpha = 0.15
          ctx.stroke()
          ctx.globalAlpha = 1

          ctx.font = `bold ${14 * scale}px sans-serif`
          ctx.fillStyle = stampColor
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(ann.stampType, sx + stampW / 2, sy + stampH / 2)
          ctx.restore()
          break
        }
      }

      // Selection indicator
      if (ann.id === selectedAnnotation) {
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 1.5
        ctx.setLineDash([5, 5])
        let selX: number, selY: number, selW: number, selH: number
        if (ann.type === 'text') {
          selX = ann.x * scale - 3
          selY = ann.y * scale - ann.fontSize * scale - 3
          selW = ctx.measureText(ann.text).width + 6
          selH = ann.fontSize * scale + 6
        } else if (ann.type === 'freehand') {
          const xs = ann.points.map(p => p.x * scale)
          const ys = ann.points.map(p => p.y * scale)
          selX = Math.min(...xs) - 4
          selY = Math.min(...ys) - 4
          selW = Math.max(...xs) - selX + 8
          selH = Math.max(...ys) - selY + 8
        } else if (ann.type === 'line' || ann.type === 'arrow') {
          selX = Math.min(ann.x1, ann.x2) * scale - 4
          selY = Math.min(ann.y1, ann.y2) * scale - 4
          selW = Math.abs(ann.x2 - ann.x1) * scale + 8
          selH = Math.abs(ann.y2 - ann.y1) * scale + 8
        } else if (ann.type === 'stamp') {
          selX = ann.x * scale - 4
          selY = ann.y * scale - 4
          selW = 160 * scale + 8
          selH = 50 * scale + 8
        } else {
          selX = ann.x * scale - 4
          selY = ann.y * scale - 4
          selW = ann.width * scale + 8
          selH = ann.height * scale + 8
        }
        ctx.strokeRect(selX, selY, selW, selH)
        ctx.setLineDash([])
      }
    })

    // Draw current shape being drawn
    if (isDrawing && tool !== 'freehand') {
      const scale2 = zoom * 1.5
      ctx.strokeStyle = color
      ctx.fillStyle = tool === 'highlight' ? color : 'transparent'
      ctx.lineWidth = (tool === 'highlight' ? 1 : strokeWidth) * scale2
      ctx.setLineDash([4, 4])

      const sx = drawStart.x * scale2
      const sy = drawStart.y * scale2
      const ex = drawCurrent.x * scale2
      const ey = drawCurrent.y * scale2
      const w = ex - sx
      const h = ey - sy

      if (tool === 'rect') {
        ctx.strokeRect(sx, sy, w, h)
      } else if (tool === 'circle') {
        const rx = Math.abs(w) / 2
        const ry = Math.abs(h) / 2
        ctx.beginPath()
        ctx.ellipse(sx + w / 2, sy + h / 2, rx, ry, 0, 0, Math.PI * 2)
        ctx.stroke()
      } else if (tool === 'line' || tool === 'arrow') {
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        ctx.lineTo(ex, ey)
        ctx.stroke()
      } else if (tool === 'highlight') {
        ctx.globalAlpha = opacity
        ctx.fillRect(sx, sy, w, h)
        ctx.globalAlpha = 1
      }
      ctx.setLineDash([])
    }

    // Draw current freehand in progress
    if (isDrawing && tool === 'freehand' && currentFreehand.length > 1) {
      const scale2 = zoom * 1.5
      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.lineWidth = strokeWidth * scale2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.moveTo(currentFreehand[0].x * scale2, currentFreehand[0].y * scale2)
      for (let i = 1; i < currentFreehand.length; i++) {
        ctx.lineTo(currentFreehand[i].x * scale2, currentFreehand[i].y * scale2)
      }
      ctx.stroke()
    }
  }, [currentPage, zoom, selectedAnnotation, isDrawing, tool, color, strokeWidth, opacity, drawStart, drawCurrent, currentFreehand])

  // ─── Render Effects ──────────────────────────────────────────────────────

  useEffect(() => {
    renderPdfPage()
  }, [renderPdfPage])

  useEffect(() => {
    renderAnnotations()
  }, [renderAnnotations])

  // Focus text input when shown
  useEffect(() => {
    if (textInput.visible && textInputRef.current) {
      textInputRef.current.focus()
    }
  }, [textInput.visible])

  // ─── Undo / Redo ─────────────────────────────────────────────────────────

  const pushUndo = useCallback(() => {
    if (!currentPage) return
    setUndoStack(prev => [...prev.slice(-30), currentPage.annotations.map(a => ({ ...a }))])
    setRedoStack([])
  }, [currentPage])

  const undo = useCallback(() => {
    if (undoStack.length === 0 || !currentPage) return
    const prev = undoStack[undoStack.length - 1]
    setUndoStack(s => s.slice(0, -1))
    setRedoStack(s => [...s, currentPage.annotations.map(a => ({ ...a }))])
    setPages(ps => ps.map((p, i) => i === currentPageIdx ? { ...p, annotations: prev } : p))
    setSelectedAnnotation(null)
  }, [undoStack, currentPage, currentPageIdx])

  const redo = useCallback(() => {
    if (redoStack.length === 0 || !currentPage) return
    const next = redoStack[redoStack.length - 1]
    setRedoStack(s => s.slice(0, -1))
    setUndoStack(s => [...s, currentPage.annotations.map(a => ({ ...a }))])
    setPages(ps => ps.map((p, i) => i === currentPageIdx ? { ...p, annotations: next } : p))
    setSelectedAnnotation(null)
  }, [redoStack, currentPage, currentPageIdx])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        undo()
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        redo()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedAnnotation && currentPage) {
          e.preventDefault()
          pushUndo()
          setPages(ps => ps.map((p, i) =>
            i === currentPageIdx
              ? { ...p, annotations: p.annotations.filter(a => a.id !== selectedAnnotation) }
              : p
          ))
          setSelectedAnnotation(null)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo, selectedAnnotation, currentPage, currentPageIdx, pushUndo])

  // ─── Canvas Position Helpers ─────────────────────────────────────────────

  const getCanvasPos = useCallback((e: React.MouseEvent): Point => {
    const canvas = annotCanvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scale = zoom * 1.5
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: ((e.clientX - rect.left) * scaleX) / scale,
      y: ((e.clientY - rect.top) * scaleY) / scale,
    }
  }, [zoom])

  // ─── Hit Test for Selection/Eraser ───────────────────────────────────────

  const hitTest = useCallback((pos: Point, ann: Annotation): boolean => {
    const margin = 8
    switch (ann.type) {
      case 'text':
        return pos.x >= ann.x - margin && pos.x <= ann.x + ann.text.length * ann.fontSize * 0.6 + margin &&
               pos.y >= ann.y - ann.fontSize - margin && pos.y <= ann.y + margin
      case 'freehand':
        return ann.points.some(p => Math.hypot(p.x - pos.x, p.y - pos.y) < ann.strokeWidth + margin)
      case 'rect':
      case 'circle':
      case 'highlight':
        return pos.x >= ann.x - margin && pos.x <= ann.x + ann.width + margin &&
               pos.y >= ann.y - margin && pos.y <= ann.y + ann.height + margin
      case 'line':
      case 'arrow': {
        const dx = ann.x2 - ann.x1
        const dy = ann.y2 - ann.y1
        const len = Math.hypot(dx, dy)
        if (len === 0) return false
        const t = Math.max(0, Math.min(1, ((pos.x - ann.x1) * dx + (pos.y - ann.y1) * dy) / (len * len)))
        const px = ann.x1 + t * dx
        const py = ann.y1 + t * dy
        return Math.hypot(pos.x - px, pos.y - py) < ann.strokeWidth + margin
      }
      case 'stamp':
        return pos.x >= ann.x - margin && pos.x <= ann.x + 160 + margin &&
               pos.y >= ann.y - margin && pos.y <= ann.y + 50 + margin
    }
  }, [])

  // ─── Mouse Handlers ──────────────────────────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Pan with middle button or pan tool
    if (e.button === 1 || tool === 'pan') {
      setIsPanning(true)
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y })
      return
    }

    if (e.button !== 0) return
    const pos = getCanvasPos(e)

    // Select tool
    if (tool === 'select') {
      const found = [...(currentPage?.annotations || [])].reverse().find(a => hitTest(pos, a))
      setSelectedAnnotation(found?.id ?? null)
      return
    }

    // Eraser tool
    if (tool === 'eraser') {
      const found = [...(currentPage?.annotations || [])].reverse().find(a => hitTest(pos, a))
      if (found) {
        pushUndo()
        setPages(ps => ps.map((p, i) =>
          i === currentPageIdx
            ? { ...p, annotations: p.annotations.filter(a => a.id !== found.id) }
            : p
        ))
      }
      return
    }

    // Text tool
    if (tool === 'text') {
      setTextInput({ visible: true, x: pos.x, y: pos.y, value: '' })
      return
    }

    // Stamp tool
    if (tool === 'stamp') {
      pushUndo()
      const newAnn: StampAnnotation = {
        id: uid(),
        pageIdx: currentPageIdx,
        type: 'stamp',
        x: pos.x,
        y: pos.y,
        stampType: selectedStamp,
        color: STAMP_COLORS[selectedStamp],
      }
      setPages(ps => ps.map((p, i) =>
        i === currentPageIdx ? { ...p, annotations: [...p.annotations, newAnn] } : p
      ))
      return
    }

    // Drawing tools
    setIsDrawing(true)
    setDrawStart(pos)
    setDrawCurrent(pos)
    if (tool === 'freehand') {
      setCurrentFreehand([pos])
    }
  }, [tool, panOffset, getCanvasPos, currentPage, currentPageIdx, hitTest, pushUndo, selectedStamp])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
      return
    }
    if (!isDrawing) return
    const pos = getCanvasPos(e)
    setDrawCurrent(pos)
    if (tool === 'freehand') {
      setCurrentFreehand(prev => [...prev, pos])
    }
  }, [isPanning, isDrawing, panStart, getCanvasPos, tool])

  const handleMouseUp = useCallback((_e: React.MouseEvent) => {
    if (isPanning) {
      setIsPanning(false)
      return
    }
    if (!isDrawing) return

    const pos = drawCurrent

    if (tool === 'freehand' && currentFreehand.length > 1) {
      pushUndo()
      const newAnn: FreehandAnnotation = {
        id: uid(),
        pageIdx: currentPageIdx,
        type: 'freehand',
        points: [...currentFreehand],
        color,
        strokeWidth,
      }
      setPages(ps => ps.map((p, i) =>
        i === currentPageIdx ? { ...p, annotations: [...p.annotations, newAnn] } : p
      ))
    } else {
      const dx = pos.x - drawStart.x
      const dy = pos.y - drawStart.y
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        pushUndo()
        let newAnn: Annotation
        const base = { id: uid(), pageIdx: currentPageIdx, color, strokeWidth }

        switch (tool) {
          case 'rect':
            newAnn = { ...base, type: 'rect', x: drawStart.x, y: drawStart.y, width: dx, height: dy }
            break
          case 'circle':
            newAnn = { ...base, type: 'circle', x: drawStart.x, y: drawStart.y, width: dx, height: dy }
            break
          case 'line':
            newAnn = { ...base, type: 'line', x1: drawStart.x, y1: drawStart.y, x2: pos.x, y2: pos.y }
            break
          case 'arrow':
            newAnn = { ...base, type: 'arrow', x1: drawStart.x, y1: drawStart.y, x2: pos.x, y2: pos.y }
            break
          case 'highlight':
            newAnn = { id: uid(), pageIdx: currentPageIdx, type: 'highlight', x: drawStart.x, y: drawStart.y, width: dx, height: dy, color, opacity }
            break
          default:
            setIsDrawing(false)
            setCurrentFreehand([])
            return
        }
        setPages(ps => ps.map((p, i) =>
          i === currentPageIdx ? { ...p, annotations: [...p.annotations, newAnn] } : p
        ))
      }
    }

    setIsDrawing(false)
    setCurrentFreehand([])
  }, [isPanning, isDrawing, drawCurrent, drawStart, currentFreehand, tool, color, strokeWidth, opacity, currentPageIdx, pushUndo])

  // ─── Text Input Submit ───────────────────────────────────────────────────

  const submitText = useCallback(() => {
    if (textInput.value.trim()) {
      pushUndo()
      const newAnn: TextAnnotation = {
        id: uid(),
        pageIdx: currentPageIdx,
        type: 'text',
        x: textInput.x,
        y: textInput.y,
        text: textInput.value,
        color,
        fontSize,
      }
      setPages(ps => ps.map((p, i) =>
        i === currentPageIdx ? { ...p, annotations: [...p.annotations, newAnn] } : p
      ))
    }
    setTextInput({ visible: false, x: 0, y: 0, value: '' })
  }, [textInput, color, fontSize, currentPageIdx, pushUndo])

  // ─── File Operations ─────────────────────────────────────────────────────

  const loadPdf = useCallback(async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const lib = await getPdfjsLib()
      const pdf = await lib.getDocument({ data: arrayBuffer }).promise
      setPdfDoc(pdf)
      setPdfFileName(file.name.replace(/\.pdf$/i, ''))

      const newPages: PageData[] = []
      for (let i = 0; i < pdf.numPages; i++) {
        const page = await pdf.getPage(i + 1)
        const vp = page.getViewport({ scale: 1 })
        newPages.push({
          id: pageUid(),
          pdfPageIdx: i,
          annotations: [],
          width: vp.width,
          height: vp.height,
        })
      }
      setPages(newPages)
      setCurrentPageIdx(0)
      setZoom(1)
      setPanOffset({ x: 0, y: 0 })
      setUndoStack([])
      setRedoStack([])
      setSelectedAnnotation(null)
    } catch (err) {
      console.error('Failed to load PDF:', err)
    }
  }, [])

  const handleFileOpen = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) loadPdf(file)
    e.target.value = ''
  }, [loadPdf])

  const saveToLocalStorage = useCallback(() => {
    const data = pages.map(p => ({
      ...p,
      annotations: p.annotations,
    }))
    localStorage.setItem('engisuite-pdf-annotations', JSON.stringify(data))
    localStorage.setItem('engisuite-pdf-filename', pdfFileName)
  }, [pages, pdfFileName])

  const loadFromLocalStorage = useCallback(() => {
    try {
      const saved = localStorage.getItem('engisuite-pdf-annotations')
      const savedName = localStorage.getItem('engisuite-pdf-filename')
      if (saved) {
        const data = JSON.parse(saved) as PageData[]
        setPages(data)
        if (savedName) setPdfFileName(savedName)
        setCurrentPageIdx(0)
        setUndoStack([])
        setRedoStack([])
        setSelectedAnnotation(null)
      }
    } catch (err) {
      console.error('Failed to load saved data:', err)
    }
  }, [])

  const exportPng = useCallback(() => {
    const pdfCanvas = pdfCanvasRef.current
    const annotCanvas = annotCanvasRef.current
    if (!pdfCanvas || !annotCanvas) return

    // Merge both canvases
    const mergedCanvas = document.createElement('canvas')
    mergedCanvas.width = pdfCanvas.width
    mergedCanvas.height = pdfCanvas.height
    const ctx = mergedCanvas.getContext('2d')
    if (!ctx) return

    // If blank page, draw white background
    if (currentPage?.pdfPageIdx === null) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, mergedCanvas.width, mergedCanvas.height)
    } else {
      ctx.drawImage(pdfCanvas, 0, 0)
    }
    ctx.drawImage(annotCanvas, 0, 0)

    const link = document.createElement('a')
    link.download = `${pdfFileName}_page${currentPageIdx + 1}.png`
    link.href = mergedCanvas.toDataURL('image/png')
    link.click()
  }, [pdfFileName, currentPageIdx, currentPage])

  const handlePrint = useCallback(() => {
    const pdfCanvas = pdfCanvasRef.current
    const annotCanvas = annotCanvasRef.current
    if (!pdfCanvas || !annotCanvas) return

    const mergedCanvas = document.createElement('canvas')
    mergedCanvas.width = pdfCanvas.width
    mergedCanvas.height = pdfCanvas.height
    const ctx = mergedCanvas.getContext('2d')
    if (!ctx) return

    if (currentPage?.pdfPageIdx === null) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, mergedCanvas.width, mergedCanvas.height)
    } else {
      ctx.drawImage(pdfCanvas, 0, 0)
    }
    ctx.drawImage(annotCanvas, 0, 0)

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<html><head><title>Print</title></head><body style="margin:0;display:flex;justify-content:center;"><img src="${mergedCanvas.toDataURL()}" style="max-width:100%;height:auto;"/></body></html>`)
    win.document.close()
    win.print()
  }, [currentPage])

  // ─── Page Management ─────────────────────────────────────────────────────

  const addBlankPage = useCallback(() => {
    const newPage: PageData = {
      id: pageUid(),
      pdfPageIdx: null,
      annotations: [],
      width: DEFAULT_PAGE_W,
      height: DEFAULT_PAGE_H,
    }
    setPages(prev => [...prev, newPage])
    setCurrentPageIdx(prev => prev + 1)
  }, [])

  const deletePage = useCallback(() => {
    if (pages.length <= 1) return
    setPages(prev => prev.filter((_, i) => i !== currentPageIdx))
    setCurrentPageIdx(prev => Math.min(prev, pages.length - 2))
    setSelectedAnnotation(null)
  }, [pages.length, currentPageIdx])

  const movePage = useCallback((fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= pages.length) return
    setPages(prev => {
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      return next
    })
    if (currentPageIdx === fromIdx) setCurrentPageIdx(toIdx)
    else if (currentPageIdx > fromIdx && currentPageIdx <= toIdx) setCurrentPageIdx(prev => prev - 1)
    else if (currentPageIdx < fromIdx && currentPageIdx >= toIdx) setCurrentPageIdx(prev => prev + 1)
  }, [pages.length, currentPageIdx])

  // ─── Zoom Helpers ────────────────────────────────────────────────────────

  const zoomIn = useCallback(() => setZoom(z => Math.min(4, ZOOM_LEVELS.find(l => l > z) ?? z + 0.25)), [])
  const zoomOut = useCallback(() => setZoom(z => Math.max(0.5, [...ZOOM_LEVELS].reverse().find(l => l < z) ?? z - 0.25)), [])
  const fitPage = useCallback(() => {
    const container = containerRef.current
    if (!container || !currentPage) return
    const containerW = container.clientWidth - 40
    const containerH = container.clientHeight - 40
    const scaleW = containerW / (currentPage.width * 1.5)
    const scaleH = containerH / (currentPage.height * 1.5)
    setZoom(Math.min(scaleW, scaleH))
    setPanOffset({ x: 0, y: 0 })
  }, [currentPage])
  const fitWidth = useCallback(() => {
    const container = containerRef.current
    if (!container || !currentPage) return
    const containerW = container.clientWidth - 40
    setZoom(containerW / (currentPage.width * 1.5))
    setPanOffset({ x: 0, y: 0 })
  }, [currentPage])

  // ─── Canvas Cursor ───────────────────────────────────────────────────────

  const getCursor = (): string => {
    switch (tool) {
      case 'pan': return 'grab'
      case 'text': return 'text'
      case 'freehand': return 'crosshair'
      case 'eraser': return 'pointer'
      case 'select': return 'default'
      case 'stamp': return 'copy'
      default: return 'crosshair'
    }
  }

  // ─── Thumbnail Rendering ─────────────────────────────────────────────────

  const renderThumbnail = useCallback(async (pageData: PageData, idx: number) => {
    if (!pdfDoc || pageData.pdfPageIdx === null) return null
    try {
      const page = await pdfDoc.getPage(pageData.pdfPageIdx + 1)
      const viewport = page.getViewport({ scale: 0.2 })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      await page.render({ canvasContext: ctx, viewport }).promise
      return canvas.toDataURL()
    } catch {
      return null
    }
  }, [pdfDoc])

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">PDF Editor</h1>
          <p className="text-muted-foreground text-sm">{pdfFileName} &middot; {pages.length} page{pages.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileOpen} className="hidden" />
          <TooltipProvider>
            <Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><FolderOpen className="h-4 w-4 mr-1" /> Open PDF</Button></TooltipTrigger><TooltipContent>Open a PDF file</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm" onClick={saveToLocalStorage}><Save className="h-4 w-4 mr-1" /> Save</Button></TooltipTrigger><TooltipContent>Save annotations to browser</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm" onClick={loadFromLocalStorage}><Upload className="h-4 w-4 mr-1" /> Load</Button></TooltipTrigger><TooltipContent>Load saved annotations</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm" onClick={exportPng}><Download className="h-4 w-4 mr-1" /> Export PNG</Button></TooltipTrigger><TooltipContent>Export current page as PNG</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4 mr-1" /> Print</Button></TooltipTrigger><TooltipContent>Print current page</TooltipContent></Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Toolbar */}
      <Card className="mb-3 flex-shrink-0">
        <CardContent className="p-2">
          <div className="flex items-center gap-1 flex-wrap">
            {/* Tools */}
            {TOOLS.map(t => (
              <TooltipProvider key={t.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={tool === t.id ? 'default' : 'ghost'}
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => { setTool(t.id); setSelectedAnnotation(null) }}
                    >
                      <t.icon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t.label}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}

            <Separator orientation="vertical" className="h-6 mx-1" />

            {/* Color */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Color</span>
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-7 h-7 cursor-pointer rounded border border-border"
              />
            </div>

            <Separator orientation="vertical" className="h-6 mx-1" />

            {/* Font Size */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Font</span>
              <select
                value={fontSize}
                onChange={e => setFontSize(Number(e.target.value))}
                className="h-7 rounded border border-border bg-background text-xs px-1"
              >
                {FONT_SIZES.map(s => <option key={s} value={s}>{s}px</option>)}
              </select>
            </div>

            {/* Stroke Width */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Stroke</span>
              <select
                value={strokeWidth}
                onChange={e => setStrokeWidth(Number(e.target.value))}
                className="h-7 rounded border border-border bg-background text-xs px-1"
              >
                {STROKE_WIDTHS.map(s => <option key={s} value={s}>{s}px</option>)}
              </select>
            </div>

            {/* Opacity */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Opacity</span>
              <Slider
                value={[opacity * 100]}
                onValueChange={v => setOpacity(v[0] / 100)}
                min={5}
                max={100}
                step={5}
                className="w-20"
              />
              <span className="text-xs w-8">{Math.round(opacity * 100)}%</span>
            </div>

            <Separator orientation="vertical" className="h-6 mx-1" />

            {/* Undo/Redo */}
            <TooltipProvider>
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" className="h-8 px-2" onClick={undo} disabled={undoStack.length === 0}><RotateCcw className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Undo (Ctrl+Z)</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" className="h-8 px-2" onClick={redo} disabled={redoStack.length === 0}><RotateCw className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Redo (Ctrl+Y)</TooltipContent></Tooltip>
            </TooltipProvider>

            <Separator orientation="vertical" className="h-6 mx-1" />

            {/* Zoom controls */}
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={zoomOut}><ZoomOut className="h-4 w-4" /></Button>
              <span className="text-xs font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={zoomIn}><ZoomIn className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={fitPage}>Fit</Button>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={fitWidth}>Width</Button>
            </div>
          </div>

          {/* Stamp selector row (shown when stamp tool active) */}
          {tool === 'stamp' && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t">
              <span className="text-xs text-muted-foreground">Stamp:</span>
              {STAMP_TYPES.map(st => (
                <Button
                  key={st}
                  variant={selectedStamp === st ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  style={selectedStamp !== st ? { borderColor: STAMP_COLORS[st], color: STAMP_COLORS[st] } : {}}
                  onClick={() => setSelectedStamp(st)}
                >
                  {st}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Area: Sidebar + Canvas */}
      <div className="flex gap-3 flex-1 min-h-0">
        {/* Page Thumbnails Sidebar */}
        <Card className="w-36 flex-shrink-0 hidden sm:flex flex-col">
          <CardHeader className="p-2 pb-1">
            <CardTitle className="text-xs font-medium">Pages</CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0 flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="space-y-2">
                {pages.map((pg, idx) => (
                  <PageThumbnail
                    key={pg.id}
                    page={pg}
                    idx={idx}
                    isActive={idx === currentPageIdx}
                    pdfDoc={pdfDoc}
                    onClick={() => { setCurrentPageIdx(idx); setSelectedAnnotation(null) }}
                    onMoveUp={idx > 0 ? () => movePage(idx, idx - 1) : undefined}
                    onMoveDown={idx < pages.length - 1 ? () => movePage(idx, idx + 1) : undefined}
                  />
                ))}
              </div>
            </ScrollArea>
            <div className="flex gap-1 mt-2 pt-2 border-t">
              <Button variant="outline" size="sm" className="h-7 flex-1 text-xs" onClick={addBlankPage}>
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={deletePage} disabled={pages.length <= 1}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Canvas Area */}
        <Card className="flex-1 min-h-0 flex flex-col">
          {/* Page Navigation Bar */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b flex-shrink-0">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setCurrentPageIdx(Math.max(0, currentPageIdx - 1)); setSelectedAnnotation(null) }} disabled={currentPageIdx <= 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={currentPageIdx + 1}
                  onChange={e => {
                    const v = parseInt(e.target.value)
                    if (v >= 1 && v <= pages.length) {
                      setCurrentPageIdx(v - 1)
                      setSelectedAnnotation(null)
                    }
                  }}
                  className="w-12 h-7 text-xs text-center"
                  min={1}
                  max={pages.length}
                />
                <span className="text-xs text-muted-foreground">/ {pages.length}</span>
              </div>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setCurrentPageIdx(Math.min(pages.length - 1, currentPageIdx + 1)); setSelectedAnnotation(null) }} disabled={currentPageIdx >= pages.length - 1}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {selectedAnnotation && (
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-xs">
                    {currentPage?.annotations.find(a => a.id === selectedAnnotation)?.type}
                  </Badge>
                  <Button variant="destructive" size="sm" className="h-6 text-xs px-2" onClick={() => {
                    if (selectedAnnotation) {
                      pushUndo()
                      setPages(ps => ps.map((p, i) =>
                        i === currentPageIdx
                          ? { ...p, annotations: p.annotations.filter(a => a.id !== selectedAnnotation) }
                          : p
                      ))
                      setSelectedAnnotation(null)
                    }
                  }}>
                    <Trash2 className="h-3 w-3 mr-1" /> Delete
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setSelectedAnnotation(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <Badge variant="outline" className="text-xs">
                {tool === 'pan' ? 'Pan' : tool === 'select' ? 'Select' : tool === 'eraser' ? 'Eraser' : tool === 'stamp' ? `Stamp: ${selectedStamp}` : tool.charAt(0).toUpperCase() + tool.slice(1)}
              </Badge>
            </div>
          </div>

          {/* Canvas Container */}
          <div
            ref={containerRef}
            className="flex-1 overflow-auto bg-muted/30 relative min-h-0"
            style={{ cursor: isPanning ? 'grabbing' : getCursor() }}
          >
            <div
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
                display: 'inline-block',
                padding: '20px',
              }}
            >
              <div className="relative shadow-lg bg-white">
                {/* PDF Canvas */}
                <canvas
                  ref={pdfCanvasRef}
                  className="block"
                  style={{ width: `${(currentPage?.width ?? DEFAULT_PAGE_W) * zoom * 1.5}px`, height: `${(currentPage?.height ?? DEFAULT_PAGE_H) * zoom * 1.5}px` }}
                />
                {/* Blank page indicator */}
                {currentPage?.pdfPageIdx === null && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-muted-foreground/30 flex flex-col items-center gap-2">
                      <FileText className="h-16 w-16" />
                      <span className="text-sm">Blank Page</span>
                    </div>
                  </div>
                )}
                {/* Annotation Overlay Canvas */}
                <canvas
                  ref={annotCanvasRef}
                  className="absolute top-0 left-0"
                  style={{ width: `${(currentPage?.width ?? DEFAULT_PAGE_W) * zoom * 1.5}px`, height: `${(currentPage?.height ?? DEFAULT_PAGE_H) * zoom * 1.5}px` }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={() => {
                    if (isPanning) setIsPanning(false)
                    if (isDrawing) {
                      setIsDrawing(false)
                      setCurrentFreehand([])
                    }
                  }}
                />
                {/* Text input overlay */}
                {textInput.visible && (
                  <div
                    className="absolute z-10"
                    style={{
                      left: `${textInput.x * zoom * 1.5}px`,
                      top: `${textInput.y * zoom * 1.5}px`,
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <input
                        ref={textInputRef}
                        type="text"
                        value={textInput.value}
                        onChange={e => setTextInput(prev => ({ ...prev, value: e.target.value }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter') submitText()
                          if (e.key === 'Escape') setTextInput({ visible: false, x: 0, y: 0, value: '' })
                        }}
                        className="h-7 text-sm px-1 border border-primary rounded bg-background min-w-[120px]"
                        style={{ color, fontSize: `${fontSize * zoom * 1.5}px` }}
                        placeholder="Type text..."
                      />
                      <Button size="sm" className="h-6 w-6 p-0" onClick={submitText}><Check className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setTextInput({ visible: false, x: 0, y: 0, value: '' })}><X className="h-3 w-3" /></Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

// ─── PageThumbnail Sub-component ────────────────────────────────────────────

function PageThumbnail({
  page,
  idx,
  isActive,
  pdfDoc,
  onClick,
  onMoveUp,
  onMoveDown,
}: {
  page: PageData
  idx: number
  isActive: boolean
  pdfDoc: PDFDocumentProxy | null
  onClick: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [thumbReady, setThumbReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function render() {
      if (!pdfDoc || page.pdfPageIdx === null) {
        // Blank page - draw white rect
        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width = 80
        canvas.height = 104
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, 80, 104)
        ctx.strokeStyle = '#e5e7eb'
        ctx.strokeRect(0, 0, 80, 104)
        ctx.fillStyle = '#9ca3af'
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Blank', 40, 54)
        setThumbReady(true)
        return
      }

      try {
        const pdfPage = await pdfDoc.getPage(page.pdfPageIdx + 1)
        if (cancelled) return
        const viewport = pdfPage.getViewport({ scale: 0.12 })
        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        await pdfPage.render({ canvasContext: ctx, viewport }).promise
        setThumbReady(true)
      } catch {
        // ignore
      }
    }
    render()
    return () => { cancelled = true }
  }, [pdfDoc, page.pdfPageIdx])

  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className={`w-full rounded border-2 overflow-hidden transition-colors ${
          isActive ? 'border-primary' : 'border-transparent hover:border-muted-foreground/30'
        }`}
      >
        <canvas
          ref={canvasRef}
          className={`w-full ${thumbReady ? 'opacity-100' : 'opacity-0'} transition-opacity`}
        />
      </button>
      <div className="absolute bottom-1 left-1 bg-background/80 rounded px-1">
        <span className="text-[10px] text-muted-foreground">{idx + 1}</span>
      </div>
      {page.annotations.length > 0 && (
        <div className="absolute top-1 right-1">
          <Badge variant="secondary" className="text-[8px] h-3 px-1">{page.annotations.length}</Badge>
        </div>
      )}
      {/* Reorder buttons */}
      <div className="absolute -right-0.5 top-1/2 -translate-y-1/2 hidden group-hover:flex flex-col gap-0.5">
        {onMoveUp && (
          <button
            onClick={e => { e.stopPropagation(); onMoveUp() }}
            className="h-4 w-4 rounded bg-background border border-border flex items-center justify-center hover:bg-accent"
          >
            <MoveVertical className="h-3 w-3 rotate-180" />
          </button>
        )}
        {onMoveDown && (
          <button
            onClick={e => { e.stopPropagation(); onMoveDown() }}
            className="h-4 w-4 rounded bg-background border border-border flex items-center justify-center hover:bg-accent"
          >
            <MoveVertical className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  )
}
