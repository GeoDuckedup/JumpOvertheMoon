import {
  AMBIENT_FLYBYS,
  BACKGROUND_PHASES,
  CAMERA,
  COLLISION,
  COMBO,
  EFFECTS,
  GAME_WIDTH,
  GOALS,
  GOAL_MARKERS,
  LEADERBOARD_BALLOONS,
  PLAYER,
  REENTRY,
  REFERENCE_HEIGHT,
  ROUTE,
  SHOOTING_STARS,
  SPEED_RAMP,
  UPPER_COSMOS_CHAPTERS,
  WORLD_FLOOR_Y,
} from "./game-config.js?v=10.3.1";
import { NameEntry } from "./name-entry.js?v=10.3.1";
import { BalloonRoute, SeededRandom } from "./route.js?v=10.3.1";

const BEST_HEIGHT_STORAGE_KEY = "over-the-moon.best-height";

const clamp = (value, minimum, maximum) =>
  Math.max(minimum, Math.min(maximum, value));

const round = (value, digits = 3) => {
  const power = 10 ** digits;
  return Math.round(value * power) / power;
};

const lerp = (a, b, alpha) => a + (b - a) * alpha;

const readSavedBest = () => {
  try {
    const value = Number.parseInt(
      globalThis.localStorage?.getItem(BEST_HEIGHT_STORAGE_KEY),
      10,
    );
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
};

const writeSavedBest = (height) => {
  try {
    globalThis.localStorage?.setItem(
      BEST_HEIGHT_STORAGE_KEY,
      String(Math.max(0, Math.floor(height))),
    );
  } catch {
    // A playable run never depends on storage being available.
  }
};

const createRunSeed = () => {
  try {
    const values = new Uint32Array(1);
    globalThis.crypto?.getRandomValues(values);
    if (values[0]) {
      return values[0];
    }
  } catch {
    // Date/performance below remains a suitable non-security gameplay seed.
  }
  return (
    (Date.now() ^
      Math.floor((globalThis.performance?.now?.() || 0) * 1000) ^
      Math.floor(Math.random() * 0xffffffff)) >>>
    0
  );
};

const makePlayer = () => ({
  x: GAME_WIDTH * 0.5,
  y: WORLD_FLOOR_Y - PLAYER.height * 0.5,
  previousX: GAME_WIDTH * 0.5,
  previousY: WORLD_FLOOR_Y - PLAYER.height * 0.5,
  vx: 0,
  vy: 0,
  facing: 1,
  slashTimer: 0,
  cooldown: 0,
  onGround: true,
});

const makeDebugBalloon = (values = {}) => ({
  id: "debug-balloon",
  x: 330,
  y: 520,
  radius: 43,
  color: "red",
  wobble: 0.7,
  routeRole: "main",
  landmarkApproach: null,
  alive: true,
  poppedTimer: 0,
  ...values,
});

const copyBalloon = (balloon, tutorialBalloonId) => ({
  id: balloon.id,
  x: round(balloon.x),
  y: round(balloon.y),
  radius: balloon.radius,
  color: balloon.color,
  wobble: round(balloon.wobble, 4),
  routeRole: balloon.routeRole,
  landmarkApproach: balloon.landmarkApproach || null,
  alive: balloon.alive,
  poppedTimerSeconds: round(balloon.poppedTimer, 4),
  showHint: balloon.id === tutorialBalloonId && balloon.alive,
  leaderboard:
    balloon.routeRole === "leaderboard"
      ? {
          rank: balloon.leaderboardRank,
          initials: balloon.leaderboardInitials,
          scoreMeters: balloon.leaderboardScoreMeters,
        }
      : null,
});

const copyAmbientFlyby = (flyby) => {
  if (!flyby) {
    return null;
  }
  return {
    type: flyby.type,
    x: round(flyby.x),
    y: round(flyby.y),
    baseY: round(flyby.baseY),
    vx: round(flyby.vx),
    direction: flyby.direction,
    ageSeconds: round(flyby.age, 4),
    lifetimeSeconds: round(flyby.lifetime, 4),
    progress: round(clamp(flyby.age / flyby.lifetime, 0, 1), 4),
    rotationRadians: round(flyby.rotation, 4),
    wing: round(flyby.wing, 4),
    blink: round(flyby.blink, 4),
    scale: round(flyby.scale, 4),
    flapRate: round(flyby.flapRate || 0, 4),
    glideRate: round(flyby.glideRate || 0, 4),
    bobAmplitude: round(flyby.bobAmplitude || 0),
    bobCycles: round(flyby.bobCycles || 0, 3),
    verticalDrift: round(flyby.verticalDrift || 0),
  };
};

const archiveBalloon = (balloon) => ({
  id: balloon.id,
  x: balloon.x,
  y: balloon.y,
  radius: balloon.radius,
  color: balloon.color,
  wobble: balloon.wobble,
  routeRole: balloon.routeRole,
  landmarkApproach: balloon.landmarkApproach || null,
});

const hydrateBalloon = (record) => ({
  ...record,
  alive: true,
  poppedTimer: 0,
});

const leaderboardBalloonIdentity = (entry, duplicateIndex) =>
  [
    "leaderboard-balloon",
    entry.initials,
    entry.score,
    entry.timestamp,
    duplicateIndex,
  ].join("-");

const leaderboardBalloonWobble = (identity) => {
  let hash = 2166136261;
  for (const character of identity) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) / 4294967296) * Math.PI * 2;
};

const makeGoalMarkers = () =>
  GOAL_MARKERS.map((marker) => ({
    ...marker,
    alive: true,
    reached: false,
    poppedTimer: 0,
  }));

const copyGoalMarker = (marker) => ({
  id: marker.id,
  name: marker.name,
  assetName: marker.assetName,
  heightMeters: marker.heightMeters,
  x: marker.x,
  y: marker.y,
  spriteOffsetY: marker.spriteOffsetY,
  spriteHeight: marker.spriteHeight,
  hitWidth: marker.hitWidth,
  hitHeight: marker.hitHeight,
  hitOffsetY: marker.hitOffsetY,
  clearanceTopY: marker.clearanceTopY,
  clearanceBottomY: marker.clearanceBottomY,
  alive: marker.alive,
  reached: marker.reached,
  poppedTimerSeconds: round(marker.poppedTimer, 4),
});

const BACKGROUND_MOTIF_KEYS = Object.freeze([
  "kuiper",
  "heliopause",
  "interstellar",
  "proxima",
  "gravity",
]);

const backgroundMotifs = (phase, next, mix) =>
  Object.fromEntries(
    BACKGROUND_MOTIF_KEYS.map((key) => [
      key,
      round(
        (Number(phase[key]) || 0) * (1 - mix) +
          (Number(next[key]) || 0) * mix,
        4,
      ),
    ]),
  );

const backgroundProgressAtHeight = (height) => {
  for (let index = 0; index < BACKGROUND_PHASES.length - 1; index += 1) {
    const phase = BACKGROUND_PHASES[index];
    const next = BACKGROUND_PHASES[index + 1];
    if (height <= next.height) {
      const raw = clamp(
        (height - phase.height) / (next.height - phase.height),
        0,
        1,
      );
      const mix = raw * raw * (3 - 2 * raw);
      const dominant = mix < 0.5 ? phase : next;
      return {
        current: phase.name,
        next: next.name,
        mix: round(mix, 4),
        dominant: dominant.name,
        dominantLabel: dominant.label || dominant.name,
        motifs: backgroundMotifs(phase, next, mix),
      };
    }
  }
  const last = BACKGROUND_PHASES.at(-1);
  return {
    current: last.name,
    next: last.name,
    mix: 0,
    dominant: last.name,
    dominantLabel: last.label || last.name,
    motifs: backgroundMotifs(last, last, 0),
  };
};

