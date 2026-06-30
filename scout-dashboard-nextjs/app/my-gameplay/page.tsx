'use client'

import { Layout } from '@/components/layout'
import { PlaySquare } from 'lucide-react'

export default function MyGameplay() {
  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <PlaySquare className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">My Gameplay</h1>
        </div>
        <p className="text-muted-foreground">Your uploaded gameplay clips will appear here.</p>
      </div>
    </Layout>
  )
}