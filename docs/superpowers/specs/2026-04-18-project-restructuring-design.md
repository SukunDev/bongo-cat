# Project Restructuring: Monorepo with ESP32 + Desktop App

**Date:** 2026-04-18
**Author:** SukunDev
**Status:** Approved

## Overview

Restructure the bongo-cat project from a flat PlatformIO project into a monorepo with three concerns:

1. **`esp32/`** — Firmware for ESP32-C3 + SSD1306 OLED (already exists, self-contained)
2. **`apps/desktop/`** — Electron + React GUI for connection status and control
3. **`apps/bridge/`** — Python process handling keyboard listening, USB serial, and Bluetooth BLE

Electron spawns the Python bridge as a child process. They communicate via **stdio JSON lines**.

## Target Structure

```
bongo-cat/
├── esp32/                    # Firmware (unchanged)
│   ├── src/
│   │   ├── main.cpp
│   │   └── animate.h
│   ├── asset/
│   │   └── preview.png
│   ├── tools/
│   │   └── bongo_keymap.py   # Reference for key mapping
│   ├── diagram.json
│   ├── wokwi.toml
│   └── platformio.ini
├── apps/
│   ├── desktop/              # Electron + React 19 + TypeScript + Vite
│   │   ├── src/
│   │   │   ├── main/         # Electron main process
│   │   │   ├── preload/      # Preload scripts
│   │   │   └── renderer/     # React app
│   │   ├── package.json
│   │   ├── electron.vite.config.ts
│   │   └── tsconfig.json
│   └── bridge/               # Python bridge
│       ├── main.py           # Entry point
│       ├── keyboard.py       # Keyboard listener (pynput)
│       ├── serial_conn.py    # USB serial (pyserial, auto-detect)
│       ├── ble_conn.py       # BLE (bleak)
│       ├── protocol.py       # JSON lines stdio protocol
│       └── requirements.txt
├── asset/
│   └── preview.png
├── README.md
├── CLAUDE.md
└── .gitignore
```

## Component Details

### 1. `apps/bridge/` — Python Bridge

**Dependencies:** pynput, pyserial, bleak

**Modules:**

- **`main.py`** — Entry point. Reads JSON commands from stdin, writes JSON events to stdout. Orchestrates keyboard, serial, and BLE modules.
- **`keyboard.py`** — Keyboard listener using pynput. Splits QWERTY into left-hand and right-hand halves (reference: `esp32/tools/bongo_keymap.py`). Tracks held keys, emits state changes (not per-key events). Mirror mapping: right-hand keys drive cat's left paw, vice versa.
- **`serial_conn.py`** — USB serial via pyserial. Auto-detects ESP32-C3 by scanning available COM ports and checking device descriptions/VID:PID. Reconnects automatically if the device is unplugged and re-plugged. Always-on when USB is available.
- **`ble_conn.py`** — Bluetooth BLE via bleak. Scans for the ESP32 BLE peripheral, connects, sends L/l/R/r commands for ~30 seconds, then disconnects and enters standby. Reconnects on command from Electron.
- **`protocol.py`** — Defines the JSON lines message format for stdio communication.

**Standalone usage:** `python apps/bridge/main.py` works without Electron for testing.

### 2. `apps/desktop/` — Electron + React

**Stack:** Electron (latest) + React 19 + TypeScript + Vite (electron-vite)

**Skeleton scope (this phase):**

- Project scaffolding with electron-vite
- Main process: spawns `python apps/bridge/main.py` as a child process, manages lifecycle (spawn on start, kill on quit, respawn on crash)
- Preload: exposes IPC channel for bridge messages to renderer
- Renderer: React app shell with placeholder UI showing connection status

**Not in scope for skeleton:**
- Full UI design
- Settings/preferences
- System tray integration
- Auto-update

### 3. `esp32/` — Firmware

No changes. Already self-contained with its own `platformio.ini`, source, tools, and Wokwi config.

### 4. Root Cleanup

**Delete from root** (duplicates of files already in `esp32/`):
- `src/` (main.cpp, animate.h)
- `platformio.ini`
- `diagram.json`
- `wokwi.toml`
- `include/`
- `lib/`
- `test/`
- `tools/`

**Keep in root:**
- `asset/preview.png` — used by README
- `README.md` — updated for new structure
- `CLAUDE.md` — updated for new structure
- `.gitignore` — updated to cover node_modules, dist, __pycache__, .pio

## Stdio Protocol (JSON Lines)

Each line is a complete JSON object terminated by `\n`.

### Bridge → Electron (events)

```json
{"type": "status", "connection": "usb", "port": "COM3", "state": "connected"}
{"type": "status", "connection": "usb", "state": "disconnected"}
{"type": "status", "connection": "ble", "state": "scanning"}
{"type": "status", "connection": "ble", "device": "BongoCat", "state": "connected"}
{"type": "status", "connection": "ble", "state": "standby"}
{"type": "key", "side": "left", "action": "down"}
{"type": "key", "side": "right", "action": "up"}
{"type": "error", "message": "Serial port lost"}
{"type": "ready"}
```

### Electron → Bridge (commands)

```json
{"type": "connect", "mode": "usb"}
{"type": "connect", "mode": "ble"}
{"type": "disconnect"}
{"type": "quit"}
```

## Connection Behavior

- **USB Serial:** Auto-detect on startup. Reconnect automatically when device appears. Always-on as long as USB is plugged in.
- **BLE:** Connect on command, maintain for ~30 seconds of activity, then disconnect and enter standby. Reconnect when Electron sends a new `connect` command.
- **Priority:** If both USB and BLE are available, USB takes precedence (lower latency).

## Key Mapping (from esp32/tools/bongo_keymap.py)

Mirror mapping — cat faces the user:

| Keyboard side | Keys | Cat paw |
|---|---|---|
| Left half | Q W E R T, A S D F G, Z X C V B, 1-5 | Right paw (R/r) |
| Right half | Y U I O P, H J K L ;, N M , . /, 6-0 | Left paw (L/l) |
| Space | — | Both paws |

Serial commands sent to ESP32: `L` (left down), `l` (left up), `R` (right down), `r` (right up).
