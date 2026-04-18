"""Keyboard listener with QWERTY left/right split and mirror mapping.

Uses GetAsyncKeyState (Windows) for subprocess-safe key detection.
Falls back to pynput on non-Windows platforms.
"""

import os
import threading
import time

# QWERTY keyboard halves
LEFT_HALF = set("qwertasdfgzxcvb12345`")
RIGHT_HALF = set("yuiophjkl;'nm,./67890-=[]\\")

# Direct mapping: left-hand typing = left paw, right-hand = right paw
CAT_LEFT_TRIGGERS = LEFT_HALF
CAT_RIGHT_TRIGGERS = RIGHT_HALF

# Virtual key codes for special keys that trigger both paws
VK_SPACE = 0x20
VK_BOTH_PAWS = [
    VK_SPACE,   # Space
    0x0D,       # Enter
    0x08,       # Backspace
    0x2E,       # Delete
    0x09,       # Tab
    0x1B,       # Escape
]

# Virtual key codes for left-hand special keys (→ cat left paw)
VK_LEFT_SPECIAL = [
    0xA0,       # Left Shift
    0xA2,       # Left Ctrl
    0xA4,       # Left Alt
    0x5B,       # Left Win
    0x14,       # Caps Lock
]

# Virtual key codes for right-hand special keys (→ cat right paw)
VK_RIGHT_SPECIAL = [
    0xA1,       # Right Shift
    0xA3,       # Right Ctrl
    0xA5,       # Right Alt
    0x5C,       # Right Win
    0x26,       # Arrow Up
    0x28,       # Arrow Down
    0x25,       # Arrow Left
    0x27,       # Arrow Right
    0x21,       # Page Up
    0x22,       # Page Down
    0x24,       # Home
    0x23,       # End
    0x2D,       # Insert
]

# Virtual key code → character mapping for letter/digit/OEM keys
_VK_MAP = {}

def _build_vk_map():
    """Build VK code to character mapping."""
    for i, ch in enumerate("abcdefghijklmnopqrstuvwxyz"):
        _VK_MAP[0x41 + i] = ch
    for i, ch in enumerate("0123456789"):
        _VK_MAP[0x30 + i] = ch
    _VK_MAP[0xBA] = ";"   # VK_OEM_1
    _VK_MAP[0xBB] = "="   # VK_OEM_PLUS
    _VK_MAP[0xBC] = ","   # VK_OEM_COMMA
    _VK_MAP[0xBD] = "-"   # VK_OEM_MINUS
    _VK_MAP[0xBE] = "."   # VK_OEM_PERIOD
    _VK_MAP[0xBF] = "/"   # VK_OEM_2
    _VK_MAP[0xC0] = "`"   # VK_OEM_3
    _VK_MAP[0xDB] = "["   # VK_OEM_4
    _VK_MAP[0xDC] = "\\"  # VK_OEM_5
    _VK_MAP[0xDD] = "]"   # VK_OEM_6
    _VK_MAP[0xDE] = "'"   # VK_OEM_7

_build_vk_map()


class KeyboardListener:
    def __init__(self, on_state_change):
        """
        on_state_change(cat_left: bool, cat_right: bool) is called
        whenever the derived paw state changes.
        """
        self._on_state_change = on_state_change
        self._prev_left = False
        self._prev_right = False
        self._running = False
        self._thread = None

    def start(self):
        self._running = True
        if os.name == "nt":
            self._thread = threading.Thread(target=self._poll_loop_win, daemon=True)
            self._thread.start()
        else:
            self._start_pynput()

    def stop(self):
        self._running = False
        if self._thread:
            self._thread.join(timeout=2)
            self._thread = None

    def _poll_loop_win(self):
        """Poll GetAsyncKeyState for all mapped keys + space."""
        import ctypes
        user32 = ctypes.windll.user32
        winmm = ctypes.windll.winmm

        # Set Windows timer resolution to 1ms for precise sleeping
        winmm.timeBeginPeriod(1)

        # Pre-build list of (vk, is_left_trigger, is_right_trigger) for speed
        vk_list = []
        for vk, ch in _VK_MAP.items():
            vk_list.append((vk, ch in CAT_LEFT_TRIGGERS, ch in CAT_RIGHT_TRIGGERS))

        try:
            while self._running:
                both = any(user32.GetAsyncKeyState(vk) & 0x8000 for vk in VK_BOTH_PAWS)

                any_left = any(user32.GetAsyncKeyState(vk) & 0x8000 for vk in VK_LEFT_SPECIAL)
                any_right = any(user32.GetAsyncKeyState(vk) & 0x8000 for vk in VK_RIGHT_SPECIAL)

                for vk, is_left, is_right in vk_list:
                    if user32.GetAsyncKeyState(vk) & 0x8000:
                        any_left = any_left or is_left
                        any_right = any_right or is_right

                cat_left = both or any_left
                cat_right = both or any_right

                if cat_left != self._prev_left or cat_right != self._prev_right:
                    self._prev_left = cat_left
                    self._prev_right = cat_right
                    self._on_state_change(cat_left, cat_right)

                time.sleep(0.001)
        finally:
            winmm.timeEndPeriod(1)

    def _start_pynput(self):
        """Fallback for non-Windows: use pynput."""
        from pynput import keyboard

        pressed = set()
        space_held = False

        def recompute():
            nonlocal space_held
            cat_left = space_held or any(c in CAT_LEFT_TRIGGERS for c in pressed)
            cat_right = space_held or any(c in CAT_RIGHT_TRIGGERS for c in pressed)
            if cat_left != self._prev_left or cat_right != self._prev_right:
                self._prev_left = cat_left
                self._prev_right = cat_right
                self._on_state_change(cat_left, cat_right)

        def on_press(key):
            nonlocal space_held
            if key == keyboard.Key.space:
                space_held = True
            else:
                ch = getattr(key, "char", None)
                if ch:
                    pressed.add(ch.lower())
            recompute()

        def on_release(key):
            nonlocal space_held
            if key == keyboard.Key.space:
                space_held = False
            else:
                ch = getattr(key, "char", None)
                if ch:
                    pressed.discard(ch.lower())
            recompute()

        listener = keyboard.Listener(on_press=on_press, on_release=on_release)
        listener.start()
        self._thread = listener
