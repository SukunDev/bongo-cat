"""JSON lines stdio protocol for Electron <-> Bridge communication."""

import json
import sys


def send_event(event: dict) -> None:
    """Write a JSON line to stdout (Bridge -> Electron)."""
    line = json.dumps(event, separators=(",", ":"))
    sys.stdout.write(line + "\n")
    sys.stdout.flush()


def read_command() -> dict | None:
    """Read a JSON line from stdin (Electron -> Bridge).

    Returns None only on EOF. Ignores malformed (non-JSON) lines
    so that stray terminal input doesn't kill the bridge.
    """
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                return None  # EOF
            line = line.strip()
            if not line:
                continue  # blank line
            return json.loads(line)
        except json.JSONDecodeError:
            continue  # ignore non-JSON input
        except EOFError:
            return None


def send_status(connection: str, state: str, **extra) -> None:
    """Shorthand for status events."""
    send_event({"type": "status", "connection": connection, "state": state, **extra})


def send_key(side: str, action: str) -> None:
    """Shorthand for key events. side: 'left'|'right', action: 'down'|'up'."""
    send_event({"type": "key", "side": side, "action": action})


def send_error(message: str) -> None:
    """Shorthand for error events."""
    send_event({"type": "error", "message": message})


def send_ready() -> None:
    """Signal bridge is initialized and ready."""
    send_event({"type": "ready"})
