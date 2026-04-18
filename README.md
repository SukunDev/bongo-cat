# Bongo Cat

<p align="center">
  <img src="asset/preview.png" alt="Bongo Cat preview" />
</p>

Bongo Cat animation running on an **ESP32-C3** driving a **128×64 SSD1306 OLED** over I²C. The cat's paws are controlled live from your PC keyboard over USB serial — type on the left half of the keyboard and the cat's right paw drops, type on the right half and the left paw drops, hit space and both paws come down.

- **Hardware:** ESP32-C3 DevKitM-1 + SSD1306 (I²C, address `0x3C`)
- **Framework:** PlatformIO + Arduino
- **Desktop app:** Electron + React 19 + TypeScript
- **Bridge:** Python (pynput, pyserial, bleak)
- **Simulation:** Wokwi (VS Code extension)

## Repository

[github.com/SukunDev/bongo-cat](https://github.com/SukunDev/bongo-cat)

## Hardware wiring

| SSD1306 | ESP32-C3 |
|---------|----------|
| `VCC`   | `3V3`    |
| `GND`   | `GND`    |
| `SDA`   | `GPIO6`  |
| `SCL`   | `GPIO7`  |

I²C clock runs at **400 kHz** (fast mode) so frames refresh in ~25 ms. The OLED has no reset pin (`OLED_RESET = -1`). If you change the pins in [esp32/src/main.cpp](esp32/src/main.cpp), update [esp32/diagram.json](esp32/diagram.json) to match or Wokwi will silently fail to render.

## Getting started

### 1. Prerequisites

- [Git](https://git-scm.com/downloads)
- [Node.js 20+](https://nodejs.org/) (for the desktop app)
- [Python 3.8+](https://www.python.org/downloads/) (for the bridge)
- [PlatformIO Core](https://platformio.org/install/cli) — install via `pip` or as part of the [PlatformIO VS Code extension](https://platformio.org/install/ide?install=vscode)
  ```bash
  pip install -U platformio
  ```
- (Optional) [Wokwi for VS Code](https://marketplace.visualstudio.com/items?itemName=wokwi.wokwi-vscode) to run the simulation without real hardware

Make sure `pio --version` works in a fresh terminal before continuing. On Windows the PlatformIO binaries live in `%USERPROFILE%\.platformio\penv\Scripts` — add that folder to your user `PATH` if the command is not found.

### 2. Clone the repository

```bash
git clone https://github.com/SukunDev/bongo-cat.git
cd bongo-cat
```

### 3. Install dependencies

**ESP32 firmware** — Arduino libraries are fetched automatically on first build:

```bash
cd esp32 && pio run
```

**Python bridge:**

```bash
pip install -r apps/bridge/requirements.txt
```

**Desktop app:**

```bash
cd apps/desktop && npm install
```

## ESP32 firmware

### Build & upload

```bash
cd esp32

# Build firmware
pio run

# Upload to the connected ESP32-C3
pio run -t upload

# Serial monitor (baud already set via monitor_speed in platformio.ini)
pio device monitor
```

Environment name is `esp32-c3-devkitm-1`.

### Wokwi simulation

1. Build the firmware first — Wokwi reads `esp32/.pio/build/esp32-c3-devkitm-1/firmware.bin` and `firmware.elf`.
2. Open [esp32/diagram.json](esp32/diagram.json) in VS Code and run the **Wokwi: Start Simulator** command.
3. Wiring and the SSD1306 part are already defined; no extra setup needed.

## Desktop app

The desktop app is an Electron + React GUI that spawns the Python bridge as a child process and displays connection status.

```bash
cd apps/desktop

# Development with hot reload
npm run dev

# Production build
npm run build
```

## Controlling the cat

### Serial protocol

The firmware listens on the default USB serial port at **115200 baud** and accepts single-character commands:

| Char | Action             |
|------|--------------------|
| `L`  | left paw down      |
| `l`  | left paw up        |
| `R`  | right paw down     |
| `r`  | right paw up       |

Frames are only redrawn when the `left`/`right` state actually changes, so there's no flicker and the RX buffer stays empty even under rapid input.

### Keyboard bridge

The Python bridge (`apps/bridge/`) captures keyboard events and streams paw commands to the ESP32. Mapping is **mirrored**: right-hand keyboard keys move the cat's **left** paw (and vice versa), matching the cat facing the user.

**Standalone usage** (without the desktop app):

```bash
py apps/bridge/main.py
```

**Key mapping:**

| Keyboard area | Keys | Drives |
|---------------|------|--------|
| Left half     | `Q W E R T`, `A S D F G`, `Z X C V B`, `1–5` | right paw |
| Right half    | `Y U I O P`, `H J K L ;`, `N M , . /`, `6–0` | left paw  |
| Space         | —    | both paws |

The bridge also supports BLE connections (~30 second active sessions) and auto-detects the ESP32 via USB VID:PID scanning.

### Legacy standalone script

A simpler standalone script is also available at [esp32/tools/bongo_keymap.py](esp32/tools/bongo_keymap.py) for direct serial control without the bridge architecture:

```bash
python esp32/tools/bongo_keymap.py COM3
```

## Project layout

```
bongo-cat/
├── esp32/                        # ESP32-C3 firmware
│   ├── src/
│   │   ├── main.cpp              # Arduino entry point
│   │   └── animate.h             # Four 128×64 PROGMEM bitmaps
│   ├── tools/
│   │   └── bongo_keymap.py       # Legacy standalone keyboard bridge
│   ├── diagram.json              # Wokwi wiring
│   ├── wokwi.toml                # Wokwi firmware paths
│   └── platformio.ini            # Board, framework, lib deps
├── apps/
│   ├── bridge/                   # Python bridge
│   │   ├── main.py               # Orchestrator
│   │   ├── protocol.py           # JSON lines stdio helpers
│   │   ├── keyboard.py           # Keyboard listener
│   │   ├── serial_conn.py        # USB serial auto-detect
│   │   ├── ble_conn.py           # BLE connection (skeleton)
│   │   └── requirements.txt
│   └── desktop/                  # Electron + React GUI
│       ├── src/
│       │   ├── main/             # Electron main process + bridge spawner
│       │   ├── preload/          # Bridge IPC exposure
│       │   └── renderer/         # React app
│       └── package.json
├── asset/
│   └── preview.png
├── README.md
└── CLAUDE.md
```

## Dependencies

**ESP32:**
- [adafruit/Adafruit SSD1306](https://github.com/adafruit/Adafruit_SSD1306) (pulls in Adafruit GFX transitively)

**Python bridge:**
- [pynput](https://pypi.org/project/pynput/) — keyboard listener
- [pyserial](https://pypi.org/project/pyserial/) — USB serial communication
- [bleak](https://pypi.org/project/bleak/) — Bluetooth BLE

**Desktop:**
- [Electron](https://www.electronjs.org/) + [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [electron-vite](https://electron-vite.org/) — build tooling

## Author

**SukunDev** — [github.com/SukunDev](https://github.com/SukunDev)
