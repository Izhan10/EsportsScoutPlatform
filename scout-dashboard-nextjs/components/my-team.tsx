'use client'

import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Users, UserPlus, Shield, Calendar, ChevronRight, ExternalLink, Sparkles } from 'lucide-react'
import { teamsApi, recruitmentApi } from '@/lib/api/client'
import { useSocket } from '@/lib/socket/use-socket'
import { useEffect } from 'react'

type Team = {
  id: number
  name: string
  game: string
  created_by: number
  created_at: string
  active_members?: TeamMember[]
  member_count?: number
}

type TeamMember = {
  id: number
  team_id: number
  player_id: number
  role: string
  status: string
  username: string
  avatar: string
  joined_at: string
}

type TeamActivity = {
  id: number
  team_id: number
  activity_type: string
  actor_name: string
  target_name: string
  created_at: string
  metadata: Record<string, unknown>
}

export function MyTeam() {
  const queryClient = useQueryClient()
  const { on } = useSocket()
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null)
  const [showNewMemberNotif, setShowNewMemberNotif] = useState(false)

  const { data: teams, isLoading } = useQuery({
    queryKey: ['my-teams'],
    queryFn: () => teamsApi.getMyTeams(),
    refetchInterval: 15000,
  })

  const { data: pendingRequests } = useQuery({
    queryKey: ['scout-pending-requests'],
    queryFn: () => recruitmentApi.getScoutPendingRequests(),
    refetchInterval: 15000,
    enabled: !!teams && teams.length > 0,
  })

  const { data: teamRoster } = useQuery({
    queryKey: ['team-roster-detail', expandedTeam],
    queryFn: () => (expandedTeam ? teamsApi.getTeamRoster(expandedTeam) : Promise.resolve([])),
    enabled: !!expandedTeam,
  })

  const { data: teamActivity } = useQuery({
    queryKey: ['team-activity', expandedTeam],
    queryFn: () => (expandedTeam ? teamsApi.getTeamActivity(expandedTeam) : Promise.resolve([])),
    enabled: !!expandedTeam,
    refetchInterval: 10000,
  })

  // Socket invalidation
  useEffect(() => {
    const unsub1 = on('rosterUpdate', (data: any) => {
      if (data?.action === 'accepted') {
        setShowNewMemberNotif(true)
      }
      queryClient.invalidateQueries({ queryKey: ['my-teams'] })
      queryClient.invalidateQueries({ queryKey: ['scout-pending-requests'] })
      if (expandedTeam) {
        queryClient.invalidateQueries({ queryKey: ['team-roster-detail', expandedTeam] })
        queryClient.invalidateQueries({ queryKey: ['team-activity', expandedTeam] })
      }
    })
    const unsub2 = on('statsUpdate', (data: any) => {
      if (data?.type === 'member_added') {
        setShowNewMemberNotif(true)
      }
      queryClient.invalidateQueries({ queryKey: ['my-teams'] })
    })
    return () => {
      unsub1()
      unsub2()
    }
  }, [on, queryClient, expandedTeam])

  const captain = teamRoster?.find((m) => m.role === 'captain')
  const manager = teamRoster?.find((m) => m.role === 'manager')
  const players = teamRoster?.filter((m) => m.role !== 'captain' && m.role !== 'manager') || []

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-8 w-full bg-muted rounded" />
        </div>
      </div>
    )
  }

  if (!teams || teams.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">My Team</h3>
        </div>
        <p className="text-xs text-muted-foreground">You haven&apos;t created a team yet.</p>
      </div>
    )
  }

  const activeTeam = teams[0]
  const isExpanded = expandedTeam === activeTeam.id

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Team Header */}
      <button
        onClick={() => setExpandedTeam(isExpanded ? null : activeTeam.id)}
        className="w-full p-5 flex items-center justify-between hover:bg-[#0A1628] transition-all text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple flex items-center justify-center">
            <Users className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{activeTeam.name}</h3>
            <p className="text-[10px] text-muted-foreground">
              {activeTeam.game || 'Team'} · {activeTeam.member_count ?? '?'} members
            </p>
          </div>
        </div>
        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
          {/* New Member Notification */}
          {showNewMemberNotif && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-xs font-medium text-primary flex-1">New player joined your team!</p>
              <button
                onClick={() => setShowNewMemberNotif(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Pending Requests Alert */}
          {pendingRequests && pendingRequests.length > 0 && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-xs font-medium text-primary">
                {pendingRequests.length} pending recruitment request{pendingRequests.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          {/* Roster */}
          <div>
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Roster</h4>
            <div className="space-y-1.5">
              {captain && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#0D1B2A]">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-[10px] font-bold text-white">
                      {captain.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs text-foreground">{captain.username}</span>
                  </div>
                  <span className="text-[9px] font-bold text-yellow-500 uppercase">Captain</span>
                </div>
              )}
              {manager && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#0D1B2A]">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-[10px] font-bold text-white">
                      {manager.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs text-foreground">{manager.username}</span>
                  </div>
                  <span className="text-[9px] font-bold text-blue-500 uppercase">Manager</span>
                </div>
              )}
              {players.map((player) => {
                const now = Date.now();
                const joinedTime = player.joined_at ? new Date(player.joined_at).getTime() : 0;
                const isRecent = !!player.joined_at && (now - joinedTime) < 60000;
                return (
                <div key={player.id} className={`flex items-center justify-between p-2 rounded-lg ${isRecent ? 'bg-primary/5 border border-primary/20' : 'bg-[#0D1B2A]'}`}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple to-primary flex items-center justify-center text-[10px] font-bold text-white relative">
                      {player.username.charAt(0).toUpperCase()}
                      {isRecent && (
                        <span className="absolute -top-1.5 -right-1.5 bg-primary text-[7px] font-bold text-primary-foreground px-1 rounded leading-none">NEW</span>
                      )}
                    </div>
                    <span className="text-xs text-foreground">{player.username}</span>
                  </div>
                  {player.role === 'substitute' && (
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Sub</span>
                  )}
                </div>
              )})}
            </div>
          </div>

          {/* Recent Activity */}
          {teamActivity && teamActivity.length > 0 && (
            <div>
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Recent Activity</h4>
              <div className="space-y-1.5">
                {teamActivity.slice(0, 5).map((activity) => (
                  <div key={activity.id} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    {activity.activity_type === 'member_joined' && (
                      <>
                        <span className="text-primary">{activity.actor_name}</span>
                        <span>joined the team</span>
                      </>
                    )}
                    {activity.activity_type === 'member_left' && (
                      <>
                        <span className="text-red-400">{activity.actor_name}</span>
                        <span>left the team</span>
                      </>
                    )}
                    {activity.activity_type === 'recruitment_accepted' && (
                      <>
                        <span className="text-primary">{activity.target_name}</span>
                        <span>accepted recruitment</span>
                      </>
                    )}
                    {activity.activity_type === 'member_removed' && (
                      <>
                        <span className="text-red-400">{activity.target_name}</span>
                        <span>was removed</span>
                      </>
                    )}
                    {activity.activity_type === 'role_changed' && (
                      <>
                        <span className="text-foreground">{activity.target_name}</span>
                        <span>role changed to {activity.metadata?.new_role as string}</span>
                      </>
                    )}
                    <span className="text-[9px] text-muted-foreground/60">
                      {new Date(activity.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <a
              href="/search-players"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
            >
              <UserPlus className="h-3 w-3" />
              Recruit Player
            </a>
            <a
              href={`/team/${activeTeam.id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#0D1B2A] border border-[#1E293B] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
            >
              <ExternalLink className="h-3 w-3" />
              View Team
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
