# Over the Moon — High Score System Implementation Guide

**Target game:** `GeoDuckedup/JumpOvertheMoon` (the `cat-sword-climb/` Pygame + pygbag app)
**Pattern reference:** Bartender v1.1 addendum — Firebase Realtime Database leaderboard, pygbag-compatible, additive architecture, font bundling.
**Score metric:** `best_height` in meters (already tracked in `game.py` as `self.best_height`).
**Storage:** Firebase Realtime Database project `over-the-moon-14b50`, default RTDB.

This document is written for a coding AI agent. Follow phases in order. Each phase is self-contained and can be tested independently. Do not skip the smoke tests — they catch the pygbag-specific failure modes that will not show up in local desktop testing.

---

## Architecture overview

The Bartender v1.1 leaderboard pattern this guide ports forward has four design rules. They are non-negotiable here too because pygbag (pyodide) has stricter constraints than CPython:

1. **No `requests`, no `firebase-admin`, no `pyrebase`.** These either don't install in pyodide or assume blocking sockets that hang the WASM event loop. Use `platform.fopen` on web, `urllib.request` on desktop. Both speak HTTP — that is all we need because the Firebase Realtime Database REST API is just `.json` URLs.
2. **All network calls are async and non-blocking.** The pygame frame loop must keep running while we wait on Firebase. If a fetch takes 800ms, the game still renders at 60 FPS — the leaderboard panel just shows "Loading…" until the response arrives.
3. **Network failure is silent and recoverable.** Submissions queue locally; the local-best is always shown immediately; the global leaderboard is a bonus when reachable.
4. **Bundled fonts only.** `pygame.font.SysFont` works inconsistently in pygbag. The name-entry overlay must use a font already loaded by the game, OR a bundled `.ttf` in `assets/`. Looking at the existing code, `self.font` / `self.big_font` / `self.small_font` already use `SysFont("arial", ...)` — those work because pygbag ships an Arial fallback. **Reuse those font handles; do not create new ones.**

### New module layout

```
cat-sword-climb/
├── constants.py          (edit: add highscore tuning constants)
├── entities.py           (no changes)
├── game.py               (edit: hook submit + name entry + leaderboard state)
├── renderer.py           (edit: draw name-entry overlay + leaderboard panel)
├── highscore.py          (NEW: Firebase client, local cache, async submit)
├── name_entry.py         (NEW: 3-char arcade-style entry state machine)
└── main.py               (no changes)
```

Keep `highscore.py` and `name_entry.py` completely self-contained. They must not import from `game.py` or `renderer.py`. `game.py` owns the orchestration; the new modules own the mechanics. This is the "strictly additive" pattern from Bartender — if you delete the two new files and revert the small edits in `game.py` and `renderer.py`, the game still runs.

---

## Phase 1 — Firebase setup (one-time, manual)

Before any code changes, the developer must configure the database. Document these steps in `cat-sword-climb/README.md` under a new "High Scores" section.

### 1.1 — Resolve the REST endpoint URL

The console URL `https://console.firebase4.google.com/project/over-the-moon-14b50/database/over-the-moon-14b50-default-rtdb/data/~2F` tells us:

- Project ID: `over-the-moon-14b50`
- Database name: `over-the-moon-14b50-default-rtdb`

The REST base URL is one of:

- `https://over-the-moon-14b50-default-rtdb.firebaseio.com` (US region default)
- `https://over-the-moon-14b50-default-rtdb.<region>.firebasedatabase.app` (other regions)

Open the Firebase console, click the Realtime Database tab, and copy the URL shown at the top of the data view. That exact string (no trailing slash) is what goes into `highscore.py` as `FIREBASE_DB_URL`.

### 1.2 — Open security rules (game-only, no PII)

In the Realtime Database → Rules tab, set:

```json
{
  "rules": {
    "jumpoverthemoon": {
      "scores": {
        ".read": true,
        ".write": true,
        ".indexOn": ["score"],
        "$entry": {
          ".validate": "newData.hasChildren(['name', 'score', 'timestamp'])",
          "name": { ".validate": "newData.isString() && newData.val().length <= 8" },
          "score": { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 999999" },
          "timestamp": { ".validate": "newData.isNumber()" }
        }
      }
    }
  }
}
```

Three things this does:

- **Scopes the rules to `/jumpoverthemoon/scores`** so the same Firebase project can host other games later (Tapper, Hanafuda, etc.) under their own keys.
- **`.indexOn: ["score"]`** enables `orderBy="score"` queries server-side. Without this, Firebase returns the leaderboard in random key-order.
- **`.validate` schema** bounds what bad actors can write. It does not prevent cheating (open rules never can), but it prevents someone from writing a 50MB blob or a string in the score field that would break the client.

If the project will host multiple games, add sibling keys (`/bartender/scores`, etc.) with identical rule blocks. The same Firebase free tier easily holds millions of small score records.

