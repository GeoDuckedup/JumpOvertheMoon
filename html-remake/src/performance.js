const DEFAULT_THRESHOLDS = Object.freeze({
  downgradeFps: 50,
  downgradeP95Ms: 28,
  upgradeFps: 57,
  upgradeAverageMs: 18.5,
  upgradeP95Ms: 21,
});

export class AdaptiveQualityController {
  constructor({
    profiles,
    initialProfile,
    onChange,
    cooldownMs = 8_000,
    downgradeWindows = 2,
    upgradeWindows = 4,
    thresholds = DEFAULT_THRESHOLDS,
  }) {
    this.profiles = [...profiles];
    this.onChange = onChange;
    this.cooldownMs = cooldownMs;
    this.downgradeWindows = downgradeWindows;
    this.upgradeWindows = upgradeWindows;
    this.thresholds = thresholds;
    this.currentIndex = this.#indexOf(initialProfile);
    this.ceilingIndex = this.currentIndex;
    this.badWindows = 0;
    this.goodWindows = 0;
    this.lastChangeAtMs = Number.NEGATIVE_INFINITY;
    this.lastReason = "initial-device-profile";
  }

  observe(metrics, nowMs = performance.now()) {
    if (!metrics?.windowReady) {
      return false;
    }

    const bad =
      metrics.fps < this.thresholds.downgradeFps ||
      metrics.p95FrameMs > this.thresholds.downgradeP95Ms;
    const good =
      metrics.fps >= this.thresholds.upgradeFps &&
      metrics.averageFrameMs <= this.thresholds.upgradeAverageMs &&
      metrics.p95FrameMs <= this.thresholds.upgradeP95Ms;

    if (bad) {
      this.badWindows += 1;
      this.goodWindows = 0;
    } else if (good) {
      this.goodWindows += 1;
      this.badWindows = 0;
    } else {
      this.badWindows = 0;
      this.goodWindows = 0;
    }

    const cooldownComplete = nowMs - this.lastChangeAtMs >= this.cooldownMs;
    if (
      cooldownComplete &&
      this.badWindows >= this.downgradeWindows &&
      this.currentIndex > 0
    ) {
      return this.#changeTo(
        this.currentIndex - 1,
        "sustained-frame-pressure",
        nowMs,
        metrics,
      );
    }

    if (
      cooldownComplete &&
      this.goodWindows >= this.upgradeWindows &&
      this.currentIndex < this.ceilingIndex
    ) {
      return this.#changeTo(
        this.currentIndex + 1,
        "sustained-frame-headroom",
        nowMs,
        metrics,
      );
    }
    return false;
  }

  setProfile(profile, reason = "manual", nowMs = performance.now()) {
    return this.#changeTo(this.#indexOf(profile), reason, nowMs, null, true);
  }

  getProfile() {
    return this.profiles[this.currentIndex];
  }

  getSnapshot() {
    return {
      enabled: true,
      current: this.getProfile().name,
      ceiling: this.profiles[this.ceilingIndex].name,
      badWindows: this.badWindows,
      goodWindows: this.goodWindows,
      downgradeWindows: this.downgradeWindows,
      upgradeWindows: this.upgradeWindows,
      cooldownMs: this.cooldownMs,
      lastReason: this.lastReason,
      thresholds: { ...this.thresholds },
    };
  }

  #changeTo(index, reason, nowMs, metrics, force = false) {
    const nextIndex = Math.max(
      0,
      Math.min(force ? this.profiles.length - 1 : this.ceilingIndex, index),
    );
    if (nextIndex === this.currentIndex) {
      return false;
    }
    const previous = this.getProfile();
    this.currentIndex = nextIndex;
    this.lastChangeAtMs = nowMs;
    this.lastReason = reason;
    this.badWindows = 0;
    this.goodWindows = 0;
    this.onChange?.(this.getProfile(), {
      previous,
      reason,
      metrics,
    });
    return true;
  }

  #indexOf(profile) {
    const name = typeof profile === "string" ? profile : profile?.name;
    const index = this.profiles.findIndex((candidate) => candidate.name === name);
    if (index < 0) {
      throw new Error(`Unknown quality profile: ${String(name)}`);
    }
    return index;
  }
}
