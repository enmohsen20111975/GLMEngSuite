'use client'

import { Search, Menu, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface HeaderProps {
  onToggleSidebar: () => void
  sidebarOpen: boolean
}

const sectionTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/calculators': 'Engineering Calculators',
  '/pipelines': 'Calculation Pipelines',
  '/workflow': 'Workflow Builder',
  '/unit-converter': 'Unit Converter',
  '/data-analysis': 'Data Analysis',
  '/pdf-editor': 'PDF Editor',
  '/logic-simulator': 'Logic Simulator',
  '/electrical-simulator': 'Electrical Simulator',
  '/diagram-studio': 'Diagram Studio',
  '/learning': 'Learning Platform',
  '/settings': 'Settings',
}

export function Header({ onToggleSidebar, sidebarOpen }: HeaderProps) {
  const pathname = usePathname()

  const getTitle = () => {
    // Check for exact match first
    if (sectionTitles[pathname]) return sectionTitles[pathname]
    // Check for prefix match (e.g., /calculators/ohms-law)
    const baseSegment = '/' + pathname.split('/').filter(Boolean)[0]
    if (sectionTitles[baseSegment]) return sectionTitles[baseSegment]
    return 'EngiSuite Analytics'
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 lg:hidden"
        onClick={onToggleSidebar}
      >
        {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        <span className="sr-only">Toggle sidebar</span>
      </Button>

      <div className="flex-1">
        <h1 className="text-lg font-semibold hidden sm:block">
          {getTitle()}
        </h1>
      </div>

      <div className="hidden md:flex items-center gap-2 flex-1 max-w-sm">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search equations, pipelines..."
            className="pl-8 h-9"
          />
        </div>
      </div>

      <ThemeToggle />
    </header>
  )
}
