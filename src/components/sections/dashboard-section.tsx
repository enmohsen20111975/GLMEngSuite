'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useRouter } from 'next/navigation'
import {
  Calculator, GitBranch, GraduationCap, BarChart3, Workflow,
  ArrowLeftRight, CircuitBoard, FileEdit, Microscope, PenTool, Zap,
} from 'lucide-react'

interface Stats {
  equations: number
  pipelines: number
  courses: number
  categories: number
  domainDistribution: { domain: string; cnt: number }[]
}

const quickActions = [
  { id: 'calculators' as const, label: 'Solve Equations', icon: Calculator, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  { id: 'pipelines' as const, label: 'Run Pipelines', icon: GitBranch, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  { id: 'workflow' as const, label: 'Build Workflows', icon: Workflow, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  { id: 'learning' as const, label: 'Learn Engineering', icon: GraduationCap, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { id: 'data-analysis' as const, label: 'Analyze Data', icon: BarChart3, color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
  { id: 'unit-converter' as const, label: 'Convert Units', icon: ArrowLeftRight, color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
  { id: 'logic-simulator' as const, label: 'Logic Simulator', icon: CircuitBoard, color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  { id: 'pdf-editor' as const, label: 'PDF Editor', icon: FileEdit, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  { id: 'electrical-simulator' as const, label: 'Electrical Sim', icon: Microscope, color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
  { id: 'diagram-studio' as const, label: 'Diagram Studio', icon: PenTool, color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' },
]

export function DashboardSection() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        if (data.success) setStats(data.data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const domainColors: Record<string, string> = {
    electrical: 'bg-amber-500',
    mechanical: 'bg-blue-500',
    civil: 'bg-emerald-500',
    hvac: 'bg-cyan-500',
    hydraulics: 'bg-purple-500',
    chemical: 'bg-rose-500',
    thermodynamics: 'bg-orange-500',
    structural: 'bg-teal-500',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to EngiSuite Analytics — your engineering calculation platform</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Equations', value: stats?.equations ?? '—', icon: Calculator, color: 'text-amber-600' },
          { label: 'Pipelines', value: stats?.pipelines ?? '—', icon: GitBranch, color: 'text-emerald-600' },
          { label: 'Courses', value: stats?.courses ?? '—', icon: GraduationCap, color: 'text-blue-600' },
          { label: 'Categories', value: stats?.categories ?? '—', icon: Zap, color: 'text-purple-600' },
        ].map(stat => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? '...' : stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {quickActions.map(action => (
            <button
              key={action.id}
              onClick={() => router.push(`/${action.id}`)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border hover:shadow-md transition-all duration-200 hover:scale-105"
            >
              <div className={`p-3 rounded-xl ${action.color}`}>
                <action.icon className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium text-center">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Domain Distribution */}
      {stats?.domainDistribution && stats.domainDistribution.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Domain Distribution</CardTitle>
            <CardDescription>Equations per engineering domain</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.domainDistribution.map(d => (
                <div key={d.domain} className="flex items-center gap-3">
                  <span className="w-28 text-sm capitalize truncate">{d.domain}</span>
                  <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${domainColors[d.domain] || 'bg-gray-500'}`}
                      style={{ width: `${Math.min((d.cnt / (stats.equations || 1)) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{d.cnt}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Platform Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Engineering Calculations</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 450+ engineering equations across 8 domains</li>
                <li>• 56 calculation pipelines with 189 steps</li>
                <li>• IEC, NEC, EN standards integration</li>
                <li>• Cable sizing, PF correction, beam design, HVAC</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Tools & Simulators</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Visual workflow builder with node connections</li>
                <li>• Data analysis with file upload (CSV, JSON, Excel)</li>
                <li>• Logic gate simulator with circuit wiring</li>
                <li>• Electrical & hydraulic circuit simulators</li>
                <li>• PDF editor and Diagram Studio</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
