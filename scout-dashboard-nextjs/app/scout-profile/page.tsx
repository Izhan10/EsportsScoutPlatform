'use client'

import { Layout } from '@/components/layout'
import { User } from 'lucide-react'

export default function ScoutProfile() {
  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <User className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Scout Profile</h1>
        </div>
        <p className="text-muted-foreground">Manage your scout profile here.</p>
      </div>
    </Layout>
  )
}