### 1.3 — Anti-abuse note

Because the database is open-write, the leaderboard is on the honor system. This is acceptable for an arcade hobby project. If cheating becomes a real problem later, the upgrade path is App Check + Cloud Function for writes, but **do not implement that in this phase**. It would require build-time auth tokens that complicate the pygbag deploy. Ship the simple version first.

---

## Phase 2 — `highscore.py` module

Create `cat-sword-climb/highscore.py` exactly as specified. This module is the single source of truth for all Firebase I/O and local caching.

### 2.1 — Module responsibilities

- Detect whether we are running in pygbag (web) or CPython (desktop) and pick the right HTTP backend.
- Async-fetch the top-N leaderboard from Firebase.
- Async-submit a new score.
- Maintain a local best in browser localStorage (web) or a JSON file (desktop) so the game always has a score to show, even offline.
- Expose a plain, synchronous-looking API to `game.py` (`HighScoreService.refresh()`, `.submit(name, score)`, `.top_scores`, `.local_best`, `.status`).

### 2.2 — Full implementation

```python
"""Firebase Realtime Database leaderboard for Over the Moon.

This module is pygbag-compatible: it uses platform.fopen on the web (pyodide's
async fetch wrapper) and urllib.request on desktop. No third-party deps.

Network calls are launched as asyncio tasks from the game's main async loop.
The game NEVER awaits them inline — it polls .status and .top_scores once per
frame, which is cheap (a list reference compare).
"""

from __future__ import annotations

import asyncio
import json
import sys
import time
from pathlib import Path

# ---------------------------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------------------------

# Set this to the REST URL shown at the top of the Firebase Realtime Database
# console. No trailing slash.
FIREBASE_DB_URL = "https://over-the-moon-14b50-default-rtdb.firebaseio.com"

# All score data lives under this path so the same project can host other
# games under sibling keys later.
SCORES_PATH = "/jumpoverthemoon/scores"

# How many entries to fetch + display.
LEADERBOARD_SIZE = 10

# How long to wait between auto-refreshes of the leaderboard, in seconds.
# A fresh fetch is triggered by reaching the game-over screen, so this is
# only the background poll cadence.
REFRESH_INTERVAL = 30.0

# Local cache location (desktop only; on web we use localStorage).
LOCAL_CACHE_FILENAME = "highscore_cache.json"


# ---------------------------------------------------------------------------
# PLATFORM DETECTION
# ---------------------------------------------------------------------------

IS_WEB = sys.platform == "emscripten"


# ---------------------------------------------------------------------------
# HTTP TRANSPORT
# ---------------------------------------------------------------------------

async def _http_request(method: str, url: str, body: dict | None = None) -> dict | list | None:
    """Single async HTTP entry point. Returns parsed JSON, or None on failure."""
    if IS_WEB:
        return await _http_request_web(method, url, body)
    return await _http_request_desktop(method, url, body)


async def _http_request_web(method, url, body):
    """Pygbag/pyodide path. Uses platform.fopen which is async and CORS-aware."""
    import platform  # pygbag-provided module
    try:
        body_bytes = json.dumps(body).encode("utf-8") if body is not None else None
        # platform.fopen accepts a method and a body kwarg; the exact signature
        # is stable across pygbag 0.9.x.
        async with platform.fopen(
            url,
            "rb",
            method=method,
            body=body_bytes,
            headers={"Content-Type": "application/json"},
        ) as response:
            raw = await response.read() if hasattr(response, "read") else response.read()
        if isinstance(raw, (bytes, bytearray)):
            raw = raw.decode("utf-8")
        if not raw:
            return None
        return json.loads(raw)
    except Exception as exc:
        print(f"[highscore] web http error: {exc}")
        return None


async def _http_request_desktop(method, url, body):
    """Desktop path. urllib.request blocks, so wrap it in run_in_executor."""
    import urllib.request

    def _blocking():
        data = json.dumps(body).encode("utf-8") if body is not None else None
        req = urllib.request.Request(
            url,
            data=data,
            method=method,
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=4.0) as response:
                raw = response.read().decode("utf-8")
        except Exception as exc:
            print(f"[highscore] desktop http error: {exc}")
            return None
        if not raw:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return None

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _blocking)


# ---------------------------------------------------------------------------
# LOCAL CACHE
# ---------------------------------------------------------------------------

class _LocalCache:
    """Stores the player's personal best across sessions.

    Web: browser localStorage (survives reload, scoped to the page origin).
    Desktop: JSON file next to the game.
    """

    KEY = "jumpoverthemoon_local_best"

    def __init__(self, base_dir: Path):
        self.base_dir = base_dir

    def load(self) -> dict:
        if IS_WEB:
            try:
                import platform
                raw = platform.window.localStorage.getItem(self.KEY)
                if raw:
                    return json.loads(str(raw))
            except Exception:
                pass
            return {}
        path = self.base_dir / LOCAL_CACHE_FILENAME
        if not path.exists():
            return {}
        try:
            return json.loads(path.read_text())
        except Exception:
            return {}

    def save(self, data: dict) -> None:
        payload = json.dumps(data)
        if IS_WEB:
            try:
                import platform
                platform.window.localStorage.setItem(self.KEY, payload)
            except Exception:
                pass
            return
        path = self.base_dir / LOCAL_CACHE_FILENAME
        try:
            path.write_text(payload)
        except Exception:
            pass


# ---------------------------------------------------------------------------
# SERVICE
# ---------------------------------------------------------------------------

class HighScoreService:
    """Owns all leaderboard state. One instance, held by Game."""

    STATUS_IDLE = "idle"
    STATUS_LOADING = "loading"
    STATUS_READY = "ready"
    STATUS_SUBMITTING = "submitting"
    STATUS_SUBMITTED = "submitted"
    STATUS_ERROR = "error"

    def __init__(self, base_dir: Path):
        self._cache = _LocalCache(base_dir)
        cached = self._cache.load()
        self.local_best: int = int(cached.get("best", 0))
        self.local_name: str = str(cached.get("name", "AAA"))[:8]
        self.top_scores: list[dict] = []
        self.status: str = self.STATUS_IDLE
        self.last_refresh: float = 0.0
        self._pending_submits: list[dict] = list(cached.get("pending", []))
        # Tasks tracked so we don't fire-and-forget without a handle.
        self._refresh_task: asyncio.Task | None = None
        self._submit_task: asyncio.Task | None = None

    # ----- Public API ------------------------------------------------------

    def is_new_local_best(self, score: int) -> bool:
        return score > self.local_best

    def request_refresh(self, force: bool = False) -> None:
        """Non-blocking. Schedules a leaderboard fetch if one isn't running."""
        now = time.monotonic()
        if not force and (now - self.last_refresh) < REFRESH_INTERVAL:
            return
        if self._refresh_task and not self._refresh_task.done():
            return
        self._refresh_task = asyncio.ensure_future(self._refresh_async())

    def submit(self, name: str, score: int) -> None:
        """Non-blocking. Queues a submission and persists it locally first."""
        name = self._sanitize_name(name)
        score = max(0, int(score))

        # Update local best immediately, regardless of network.
        if score > self.local_best:
            self.local_best = score
            self.local_name = name

        entry = {"name": name, "score": score, "timestamp": int(time.time() * 1000)}
        self._pending_submits.append(entry)
        self._persist_local()

        if self._submit_task and not self._submit_task.done():
            return
        self._submit_task = asyncio.ensure_future(self._drain_submits())

    def tick(self) -> None:
        """Call once per frame from Game.update(). Drives background refresh."""
        if self.status in (self.STATUS_IDLE, self.STATUS_READY) and (
            time.monotonic() - self.last_refresh > REFRESH_INTERVAL
        ):
            self.request_refresh()

    # ----- Internals -------------------------------------------------------

    def _persist_local(self) -> None:
        self._cache.save({
            "best": self.local_best,
            "name": self.local_name,
            "pending": self._pending_submits[-20:],  # cap queue
        })

    @staticmethod
    def _sanitize_name(name: str) -> str:
        name = "".join(c for c in name.upper() if c.isalnum())
        return (name or "AAA")[:8]

    async def _refresh_async(self) -> None:
        self.status = self.STATUS_LOADING
        # Firebase REST: orderBy + limitToLast returns the highest N scores.
        # The response is an object keyed by Firebase push-id, NOT sorted.
        # We sort client-side after parsing.
        url = (
            f"{FIREBASE_DB_URL}{SCORES_PATH}.json"
            f'?orderBy="score"&limitToLast={LEADERBOARD_SIZE}'
        )
        data = await _http_request("GET", url)
        if data is None or not isinstance(data, dict):
            self.status = self.STATUS_ERROR if data is None else self.STATUS_READY
            self.last_refresh = time.monotonic()
            if isinstance(data, dict):
                self.top_scores = []
            return
        entries = []
        for value in data.values():
            if not isinstance(value, dict):
                continue
            try:
                entries.append({
                    "name": str(value.get("name", "???"))[:8],
                    "score": int(value.get("score", 0)),
                    "timestamp": int(value.get("timestamp", 0)),
                })
            except (TypeError, ValueError):
                continue
        entries.sort(key=lambda e: e["score"], reverse=True)
        self.top_scores = entries[:LEADERBOARD_SIZE]
        self.status = self.STATUS_READY
        self.last_refresh = time.monotonic()

    async def _drain_submits(self) -> None:
        """Sends all queued submissions one at a time. Survives partial failure."""
        while self._pending_submits:
            self.status = self.STATUS_SUBMITTING
            entry = self._pending_submits[0]
            url = f"{FIREBASE_DB_URL}{SCORES_PATH}.json"
            result = await _http_request("POST", url, entry)
            if result is None:
                # Network down or rejected. Stop draining; we'll retry next session.
                self.status = self.STATUS_ERROR
                self._persist_local()
                return
            # Success: pop from queue.
            self._pending_submits.pop(0)
            self._persist_local()
        self.status = self.STATUS_SUBMITTED
        # Pull the fresh leaderboard so the player sees their entry.
        await self._refresh_async()
```

