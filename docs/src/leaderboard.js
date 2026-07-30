import {
  BLOCKED_INITIALS,
  sanitizeInitials,
} from "./name-entry.js?v=10.3.1";

const DATABASE_URL =
  "https://over-the-moon-14b50-default-rtdb.firebaseio.com";
const SCORES_PATH = "/jumpoverthemoon/scores";
const CACHE_KEY = "jumpoverthemoon_highscore_cache";
const LEGACY_BEST_KEY = "over-the-moon.best-height";
const LEADERBOARD_SIZE = 10;
const REFRESH_INTERVAL_MS = 30_000;
const FETCH_TIMEOUT_MS = 8_000;

const clampScore = (value) => {
  const score = Number.parseInt(value, 10);
  return Number.isFinite(score)
    ? Math.max(0, Math.min(999_999, score))
    : 0;
};

const normalizeRemoteInitials = (value) =>
  String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 3);

const sortEntries = (entries) =>
  entries
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.timestamp - b.timestamp ||
        a.initials.localeCompare(b.initials),
    )
    .slice(0, LEADERBOARD_SIZE);

export const normalizeLeaderboardEntries = (payload) => {
  const rawEntries = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object"
      ? Object.values(payload)
      : [];
  const normalized = rawEntries
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      initials: normalizeRemoteInitials(entry.initials),
      score: clampScore(entry.score),
      timestamp: Number.isFinite(Number(entry.timestamp))
        ? Number(entry.timestamp)
        : 0,
    }))
    .filter(
      (entry) =>
        entry.initials.length === 3 &&
        entry.score > 0 &&
        !BLOCKED_INITIALS.has(entry.initials),
  );
  return sortEntries(normalized);
};

const loadCache = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const readLegacyBest = () => {
  try {
    return clampScore(localStorage.getItem(LEGACY_BEST_KEY));
  } catch {
    return 0;
  }
};

const leaderboardUrl = () => {
  const query = new URLSearchParams({
    orderBy: JSON.stringify("score"),
    limitToLast: String(LEADERBOARD_SIZE),
  });
  return `${DATABASE_URL}${SCORES_PATH}.json?${query}`;
};

const submitUrl = () => `${DATABASE_URL}${SCORES_PATH}.json`;

export class LeaderboardService {
  constructor({ onChange } = {}) {
    const cached = loadCache();
    this.onChange = onChange;
    this.localBest = Math.max(clampScore(cached.best), readLegacyBest());
    this.localInitials = sanitizeInitials(cached.initials);
    this.topScores = normalizeLeaderboardEntries(cached.top_scores);
    this.pending = Array.isArray(cached.pending)
      ? cached.pending
          .slice(-20)
          .map((entry) => ({
            initials: sanitizeInitials(entry.initials),
            score: clampScore(entry.score),
            timestamp: Number(entry.timestamp) || Date.now(),
          }))
      : [];
    this.status = "idle";
    this.error = null;
    this.lastRefreshMs = 0;
    this.refreshPromise = null;
    this.submitPromise = null;
    this.#persist();
  }

  setOnChange(onChange) {
    this.onChange = onChange;
  }

  qualifies(score) {
    const normalized = clampScore(score);
    return (
      this.topScores.length < LEADERBOARD_SIZE ||
      normalized > this.topScores.at(-1).score
    );
  }

  async refresh({ force = false } = {}) {
    if (
      !force &&
      this.lastRefreshMs &&
      Date.now() - this.lastRefreshMs < REFRESH_INTERVAL_MS
    ) {
      return this.getSnapshot();
    }
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    this.status = "loading";
    this.error = null;
    this.#notify();
    this.refreshPromise = this.#request(leaderboardUrl())
      .then((payload) => {
        this.topScores = normalizeLeaderboardEntries(payload);
        this.status = "ready";
        this.lastRefreshMs = Date.now();
        this.#persist();
        this.#notify();
        return this.getSnapshot();
      })
      .catch((error) => {
        this.status = "error";
        this.error = error instanceof Error ? error.message : String(error);
        this.lastRefreshMs = Date.now();
        this.#persist();
        this.#notify();
        return this.getSnapshot();
      })
      .finally(() => {
        this.refreshPromise = null;
      });
    return this.refreshPromise;
  }

  submit(initials, score) {
    const entry = {
      initials: sanitizeInitials(initials),
      score: clampScore(score),
      timestamp: Date.now(),
    };
    if (BLOCKED_INITIALS.has(entry.initials) || entry.score <= 0) {
      return Promise.resolve(false);
    }
    if (entry.score > this.localBest) {
      this.localBest = entry.score;
      this.localInitials = entry.initials;
    }
    this.pending.push(entry);
    this.pending = this.pending.slice(-20);
    this.topScores = normalizeLeaderboardEntries([
      ...this.topScores,
      entry,
    ]);
    this.#persist();
    this.#notify();
    return this.retryPending();
  }

  retryPending() {
    if (this.submitPromise || !this.pending.length) {
      return this.submitPromise || Promise.resolve(true);
    }
    this.submitPromise = this.#drainPending().finally(() => {
      this.submitPromise = null;
    });
    return this.submitPromise;
  }

  getSnapshot() {
    return {
      implemented: true,
      status: this.status,
      localBest: this.localBest,
      localInitials: this.localInitials,
      topScores: this.topScores.map((entry) => ({ ...entry })),
      pendingCount: this.pending.length,
      offlineFallback: true,
      error: this.error,
    };
  }

  async #drainPending() {
    while (this.pending.length) {
      this.status = "submitting";
      this.error = null;
      this.#notify();
      try {
        await this.#request(submitUrl(), {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(this.pending[0]),
        });
      } catch (error) {
        this.status = "error";
        this.error = error instanceof Error ? error.message : String(error);
        this.#persist();
        this.#notify();
        return false;
      }
      this.pending.shift();
      this.#persist();
    }
    this.status = "submitted";
    this.#notify();
    if (this.refreshPromise) {
      await this.refreshPromise;
    }
    await this.refresh({ force: true });
    return true;
  }

  async #request(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Leaderboard request failed (${response.status}).`);
      }
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    } finally {
      clearTimeout(timeout);
    }
  }

  #persist() {
    const payload = {
      best: this.localBest,
      initials: this.localInitials,
      top_scores: this.topScores,
      pending: this.pending.slice(-20),
    };
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
      localStorage.setItem(LEGACY_BEST_KEY, String(this.localBest));
    } catch {
      // Private browsing may block storage; the current run still works.
    }
  }

  #notify() {
    this.onChange?.(this.getSnapshot());
  }
}
