'use client'

import { TopBar } from '@/components/topbar'
import { Sidebar } from '@/components/sidebar'
import { useSidebar } from '@/contexts/sidebar-context'

function MainShell({ children }: { children: React.ReactNode }) {
  const { isSidebarCollapsed } = useSidebar()

  return (
    <main
      className={`min-h-screen pt-16 transition-all duration-300 ease-in-out ${
        isSidebarCollapsed ? 'lg:ml-16' : 'lg:ml-[250px]'
      }`}
    >
      {children}
    </main>
  )
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <TopBar />
      <MainShell>{children}</MainShell>
    </div>
  )
}