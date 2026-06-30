'use client'

import { Layout } from '@/components/layout'
import { Star } from 'lucide-react'

export default function Shortlisted() {
  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Star className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Shortlisted</h1>
        </div>
        <p className="text-muted-foreground">Your shortlisted players will appear here.</p>
      </div>
    </Layout>
  )
}