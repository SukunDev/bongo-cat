# Project Restructuring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure bongo-cat into a monorepo with `esp32/` firmware, `apps/bridge/` Python bridge, and `apps/desktop/` Electron+React skeleton.

**Architecture:** Electron spawns Python bridge as child process, communicating via stdio JSON lines. Bridge handles keyboard listening, USB serial auto-detect, and BLE. ESP32 firmware is already self-contained in `esp32/`.

**Tech Stack:** Python 3.14 (pynput, pyserial, bleak), Electron + React 19 + TypeScript + Vite (electron-vite), Node 20

**Spec:** `docs/superpowers/specs/2026-04-18-project-restructuring-design.md`

**Python executable:** `py` (Windows launcher at `C:\Users\Administrator\AppData\Local\Programs\Python\Launcher\py.exe`)

---

### Task 1: Root Cleanup — .gitignore and asset

**Files:**
- Modify: `.gitignore`
- Create: `asset/preview.png` (copy from `esp32/asset/preview.png`)

Root-level duplicate files (`src/`, `platformio.ini`, etc.) have already been removed. This task adds missing pieces.

- [ ] **Step 1: Copy preview asset to root**

```bash
mkdir -p asset
cp esp32/asset/preview.png asset/preview.png
```

README.md references `asset/preview.png` at root level — this file must exist here.

- [ ] **Step 2: Update .gitignore**

Replace `.gitignore` with:

```gitignore
# PlatformIO
.pio

# VS Code
.vscode/.browse.c_cpp.db*
.vscode/c_cpp_properties.json
.vscode/launch.json
.vscode/ipch
.vscode

# Claude
.claude

# Node / Electron
node_modules
dist
dist-electron
out

# Python
__pycache__
*.pyc
.venv
venv

# OS
.DS_Store
Thumbs.db
```

- [ ] **Step 3: Commit**

```bash
git add asset/preview.png .gitignore
git commit -m "chore: add root asset and update .gitignore for monorepo"
```

---

### Task 2: Python Bridge — protocol.py

**Files:**
- Create: `apps/bridge/protocol.py`

This module defines the JSON lines message helpers. All other bridge modules import from here.

- [ ] **Step 1: Create `apps/bridge/protocol.py`**

```python
"""JSON lines stdio protocol for Electron <-> Bridge communication."""

import json
import sys


def send_event(event: dict) -> None:
    """Write a JSON line to stdout (Bridge -> Electron)."""
    line = json.dumps(event, separators=(",", ":"))
    sys.stdout.write(line + "\n")
    sys.stdout.flush()


def read_command() -> dict | None:
    """Read a JSON line from stdin (Electron -> Bridge). Returns None on EOF."""
    try:
        line = sys.stdin.readline()
        if not line:
            return None
        return json.loads(line.strip())
    except (json.JSONDecodeError, EOFError):
        return None


def send_status(connection: str, state: str, **extra) -> None:
    """Shorthand for status events."""
    send_event({"type": "status", "connection": connection, "state": state, **extra})


def send_key(side: str, action: str) -> None:
    """Shorthand for key events. side: 'left'|'right', action: 'down'|'up'."""
    send_event({"type": "key", "side": side, "action": action})


def send_error(message: str) -> None:
    """Shorthand for error events."""
    send_event({"type": "error", "message": message})


def send_ready() -> None:
    """Signal bridge is initialized and ready."""
    send_event({"type": "ready"})
```

- [ ] **Step 2: Verify module imports cleanly**

```bash
cd apps/bridge && py -c "import protocol; protocol.send_ready()"
```

Expected: prints `{"type":"ready"}` to stdout.

- [ ] **Step 3: Commit**

```bash
git add apps/bridge/protocol.py
git commit -m "feat(bridge): add JSON lines stdio protocol module"
```

---

### Task 3: Python Bridge — keyboard.py

**Files:**
- Create: `apps/bridge/keyboard.py`

