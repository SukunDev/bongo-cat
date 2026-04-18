import React, { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { Switch } from '@renderer/components/ui/switch'
import { Button } from '@renderer/components/ui/button'

export const Route = createFileRoute('/settings')({
  component: SettingsPage
})

function SettingRow({
  label,
  description,
  checked,
  onChange
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <div className="text-sm font-['Space_Grotesk'] font-bold text-on-surface">{label}</div>
        <div className="text-xs font-mono text-on-surface-variant mt-0.5">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function SettingsPage(): React.JSX.Element {
  const [openOnStartup, setOpenOnStartup] = useState(false)
  const [systemTray, setSystemTray] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Load saved settings
  useEffect(() => {
    async function load(): Promise<void> {
      const startup = await window.api.store.get('settings.openOnStartup')
      const tray = await window.api.store.get('settings.systemTray')
      setOpenOnStartup(startup === true)
      setSystemTray(tray === true)
      setLoaded(true)
    }
    load()
  }, [])

  const handleOpenOnStartup = async (checked: boolean): Promise<void> => {
    setOpenOnStartup(checked)
    await window.api.store.set('settings.openOnStartup', checked)
    window.api.settings.setAutoLaunch(checked)
  }

  const handleSystemTray = async (checked: boolean): Promise<void> => {
    setSystemTray(checked)
    await window.api.store.set('settings.systemTray', checked)
    window.api.settings.setSystemTray(checked)
  }

  if (!loaded) return <div />

  return (
    <div className="flex flex-col h-screen bg-surface select-none">
      {/* Title bar */}
      <header
        className="flex justify-between items-center px-4 h-12 bg-surface border-b-[3px] border-black z-50"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="w-7 h-7 bg-surface-high border-[2px] border-black flex items-center justify-center text-on-surface hover:bg-primary hover:text-black transition-colors"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
          </Link>
          <span className="font-['Space_Grotesk'] font-bold tracking-tighter text-white uppercase text-xl">
            Settings
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

      <main className="flex-1 p-4 space-y-4 overflow-y-auto bg-surface-low">
        <Card className="border-[3px] border-black neobrutal-shadow bg-surface-high">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase tracking-widest text-on-surface-variant">
              General
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-outline-variant/30">
            <SettingRow
              label="Open on Startup"
              description="Launch Bongo Cat when you log in"
              checked={openOnStartup}
              onChange={handleOpenOnStartup}
            />
            <SettingRow
              label="System Tray"
              description="Minimize to tray instead of closing"
              checked={systemTray}
              onChange={handleSystemTray}
            />
          </CardContent>
        </Card>

        <Card className="border-[3px] border-black neobrutal-shadow bg-surface-high">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase tracking-widest text-on-surface-variant">
              About
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs font-mono text-on-surface-variant space-y-1">
              <p>Bongo Cat v1.0.0</p>
              <p>by SukunDev</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
