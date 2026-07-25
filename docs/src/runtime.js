const EPSILON_MS = 1e-7;

const clamp = (value, minimum, maximum) =>
  Math.max(minimum, Math.min(maximum, value));

const round = (value, digits = 3) => {
  const power = 10 ** digits;
  return Math.round(value * power) / power;
};

const percentile = (samples, fraction) => {
  if (!samples.length) {
    return null;
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(sorted.length * fraction) - 1);
  return sorted[index];
};

export class FixedStepRuntime {
  constructor({
    stepMs,
    maxFrameDeltaMs,
    maxCatchUpSteps,
    metricWindowFrames,
    metricWarmupFrames,
    metricPublishEveryFrames,
    maxDeterministicAdvanceMs,
    onUpdate,
    onRender,
    onMetrics,
    onVisibilityChange,
  }) {
    this.stepMs = stepMs;
    this.maxFrameDeltaMs = maxFrameDeltaMs;
    this.maxCatchUpSteps = maxCatchUpSteps;
    this.metricWindowFrames = metricWindowFrames;
    this.metricWarmupFrames = metricWarmupFrames;
    this.metricPublishEveryFrames = metricPublishEveryFrames;
    this.maxDeterministicAdvanceMs = maxDeterministicAdvanceMs;
    this.onUpdate = onUpdate;
    this.onRender = onRender;
    this.onMetrics = onMetrics;
    this.onVisibilityChange = onVisibilityChange;

    this.running = false;
    this.suspended = false;
    this.suspensionReason = null;
    this.manualMode = false;
    this.animationFrame = 0;
    this.lastTimestamp = null;
    this.accumulatorMs = 0;
    this.simulationTimeMs = 0;
    this.interpolation = 0;
    this.totalSteps = 0;
    this.totalFrames = 0;
    this.manualAdvances = 0;
    this.droppedSimulationMs = 0;
    this.droppedCatchUpSteps = 0;
    this.frameSamples = [];
    this.metrics = this.#computeMetrics();

    this.boundFrame = (timestamp) => this.#frame(timestamp);
    this.boundVisibility = () =>
      this.setSuspended(Boolean(document.hidden), "visibility");
  }

  start() {
    if (this.running) {
      return;
    }
    this.running = true;
    document.addEventListener("visibilitychange", this.boundVisibility);
    this.setSuspended(Boolean(document.hidden), "visibility");
    if (!this.suspended && !this.manualMode) {
      this.#schedule();
    }
  }

  stop() {
    if (!this.running) {
      return;
    }
    this.running = false;
    document.removeEventListener("visibilitychange", this.boundVisibility);
    this.#cancelFrame();
    this.lastTimestamp = null;
  }

  setManualMode(enabled) {
    const next = Boolean(enabled);
    if (this.manualMode === next) {
      return;
    }
    this.manualMode = next;
    this.lastTimestamp = null;
    this.accumulatorMs = 0;
    if (next) {
      this.#cancelFrame();
    } else if (this.running && !this.suspended) {
      this.#schedule();
    }
  }

  setSuspended(suspended, reason = "manual") {
    const next = Boolean(suspended);
    const changed = this.suspended !== next || this.suspensionReason !== reason;
    this.suspended = next;
    this.suspensionReason = next ? reason : null;
    this.lastTimestamp = null;
    this.accumulatorMs = 0;
    this.interpolation = 0;

    if (next) {
      this.#cancelFrame();
    } else if (this.running && !this.manualMode) {
      this.#schedule();
    }

    if (changed) {
      this.onVisibilityChange?.(this.getSnapshot());
      this.onRender?.(this.interpolation);
    }
  }

  advanceTime(milliseconds) {
    if (this.suspended) {
      return 0;
    }
    const safeMilliseconds = clamp(
      Number(milliseconds) || 0,
      0,
      this.maxDeterministicAdvanceMs,
    );
    this.manualAdvances += 1;
    this.accumulatorMs += safeMilliseconds;
    const maxSteps = Math.ceil(this.maxDeterministicAdvanceMs / this.stepMs);
    const steps = this.#runSteps(maxSteps);
    this.interpolation = clamp(this.accumulatorMs / this.stepMs, 0, 1);
    this.onRender?.(this.interpolation);
    return steps;
  }

