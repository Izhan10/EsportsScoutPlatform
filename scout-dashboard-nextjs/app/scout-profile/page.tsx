'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Layout } from '@/components/layout'
import { User, Search, X, Loader2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react'
import { api } from '@/lib/api/client'

type SearchResult = {
  id: string
  name: string
  wiki: string
  real_name?: string
  country?: string
  game?: string
  role?: string
  image?: string
}

type ImportProfile = {
  real_name: string
  avatar: string
  bio: string
  country: string
  social_links: Record<string, string>
  organization: string
  coaching_specialty: string
  best_achievement: string
  years_experience: number
  teams_coached: string
  achievements: string
  liquipedia_id: string
  liquipedia_url: string
  liquipedia_data: unknown
  teams: { name: string; role: string; year: number | null }[]
  tournaments: { name: string; placement: string; date: string }[]
  accolades: { title: string; description: string; year: string }[]
}

export default function ScoutProfile() {
  const [modalOpen, setModalOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [importing, setImporting] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const performSearch = useCallback(async (name: string) => {
    const trimmed = name.trim()
    if (trimmed.length < 2) { setResults([]); return }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setSearching(true)
    setStatusMsg(null)
    try {
      const data = await api.post<{ results: SearchResult[] }>('/liquipedia/search-player', { name: trimmed, autocomplete: true })
      if (controller.signal.aborted) return
      setResults(data.results || [])
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setStatusMsg({ type: 'error', text: (err as Error).message || 'Search failed' })
    } finally {
      if (!controller.signal.aborted) setSearching(false)
    }
  }, [])

  const debouncedSearch = useCallback((name: string) => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => performSearch(name), 400)
  }, [performSearch])

  useEffect(() => {
    return () => clearTimeout(debounceRef.current)
  }, [])

  const handleImport = async (id: string, wiki: string) => {
    setImporting(id)
    setStatusMsg(null)
    try {
      const importData = await api.post<{ profile: ImportProfile }>('/liquipedia/import-player-as-scout', { liquipediaId: id, wiki })
      const p = importData.profile
      await api.post('/scouts/import', {
        real_name: p.real_name,
        avatar: p.avatar,
        bio: p.bio,
        country: p.country,
        social_links: p.social_links,
        organization: p.organization,
        coaching_specialty: p.coaching_specialty,
        best_achievement: p.best_achievement,
        years_experience: p.years_experience,
        teams_coached: p.teams_coached,
        achievements: p.achievements,
        experience: '',
        cv_url: '',
        liquipedia_id: p.liquipedia_id,
        liquipedia_url: p.liquipedia_url,
        liquipedia_data: p.liquipedia_data,
        teams: p.teams,
        tournaments: p.tournaments,
        accolades: p.accolades,
      })
      setStatusMsg({ type: 'success', text: 'Imported successfully! Refreshing...' })
      setTimeout(() => window.location.reload(), 1200)
    } catch (err) {
      setStatusMsg({ type: 'error', text: (err as Error).message || 'Import failed' })
    } finally {
      setImporting(null)
    }
  }

  const openModal = () => {
    setModalOpen(true)
    setQuery('')
    setResults([])
    setStatusMsg(null)
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <User className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Scout Profile</h1>
        </div>
        <p className="text-muted-foreground mb-4">Manage your scout profile here.</p>
        <button
          onClick={openModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <ExternalLink className="h-4 w-4" />
          Import from Liquipedia
        </button>

        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-sm">
            <div className="bg-[#0B1020] border border-white/10 rounded-xl w-full max-w-lg mx-4 shadow-2xl">
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h2 className="text-lg font-bold">Import From Liquipedia</h2>
                <button onClick={() => setModalOpen(false)} className="text-white/60 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-4">
                <p className="text-sm text-white/60 mb-3">Search for your past player profile on Liquipedia to import your career history.</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); debouncedSearch(e.target.value) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') performSearch(query) }}
                    placeholder="Enter your player name..."
                    className="flex-1 px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                  <button
                    onClick={() => performSearch(query)}
                    disabled={searching || query.trim().length < 2}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-md bg-gradient-to-r from-purple-600 to-cyan-500 text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Search
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  {searching && results.length === 0 && (
                    <p className="text-sm text-white/40 text-center py-4">Searching...</p>
                  )}
                  {!searching && results.length === 0 && query.length >= 2 && (
                    <p className="text-sm text-white/40 text-center py-4">No results found. Try a different name.</p>
                  )}
                  {results.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                      <img
                        src={r.image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${r.name}`}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${r.name}` }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{r.real_name || r.name}</p>
                        <p className="text-xs text-white/50 truncate">{[r.country, r.game, r.role].filter(Boolean).join(' · ')}</p>
                      </div>
                      <button
                        onClick={() => handleImport(r.id, r.wiki || 'valorant')}
                        disabled={importing === r.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-gradient-to-r from-purple-600 to-cyan-500 text-white text-xs font-semibold disabled:opacity-50 shrink-0"
                      >
                        {importing === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                        {importing === r.id ? 'Importing...' : 'Import'}
                      </button>
                    </div>
                  ))}
                </div>

                {statusMsg && (
                  <div className={`mt-3 flex items-center gap-2 text-sm p-3 rounded-lg ${statusMsg.type === 'success' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                    {statusMsg.type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                    {statusMsg.text}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}