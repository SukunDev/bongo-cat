# Bongo Cat

<p align="center">
  <img src="asset/preview.png" alt="Bongo Cat preview" />
</p>

Bongo Cat animation running on an **ESP32-C3** driving a **128×64 SSD1306 OLED** over I²C. The cat's paws are controlled live from your PC keyboard over USB serial — type on the left half of the keyboard and the cat's right paw drops, type on the right half and the left paw drops, hit space and both paws come down.

- **Hardware:** ESP32-C3 DevKitM-1 + SSD1306 (I²C, address `0x3C`)
- **Framework:** PlatformIO + Arduino
- **Simulation:** Wokwi (VS Code extension)
- **Host input:** Python script captures keystrokes and streams commands over serial

## Repository

[github.com/SukunDev/bongo-cat](https://github.com/SukunDev/bongo-cat)

## Hardware wiring

| SSD1306 | ESP32-C3 |
|---------|----------|
| `VCC`   | `3V3`    |
| `GND`   | `GND`    |
| `SDA`   | `GPIO6`  |
| `SCL`   | `GPIO7`  |

I²C clock runs at **400 kHz** (fast mode) so frames refresh in ~25 ms. The OLED has no reset pin (`OLED_RESET = -1`). If you change the pins in [src/main.cpp](src/main.cpp), update [diagram.json](diagram.json) to match or Wokwi will silently fail to render.

## Getting started

### 1. Prerequisites

- [Git](https://git-scm.com/downloads)
- [Python 3.8+](https://www.python.org/downloads/) (only needed for the keyboard bridge script)
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

### 3. Install project dependencies

Arduino libraries are declared in [platformio.ini](platformio.ini) and fetched automatically on the first build — you don't need to install them manually:

```bash
pio run
```

The first build will download the ESP32 toolchain, the Arduino framework, and `Adafruit SSD1306` (plus `Adafruit GFX`). Subsequent builds are incremental and fast.

Python dependencies for the host-side keyboard bridge:

```bash
pip install pyserial pynput
```

## Build & upload

```bash
# Build firmware
pio run

# Upload to the connected ESP32-C3
pio run -t upload

# Serial monitor (baud already set via monitor_speed in platformio.ini)
pio device monitor
```

Environment name is `esp32-c3-devkitm-1`.

## Wokwi simulation

1. Build the firmware first — Wokwi reads `.pio/build/esp32-c3-devkitm-1/firmware.bin` and `firmware.elf`.
2. Open [diagram.json](diagram.json) in VS Code and run the **Wokwi: Start Simulator** command.
3. Wiring and the SSD1306 part are already defined; no extra setup needed.

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

### Keyboard bridge (`tools/bongo_keymap.py`)

Instead of typing `L`/`l`/`R`/`r` into a serial monitor, use the host-side Python script to stream real keystrokes. Mapping is **mirrored**: right-hand keyboard keys move the cat's **left** paw (and vice versa), matching the cat facing the user.

Install dependencies once:

```bash
pip install pyserial pynput
```

Find your ESP32-C3 serial port (`pio device list`), close any other tool that holds it, then run:

```bash
python tools/bongo_keymap.py COM3
```

Mapping:

| Keyboard area | Keys | Drives |
|---------------|------|--------|
| Left half     | `Q W E R T`, `A S D F G`, `Z X C V B`, `1–5` | right paw |
| Right half    | `Y U I O P`, `H J K L ;`, `N M , . /`, `6–0` | left paw  |
| Space         | —    | both paws |

Press **ESC** to quit. The script tracks currently-held keys and only sends a serial byte when the derived paw state actually flips, so holding a key down doesn't flood the link.

## Project layout

```
bongo-cat/
├── src/
│   ├── main.cpp     # Arduino entry point: setup(), loop(), serial handler
│   └── animate.h    # Four 128×64 PROGMEM bitmap frames
├── tools/
│   └── bongo_keymap.py  # Host-side keyboard → serial bridge
├── diagram.json     # Wokwi wiring
├── wokwi.toml       # Wokwi firmware paths
├── platformio.ini   # Board, framework, lib deps, monitor speed
└── CLAUDE.md        # Guidance for Claude Code sessions
```

Animation frames live in [src/animate.h](src/animate.h) as four full-screen monochrome bitmaps stored in `PROGMEM`:

- `_pawsonair` — both paws in the air
- `_leftpawontable` — left paw down
- `_rightpawontable` — right paw down
- `_pawsontable` — both paws down

## Dependencies

- [adafruit/Adafruit SSD1306](https://github.com/adafruit/Adafruit_SSD1306) (pulls in Adafruit GFX transitively)

Declared in [platformio.ini](platformio.ini); PlatformIO fetches them on first build.

## Author

**SukunDev** — [github.com/SukunDev](https://github.com/SukunDev)