  consumeFrameDelta(milliseconds) {
    if (this.suspended) {
      return 0;
    }
    const rawDeltaMs = Math.max(0, Number(milliseconds) || 0);
    if (rawDeltaMs > 0) {
      this.#recordFrameSample(rawDeltaMs);
    }

    const boundedDeltaMs = Math.min(rawDeltaMs, this.maxFrameDeltaMs);
    if (rawDeltaMs > boundedDeltaMs) {
      this.droppedSimulationMs += rawDeltaMs - boundedDeltaMs;
    }

    this.accumulatorMs += boundedDeltaMs;
    const steps = this.#runSteps(this.maxCatchUpSteps);
    if (this.accumulatorMs + EPSILON_MS >= this.stepMs) {
      const droppedSteps = Math.floor(
        (this.accumulatorMs + EPSILON_MS) / this.stepMs,
      );
      const droppedMs = droppedSteps * this.stepMs;
      this.accumulatorMs = Math.max(0, this.accumulatorMs - droppedMs);
      this.droppedSimulationMs += droppedMs;
      this.droppedCatchUpSteps += droppedSteps;
    }

    this.interpolation = clamp(this.accumulatorMs / this.stepMs, 0, 1);
    this.totalFrames += 1;
    if (
      this.totalFrames % this.metricPublishEveryFrames === 0 ||
      this.frameSamples.length === this.metricWarmupFrames
    ) {
      this.metrics = this.#computeMetrics();
      this.onMetrics?.(this.metrics);
    }
    this.onRender?.(this.interpolation);
    return steps;
  }

  resetPerformanceMetrics() {
    this.frameSamples.length = 0;
    this.droppedSimulationMs = 0;
    this.droppedCatchUpSteps = 0;
    this.lastTimestamp = null;
    this.accumulatorMs = 0;
    this.interpolation = 0;
    this.metrics = this.#computeMetrics();
    this.onMetrics?.(this.metrics);
  }

  getSnapshot() {
    return {
      status: this.running
        ? this.suspended
          ? "suspended"
          : this.manualMode
            ? "manual"
            : "running"
        : "stopped",
      fixedStepHz: round(1000 / this.stepMs, 3),
      fixedStepMs: round(this.stepMs, 3),
      maxFrameDeltaMs: this.maxFrameDeltaMs,
      maxCatchUpSteps: this.maxCatchUpSteps,
      simulationTimeMs: round(this.simulationTimeMs, 3),
      accumulatorMs: round(this.accumulatorMs, 3),
      interpolation: round(this.interpolation, 4),
      totalSteps: this.totalSteps,
      totalFrames: this.totalFrames,
      manualAdvances: this.manualAdvances,
      droppedSimulationMs: round(this.droppedSimulationMs, 3),
      droppedCatchUpSteps: this.droppedCatchUpSteps,
      suspended: this.suspended,
      suspensionReason: this.suspensionReason,
      manualMode: this.manualMode,
      metrics: { ...this.metrics },
    };
  }

  #runSteps(limit) {
    let steps = 0;
    while (
      this.accumulatorMs + EPSILON_MS >= this.stepMs &&
      steps < limit
    ) {
      this.onUpdate?.(this.stepMs);
      this.simulationTimeMs += this.stepMs;
      this.accumulatorMs = Math.max(0, this.accumulatorMs - this.stepMs);
      this.totalSteps += 1;
      steps += 1;
    }
    if (this.accumulatorMs < EPSILON_MS) {
      this.accumulatorMs = 0;
    }
    return steps;
  }

  #recordFrameSample(frameMs) {
    this.frameSamples.push(frameMs);
    if (this.frameSamples.length > this.metricWindowFrames) {
      this.frameSamples.shift();
    }
  }

  #computeMetrics() {
    const sampleCount = this.frameSamples.length;
    if (!sampleCount) {
      return {
        sampleCount: 0,
        windowSize: this.metricWindowFrames,
        windowReady: false,
        averageFrameMs: null,
        p95FrameMs: null,
        worstFrameMs: null,
        fps: null,
        longFrameCount: 0,
      };
    }

    const averageFrameMs =
      this.frameSamples.reduce((total, sample) => total + sample, 0) /
      sampleCount;
    return {
      sampleCount,
      windowSize: this.metricWindowFrames,
      windowReady: sampleCount >= this.metricWarmupFrames,
      averageFrameMs: round(averageFrameMs, 3),
      p95FrameMs: round(percentile(this.frameSamples, 0.95), 3),
      worstFrameMs: round(Math.max(...this.frameSamples), 3),
      fps: round(1000 / averageFrameMs, 1),
      longFrameCount: this.frameSamples.filter(
        (sample) => sample > this.stepMs * 1.5,
      ).length,
    };
  }

  #frame(timestamp) {
    this.animationFrame = 0;
    if (!this.running || this.suspended || this.manualMode) {
      return;
    }
    const deltaMs =
      this.lastTimestamp === null ? 0 : Math.max(0, timestamp - this.lastTimestamp);
    this.lastTimestamp = timestamp;
    this.consumeFrameDelta(deltaMs);
    this.#schedule();
  }

  #schedule() {
    if (
      this.animationFrame ||
      !this.running ||
      this.suspended ||
      this.manualMode
    ) {
      return;
    }
    this.animationFrame = requestAnimationFrame(this.boundFrame);
  }

  #cancelFrame() {
    if (!this.animationFrame) {
      return;
    }
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
  }
}
