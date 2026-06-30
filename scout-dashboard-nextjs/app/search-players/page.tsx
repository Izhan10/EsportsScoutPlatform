'use client'

import { Layout } from '@/components/layout'
import { Search } from 'lucide-react'

export default function SearchPlayers() {
  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Search className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Search Players</h1>
        </div>
        <p className="text-muted-foreground">Find and discover new talent here.</p>
      </div>
    </Layout>
  )
}