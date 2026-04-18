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
