'use client'

import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

interface FeedEvent {
  id: string
  type: 'player_joined' | 'esv_changed' | 'highlight_uploaded' | 'application_received'
  player: string
  message: string
  time: string
  avatar?: string
}

const eventIcons = {
  player_joined: '👤',
  esv_changed: '📈',
  highlight_uploaded: '🎥',
  application_received: '📥',
}

export function LiveProspectFeed() {
  const { data: events } = useQuery({
    queryKey: ['live-feed'],
    queryFn: async () => {
      const { data } = await supabase
        .from('prospect_feed')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
      return data as FeedEvent[] | []
    },
  })

  if (!events?.length) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card className="max-h-[500px] overflow-y-auto">
      <AnimatePresence>
        <div className="divide-y divide-border">
          {events.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-start gap-4 p-4"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-lg">
                {eventIcons[event.type]}
              </div>
              <div className="flex-1">
                <p className="font-medium">{event.player}</p>
                <p className="text-sm text-muted-foreground">{event.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{event.time}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>
    </Card>
  )
}