### 2.3 — Smoke tests for Phase 2

Before wiring anything else, verify `highscore.py` works in isolation. Add a temporary test at the bottom of the file, run once, then remove:

```python
if __name__ == "__main__":
    async def _test():
        svc = HighScoreService(Path(__file__).parent)
        svc.request_refresh(force=True)
        await asyncio.sleep(2.0)
        print("status:", svc.status)
        print("top_scores:", svc.top_scores)
        svc.submit("TEST", 42)
        await asyncio.sleep(2.0)
        print("after submit status:", svc.status)
        print("after submit top_scores:", svc.top_scores)
    asyncio.run(_test())
```

Run with `python3 highscore.py`. Expected output:

- First `status: ready` with `top_scores: []` (empty database).
- After submit, `top_scores` contains one entry with `name: 'TEST', score: 42`.

If you see `status: error`, the FIREBASE_DB_URL is wrong or the security rules block writes. Re-check Phase 1.

---

## Phase 3 — `name_entry.py` module

Arcade-style 3-character name entry, mobile- and keyboard-friendly. Stays a pure state machine; renderer.py owns the visuals.

### 3.1 — Design constraints

- **3 characters, A-Z + 0-9.** Bartender used the same length. Keeps the leaderboard rows visually consistent and prevents abuse.
- **Same input mechanism on mobile and desktop.** Both platforms use directional input to scroll the current letter and an "action" press to confirm. No touch keyboard, no text input field — both fight the canvas and break in pygbag.
- **Auto-fill from last used name.** First entry of a session shows the player's previous name (from localStorage). If they hit confirm three times without changing anything, they re-submit under the same handle. That is the desired arcade behavior.

