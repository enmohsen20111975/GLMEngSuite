'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Upload, BarChart3, Filter, FileSpreadsheet, TableIcon } from 'lucide-react'

interface DataFile {
  name: string
  type: string
  size: number
  columns: string[]
  rows: Record<string, any>[]
  rowCount: number
}

export function DataAnalysisSection() {
  const [dataFile, setDataFile] = useState<DataFile | null>(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [queryResult, setQueryResult] = useState<any[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    try {
      const text = await file.text()
      let columns: string[] = []
      let rows: Record<string, any>[] = []

      if (file.name.endsWith('.csv') || file.name.endsWith('.tsv')) {
        const lines = text.trim().split('\n')
        const separator = file.name.endsWith('.tsv') ? '\t' : ','
        columns = lines[0].split(separator).map(c => c.trim().replace(/^"|"$/g, ''))
        rows = lines.slice(1).map(line => {
          const values = line.split(separator).map(v => v.trim().replace(/^"|"$/g, ''))
          const row: Record<string, any> = {}
          columns.forEach((col, i) => {
            const num = Number(values[i])
            row[col] = isNaN(num) ? values[i] : num
          })
          return row
        })
      } else if (file.name.endsWith('.json')) {
        const data = JSON.parse(text)
        if (Array.isArray(data) && data.length > 0) {
          columns = Object.keys(data[0])
          rows = data
        }
      }

      setDataFile({
        name: file.name,
        type: file.name.split('.').pop() || 'unknown',
        size: file.size,
        columns,
        rows,
        rowCount: rows.length,
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleQuery = () => {
    if (!dataFile || !query.trim()) return
    const q = query.toLowerCase().trim()
    let results = dataFile.rows

    // Simple query: "where column > value"
    const whereMatch = q.match(/where\s+(\w+)\s*(>|<|=|>=|<=|!=)\s*(.+)/)
    if (whereMatch) {
      const [, col, op, val] = whereMatch
      const numVal = Number(val)
      results = results.filter(row => {
        const rowVal = row[col]
        switch (op) {
          case '>': return Number(rowVal) > numVal
          case '<': return Number(rowVal) < numVal
          case '>=': return Number(rowVal) >= numVal
          case '<=': return Number(rowVal) <= numVal
          case '=': return String(rowVal) === val.trim()
          case '!=': return String(rowVal) !== val.trim()
          default: return true
        }
      })
    }

    setQueryResult(results.slice(0, 100))
  }

  const getStats = (col: string) => {
    if (!dataFile) return null
    const values = dataFile.rows.map(r => Number(r[col])).filter(v => !isNaN(v))
    if (values.length === 0) return null
    const sum = values.reduce((a, b) => a + b, 0)
    const avg = sum / values.length
    const min = Math.min(...values)
    const max = Math.max(...values)
    return { count: values.length, sum, avg, min, max }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Data Analysis</h1>
        <p className="text-muted-foreground">Upload, explore, and analyze engineering data</p>
      </div>

      <Tabs defaultValue="upload">
        <TabsList>
          <TabsTrigger value="upload"><Upload className="h-4 w-4 mr-1" /> Upload</TabsTrigger>
          <TabsTrigger value="explore" disabled={!dataFile}><TableIcon className="h-4 w-4 mr-1" /> Explore</TabsTrigger>
          <TabsTrigger value="query" disabled={!dataFile}><Filter className="h-4 w-4 mr-1" /> Query</TabsTrigger>
          <TabsTrigger value="statistics" disabled={!dataFile}><BarChart3 className="h-4 w-4 mr-1" /> Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/50 transition-colors"
              >
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold">Upload Data File</h3>
                <p className="text-sm text-muted-foreground mt-1">Supports CSV, TSV, and JSON files</p>
                <input ref={fileInputRef} type="file" accept=".csv,.tsv,.json" onChange={handleFileUpload} className="hidden" />
              </div>
              {loading && <p className="text-center mt-4 text-muted-foreground">Processing file...</p>}
            </CardContent>
          </Card>

          {dataFile && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">File Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 md:grid-cols-4">
                  <div><span className="text-xs text-muted-foreground">File</span><p className="font-medium text-sm">{dataFile.name}</p></div>
                  <div><span className="text-xs text-muted-foreground">Size</span><p className="font-medium text-sm">{(dataFile.size / 1024).toFixed(1)} KB</p></div>
                  <div><span className="text-xs text-muted-foreground">Rows</span><p className="font-medium text-sm">{dataFile.rowCount}</p></div>
                  <div><span className="text-xs text-muted-foreground">Columns</span><p className="font-medium text-sm">{dataFile.columns.length}</p></div>
                </div>
                <div className="flex flex-wrap gap-1 mt-3">
                  {dataFile.columns.map(col => (
                    <Badge key={col} variant="secondary" className="text-[10px]">{col}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="explore">
          {dataFile && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Data Preview (first 50 rows)</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        {dataFile.columns.map(col => (
                          <TableHead key={col} className="text-xs">{col}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dataFile.rows.slice(0, 50).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                          {dataFile.columns.map(col => (
                            <TableCell key={col} className="text-xs">{String(row[col] ?? '')}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="query">
          {dataFile && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Query Data</CardTitle>
                <CardDescription>Use simple queries like: where column &gt; value</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="where temperature > 30" onKeyDown={e => e.key === 'Enter' && handleQuery()} />
                  <Button onClick={handleQuery}><Filter className="h-4 w-4 mr-1" /> Run</Button>
                </div>
                {queryResult !== null && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">{queryResult.length} results</p>
                    <ScrollArea className="max-h-96">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {dataFile.columns.map(col => <TableHead key={col} className="text-xs">{col}</TableHead>)}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {queryResult.map((row, i) => (
                            <TableRow key={i}>
                              {dataFile.columns.map(col => <TableCell key={col} className="text-xs">{String(row[col] ?? '')}</TableCell>)}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="statistics">
          {dataFile && (
            <div className="grid gap-4 md:grid-cols-2">
              {dataFile.columns.map(col => {
                const stats = getStats(col)
                if (!stats) return null
                return (
                  <Card key={col}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{col}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div><span className="text-muted-foreground">Count</span><p className="font-mono">{stats.count}</p></div>
                        <div><span className="text-muted-foreground">Sum</span><p className="font-mono">{stats.sum.toFixed(2)}</p></div>
                        <div><span className="text-muted-foreground">Avg</span><p className="font-mono">{stats.avg.toFixed(2)}</p></div>
                        <div><span className="text-muted-foreground">Min</span><p className="font-mono">{stats.min.toFixed(2)}</p></div>
                        <div><span className="text-muted-foreground">Max</span><p className="font-mono">{stats.max.toFixed(2)}</p></div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
