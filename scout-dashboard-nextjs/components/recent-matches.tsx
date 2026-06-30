'use client'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

interface Match {
  id: string
  player1: string
  player2: string
  game: string
  status: 'live' | 'completed' | 'upcoming'
  score?: string
  time: string
}

export function RecentMatches() {
  const { data: matches } = useQuery({
    queryKey: ['recent-matches'],
    queryFn: async () => {
      const { data } = await supabase
        .from('matches')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)
      return data as Match[] | []
    },
  })

  if (!matches?.length) {
    return (
      <Card>
        <div className="p-6">
          <h3 className="mb-4 font-semibold">Recent Matches</h3>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div className="p-6">
        <h3 className="mb-4 font-semibold">Recent Matches</h3>
        <div className="space-y-3">
          {matches.map((match) => (
            <div key={match.id} className="flex items-center justify-between text-sm">
              <span>{match.player1} vs {match.player2}</span>
              <span className="text-muted-foreground">
                {match.status === 'live' ? '🔴 Live' : match.score || match.time}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}