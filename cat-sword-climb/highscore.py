from __future__ import annotations

import asyncio
import json
import sys
import time
from pathlib import Path
from typing import Any, Optional, Union
from urllib.parse import urlencode
from urllib.request import Request, urlopen


FIREBASE_DB_URL = "https://over-the-moon-14b50-default-rtdb.firebaseio.com"
SCORES_PATH = "/jumpoverthemoon/scores"
LEADERBOARD_SIZE = 10
REFRESH_INTERVAL = 30.0
FETCH_TIMEOUT_SECONDS = 8.0
LOCAL_CACHE_FILENAME = "highscore_cache.json"
INITIALS_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

IS_WEB = sys.platform == "emscripten"
_BROWSER_FETCH_BRIDGE_READY = False


def _leaderboard_url() -> str:
    query = urlencode({
        "orderBy": '"score"',
        "limitToLast": LEADERBOARD_SIZE,
    })
    return f"{FIREBASE_DB_URL}{SCORES_PATH}.json?{query}"


def _submit_url() -> str:
    return f"{FIREBASE_DB_URL}{SCORES_PATH}.json"


def _sanitize_initials(initials: str) -> str:
    cleaned = "".join(char for char in initials.upper() if char in INITIALS_ALPHABET)
    return (cleaned or "AAA")[:3].ljust(3, "A")


def _normalize_score(score: Union[int, float]) -> int:
    try:
        return max(0, min(999999, int(score)))
    except (TypeError, ValueError):
        return 0


def _sort_entries(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        entries,
        key=lambda entry: (
            -int(entry.get("score", 0)),
            int(entry.get("timestamp", 0)),
            str(entry.get("initials", "")),
        ),
    )[:LEADERBOARD_SIZE]


