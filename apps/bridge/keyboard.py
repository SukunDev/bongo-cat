"""Keyboard listener with QWERTY left/right split and mirror mapping."""

from pynput import keyboard

# QWERTY keyboard halves
LEFT_HALF = set("qwertasdfgzxcvb12345`")
RIGHT_HALF = set("yuiophjkl;'nm,./67890-=[]\\")

# Mirror mapping: right-hand typing = cat's left paw (cat faces user)
CAT_LEFT_TRIGGERS = RIGHT_HALF
CAT_RIGHT_TRIGGERS = LEFT_HALF


class KeyboardListener:
    def __init__(self, on_state_change):
        """
        on_state_change(cat_left: bool, cat_right: bool) is called
        whenever the derived paw state changes.
        """
        self._on_state_change = on_state_change
        self._pressed = set()
        self._space_held = False
        self._prev_left = False
        self._prev_right = False
        self._listener = None

    def start(self):
        self._listener = keyboard.Listener(
            on_press=self._on_press,
            on_release=self._on_release,
        )
        self._listener.start()

    def stop(self):
        if self._listener:
            self._listener.stop()
            self._listener = None

    def _recompute(self):
        cat_left = self._space_held or any(
            c in CAT_LEFT_TRIGGERS for c in self._pressed
        )
        cat_right = self._space_held or any(
            c in CAT_RIGHT_TRIGGERS for c in self._pressed
        )
        if cat_left != self._prev_left or cat_right != self._prev_right:
            self._prev_left = cat_left
            self._prev_right = cat_right
            self._on_state_change(cat_left, cat_right)

    def _on_press(self, key):
        if key == keyboard.Key.space:
            self._space_held = True
        else:
            ch = getattr(key, "char", None)
            if ch:
                self._pressed.add(ch.lower())
        self._recompute()

    def _on_release(self, key):
        if key == keyboard.Key.space:
            self._space_held = False
        else:
            ch = getattr(key, "char", None)
            if ch:
                self._pressed.discard(ch.lower())
        self._recompute()
