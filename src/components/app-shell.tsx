'use client'

import * as React from 'react'
import { SidebarNav } from '@/components/sidebar-nav'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { MobileNav } from '@/components/mobile-nav'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex flex-1">
        <SidebarNav
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <div className="flex flex-1 flex-col min-w-0">
          <Header
            onToggleSidebar={() => setMobileOpen(!mobileOpen)}
            sidebarOpen={mobileOpen}
          />
          <main className="flex-1 p-4 lg:p-6 pb-20 md:pb-4 lg:pb-6">
            {children}
          </main>
          <Footer />
        </div>
      </div>
      <MobileNav />
    </div>
  )
}
