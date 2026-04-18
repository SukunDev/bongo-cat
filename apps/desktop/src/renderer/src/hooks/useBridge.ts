import { useEffect, useState, useCallback, useRef } from 'react'

interface ConnectionState {
  usb: { state: string; port?: string }
  ble: { state: string; device?: string }
}

interface PawState {
  left: boolean
  right: boolean
}

interface BridgeState {
  connection: ConnectionState
  paws: PawState
  sleeping: boolean
}

const SLEEP_TIMEOUT = 10000 // 10 seconds

const initialState: BridgeState = {
  connection: {
    usb: { state: 'disconnected' },
    ble: { state: 'standby' }
  },
  paws: { left: false, right: false },
  sleeping: false
}

export function useBridge(): BridgeState {
  const [state, setState] = useState<BridgeState>(initialState)
  const lastActivityRef = useRef<number>(Date.now())
  const sleepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const handleEvent = useCallback((event: Record<string, string>) => {
    if (event.type === 'status') {
      setState((prev) => {
        const conn = { ...prev.connection }
        if (event.connection === 'usb') {
          conn.usb = { state: event.state, port: event.port }
        } else if (event.connection === 'ble') {
          conn.ble = { state: event.state, device: event.device }
        }
        return { ...prev, connection: conn }
      })
    } else if (event.type === 'key') {
      lastActivityRef.current = Date.now()
      setState((prev) => {
        const paws = { ...prev.paws }
        if (event.side === 'left') paws.left = event.action === 'down'
        if (event.side === 'right') paws.right = event.action === 'down'
        return { ...prev, paws, sleeping: false }
      })
    }
  }, [])

  useEffect(() => {
    window.api.bridge.onEvent(handleEvent)

    // Sleep timer: check every second if we should enter sleep mode
    sleepTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current
      if (elapsed >= SLEEP_TIMEOUT) {
        setState((prev) => {
          if (!prev.sleeping && !prev.paws.left && !prev.paws.right) {
            return { ...prev, sleeping: true }
          }
          return prev
        })
      }
    }, 1000)

    return () => {
      if (sleepTimerRef.current) clearInterval(sleepTimerRef.current)
    }
  }, [handleEvent])

  return state
}
