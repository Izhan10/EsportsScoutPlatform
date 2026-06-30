'use client'

import { Layout } from '@/components/layout'
import { Trophy } from 'lucide-react'

export default function Tournaments() {
  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Trophy className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Tournaments</h1>
        </div>
        <p className="text-muted-foreground">Browse and manage tournaments here.</p>
      </div>
    </Layout>
  )
}