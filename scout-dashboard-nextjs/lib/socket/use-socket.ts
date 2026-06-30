'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { io, Socket } from 'socket.io-client'

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

type Callback = (data: unknown) => void

export function useSocket() {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const pendingRef = useRef<Map<string, Set<Callback>>>(new Map())

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    })

    socket.on('connect', () => {
      setConnected(true)
      // Register all pending listeners
      pendingRef.current.forEach((callbacks, event) => {
        callbacks.forEach((cb) => socket.on(event, cb))
      })
    })

    socket.on('disconnect', () => setConnected(false))
    socket.on('connect_error', (err) => console.error('[Socket] Error:', err.message))

    socketRef.current = socket

    return () => {
      socket.disconnect()
      socketRef.current = null
      setConnected(false)
    }
  }, [])

  const on = useCallback((event: string, callback: Callback): (() => void) => {
    const cb = callback as Callback

    if (socketRef.current?.connected) {
      socketRef.current.on(event, cb)
    }

    if (!pendingRef.current.has(event)) {
      pendingRef.current.set(event, new Set())
    }
    pendingRef.current.get(event)!.add(cb)

    return () => {
      socketRef.current?.off(event, cb)
      pendingRef.current.get(event)?.delete(cb)
      if (pendingRef.current.get(event)?.size === 0) {
        pendingRef.current.delete(event)
      }
    }
  }, [])

  return { connected, on }
}
