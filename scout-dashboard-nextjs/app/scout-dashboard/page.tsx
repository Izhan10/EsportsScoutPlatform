'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Flame, Star, Inbox, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CommandMenu } from '@/components/command-menu'
import { KpiCard } from '@/components/kpi-card'
import { LiveProspectFeed } from '@/components/live-prospect-feed'
import { HotProspects } from '@/components/hot-prospects'
import { MyShortlist } from '@/components/my-shortlist'
import { MyTeam } from '@/components/my-team'
import { ActivityTimeline } from '@/components/activity-timeline'
import { RegionalDistribution } from '@/components/regional-distribution'
import { RecentMatches } from '@/components/recent-matches'
import { UpcomingTournaments } from '@/components/upcoming-tournaments'
import { Layout } from '@/components/layout'
import { useSocket } from '@/lib/socket/use-socket'

const supabase = createClient()

export default function ScoutDashboard() {
  const [showCommandMenu, setShowCommandMenu] = useState(false)
  const queryClient = useQueryClient()
  const { on } = useSocket()

  // Socket event listeners for real-time cache invalidation
  useEffect(() => {
    const unsub1 = on('rosterUpdate', () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] })
      queryClient.invalidateQueries({ queryKey: ['my-teams'] })
      queryClient.invalidateQueries({ queryKey: ['scout-pending-requests'] })
    })
    const unsub2 = on('statsUpdate', () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    })
    const unsub3 = on('notification_created', () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    })
    const unsub4 = on('offerResponse', () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] })
      queryClient.invalidateQueries({ queryKey: ['my-teams'] })
      queryClient.invalidateQueries({ queryKey: ['scout-pending-requests'] })
    })
    return () => {
      unsub1()
      unsub2()
      unsub3()
      unsub4()
    }
  }, [on, queryClient])

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good Morning'
    if (hour < 18) return 'Good Afternoon'
    return 'Good Evening'
  }
  const greeting = getGreeting()

  const { data: kpiData } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_kpis')
      if (error) throw error
      return data
    },
    refetchInterval: 30000,
  })

  return (
    <Layout>
      <CommandMenu open={showCommandMenu} onOpenChange={setShowCommandMenu} />

      <div>
        {/* Greeting Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {greeting}, Scout
          </h1>
          <p className="text-sm text-muted-foreground">
            {kpiData?.newProspects || 7} new prospects &bull; {kpiData?.risingPlayers || 2} rising players &bull; Live updates active
          </p>
        </div>

        {/* KPI Cards */}
        <section className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={Flame}
            label="Trending Prospects"
            value={kpiData?.trendingProspects ?? 0}
            change={+12}
            changeLabel="vs last week"
          />
          <KpiCard
            icon={Star}
            label="Shortlisted Players"
            value={kpiData?.shortlistedPlayers ?? 0}
            change={+5}
            changeLabel="new this week"
          />
          <KpiCard
            icon={Inbox}
            label="New Applications"
            value={kpiData?.pendingApplications ?? 0}
            changeLabel="pending review"
          />
          <KpiCard
            icon={TrendingUp}
            label="Rising ESV"
            value={`${kpiData?.esvGrowth ?? 0}%`}
            change={+8.2}
            trend="up"
          />
        </section>

        {/* Main Grid */}
        <div className="grid gap-8 lg:grid-cols-10">
          {/* Left Section (70%) */}
          <div className="lg:col-span-7 space-y-8">
            {/* Live Prospect Feed */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Live Prospect Feed</h2>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="pulse-dot" />
                  Live
                </div>
              </div>
              <LiveProspectFeed />
            </section>

            {/* Hot Prospects */}
            <section>
              <h2 className="mb-4 text-lg font-semibold">Hot Prospects</h2>
              <HotProspects />
            </section>
          </div>

          {/* Right Section (30%) */}
          <div className="lg:col-span-3 space-y-6">
            {/* My Team Widget */}
            <MyTeam />

            {/* My Shortlist */}
            <section>
              <h2 className="mb-4 text-lg font-semibold">My Shortlist</h2>
              <MyShortlist />
            </section>

            {/* Activity Timeline */}
            <section>
              <h2 className="mb-4 text-lg font-semibold">Activity Timeline</h2>
              <ActivityTimeline />
            </section>

            {/* Regional Distribution */}
            <section>
              <h2 className="mb-4 text-lg font-semibold">Regional Distribution</h2>
              <RegionalDistribution />
            </section>
          </div>
        </div>

        {/* Bottom Section */}
        <section className="mt-8 grid gap-8 md:grid-cols-2">
          <RecentMatches />
          <UpcomingTournaments />
        </section>
      </div>
    </Layout>
  )
}