Keyboard listener using pynput. Mirror mapping from `esp32/tools/bongo_keymap.py`. Calls a callback on state change rather than sending serial directly — that's `main.py`'s job.

- [ ] **Step 1: Create `apps/bridge/keyboard.py`**

```python
"""Keyboard listener with QWERTY left/right split and mirror mapping."""

from pynput import keyboard

# QWERTY keyboard halves
LEFT_HALF = set("qwertasdfgzxcvb12345`")
RIGHT_HALF = set("yuiophjkl;'nm,./67890-=[]\\")

# Mirror mapping: right-hand typing = cat's left paw (cat faces user)
CAT_LEFT_TRIGGERS = RIGHT_HALF
CAT_RIGHT_TRIGGERS = LEFT_HALF


class KeyboardListener:
    def __init__(self, on_state_change):
        """
        on_state_change(cat_left: bool, cat_right: bool) is called
        whenever the derived paw state changes.
        """
        self._on_state_change = on_state_change
        self._pressed = set()
        self._space_held = False
        self._prev_left = False
        self._prev_right = False
        self._listener = None

    def start(self):
        self._listener = keyboard.Listener(
            on_press=self._on_press,
            on_release=self._on_release,
        )
        self._listener.start()

    def stop(self):
        if self._listener:
            self._listener.stop()
            self._listener = None

    def _recompute(self):
        cat_left = self._space_held or any(
            c in CAT_LEFT_TRIGGERS for c in self._pressed
        )
        cat_right = self._space_held or any(
            c in CAT_RIGHT_TRIGGERS for c in self._pressed
        )
        if cat_left != self._prev_left or cat_right != self._prev_right:
            self._prev_left = cat_left
            self._prev_right = cat_right
            self._on_state_change(cat_left, cat_right)

    def _on_press(self, key):
        if key == keyboard.Key.space:
            self._space_held = True
        else:
            ch = getattr(key, "char", None)
            if ch:
                self._pressed.add(ch.lower())
        self._recompute()

    def _on_release(self, key):
        if key == keyboard.Key.space:
            self._space_held = False
        else:
            ch = getattr(key, "char", None)
            if ch:
                self._pressed.discard(ch.lower())
        self._recompute()
```

- [ ] **Step 2: Verify module imports cleanly**

```bash
cd apps/bridge && py -c "from keyboard import KeyboardListener; print('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add apps/bridge/keyboard.py
git commit -m "feat(bridge): add keyboard listener with QWERTY mirror mapping"
```

---

### Task 4: Python Bridge — serial_conn.py

**Files:**
- Create: `apps/bridge/serial_conn.py`

USB serial connection with auto-detect and auto-reconnect.

- [ ] **Step 1: Create `apps/bridge/serial_conn.py`**

```python
"""USB serial connection with auto-detect and auto-reconnect."""

import threading
import time
import serial
import serial.tools.list_ports

# Known ESP32-C3 USB VID:PID pairs
ESP32_IDENTIFIERS = [
    (0x303A, 0x1001),  # Espressif ESP32-C3 native USB
    (0x10C4, 0xEA60),  # CP2102 (common USB-UART bridge)
    (0x1A86, 0x55D4),  # CH343 (common on devkits)
]

BAUD_RATE = 115200
RECONNECT_INTERVAL = 2  # seconds