### 3.2 — Full implementation

```python
"""Three-character arcade name entry state machine.

Inputs (Game.handle_events translates to these):
    cycle_letter(delta=+1 or -1)   left/right or tap arrows
    advance()                       confirm current letter, move to next slot
    backspace()                     move to previous slot (optional)

Outputs:
    .name              current 3-char string
    .slot              0..2, which slot is active
    .done              True once all 3 slots confirmed
"""

ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
NAME_LENGTH = 3


class NameEntry:
    def __init__(self, initial: str = "AAA"):
        # Normalize: only allowed chars, padded with A, length NAME_LENGTH.
        cleaned = "".join(c for c in initial.upper() if c in ALPHABET)
        cleaned = (cleaned + "A" * NAME_LENGTH)[:NAME_LENGTH]
        self.letters = [ALPHABET.index(c) for c in cleaned]
        self.slot = 0
        self.done = False

    @property
    def name(self) -> str:
        return "".join(ALPHABET[i] for i in self.letters)

    def cycle_letter(self, delta: int) -> None:
        if self.done:
            return
        self.letters[self.slot] = (self.letters[self.slot] + delta) % len(ALPHABET)

    def advance(self) -> None:
        if self.done:
            return
        if self.slot < NAME_LENGTH - 1:
            self.slot += 1
        else:
            self.done = True

    def backspace(self) -> None:
        if self.done:
            return
        if self.slot > 0:
            self.slot -= 1
```

That's the entire module. No imports beyond stdlib, no pygame coupling.

---

## Phase 4 — Hooks in `game.py`

This is where the orchestration lives. The edits are surgical and additive. Do not refactor unrelated code while you are in this file.

### 4.1 — New state in `Game.__init__`

After the existing `self.reset()` line, add:

```python
        # ----- High score / leaderboard state ---------------------------
        from pathlib import Path
        from highscore import HighScoreService
        from name_entry import NameEntry, NAME_LENGTH
        self.NameEntry = NameEntry          # store class for later instantiation
        self.NAME_LENGTH = NAME_LENGTH
        self.highscore_service = HighScoreService(Path(__file__).parent)
        self.highscore_service.request_refresh(force=True)
        # Per-run name entry state. Reset on each new run.
        self.name_entry: NameEntry | None = None
        self.name_entry_submitted = False
```

Imports at the top of file would be cleaner, but inlining them inside `__init__` keeps the diff localized and avoids import-order surprises if anyone later reorganizes module load. After this guide is shipped, the imports can be moved up.

### 4.2 — New phase variable: `awaiting_name_entry`

Add a single piece of derived state. **Do not** add a new `game_state` enum yet — keep things flat and predictable.

After `self.has_popped_balloon = False` in `reset()`, add:

```python
        self.name_entry = None
        self.name_entry_submitted = False
```

