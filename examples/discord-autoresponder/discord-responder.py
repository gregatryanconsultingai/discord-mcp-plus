#!/usr/bin/env python3
"""
discord-responder.py — polls Discord every POLL_SECS, responds to @mentions via `claude -p`

Requires:
  - discord-mcp-plus running in HTTP mode (DISCORD_MCP_TRANSPORT=http)
  - Claude Code CLI installed (`claude` on PATH)

Usage:
  cp .env.example .env   # fill in your values
  pip install python-dotenv  # optional — or just export the vars manually
  python discord-responder.py

Stop: Ctrl+C, or delete discord-responder.pid
"""

import json
import os
import signal
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

# ── Force UTF-8 for all I/O on Windows (handles emoji and non-ASCII) ──────────
os.environ.setdefault("PYTHONUTF8", "1")
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ── Optional: load .env from the same directory ───────────────────────────────
_env_file = Path(__file__).parent / ".env"
if _env_file.exists():
    for _line in _env_file.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _v = _line.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip())

# ── Config ─────────────────────────────────────────────────────────────────────
CHANNEL_ID    = os.environ["DISCORD_CHANNEL_ID"]       # channel to watch
BOT_ID        = os.environ["DISCORD_BOT_ID"]           # bot's Discord user ID
BOT_USERNAME  = os.environ.get("DISCORD_BOT_USERNAME", "")  # to filter own messages
MCP_URL       = os.environ.get("MCP_URL", "http://localhost:3000/mcp")
MCP_TOKEN     = os.environ.get("MCP_TOKEN", "")
POLL_SECS     = int(os.environ.get("POLL_SECS", "10"))
BOT_PROMPT    = os.environ.get(
    "BOT_PROMPT",
    "You are a witty and self-aware Discord bot connected to Discord via MCP. "
    "Keep replies conversational, clever, and punchy — 1-2 sentences max. "
    "No hashtags, no emoji overload.",
)

BASE_DIR   = Path(__file__).parent
STATE_FILE = BASE_DIR / "discord-responder-state.json"
LOG_FILE   = BASE_DIR / "discord-responder.log"
PID_FILE   = BASE_DIR / "discord-responder.pid"

# ── MCP session (initialized lazily, auto-recovered on failure) ───────────────
_session: str | None = None


# ── Logging ───────────────────────────────────────────────────────────────────

def log(msg: str) -> None:
    line = f"[{datetime.now().strftime('%H:%M:%S')}] {msg}"
    try:
        print(line, flush=True)
    except UnicodeEncodeError:
        print(line.encode("utf-8", errors="replace").decode("ascii", errors="replace"), flush=True)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")


# ── MCP transport ─────────────────────────────────────────────────────────────

def _curl(payload: str, session_id: str | None = None) -> bytes:
    """POST payload to the MCP server, return raw response bytes (headers + body)."""
    headers = [
        "-H", f"Authorization: Bearer {MCP_TOKEN}",
        "-H", "Content-Type: application/json",
        "-H", "Accept: application/json, text/event-stream",
    ]
    if session_id:
        headers += ["-H", f"mcp-session-id: {session_id}"]
    result = subprocess.run(
        ["curl", "-s", "-D", "-", "-X", "POST", MCP_URL]
        + headers
        + ["-d", payload, "--max-time", "10"],
        capture_output=True, timeout=12,
    )
    return result.stdout


def init_session() -> bool:
    """
    Initialize a fresh MCP session.
    Works after an MCP server restart; fails gracefully if already initialized.
    """
    global _session
    payload = json.dumps({
        "jsonrpc": "2.0", "method": "initialize", "id": 1,
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "discord-autoresponder", "version": "1.0"},
        },
    })
    raw = _curl(payload)
    text = raw.decode("utf-8", errors="replace")

    new_session = None
    for line in text.splitlines():
        if line.lower().startswith("mcp-session-id:"):
            new_session = line.split(":", 1)[1].strip()
            break

    if not new_session:
        log(f"session init failed: {text[:200]}")
        return False

    _session = new_session

    # Complete the handshake
    notif = json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"})
    _curl(notif, session_id=_session)

    log(f"session initialized: {_session[:8]}...")
    return True


