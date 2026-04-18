# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Bongo Cat — a monorepo with three components:

1. **`esp32/`** — Firmware for ESP32-C3 driving a 128×64 SSD1306 OLED over I²C. PlatformIO + Arduino framework, simulated in Wokwi.
2. **`apps/bridge/`** — Python process that listens to the keyboard, auto-detects the ESP32 via USB serial or BLE, and streams paw commands (`L`/`l`/`R`/`r`).
3. **`apps/desktop/`** — Electron + React 19 + TypeScript + Tailwind GUI (neobrutalist "Kinetic Console" style). Spawns the bridge as a child process and communicates via JSON lines on stdio.

## Commands

### ESP32 Firmware (`esp32/`)

All commands run from `esp32/`:

- Build: `pio run`
- Upload: `pio run -t upload`
- Serial monitor: `pio device monitor` (monitor_speed set in platformio.ini)
- Clean: `pio run -t clean`
- Wokwi: build first, then launch Wokwi extension on `diagram.json`

Environment name is `esp32-c3-devkitm-1`.

### Python Bridge (`apps/bridge/`)

```bash
pip install -r apps/bridge/requirements.txt
py apps/bridge/main.py              # standalone (reads stdin, writes stdout)
echo '{"type":"quit"}' | py apps/bridge/main.py   # quick test
```

### Desktop App (`apps/desktop/`)

```bash
cd apps/desktop
npm install
npm run dev       # dev mode with hot reload
npm run build     # production build to out/
```

The `dev` and `preview` scripts go through `scripts/launch.js` which strips `ELECTRON_RUN_AS_NODE=1` before spawning electron-vite. VSCode/Claude Code terminals inherit that env var; without the strip, Electron would boot in Node.js mode and `require('electron')` would return the binary path string instead of the API.

## Hardware Wiring (fixed in firmware and `esp32/diagram.json`)

- I²C: `SDA = GPIO6`, `SCL = GPIO7`, clock 400 kHz
- SSD1306 address: `0x3C`, 128×64 display, no reset pin (`OLED_RESET = -1`)
- Bitmap frames are 128×40 pixels (drawn at the top of the 64-pixel display)

If you change pins in `esp32/src/main.cpp`, update `esp32/diagram.json` to match or Wokwi will silently fail to render.

## Architecture

### Communication flow

```
Keyboard → [apps/bridge] → USB Serial / BLE → [ESP32] → OLED
                ↕ stdio JSON lines
          [apps/desktop] (Electron GUI)
```

### ESP32 firmware (`esp32/src/`)

- `main.cpp`
  - `setup()` inits I²C + OLED
  - `handleSerialInput()` reads `L`/`l`/`R`/`r` from serial and tracks `lastInputTime`
  - `drawFrame()` selects from 4 bitmap frames and only redraws on state change
  - `drawSleeping()` renders sleep animation: `_pawsontable` + closed eyes + floating "Zzz" text
  - `loop()` switches to sleep mode after `SLEEP_TIMEOUT` (10 s) of no input
- `animate.h` — Four 128×40 PROGMEM bitmaps: `_pawsonair`, `_leftpawontable`, `_rightpawontable`, `_pawsontable`.

### Python bridge (`apps/bridge/`)

- `protocol.py` — JSON lines stdio helpers (`send_event`, `send_key`, `send_status`, `read_command`). `read_command()` skips malformed JSON lines instead of exiting.
- `keyboard.py` — Keyboard listener with QWERTY left/right split.
  - **Windows** (`_poll_loop_win`): uses `GetAsyncKeyState` polling (1 kHz with `timeBeginPeriod(1)`). Works reliably in subprocess context where pynput hooks fail.
  - **Non-Windows**: pynput fallback (incomplete — does not handle special keys like Ctrl/Shift/Arrows).
  - Mapping is **direct**: left-hand keys → cat's left paw, right-hand keys → cat's right paw. Space/Enter/Backspace/Tab/Delete/Escape trigger both paws.
- `serial_conn.py` — USB serial auto-detect by VID:PID scan, auto-reconnect. Uses `RLock` (not `Lock`) because `send()` may call `_disconnect()` on exception while holding the lock.
- `ble_conn.py` — BLE skeleton (scan for "BongoCat", 30 s active session). `send()` is a no-op — firmware has no BLE characteristic yet.
- `main.py` — Orchestrator. Single dedicated serial writer thread drains a `SimpleQueue` of commands, so keyboard callbacks never block on serial I/O.

### Desktop app (`apps/desktop/src/`)

Built on a cloned [SukunDev/electron-boilerplate](https://github.com/SukunDev/electron-boilerplate) (Electron 35+, React 19, TanStack Router, Tailwind 4, shadcn-style components).

- `main/index.ts` — Electron main process: window, tray, store, IPC handlers.
- `main/lib/bridge.ts` — Spawns `py apps/bridge/main.py` as child process, relays JSON lines via `webContents.send('bridge-event', ...)`.
- `preload/index.ts` — Exposes `window.api` with `window` controls, `store` (get/set/clear), `bridge` (onEvent/sendCommand), and `settings` (setAutoLaunch/setSystemTray).
- `renderer/src/`
  - `routes/index.tsx` — Main page: CSS bongo cat illustration, paw indicators, connection status bar (USB/BLE).
  - `routes/settings.tsx` — Settings page: toggles for "Open on Startup" and "System Tray".
  - `hooks/useBridge.ts` — Subscribes to bridge events, derives paw/connection state. Manages 10 s sleep timeout for idle animation.
  - `components/ui/` — shadcn-style components (Button, Card, Switch, etc.). `switch.tsx` is custom-added for settings page.

### Key protocol (stdio JSON lines)

Bridge → Electron:
```json
{"type":"ready"}
{"type":"status","connection":"usb","state":"connected","port":"COM7"}
{"type":"status","connection":"ble","state":"scanning"}
{"type":"key","side":"left","action":"down"}
{"type":"error","message":"..."}
```

Electron → Bridge:
```json
{"type":"connect","mode":"ble"}
{"type":"disconnect"}
{"type":"quit"}
```

## Conventions

- Bitmap frames: `const unsigned char <name>[] PROGMEM` in `animate.h`, 128×40 pixels.
- New I²C peripherals: add to `scanI2C()` address labeler.
- Bridge modules: each is standalone-importable and testable without Electron.
- Bridge ↔ Electron protocol: JSON lines on stdio, defined in `protocol.py` and typed in `preload/index.d.ts`.
- USB serial takes priority over BLE when both are available.
- Settings persistence: `electron-store` with namespaced keys (`settings.openOnStartup`, `settings.systemTray`).
- Design system: neobrutalist — 3px black borders, 4px solid black offsets for shadow, 0px border-radius, dark surface colors with high-voltage accents (purple `#d394ff`, yellow `#ffd709`, green `#8eff71`).

## Known Issues (see `docs/` for plans)

- `main/lib/bridge.ts` captures `mainWindow` by reference — stale after window recreation on macOS
- `preload/index.ts` `onEvent` has no cleanup mechanism — listeners accumulate on React remount
- Bridge path uses `app.getAppPath()` which breaks in packaged (ASAR) builds — not yet bundled via `extraResources`
- `spawn('py', ...)` is Windows-only — no `python3` fallback for macOS/Linux
- Several boilerplate files in `renderer/src/lib/` (authService, axios, react-query) are dead code
- ESP32 firmware has no BLE characteristic — BLE path is non-functional end-to-end
