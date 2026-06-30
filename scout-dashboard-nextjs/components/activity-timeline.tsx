'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

interface TimelineEvent {
  id: string
  type: 'profile_viewed' | 'stats_updated' | 'esv_changed' | 'application_submitted'
  player: string
  scout: string
  time: string
}

const eventColors = {
  profile_viewed: 'bg-primary',
  stats_updated: 'bg-success',
  esv_changed: 'bg-success',
  application_submitted: 'bg-primary/50',
}

const eventLabels = {
  profile_viewed: 'Viewed profile',
  stats_updated: 'Stats updated',
  esv_changed: 'ESV increased',
  application_submitted: 'Application sent',
}

export function ActivityTimeline() {
  const { data: events } = useQuery({
    queryKey: ['activity-timeline'],
    queryFn: async () => {
      const { data } = await supabase
        .from('activity_timeline')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)
      return data as TimelineEvent[] | []
    },
  })

  if (!events?.length) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-2 w-2 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {events.map((event, index) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex gap-3"
          >
            <div className={`h-2 w-2 rounded-full ${eventColors[event.type]} mt-2`} />
            <div>
              <p className="text-sm">
                <span className="font-medium">{event.scout}</span> {eventLabels[event.type]}{' '}
                <span className="font-medium">{event.player}</span>
              </p>
              <p className="text-xs text-muted-foreground">{event.time}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </Card>
  )
}