### 4.3 — Trigger name entry on game over

Locate this block in `game.py`'s `update()` method (currently around line 533):

```python
        if self.has_popped_balloon and self.player.on_ground and self.player_on_world_floor():
            self.game_over = True
```

Change it to:

```python
        if self.has_popped_balloon and self.player.on_ground and self.player_on_world_floor():
            if not self.game_over:
                self._enter_game_over()
            self.game_over = True
```

And add this new method on `Game`, near `reset()`:

```python
    def _enter_game_over(self):
        """Called once at the moment of game over. Initializes name entry
        if the player scored a new local best, otherwise auto-submits silently
        and refreshes the leaderboard."""
        final_score = self.best_height
        self.highscore_service.request_refresh(force=True)
        if self.highscore_service.is_new_local_best(final_score):
            self.name_entry = self.NameEntry(self.highscore_service.local_name)
            self.name_entry_submitted = False
        else:
            # Not a personal best — still submit, but skip name entry.
            self.highscore_service.submit(self.highscore_service.local_name, final_score)
            self.name_entry_submitted = True
```

### 4.4 — Background refresh tick

In `Game.update()`, at the very top (before any other logic), add:

```python
        self.highscore_service.tick()
```

This is cheap (one timestamp comparison most frames) and ensures the leaderboard stays fresh during long play sessions.

### 4.5 — Input wiring

The existing `handle_events()` method already maps keyboard and touch to two abstract actions: directional movement and the action button. We need to extend this for name entry without breaking the existing R-to-restart and tap-to-restart flows.

#### 4.5.1 — Keyboard

Inside `handle_events()`, find the `elif event.type == pygame.KEYDOWN:` branch. Add this block **after** the existing `K_ESCAPE` check but **before** the `K_SPACE` / `K_R` checks. The key behavior: when name entry is active, arrow keys cycle letters and space confirms.

```python
                # Name entry intercepts arrows + space during game over.
                if self.game_over and self.name_entry and not self.name_entry.done:
                    if event.key == pygame.K_LEFT:
                        self.name_entry.cycle_letter(-1)
                        continue
                    if event.key == pygame.K_RIGHT:
                        self.name_entry.cycle_letter(1)
                        continue
                    if event.key == pygame.K_UP:
                        self.name_entry.cycle_letter(1)
                        continue
                    if event.key == pygame.K_DOWN:
                        self.name_entry.cycle_letter(-1)
                        continue
                    if event.key in (pygame.K_SPACE, pygame.K_RETURN):
                        self.name_entry.advance()
                        if self.name_entry.done and not self.name_entry_submitted:
                            self.highscore_service.submit(self.name_entry.name, self.best_height)
                            self.name_entry_submitted = True
                        continue
                    if event.key == pygame.K_BACKSPACE:
                        self.name_entry.backspace()
                        continue
                    # While entering name, R does NOT restart.
                    if event.key == pygame.K_r:
                        continue
```

(Use `continue` here only if you are inside a `for event in pygame.event.get()` loop, which you are. Confirm by re-reading the surrounding indentation.)

#### 4.5.2 — Mobile

The existing `perform_action_button()` already handles "tap action to restart on game over". We need it to do four different things now, depending on state:

```python
    def perform_action_button(self):
        if self.game_over:
            # Name entry active: action confirms current letter.
            if self.name_entry and not self.name_entry.done:
                self.name_entry.advance()
                if self.name_entry.done and not self.name_entry_submitted:
                    self.highscore_service.submit(self.name_entry.name, self.best_height)
                    self.name_entry_submitted = True
                return
            # Name entry done OR not needed: action restarts the run.
            self.suppress_mobile_action()
            self.suppress_synthetic_mouse()
            self.reset()
            return

        if self.player.on_ground:
            self.player.jump()
        else:
            self.player.start_slash()
```

Replace the existing `perform_action_button` with this version. The keyboard `K_R` restart path is unchanged because the new keyboard handler above already blocks `R` during name entry but allows it after.

For mobile letter cycling, repurpose the on-screen left/right arrows during name entry. In `update()`, the existing code reads `self.touch_direction()` every frame for player movement. We do **not** want that — it would cycle the letter 60 times per second. Instead, we want a tap to cycle once.

The cleanest approach is to detect the *edge* (a new finger press on left/right). The simplest implementation: add this to `press_mobile_control`, immediately after `self.mobile_control_pointers[pointer_id] = control` and before the action-button branch:

```python
        if self.game_over and self.name_entry and not self.name_entry.done:
            if control == "left":
                self.name_entry.cycle_letter(-1)
            elif control == "right":
                self.name_entry.cycle_letter(1)
            return True
```

Place this **before** the existing `if trigger_action and control == "action":` block, so directional taps during name entry are consumed before the function falls through to the action-button logic.

### 4.6 — Disable player movement during name entry