def mcp_call(tool: str, args: dict, _retry: bool = True):
    """Call an MCP tool. Auto-initializes / recovers the session as needed."""
    global _session

    if not _session:
        if not init_session():
            return None

    payload = json.dumps({
        "jsonrpc": "2.0", "method": "tools/call", "id": 1,
        "params": {"name": tool, "arguments": args},
    })
    raw = _curl(payload, session_id=_session)
    text = raw.decode("utf-8", errors="replace")

    got_data = False
    for line in text.splitlines():
        if line.startswith("data: "):
            got_data = True
            try:
                parsed = json.loads(line[6:])
                if "error" in parsed:
                    log(f"mcp error: {parsed['error']}")
                    if _retry:
                        log("retrying with fresh session...")
                        _session = None
                        return mcp_call(tool, args, _retry=False)
                    return None
                return json.loads(parsed["result"]["content"][0]["text"])
            except (KeyError, json.JSONDecodeError) as e:
                log(f"mcp parse error: {e} — raw: {line[:120]}")

    if not got_data and _retry:
        log("no response data — session may be stale, attempting recovery")
        _session = None
        return mcp_call(tool, args, _retry=False)

    return None


# ── State ─────────────────────────────────────────────────────────────────────

def load_state() -> dict:
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"lastSeenId": "0"}


def save_state(state: dict) -> None:
    STATE_FILE.write_text(json.dumps(state), encoding="utf-8")


# ── Response generation ───────────────────────────────────────────────────────

def generate_response(author: str, content: str) -> str:
    if not content or not content.strip():
        return ""

    prompt = f"{BOT_PROMPT} Respond naturally to this message from {author}: {content}"

    # Strip CLAUDECODE so nested invocation is allowed
    env = {k: v for k, v in os.environ.items() if not k.startswith("CLAUDECODE")}

    result = subprocess.run(
        ["claude", "-p", prompt],
        capture_output=True, encoding="utf-8", errors="replace", timeout=30,
        cwd=str(BASE_DIR.parent.parent),  # project root
        env=env,
    )

    # Strip session-logger preamble lines that claude outputs before the actual response
    lines = result.stdout.splitlines()
    lines = [l for l in lines
             if not l.startswith("Session logging")
             and not l.startswith("Logging active")]
    while lines and lines[0].strip() in ("", "---"):
        lines.pop(0)

    return "\n".join(lines).strip()


# ── Poll loop ─────────────────────────────────────────────────────────────────

def poll() -> None:
    state = load_state()
    last_seen = state.get("lastSeenId", "0")

    msgs = mcp_call("get_messages", {"channelId": CHANNEL_ID, "limit": 10})
    if not msgs:
        return

    state["lastSeenId"] = msgs[0]["id"]

    new_mentions = [
        m for m in reversed(msgs)
        if m["id"] > last_seen
        and m.get("content")
        and f"<@{BOT_ID}>" in m["content"]
        and m["author"]["username"] != BOT_USERNAME
    ]

    for msg in new_mentions:
        author  = msg["author"]["username"]
        content = msg["content"]
        log(f"@mention from {author}: {content}")

        response = generate_response(author, content)
        if not response:
            log("skipping — empty response")
            continue

        log(f"sending: {response}")
        mcp_call("send_message", {"channelId": CHANNEL_ID, "content": response})
        log("sent.")

    save_state(state)


# ── Entrypoint ────────────────────────────────────────────────────────────────

def cleanup(signum=None, frame=None) -> None:
    log("shutting down.")
    PID_FILE.unlink(missing_ok=True)
    sys.exit(0)


if __name__ == "__main__":
    PID_FILE.write_text(str(os.getpid()))

    signal.signal(signal.SIGINT,  cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    log(f"discord-responder started (pid={os.getpid()}, polling every {POLL_SECS}s)")

    while True:
        try:
            poll()
        except Exception as e:
            log(f"error: {e}")
        time.sleep(POLL_SECS)
