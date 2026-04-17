'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  Calculator,
  GitBranch,
  GraduationCap,
  Bot,
  ArrowLeftRight,
  Workflow,
  TrendingUp,
  Zap,
  BookOpen,
  Users,
  Activity,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useActiveSection } from '@/stores/active-section-store'

interface DashboardStats {
  totalEquations: number
  totalPipelines: number
  totalCourses: number
  totalCategories: number
  domainStats: { domain: string; count: number }[]
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

const domainIcons: Record<string, string> = {
  electrical: '⚡',
  mechanical: '⚙️',
  civil: '🏗️',
  hvac: '❄️',
  hydraulic: '💧',
  thermodynamics: '🌡️',
  chemical: '🧪',
  structural: '🏢',
}

const domainColors: Record<string, string> = {
  electrical: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  mechanical: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  civil: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  hvac: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  hydraulic: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  thermodynamics: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  chemical: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  structural: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
}

export function DashboardSection() {
  const { setActiveSection } = useActiveSection()
  const [stats, setStats] = React.useState<DashboardStats | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch('/api/stats')
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch (err) {
        console.error('Failed to load stats:', err)
      } finally {
        setLoading(false)
      }
    }
    loadStats()
  }, [])

  const statCards = [
    {
      title: 'Equations',
      value: stats?.totalEquations ?? 23,
      icon: Calculator,
      description: 'Engineering equations',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
      action: () => setActiveSection('calculators'),
    },
    {
      title: 'Pipelines',
      value: stats?.totalPipelines ?? 6,
      icon: GitBranch,
      description: 'Multi-step calculations',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
      action: () => setActiveSection('pipelines'),
    },
    {
      title: 'Courses',
      value: stats?.totalCourses ?? 4,
      icon: GraduationCap,
      description: 'Learning modules',
      color: 'text-violet-600',
      bgColor: 'bg-violet-50 dark:bg-violet-900/20',
      action: () => setActiveSection('learning'),
    },
    {
      title: 'Categories',
      value: stats?.totalCategories ?? 8,
      icon: BookOpen,
      description: 'Engineering domains',
      color: 'text-rose-600',
      bgColor: 'bg-rose-50 dark:bg-rose-900/20',
      action: () => setActiveSection('calculators'),
    },
  ]

  const quickActions = [
    { label: 'Solve Equation', icon: Calculator, section: 'calculators' as const, desc: 'Browse & solve engineering equations' },
    { label: 'Run Pipeline', icon: GitBranch, section: 'pipelines' as const, desc: 'Step-by-step calculations' },
    { label: 'Build Workflow', icon: Workflow, section: 'workflow' as const, desc: 'Visual drag-and-drop builder' },
    { label: 'Convert Units', icon: ArrowLeftRight, section: 'unit-converter' as const, desc: 'Unit & dimension conversion' },
    { label: 'Learn', icon: GraduationCap, section: 'learning' as const, desc: 'Engineering courses & quizzes' },
    { label: 'AI Assistant', icon: Bot, section: 'ai-assistant' as const, desc: 'Ask engineering questions' },
  ]

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Welcome Banner */}
      <motion.div variants={item}>
        <Card className="border-emerald-200 dark:border-emerald-800 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Welcome to EngiSuite Analytics</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Your professional engineering calculation and learning platform. Solve equations, run multi-step pipelines, and advance your engineering knowledge.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card
              key={stat.title}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={stat.action}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{loading ? '...' : stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={item}>
        <h3 className="text-lg font-semibold mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <Card
                key={action.label}
                className="cursor-pointer hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition-all group"
                onClick={() => setActiveSection(action.section)}
              >
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/30 transition-colors">
                    <Icon className="h-5 w-5 text-muted-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
                  </div>
                  <span className="text-sm font-medium">{action.label}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">{action.desc}</span>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </motion.div>

      {/* Domain Distribution */}
      <motion.div variants={item} className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-600" />
              Equations by Domain
            </CardTitle>
            <CardDescription>Distribution of engineering equations across domains</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(stats?.domainStats || [
                { domain: 'electrical', count: 5 },
                { domain: 'mechanical', count: 5 },
                { domain: 'civil', count: 3 },
                { domain: 'hvac', count: 3 },
                { domain: 'hydraulic', count: 3 },
                { domain: 'thermodynamics', count: 2 },
                { domain: 'chemical', count: 2 },
              ]).map((d) => {
                const total = stats?.domainStats?.reduce((a, b) => a + b.count, 0) || 23
                const pct = Math.round((d.count / total) * 100)
                return (
                  <div key={d.domain} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span>{domainIcons[d.domain] || '📐'}</span>
                        <span className="capitalize">{d.domain}</span>
                      </span>
                      <span className="text-muted-foreground">{d.count} ({pct}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Platform Overview
            </CardTitle>
            <CardDescription>Key features and capabilities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: 'Equation Solver', desc: 'Solve 23+ engineering equations with real-time calculation', badge: 'Core' },
                { label: 'Calculation Pipelines', desc: '6 multi-step calculation workflows with guided inputs', badge: 'Popular' },
                { label: 'AI Assistant', desc: 'Get engineering help from an AI-powered assistant', badge: 'New' },
                { label: 'Learning Platform', desc: '4 courses with 32 lessons across engineering domains', badge: 'Core' },
                { label: 'Unit Converter', desc: '38 unit conversions across 8 categories', badge: 'Tool' },
                { label: 'Workflow Builder', desc: 'Visual drag-and-drop engineering workflow designer', badge: 'Beta' },
              ].map((feature) => (
                <div key={feature.label} className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium">{feature.label}</p>
                    <p className="text-xs text-muted-foreground">{feature.desc}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {feature.badge}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