class SerialConnection:
    def __init__(self, on_status_change):
        """
        on_status_change(state: str, port: str | None) is called
        when connection state changes.
        """
        self._on_status_change = on_status_change
        self._serial = None
        self._port = None
        self._running = False
        self._thread = None
        self._lock = threading.Lock()

    def start(self):
        """Start auto-detect loop in background thread."""
        self._running = True
        self._thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False
        self._disconnect()
        if self._thread:
            self._thread.join(timeout=5)

    def send(self, data: bytes) -> bool:
        """Send bytes to the serial port. Returns True if sent."""
        with self._lock:
            if self._serial and self._serial.is_open:
                try:
                    self._serial.write(data)
                    self._serial.flush()
                    return True
                except serial.SerialException:
                    self._disconnect()
        return False

    @property
    def connected(self) -> bool:
        with self._lock:
            return self._serial is not None and self._serial.is_open

    @property
    def port(self) -> str | None:
        return self._port

    def _detect_port(self) -> str | None:
        """Scan COM ports for ESP32-C3."""
        for port_info in serial.tools.list_ports.comports():
            for vid, pid in ESP32_IDENTIFIERS:
                if port_info.vid == vid and port_info.pid == pid:
                    return port_info.device
            # Fallback: check description
            desc = (port_info.description or "").lower()
            if "esp32" in desc or "cp210" in desc or "ch34" in desc:
                return port_info.device
        return None

    def _connect(self, port: str) -> bool:
        try:
            s = serial.Serial(port, BAUD_RATE, timeout=0.1)
            with self._lock:
                self._serial = s
                self._port = port
            self._on_status_change("connected", port)
            return True
        except serial.SerialException:
            return False

    def _disconnect(self):
        with self._lock:
            if self._serial:
                try:
                    self._serial.close()
                except Exception:
                    pass
                self._serial = None
                port = self._port
                self._port = None
        self._on_status_change("disconnected", None)

    def _monitor_loop(self):
        """Continuously detect and reconnect."""
        while self._running:
            if not self.connected:
                port = self._detect_port()
                if port:
                    self._connect(port)
            else:
                # Verify connection is still alive
                with self._lock:
                    if self._serial:
                        try:
                            self._serial.in_waiting  # probe
                        except serial.SerialException:
                            pass  # _disconnect in next cycle
                        else:
                            time.sleep(RECONNECT_INTERVAL)
                            continue
                self._disconnect()
            time.sleep(RECONNECT_INTERVAL)
```

- [ ] **Step 2: Verify module imports cleanly**

```bash
cd apps/bridge && py -c "from serial_conn import SerialConnection; print('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add apps/bridge/serial_conn.py
git commit -m "feat(bridge): add USB serial with auto-detect and reconnect"
```

---

### Task 5: Python Bridge — ble_conn.py

**Files:**
- Create: `apps/bridge/ble_conn.py`

BLE connection using bleak. Connects for ~30 seconds then enters standby.

- [ ] **Step 1: Create `apps/bridge/ble_conn.py`**

```python
"""Bluetooth BLE connection using bleak."""

import asyncio
import threading
import time

try:
    from bleak import BleakClient, BleakScanner
except ImportError:
    BleakClient = None
    BleakScanner = None

# ESP32 BLE service/characteristic UUIDs — update these to match firmware
BLE_DEVICE_NAME = "BongoCat"
BLE_TIMEOUT = 30  # seconds of activity before standby
SCAN_TIMEOUT = 10  # seconds to scan for device


class BleConnection:
    def __init__(self, on_status_change):
        """
        on_status_change(state: str, device: str | None) is called
        when BLE state changes: 'scanning', 'connected', 'standby', 'disconnected'.
        """
        self._on_status_change = on_status_change
        self._client = None
        self._thread = None
        self._running = False
        self._loop = None
        self._last_activity = 0

    def start(self):
        """Start BLE connection in a background thread with its own event loop."""
        if BleakClient is None:
            self._on_status_change("error", None)
            return
        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False
        if self._loop:
            self._loop.call_soon_threadsafe(self._loop.stop)
        if self._thread:
            self._thread.join(timeout=5)

    def send(self, data: bytes) -> bool:
        """Send bytes over BLE. Returns True if sent."""
        self._last_activity = time.time()
        # BLE write implementation depends on ESP32 firmware's characteristic UUID
        # Skeleton: return False until firmware BLE is implemented
        return False

    @property
    def connected(self) -> bool:
        return self._client is not None and self._client.is_connected

    def _run_loop(self):
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        try:
            self._loop.run_until_complete(self._ble_lifecycle())
        except Exception:
            pass
        finally:
            self._loop.close()

    async def _ble_lifecycle(self):
        """Scan -> connect -> active for BLE_TIMEOUT -> standby."""
        while self._running:
            self._on_status_change("scanning", None)
            device = await self._scan()
            if not device:
                self._on_status_change("standby", None)
                await asyncio.sleep(5)
                continue

            try:
                async with BleakClient(device.address) as client:
                    self._client = client
                    self._on_status_change("connected", device.name or device.address)
                    self._last_activity = time.time()

                    while self._running:
                        elapsed = time.time() - self._last_activity
                        if elapsed > BLE_TIMEOUT:
                            break
                        await asyncio.sleep(1)

                    self._client = None
            except Exception:
                self._client = None

            self._on_status_change("standby", None)
            # Wait before next scan cycle
            for _ in range(10):
                if not self._running:
                    break
                await asyncio.sleep(1)

    async def _scan(self):
        """Scan for BongoCat BLE device."""
        try:
            devices = await BleakScanner.discover(timeout=SCAN_TIMEOUT)
            for d in devices:
                if d.name and BLE_DEVICE_NAME.lower() in d.name.lower():
                    return d
        except Exception:
            pass
        return None
