import {
  BLOCKED_INITIALS,
  sanitizeInitials,
} from "./name-entry.js?v=16.0.2";

const DATABASE_URL =
  "https://over-the-moon-14b50-default-rtdb.firebaseio.com";
const PLAYER_INITIALS_KEY = "over-the-moon.player-initials";
export const LEADERBOARD_MODES = Object.freeze({
  classic: Object.freeze({
    playMode: "classic",
    scoresPath: "/jumpoverthemoon/scores",
    cacheKey: "jumpoverthemoon_highscore_cache",
    localBestKey: "over-the-moon.best-height",
  }),
  "cow-vs-cat": Object.freeze({
    playMode: "cow-vs-cat",
    scoresPath: "/jumpoverthemoon/cowvscat/scores",
    cacheKey: "jumpoverthemoon_cowvscat_highscore_cache",
    localBestKey: "over-the-moon.cow-vs-cat.best-height",
  }),
});
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

const loadCache = (cacheKey) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(cacheKey) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const readLocalBest = (localBestKey) => {
  try {
    return clampScore(localStorage.getItem(localBestKey));
  } catch {
    return 0;
  }
};

const readSharedInitials = () => {
  try {
    return sanitizeInitials(localStorage.getItem(PLAYER_INITIALS_KEY));
  } catch {
    return "AAA";
  }
};

const leaderboardUrl = (databaseUrl, scoresPath) => {
  const query = new URLSearchParams({
    orderBy: JSON.stringify("score"),
    limitToLast: String(LEADERBOARD_SIZE),
  });
  return `${databaseUrl}${scoresPath}.json?${query}`;
};

const submitUrl = (databaseUrl, scoresPath) =>
  `${databaseUrl}${scoresPath}.json`;

export class LeaderboardService {
  constructor({
    onChange,
    playMode = "classic",
    databaseUrl = DATABASE_URL,
    scoresPath,
    cacheKey,
    localBestKey,
  } = {}) {
    const modeConfig =
      LEADERBOARD_MODES[playMode] || LEADERBOARD_MODES.classic;
    this.playMode = modeConfig.playMode;
    this.databaseUrl = databaseUrl;
    this.scoresPath = scoresPath || modeConfig.scoresPath;
    this.cacheKey = cacheKey || modeConfig.cacheKey;
    this.localBestKey = localBestKey || modeConfig.localBestKey;
    const cached = loadCache(this.cacheKey);
    this.onChange = onChange;
    this.localBest = Math.max(
      clampScore(cached.best),
      readLocalBest(this.localBestKey),
    );
    this.localInitials = sanitizeInitials(
      cached.initials || readSharedInitials(),
    );
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
    this.refreshPromise = this.#request(
      leaderboardUrl(this.databaseUrl, this.scoresPath),
    )
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
    }
    this.localInitials = entry.initials;
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
      playMode: this.playMode,
      scoresPath: this.scoresPath,
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
        await this.#request(submitUrl(this.databaseUrl, this.scoresPath), {
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
      localStorage.setItem(this.cacheKey, JSON.stringify(payload));
      localStorage.setItem(this.localBestKey, String(this.localBest));
      localStorage.setItem(PLAYER_INITIALS_KEY, this.localInitials);
    } catch {
      // Private browsing may block storage; the current run still works.
    }
  }

  #notify() {
    this.onChange?.(this.getSnapshot());
  }
}
