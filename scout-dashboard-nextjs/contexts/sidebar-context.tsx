'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface SidebarContextType {
  isSidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  isMobileOpen: boolean
  setMobileOpen: (open: boolean) => void
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isMobileOpen, setMobileOpen] = useState(false)

  return (
    <SidebarContext.Provider value={{ isSidebarCollapsed, setSidebarCollapsed, isMobileOpen, setMobileOpen }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}
