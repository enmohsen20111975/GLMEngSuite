'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Calculator,
  GitBranch,
  Workflow,
  ArrowLeftRight,
  GraduationCap,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  BarChart3,
  CircuitBoard,
  FileEdit,
  Microscope,
  PenTool,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

interface SidebarNavProps {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

const navItems: { id: string; href: string; label: string; icon: React.ElementType; group: string }[] = [
  { id: 'dashboard', href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Overview' },
  { id: 'calculators', href: '/calculators', label: 'Calculators', icon: Calculator, group: 'Engineering' },
  { id: 'pipelines', href: '/pipelines', label: 'Pipelines', icon: GitBranch, group: 'Engineering' },
  { id: 'workflow', href: '/workflow', label: 'Workflow Builder', icon: Workflow, group: 'Engineering' },
  { id: 'unit-converter', href: '/unit-converter', label: 'Unit Converter', icon: ArrowLeftRight, group: 'Tools' },
  { id: 'data-analysis', href: '/data-analysis', label: 'Data Analysis', icon: BarChart3, group: 'Tools' },
  { id: 'pdf-editor', href: '/pdf-editor', label: 'PDF Editor', icon: FileEdit, group: 'Tools' },
  { id: 'logic-simulator', href: '/logic-simulator', label: 'Logic Simulator', icon: CircuitBoard, group: 'Simulators' },
  { id: 'electrical-simulator', href: '/electrical-simulator', label: 'Electrical Simulator', icon: Microscope, group: 'Simulators' },
  { id: 'diagram-studio', href: '/diagram-studio', label: 'Diagram Studio', icon: PenTool, group: 'Simulators' },
  { id: 'learning', href: '/learning', label: 'Learning', icon: GraduationCap, group: 'Resources' },
  { id: 'settings', href: '/settings', label: 'Settings', icon: Settings, group: 'System' },
]

export function SidebarNav({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarNavProps) {
  const pathname = usePathname()

  const groups = navItems.reduce<Record<string, typeof navItems>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = []
    acc[item.group].push(item)
    return acc
  }, {})

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onMobileClose} />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300 lg:relative lg:z-auto',
          collapsed ? 'w-16' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className={cn(
          'flex h-14 items-center border-b px-4 gap-3',
          collapsed && 'justify-center px-2'
        )}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shrink-0">
            <Zap className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-bold tracking-tight">EngiSuite</span>
              <span className="text-[10px] text-muted-foreground leading-tight">Analytics Platform</span>
            </div>
          )}
        </div>

        <ScrollArea className="flex-1 py-2">
          <TooltipProvider delayDuration={0}>
            {Object.entries(groups).map(([group, items], groupIdx) => (
              <div key={group}>
                {!collapsed && (
                  <div className="px-4 py-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group}
                    </span>
                  </div>
                )}
                {groupIdx > 0 && collapsed && (
                  <Separator className="my-2 mx-2 w-auto" />
                )}
                <div className="space-y-0.5 px-2">
                  {items.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

                    const linkContent = (
                      <span
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                          'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                          isActive
                            ? 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400'
                            : 'text-sidebar-foreground/70',
                          collapsed && 'justify-center px-2'
                        )}
                      >
                        <Icon className={cn(
                          'h-4 w-4 shrink-0',
                          isActive && 'text-emerald-600 dark:text-emerald-400'
                        )} />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {isActive && !collapsed && (
                          <div className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                        )}
                      </span>
                    )

                    if (collapsed) {
                      return (
                        <Tooltip key={item.id}>
                          <TooltipTrigger asChild>
                            <Link href={item.href} onClick={onMobileClose}>
                              {linkContent}
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="font-medium">{item.label}</TooltipContent>
                        </Tooltip>
                      )
                    }

                    return (
                      <Link key={item.id} href={item.href} onClick={onMobileClose}>
                        {linkContent}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </TooltipProvider>
        </ScrollArea>

        <div className="hidden lg:flex border-t p-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto" onClick={onToggle}>
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      </aside>
    </>
  )
}
