'use client'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

interface Tournament {
  id: string
  name: string
  game: string
  prize: string
  date: string
}

export function UpcomingTournaments() {
  const { data: tournaments } = useQuery({
    queryKey: ['upcoming-tournaments'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tournaments')
        .select('*')
        .gt('date', new Date().toISOString())
        .order('date', { ascending: true })
        .limit(5)
      return data as Tournament[] | []
    },
  })

  if (!tournaments?.length) {
    return (
      <Card>
        <div className="p-6">
          <h3 className="mb-4 font-semibold">Upcoming Tournaments</h3>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
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
        <h3 className="mb-4 font-semibold">Upcoming Tournaments</h3>
        <div className="space-y-3">
          {tournaments.map((tournament) => (
            <div key={tournament.id} className="text-sm">
              <p className="font-medium">{tournament.name}</p>
              <p className="text-muted-foreground">
                {tournament.game} • {tournament.prize} • {tournament.date}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}