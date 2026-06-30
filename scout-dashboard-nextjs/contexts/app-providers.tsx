'use client'

import { RoleProvider } from './role-context'
import { SidebarProvider } from './sidebar-context'
import { ReactNode } from 'react'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <RoleProvider>
      <SidebarProvider>
        {children}
      </SidebarProvider>
    </RoleProvider>
  )
}