```

- [ ] **Step 2: Verify module imports cleanly (even without bleak installed)**

```bash
cd apps/bridge && py -c "from ble_conn import BleConnection; print('ok')"
```

Expected: `ok` (bleak import is guarded with try/except)

- [ ] **Step 3: Commit**

```bash
git add apps/bridge/ble_conn.py
git commit -m "feat(bridge): add BLE connection skeleton with bleak"
```

---

### Task 6: Python Bridge — main.py + requirements.txt

**Files:**
- Create: `apps/bridge/main.py`
- Create: `apps/bridge/requirements.txt`

Orchestrator that ties keyboard, serial, and BLE together. Reads commands from stdin, writes events to stdout.

- [ ] **Step 1: Create `apps/bridge/requirements.txt`**

```
pynput>=1.7.6
pyserial>=3.5
bleak>=0.22.0
```

- [ ] **Step 2: Create `apps/bridge/main.py`**

```python
"""
Bongo Cat Bridge — orchestrates keyboard, USB serial, and BLE.

Communicates with the Electron app via JSON lines on stdio.
Can also run standalone for testing:
    py apps/bridge/main.py
"""

import sys
import threading
import time

from protocol import send_status, send_key, send_error, send_ready, read_command
from keyboard import KeyboardListener
from serial_conn import SerialConnection
from ble_conn import BleConnection


class Bridge:
    def __init__(self):
        self._serial = SerialConnection(on_status_change=self._on_serial_status)
        self._ble = BleConnection(on_status_change=self._on_ble_status)
        self._keyboard = KeyboardListener(on_state_change=self._on_key_state)
        self._running = False
        self._prev_cat_left = False
        self._prev_cat_right = False

    def start(self):
        self._running = True
        self._serial.start()
        self._keyboard.start()
        send_ready()
        self._command_loop()

    def stop(self):
        self._running = False
        self._keyboard.stop()
        self._serial.stop()
        self._ble.stop()

    def _send_to_device(self, data: bytes):
        """Send to whichever transport is connected. USB takes priority."""
        if self._serial.connected:
            self._serial.send(data)
        elif self._ble.connected:
            self._ble.send(data)

    def _on_key_state(self, cat_left: bool, cat_right: bool):
        """Called by KeyboardListener when paw state changes."""
        if cat_left != self._prev_cat_left:
            cmd = b"L" if cat_left else b"l"
            self._send_to_device(cmd)
            send_key("left", "down" if cat_left else "up")
            self._prev_cat_left = cat_left

        if cat_right != self._prev_cat_right:
            cmd = b"R" if cat_right else b"r"
            self._send_to_device(cmd)
            send_key("right", "down" if cat_right else "up")
            self._prev_cat_right = cat_right

    def _on_serial_status(self, state: str, port: str | None):
        if port:
            send_status("usb", state, port=port)
        else:
            send_status("usb", state)

    def _on_ble_status(self, state: str, device: str | None):
        if device:
            send_status("ble", state, device=device)
        else:
            send_status("ble", state)

    def _command_loop(self):
        """Read commands from stdin until quit or EOF."""
        while self._running:
            cmd = read_command()
            if cmd is None:
                # EOF — parent process closed stdin
                break

            cmd_type = cmd.get("type")
            if cmd_type == "quit":
                break
            elif cmd_type == "connect":
                mode = cmd.get("mode")
                if mode == "ble":
                    self._ble.start()
            elif cmd_type == "disconnect":
                self._ble.stop()

        self.stop()


