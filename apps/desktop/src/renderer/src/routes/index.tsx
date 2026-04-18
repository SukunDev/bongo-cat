import React, { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useBridge } from '@renderer/hooks/useBridge'

export const Route = createFileRoute('/')({
  component: RouteComponent
})

function StatusDot({ active, pulse }: { active: boolean; pulse?: boolean }): React.JSX.Element {
  return (
    <span className="relative flex">
      {pulse && active && (
        <span className="absolute w-3 h-3 bg-tertiary border-[2px] border-black animate-ping opacity-50" />
      )}
      <span
        className={`w-3 h-3 border-[2px] border-black relative ${
          active ? 'bg-tertiary' : 'bg-surface-bright'
        }`}
      />
    </span>
  )
}

function Paw({
  side,
  active
}: {
  side: 'left' | 'right'
  active: boolean
}): React.JSX.Element {
  const rotation = side === 'left' ? '-rotate-[15deg]' : 'rotate-[20deg]'
  const position = side === 'left' ? '-left-10' : '-right-12'
  const bottom = side === 'left' ? 'bottom-0' : 'bottom-4'

  return (
    <div
      className={`absolute ${position} ${bottom} w-20 h-14 bg-white border-[3px] border-black z-20 flex flex-col items-center justify-center ${rotation} transition-all duration-75 ${
        active ? 'neobrutal-shadow translate-y-1' : 'opacity-70 -translate-y-2'
      }`}
    >
      <div className="flex gap-1 mb-1">
        <div className="w-2 h-2 bg-paw-pink rounded-full border border-black/20" />
        <div className="w-2 h-2 bg-paw-pink rounded-full border border-black/20" />
        <div className="w-2 h-2 bg-paw-pink rounded-full border border-black/20" />
      </div>
      <div className="w-5 h-4 bg-paw-pink rounded-full border border-black/20" />
      {active && (
        <div className="absolute -top-1 -right-1 text-tertiary text-lg font-bold">⚡</div>
      )}
    </div>
  )
}

function ZzzAnimation(): React.JSX.Element {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setFrame((f) => (f + 1) % 3), 600)
    return () => clearInterval(interval)
  }, [])

  const offsets = [
    { x: 85, y: 6, size: 'text-xs' },
    { x: 95, y: 2, size: 'text-sm' },
    { x: 107, y: -2, size: 'text-base' }
  ]

  return (
    <>
      {offsets.map((pos, i) => (
        <span
          key={i}
          className={`absolute ${pos.size} font-['Space_Grotesk'] font-bold text-secondary transition-all duration-500`}
          style={{
            left: `${pos.x}px`,
            top: `${pos.y + (frame === i ? -3 : 0)}px`,
            opacity: frame === i ? 1 : 0.4
          }}
        >
          z
        </span>
      ))}
    </>
  )
}

function BongoCat({
  leftActive,
  rightActive,
  sleeping
}: {
  leftActive: boolean
  rightActive: boolean
  sleeping: boolean
}): React.JSX.Element {
  return (
    <div className="relative w-72 h-48 bg-surface-high border-[3px] border-black neobrutal-shadow flex items-end justify-center overflow-visible">
      {/* Halftone background */}
      <div className="absolute inset-0 halftone-bg opacity-20 pointer-events-none" />

      {/* Zzz animation when sleeping */}
      {sleeping && <ZzzAnimation />}

      {/* Cat body */}
      <div className="relative mb-4 w-48 h-28 bg-white border-[3px] border-black z-10 flex flex-col items-center justify-end">
        {/* Ears */}
        <div className="absolute -top-6 left-6 w-8 h-8 bg-white border-t-[3px] border-l-[3px] border-black rotate-[15deg]" />
        <div className="absolute -top-6 right-6 w-8 h-8 bg-white border-t-[3px] border-r-[3px] border-black -rotate-[15deg]" />

        {/* Eyes — open or closed (sleeping) */}
        <div className="absolute top-10 flex gap-14">
          {sleeping ? (
            <>
              <div className="w-4 h-[3px] bg-black" />
              <div className="w-4 h-[3px] bg-black" />
            </>
          ) : (
            <>
              <div className="w-3.5 h-3.5 bg-black rounded-full" />
              <div className="w-3.5 h-3.5 bg-black rounded-full" />
            </>
          )}
        </div>

        {/* Mouth */}
        <div className="absolute top-14 flex items-center justify-center">
          <div className="w-3 h-2 border-b-[3px] border-l-[3px] border-black rounded-bl-sm rotate-[-45deg] -mr-[1px]" />
          <div className="w-3 h-2 border-b-[3px] border-r-[3px] border-black rounded-br-sm rotate-[45deg] -ml-[1px]" />
        </div>

        {/* Paws — sleeping: both down gently, else: interactive */}
        {sleeping ? (
          <>
            <div className="absolute -left-10 bottom-0 w-20 h-14 bg-white border-[3px] border-black z-20 flex flex-col items-center justify-center -rotate-[15deg] opacity-60 translate-y-1">
              <div className="flex gap-1 mb-1">
                <div className="w-2 h-2 bg-paw-pink rounded-full" />
                <div className="w-2 h-2 bg-paw-pink rounded-full" />
                <div className="w-2 h-2 bg-paw-pink rounded-full" />
              </div>
              <div className="w-5 h-4 bg-paw-pink rounded-full" />
            </div>
            <div className="absolute -right-12 bottom-4 w-20 h-14 bg-white border-[3px] border-black z-20 flex flex-col items-center justify-center rotate-[20deg] opacity-60 translate-y-1">
              <div className="flex gap-1 mb-1">
                <div className="w-2 h-2 bg-paw-pink rounded-full" />
                <div className="w-2 h-2 bg-paw-pink rounded-full" />
                <div className="w-2 h-2 bg-paw-pink rounded-full" />
              </div>
              <div className="w-5 h-4 bg-paw-pink rounded-full" />
            </div>
          </>
        ) : (
          <>
            <Paw side="left" active={leftActive} />
            <Paw side="right" active={rightActive} />
          </>
        )}
      </div>

      {/* Desk surface */}
      <div className="absolute bottom-0 w-full h-4 bg-primary border-t-[3px] border-black" />
    </div>
  )
}

