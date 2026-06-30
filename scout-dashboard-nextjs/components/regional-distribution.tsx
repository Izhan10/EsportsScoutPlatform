'use client'

import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

interface RegionData {
  region: string
  count: number
  percentage: number
}

const regions = [
  { name: 'Islamabad', value: 35, color: 'bg-primary' },
  { name: 'Karachi', value: 28, color: 'bg-success' },
  { name: 'Lahore', value: 22, color: 'bg-primary/70' },
  { name: 'Peshawar', value: 15, color: 'bg-success/70' },
]

export function RegionalDistribution() {
  const { data: regionData, isLoading } = useQuery({
    queryKey: ['regional-distribution'],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_regional_distribution')
      const result = data as RegionData[] | null
      return result ?? []
    },
  })

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {regions.map((region, index) => (
          <div key={region.name}>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">{region.name}</span>
              <span className="text-muted-foreground">{region.value}%</span>
            </div>
            <Progress value={region.value} className="h-2" />
          </div>
        ))}
      </div>
    </Card>
  )
}