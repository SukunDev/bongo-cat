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
