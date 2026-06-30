'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRole } from '@/contexts/role-context'
import { useSidebar } from '@/contexts/sidebar-context'
import {
  LayoutDashboard,
  PlaySquare,
  Bookmark,
  Search,
  Star,
  Trophy,
  MessageSquare,
  User,
  LogOut,
  ChevronLeft,
} from 'lucide-react'

const scoutNav = [
  { name: 'Dashboard', href: '/scout-dashboard', icon: LayoutDashboard },
  { name: 'Gameplay Feed', href: '/gameplay-feed', icon: PlaySquare },
  { name: 'Saved Videos', href: '/saved-videos', icon: Bookmark },
  { name: 'Search Players', href: '/search-players', icon: Search },
  { name: 'Shortlisted', href: '/shortlisted', icon: Star },
  { name: 'Tournaments', href: '/tournaments', icon: Trophy },
  { name: 'Messages', href: '/messages', icon: MessageSquare },
  { name: 'Scout Profile', href: '/scout-profile', icon: User },
]

const playerNav = [
  { name: 'Dashboard', href: '/player-dashboard', icon: LayoutDashboard },
  { name: 'My Gameplay', href: '/my-gameplay', icon: PlaySquare },
  { name: 'Saved Clips', href: '/saved-clips', icon: Bookmark },
  { name: 'Find Tournaments', href: '/find-tournaments', icon: Trophy },
  { name: 'Messages', href: '/messages', icon: MessageSquare },
  { name: 'Player Profile', href: '/player-profile', icon: User },
]

export function Sidebar() {
  const { activeRole } = useRole()
  const { isSidebarCollapsed, setSidebarCollapsed, isMobileOpen, setMobileOpen } = useSidebar()
  const pathname = usePathname()

  const nav = activeRole === 'scout' ? scoutNav : playerNav

  return (
    <>
      {/* Backdrop for mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`
          fixed left-0 top-0 z-50 h-screen bg-sidebar border-r border-border/50 transition-all duration-300 ease-in-out flex flex-col
          ${isSidebarCollapsed && !isMobileOpen ? 'w-16' : 'w-[250px]'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        {/* Logo area */}
        <div className="flex items-center h-16 px-4 border-b border-border/50">
          <div className={`flex items-center gap-3 ${isSidebarCollapsed && !isMobileOpen ? 'justify-center w-full' : ''}`}>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-purple flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-black text-background">PE</span>
            </div>
            {(!isSidebarCollapsed || isMobileOpen) && (
              <div className="flex flex-col">
                <span className="text-sm font-bold leading-tight text-foreground">PakEsports</span>
                <span className="text-[10px] font-medium text-primary leading-tight">SCOUT PRO</span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin py-4 px-3 space-y-1">
          {nav.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? 'bg-sidebar-active text-primary'
                    : 'text-sidebar-foreground hover:bg-sidebar-active hover:text-foreground'
                } ${isSidebarCollapsed && !isMobileOpen ? 'justify-center px-2' : ''}`}
                title={isSidebarCollapsed && !isMobileOpen ? item.name : undefined}
              >
                <item.icon className={`h-5 w-5 flex-shrink-0 transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                }`} />
                {(!isSidebarCollapsed || isMobileOpen) && <span>{item.name}</span>}
                {isActive && (!isSidebarCollapsed || isMobileOpen) && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary neon-glow" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Bottom section */}
        <div className="p-3 border-t border-border/50 space-y-1">
          {/* Collapse toggle — only on desktop */}
          <button
            onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
            className={`hidden lg:flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-active hover:text-foreground transition-all ${
              isSidebarCollapsed ? 'justify-center' : ''
            }`}
            title={isSidebarCollapsed ? 'Expand' : 'Collapse'}
          >
            <ChevronLeft className={`h-5 w-5 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`} />
            {!isSidebarCollapsed && <span>Collapse</span>}
          </button>

          <button
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-active hover:text-destructive transition-all ${
              isSidebarCollapsed && !isMobileOpen ? 'justify-center' : ''
            }`}
            title={isSidebarCollapsed && !isMobileOpen ? 'Log Out' : undefined}
          >
            <LogOut className="h-5 w-5" />
            {(!isSidebarCollapsed || isMobileOpen) && <span>Log Out</span>}
          </button>
        </div>
      </aside>
    </>
  )
}