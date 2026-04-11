"""
Bongo Cat keyboard → serial bridge.

Captures QWERTY key events on the host and streams L/l/R/r commands
to the ESP32-C3 over USB serial. Mapping is mirrored so that pressing
a key on the RIGHT half of the keyboard drives the cat's LEFT paw
(and vice versa), matching the cat facing the user.

Usage:
    pip install pyserial pynput
    python tools/bongo_keymap.py COM3

Press ESC to quit.
"""

import sys
import serial
from pynput import keyboard

# QWERTY keyboard halves (letters + top-row numbers)
LEFT_HALF = set("qwertasdfgzxcvb12345`")
RIGHT_HALF = set("yuiophjkl;'nm,./67890-=[]\\")

# Mirror mapping: keyboard side -> which cat paw it moves
# (cat faces the user, so right-hand typing = cat's left paw)
CAT_LEFT_TRIGGERS = RIGHT_HALF
CAT_RIGHT_TRIGGERS = LEFT_HALF

pressed_chars = set()
space_held = False
prev_cat_left = False
prev_cat_right = False
ser = None


def send(byte):
    ser.write(byte)
    ser.flush()


def recompute_and_send():
    global prev_cat_left, prev_cat_right

    cat_left = space_held or any(c in CAT_LEFT_TRIGGERS for c in pressed_chars)
    cat_right = space_held or any(c in CAT_RIGHT_TRIGGERS for c in pressed_chars)

    if cat_left != prev_cat_left:
        send(b"L" if cat_left else b"l")
        print(f"cat_left -> {'HIGH' if cat_left else 'LOW'}")
        prev_cat_left = cat_left

    if cat_right != prev_cat_right:
        send(b"R" if cat_right else b"r")
        print(f"cat_right -> {'HIGH' if cat_right else 'LOW'}")
        prev_cat_right = cat_right


def on_press(key):
    global space_held
    if key == keyboard.Key.space:
        space_held = True
    else:
        ch = getattr(key, "char", None)
        if ch:
            pressed_chars.add(ch.lower())
    recompute_and_send()


def on_release(key):
    global space_held
    if key == keyboard.Key.esc:
        return False  # stop listener
    if key == keyboard.Key.space:
        space_held = False
    else:
        ch = getattr(key, "char", None)
        if ch:
            pressed_chars.discard(ch.lower())
    recompute_and_send()


def main():
    global ser

    if len(sys.argv) < 2:
        print("Usage: python bongo_keymap.py <SERIAL_PORT>")
        print("Example: python bongo_keymap.py COM3")
        sys.exit(1)

    port = sys.argv[1]
    ser = serial.Serial(port, 115200, timeout=0.1)
    print(f"Connected to {port} @ 115200")
    print("Left keyboard half  -> cat RIGHT paw")
    print("Right keyboard half -> cat LEFT paw")
    print("Space               -> both paws")
    print("ESC                 -> quit\n")

    with keyboard.Listener(on_press=on_press, on_release=on_release) as listener:
        listener.join()

    ser.close()
    print("Closed.")


if __name__ == "__main__":
    main()
