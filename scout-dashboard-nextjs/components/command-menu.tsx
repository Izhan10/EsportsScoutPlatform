'use client'

import { useState, useEffect } from 'react'
import { Command } from 'cmdk'
import { Search } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

interface CommandMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const [search, setSearch] = useState('')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0">
        <Command
          className="rounded-lg"
          filter={(value: string, search: string) => {
            if (value.toLowerCase().includes(search.toLowerCase())) return 1
            return 0
          }}
        >
          <div className="flex items-center border-b border-border px-3">
            <Search className="mr-2 h-4 w-4 text-muted-foreground" />
            <Command.Input
              placeholder="Search players, teams, tournaments..."
              className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              value={search}
              onValueChange={setSearch}
            />
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Group heading="Players">
              <Command.Item className="rounded-md px-3 py-2 text-sm hover:bg-accent">
                Ahmed Khan • Valorant • Immortal 3
              </Command.Item>
              <Command.Item className="rounded-md px-3 py-2 text-sm hover:bg-accent">
                Zain Malik • CS2 • Global Elite
              </Command.Item>
            </Command.Group>
            <Command.Group heading="Teams">
              <Command.Item className="rounded-md px-3 py-2 text-sm hover:bg-accent">
                Portal Esports
              </Command.Item>
              <Command.Item className="rounded-md px-3 py-2 text-sm hover:bg-accent">
                Vanguard PK
              </Command.Item>
            </Command.Group>
            <Command.Group heading="Tournaments">
              <Command.Item className="rounded-md px-3 py-2 text-sm hover:bg-accent">
                Red Bull Campus Clutch
              </Command.Item>
              <Command.Item className="rounded-md px-3 py-2 text-sm hover:bg-accent">
                Dew Gamers Arena
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  )
}