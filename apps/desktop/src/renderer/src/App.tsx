import { useEffect, useState } from 'react'

interface ConnectionState {
  usb: { state: string; port?: string }
  ble: { state: string; device?: string }
  bridge: { state: string }
}

function App(): React.JSX.Element {
  const [conn, setConn] = useState<ConnectionState>({
    usb: { state: 'disconnected' },
    ble: { state: 'standby' },
    bridge: { state: 'starting' }
  })
  const [lastKey, setLastKey] = useState<string>('')

  useEffect(() => {
    window.bridgeAPI.onEvent((event) => {
      const e = event as Record<string, string>
      if (e.type === 'ready') {
        setConn((prev) => ({ ...prev, bridge: { state: 'connected' } }))
      } else if (e.type === 'status') {
        if (e.connection === 'usb') {
          setConn((prev) => ({ ...prev, usb: { state: e.state, port: e.port } }))
        } else if (e.connection === 'ble') {
          setConn((prev) => ({ ...prev, ble: { state: e.state, device: e.device } }))
        } else if (e.connection === 'bridge') {
          setConn((prev) => ({ ...prev, bridge: { state: e.state } }))
        }
      } else if (e.type === 'key') {
        setLastKey(`${e.side} paw ${e.action}`)
      }
    })
  }, [])

  return (
    <div style={{ padding: '24px', fontFamily: 'monospace' }}>
      <h1>Bongo Cat</h1>
      <table>
        <tbody>
          <tr>
            <td>Bridge</td>
            <td>{conn.bridge.state}</td>
          </tr>
          <tr>
            <td>USB</td>
            <td>
              {conn.usb.state}
              {conn.usb.port && ` (${conn.usb.port})`}
            </td>
          </tr>
          <tr>
            <td>BLE</td>
            <td>
              {conn.ble.state}
              {conn.ble.device && ` (${conn.ble.device})`}
            </td>
          </tr>
          <tr>
            <td>Last Key</td>
            <td>{lastKey || '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default App