In `update()`, the existing code calls `self.player.update(dt, keys, self.speed_multiplier, self.touch_direction())` even after game over (no it doesn't — but verify). Currently the game-over block early-returns at the top of `update()`. Good. However, with name entry active, `touch_direction()` would be polled every frame as part of letter cycling — we addressed that by routing through `press_mobile_control` only. No further change needed here. Run the smoke test in Phase 6 to confirm.

---

## Phase 5 — `renderer.py` changes

The renderer is currently a single `draw_hud` method that conditionally draws the game-over overlay. We extend it. Three new drawing routines, one modified call signature.

### 5.1 — Updated `draw_hud` signature

Add three new parameters: `name_entry`, `name_entry_submitted`, `highscore_service`. Pass them through from `Game.draw()`.

In `game.py`'s `draw()` method, update the `self.renderer.draw(...)` call to include:

```python
            name_entry=self.name_entry,
            name_entry_submitted=self.name_entry_submitted,
            highscore_service=self.highscore_service,
```

In `renderer.py`'s `draw()` method signature and `draw_hud()` signature (whichever currently handles the call — based on the codebase it appears `Renderer.draw` is the entry), add the same three parameters with `=None` defaults so the change is backward-compatible.

### 5.2 — Replace the game-over overlay

Find this block in `renderer.py`:

```python
        if game_over:
            overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
            overlay.fill((14, 15, 22, 170))
            self.screen.blit(overlay, (0, 0))
            title = self.big_font.render("FALLEN", True, WHITE)
            score = self.font.render(f"best height: {best_height}m", True, WHITE)
            retry_label = "tap action to climb again" if mobile_controls_visible else "press R to climb again"
            retry = self.font.render(retry_label, True, (255, 219, 116))
            self.screen.blit(title, title.get_rect(center=(WIDTH // 2, HEIGHT // 2 - 56)))
            self.screen.blit(score, score.get_rect(center=(WIDTH // 2, HEIGHT // 2 + 2)))
            self.screen.blit(retry, retry.get_rect(center=(WIDTH // 2, HEIGHT // 2 + 42)))
```

Replace it with a dispatcher:

```python
        if game_over:
            overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
            overlay.fill((14, 15, 22, 200))
            self.screen.blit(overlay, (0, 0))
            self.draw_game_over_panel(
                best_height=best_height,
                name_entry=name_entry,
                name_entry_submitted=name_entry_submitted,
                highscore_service=highscore_service,
                mobile_controls_visible=mobile_controls_visible,
            )
```

### 5.3 — New: `draw_game_over_panel`

Add this method on `Renderer`:

```python
    def draw_game_over_panel(
        self,
        best_height,
        name_entry,
        name_entry_submitted,
        highscore_service,
        mobile_controls_visible,
    ):
        # Layout regions: title at top, score below, name-entry OR
        # leaderboard in middle, restart prompt at bottom.
        cx = WIDTH // 2

        # ----- Title -----
        title = self.big_font.render("FALLEN", True, WHITE)
        self.screen.blit(title, title.get_rect(center=(cx, 90)))

        # ----- This run's score -----
        score_label = self.font.render(f"height: {best_height}m", True, WHITE)
        self.screen.blit(score_label, score_label.get_rect(center=(cx, 142)))

        # ----- Middle region -----
        if name_entry and not name_entry.done:
            self.draw_name_entry(name_entry, mobile_controls_visible)
        else:
            self.draw_leaderboard_panel(highscore_service, best_height)

        # ----- Restart prompt at bottom -----
        # Only show once name entry is finished (or wasn't needed).
        if not name_entry or name_entry.done:
            if mobile_controls_visible:
                prompt = "tap action to climb again"
            else:
                prompt = "press R to climb again"
            retry = self.font.render(prompt, True, (255, 219, 116))
            self.screen.blit(retry, retry.get_rect(center=(cx, HEIGHT - 60)))

    def draw_name_entry(self, name_entry, mobile_controls_visible):
        cx = WIDTH // 2
        prompt = self.font.render("NEW PERSONAL BEST", True, (255, 219, 116))
        self.screen.blit(prompt, prompt.get_rect(center=(cx, 200)))

        instruction_text = (
            "tap arrows: change   tap action: confirm"
            if mobile_controls_visible
            else "arrows: change   space: confirm"
        )
        instruction = self.small_font.render(instruction_text, True, (210, 222, 230))
        self.screen.blit(instruction, instruction.get_rect(center=(cx, 230)))

        # Three big letter slots, centered.
        slot_width = 56
        slot_gap = 18
        total = 3 * slot_width + 2 * slot_gap
        start_x = cx - total // 2
        slot_y = 280
        for i, letter_index in enumerate(name_entry.letters):
            from name_entry import ALPHABET
            letter = ALPHABET[letter_index]
            slot_x = start_x + i * (slot_width + slot_gap)
            slot_rect = pygame.Rect(slot_x, slot_y, slot_width, slot_width)
            color = (255, 219, 116) if i == name_entry.slot else (90, 110, 130)
            pygame.draw.rect(self.screen, color, slot_rect, width=3, border_radius=8)
            glyph = self.big_font.render(letter, True, WHITE)
            self.screen.blit(glyph, glyph.get_rect(center=slot_rect.center))

    def draw_leaderboard_panel(self, highscore_service, best_height):
        cx = WIDTH // 2
        header = self.font.render("TOP CLIMBERS", True, (255, 219, 116))
        self.screen.blit(header, header.get_rect(center=(cx, 200)))

        # Status sub-line.
        if highscore_service is None:
            status_text = ""
        elif highscore_service.status == highscore_service.STATUS_LOADING:
            status_text = "loading..."
        elif highscore_service.status == highscore_service.STATUS_ERROR:
            status_text = "offline (local best shown below)"
        elif highscore_service.status == highscore_service.STATUS_SUBMITTING:
            status_text = "submitting..."
        else:
            status_text = ""
        if status_text:
            sub = self.small_font.render(status_text, True, (180, 195, 210))
            self.screen.blit(sub, sub.get_rect(center=(cx, 226)))

        # Leaderboard rows.
        row_y = 252
        row_h = 26
        if highscore_service and highscore_service.top_scores:
            for rank, entry in enumerate(highscore_service.top_scores[:10], start=1):
                is_player = (
                    entry["name"] == highscore_service.local_name
                    and entry["score"] == highscore_service.local_best
                )
                color = (255, 219, 116) if is_player else WHITE
                left = self.font.render(
                    f"{rank:2d}. {entry['name']:<8}", True, color
                )
                right = self.font.render(f"{entry['score']}m", True, color)
                self.screen.blit(left, (cx - 130, row_y))
                self.screen.blit(right, right.get_rect(topright=(cx + 130, row_y)))
                row_y += row_h
        else:
            empty = self.small_font.render(
                "no scores yet — be the first!", True, (180, 195, 210)
            )
            self.screen.blit(empty, empty.get_rect(center=(cx, row_y + 20)))

        # Always show local best at bottom of panel.
        if highscore_service:
            local = self.small_font.render(
                f"your best: {highscore_service.local_name} {highscore_service.local_best}m",
                True,
                (210, 222, 230),
            )
            self.screen.blit(local, local.get_rect(center=(cx, HEIGHT - 110)))
```

The layout numbers assume `HEIGHT = 800` (from `constants.py`). If the game window changes dimensions, these will need adjustment.

---

## Phase 6 — Integration smoke tests

Run these in order. Do not move on until each passes.

### 6.1 — Desktop, no network

1. Disconnect from the internet.
2. `./run_local.sh`
3. Play, fall, observe the FALLEN overlay.
4. Expected: name entry appears (first run = new local best). After confirming 3 letters, leaderboard panel says "offline (local best shown below)" with your entry as the only one visible at the bottom.
5. Restart with R. Game runs normally.

### 6.2 — Desktop, online

1. Reconnect.
2. `./run_local.sh`
3. Play, fall.
4. Expected: name entry appears, confirm 3 letters. Leaderboard panel populates within a second or two with your submitted score visible.
5. Open the Firebase console → Realtime Database → `/jumpoverthemoon/scores`. Confirm one new entry with the timestamp matching now.

### 6.3 — Desktop, repeat run below personal best

1. With a local best of e.g. 500m, play and intentionally die at 100m.
2. Expected: FALLEN screen shows leaderboard panel immediately, no name entry. The 100m score is silently submitted in the background (you can verify in Firebase console).

### 6.4 — Web build

1. `./build_web.sh`
2. Open the resulting `docs/index.html` via a local HTTP server (e.g. `python3 -m http.server` from the repo root) — **not** via `file://`, which breaks fetch.
3. Play, fall, confirm name entry works with arrows + space.
4. Confirm leaderboard loads from Firebase.
5. Reload the page; confirm the local best survives (proves localStorage path works).

### 6.5 — Mobile touch

1. Deploy to GitHub Pages or test via mobile device against the local HTTP server (use the LAN IP).
2. Play with touch, fall.
3. Expected: on-screen left/right arrows cycle letters; action button confirms each letter, then restarts after the third letter.
4. Confirm the on-screen action button does NOT immediately restart the run on the first tap of the game-over screen — it advances the name entry first.

If 6.5 fails because the action button immediately restarts, the most likely cause is that `perform_action_button` is being called from both `press_mobile_control` and a separate touch handler. Grep for `perform_action_button(` and confirm there is exactly one call site.

---

## Phase 7 — Polish & ship

### 7.1 — Update on-screen controls hint

In `renderer.py`'s `draw_hud`, the line that currently reads:

```python
            hint = self.small_font.render("arrows move   space jump/downslash   P speed ramp   esc quit", True, (232, 239, 234))
```

No change needed — the in-game controls didn't change. The name-entry instructions are shown in the overlay only.

### 7.2 — Update the splash prompt HTML

In `cat-sword-climb/scripts/prepare_web_build.py`, the `PROMPT_HTML` block has the controls list shown before the game starts. Add a line about high scores so players know to look for it:

```python
PROMPT_HTML = """<div class="infobox-subtitle">PRESS SPACEBAR TO START</div>
<div class="infobox-controls">
    <div>ARROWS MOVE</div>
    <div>SPACE JUMP / DOWNSLASH</div>
    <div>R RESTARTS AFTER FALLEN</div>
    <div>FALL FAR ENOUGH TO ENTER A NAME</div>
</div>"""
```

### 7.3 — README update

Add to `cat-sword-climb/README.md`, under a new `## High Scores` section:

```markdown
## High Scores

After each fall, your highest reached height is your score. Beat your personal
best to enter a 3-letter name; the top 10 climbers are stored on a shared
Firebase Realtime Database.

- Personal best is cached locally (browser localStorage on web, `highscore_cache.json` on desktop) so it survives reloads even offline.
- Submissions made while offline are queued and retried on the next successful run.
- Database scope: `over-the-moon-14b50` Firebase project, `/jumpoverthemoon/scores` path.
```

### 7.4 — `.gitignore`

Add to root `.gitignore`:

```
cat-sword-climb/highscore_cache.json
```

So local desktop testing doesn't pollute the repo with one developer's scores.

### 7.5 — Pygbag ignore list

In `pygbag.ini`, the `ignoreFiles` list should also include `highscore_cache.json` so the desktop cache doesn't get bundled into the web build:

```
ignoreFiles = [".DS_Store", "requirements.txt", "run_local.sh", "build_web.sh", "pygbag.ini", "cat_sprites.png", "cat_sprites_chroma.png", "highscore_cache.json"]
```

---

## Failure modes & debugging

If the leaderboard never loads on the web build but works on desktop:

- **Check the browser console** (F12). The most common cause is a CORS error, which means `FIREBASE_DB_URL` is wrong or has a trailing slash.
- The Firebase Realtime Database returns CORS headers by default, so this should never actually fire — but a typo'd URL (e.g. `.firebaseio.com/` vs `.firebaseio.com`) will produce a misleading CORS message.
- Try the URL directly in a browser tab: `https://over-the-moon-14b50-default-rtdb.firebaseio.com/jumpoverthemoon/scores.json` — it should return `null` (empty) or a JSON object.

If submissions silently fail:

- The most likely cause is the security-rules `.validate` block rejecting the payload. Check Firebase console → Rules → Simulator, paste in `/jumpoverthemoon/scores/test123` with a sample payload, and see what fires.
- Open the browser console and look for `[highscore] web http error:` log lines.

If the name entry feels laggy on mobile:

- The `press_mobile_control` change cycles the letter once per `FINGERDOWN`. If the player drags off and back on, it will cycle again — that's the intended arcade feel. If you want to require lift-then-tap, also gate on `pointer_id not in self._already_cycled_pointers` and clear the set in `release_mobile_control`. Skip this unless players complain.

If the leaderboard fetches every frame and burns the Firebase free quota:

- Check that `REFRESH_INTERVAL = 30.0` is still in effect and that `tick()` is the only auto-refresh caller. The free tier handles tens of thousands of reads per day easily, but a runaway loop will blow through it.

---

## Architecture summary

```
Game.update() ──┬── highscore_service.tick()         (background refresh)
                └── existing game logic ...
                    └── _enter_game_over()           (on fall-to-ground)
                        ├── highscore_service.request_refresh(force=True)
                        └── if new local best → NameEntry()
                            else              → highscore_service.submit()

Game.handle_events() ──┬── if name_entry active:
                       │     keyboard arrows  → name_entry.cycle_letter()
                       │     keyboard space   → name_entry.advance() (+ submit on done)
                       │     touch arrows     → name_entry.cycle_letter()  via press_mobile_control
                       │     touch action     → name_entry.advance()       via perform_action_button
                       └── else: normal gameplay or restart

Game.draw() ──→ renderer.draw(... highscore_service=, name_entry=, ...)
                 └── draw_game_over_panel()
                     ├── draw_name_entry()        (while !done)
                     └── draw_leaderboard_panel() (after done OR if not a PB)

HighScoreService ──┬── _refresh_async()    (GET orderBy=score&limitToLast=10)
                   ├── _drain_submits()    (POST queued entries)
                   ├── _LocalCache         (localStorage on web, JSON file on desktop)
                   └── _http_request       (platform.fopen on web, urllib on desktop)
```

The whole feature is two new files (`highscore.py`, `name_entry.py`), surgical additions in `game.py` and `renderer.py`, and one config in Firebase. Backwards-compatible: every change in existing files preserves the original code path when the new state is inactive.
