# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Bongo Cat — a monorepo with three components:

1. **`esp32/`** — Firmware for ESP32-C3 driving a 128×64 SSD1306 OLED over I²C. PlatformIO + Arduino framework, simulated in Wokwi.
2. **`apps/bridge/`** — Python process that listens to the keyboard, auto-detects the ESP32 via USB serial or BLE, and streams paw commands (`L`/`l`/`R`/`r`).
3. **`apps/desktop/`** — Electron + React 19 + TypeScript GUI. Spawns the bridge as a child process and communicates via JSON lines on stdio.

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

## Hardware Wiring (fixed in firmware and `esp32/diagram.json`)

- I²C: `SDA = GPIO6`, `SCL = GPIO7`, clock 400 kHz
- SSD1306 address: `0x3C`, 128×64, no reset pin (`OLED_RESET = -1`)

If you change pins in `esp32/src/main.cpp`, update `esp32/diagram.json` to match or Wokwi will silently fail to render.

## Architecture

### Communication flow

```
Keyboard → [apps/bridge] → USB Serial / BLE → [ESP32] → OLED
                ↕ stdio JSON lines
          [apps/desktop] (Electron GUI)
```

### ESP32 firmware (`esp32/src/`)

- `main.cpp` — `setup()` inits I²C + OLED, `handleSerialInput()` reads `L`/`l`/`R`/`r` from serial, `drawFrame()` only redraws on state change.
- `animate.h` — Four 128×64 PROGMEM bitmaps: `_pawsonair`, `_leftpawontable`, `_rightpawontable`, `_pawsontable`.

### Python bridge (`apps/bridge/`)

- `protocol.py` — JSON lines stdio helpers (`send_event`, `read_command`, etc.)
- `keyboard.py` — pynput listener, QWERTY left/right split with mirror mapping
- `serial_conn.py` — USB serial auto-detect (VID:PID scan) with auto-reconnect
- `ble_conn.py` — BLE via bleak, ~30s active then standby (skeleton)
- `main.py` — Orchestrator: ties keyboard + serial + BLE, reads stdin commands, writes stdout events

### Desktop app (`apps/desktop/src/`)

- `main/index.ts` — Electron main process, spawns bridge
- `main/bridge.ts` — Child process manager for bridge (spawn, relay stdio, kill on quit)
- `preload/index.ts` — Exposes `bridgeAPI` (onEvent, sendCommand) to renderer
- `renderer/src/App.tsx` — React shell showing connection status (USB, BLE, bridge, last key)

## Conventions

- Bitmap frames: `const unsigned char <name>[] PROGMEM` in `animate.h`, always 128×64.
- New I²C peripherals: add to `scanI2C()` address labeler.
- Bridge modules: each is standalone-importable and testable without Electron.
- Bridge ↔ Electron protocol: JSON lines on stdio, defined in `protocol.py` and typed in `preload/index.d.ts`.
- USB serial takes priority over BLE when both are available.
