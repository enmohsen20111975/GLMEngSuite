'use client'

import { useState, useRef, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Upload, BarChart3, Filter, FileSpreadsheet, TableIcon, Plus, Trash2, Download,
  PieChart, LineChart, ScatterChart, TrendingUp, Save, Eye, LayoutDashboard,
  Type, Hash, Move, X, ChevronDown, ChevronUp, Search, Copy, Settings
} from 'lucide-react'
import {
  BarChart, Bar, Line, Pie, Scatter, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts'

// ============== Types ==============
interface DataFile {
  id: string
  name: string
  type: string
  size: number
  columns: ColumnDef[]
  rows: Record<string, any>[]
  rowCount: number
}

interface ColumnDef {
  name: string
  type: 'number' | 'string' | 'date' | 'boolean'
  sample: any[]
}

interface QueryCondition {
  id: string
  column: string
  operator: string
  value: string
}

interface ChartConfig {
  id: string
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'histogram'
  title: string
  xColumn: string
  yColumns: string[]
  colors: string[]
}

interface ReportSection {
  id: string
  type: 'title' | 'text' | 'table' | 'chart' | 'stats'
  title: string
  content: string
  chartId?: string
  columns?: string[]
}

interface DashboardWidget {
  id: string
  type: 'chart' | 'table' | 'stats' | 'text'
  title: string
  chartId?: string
  content?: string
  columns?: string[]
  colSpan: number
  rowSpan: number
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']
const OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'contains', 'starts with', 'in']

function generateId() {
  return `id_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
}

function detectColumnType(values: any[]): ColumnDef['type'] {
  const sample = values.slice(0, 50).filter(v => v !== null && v !== undefined && v !== '')
  if (sample.length === 0) return 'string'
  const numCount = sample.filter(v => !isNaN(Number(v)) && v !== '').length
  if (numCount / sample.length > 0.8) return 'number'
  const boolCount = sample.filter(v => ['true', 'false', '0', '1', 'yes', 'no'].includes(String(v).toLowerCase())).length
  if (boolCount / sample.length > 0.8) return 'boolean'
  return 'string'
}

// ============== Component ==============
export function DataAnalysisSection() {
  const [dataFiles, setDataFiles] = useState<DataFile[]>([])
  const [activeFileId, setActiveFileId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Query Builder state
  const [queryConditions, setQueryConditions] = useState<QueryCondition[]>([])
  const [queryGroupBy, setQueryGroupBy] = useState('')
  const [queryAggFunc, setQueryAggFunc] = useState('COUNT')
  const [queryAggColumn, setQueryAggColumn] = useState('')
  const [queryOrderBy, setQueryOrderBy] = useState('')
  const [queryOrderDir, setQueryOrderDir] = useState<'asc' | 'desc'>('asc')
  const [queryLimit, setQueryLimit] = useState(100)
  const [queryResult, setQueryResult] = useState<any[] | null>(null)

  // Chart Builder state
  const [charts, setCharts] = useState<ChartConfig[]>([])

  // Report Builder state
  const [reportSections, setReportSections] = useState<ReportSection[]>([])
  const [savedReports, setSavedReports] = useState<{ name: string; sections: ReportSection[] }[]>([])

  // Dashboard Builder state
  const [dashboardWidgets, setDashboardWidgets] = useState<DashboardWidget[]>([])
  const [savedDashboards, setSavedDashboards] = useState<{ name: string; widgets: DashboardWidget[] }[]>([])

  // Explorer state
  const [sortColumn, setSortColumn] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [filterText, setFilterText] = useState('')

  const activeFile = dataFiles.find(f => f.id === activeFileId) || null

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    try {
      const text = await file.text()
      let columns: ColumnDef[] = []
      let rows: Record<string, any>[] = []

      if (file.name.endsWith('.csv') || file.name.endsWith('.tsv')) {
        const lines = text.trim().split('\n')
        const separator = file.name.endsWith('.tsv') ? '\t' : ','
        const colNames = lines[0].split(separator).map(c => c.trim().replace(/^"|"$/g, ''))
        rows = lines.slice(1).map(line => {
          const values = line.split(separator).map(v => v.trim().replace(/^"|"$/g, ''))
          const row: Record<string, any> = {}
          colNames.forEach((col, i) => {
            const raw = values[i] || ''
            const num = Number(raw)
            row[col] = raw === '' ? null : (!isNaN(num) && raw !== '' ? num : raw)
          })
          return row
        })
        columns = colNames.map(name => ({
          name,
          type: detectColumnType(rows.map(r => r[name])),
          sample: rows.slice(0, 5).map(r => r[name])
        }))
      } else if (file.name.endsWith('.json')) {
        const data = JSON.parse(text)
        const arr = Array.isArray(data) ? data : [data]
        if (arr.length > 0) {
          const colNames = Object.keys(arr[0])
          rows = arr.map(item => {
            const row: Record<string, any> = {}
            colNames.forEach(col => {
              const raw = item[col]
              row[col] = typeof raw === 'number' ? raw : (raw === null ? null : String(raw))
            })
            return row
          })
          columns = colNames.map(name => ({
            name,
            type: detectColumnType(rows.map(r => r[name])),
            sample: rows.slice(0, 5).map(r => r[name])
          }))
        }
      }

      const newFile: DataFile = {
        id: generateId(),
        name: file.name,
        type: file.name.split('.').pop() || 'unknown',
        size: file.size,
        columns,
        rows,
        rowCount: rows.length,
      }
      setDataFiles(prev => [...prev, newFile])
      setActiveFileId(newFile.id)
    } catch (err) {
      console.error('File upload error:', err)
    } finally {
      setLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeFile = (id: string) => {
    setDataFiles(prev => prev.filter(f => f.id !== id))
    if (activeFileId === id) setActiveFileId(dataFiles.length > 1 ? dataFiles.find(f => f.id !== id)?.id || null : null)
  }

  // Get stats for a column
  const getStats = useCallback((colName: string) => {
    if (!activeFile) return null
    const values = activeFile.rows.map(r => Number(r[colName])).filter(v => !isNaN(v))
    if (values.length === 0) return null
    const sum = values.reduce((a, b) => a + b, 0)
    const avg = sum / values.length
    const sorted = [...values].sort((a, b) => a - b)
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)]
    return {
      count: values.length,
      sum: sum,
      avg: avg,
      min: Math.min(...values),
      max: Math.max(...values),
      median,
      stdDev: Math.sqrt(values.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / values.length),
      nullCount: activeFile.rows.length - values.length,
    }
  }, [activeFile])

  // Execute query
  const executeQuery = useCallback(() => {
    if (!activeFile) return
    let results = [...activeFile.rows]

    // Apply WHERE conditions
    for (const cond of queryConditions) {
      if (!cond.column || !cond.operator || cond.value === '') continue
      results = results.filter(row => {
        const rowVal = row[cond.column]
        const condVal = cond.value
        switch (cond.operator) {
          case '=': return String(rowVal) === condVal
          case '!=': return String(rowVal) !== condVal
          case '>': return Number(rowVal) > Number(condVal)
          case '<': return Number(rowVal) < Number(condVal)
          case '>=': return Number(rowVal) >= Number(condVal)
          case '<=': return Number(rowVal) <= Number(condVal)
          case 'contains': return String(rowVal).toLowerCase().includes(condVal.toLowerCase())
          case 'starts with': return String(rowVal).toLowerCase().startsWith(condVal.toLowerCase())
          case 'in': return condVal.split(',').map(v => v.trim()).includes(String(rowVal))
          default: return true
        }
      })
    }

    // Apply GROUP BY
    if (queryGroupBy && queryAggFunc && queryAggColumn) {
      const groups: Record<string, any[]> = {}
      results.forEach(row => {
        const key = String(row[queryGroupBy])
        if (!groups[key]) groups[key] = []
        groups[key].push(row)
      })
      results = Object.entries(groups).map(([key, groupRows]) => {
        const values = groupRows.map(r => Number(r[queryAggColumn])).filter(v => !isNaN(v))
        let aggValue = 0
        switch (queryAggFunc) {
          case 'COUNT': aggValue = groupRows.length; break
          case 'SUM': aggValue = values.reduce((a, b) => a + b, 0); break
          case 'AVG': aggValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0; break
          case 'MIN': aggValue = values.length > 0 ? Math.min(...values) : 0; break
          case 'MAX': aggValue = values.length > 0 ? Math.max(...values) : 0; break
        }
        return { [queryGroupBy]: key, [`${queryAggFunc}(${queryAggColumn})`]: Math.round(aggValue * 1000) / 1000 }
      })
    }

    // Apply ORDER BY
    if (queryOrderBy) {
      results.sort((a, b) => {
        const va = a[queryOrderBy], vb = b[queryOrderBy]
        const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
        return queryOrderDir === 'asc' ? cmp : -cmp
      })
    }

    setQueryResult(results.slice(0, queryLimit))
  }, [activeFile, queryConditions, queryGroupBy, queryAggFunc, queryAggColumn, queryOrderBy, queryOrderDir, queryLimit])

  // Sorted & filtered data for explorer
  const explorerData = useMemo(() => {
    if (!activeFile) return []
    let data = [...activeFile.rows]
    if (filterText) {
      const ft = filterText.toLowerCase()
      data = data.filter(row => Object.values(row).some(v => String(v).toLowerCase().includes(ft)))
    }
    if (sortColumn) {
      data.sort((a, b) => {
        const va = a[sortColumn], vb = b[sortColumn]
        const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va ?? '').localeCompare(String(vb ?? ''))
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return data.slice(0, 200)
  }, [activeFile, sortColumn, sortDir, filterText])

  // Chart data
  const getChartData = useCallback((chart: ChartConfig) => {
    if (!activeFile) return []
    const colNames = activeFile.columns.map(c => c.name)
    if (!colNames.includes(chart.xColumn)) return []

    if (chart.type === 'histogram') {
      const values = activeFile.rows.map(r => Number(r[chart.xColumn])).filter(v => !isNaN(v))
      if (values.length === 0) return []
      const min = Math.min(...values), max = Math.max(...values)
      const bins = 10
      const binWidth = (max - min) / bins || 1
      const histogram = Array.from({ length: bins }, (_, i) => ({
        range: `${(min + i * binWidth).toFixed(1)}-${(min + (i + 1) * binWidth).toFixed(1)}`,
        count: values.filter(v => v >= min + i * binWidth && v < min + (i + 1) * binWidth).length,
      }))
      return histogram
    }

    if (chart.type === 'pie') {
      const valueCounts: Record<string, number> = {}
      activeFile.rows.forEach(row => {
        const key = String(row[chart.xColumn] ?? 'N/A')
        valueCounts[key] = (valueCounts[key] || 0) + 1
      })
      return Object.entries(valueCounts).map(([name, value]) => ({ name, value }))
    }

    // bar, line, scatter, area
    return activeFile.rows.slice(0, 100).map(row => {
      const point: Record<string, any> = { [chart.xColumn]: row[chart.xColumn] }
      chart.yColumns.forEach(yc => {
        if (colNames.includes(yc)) point[yc] = Number(row[yc]) || 0
      })
      return point
    })
  }, [activeFile])

  // Save report
  const saveReport = (name: string) => {
    const saved = JSON.parse(localStorage.getItem('engisuite_reports') || '[]')
    saved.push({ name, sections: reportSections })
    localStorage.setItem('engisuite_reports', JSON.stringify(saved))
    setSavedReports(saved)
  }

  // Save dashboard
  const saveDashboard = (name: string) => {
    const saved = JSON.parse(localStorage.getItem('engisuite_dashboards') || '[]')
    saved.push({ name, widgets: dashboardWidgets })
    localStorage.setItem('engisuite_dashboards', JSON.stringify(saved))
    setSavedDashboards(saved)
  }

  // Export report as HTML
  const exportReportHTML = () => {
    let html = `<!DOCTYPE html><html><head><title>Report</title>
    <style>body{font-family:system-ui;max-width:800px;margin:0 auto;padding:20px}
    h1{color:#10b981;border-bottom:2px solid #10b981;padding-bottom:8px}
    h2{color:#374151;margin-top:20px}table{border-collapse:collapse;width:100%;margin:10px 0}
    th,td{border:1px solid #e5e7eb;padding:8px;text-align:left;font-size:13px}
    th{background:#f9fafb;font-weight:600}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
    .stat-card{background:#f9fafb;border-radius:8px;padding:12px;text-align:center}
    .stat-value{font-size:24px;font-weight:700;color:#10b981}.stat-label{font-size:12px;color:#6b7280}
    @media print{body{max-width:none}}</style></head><body>`
    reportSections.forEach(section => {
      switch (section.type) {
        case 'title': html += `<h1>${section.title || 'Report'}</h1>`; break
        case 'text': html += `<p>${section.content}</p>`; break
        case 'stats':
          if (activeFile && section.columns) {
            html += `<h2>${section.title}</h2><div class="stats">`
            section.columns.forEach(col => {
              const stats = getStats(col)
              if (stats) {
                html += `<div class="stat-card"><div class="stat-value">${stats.avg.toFixed(2)}</div><div class="stat-label">${col} (avg)</div></div>`
                html += `<div class="stat-card"><div class="stat-value">${stats.min}</div><div class="stat-label">${col} (min)</div></div>`
                html += `<div class="stat-card"><div class="stat-value">${stats.max}</div><div class="stat-label">${col} (max)</div></div>`
              }
            })
            html += `</div>`
          }
          break
        case 'table':
          if (activeFile && section.columns) {
            html += `<h2>${section.title}</h2><table><thead><tr>${section.columns.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>`
            activeFile.rows.slice(0, 50).forEach(row => {
              html += `<tr>${section.columns!.map(c => `<td>${row[c] ?? ''}</td>`).join('')}</tr>`
            })
            html += `</tbody></table>`
          }
          break
      }
    })
    html += `</body></html>`
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'report.html'; a.click()
    URL.revokeObjectURL(url)
  }

  // Render a chart
  const renderChart = (chart: ChartConfig, height = 300) => {
    const data = getChartData(chart)
    if (data.length === 0) return <div className="text-center text-muted-foreground py-8">No data for this chart</div>

    return (
      <ResponsiveContainer width="100%" height={height}>
        {chart.type === 'bar' ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={chart.xColumn} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {chart.yColumns.map((yc, i) => (
              <Bar key={yc} dataKey={yc} fill={chart.colors[i] || COLORS[i % COLORS.length]} />
            ))}
          </BarChart>
        ) : chart.type === 'line' ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={chart.xColumn} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {chart.yColumns.map((yc, i) => (
              <Line key={yc} type="monotone" dataKey={yc} stroke={chart.colors[i] || COLORS[i % COLORS.length]} />
            ))}
          </LineChart>
        ) : chart.type === 'area' ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={chart.xColumn} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {chart.yColumns.map((yc, i) => (
              <Bar key={yc} dataKey={yc} fill={chart.colors[i] || COLORS[i % COLORS.length]} fillOpacity={0.6} />
            ))}
          </BarChart>
        ) : chart.type === 'pie' ? (
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={height / 2 - 30} label>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        ) : chart.type === 'scatter' ? (
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={chart.xColumn} tick={{ fontSize: 11 }} name={chart.xColumn} />
            <YAxis dataKey={chart.yColumns[0]} tick={{ fontSize: 11 }} name={chart.yColumns[0]} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Scatter name={chart.title} data={data} fill={chart.colors[0] || COLORS[0]} />
          </ScatterChart>
        ) : (
          // histogram
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="range" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#10b981" />
          </BarChart>
        )}
      </ResponsiveContainer>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Data Analysis</h1>
        <p className="text-muted-foreground">Upload, explore, query, chart, report, and dashboard your engineering data</p>
      </div>

      {/* Dataset Switcher */}
      {dataFiles.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">Active Dataset:</span>
          {dataFiles.map(f => (
            <Badge
              key={f.id}
              variant={f.id === activeFileId ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setActiveFileId(f.id)}
            >
              {f.name} ({f.rowCount} rows)
              <X className="h-3 w-3 ml-1 cursor-pointer" onClick={(e) => { e.stopPropagation(); removeFile(f.id) }} />
            </Badge>
          ))}
        </div>
      )}

      <Tabs defaultValue="upload" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="upload"><Upload className="h-4 w-4 mr-1" /> Upload</TabsTrigger>
          <TabsTrigger value="explore" disabled={!activeFile}><TableIcon className="h-4 w-4 mr-1" /> Explore</TabsTrigger>
          <TabsTrigger value="query" disabled={!activeFile}><Filter className="h-4 w-4 mr-1" /> Query</TabsTrigger>
          <TabsTrigger value="charts" disabled={!activeFile}><BarChart3 className="h-4 w-4 mr-1" /> Charts</TabsTrigger>
          <TabsTrigger value="report" disabled={!activeFile}><FileSpreadsheet className="h-4 w-4 mr-1" /> Report</TabsTrigger>
          <TabsTrigger value="dashboard" disabled={!activeFile}><LayoutDashboard className="h-4 w-4 mr-1" /> Dashboard</TabsTrigger>
        </TabsList>

        {/* ========== UPLOAD TAB ========== */}
        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-colors"
              >
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold">Upload Data File</h3>
                <p className="text-sm text-muted-foreground mt-1">Supports CSV, TSV, and JSON files</p>
                <input ref={fileInputRef} type="file" accept=".csv,.tsv,.json,.xlsx" onChange={handleFileUpload} className="hidden" />
              </div>
              {loading && <p className="text-center mt-4 text-muted-foreground">Processing file...</p>}
            </CardContent>
          </Card>

          {activeFile && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">File Summary: {activeFile.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-4">
                  <div><span className="text-xs text-muted-foreground">File</span><p className="font-medium text-sm">{activeFile.name}</p></div>
                  <div><span className="text-xs text-muted-foreground">Size</span><p className="font-medium text-sm">{(activeFile.size / 1024).toFixed(1)} KB</p></div>
                  <div><span className="text-xs text-muted-foreground">Rows</span><p className="font-medium text-sm">{activeFile.rowCount}</p></div>
                  <div><span className="text-xs text-muted-foreground">Columns</span><p className="font-medium text-sm">{activeFile.columns.length}</p></div>
                </div>
                <div className="flex flex-wrap gap-1 mt-3">
                  {activeFile.columns.map(col => (
                    <Badge key={col.name} variant="secondary" className="text-[10px]">
                      {col.name} <span className="ml-1 text-muted-foreground">({col.type})</span>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ========== EXPLORE TAB ========== */}
        <TabsContent value="explore" className="space-y-4">
          {activeFile && (
            <>
              <div className="flex gap-2 items-center">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Filter rows..." value={filterText} onChange={e => setFilterText(e.target.value)} className="pl-8 h-9" />
                </div>
                <span className="text-sm text-muted-foreground">{explorerData.length} of {activeFile.rowCount} rows</span>
              </div>
              <Card>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          {activeFile.columns.map(col => (
                            <TableHead key={col.name} className="text-xs cursor-pointer hover:bg-muted/50 select-none"
                              onClick={() => { if (sortColumn === col.name) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortColumn(col.name); setSortDir('asc') } }}>
                              <div className="flex items-center gap-1">
                                {col.name}
                                {sortColumn === col.name && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                                <span className="text-muted-foreground text-[9px]">({col.type})</span>
                              </div>
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {explorerData.map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                            {activeFile.columns.map(col => (
                              <TableCell key={col.name} className="text-xs max-w-[200px] truncate">{String(row[col.name] ?? '')}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Column Statistics */}
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {activeFile.columns.map(col => {
                  const stats = getStats(col.name)
                  if (!stats) return null
                  return (
                    <Card key={col.name}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{col.name} <span className="text-muted-foreground">({col.type})</span></CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div><span className="text-muted-foreground">Count</span><p className="font-mono">{stats.count}</p></div>
                          <div><span className="text-muted-foreground">Sum</span><p className="font-mono">{stats.sum.toFixed(2)}</p></div>
                          <div><span className="text-muted-foreground">Avg</span><p className="font-mono">{stats.avg.toFixed(2)}</p></div>
                          <div><span className="text-muted-foreground">Min</span><p className="font-mono">{stats.min.toFixed(2)}</p></div>
                          <div><span className="text-muted-foreground">Max</span><p className="font-mono">{stats.max.toFixed(2)}</p></div>
                          <div><span className="text-muted-foreground">Median</span><p className="font-mono">{stats.median.toFixed(2)}</p></div>
                          <div><span className="text-muted-foreground">StdDev</span><p className="font-mono">{stats.stdDev.toFixed(2)}</p></div>
                          <div><span className="text-muted-foreground">Nulls</span><p className="font-mono">{stats.nullCount}</p></div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </>
          )}
        </TabsContent>

        {/* ========== QUERY BUILDER TAB ========== */}
        <TabsContent value="query" className="space-y-4">
          {activeFile && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Visual Query Builder</CardTitle>
                  <CardDescription>Build queries visually without writing SQL</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* WHERE conditions */}
                  <div>
                    <Label className="text-sm font-medium">WHERE Conditions</Label>
                    <div className="space-y-2 mt-2">
                      {queryConditions.map((cond, i) => (
                        <div key={cond.id} className="flex gap-2 items-center">
                          <Select value={cond.column} onValueChange={v => setQueryConditions(prev => prev.map((c, j) => j === i ? { ...c, column: v } : c))}>
                            <SelectTrigger className="w-32 h-8"><SelectValue placeholder="Column" /></SelectTrigger>
                            <SelectContent>{activeFile.columns.map(col => <SelectItem key={col.name} value={col.name}>{col.name}</SelectItem>)}</SelectContent>
                          </Select>
                          <Select value={cond.operator} onValueChange={v => setQueryConditions(prev => prev.map((c, j) => j === i ? { ...c, operator: v } : c))}>
                            <SelectTrigger className="w-28 h-8"><SelectValue placeholder="Op" /></SelectTrigger>
                            <SelectContent>{OPERATORS.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}</SelectContent>
                          </Select>
                          <Input value={cond.value} onChange={e => setQueryConditions(prev => prev.map((c, j) => j === i ? { ...c, value: e.target.value } : c))} placeholder="Value" className="h-8 flex-1" />
                          <Button variant="ghost" size="sm" onClick={() => setQueryConditions(prev => prev.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => setQueryConditions(prev => [...prev, { id: generateId(), column: '', operator: '=', value: '' }])}>
                        <Plus className="h-3 w-3 mr-1" /> Add Condition
                      </Button>
                    </div>
                  </div>

                  {/* GROUP BY */}
                  <div className="flex gap-2 items-end flex-wrap">
                    <div>
                      <Label className="text-xs">GROUP BY</Label>
                      <Select value={queryGroupBy} onValueChange={setQueryGroupBy}>
                        <SelectTrigger className="w-36 h-8"><SelectValue placeholder="None" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {activeFile.columns.map(col => <SelectItem key={col.name} value={col.name}>{col.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Aggregate</Label>
                      <Select value={queryAggFunc} onValueChange={setQueryAggFunc}>
                        <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">On Column</Label>
                      <Select value={queryAggColumn} onValueChange={setQueryAggColumn}>
                        <SelectTrigger className="w-36 h-8"><SelectValue placeholder="Column" /></SelectTrigger>
                        <SelectContent>{activeFile.columns.map(col => <SelectItem key={col.name} value={col.name}>{col.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* ORDER BY & LIMIT */}
                  <div className="flex gap-2 items-end flex-wrap">
                    <div>
                      <Label className="text-xs">ORDER BY</Label>
                      <Select value={queryOrderBy} onValueChange={setQueryOrderBy}>
                        <SelectTrigger className="w-36 h-8"><SelectValue placeholder="None" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {activeFile.columns.map(col => <SelectItem key={col.name} value={col.name}>{col.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Direction</Label>
                      <Select value={queryOrderDir} onValueChange={v => setQueryOrderDir(v as 'asc' | 'desc')}>
                        <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="asc">ASC</SelectItem>
                          <SelectItem value="desc">DESC</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">LIMIT</Label>
                      <Input type="number" value={queryLimit} onChange={e => setQueryLimit(parseInt(e.target.value) || 100)} className="w-20 h-8" />
                    </div>
                    <Button onClick={executeQuery} className="h-8"><Filter className="h-3 w-3 mr-1" /> Execute</Button>
                  </div>
                </CardContent>
              </Card>

              {queryResult !== null && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Query Results ({queryResult.length} rows)</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="max-h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {Object.keys(queryResult[0] || {}).map(key => (
                              <TableHead key={key} className="text-xs">{key}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {queryResult.map((row, i) => (
                            <TableRow key={i}>
                              {Object.values(row).map((val, j) => (
                                <TableCell key={j} className="text-xs">{String(val ?? '')}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ========== CHART BUILDER TAB ========== */}
        <TabsContent value="charts" className="space-y-4">
          {activeFile && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Chart Builder</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2 items-end flex-wrap">
                    <div>
                      <Label className="text-xs">Chart Type</Label>
                      <Select value="bar" onValueChange={v => {
                        const newChart: ChartConfig = {
                          id: generateId(), type: v as ChartConfig['type'], title: `Chart ${charts.length + 1}`,
                          xColumn: activeFile.columns[0]?.name || '', yColumns: [],
                          colors: [...COLORS],
                        }
                        setCharts(prev => [...prev, newChart])
                      }}>
                        <SelectTrigger className="w-32 h-8"><SelectValue placeholder="Add Chart" /></SelectTrigger>
                        <SelectContent>
                          {['bar', 'line', 'pie', 'scatter', 'area', 'histogram'].map(t => (
                            <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {charts.map(chart => (
                <Card key={chart.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2 items-end flex-wrap flex-1">
                        <Input value={chart.title} onChange={e => setCharts(prev => prev.map(c => c.id === chart.id ? { ...c, title: e.target.value } : c))} className="h-8 w-40 font-medium" />
                        <div>
                          <Label className="text-[10px]">Type</Label>
                          <Select value={chart.type} onValueChange={v => setCharts(prev => prev.map(c => c.id === chart.id ? { ...c, type: v as ChartConfig['type'] } : c))}>
                            <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {['bar', 'line', 'pie', 'scatter', 'area', 'histogram'].map(t => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[10px]">X Axis</Label>
                          <Select value={chart.xColumn} onValueChange={v => setCharts(prev => prev.map(c => c.id === chart.id ? { ...c, xColumn: v } : c))}>
                            <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{activeFile.columns.map(col => <SelectItem key={col.name} value={col.name}>{col.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        {chart.type !== 'pie' && chart.type !== 'histogram' && (
                          <div>
                            <Label className="text-[10px]">Y Axis</Label>
                            <Select value={chart.yColumns[0] || ''} onValueChange={v => setCharts(prev => prev.map(c => c.id === chart.id ? { ...c, yColumns: [v] } : c))}>
                              <SelectTrigger className="w-32 h-7 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                              <SelectContent>{activeFile.columns.filter(c => c.type === 'number').map(col => <SelectItem key={col.name} value={col.name}>{col.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setCharts(prev => prev.filter(c => c.id !== chart.id))}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {renderChart(chart)}
                  </CardContent>
                </Card>
              ))}

              {charts.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Select a chart type above to create your first chart</p>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ========== REPORT BUILDER TAB ========== */}
        <TabsContent value="report" className="space-y-4">
          {activeFile && (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Report Builder</CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={exportReportHTML}><Download className="h-3 w-3 mr-1" /> Export HTML</Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm"><Save className="h-3 w-3 mr-1" /> Save</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Save Report</DialogTitle></DialogHeader>
                          <Input id="report-name" placeholder="Report name" />
                          <Button onClick={() => {
                            const name = (document.getElementById('report-name') as HTMLInputElement)?.value || 'Untitled'
                            saveReport(name)
                          }}>Save</Button>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 flex-wrap">
                    {(['title', 'text', 'table', 'chart', 'stats'] as const).map(type => (
                      <Button key={type} variant="outline" size="sm" onClick={() => setReportSections(prev => [...prev, {
                        id: generateId(), type, title: type.charAt(0).toUpperCase() + type.slice(1),
                        content: '', columns: type === 'table' || type === 'stats' ? [activeFile.columns[0]?.name || ''] : [],
                      }])}>
                        <Plus className="h-3 w-3 mr-1" /> {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {reportSections.map((section, i) => (
                <Card key={section.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">{section.type}</Badge>
                      <Button variant="ghost" size="sm" onClick={() => setReportSections(prev => prev.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Input value={section.title} onChange={e => setReportSections(prev => prev.map((s, j) => j === i ? { ...s, title: e.target.value } : s))} placeholder="Section title" className="h-8" />
                    {section.type === 'text' && (
                      <Textarea value={section.content} onChange={e => setReportSections(prev => prev.map((s, j) => j === i ? { ...s, content: e.target.value } : s))} placeholder="Text content..." rows={3} />
                    )}
                    {(section.type === 'table' || section.type === 'stats') && (
                      <div className="flex gap-1 flex-wrap">
                        {activeFile.columns.map(col => (
                          <Badge key={col.name} variant={section.columns?.includes(col.name) ? 'default' : 'outline'}
                            className="cursor-pointer text-[10px]"
                            onClick={() => setReportSections(prev => prev.map((s, j) => {
                              if (j !== i) return s
                              const cols = s.columns || []
                              return { ...s, columns: cols.includes(col.name) ? cols.filter(c => c !== col.name) : [...cols, col.name] }
                            }))}>
                            {col.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {section.type === 'chart' && charts.length > 0 && (
                      <Select value={section.chartId || ''} onValueChange={v => setReportSections(prev => prev.map((s, j) => j === i ? { ...s, chartId: v } : s))}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Select chart" /></SelectTrigger>
                        <SelectContent>{charts.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
                      </Select>
                    )}
                    {/* Preview */}
                    {section.type === 'title' && <h2 className="text-xl font-bold text-emerald-700">{section.title}</h2>}
                    {section.type === 'text' && <p className="text-sm text-muted-foreground">{section.content}</p>}
                    {section.type === 'stats' && section.columns && (
                      <div className="grid grid-cols-3 gap-2">
                        {section.columns.map(col => {
                          const stats = getStats(col)
                          if (!stats) return null
                          return (
                            <div key={col} className="bg-muted/50 rounded-lg p-3 text-center">
                              <div className="text-xl font-bold text-emerald-600">{stats.avg.toFixed(2)}</div>
                              <div className="text-[10px] text-muted-foreground">{col} avg</div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {section.type === 'chart' && section.chartId && renderChart(charts.find(c => c.id === section.chartId)!, 200)}
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </TabsContent>

        {/* ========== DASHBOARD BUILDER TAB ========== */}
        <TabsContent value="dashboard" className="space-y-4">
          {activeFile && (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Dashboard Builder</CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => {
                        const html = `<!DOCTYPE html><html><head><title>Dashboard</title><style>body{font-family:system-ui;padding:20px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.widget{border:1px solid #e5e7eb;border-radius:8px;padding:16px}h3{margin:0 0 8px;font-size:14px}</style></head><body><h1>Engineering Dashboard</h1><div class="grid">${dashboardWidgets.map(w => `<div class="widget"><h3>${w.title}</h3><p>Widget: ${w.type}</p></div>`).join('')}</div></body></html>`
                        const blob = new Blob([html], { type: 'text/html' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a'); a.href = url; a.download = 'dashboard.html'; a.click()
                        URL.revokeObjectURL(url)
                      }}><Download className="h-3 w-3 mr-1" /> Export HTML</Button>
                      <Dialog>
                        <DialogTrigger asChild><Button variant="outline" size="sm"><Save className="h-3 w-3 mr-1" /> Save</Button></DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Save Dashboard</DialogTitle></DialogHeader>
                          <Input id="dash-name" placeholder="Dashboard name" />
                          <Button onClick={() => saveDashboard((document.getElementById('dash-name') as HTMLInputElement)?.value || 'Untitled')}>Save</Button>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 flex-wrap">
                    {(['chart', 'table', 'stats', 'text'] as const).map(type => (
                      <Button key={type} variant="outline" size="sm" onClick={() => setDashboardWidgets(prev => [...prev, {
                        id: generateId(), type, title: `${type.charAt(0).toUpperCase() + type.slice(1)} Widget`,
                        content: '', colSpan: 1, rowSpan: 1, columns: type === 'table' || type === 'stats' ? [activeFile.columns[0]?.name || ''] : [],
                      }])}>
                        <Plus className="h-3 w-3 mr-1" /> {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Dashboard Grid */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {dashboardWidgets.map((widget, i) => (
                  <Card key={widget.id} className={widget.colSpan === 2 ? 'md:col-span-2' : ''}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <Input value={widget.title} onChange={e => setDashboardWidgets(prev => prev.map((w, j) => j === i ? { ...w, title: e.target.value } : w))} className="h-7 text-sm font-medium border-0 p-0" />
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setDashboardWidgets(prev => prev.map((w, j) => j === i ? { ...w, colSpan: w.colSpan === 1 ? 2 : 1 } : w))}><Move className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => setDashboardWidgets(prev => prev.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {widget.type === 'chart' && (
                        <div>
                          <Select value={widget.chartId || ''} onValueChange={v => setDashboardWidgets(prev => prev.map((w, j) => j === i ? { ...w, chartId: v } : w))}>
                            <SelectTrigger className="h-7 text-xs mb-2"><SelectValue placeholder="Select chart" /></SelectTrigger>
                            <SelectContent>{charts.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
                          </Select>
                          {widget.chartId && renderChart(charts.find(c => c.id === widget.chartId)!, 200)}
                        </div>
                      )}
                      {widget.type === 'stats' && widget.columns && (
                        <div>
                          <div className="flex gap-1 flex-wrap mb-2">
                            {activeFile.columns.map(col => (
                              <Badge key={col.name} variant={widget.columns?.includes(col.name) ? 'default' : 'outline'}
                                className="cursor-pointer text-[9px]"
                                onClick={() => setDashboardWidgets(prev => prev.map((w, j) => {
                                  if (j !== i) return w
                                  const cols = w.columns || []
                                  return { ...w, columns: cols.includes(col.name) ? cols.filter(c => c !== col.name) : [...cols, col.name] }
                                }))}>
                                {col.name}
                              </Badge>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {widget.columns.map(col => {
                              const stats = getStats(col)
                              if (!stats) return null
                              return (
                                <div key={col} className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3 text-center">
                                  <div className="text-lg font-bold text-emerald-600">{stats.avg.toFixed(1)}</div>
                                  <div className="text-[9px] text-muted-foreground">{col} avg</div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                      {widget.type === 'table' && widget.columns && (
                        <div>
                          <div className="flex gap-1 flex-wrap mb-2">
                            {activeFile.columns.map(col => (
                              <Badge key={col.name} variant={widget.columns?.includes(col.name) ? 'default' : 'outline'}
                                className="cursor-pointer text-[9px]"
                                onClick={() => setDashboardWidgets(prev => prev.map((w, j) => {
                                  if (j !== i) return w
                                  const cols = w.columns || []
                                  return { ...w, columns: cols.includes(col.name) ? cols.filter(c => c !== col.name) : [...cols, col.name] }
                                }))}>
                                {col.name}
                              </Badge>
                            ))}
                          </div>
                          <ScrollArea className="max-h-48">
                            <Table>
                              <TableHeader>
                                <TableRow>{widget.columns.map(c => <TableHead key={c} className="text-[10px]">{c}</TableHead>)}</TableRow>
                              </TableHeader>
                              <TableBody>
                                {activeFile.rows.slice(0, 10).map((row, ri) => (
                                  <TableRow key={ri}>{widget.columns!.map(c => <TableCell key={c} className="text-[10px]">{String(row[c] ?? '')}</TableCell>)}</TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </ScrollArea>
                        </div>
                      )}
                      {widget.type === 'text' && (
                        <Textarea value={widget.content || ''} onChange={e => setDashboardWidgets(prev => prev.map((w, j) => j === i ? { ...w, content: e.target.value } : w))} placeholder="Enter text..." rows={3} className="text-sm" />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {dashboardWidgets.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <LayoutDashboard className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Add widgets above to build your dashboard</p>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
