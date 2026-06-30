'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

interface ShortlistPlayer {
  id: string
  username: string
  game: string
  rank: string
  esv: number
  notes?: string
}

export function MyShortlist() {
  const { data: players } = useQuery({
    queryKey: ['my-shortlist'],
    queryFn: async () => {
      const { data } = await supabase
        .from('shortlist')
        .select('player:players!inner(id, username, game, rank, esv_score)')
        .limit(10)
      return data as ShortlistPlayer[] | []
    },
  })

  if (!players?.length) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div className="divide-y divide-border">
        {players.map((player, index) => (
          <motion.div
            key={player.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-center gap-3 p-4"
          >
            <Avatar className="h-10 w-10">
              <AvatarImage src={`/avatars/${player.username}.png`} />
              <AvatarFallback>{player.username[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-medium">{player.username}</p>
              <p className="text-sm text-muted-foreground">
                {player.game} • {player.rank} • ESV {player.esv}
              </p>
            </div>
            <Button variant="ghost" size="sm">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </motion.div>
        ))}
      </div>
    </Card>
  )
}