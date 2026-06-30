'use client'

import { useEffect, useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Layout } from '@/components/layout'
import { User, Shield, Calendar, Users, ChevronRight, Check, X, Clock, PlaySquare, Bookmark, Trophy } from 'lucide-react'
import { api, recruitmentApi, teamsApi } from '@/lib/api/client'
import { useSocket } from '@/lib/socket/use-socket'

type UserData = {
  id: number
  username: string
  avatar: string
  role: string
  current_team: string | null
}

type TeamMembership = {
  id: number
  team_id: number
  player_id: number
  role: string
  status: string
  joined_at: string
  team_name: string
  team_game: string
  creator: { id: number; username: string; avatar: string } | null
}

type PendingPermission = {
  id: number
  scout_id: number
  scout_username: string
  scout_avatar: string
  status: string
  created_at: string
}

type TeamRosterMember = {
  id: number
  team_id: number
  player_id: number
  role: string
  username: string
  avatar: string
}

function TeamInfoCard({ membership }: { membership: TeamMembership }) {
  const { data: roster } = useQuery({
    queryKey: ['team-roster', membership.team_id],
    queryFn: () => teamsApi.getTeamRoster(membership.team_id),
    refetchInterval: 15000,
  })

  const captain = roster?.find((m) => m.role === 'captain')
  const manager = roster?.find((m) => m.role === 'manager')
  const players = roster?.filter((m) => m.role === 'player' || m.role === 'substitute') || []
  const joinedDate = membership.joined_at
    ? new Date(membership.joined_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Unknown'

  return (
    <div className="space-y-6">
      {/* Current Team Card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-purple flex items-center justify-center">
              <Users className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">{membership.team_name}</h2>
              <p className="text-xs text-muted-foreground">{membership.team_game || 'Team'}</p>
            </div>
          </div>
          <span className="px-3 py-1 text-xs font-bold rounded-full bg-primary/20 text-primary border border-primary/30">
            Active
          </span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Scout:</span>
            <span className="font-medium text-foreground">{membership.creator?.username || 'Unknown'}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Role:</span>
            <span className="font-medium text-foreground capitalize">{membership.role}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Joined:</span>
            <span className="font-medium text-foreground">{joinedDate}</span>
          </div>
        </div>
      </div>

      {/* Team Roster */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Team Members</h3>
        <div className="space-y-3">
          {captain && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#0D1B2A] border border-[#1E293B]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-xs font-bold text-white">
                  {captain.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="text-sm font-medium text-foreground">{captain.username}</span>
                  <span className="ml-2 text-[10px] font-bold text-yellow-500 uppercase">Captain</span>
                </div>
              </div>
            </div>
          )}
          {manager && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#0D1B2A] border border-[#1E293B]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-xs font-bold text-white">
                  {manager.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="text-sm font-medium text-foreground">{manager.username}</span>
                  <span className="ml-2 text-[10px] font-bold text-blue-500 uppercase">Manager</span>
                </div>
              </div>
            </div>
          )}
          {players.map((player) => (
            <div key={player.id} className="flex items-center justify-between p-3 rounded-lg bg-[#0D1B2A] border border-[#1E293B]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple to-primary flex items-center justify-center text-xs font-bold text-white">
                  {player.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="text-sm font-medium text-foreground">{player.username}</span>
                  {player.role === 'substitute' && (
                    <span className="ml-2 text-[10px] font-bold text-muted-foreground uppercase">Sub</span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {(!captain && !manager && players.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-4">No members loaded</p>
          )}
        </div>
      </div>
    </div>
  )
}

function PendingPermissionsCard({
  permissions,
  onRefresh,
}: {
  permissions: PendingPermission[]
  onRefresh: () => void
}) {
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const handleRespond = async (permissionId: number, action: 'approve' | 'decline') => {
    setActionLoading(permissionId)
    try {
      await api.put(`/recruitment/permissions/${permissionId}/${action}`)
      onRefresh()
    } catch (err) {
      console.error(`Failed to ${action} permission:`, err)
    } finally {
      setActionLoading(null)
    }
  }

  if (permissions.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
        Pending Recruitment Permissions
      </h3>
      <div className="space-y-3">
        {permissions.map((perm) => (
          <div key={perm.id} className="flex items-center justify-between p-3 rounded-lg bg-[#0D1B2A] border border-[#1E293B]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple to-primary flex items-center justify-center text-xs font-bold text-white">
                {perm.scout_username?.charAt(0).toUpperCase() || 'S'}
              </div>
              <div>
                <span className="text-sm font-medium text-foreground">{perm.scout_username} wants to recruit you</span>
                <p className="text-xs text-muted-foreground">
                  {new Date(perm.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRespond(perm.id, 'approve')}
                disabled={actionLoading === perm.id}
                className="p-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-all disabled:opacity-50"
                title="Approve"
              >
                {actionLoading === perm.id ? (
                  <Clock className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => handleRespond(perm.id, 'decline')}
                disabled={actionLoading === perm.id}
                className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-50"
                title="Decline"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PendingOffersCard({ onOfferAccepted }: { onOfferAccepted?: () => void }) {
  const { data: offers, refetch } = useQuery({
    queryKey: ['pending-offers'],
    queryFn: () => recruitmentApi.getPendingOffers(),
    refetchInterval: 15000,
  })

  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [acceptedOffer, setAcceptedOffer] = useState<{ id: number; team_name: string; role: string } | null>(null)

  const handleRespond = async (offerId: number, action: 'accept' | 'decline') => {
    setActionLoading(offerId)
    try {
      const result = await api.put<any>(`/recruitment/offers/${offerId}/${action}`)
      if (action === 'accept') {
        setAcceptedOffer({
          id: offerId,
          team_name: result?.team_name || 'the team',
          role: result?.membership?.role || 'Player',
        })
        setTimeout(() => {
          refetch()
          if (onOfferAccepted) onOfferAccepted()
        }, 500)
      } else {
        refetch()
      }
    } catch (err) {
      console.error(`Failed to ${action} offer:`, err)
    } finally {
      setActionLoading(null)
    }
  }

  if (acceptedOffer) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Check className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-primary">You joined {acceptedOffer.team_name}!</h3>
            <p className="text-xs text-muted-foreground">Role: {acceptedOffer.role}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Your team dashboard will update shortly.</p>
      </div>
    )
  }

  if (!offers || offers.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
        Pending Team Offers
      </h3>
      <div className="space-y-3">
        {offers.map((offer: any) => (
          <div key={offer.id} className="p-4 rounded-lg bg-[#0D1B2A] border border-[#1E293B]">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-sm font-medium text-foreground">{offer.team_name}</span>
                <span className="ml-2 text-xs text-muted-foreground">as {offer.role}</span>
              </div>
            </div>
            {offer.notes && (
              <p className="text-xs text-muted-foreground mb-3">{offer.notes}</p>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRespond(offer.id, 'accept')}
                disabled={actionLoading === offer.id}
                className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {actionLoading === offer.id ? 'Processing...' : 'Accept'}
              </button>
              <button
                onClick={() => handleRespond(offer.id, 'decline')}
                disabled={actionLoading === offer.id}
                className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-50"
              >
                {actionLoading === offer.id ? 'Processing...' : 'Decline'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PlayerDashboard() {
  const queryClient = useQueryClient()
  const { on } = useSocket()

  const { data: userData } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => api.get<any>('/auth/me'),
    refetchInterval: 30000,
  })

  const { data: membership, refetch: refetchMembership } = useQuery({
    queryKey: ['player-team'],
    queryFn: () => recruitmentApi.getMyTeam(),
    enabled: !!userData,
    refetchInterval: 15000,
  })

  const { data: pendingPermissions, refetch: refetchPermissions } = useQuery({
    queryKey: ['pending-permissions'],
    queryFn: () => recruitmentApi.getPendingPermissions(),
    enabled: !!userData && (!userData.current_team && !membership),
    refetchInterval: 15000,
  })

  // Socket event listeners for real-time cache invalidation
  useEffect(() => {
    const unsub1 = on('rosterUpdate', () => {
      queryClient.invalidateQueries({ queryKey: ['player-team'] })
      queryClient.invalidateQueries({ queryKey: ['team-roster'] })
    })
    const unsub2 = on('statsUpdate', (data: any) => {
      if (data?.type === 'team_changed') {
        queryClient.invalidateQueries({ queryKey: ['player-team'] })
        queryClient.invalidateQueries({ queryKey: ['current-user'] })
        queryClient.invalidateQueries({ queryKey: ['pending-permissions'] })
        queryClient.invalidateQueries({ queryKey: ['pending-offers'] })
      }
    })
    const unsub3 = on('recruitmentRequest', () => {
      queryClient.invalidateQueries({ queryKey: ['pending-permissions'] })
    })
    const unsub4 = on('offerResponse', () => {
      queryClient.invalidateQueries({ queryKey: ['player-team'] })
      queryClient.invalidateQueries({ queryKey: ['current-user'] })
      queryClient.invalidateQueries({ queryKey: ['pending-offers'] })
    })
    return () => {
      unsub1()
      unsub2()
      unsub3()
      unsub4()
    }
  }, [on, queryClient])

  const handleOfferAccepted = useCallback(() => {
    refetchMembership()
    queryClient.invalidateQueries({ queryKey: ['current-user'] })
    queryClient.invalidateQueries({ queryKey: ['pending-permissions'] })
    queryClient.invalidateQueries({ queryKey: ['pending-offers'] })
  }, [refetchMembership, queryClient])

  const isOnTeam = !!(userData?.current_team || membership)

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Player Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            {isOnTeam ? 'Manage your team membership and gameplay' : 'Review recruitment requests and manage your profile'}
          </p>
        </div>

        {isOnTeam && membership ? (
          <div className="grid gap-8 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <TeamInfoCard membership={membership} />
            </div>
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-xl border border-border bg-card p-6">
                <PlaySquare className="h-8 w-8 text-primary mb-4" />
                <h3 className="font-semibold mb-2">My Gameplay</h3>
                <p className="text-sm text-muted-foreground mb-3">View and manage your uploaded gameplay clips</p>
                <a href="/my-gameplay" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                  Go to Gameplay <ChevronRight className="h-3 w-3" />
                </a>
              </div>
              <div className="rounded-xl border border-border bg-card p-6">
                <Bookmark className="h-8 w-8 text-primary mb-4" />
                <h3 className="font-semibold mb-2">Saved Clips</h3>
                <p className="text-sm text-muted-foreground mb-3">Access your saved gameplay clips</p>
                <a href="/saved-videos" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                  View Saved <ChevronRight className="h-3 w-3" />
                </a>
              </div>
              <div className="rounded-xl border border-border bg-card p-6">
                <Trophy className="h-8 w-8 text-primary mb-4" />
                <h3 className="font-semibold mb-2">Find Tournaments</h3>
                <p className="text-sm text-muted-foreground mb-3">Browse and register for upcoming tournaments</p>
                <a href="/tournaments" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                  Browse Tournaments <ChevronRight className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-5">
            <div className="lg:col-span-3 space-y-6">
              <PendingPermissionsCard
                permissions={pendingPermissions || []}
                onRefresh={() => {
                  refetchPermissions()
                  refetchMembership()
                }}
              />
              <PendingOffersCard onOfferAccepted={handleOfferAccepted} />
              {(!pendingPermissions || pendingPermissions.length === 0) && (
                <div className="rounded-xl border border-border bg-card p-8 text-center">
                  <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No Pending Requests</h3>
                  <p className="text-sm text-muted-foreground">
                    When a scout wants to recruit you, their request will appear here.
                  </p>
                </div>
              )}
            </div>
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-xl border border-border bg-card p-6">
                <PlaySquare className="h-8 w-8 text-primary mb-4" />
                <h3 className="font-semibold mb-2">My Gameplay</h3>
                <p className="text-sm text-muted-foreground">View and manage your uploaded gameplay clips</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-6">
                <Bookmark className="h-8 w-8 text-primary mb-4" />
                <h3 className="font-semibold mb-2">Saved Clips</h3>
                <p className="text-sm text-muted-foreground">Access your saved gameplay clips</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-6">
                <Trophy className="h-8 w-8 text-primary mb-4" />
                <h3 className="font-semibold mb-2">Find Tournaments</h3>
                <p className="text-sm text-muted-foreground">Browse and register for upcoming tournaments</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
