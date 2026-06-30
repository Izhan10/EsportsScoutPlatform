const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `API Error: ${res.status}`)
  }
  return res.json()
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
}

// ─── Team API ───────────────────────────────────────────────
export const teamsApi = {
  getMyTeam: (playerId: number) => api.get<any>(`/teams/my-team/player`),
  getTeamById: (teamId: number) => api.get<any>(`/teams/${teamId}`),
  getTeamRoster: (teamId: number) => api.get<any[]>(`/teams/${teamId}/roster`),
  getMyTeams: () => api.get<any[]>('/teams/mine'),
  getTeamActivity: (teamId: number) => api.get<any[]>(`/teams/${teamId}/activity`),
}

// ─── Recruitment API ────────────────────────────────────────
export const recruitmentApi = {
  getPendingPermissions: () => api.get<any[]>('/recruitment/permissions/pending-player'),
  getAllPermissions: () => api.get<any[]>('/recruitment/permissions/all-player'),
  getPendingOffers: () => api.get<any[]>('/recruitment/offers/pending-player'),
  getApprovedPermissions: () => api.get<any[]>('/recruitment/permissions/approved-scout'),
  getSentOffers: () => api.get<any[]>('/recruitment/offers/sent-scout'),
  getPendingRequests: () => api.get<any[]>('/teams/recruitment/pending'),
  getScoutPendingRequests: () => api.get<any[]>('/teams/recruitment/scout-pending'),
  getMyTeam: () => api.get<any>('/recruitment/my-team/player'),
}

// ─── Auth API ────────────────────────────────────────────────
export const authApi = {
  me: () => api.get<any>('/auth/me'),
}
