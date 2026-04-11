# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Bongo Cat animation for an ESP32-C3 driving a 128x64 SSD1306 OLED over I²C. Built with PlatformIO + Arduino framework. Simulated in Wokwi.

## Commands

All commands assume PlatformIO CLI is available (via the VSCode extension or `pio` on PATH).

- Build: `pio run`
- Upload to device: `pio run -t upload`
- Serial monitor: `pio device monitor -b 115200`
- Clean: `pio run -t clean`
- Wokwi simulation: build first (`pio run`) so `.pio/build/esp32-c3-devkitm-1/firmware.{bin,elf}` exists, then launch the Wokwi VS Code extension on `diagram.json` / `wokwi.toml`.

Environment name is `esp32-c3-devkitm-1` — pass `-e esp32-c3-devkitm-1` if multiple envs are ever added.

There is no test suite (`test/` contains only the PlatformIO placeholder README).

## Hardware Wiring (fixed in firmware and `diagram.json`)

- I²C: `SDA = GPIO5`, `SCL = GPIO6`, clock 100 kHz
- SSD1306 address: `0x3C`, 128×64, no reset pin (`OLED_RESET = -1`)

If you change pins in `src/main.cpp`, update `diagram.json` to match or Wokwi will silently fail to render.

## Architecture

Two files, both in `src/`:

- [src/main.cpp](src/main.cpp) — Arduino entry point. `setup()` starts Serial at 115200, brings up `Wire` on the SDA/SCL pins above, runs `scanI2C()` (diagnostic scan that labels known addresses for SSD1306/MPU6050), then initializes the `Adafruit_SSD1306` display instance. `loop()` is where animation frames get drawn.
- [src/animate.h](src/animate.h) — Four full-screen (128×64, 1024-byte) monochrome bitmaps in `PROGMEM`: `_pawsonair`, `_rightpawontable`, `_leftpawontable`, `_pawsontable`. These are the bongo cat animation frames, drawn via `display.drawBitmap(0, 0, <frame>, 128, 64, SSD1306_WHITE)`. The header is plain data — no functions — so whatever animation logic exists lives in `main.cpp`.

The only external dependency is `adafruit/Adafruit SSD1306` (pulls in `Adafruit GFX` transitively), declared in [platformio.ini](platformio.ini).

## Conventions

- Bitmap frames are stored as `const unsigned char <name>[] PROGMEM` — keep new frames in `animate.h` in the same format and always at 128×64 to match the display.
- Any new I²C peripheral should be added to the address labeler in `scanI2C()` so boot logs stay readable.