def main():
    bridge = Bridge()
    try:
        bridge.start()
    except KeyboardInterrupt:
        pass
    finally:
        bridge.stop()


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Verify bridge starts and emits ready event**

```bash
cd apps/bridge && echo '{"type":"quit"}' | py main.py
```

Expected output includes: `{"type":"ready"}` followed by USB status events, then exits.

- [ ] **Step 4: Commit**

```bash
git add apps/bridge/main.py apps/bridge/requirements.txt
git commit -m "feat(bridge): add main orchestrator and requirements"
```

---

### Task 7: Electron + React Scaffold

**Files:**
- Create: `apps/desktop/` (entire scaffold via electron-vite)

Use `create-electron-vite` to scaffold the project with React + TypeScript template.

- [ ] **Step 1: Scaffold with electron-vite**

```bash
cd apps && npx create-electron-vite desktop --template react-ts
```

When prompted, select defaults. This creates the full Electron + React + TypeScript + Vite project structure.

- [ ] **Step 2: Install dependencies**

```bash
cd apps/desktop && npm install
```

- [ ] **Step 3: Verify it builds and opens**

```bash
cd apps/desktop && npm run build
```

Expected: Build succeeds, produces `out/` directory.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/
git commit -m "feat(desktop): scaffold Electron + React 19 + TypeScript via electron-vite"
```

---

### Task 8: Electron Main Process — Bridge Spawner

**Files:**
- Modify: `apps/desktop/src/main/index.ts`

Add child process management to spawn the Python bridge, relay stdio, and handle lifecycle.

- [ ] **Step 1: Create bridge manager module**

Create `apps/desktop/src/main/bridge.ts`:

```typescript
import { ChildProcess, spawn } from 'child_process'
import { app, BrowserWindow } from 'electron'
import path from 'path'
import readline from 'readline'

let bridgeProcess: ChildProcess | null = null

function getBridgePath(): string {
  // In development, bridge is relative to project root
  return path.resolve(app.getAppPath(), '..', '..', 'bridge', 'main.py')
}

export function startBridge(mainWindow: BrowserWindow): void {
  const bridgePath = getBridgePath()

  bridgeProcess = spawn('py', [bridgePath], {
    stdio: ['pipe', 'pipe', 'pipe']
  })

  if (!bridgeProcess.stdout || !bridgeProcess.stderr) return

  // Read JSON lines from bridge stdout
  const rl = readline.createInterface({ input: bridgeProcess.stdout })
  rl.on('line', (line: string) => {
    try {
      const event = JSON.parse(line)
      mainWindow.webContents.send('bridge-event', event)
    } catch {
      // ignore non-JSON lines
    }
  })

  bridgeProcess.stderr.on('data', (data: Buffer) => {
    console.error('[bridge stderr]', data.toString())
  })

  bridgeProcess.on('exit', (code: number | null) => {
    console.log(`[bridge] exited with code ${code}`)
    bridgeProcess = null
    mainWindow.webContents.send('bridge-event', {
      type: 'status',
      connection: 'bridge',
      state: 'disconnected'
    })
  })
}

export function sendToBridge(command: object): void {
  if (bridgeProcess?.stdin?.writable) {
    bridgeProcess.stdin.write(JSON.stringify(command) + '\n')
  }
}

