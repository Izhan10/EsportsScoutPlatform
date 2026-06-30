'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { Bell, Settings, Search, ChevronDown, User, Menu } from 'lucide-react'
import { useRole } from '@/contexts/role-context'
import { useSidebar } from '@/contexts/sidebar-context'

export function TopBar() {
  const { activeRole, setActiveRole } = useRole()
  const { isSidebarCollapsed, isMobileOpen, setMobileOpen } = useSidebar()
  const [showRoleMenu, setShowRoleMenu] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showMobileSearch, setShowMobileSearch] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowRoleMenu(false)
        setShowSettings(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <header className={`fixed top-0 right-0 left-0 z-30 flex h-16 items-center border-b border-border/50 bg-background/95 backdrop-blur-xl ${
      isSidebarCollapsed ? 'lg:left-16' : 'lg:left-[250px]'
    }`}>
      <div className="flex w-full items-center justify-between px-6 gap-4">
        {/* Mobile menu toggle */}
        <button
          onClick={() => setMobileOpen(!isMobileOpen)}
          className="lg:hidden rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Search bar — full on desktop, toggleable on mobile */}
        <div className="flex-1 max-w-2xl">
          {/* Mobile search icon trigger */}
          <button
            onClick={() => setShowMobileSearch(!showMobileSearch)}
            className="lg:hidden rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Search className="h-5 w-5" />
          </button>

          {/* Search input — hidden on mobile unless toggled */}
          <div className={`relative ${showMobileSearch ? 'fixed inset-x-4 top-4 z-50' : 'hidden lg:block'}`}>
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search players, tournaments..."
              className="w-full h-11 pl-11 pr-4 rounded-2xl bg-[#0D1B2A] border border-[#1E293B] text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20 transition-all"
              autoFocus={showMobileSearch}
            />
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-3">
          {/* Role switcher */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0D1B2A] border border-[#1E293B] text-sm font-medium text-foreground hover:border-primary/30 transition-all"
            >
              <span className={`w-2 h-2 rounded-full ${activeRole === 'scout' ? 'bg-primary' : 'bg-purple'} neon-glow`} />
              <span>{activeRole === 'scout' ? 'Scout Mode' : 'Player Mode'}</span>
              <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${showRoleMenu ? 'rotate-180' : ''}`} />
            </button>

            {showRoleMenu && (
              <div className="absolute right-0 mt-2 w-44 rounded-2xl border border-[#1E293B] bg-[#0D1B2A] backdrop-blur-xl overflow-hidden shadow-2xl">
                {[
                  { value: 'scout', label: 'Scout Mode', desc: 'Discover & recruit talent' },
                  { value: 'player', label: 'Player Mode', desc: 'Showcase your skills' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setActiveRole(option.value as 'scout' | 'player')
                      setShowRoleMenu(false)
                    }}
                    className={`w-full px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                      activeRole === option.value ? 'bg-muted/30' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${option.value === 'scout' ? 'bg-primary' : 'bg-purple'} neon-glow`} />
                      <span className={`text-sm font-medium ${activeRole === option.value ? 'text-primary' : 'text-foreground'}`}>
                        {option.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 ml-4">{option.desc}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notifications */}
          <button className="relative rounded-xl p-2.5 text-muted-foreground hover:bg-[#0D1B2A] hover:text-foreground transition-all border border-transparent hover:border-[#1E293B]">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary neon-glow" />
          </button>

          {/* Settings */}
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="rounded-xl p-2.5 text-muted-foreground hover:bg-[#0D1B2A] hover:text-foreground transition-all border border-transparent hover:border-[#1E293B]"
            >
              <Settings className="h-5 w-5" />
            </button>
            {showSettings && (
              <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-[#1E293B] bg-[#0D1B2A] backdrop-blur-xl overflow-hidden shadow-2xl">
                <button className="w-full px-4 py-3 text-sm text-left text-foreground hover:bg-muted/50 transition-colors">Account Settings</button>
                <button className="w-full px-4 py-3 text-sm text-left text-foreground hover:bg-muted/50 transition-colors">Appearance</button>
                <button className="w-full px-4 py-3 text-sm text-left text-foreground hover:bg-muted/50 transition-colors">Notifications</button>
                <div className="border-t border-[#1E293B]" />
                <button className="w-full px-4 py-3 text-sm text-left text-destructive hover:bg-muted/50 transition-colors">Log Out</button>
              </div>
            )}
          </div>

          {/* User avatar */}
          <button className="flex items-center gap-2 rounded-xl p-1 pr-3 hover:bg-[#0D1B2A] transition-all border border-transparent hover:border-[#1E293B]">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple to-primary flex items-center justify-center">
              <User className="h-4 w-4 text-white" />
            </div>
            <span className="hidden sm:block text-sm font-medium">ProScout</span>
          </button>
        </div>
      </div>
    </header>
  )
}