export class PhaseSixGame {
  constructor({ onEvent, leaderboard } = {}) {
    this.onEvent = onEvent;
    this.leaderboard = leaderboard || {
      implemented: false,
      status: "idle",
      localBest: 0,
      localInitials: "AAA",
      topScores: [],
      pendingCount: 0,
      offlineFallback: true,
      error: null,
    };
    this.mode = "menu";
    this.viewportHeight = REFERENCE_HEIGHT;
    this.viewportFloorMargin = CAMERA.tallViewportFloorMargin;
    this.player = makePlayer();
    this.balloons = [];
    this.leaderboardBalloons = [];
    this.balloonHistoryChunks = new Map();
    this.balloonHistoryCount = 0;
    this.poppedBalloonIds = new Set();
    this.poppedLeaderboardBalloonIds = new Set();
    this.rehydratedBalloonCount = 0;
    this.activeRouteChunkCount = 0;
    this.debugBalloonOverride = false;
    this.goalMarkers = makeGoalMarkers();
    this.route = new BalloonRoute(1);
    this.visualRandom = new SeededRandom(1);
    this.ambientRandom = new SeededRandom(2);
    this.runSeed = 1;
    this.cameraY = 0;
    this.previousCameraY = 0;
    this.hitPauseTimer = 0;
    this.bestHeight = 0;
    this.savedBestHeight = readSavedBest();
    this.newBest = false;
    this.finalScore = 0;
    this.hasPoppedBalloon = false;
    this.totalPopped = 0;
    this.totalLandmarksCleared = 0;
    this.runTimeSeconds = 0;
    this.bestComboStreak = 0;
    this.hitComboColor = null;
    this.hitComboStreak = 0;
    this.lastComboReward = null;
    this.comboFeedbacks = [];
    this.speedMultiplier = 1;
    this.speedRampEnabled = true;
    this.shootingStars = [];
    this.shootingStarTimer = 0;
    this.ambientFlyby = null;
    this.ambientFlybyTimers = { bird: 0, saucer: 0 };
    this.ambientFlybyCounts = { bird: 0, saucer: 0 };
    this.fallPeakHeight = 0;
    this.reentryStage = 0;
    this.popEffects = [];
    this.eventCounts = {};
    this.lastEvent = null;
    this.runId = 0;
    this.tutorialBalloonId = null;
    this.culledBalloonCount = 0;
    this.peakActiveBalloonCount = 0;
    this.nameEntry = null;
    this.nameEntryScore = 0;
    this.nameEntrySubmitted = false;
    this.deathView = "summary";
    this.qualifiesForLeaderboard = false;
    this.setViewportHeight(REFERENCE_HEIGHT);
  }

  start(seed = createRunSeed()) {
    this.runId += 1;
    this.runSeed = Number(seed) >>> 0 || 1;
    this.player = makePlayer();
    this.balloons = [];
    this.leaderboardBalloons = [];
    this.balloonHistoryChunks = new Map();
    this.balloonHistoryCount = 0;
    this.poppedBalloonIds = new Set();
    this.poppedLeaderboardBalloonIds = new Set();
    this.rehydratedBalloonCount = 0;
    this.activeRouteChunkCount = 0;
    this.debugBalloonOverride = false;
    this.goalMarkers = makeGoalMarkers();
    this.route.reset(this.runSeed);
    this.visualRandom = new SeededRandom(
      (this.runSeed ^ 0x9e3779b9) >>> 0 || 1,
    );
    this.ambientRandom = new SeededRandom(
      (this.runSeed ^ 0x85ebca6b) >>> 0 || 1,
    );
    this.hitPauseTimer = 0;
    this.bestHeight = 0;
    this.newBest = false;
    this.finalScore = 0;
    this.hasPoppedBalloon = false;
    this.totalPopped = 0;
    this.totalLandmarksCleared = 0;
    this.runTimeSeconds = 0;
    this.bestComboStreak = 0;
    this.hitComboColor = null;
    this.hitComboStreak = 0;
    this.lastComboReward = null;
    this.comboFeedbacks = [];
    this.speedMultiplier = 1;
    this.shootingStars = [];
    this.shootingStarTimer = this.#nextShootingStarDelay(0);
    this.ambientFlyby = null;
    this.ambientFlybyTimers = {
      bird: this.#nextAmbientFlybyDelay("bird"),
      saucer: this.#nextAmbientFlybyDelay("saucer"),
    };
    this.ambientFlybyCounts = { bird: 0, saucer: 0 };
    this.fallPeakHeight = 0;
    this.reentryStage = 0;
    this.popEffects = [];
    this.eventCounts = {};
    this.lastEvent = null;
    this.tutorialBalloonId = null;
    this.culledBalloonCount = 0;
    this.peakActiveBalloonCount = 0;
    this.nameEntry = null;
    this.nameEntryScore = 0;
    this.nameEntrySubmitted = false;
    this.deathView = "summary";
    this.qualifiesForLeaderboard = false;
    this.mode = "playing";
    this.cameraY = this.#baseCameraY();
    this.previousCameraY = this.cameraY;
    this.#syncLeaderboardBalloons();
    this.#maintainRoute();
    return this.runSeed;
  }

  setViewportHeight(
    height,
    floorMargin = CAMERA.tallViewportFloorMargin,
  ) {
    this.viewportHeight = Math.max(1, Number(height) || REFERENCE_HEIGHT);
    this.viewportFloorMargin = Math.max(
      0,
      Number(floorMargin) || CAMERA.tallViewportFloorMargin,
    );
    if (this.mode === "menu" || this.player.onGround) {
      this.cameraY = this.#baseCameraY();
      this.previousCameraY = this.cameraY;
    }
    if (this.mode === "playing") {
      this.#maintainRoute();
    }
  }

