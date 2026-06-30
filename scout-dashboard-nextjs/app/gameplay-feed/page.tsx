'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Layout } from '@/components/layout'
import { Play, Heart, Star, Bookmark, Plus, Eye, Clock, ChevronDown, Wifi, Users, Radio, Volume2, VolumeX } from 'lucide-react'

const games = [
  { name: 'All Games', active: true },
  { name: 'Valorant', active: false },
  { name: 'PUBG Mobile', active: false },
  { name: 'Tekken', active: false },
]

const actions = [
  { icon: Heart, label: 'Like', count: '2.4k' },
  { icon: Star, label: 'Rate', count: '4.8' },
  { icon: Bookmark, label: 'Save', count: '843' },
  { icon: Plus, label: 'Shortlist', count: 'Add' },
]

const SLIDER_CLOSE_DELAY = 300

function VolumeControl({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const [volume, setVolume] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gameplay-feed-volume')
      return saved !== null ? parseFloat(saved) : 1
    }
    return 1
  })
  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gameplay-feed-muted') === 'true'
    }
    return false
  })
  const [showSlider, setShowSlider] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const effectiveVolume = isMuted ? 0 : volume

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume
      videoRef.current.muted = isMuted
    }
  }, [volume, isMuted, videoRef])

  const persistVolume = useCallback((v: number, muted: boolean) => {
    try {
      localStorage.setItem('gameplay-feed-volume', String(v))
      localStorage.setItem('gameplay-feed-muted', String(muted))
    } catch { /* localStorage unavailable */ }
  }, [])

  const handleToggleMute = useCallback(() => {
    const next = !isMuted
    setIsMuted(next)
    persistVolume(volume, next)
  }, [isMuted, volume, persistVolume])

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setVolume(val)
    if (val === 0) {
      setIsMuted(true)
    } else if (isMuted) {
      setIsMuted(false)
    }
    persistVolume(val, val === 0)
  }, [isMuted, persistVolume])

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const scheduleClose = useCallback(() => {
    cancelClose()
    closeTimerRef.current = setTimeout(() => {
      setShowSlider(false)
    }, SLIDER_CLOSE_DELAY)
  }, [cancelClose])

  const handleContainerEnter = useCallback(() => {
    cancelClose()
    setShowSlider(true)
  }, [cancelClose])

  const handleContainerLeave = useCallback(() => {
    scheduleClose()
  }, [scheduleClose])

  // Long press support for mobile
  const handlePointerDown = useCallback(() => {
    longPressTimerRef.current = setTimeout(() => {
      setShowSlider(true)
    }, 500)
  }, [])

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        clearTimeout(closeTimerRef.current)
      }
      if (longPressTimerRef.current !== null) {
        clearTimeout(longPressTimerRef.current)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative flex items-center"
      onMouseEnter={handleContainerEnter}
      onMouseLeave={handleContainerLeave}
    >
      <button
        onClick={handleToggleMute}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-all border border-white/10 z-10"
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {effectiveVolume === 0 ? (
          <VolumeX className="h-5 w-5 text-red-400" />
        ) : (
          <Volume2 className="h-5 w-5 text-white" />
        )}
      </button>

      {showSlider && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 py-3 px-2 rounded-xl bg-black/80 backdrop-blur-md border border-white/10 shadow-xl"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="flex flex-col items-center gap-1">
            {/* Volume percentage indicator */}
            <span className="text-[10px] font-medium text-white/80">
              {Math.round(effectiveVolume * 100)}%
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={effectiveVolume}
              onChange={handleVolumeChange}
              className="h-24 w-1.5 bg-white/20 rounded-full appearance-none cursor-pointer
                [writing-mode:vertical-lr] [direction:rtl]
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-lg
                [&::-webkit-slider-thumb]:shadow-primary/30
                [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5
                [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0"
              style={{
                background: `linear-gradient(to top, #9EFF00 ${effectiveVolume * 100}%, rgba(255,255,255,0.2) ${effectiveVolume * 100}%)`,
              }}
              aria-label="Volume"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default function GameplayFeed() {
  const [activeGame, setActiveGame] = useState('All Games')
  const videoRef = useRef<HTMLVideoElement | null>(null)

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Game filter chips */}
        <div className="flex flex-wrap items-center gap-2">
          {games.map((game) => (
            <button
              key={game.name}
              onClick={() => setActiveGame(game.name)}
              className={`px-5 py-2 rounded-2xl text-sm font-medium transition-all duration-200 ${
                activeGame === game.name
                  ? 'bg-primary text-primary-foreground neon-glow'
                  : 'bg-[#0D1B2A] text-muted-foreground border border-[#1E293B] hover:border-primary/30 hover:text-foreground'
              }`}
            >
              {game.name}
            </button>
          ))}
        </div>

        {/* Sort row */}
        <div className="flex items-center justify-between">
          <button className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#0D1B2A] border border-[#1E293B] text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all">
            <span>Recent</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs text-muted-foreground">Showing 12 of 47 clips</span>
        </div>

        {/* Video player section */}
        <div className="flex gap-6">
          {/* Main video area - 75% */}
          <div className="flex-1 min-w-0">
            <div className="relative rounded-3xl overflow-hidden bg-[#0A1628] border border-[#1E293B] group">
              {/* Video placeholder with actual video element */}
              <div className="aspect-video bg-gradient-to-br from-[#0D1B2A] via-[#1A2A44] to-[#0D1B2A] flex items-center justify-center relative">
                {/* Hidden video element for audio control */}
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none"
                  preload="metadata"
                  playsInline
                />

                {/* Grid pattern overlay */}
                <div className="absolute inset-0 opacity-5" style={{
                  backgroundImage: `radial-gradient(circle at 1px 1px, rgba(158, 255, 0, 0.3) 1px, transparent 0)`,
                  backgroundSize: '40px 40px'
                }} />

                {/* Center play button with glassmorphism */}
                <div className="relative z-10 w-20 h-20 rounded-full glass flex items-center justify-center cursor-pointer transition-all duration-300 hover:scale-110 neon-glow group-hover:scale-110">
                  <Play className="h-8 w-8 text-primary fill-primary ml-1" />
                </div>

                {/* Overlay info - bottom left */}
                <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                  <div className="flex items-start justify-between">
                    {/* Player info */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple to-primary flex items-center justify-center text-sm font-bold text-white">
                        AK
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">Ahmed Khan</span>
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-primary/20 text-primary border border-primary/30">
                            Immortal 3
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-white/60">
                          <span>Valorant</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            2 hours ago
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            12.4k views
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top-right controls */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  {/* Duration badge */}
                  <div className="px-3 py-1 rounded-xl bg-black/60 backdrop-blur-sm text-xs font-medium text-white border border-white/10">
                    12:34
                  </div>
                  {/* Volume control */}
                  <VolumeControl videoRef={videoRef} />
                </div>
              </div>

              {/* Video metadata bar */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Eye className="h-4 w-4" />
                    12.4k views
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Heart className="h-4 w-4" />
                    2.4k
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    2h ago
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">#valorant • #clutch • #ranked</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action rail - vertical */}
          <div className="flex flex-col items-center gap-4 pt-4">
            {actions.map((action) => (
              <button
                key={action.label}
                className="group flex flex-col items-center gap-1.5 transition-all duration-200"
                title={action.label}
              >
                <div className="w-12 h-12 rounded-2xl bg-[#0D1B2A] border border-[#1E293B] flex items-center justify-center text-muted-foreground group-hover:border-primary/30 group-hover:text-primary transition-all duration-200">
                  <action.icon className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground group-hover:text-primary transition-colors">
                  {action.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Network status card - bottom right */}
        <div className="fixed bottom-6 right-6">
          <div className="glass rounded-2xl px-5 py-3 flex items-center gap-4 border border-glass-border shadow-2xl">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary neon-glow" />
              <span className="text-xs font-medium text-foreground/80">Live</span>
            </div>
            <div className="w-px h-4 bg-[#1E293B]" />
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">128 Online</span>
            </div>
            <div className="w-px h-4 bg-[#1E293B]" />
            <div className="flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Feed Active</span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
