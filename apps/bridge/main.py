"""
Bongo Cat Bridge — orchestrates keyboard, USB serial, and BLE.

Communicates with the Electron app via JSON lines on stdio.
Can also run standalone for testing:
    py apps/bridge/main.py
"""

import threading
from queue import SimpleQueue

from protocol import send_status, send_key, send_ready, read_command
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
        self._stop_event = threading.Event()
        self._send_queue = SimpleQueue()

    def start(self):
        self._running = True
        self._serial.start()
        self._keyboard.start()
        send_ready()

        # Dedicated serial writer thread — drains queue, no lock contention
        threading.Thread(target=self._serial_writer_loop, daemon=True).start()

        # Stdin reader in background
        threading.Thread(target=self._command_loop, daemon=True).start()

        self._stop_event.wait()

    def stop(self):
        self._running = False
        self._keyboard.stop()
        self._serial.stop()
        self._ble.stop()
        self._send_queue.put(None)  # sentinel to unblock writer
        self._stop_event.set()

    def _serial_writer_loop(self):
        """Single thread that writes queued commands to serial."""
        while self._running:
            item = self._send_queue.get()
            if item is None:
                break
            data = item
            if self._serial.connected:
                self._serial.send(data)
            elif self._ble.connected:
                self._ble.send(data)

    def _on_key_state(self, cat_left: bool, cat_right: bool):
        """Called by KeyboardListener when paw state changes."""
        if cat_left != self._prev_cat_left:
            cmd = b"L" if cat_left else b"l"
            send_key("left", "down" if cat_left else "up")
            self._send_queue.put(cmd)
            self._prev_cat_left = cat_left

        if cat_right != self._prev_cat_right:
            cmd = b"R" if cat_right else b"r"
            send_key("right", "down" if cat_right else "up")
            self._send_queue.put(cmd)
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
        while self._running:
            cmd = read_command()
            if cmd is None:
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