def _normalize_entries(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        raw_entries = payload
    elif isinstance(payload, dict):
        raw_entries = list(payload.values())
    else:
        return []

    entries: list[dict[str, Any]] = []
    for raw_entry in raw_entries:
        if not isinstance(raw_entry, dict):
            continue
        try:
            initials = _sanitize_initials(str(raw_entry.get("initials", "AAA")))
            score = _normalize_score(raw_entry.get("score", 0))
            timestamp = int(raw_entry.get("timestamp", 0))
        except (TypeError, ValueError):
            continue
        entries.append({
            "initials": initials,
            "score": score,
            "timestamp": timestamp,
        })
    return _sort_entries(entries)


async def _browser_json_request(
    url: str,
    *,
    method: str = "GET",
    body: Optional[dict[str, Any]] = None,
) -> tuple[bool, Any]:
    import platform

    global _BROWSER_FETCH_BRIDGE_READY
    if not _BROWSER_FETCH_BRIDGE_READY:
        platform.window.eval(
            """
if (!window.OverMoonFetch) {
    window.OverMoonFetch = {};
    window.OverMoonFetch.request = function * request(url, method, data) {
        let content = "__OVER_MOON_FETCH_PENDING__";
        let options = {
            method: method,
            headers: {
                "Accept": "application/json"
            }
        };
        if (data !== null && data !== undefined) {
            options.headers["Content-Type"] = "application/json";
            options.body = data;
        }
        fetch(new Request(url, options))
            .then((resp) => resp.text().then((text) => {
                content = JSON.stringify({ ok: resp.ok, body: text });
            }))
            .catch((err) => {
                console.log("[highscore] fetch error", err);
                content = "__OVER_MOON_FETCH_ERROR__";
            });
        while (content === "__OVER_MOON_FETCH_PENDING__") {
            yield;
        }
        yield content;
    };
}
            """
        )
        _BROWSER_FETCH_BRIDGE_READY = True

    request_body = json.dumps(body) if body is not None else None
    raw_response = await platform.jsiter(
        platform.window.OverMoonFetch.request(url, method, request_body),
    )

    if raw_response == "__OVER_MOON_FETCH_ERROR__":
        print(f"[highscore] browser request failed: {method} {url}")
        return (False, None)

    try:
        response = json.loads(raw_response)
        ok = bool(response.get("ok"))
        raw_body = response.get("body") or ""
        payload = json.loads(raw_body) if raw_body else None
    except Exception as error:
        print(f"[highscore] browser response parse failed: {error}")
        return (False, None)
    return (ok, payload)


def _desktop_json_request_sync(
    url: str,
    *,
    method: str = "GET",
    body: Optional[dict[str, Any]] = None,
) -> tuple[bool, Any]:
    payload_bytes: Optional[bytes] = None
    headers = {"Accept": "application/json"}
    if body is not None:
        payload_bytes = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = Request(url, data=payload_bytes, headers=headers, method=method)
    with urlopen(request, timeout=FETCH_TIMEOUT_SECONDS) as response:
        raw_body = response.read().decode("utf-8")
        payload = json.loads(raw_body) if raw_body else None
        return ((200 <= response.status < 300), payload)


async def _json_request(
    url: str,
    *,
    method: str = "GET",
    body: Optional[dict[str, Any]] = None,
) -> tuple[bool, Any]:
    if IS_WEB:
        return await _browser_json_request(url, method=method, body=body)

    try:
        return await asyncio.to_thread(
            _desktop_json_request_sync,
            url,
            method=method,
            body=body,
        )
    except Exception as error:
        print(f"[highscore] desktop request failed: {method} {url}: {error}")
        return (False, None)


class _LocalCache:
    KEY = "jumpoverthemoon_highscore_cache"

    def __init__(self, base_dir: Path):
        self.base_dir = base_dir

    def load(self) -> dict[str, Any]:
        if IS_WEB:
            try:
                import platform

                raw = platform.window.localStorage.getItem(self.KEY)
                return json.loads(str(raw)) if raw else {}
            except Exception:
                return {}

        path = self.base_dir / LOCAL_CACHE_FILENAME
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return {}

    def save(self, data: dict[str, Any]) -> None:
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
            path.write_text(payload, encoding="utf-8")
        except Exception:
            pass


class HighScoreService:
    STATUS_IDLE = "idle"
    STATUS_LOADING = "loading"
    STATUS_READY = "ready"
    STATUS_SUBMITTING = "submitting"
    STATUS_SUBMITTED = "submitted"
    STATUS_ERROR = "error"

    def __init__(self, base_dir: Path):
        self._cache = _LocalCache(base_dir)
        cached = self._cache.load()
        self.local_best = _normalize_score(cached.get("best", 0))
        self.local_initials = _sanitize_initials(str(cached.get("initials", "AAA")))
        self.top_scores: list[dict[str, Any]] = _normalize_entries(cached.get("top_scores", {}))
        self.status = self.STATUS_IDLE
        self.last_refresh = 0.0
        self._pending_submits: list[dict[str, Any]] = list(cached.get("pending", []))[-20:]
        self._refresh_task: Optional[asyncio.Task] = None
        self._submit_task: Optional[asyncio.Task] = None

    def is_new_local_best(self, score: Union[int, float]) -> bool:
        return _normalize_score(score) > self.local_best

    def qualifies_for_leaderboard(self, score: Union[int, float]) -> bool:
        score = _normalize_score(score)
        if len(self.top_scores) < LEADERBOARD_SIZE:
            return True
        return score > int(self.top_scores[-1].get("score", 0))

    def request_refresh(self, *, force: bool = False) -> None:
        now = time.monotonic()
        if not force and now - self.last_refresh < REFRESH_INTERVAL:
            return
        if self._refresh_task and not self._refresh_task.done():
            return
        self._refresh_task = asyncio.ensure_future(self._refresh_async())

    def submit(self, initials: str, score: Union[int, float]) -> None:
        initials = _sanitize_initials(initials)
        score = _normalize_score(score)

        if score > self.local_best:
            self.local_best = score
            self.local_initials = initials

        entry = {
            "initials": initials,
            "score": score,
            "timestamp": int(time.time() * 1000),
        }
        self._pending_submits.append(entry)
        self._pending_submits = self._pending_submits[-20:]
        self._persist_local()

        if self._submit_task and not self._submit_task.done():
            return
        self._submit_task = asyncio.ensure_future(self._drain_submits_async())

    def tick(self) -> None:
        if self.status in (self.STATUS_IDLE, self.STATUS_READY, self.STATUS_SUBMITTED):
            self.request_refresh()
        if self._pending_submits and (not self._submit_task or self._submit_task.done()):
            self._submit_task = asyncio.ensure_future(self._drain_submits_async())

    def _persist_local(self) -> None:
        self._cache.save({
            "best": self.local_best,
            "initials": self.local_initials,
            "top_scores": self.top_scores,
            "pending": self._pending_submits[-20:],
        })

    async def _refresh_async(self) -> None:
        self.status = self.STATUS_LOADING
        ok, payload = await _json_request(_leaderboard_url())
        self.last_refresh = time.monotonic()
        if not ok:
            self.status = self.STATUS_ERROR
            self._persist_local()
            return

        self.top_scores = _normalize_entries(payload)
        self.status = self.STATUS_READY
        self._persist_local()

    async def _drain_submits_async(self) -> None:
        while self._pending_submits:
            self.status = self.STATUS_SUBMITTING
            entry = self._pending_submits[0]
            ok, _payload = await _json_request(_submit_url(), method="POST", body=entry)
            if not ok:
                self.status = self.STATUS_ERROR
                self._persist_local()
                return
            self._pending_submits.pop(0)
            self._persist_local()

        self.status = self.STATUS_SUBMITTED
        await self._refresh_async()
