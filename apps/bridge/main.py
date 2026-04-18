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