function ActivityPulse({ active }: { active: boolean }): React.JSX.Element {
  const heights = active ? [3, 5, 2, 4, 6] : [1, 1, 1, 1, 1]
  return (
    <div className="flex items-end gap-0.5 h-6">
      {heights.map((h, i) => (
        <div
          key={i}
          className={`w-1 transition-all duration-100 ${active ? 'bg-tertiary' : 'bg-outline-variant'}`}
          style={{ height: `${h * 4}px` }}
        />
      ))}
    </div>
  )
}

function RouteComponent(): React.JSX.Element {
  const { connection, paws, sleeping } = useBridge()
  const isActive = paws.left || paws.right
  const isConnected = connection.usb.state === 'connected' || connection.ble.state === 'connected'

  return (
    <div className="flex flex-col h-screen bg-surface select-none">
      {/* Title bar */}
      <header
        className="flex justify-between items-center px-4 h-12 bg-surface border-b-[3px] border-black z-50"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-primary border-[2px] border-black flex items-center justify-center">
            <span className="material-symbols-outlined text-black text-sm">pets</span>
          </div>
          <span className="font-['Space_Grotesk'] font-bold tracking-tight text-white uppercase text-xl tracking-tighter">
            Bongo Cat
          </span>
        </div>
        <div
          className="flex gap-2 halftone-bg px-2 py-1 border-[2px] border-black/50"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            className="w-3 h-3 bg-secondary border-[1.5px] border-black hover:scale-110 transition-transform"
            onClick={() => window.api.window.minimize()}
          />
          <button
            className="w-3 h-3 bg-tertiary border-[1.5px] border-black hover:scale-110 transition-transform"
            onClick={() => window.api.window.maximize()}
          />
          <button
            className="w-3 h-3 bg-error border-[1.5px] border-black hover:scale-110 transition-transform"
            onClick={() => window.api.window.close()}
          />
        </div>
      </header>

      {/* Hero: Bongo Cat */}
      <section className="flex-1 relative flex flex-col items-center justify-center p-6 bg-surface-low">
        <BongoCat leftActive={paws.left} rightActive={paws.right} sleeping={sleeping} />

        {/* Status badge */}
        <div className="mt-4">
          <div
            className={`px-3 py-1 font-mono text-[10px] border-[2px] border-black font-bold uppercase tracking-widest ${
              sleeping
                ? 'bg-surface-high text-secondary'
                : isActive
                  ? 'bg-tertiary-container text-black animate-pulse'
                  : 'bg-surface-high text-on-surface-variant'
            }`}
          >
            {sleeping ? '💤 Sleeping...' : isActive ? 'Typing...' : 'Idle'}
          </div>
        </div>
      </section>

      {/* Connection status bar */}
      <nav className="bg-surface border-t-[3px] border-black py-3 px-6 flex justify-center items-center gap-8">
        {connection.usb.state === 'connected' ? (
          <div className="flex items-center gap-2 bg-purple-600 px-3 py-1 border-[2px] border-black neobrutal-shadow-sm">
            <StatusDot active pulse />
            <span className="font-mono text-xs uppercase font-bold text-black tracking-widest">
              USB ({connection.usb.port})
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 opacity-40">
            <StatusDot active={false} />
            <span className="font-mono text-xs uppercase tracking-widest text-white">USB</span>
          </div>
        )}

        {connection.ble.state === 'connected' ? (
          <div className="flex items-center gap-2 bg-purple-600 px-3 py-1 border-[2px] border-black neobrutal-shadow-sm">
            <StatusDot active pulse />
            <span className="font-mono text-xs uppercase font-bold text-black tracking-widest">
              BLE {connection.ble.device && `(${connection.ble.device})`}
            </span>
          </div>
        ) : (
          <div className={`flex items-center gap-2 ${connection.ble.state !== 'connected' ? 'opacity-40' : ''}`}>
            <StatusDot active={false} />
            <span className="font-mono text-xs uppercase tracking-widest text-white">BLE</span>
          </div>
        )}
      </nav>

      {/* Footer */}
      <footer className="bg-surface-high border-t-[3px] border-black flex justify-between items-center px-6 py-2 h-10">
        <div className="flex items-center gap-3">
          <span className={`text-sm ${isActive ? 'text-tertiary' : 'text-outline-variant'}`}>♥</span>
          <ActivityPulse active={isActive} />
        </div>
        <span className={`font-mono text-[10px] uppercase ${isConnected ? 'text-tertiary' : 'text-on-surface-variant'}`}>
          {isConnected ? 'Connected' : 'No Device'}
        </span>
      </footer>

      {/* Decorative corners */}
      <div className="absolute top-14 right-4 w-24 h-24 pointer-events-none opacity-20 border-r-4 border-t-4 border-primary" />
      <div className="absolute bottom-14 left-4 w-12 h-12 pointer-events-none opacity-20 border-l-4 border-b-4 border-secondary" />
    </div>
  )
}