export function stopBridge(): void {
  if (bridgeProcess) {
    sendToBridge({ type: 'quit' })
    setTimeout(() => {
      if (bridgeProcess) {
        bridgeProcess.kill()
        bridgeProcess = null
      }
    }, 2000)
  }
}
```

- [ ] **Step 2: Integrate bridge into main/index.ts**

Modify `apps/desktop/src/main/index.ts` — add imports and hook into app lifecycle:

Add at the top:
```typescript
import { startBridge, stopBridge, sendToBridge } from './bridge'
import { ipcMain } from 'electron'
```

After `mainWindow` is created and `ready-to-show` fires, add:
```typescript
startBridge(mainWindow)
```

Add IPC handler for renderer → bridge commands:
```typescript
ipcMain.on('bridge-command', (_event, command) => {
  sendToBridge(command)
})
```

In the `before-quit` or window close handler, add:
```typescript
stopBridge()
```

- [ ] **Step 3: Verify it builds**

```bash
cd apps/desktop && npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/main/bridge.ts apps/desktop/src/main/index.ts
git commit -m "feat(desktop): add bridge child process spawner"
```

---

### Task 9: Electron Preload — Bridge IPC

**Files:**
- Modify: `apps/desktop/src/preload/index.ts`

Expose bridge event listener and command sender to the renderer via contextBridge.

- [ ] **Step 1: Update preload to expose bridge API**

Add to `apps/desktop/src/preload/index.ts`:

```typescript
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('bridgeAPI', {
  onEvent: (callback: (event: unknown) => void) => {
    ipcRenderer.on('bridge-event', (_event, data) => callback(data))
  },
  sendCommand: (command: object) => {
    ipcRenderer.send('bridge-command', command)
  }
})
```

- [ ] **Step 2: Add type declaration for renderer**

Create `apps/desktop/src/preload/bridge.d.ts`:

```typescript
interface BridgeEvent {
  type: 'status' | 'key' | 'error' | 'ready'
  connection?: string
  state?: string
  port?: string
  device?: string
  side?: string
  action?: string
  message?: string
}

interface BridgeAPI {
  onEvent: (callback: (event: BridgeEvent) => void) => void
  sendCommand: (command: object) => void
}

declare global {
  interface Window {
    bridgeAPI: BridgeAPI
  }
}
```

- [ ] **Step 3: Verify it builds**

```bash
cd apps/desktop && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/preload/
git commit -m "feat(desktop): expose bridge IPC to renderer via preload"
```

---

### Task 10: React Renderer — App Shell with Connection Status

**Files:**
- Modify: `apps/desktop/src/renderer/src/App.tsx`

Replace the default App component with a minimal connection status display.

- [ ] **Step 1: Replace App.tsx with connection status shell**

```tsx
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
```

- [ ] **Step 2: Verify it builds**

```bash
cd apps/desktop && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/renderer/
git commit -m "feat(desktop): add React app shell with connection status"
```

---

### Task 11: Update Root Docs — CLAUDE.md and README.md

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

Update both files to reflect the new monorepo structure.

- [ ] **Step 1: Update CLAUDE.md**

Rewrite to cover the full monorepo: esp32 commands, bridge commands, desktop commands, architecture overview, and conventions.

Key sections:
- **Project** — monorepo with three components
- **Commands** — per-component: `pio run` for esp32, `py apps/bridge/main.py` for bridge, `npm run dev` in `apps/desktop/` for Electron
- **Architecture** — esp32 firmware, Python bridge (stdio JSON lines), Electron+React GUI
- **Hardware Wiring** — unchanged from before
- **Conventions** — existing firmware conventions + new: JSON lines protocol in `protocol.py`, bridge modules are standalone-testable

- [ ] **Step 2: Update README.md**

Update the project layout section and getting started instructions:
- Add `apps/desktop/` and `apps/bridge/` to the tree
- Add setup instructions for desktop app (`cd apps/desktop && npm install`)
- Add setup instructions for bridge (`pip install -r apps/bridge/requirements.txt`)
- Update the keyboard bridge section to reference the new path
- Keep esp32 section unchanged

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: update CLAUDE.md and README.md for monorepo structure"
```
