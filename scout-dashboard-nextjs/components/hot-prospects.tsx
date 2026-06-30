'use client'

import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

interface Prospect {
  id: string
  username: string
  game: string
  rank: string
  region: string
  esv: number
  winRate: number
  growth: number
  avatar?: string
}

export function HotProspects() {
  const { data: prospects, isLoading } = useQuery({
    queryKey: ['hot-prospects'],
    queryFn: async () => {
      const { data } = await supabase
        .from('players')
        .select('id, username, game, rank, region, esv_score, win_rate, growth')
        .order('esv_score', { ascending: false })
        .limit(6)
      return data as Prospect[] | []
    },
  })

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <AnimatePresence>
      <motion.div
        className="grid gap-4 sm:grid-cols-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          layout
          className="sm:col-span-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src="/avatars/prospect-1.png" />
                <AvatarFallback>AK</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="font-semibold">Ahmed Khan</h3>
                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Valorant • Immortal 3</span>
                  <span>•</span>
                  <span>Islamabad</span>
                </div>
                <div className="mt-3 flex items-center gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground">ESV</span>
                    <p className="font-bold">95</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Win Rate</span>
                    <p className="font-bold">68%</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Growth</span>
                    <p className="font-bold text-success">+12%</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm">
                  View Profile
                </Button>
                <Button size="sm" className="bg-primary hover:bg-primary/90">
                  <Plus className="mr-2 h-4 w-4" />
                  Shortlist
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* More prospect cards... */}
        {prospects?.slice(0, 5).map((prospect, index) => (
          <motion.div
            key={prospect.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="p-4 transition-shadow hover:shadow-lg">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={prospect.avatar} />
                  <AvatarFallback>{prospect.username[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-medium">{prospect.username}</h3>
                  <p className="text-sm text-muted-foreground">
                    {prospect.game} • {prospect.rank}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-xs">
                    <span className="font-semibold">ESV {prospect.esv}</span>
                    <span className="text-success">+{prospect.growth}%</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </AnimatePresence>
  )
}