  update(stepMs, input) {
    const dt = stepMs / 1000;
    this.nameEntry?.update(dt);
    this.#updateShootingStars(dt);
    this.#updateAmbientFlyby(dt);
    if (this.mode !== "playing") {
      return;
    }
    this.runTimeSeconds += dt;
    const player = this.player;
    player.previousX = player.x;
    player.previousY = player.y;
    this.previousCameraY = this.cameraY;

    if (input.consumeAction()) {
      this.#performAction();
    }

    if (this.hitPauseTimer > 0) {
      this.hitPauseTimer = Math.max(0, this.hitPauseTimer - dt);
      return;
    }

    const wasOnGround = player.onGround;
    this.#updateSpeedMultiplier();
    this.#updatePlayer(dt, input.direction);
    this.#updateReentryState();
    for (const balloon of this.balloons) {
      balloon.wobble += dt * 4 * this.speedMultiplier;
    }
    for (const balloon of this.leaderboardBalloons) {
      balloon.wobble += dt * 4 * this.speedMultiplier;
    }

    const hitBalloon = [
      ...this.balloons,
      ...this.leaderboardBalloons,
    ].find((balloon) => balloon.alive && this.#swordHitsBalloon(balloon));
    if (hitBalloon) {
      this.#popBalloon(hitBalloon);
    } else {
      const hitMarker = this.goalMarkers.find(
        (marker) => marker.alive && this.#swordHitsGoalMarker(marker),
      );
      if (hitMarker) {
        this.#clearGoalMarker(hitMarker);
      }
    }

    for (const balloon of this.balloons) {
      if (balloon.poppedTimer > 0) {
        balloon.poppedTimer += dt;
      }
    }
    for (const balloon of this.leaderboardBalloons) {
      if (balloon.poppedTimer > 0) {
        balloon.poppedTimer += dt;
      }
    }
    for (const marker of this.goalMarkers) {
      if (marker.poppedTimer > 0) {
        marker.poppedTimer += dt;
      }
    }
    for (const effect of this.popEffects) {
      effect.age += dt;
    }
    this.popEffects = this.popEffects.filter(
      (effect) => effect.age < EFFECTS.popLifetimeSeconds,
    );
    for (const feedback of this.comboFeedbacks) {
      feedback.age += dt;
    }
    this.comboFeedbacks = this.comboFeedbacks.filter(
      (feedback) => feedback.age < COMBO.feedbackLifetimeSeconds,
    );

    this.#updateCamera();
    this.bestHeight = Math.max(this.bestHeight, this.currentHeight);
    this.#updateSpeedMultiplier();
    this.#maintainRoute();

    if (!wasOnGround && player.onGround) {
      this.#emit("landing");
      if (this.hasPoppedBalloon) {
        this.#enterGameOver();
      }
    }
  }

  get currentHeight() {
    return Math.max(0, (WORLD_FLOOR_Y - this.player.y) / 10);
  }

  getSnapshot() {
    const player = this.player;
    const balloonSnapshots = this.balloons.map((balloon) =>
      copyBalloon(balloon, this.tutorialBalloonId),
    );
    const leaderboardBalloonSnapshots = this.leaderboardBalloons.map(
      (balloon) => copyBalloon(balloon, null),
    );
    return {
      mode: this.mode,
      runId: this.runId,
      runSeed: this.runSeed,
      player: {
        x: round(player.x),
        y: round(player.y),
        vx: round(player.vx),
        vy: round(player.vy),
        width: PLAYER.width,
        height: PLAYER.height,
        facing: player.facing,
        onGround: player.onGround,
        slashing: this.#isSlashing(),
        slashProgress: round(this.#slashProgress(), 4),
        cooldownSeconds: round(player.cooldown, 4),
        sprite: this.#playerSpriteName(),
        pose:
          this.mode === "gameover" && player.onGround
            ? "belly-up"
            : "upright",
        swordSegment: this.#isSlashing()
          ? this.#swordSegment().map(([x, y]) => ({
              x: round(x),
              y: round(y),
            }))
          : null,
      },
      balloons: balloonSnapshots,
      balloon: balloonSnapshots[0] || null,
      balloonCount: this.balloons.length,
      aliveBalloonCount: this.balloons.filter((balloon) => balloon.alive)
        .length,
      leaderboardBalloons: leaderboardBalloonSnapshots,
      leaderboardBalloonCount: this.leaderboardBalloons.length,
      aliveLeaderboardBalloonCount: this.leaderboardBalloons.filter(
        (balloon) => balloon.alive,
      ).length,
      poppedLeaderboardBalloonCount:
        this.poppedLeaderboardBalloonIds.size,
      peakActiveBalloonCount: this.peakActiveBalloonCount,
      culledBalloonCount: this.culledBalloonCount,
      totalPopped: this.totalPopped,
      totalLandmarksCleared: this.totalLandmarksCleared,
      runStats: {
        heightMeters: this.finalScore || Math.floor(this.bestHeight),
        balloonsPopped: this.totalPopped,
        bestCombo: this.bestComboStreak,
        landmarksCleared: this.totalLandmarksCleared,
        totalLandmarks: this.goalMarkers.length,
        durationSeconds: round(this.runTimeSeconds, 1),
      },
      hasPoppedBalloon: this.hasPoppedBalloon,
      goalMarkers: this.goalMarkers.map(copyGoalMarker),
      nextLandmark:
        this.goalMarkers.find((marker) => marker.alive)?.name || null,
      combo: {
        color: this.hitComboColor,
        streak: this.hitComboStreak,
        matchAt: COMBO.matchStreak,
        comboAt: COMBO.comboStreak,
        lastReward: this.lastComboReward,
        feedbackCount: this.comboFeedbacks.length,
      },
      reentry: {
        stage: this.reentryStage,
        active: this.reentryStage > 0,
        fallPeakHeightMeters: round(this.fallPeakHeight),
        fallDistanceMeters: round(
          Math.max(0, this.fallPeakHeight - this.currentHeight),
        ),
        minimumHeightMeters: REENTRY.minimumHeightMeters,
        minimumFallDistanceMeters: REENTRY.minimumFallDistanceMeters,
        minimumFallSpeed: REENTRY.minimumFallSpeed,
      },
      background: backgroundProgressAtHeight(this.currentHeight),
      speed: {
        multiplier: round(this.speedMultiplier, 4),
        maximumMultiplier: SPEED_RAMP.maximumMultiplier,
        referenceHeightMeters: SPEED_RAMP.referenceHeightMeters,
        rampEnabled: this.speedRampEnabled,
        devLockedAtOne: !this.speedRampEnabled,
      },
      shootingStars: this.shootingStars.map((star) => ({
        x: round(star.x),
        y: round(star.y),
        vx: round(star.vx),
        vy: round(star.vy),
        ageSeconds: round(star.age, 4),
        lifetimeSeconds: round(star.lifetime, 4),
        length: round(star.length),
        width: star.width,
      })),
      shootingStar: {
        minimumHeightMeters: SHOOTING_STARS.minimumHeightMeters,
        nextDelaySeconds: round(this.shootingStarTimer, 3),
        activeCount: this.shootingStars.length,
        separateVisualRandom: true,
      },
      ambientFlyby: {
        active: copyAmbientFlyby(this.ambientFlyby),
        eligibleType: this.#eligibleAmbientFlybyType(this.currentHeight),
        oneBackgroundEventAtATime: true,
        separateVisualRandom: true,
        bird: {
          minimumHeightMeters:
            AMBIENT_FLYBYS.bird.minimumHeightMeters,
          maximumHeightMeters:
            AMBIENT_FLYBYS.bird.maximumHeightMeters,
          nextDelaySeconds: round(this.ambientFlybyTimers.bird, 3),
          spawnedThisRun: this.ambientFlybyCounts.bird,
        },
        saucer: {
          minimumHeightMeters:
            AMBIENT_FLYBYS.saucer.minimumHeightMeters,
          maximumHeightMeters:
            AMBIENT_FLYBYS.saucer.maximumHeightMeters,
          nextDelaySeconds: round(this.ambientFlybyTimers.saucer, 3),
          spawnedThisRun: this.ambientFlybyCounts.saucer,
        },
      },
      nameEntry: this.nameEntry?.getSnapshot() || null,
      deathScreen: {
        view: this.deathView,
        qualifiesForLeaderboard: this.qualifiesForLeaderboard,
        submitted: this.nameEntrySubmitted,
      },
      leaderboard: {
        ...this.leaderboard,
        topScores: (this.leaderboard.topScores || []).map((entry) => ({
          ...entry,
        })),
      },
      route: {
        ...this.route.getSnapshot(),
        colors: [...ROUTE.colors],
        spawnAheadPixels: ROUTE.spawnAheadPixels,
        retainBelowViewportPixels: ROUTE.retainBelowViewportPixels,
        historyChunkPixels: ROUTE.historyChunkPixels,
        maxActiveBalloons: ROUTE.maxActiveBalloons,
        historyBalloonCount: this.balloonHistoryCount,
        historyChunkCount: this.balloonHistoryChunks.size,
        activeHistoryChunkCount: this.activeRouteChunkCount,
        rehydratedBalloonCount: this.rehydratedBalloonCount,
        poppedHistoryBalloonCount: this.poppedBalloonIds.size,
        nearbyActiveOnly: true,
      },
      camera: {
        y: round(this.cameraY),
        viewportHeight: round(this.viewportHeight),
        floorMargin: round(this.viewportFloorMargin),
        worldToScreen: "screenY = worldY - cameraY",
      },
      heightMeters: Math.floor(this.currentHeight),
      bestHeightMeters: Math.floor(this.bestHeight),
      savedBestHeightMeters: this.savedBestHeight,
      finalScoreMeters: this.finalScore,
      newBest: this.newBest,
      floorRule: this.hasPoppedBalloon
        ? "fatal-after-first-pop"
        : "safe-before-first-pop",
      hitPauseSeconds: round(this.hitPauseTimer, 4),
      popEffectCount: this.popEffects.length,
      lastEvent: this.lastEvent,
      eventCounts: { ...this.eventCounts },
      phaseSix: {
        routeGenerationImplemented: true,
        boundedBalloonLifecycle: true,
        fatalFloorImplemented: true,
        localBestImplemented: true,
        landmarksImplemented: true,
        landmarkClearanceImplemented: true,
        comboRewardsImplemented: true,
        reentryTrailImplemented: true,
        altitudeBackgroundsImplemented: true,
        altitudeSpeedRampImplemented: true,
        shootingStarsImplemented: true,
        adaptiveAmbienceImplemented: true,
        initialsEntryImplemented: true,
        sharedLeaderboardImplemented: true,
        offlineScoreQueueImplemented: true,
      },
      phaseSeven: {
        cosmicLandmarksImplemented: true,
        totalLandmarks: this.goalMarkers.length,
        finalLandmarkHeightMeters:
          this.goalMarkers.at(-1)?.heightMeters || 0,
        proceduralPlaceholderArt: false,
        endlessBeyondFinalLandmark: true,
        compactRouteHistoryImplemented: true,
        descentRouteRehydrationImplemented: true,
      },
      phaseNine: {
        upperCosmosChaptersImplemented: true,
        chapterAwareAmbienceImplemented: true,
        smoothCrossfadesImplemented: true,
        gameplayGeometryUnchanged: true,
        ambientFlybysImplemented: true,
        chapters: UPPER_COSMOS_CHAPTERS.map((chapter) => ({ ...chapter })),
      },
      leaderboardBalloonFeature: {
        implemented: true,
        interactive: true,
        baseColors: [...LEADERBOARD_BALLOONS.colors],
        goldAura: true,
        comboBehavior: "displayed-color",
        exactRecordedHeights: true,
      },
    };
  }

  getRenderState(interpolation) {
    const alpha = clamp(Number(interpolation) || 0, 0, 1);
    const player = this.player;
    const snapshot = this.getSnapshot();
    const wrapped =
      Math.abs(player.x - player.previousX) > GAME_WIDTH * 0.5;
    return {
      ...snapshot,
      player: {
        ...snapshot.player,
        renderX: wrapped ? player.x : lerp(player.previousX, player.x, alpha),
        renderY: lerp(player.previousY, player.y, alpha),
      },
      camera: {
        ...snapshot.camera,
        renderY: lerp(this.previousCameraY, this.cameraY, alpha),
      },
      balloons: this.balloons.map((balloon) => ({
        ...balloon,
        showHint:
          balloon.id === this.tutorialBalloonId && balloon.alive,
      })),
      leaderboardBalloons: this.leaderboardBalloons.map((balloon) => ({
        ...balloon,
      })),
      goalMarkers: this.goalMarkers.map((marker) => ({ ...marker })),
      popEffects: this.popEffects.map((effect) => ({ ...effect })),
      comboFeedbacks: this.comboFeedbacks.map((feedback) => ({
        ...feedback,
      })),
    };
  }

  debugSetPlayer(values = {}) {
    Object.assign(this.player, values);
    this.player.previousX = this.player.x;
    this.player.previousY = this.player.y;
    this.#updateSpeedMultiplier();
    this.#updateCamera();
    this.#maintainRoute();
  }

  debugResetBalloon(values = {}) {
    const balloon = makeDebugBalloon(values);
    this.balloons = [balloon];
    this.debugBalloonOverride = true;
    this.tutorialBalloonId = balloon.id;
    this.hasPoppedBalloon = false;
    this.totalPopped = 0;
    this.popEffects = [];
  }

  debugSetBalloons(values = []) {
    this.balloons = values.map((balloon, index) =>
      makeDebugBalloon({
        id: `debug-balloon-${index + 1}`,
        ...balloon,
      }),
    );
    this.tutorialBalloonId = this.balloons[0]?.id || null;
    this.popEffects = [];
    this.debugBalloonOverride = true;
  }

  debugSetGoalMarker(id, values = {}) {
    const marker = this.goalMarkers.find((candidate) => candidate.id === id);
    if (!marker) {
      throw new Error(`Unknown goal marker: ${String(id)}`);
    }
    Object.assign(marker, values);
  }

  debugJumpToLandmark(reference) {
    const marker =
      typeof reference === "number"
        ? this.goalMarkers[Math.max(0, Math.floor(reference))]
        : this.goalMarkers.find(
            (candidate) =>
              candidate.id === reference ||
              candidate.name.toLowerCase() ===
                String(reference || "").toLowerCase(),
          );
    if (!marker) {
      throw new Error(`Unknown goal marker: ${String(reference)}`);
    }
    this.debugBalloonOverride = false;

    const landmarkTopScreenY = Math.max(
      100,
      Math.min(165, this.viewportHeight * 0.17),
    );
    const cameraY =
      marker.y - marker.spriteOffsetY - landmarkTopScreenY;
    const playerScreenY = Math.min(
      this.viewportHeight - 170,
      landmarkTopScreenY + marker.spriteHeight + 125,
    );
    this.player.x = marker.x;
    this.player.y = cameraY + playerScreenY;
    this.player.previousX = this.player.x;
    this.player.previousY = this.player.y;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.onGround = false;
    this.player.slashTimer = 0;
    this.player.cooldown = 0;
    this.cameraY = Math.min(this.#baseCameraY(), cameraY);
    this.previousCameraY = this.cameraY;
    this.#updateSpeedMultiplier();
    this.#maintainRoute();
    return copyGoalMarker(marker);
  }

  debugWarpBelowLandmark(reference, balloonsBelow = 3) {
    const markerSnapshot = this.debugJumpToLandmark(reference);
    const marker = this.goalMarkers.find(
      (candidate) => candidate.id === markerSnapshot.id,
    );
    const requestedDepth = clamp(
      Math.floor(Number(balloonsBelow) || 3),
      1,
      6,
    );
    const routeBalloonsBelow = this.balloons
      .filter(
        (balloon) =>
          balloon.alive &&
          balloon.routeRole === "main" &&
          balloon.y > marker.clearanceBottomY,
      )
      .sort((a, b) => a.y - b.y);
    const targetBalloon =
      routeBalloonsBelow[
        Math.min(requestedDepth - 1, routeBalloonsBelow.length - 1)
      ] || null;
    const fallbackY =
      marker.clearanceBottomY +
      GOALS.approachBalloonGap +
      ROUTE.spacingMin * requestedDepth;

    this.player.x = targetBalloon?.x ?? marker.x;
    this.player.y = targetBalloon
      ? targetBalloon.y -
        targetBalloon.radius -
        PLAYER.height * 0.5 -
        10
      : fallbackY;
    this.player.previousX = this.player.x;
    this.player.previousY = this.player.y;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.onGround = false;
    this.player.slashTimer = 0;
    this.player.cooldown = 0;
    this.#updateSpeedMultiplier();

    const markerTopY = marker.y - marker.spriteOffsetY;
    const playerCameraY =
      this.player.y - this.viewportHeight * CAMERA.followBottomRatio;
    const markerCameraY = markerTopY - 92;
    this.cameraY = Math.min(
      this.#baseCameraY(),
      playerCameraY,
      markerCameraY,
    );
    this.previousCameraY = this.cameraY;
    this.#maintainRoute();

    return {
      marker: copyGoalMarker(marker),
      requestedBalloonsBelow: requestedDepth,
      targetBalloon: targetBalloon
        ? copyBalloon(targetBalloon, this.tutorialBalloonId)
        : null,
    };
  }

  debugWarpBelowLeaderboardBalloon(rank = 1, balloonsBelow = 3) {
    const requestedRank = clamp(
      Math.floor(Number(rank) || 1),
      1,
      LEADERBOARD_BALLOONS.limit,
    );
    const leaderboardBalloon = this.leaderboardBalloons.find(
      (balloon) => balloon.leaderboardRank === requestedRank,
    );
    if (!leaderboardBalloon) {
      throw new Error(`Leaderboard balloon #${requestedRank} is unavailable.`);
    }

    const requestedDepth = clamp(
      Math.floor(Number(balloonsBelow) || 3),
      1,
      6,
    );
    this.cameraY = Math.min(
      this.#baseCameraY(),
      leaderboardBalloon.y - 120,
    );
    this.previousCameraY = this.cameraY;
    this.#maintainRoute();

    const routeBalloonsBelow = this.balloons
      .filter(
        (balloon) =>
          balloon.alive &&
          balloon.routeRole === "main" &&
          balloon.y > leaderboardBalloon.y,
      )
      .sort((a, b) => a.y - b.y);
    const targetBalloon =
      routeBalloonsBelow[
        Math.min(requestedDepth - 1, routeBalloonsBelow.length - 1)
      ] || null;
    const fallbackY =
      leaderboardBalloon.y + ROUTE.spacingMin * requestedDepth;

    this.player.x = targetBalloon?.x ?? leaderboardBalloon.x;
    this.player.y = targetBalloon
      ? targetBalloon.y -
        targetBalloon.radius -
        PLAYER.height * 0.5 -
        10
      : fallbackY;
    this.player.previousX = this.player.x;
    this.player.previousY = this.player.y;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.onGround = false;
    this.player.slashTimer = 0;
    this.player.cooldown = 0;
    this.#updateSpeedMultiplier();

    const playerCameraY =
      this.player.y - this.viewportHeight * CAMERA.followBottomRatio;
    const markerCameraY = leaderboardBalloon.y - 120;
    this.cameraY = Math.min(
      this.#baseCameraY(),
      playerCameraY,
      markerCameraY,
    );
    this.previousCameraY = this.cameraY;
    this.#maintainRoute();

    return {
      leaderboardBalloon: copyBalloon(leaderboardBalloon, null),
      requestedBalloonsBelow: requestedDepth,
      targetBalloon: targetBalloon
        ? copyBalloon(targetBalloon, this.tutorialBalloonId)
        : null,
    };
  }

  debugSetCombo(color, streak) {
    this.hitComboColor = color || null;
    this.hitComboStreak = Math.max(0, Math.floor(Number(streak) || 0));
    this.lastComboReward = null;
  }

  debugPopBalloon(color = "red") {
    const balloon = makeDebugBalloon({
      id: `debug-combo-${this.totalPopped + 1}`,
      x: this.player.x,
      y: this.player.y + 48,
      color,
      radius: 30,
    });
    this.balloons = [balloon];
    this.debugBalloonOverride = true;
    this.#popBalloon(balloon);
  }

  setSpeedRampEnabled(enabled) {
    this.speedRampEnabled = Boolean(enabled);
    this.#updateSpeedMultiplier();
    return this.speedRampEnabled;
  }

  debugSetFallPeak(heightMeters) {
    this.fallPeakHeight = Math.max(0, Number(heightMeters) || 0);
    this.reentryStage = 0;
  }

  debugFinishRun(scoreMeters = this.bestHeight) {
    this.bestHeight = Math.max(0, Number(scoreMeters) || 0);
    this.hasPoppedBalloon = true;
    this.#enterGameOver();
  }

  debugSetSavedBest(scoreMeters, persist = false) {
    this.savedBestHeight = Math.max(0, Math.floor(Number(scoreMeters) || 0));
    if (persist) {
      writeSavedBest(this.savedBestHeight);
    }
  }

  debugSpawnShootingStar() {
    this.#spawnShootingStar();
  }

  debugSpawnAmbientFlyby(type) {
    this.shootingStars = [];
    return copyAmbientFlyby(this.#spawnAmbientFlyby(type));
  }

  debugSetAmbientFlybyTimer(type, seconds = 0) {
    if (!(type in AMBIENT_FLYBYS)) {
      throw new Error(`Unknown ambient flyby: ${String(type)}`);
    }
    this.ambientFlybyTimers[type] = Math.max(0, Number(seconds) || 0);
    return this.ambientFlybyTimers[type];
  }

  debugClearAmbientFlyby() {
    this.ambientFlyby = null;
  }

  setLeaderboard(snapshot = {}) {
    this.leaderboard = {
      ...this.leaderboard,
      ...snapshot,
      topScores: (snapshot.topScores || this.leaderboard.topScores || []).map(
        (entry) => ({ ...entry }),
      ),
    };
    this.savedBestHeight = Math.max(
      this.savedBestHeight,
      Math.floor(Number(this.leaderboard.localBest) || 0),
    );
    this.#syncLeaderboardBalloons();
  }

  isNameEntryActive() {
    return Boolean(
      this.deathView === "leaderboard" &&
        this.nameEntry &&
        !this.nameEntry.done,
    );
  }

  openLeaderboard() {
    if (this.mode !== "gameover") {
      return false;
    }
    this.deathView = "leaderboard";
    this.#emit("ui");
    return true;
  }

  showDeathSummary() {
    if (this.mode !== "gameover") {
      return false;
    }
    this.deathView = "summary";
    this.#emit("ui");
    return true;
  }

  cycleNameEntry(direction) {
    const changed = this.isNameEntryActive()
      ? this.nameEntry.cycle(direction)
      : false;
    if (changed) {
      this.#emit("ui");
    }
    return changed;
  }

  backspaceNameEntry() {
    const changed = this.isNameEntryActive()
      ? this.nameEntry.backspace()
      : false;
    if (changed) {
      this.#emit("ui");
    }
    return changed;
  }

  typeNameEntryCharacter(character) {
    const changed = this.isNameEntryActive()
      ? this.nameEntry.typeCharacter(character)
      : false;
    if (changed) {
      this.#emit("ui");
    }
    return changed;
  }

  submitTypedInitials(value) {
    if (
      this.mode !== "gameover" ||
      this.deathView !== "leaderboard" ||
      !this.qualifiesForLeaderboard ||
      this.nameEntrySubmitted
    ) {
      return "unavailable";
    }
    const typed = String(value || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 3);
    if (typed.length !== 3) {
      return "length";
    }
    const entry = new NameEntry(typed);
    if (entry.blocked) {
      this.nameEntry = null;
      this.#emit("invalidInitials");
      return "blocked";
    }
    this.nameEntry = entry;
    entry.confirming = true;
    entry.done = true;
    this.nameEntrySubmitted = true;
    this.#emit("scoreSubmit");
    return "submitted";
  }

  advanceNameEntry() {
    if (!this.isNameEntryActive()) {
      return false;
    }
    const result = this.nameEntry.advance();
    if (result === "blocked") {
      this.#emit("invalidInitials");
    } else if (result === "submit" && !this.nameEntrySubmitted) {
      this.nameEntrySubmitted = true;
      this.#emit("scoreSubmit");
    } else {
      this.#emit("ui");
    }
    return true;
  }

  #performAction() {
    const player = this.player;
    if (player.onGround) {
      player.vy = -PLAYER.groundJumpSpeed;
      player.onGround = false;
      player.cooldown = 0.08;
      this.#emit("jump");
      return;
    }
    if (player.cooldown > 0) {
      return;
    }
    player.slashTimer = PLAYER.slashTime;
    player.cooldown = PLAYER.slashTime + PLAYER.slashCooldown;
    this.#emit("slash");
  }

  #popBalloon(balloon) {
    balloon.alive = false;
    balloon.poppedTimer = 0.001;
    const isLeaderboardBalloon = balloon.routeRole === "leaderboard";
    if (isLeaderboardBalloon) {
      this.poppedLeaderboardBalloonIds.add(balloon.id);
    } else if (!this.debugBalloonOverride) {
      this.poppedBalloonIds.add(balloon.id);
    }
    this.hasPoppedBalloon = true;
    this.totalPopped += 1;

    let bounceSpeed = PLAYER.bounceSpeed;
    let reward = null;
    if (balloon.color === this.hitComboColor) {
      this.hitComboStreak += 1;
    } else {
      this.hitComboColor = balloon.color;
      this.hitComboStreak = 1;
    }
    this.bestComboStreak = Math.max(
      this.bestComboStreak,
      this.hitComboStreak,
    );
    if (this.hitComboStreak >= COMBO.comboStreak) {
      bounceSpeed = COMBO.comboBounceSpeed;
      reward = "combo!";
    } else if (this.hitComboStreak >= COMBO.matchStreak) {
      bounceSpeed = COMBO.matchBounceSpeed;
      reward = "match!";
    }
    this.lastComboReward = reward;
    this.popEffects.push({
      x: balloon.x,
      y: balloon.y,
      age: 0,
      color: balloon.color,
      boosted: Boolean(reward) || isLeaderboardBalloon,
    });
    if (reward) {
      this.comboFeedbacks.push({
        x: balloon.x,
        y: balloon.y,
        age: 0,
        color: balloon.color,
        label: reward,
      });
    }

    this.#bounce(bounceSpeed * this.speedMultiplier);
    this.fallPeakHeight = this.currentHeight;
    this.reentryStage = 0;
    this.hitPauseTimer = COLLISION.hitPauseSeconds;
    this.#emit("balloonPop");
    if (reward === "match!") {
      this.#emit("match");
    } else if (reward === "combo!") {
      this.#emit("combo");
    }
    this.#emit("bounce");
  }

  #clearGoalMarker(marker) {
    marker.alive = false;
    marker.reached = true;
    marker.poppedTimer = 0.001;
    this.hasPoppedBalloon = true;
    this.totalLandmarksCleared += 1;
    this.popEffects.push({
      x: marker.x,
      y: marker.y + marker.hitOffsetY,
      age: 0,
      color: "goal",
      boosted: true,
    });
    this.#bounce(GOALS.bounceSpeed * this.speedMultiplier);
    this.fallPeakHeight = this.currentHeight;
    this.reentryStage = 0;
    this.hitPauseTimer = COLLISION.hitPauseSeconds;
    this.#emit("landmarkClear");
    this.#emit("bounce");
  }

  #updatePlayer(dt, direction) {
    const player = this.player;
    const speed = this.speedMultiplier;
    if (direction) {
      player.facing = direction;
      player.vx += direction * PLAYER.moveAcceleration * speed * dt;
    } else {
      player.vx *= PLAYER.airDragPerStep;
    }
    player.vx = clamp(
      player.vx,
      -PLAYER.maxRunSpeed * speed,
      PLAYER.maxRunSpeed * speed,
    );
    player.vy += PLAYER.gravity * speed * dt;

    if (
      this.#isSlashing() &&
      this.#slashProgress() >= PLAYER.slashWindupRatio
    ) {
      player.vy = Math.max(player.vy, PLAYER.slashDiveSpeed * speed);
    }

    player.x += player.vx * dt;
    player.y += player.vy * dt;

    if (player.x < -PLAYER.wrapPadding) {
      player.x = GAME_WIDTH + PLAYER.wrapPadding;
    } else if (player.x > GAME_WIDTH + PLAYER.wrapPadding) {
      player.x = -PLAYER.wrapPadding;
    }

    const floorPlayerY = WORLD_FLOOR_Y - PLAYER.height * 0.5;
    if (player.y > floorPlayerY) {
      player.y = floorPlayerY;
      player.vy = 0;
      player.onGround = true;
    } else {
      player.onGround = false;
    }

    player.slashTimer = Math.max(0, player.slashTimer - dt);
    player.cooldown = Math.max(0, player.cooldown - dt);
  }

  #updateReentryState() {
    const height = this.currentHeight;
    const player = this.player;
    if (player.onGround) {
      this.fallPeakHeight = height;
      this.reentryStage = 0;
      return;
    }
    if (player.vy <= 0) {
      this.fallPeakHeight = Math.max(this.fallPeakHeight, height);
      this.reentryStage = 0;
      return;
    }

    const fallDistance = Math.max(0, this.fallPeakHeight - height);
    if (
      height < REENTRY.minimumHeightMeters &&
      this.reentryStage === 0
    ) {
      return;
    }
    if (
      player.vy < REENTRY.minimumFallSpeed &&
      this.reentryStage === 0
    ) {
      return;
    }
    if (fallDistance >= REENTRY.minimumFallDistanceMeters) {
      this.reentryStage = Math.max(this.reentryStage, 1);
    }
  }

  #updateSpeedMultiplier() {
    if (!this.speedRampEnabled) {
      this.speedMultiplier = 1;
      return;
    }
    this.speedMultiplier = Math.min(
      SPEED_RAMP.maximumMultiplier,
      1 + this.currentHeight / SPEED_RAMP.referenceHeightMeters,
    );
  }

  #nextShootingStarDelay(height) {
    const band =
      SHOOTING_STARS.intervals.find(
        ({ minimum, maximum }) =>
          height >= minimum && height < maximum,
      ) || SHOOTING_STARS.intervals.at(-1);
    return this.visualRandom.uniform(band.delay[0], band.delay[1]);
  }

  #spawnShootingStar() {
    const height = this.viewportHeight;
    const travelsRight =
      this.visualRandom.unit() < SHOOTING_STARS.travelsRightChance;
    let x;
    let y;
    let angle;
    if (travelsRight) {
      const startsAtTop = this.visualRandom.choice(["top", "left"]) === "top";
      if (startsAtTop) {
        x = this.visualRandom.uniform(-GAME_WIDTH * 0.05, GAME_WIDTH * 0.82);
        y = this.visualRandom.uniform(-40, height * 0.18);
      } else {
        x = this.visualRandom.uniform(-70, GAME_WIDTH * 0.22);
        y = this.visualRandom.uniform(height * 0.05, height * 0.42);
      }
      angle = this.visualRandom.uniform(
        (24 * Math.PI) / 180,
        (48 * Math.PI) / 180,
      );
    } else {
      const startsAtTop = this.visualRandom.choice(["top", "right"]) === "top";
      if (startsAtTop) {
        x = this.visualRandom.uniform(GAME_WIDTH * 0.18, GAME_WIDTH * 1.05);
        y = this.visualRandom.uniform(-40, height * 0.18);
      } else {
        x = this.visualRandom.uniform(GAME_WIDTH * 0.78, GAME_WIDTH + 70);
        y = this.visualRandom.uniform(height * 0.05, height * 0.42);
      }
      angle = this.visualRandom.uniform(
        (132 * Math.PI) / 180,
        (156 * Math.PI) / 180,
      );
    }
    const speed = this.visualRandom.uniform(
      SHOOTING_STARS.speedMin,
      SHOOTING_STARS.speedMax,
    );
    this.shootingStars.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      lifetime:
        SHOOTING_STARS.lifetimeSeconds *
        this.visualRandom.uniform(0.82, 1.14),
      length: this.visualRandom.uniform(
        SHOOTING_STARS.lengthMin,
        SHOOTING_STARS.lengthMax,
      ),
      width: this.visualRandom.choice([2, 2, 3]),
    });
  }

  #updateShootingStars(dt) {
    const height = this.currentHeight;
    if (
      this.mode !== "menu" &&
      height >= SHOOTING_STARS.minimumHeightMeters &&
      this.shootingStars.length === 0 &&
      !this.ambientFlyby
    ) {
      this.shootingStarTimer -= dt;
      if (this.shootingStarTimer <= 0) {
        this.#spawnShootingStar();
        this.shootingStarTimer = this.#nextShootingStarDelay(height);
      }
    }
    for (const star of this.shootingStars) {
      star.age += dt;
      star.x += star.vx * dt;
      star.y += star.vy * dt;
    }
    this.shootingStars = this.shootingStars.filter(
      (star) =>
        star.age < star.lifetime &&
        star.x > -160 &&
        star.y < this.viewportHeight + 160,
    );
  }

  #eligibleAmbientFlybyType(height) {
    for (const type of ["bird", "saucer"]) {
      const config = AMBIENT_FLYBYS[type];
      if (
        height >= config.minimumHeightMeters &&
        height < config.maximumHeightMeters
      ) {
        return type;
      }
    }
    return null;
  }

  #nextAmbientFlybyDelay(type) {
    const config = AMBIENT_FLYBYS[type];
    if (!config) {
      throw new Error(`Unknown ambient flyby: ${String(type)}`);
    }
    return this.ambientRandom.uniform(
      config.delaySeconds[0],
      config.delaySeconds[1],
    );
  }

  #spawnAmbientFlyby(type) {
    const config = AMBIENT_FLYBYS[type];
    if (!config) {
      throw new Error(`Unknown ambient flyby: ${String(type)}`);
    }
    const direction = this.ambientRandom.unit() < 0.5 ? 1 : -1;
    const speed = this.ambientRandom.uniform(
      config.speed[0],
      config.speed[1],
    );
    const travelDistance = GAME_WIDTH + config.travelMargin * 2;
    const baseY = this.ambientRandom.uniform(
      this.viewportHeight * config.screenYRatio[0],
      this.viewportHeight * config.screenYRatio[1],
    );
    const flyby = {
      type,
      x:
        direction > 0
          ? -config.travelMargin
          : GAME_WIDTH + config.travelMargin,
      y: baseY,
      baseY,
      vx: direction * speed,
      direction,
      age: 0,
      lifetime: travelDistance / speed,
      rotation: 0,
      wing: 0,
      blink: 0,
      scale: this.ambientRandom.uniform(
        config.scale[0],
        config.scale[1],
      ),
      verticalDrift: 0,
      flapRate: 0,
      flapOffset: 0,
      glideRate: 0,
      glideOffset: 0,
      bobAmplitude: 0,
      bobCycles: 0,
    };
    if (type === "bird") {
      flyby.verticalDrift = this.ambientRandom.uniform(
        config.verticalDrift[0],
        config.verticalDrift[1],
      );
      flyby.flapRate = this.ambientRandom.uniform(
        config.flapRate[0],
        config.flapRate[1],
      );
      flyby.flapOffset = this.ambientRandom.unit();
      flyby.glideRate = this.ambientRandom.uniform(
        config.glideRate[0],
        config.glideRate[1],
      );
      flyby.glideOffset = this.ambientRandom.unit();
    } else {
      flyby.bobAmplitude = this.ambientRandom.uniform(
        config.bobAmplitude[0],
        config.bobAmplitude[1],
      );
      flyby.bobCycles = this.ambientRandom.uniform(
        config.bobCycles[0],
        config.bobCycles[1],
      );
    }
    this.ambientFlyby = flyby;
    this.ambientFlybyCounts[type] += 1;
    this.ambientFlybyTimers[type] = this.#nextAmbientFlybyDelay(type);
    return flyby;
  }

  #updateAmbientFlyby(dt) {
    if (this.mode !== "playing") {
      this.ambientFlyby = null;
      return;
    }
    const flyby = this.ambientFlyby;
    if (flyby) {
      flyby.age += dt;
      flyby.x += flyby.vx * dt;
      const progress = clamp(flyby.age / flyby.lifetime, 0, 1);
      if (flyby.type === "bird") {
        const flapAngle =
          (flyby.age * flyby.flapRate + flyby.flapOffset) *
          Math.PI *
          2;
        const glideAngle =
          (flyby.age * flyby.glideRate + flyby.glideOffset) *
          Math.PI *
          2;
        flyby.wing = Math.sin(flapAngle);
        flyby.y =
          flyby.baseY +
          flyby.verticalDrift * progress +
          Math.sin(glideAngle) * 2.4 -
          Math.max(0, flyby.wing) * 0.7;
        const verticalVelocity =
          flyby.verticalDrift / flyby.lifetime +
          Math.cos(glideAngle) *
            2.4 *
            flyby.glideRate *
            Math.PI *
            2;
        flyby.rotation = clamp(
          verticalVelocity / Math.abs(flyby.vx),
          -0.08,
          0.08,
        );
      } else {
        const bobAngle = progress * flyby.bobCycles * Math.PI * 2;
        flyby.y =
          flyby.baseY + Math.sin(bobAngle) * flyby.bobAmplitude;
        const verticalVelocity =
          (Math.cos(bobAngle) *
            flyby.bobAmplitude *
            flyby.bobCycles *
            Math.PI *
            2) /
          flyby.lifetime;
        flyby.rotation = clamp(
          verticalVelocity / Math.abs(flyby.vx),
          -0.11,
          0.11,
        );
        flyby.blink =
          0.5 +
          Math.sin(flyby.age * Math.PI * 2 * 2.2) * 0.5;
      }
      if (flyby.age >= flyby.lifetime) {
        this.ambientFlyby = null;
      }
      return;
    }

    if (this.shootingStars.length > 0) {
      return;
    }
    const eligibleType = this.#eligibleAmbientFlybyType(this.currentHeight);
    if (!eligibleType) {
      return;
    }
    this.ambientFlybyTimers[eligibleType] -= dt;
    if (this.ambientFlybyTimers[eligibleType] <= 0) {
      this.#spawnAmbientFlyby(eligibleType);
    }
  }

  #syncLeaderboardBalloons() {
    const currentById = new Map(
      this.leaderboardBalloons.map((balloon) => [balloon.id, balloon]),
    );
    const duplicates = new Map();
    const entries = (this.leaderboard.topScores || [])
      .map((entry) => ({
        initials: String(entry?.initials || "")
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
          .slice(0, 3),
        score: Math.max(0, Math.floor(Number(entry?.score) || 0)),
        timestamp: Math.max(0, Math.floor(Number(entry?.timestamp) || 0)),
      }))
      .filter((entry) => entry.initials.length === 3 && entry.score > 0)
      .slice(0, LEADERBOARD_BALLOONS.limit);

    this.leaderboardBalloons = entries.map((entry, index) => {
      const duplicateKey = [
        entry.initials,
        entry.score,
        entry.timestamp,
      ].join("-");
      const duplicateIndex = duplicates.get(duplicateKey) || 0;
      duplicates.set(duplicateKey, duplicateIndex + 1);
      const id = leaderboardBalloonIdentity(entry, duplicateIndex);
      const current = currentById.get(id);
      const popped = this.poppedLeaderboardBalloonIds.has(id);
      return {
        id,
        x:
          current?.x ??
          LEADERBOARD_BALLOONS.xLanes[
            index % LEADERBOARD_BALLOONS.xLanes.length
          ],
        y: WORLD_FLOOR_Y - entry.score * 10,
        radius:
          LEADERBOARD_BALLOONS.radius +
          (index === 0 ? 4 : index < 3 ? 2 : 0),
        color:
          LEADERBOARD_BALLOONS.colors[
            index % LEADERBOARD_BALLOONS.colors.length
          ],
        wobble: current?.wobble ?? leaderboardBalloonWobble(id),
        routeRole: "leaderboard",
        landmarkApproach: null,
        alive: !popped,
        poppedTimer: popped ? current?.poppedTimer || 1 : 0,
        leaderboardRank: index + 1,
        leaderboardInitials: entry.initials,
        leaderboardScoreMeters: entry.score,
      };
    });
  }

  #maintainRoute() {
    const activeTopY = this.cameraY - ROUTE.spawnAheadPixels;
    const activeBottomY =
      this.cameraY +
      this.viewportHeight +
      ROUTE.retainBelowViewportPixels;
    const generated = this.route.spawnThrough(activeTopY);
    if (generated.length) {
      this.#archiveBalloons(generated);
      if (!this.tutorialBalloonId) {
        this.tutorialBalloonId =
          generated.find((balloon) => balloon.routeRole === "main")?.id ||
          generated[0].id;
      }
    }

    if (this.debugBalloonOverride) {
      this.#maintainDebugBalloons(activeBottomY);
      return;
    }

    const generatedIds = new Set(generated.map((balloon) => balloon.id));
    const currentById = new Map(
      this.balloons.map((balloon) => [balloon.id, balloon]),
    );
    const nearbyRecords = this.#historyBetween(activeTopY, activeBottomY);
    let nextBalloons = nearbyRecords
      .filter((record) => !this.poppedBalloonIds.has(record.id))
      .map((record) => {
        const active = currentById.get(record.id);
        if (active) {
          return active;
        }
        if (!generatedIds.has(record.id)) {
          this.rehydratedBalloonCount += 1;
        }
        return hydrateBalloon(record);
      });

    for (const balloon of this.balloons) {
      if (
        !balloon.alive &&
        balloon.poppedTimer < EFFECTS.popLifetimeSeconds &&
        balloon.y >= activeTopY &&
        balloon.y <= activeBottomY
      ) {
        nextBalloons.push(balloon);
      }
    }

    if (nextBalloons.length > ROUTE.maxActiveBalloons) {
      const viewportCenterY = this.cameraY + this.viewportHeight * 0.5;
      nextBalloons.sort(
        (a, b) =>
          Math.abs(a.y - viewportCenterY) -
            Math.abs(b.y - viewportCenterY) ||
          a.y - b.y,
      );
      nextBalloons = nextBalloons.slice(0, ROUTE.maxActiveBalloons);
    }
    nextBalloons.sort((a, b) => a.y - b.y);

    const nextIds = new Set(nextBalloons.map((balloon) => balloon.id));
    const removedActiveCount = this.balloons.filter(
      (balloon) => !nextIds.has(balloon.id),
    ).length;
    const generatedOutsideActiveWindowCount = generated.filter(
      (balloon) => !nextIds.has(balloon.id),
    ).length;
    this.culledBalloonCount +=
      removedActiveCount + generatedOutsideActiveWindowCount;
    this.balloons = nextBalloons;
    this.peakActiveBalloonCount = Math.max(
      this.peakActiveBalloonCount,
      this.balloons.length,
    );
  }

  #archiveBalloons(balloons) {
    for (const balloon of balloons) {
      const chunkIndex = Math.floor(balloon.y / ROUTE.historyChunkPixels);
      const chunk = this.balloonHistoryChunks.get(chunkIndex) || [];
      chunk.push(archiveBalloon(balloon));
      if (!this.balloonHistoryChunks.has(chunkIndex)) {
        this.balloonHistoryChunks.set(chunkIndex, chunk);
      }
      this.balloonHistoryCount += 1;
    }
  }

  #historyBetween(topY, bottomY) {
    const firstChunk = Math.floor(topY / ROUTE.historyChunkPixels);
    const lastChunk = Math.floor(bottomY / ROUTE.historyChunkPixels);
    const records = [];
    this.activeRouteChunkCount = Math.max(0, lastChunk - firstChunk + 1);
    for (
      let chunkIndex = firstChunk;
      chunkIndex <= lastChunk;
      chunkIndex += 1
    ) {
      const chunk = this.balloonHistoryChunks.get(chunkIndex);
      if (!chunk) {
        continue;
      }
      for (const record of chunk) {
        if (record.y >= topY && record.y <= bottomY) {
          records.push(record);
        }
      }
    }
    return records;
  }

  #maintainDebugBalloons(retainThrough) {
    const beforeCull = this.balloons.length;
    this.balloons = this.balloons.filter(
      (balloon) => balloon.y <= retainThrough,
    );
    if (this.balloons.length > ROUTE.maxActiveBalloons) {
      this.balloons.sort((a, b) => a.y - b.y);
      this.balloons = this.balloons.slice(0, ROUTE.maxActiveBalloons);
    }
    this.culledBalloonCount += beforeCull - this.balloons.length;
    this.peakActiveBalloonCount = Math.max(
      this.peakActiveBalloonCount,
      this.balloons.length,
    );
  }

  #enterGameOver() {
    if (this.mode !== "playing") {
      return;
    }
    this.finalScore = Math.floor(this.bestHeight);
    this.newBest = this.finalScore > this.savedBestHeight;
    if (this.newBest) {
      this.savedBestHeight = this.finalScore;
      writeSavedBest(this.savedBestHeight);
    }
    this.qualifiesForLeaderboard = this.finalScore > 0;
    this.nameEntry = null;
    this.nameEntryScore = this.finalScore;
    this.nameEntrySubmitted = false;
    this.deathView = "summary";
    this.player.previousX = this.player.x;
    this.player.previousY = this.player.y;
    this.previousCameraY = this.cameraY;
    this.mode = "gameover";
    this.#emit("gameOver");
  }

  #bounce(speed = PLAYER.bounceSpeed) {
    const player = this.player;
    player.vy = -speed;
    player.slashTimer = 0;
    player.cooldown = 0.04;
  }

  #isSlashing() {
    return this.player.slashTimer > 0;
  }

  #slashProgress() {
    if (!this.#isSlashing()) {
      return 1;
    }
    return 1 - this.player.slashTimer / PLAYER.slashTime;
  }

  #swordSegment() {
    const player = this.player;
    const progress = this.#slashProgress();
    const base = [player.x + player.facing * 14, player.y + 12];
    let tipX;
    let tipY;

    if (progress < PLAYER.slashWindupRatio) {
      const t = progress / PLAYER.slashWindupRatio;
      tipX = player.x + player.facing * (56 - 18 * t);
      tipY = player.y - 8 + 42 * t;
    } else {
      const t =
        (progress - PLAYER.slashWindupRatio) /
        (1 - PLAYER.slashWindupRatio);
      tipX = player.x + player.facing * (38 - 28 * t);
      tipY = player.y + 34 + 56 * t;
    }
    return [base, [tipX, tipY]];
  }

  #swordHitsBalloon(balloon) {
    if (!this.#isSlashing() || !balloon.alive) {
      return false;
    }
    if (
      balloon.y <=
      this.player.y + COLLISION.balloonMustBeBelowPlayerBy
    ) {
      return false;
    }
    return this.#circleHitsSegment(
      balloon.x,
      balloon.y,
      balloon.radius + COLLISION.balloonSwordPadding,
      ...this.#swordSegment(),
    );
  }

  #swordHitsGoalMarker(marker) {
    if (!this.#isSlashing() || !marker.alive) {
      return false;
    }
    const rect = {
      left: marker.x - marker.hitWidth * 0.5,
      right: marker.x + marker.hitWidth * 0.5,
      top: marker.y + marker.hitOffsetY - marker.hitHeight * 0.5,
      bottom: marker.y + marker.hitOffsetY + marker.hitHeight * 0.5,
    };
    if ((rect.top + rect.bottom) * 0.5 <= this.player.y) {
      return false;
    }
    return this.#segmentHitsRect(...this.#swordSegment(), rect);
  }

  #segmentHitsRect(start, end, rect) {
    const [startX, startY] = start;
    const [endX, endY] = end;
    if (
      startX >= rect.left &&
      startX <= rect.right &&
      startY >= rect.top &&
      startY <= rect.bottom
    ) {
      return true;
    }
    if (
      endX >= rect.left &&
      endX <= rect.right &&
      endY >= rect.top &&
      endY <= rect.bottom
    ) {
      return true;
    }

    const edges = [
      [rect.left, rect.top, rect.right, rect.top],
      [rect.right, rect.top, rect.right, rect.bottom],
      [rect.right, rect.bottom, rect.left, rect.bottom],
      [rect.left, rect.bottom, rect.left, rect.top],
    ];
    return edges.some(([x1, y1, x2, y2]) =>
      this.#segmentsIntersect(
        startX,
        startY,
        endX,
        endY,
        x1,
        y1,
        x2,
        y2,
      ),
    );
  }

  #segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
    const cross = (x1, y1, x2, y2) => x1 * y2 - y1 * x2;
    const rX = bx - ax;
    const rY = by - ay;
    const sX = dx - cx;
    const sY = dy - cy;
    const denominator = cross(rX, rY, sX, sY);
    if (denominator === 0) {
      return false;
    }
    const cax = cx - ax;
    const cay = cy - ay;
    const t = cross(cax, cay, sX, sY) / denominator;
    const u = cross(cax, cay, rX, rY) / denominator;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }

  #circleHitsSegment(centerX, centerY, radius, start, end) {
    const [startX, startY] = start;
    const [endX, endY] = end;
    const vectorX = endX - startX;
    const vectorY = endY - startY;
    const lengthSquared = vectorX * vectorX + vectorY * vectorY;
    if (lengthSquared === 0) {
      const dx = centerX - startX;
      const dy = centerY - startY;
      return dx * dx + dy * dy <= radius * radius;
    }

    const projection = clamp(
      ((centerX - startX) * vectorX + (centerY - startY) * vectorY) /
        lengthSquared,
      0,
      1,
    );
    const closestX = startX + vectorX * projection;
    const closestY = startY + vectorY * projection;
    const dx = centerX - closestX;
    const dy = centerY - closestY;
    return dx * dx + dy * dy <= radius * radius;
  }

  #playerSpriteName() {
    if (this.#isSlashing()) {
      return "slash";
    }
    if (this.player.onGround) {
      return "idle";
    }
    if (this.player.vy < -120) {
      return "jump";
    }
    return "fall";
  }

  #updateCamera() {
    const top = this.cameraY + this.viewportHeight * CAMERA.followTopRatio;
    const bottom =
      this.cameraY + this.viewportHeight * CAMERA.followBottomRatio;
    if (this.player.y < top) {
      this.cameraY =
        this.player.y - this.viewportHeight * CAMERA.followTopRatio;
    } else if (this.player.y > bottom) {
      this.cameraY =
        this.player.y - this.viewportHeight * CAMERA.followBottomRatio;
    }
    this.cameraY = Math.min(this.#baseCameraY(), this.cameraY);
  }

  #baseCameraY() {
    return Math.min(
      0,
      WORLD_FLOOR_Y -
        (this.viewportHeight - this.viewportFloorMargin),
    );
  }

  #emit(name) {
    this.eventCounts[name] = (this.eventCounts[name] || 0) + 1;
    this.lastEvent = name;
    this.onEvent?.(name, this.getSnapshot());
  }
}

// Kept as a compatibility export for the Phase 5 regression audit.
export const PhaseFiveGame = PhaseSixGame;
export const PhaseSevenGame = PhaseSixGame;
export const PhaseNineGame = PhaseSixGame;
export const PhaseTenGame = PhaseSixGame;
export const OverTheMoonGame = PhaseSixGame;
