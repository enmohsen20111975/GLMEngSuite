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
  Menu,
  ArrowLeftRight,
  BarChart3,
  FileEdit,
  CircuitBoard,
  Microscope,
  PenTool,
  GraduationCap,
  Settings,
  Zap,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'

// Main nav items shown in the bottom bar
const mainNavItems = [
  { id: 'dashboard', href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'calculators', href: '/calculators', label: 'Calculators', icon: Calculator },
  { id: 'pipelines', href: '/pipelines', label: 'Pipelines', icon: GitBranch },
  { id: 'workflow', href: '/workflow', label: 'Workflow', icon: Workflow },
]

// All nav items for the "More" sheet
const moreNavGroups = [
  {
    group: 'Tools',
    items: [
      { id: 'unit-converter', href: '/unit-converter', label: 'Unit Converter', icon: ArrowLeftRight },
      { id: 'data-analysis', href: '/data-analysis', label: 'Data Analysis', icon: BarChart3 },
      { id: 'pdf-editor', href: '/pdf-editor', label: 'PDF Editor', icon: FileEdit },
    ],
  },
  {
    group: 'Simulators',
    items: [
      { id: 'logic-simulator', href: '/logic-simulator', label: 'Logic Simulator', icon: CircuitBoard },
      { id: 'electrical-simulator', href: '/electrical-simulator', label: 'Electrical Sim', icon: Microscope },
      { id: 'diagram-studio', href: '/diagram-studio', label: 'Diagram Studio', icon: PenTool },
    ],
  },
  {
    group: 'Resources',
    items: [
      { id: 'learning', href: '/learning', label: 'Learning', icon: GraduationCap },
    ],
  },
  {
    group: 'System',
    items: [
      { id: 'settings', href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

export function MobileNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = React.useState(false)

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  // Check if the current route is in the "more" menu
  const isMoreActive = moreNavGroups.some(group =>
    group.items.some(item => isActive(item.href))
  )

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-2">
          {mainNavItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)

            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors duration-150 rounded-lg',
                  'active:scale-95 active:bg-muted/50',
                  active
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <div className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200',
                  active && 'bg-emerald-600/10 dark:bg-emerald-400/10'
                )}>
                  <Icon className={cn('h-5 w-5', active && 'stroke-[2.5px]')} />
                </div>
                <span className={cn(
                  'text-[10px] font-medium leading-none',
                  active && 'font-semibold'
                )}>
                  {item.label}
                </span>
              </Link>
            )
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors duration-150 rounded-lg',
              'active:scale-95 active:bg-muted/50',
              isMoreActive
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <div className={cn(
              'flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200',
              isMoreActive && 'bg-emerald-600/10 dark:bg-emerald-400/10'
            )}>
              <Menu className={cn('h-5 w-5', isMoreActive && 'stroke-[2.5px]')} />
            </div>
            <span className={cn(
              'text-[10px] font-medium leading-none',
              isMoreActive && 'font-semibold'
            )}>
              More
            </span>
          </button>
        </div>
      </nav>

      {/* More Menu Sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh] overflow-y-auto">
          <SheetHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <Zap className="h-4 w-4" />
              </div>
              <div>
                <SheetTitle className="text-left text-base">EngiSuite Analytics</SheetTitle>
                <SheetDescription className="text-left text-xs">
                  Navigate to a section
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="space-y-4 px-4 pb-6">
            {moreNavGroups.map((group, groupIdx) => (
              <div key={group.group}>
                {groupIdx > 0 && <Separator className="mb-4" />}
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {group.group}
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const active = isActive(item.href)

                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={() => setMoreOpen(false)}
                        className={cn(
                          'flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl transition-all duration-150',
                          'active:scale-95',
                          active
                            ? 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 border border-emerald-600/20'
                            : 'bg-muted/50 text-foreground hover:bg-muted border border-transparent'
                        )}
                      >
                        <Icon className={cn('h-5 w-5', active && 'text-emerald-600 dark:text-emerald-400')} />
                        <span className={cn(
                          'text-[11px] font-medium leading-tight text-center',
                          active && 'font-semibold'
                        )}>
                          {item.label}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
