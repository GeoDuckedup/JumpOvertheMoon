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
  PLAY_MODES,
  PLAYER,
  REENTRY,
  REFERENCE_HEIGHT,
  RIVAL_CHASE,
  RIVAL_BOW_SWIPE,
  RIVAL_FIDDLE_DROP,
  RIVAL_FOUNDATION,
  RIVAL_JETPACK,
  RIVAL_ROUTE,
  RIVAL_VERTICAL_BOOST,
  ROUTE,
  SHOOTING_STARS,
  SPEED_RAMP,
  UPPER_COSMOS_CHAPTERS,
  WORLD_FLOOR_Y,
} from "./game-config.js?v=16.0.2";
import { NameEntry } from "./name-entry.js?v=16.0.2";
import { BalloonRoute, SeededRandom } from "./route.js?v=16.0.2";

const BEST_HEIGHT_STORAGE_KEY = "over-the-moon.best-height";

const normalizePlayMode = (value) =>
  value === PLAY_MODES.COW_VS_CAT
    ? PLAY_MODES.COW_VS_CAT
    : PLAY_MODES.CLASSIC;

const scoreStorageKeyForMode = (playMode) =>
  playMode === PLAY_MODES.COW_VS_CAT
    ? RIVAL_FOUNDATION.scoreStorageKey
    : BEST_HEIGHT_STORAGE_KEY;

const clamp = (value, minimum, maximum) =>
  Math.max(minimum, Math.min(maximum, value));

const round = (value, digits = 3) => {
  const power = 10 ** digits;
  return Math.round(value * power) / power;
};

const lerp = (a, b, alpha) => a + (b - a) * alpha;

const smoothstep = (minimum, maximum, value) => {
  const span = Math.max(0.0001, maximum - minimum);
  const alpha = clamp((value - minimum) / span, 0, 1);
  return alpha * alpha * (3 - 2 * alpha);
};

const WRAP_SPAN = GAME_WIDTH + PLAYER.wrapPadding * 2;
const shortestWrappedDelta = (from, to) => {
  let delta = to - from;
  if (delta > WRAP_SPAN * 0.5) {
    delta -= WRAP_SPAN;
  } else if (delta < -WRAP_SPAN * 0.5) {
    delta += WRAP_SPAN;
  }
  return delta;
};

const directDelta = (from, to) => to - from;

const rivalCanBeForceActivated = (rival) =>
  rival.state === "waiting-first-pop" ||
  rival.state === "grace" ||
  rival.state === "recovering";

const rivalVisualFrameFor = (rival) => {
  if (rival.state === "knocked-down") {
    return "knockdown";
  }
  if (rival.attackState === "boost-telegraph") {
    return "boost-charge";
  }
  if (rival.attackState === "boost-active") {
    return "boost-active";
  }
  if (rival.attackState === "fiddle-telegraph") {
    return "fiddle-drop-windup";
  }
  if (rival.attackState === "fiddle-active") {
    return "fiddle-drop-active";
  }
  if (
    rival.attackState === "fiddle-recovery" &&
    rival.attackTimer > RIVAL_FIDDLE_DROP.recoverySeconds * 0.5
  ) {
    return "fiddle-heavy";
  }
  if (rival.attackState === "telegraph") {
    return "bow-windup";
  }
  if (
    rival.attackState === "active" ||
    (rival.attackState === "recovery" &&
      rival.attackTimer > RIVAL_BOW_SWIPE.recoverySeconds * 0.5)
  ) {
    return "bow-slash";
  }
  return "hover";
};

const readSavedBest = (storageKey = BEST_HEIGHT_STORAGE_KEY) => {
  try {
    const value = Number.parseInt(
      globalThis.localStorage?.getItem(storageKey),
      10,
    );
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
};

const writeSavedBest = (
  height,
  storageKey = BEST_HEIGHT_STORAGE_KEY,
) => {
  try {
    globalThis.localStorage?.setItem(
      storageKey,
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

const makeRivalFoundation = (playMode) => {
  const present = playMode === PLAY_MODES.COW_VS_CAT;
  const floorY = WORLD_FLOOR_Y - RIVAL_CHASE.physicsHeight * 0.5;
  return {
    implemented: true,
    present,
    visible: false,
    active: false,
    state: present ? "waiting-first-pop" : "absent",
    x: RIVAL_FOUNDATION.startX,
    y: floorY,
    previousX: RIVAL_FOUNDATION.startX,
    previousY: floorY,
    vx: 0,
    vy: 0,
    facing: -1,
    onGround: true,
    frozen: false,
    movementModel: "jetpack",
    jetpackActive: false,
    chaseSpeedScale: 1,
    graceRemaining: 0,
    entryRemaining: 0,
    pauseRemaining: 0,
    waitingForCow: false,
    nextBreatherSeconds: 0,
    recoveryRemaining: 0,
    recoveryX: RIVAL_FOUNDATION.startX,
    decisionRemaining: 0,
    targetBalloonId: null,
    lastBounceBalloonId: null,
    lastBounceCooldown: 0,
    orbitSide: -1,
    hoverTargetX: RIVAL_FOUNDATION.startX,
    hoverTargetY: floorY,
    attackState: "idle",
    attackKind: "none",
    lastAttackKind: "none",
    attackTimer: 0,
    attackCooldown: present ? RIVAL_BOW_SWIPE.initialDelaySeconds : 0,
    attackDirection: -1,
    attackLockedY: floorY,
    attackHitCow: false,
    attackBalloonPops: 0,
    boostLockedX: RIVAL_FOUNDATION.startX,
    boostHitCow: false,
    boostClanked: false,
    boostBalloonPops: 0,
    fiddleDirectionX: 0,
    fiddleDirectionY: 1,
    fiddleTargetX: RIVAL_FOUNDATION.startX,
    fiddleTargetY: floorY,
    fiddleHitCow: false,
    fiddleBalloonPops: 0,
    exhaustEmitRemaining: 0,
    exhaustTrail: [],
    rubberBandActive: false,
    rubberBandPending: false,
    rubberBandStrength: 0,
    rubberBandScreenY: floorY,
    rubberBandVerticalLag: 0,
    rubberBandOffscreenSeconds: 0,
    rubberBandMaximumOffscreenSeconds: 0,
    postOvertakeHoldRemaining: 0,
    postOvertakeHoldY: floorY,
    overtakeQueued: false,
    boostOvertookCow: false,
    engagedSeconds: 0,
    abovePressureSeconds: 0,
    knockdownRemaining: 0,
    retreatPending: false,
    movementEnabled: present,
    collisionEnabled: false,
    combatEnabled: present,
    stats: {
      entries: 0,
      jumps: 0,
      balloonBounces: 0,
      balloonPops: 0,
      sideBalloonPops: 0,
      mainBalloonPops: 0,
      breathers: 0,
      recoveries: 0,
      edgeTurns: 0,
      bowSwipes: 0,
      verticalBoosts: 0,
      overtakes: 0,
      fiddleDrops: 0,
      cowHits: 0,
      boostCowHits: 0,
      boostClanks: 0,
      boostBalloonPops: 0,
      fiddleCowHits: 0,
      fiddleBalloonPops: 0,
      attackSelections: 0,
      rubberBandActivations: 0,
      rubberBandFailsafes: 0,
      counterHitsTaken: 0,
      counterBouncesAwarded: 0,
      retreats: 0,
    },
    attacksImplemented: Object.freeze({
      bowSwipe: present,
      verticalBoost: present,
      fiddleDrop: present,
      fiddleSmash: present,
      catsConcerto: false,
    }),
  };
};

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

const leaderboardBalloonIdentity = (playMode, entry, duplicateIndex) =>
  [
    "leaderboard-balloon",
    playMode,
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
  constructor({ onEvent, leaderboard, leaderboards } = {}) {
    this.onEvent = onEvent;
    const emptyLeaderboard = {
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
    this.playMode = PLAY_MODES.CLASSIC;
    this.leaderboards = {
      [PLAY_MODES.CLASSIC]: {
        ...emptyLeaderboard,
        ...(leaderboards?.[PLAY_MODES.CLASSIC] || leaderboard || {}),
      },
      [PLAY_MODES.COW_VS_CAT]: {
        ...emptyLeaderboard,
        ...(leaderboards?.[PLAY_MODES.COW_VS_CAT] || {}),
      },
    };
    this.leaderboard = this.leaderboards[this.playMode];
    this.viewportHeight = REFERENCE_HEIGHT;
    this.viewportFloorMargin = CAMERA.tallViewportFloorMargin;
    this.player = makePlayer();
    this.rival = makeRivalFoundation(this.playMode);
    this.balloons = [];
    this.leaderboardBalloons = [];
    this.balloonHistoryChunks = new Map();
    this.balloonHistoryCount = 0;
    this.poppedBalloonIds = new Set();
    this.poppedLeaderboardBalloonIds = new Set();
    this.rehydratedBalloonCount = 0;
    this.activeRouteChunkCount = 0;
    this.rivalRouteBackupCount = 0;
    this.debugBalloonOverride = false;
    this.goalMarkers = makeGoalMarkers();
    this.route = new BalloonRoute(1);
    this.visualRandom = new SeededRandom(1);
    this.ambientRandom = new SeededRandom(2);
    this.rivalRandom = new SeededRandom(3);
    this.runSeed = 1;
    this.cameraY = 0;
    this.previousCameraY = 0;
    this.hitPauseTimer = 0;
    this.bestHeight = 0;
    this.savedBestByMode = {
      [PLAY_MODES.CLASSIC]: Math.max(
        readSavedBest(BEST_HEIGHT_STORAGE_KEY),
        Math.floor(
          Number(this.leaderboards[PLAY_MODES.CLASSIC].localBest) || 0,
        ),
      ),
      [PLAY_MODES.COW_VS_CAT]: Math.max(
        readSavedBest(RIVAL_FOUNDATION.scoreStorageKey),
        Math.floor(
          Number(this.leaderboards[PLAY_MODES.COW_VS_CAT].localBest) || 0,
        ),
      ),
    };
    this.savedBestHeight = this.savedBestByMode[this.playMode];
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

  start(seed = createRunSeed(), playMode = this.playMode) {
    this.runId += 1;
    this.playMode = normalizePlayMode(playMode);
    this.leaderboard = this.leaderboards[this.playMode];
    this.runSeed = Number(seed) >>> 0 || 1;
    this.player = makePlayer();
    this.rival = makeRivalFoundation(this.playMode);
    this.savedBestHeight = this.savedBestByMode[this.playMode] || 0;
    this.balloons = [];
    this.leaderboardBalloons = [];
    this.balloonHistoryChunks = new Map();
    this.balloonHistoryCount = 0;
    this.poppedBalloonIds = new Set();
    this.poppedLeaderboardBalloonIds = new Set();
    this.rehydratedBalloonCount = 0;
    this.activeRouteChunkCount = 0;
    this.rivalRouteBackupCount = 0;
    this.debugBalloonOverride = false;
    this.goalMarkers = makeGoalMarkers();
    this.route.reset(this.runSeed);
    this.visualRandom = new SeededRandom(
      (this.runSeed ^ 0x9e3779b9) >>> 0 || 1,
    );
    this.ambientRandom = new SeededRandom(
      (this.runSeed ^ 0x85ebca6b) >>> 0 || 1,
    );
    this.rivalRandom = new SeededRandom(
      (this.runSeed ^ 0xc2b2ae35) >>> 0 || 1,
    );
    this.rival.nextBreatherSeconds = this.#nextRivalBreatherDelay();
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
    this.rival.previousX = this.rival.x;
    this.rival.previousY = this.rival.y;
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
    this.#updateRival(dt);
    this.#updateReentryState();
    for (const balloon of this.balloons) {
      balloon.wobble += dt * 4 * this.speedMultiplier;
    }
    for (const balloon of this.leaderboardBalloons) {
      balloon.wobble += dt * 4 * this.speedMultiplier;
    }

    if (this.#swordHitsRival()) {
      this.#knockDownRival();
    } else {
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
      playMode: this.playMode,
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
      rival: {
        implemented: this.rival.implemented,
        present: this.rival.present,
        visible: this.rival.visible,
        active: this.rival.active,
        state: this.rival.state,
        waitingForFirstCowPop:
          this.rival.state === "waiting-first-pop",
        x: round(this.rival.x),
        y: round(this.rival.y),
        vx: round(this.rival.vx),
        vy: round(this.rival.vy),
        width: RIVAL_CHASE.physicsWidth,
        height: RIVAL_CHASE.physicsHeight,
        facing: this.rival.facing,
        onGround: this.rival.onGround,
        frozen: this.rival.frozen,
        movementModel: this.rival.movementModel,
        jetpackActive: this.rival.jetpackActive,
        visualFrame: rivalVisualFrameFor(this.rival),
        chaseSpeedScale: round(this.rival.chaseSpeedScale, 2),
        graceRemainingSeconds: round(this.rival.graceRemaining, 3),
        entryRemainingSeconds: round(this.rival.entryRemaining, 3),
        breatherRemainingSeconds: round(this.rival.pauseRemaining, 3),
        waitingForCow: this.rival.waitingForCow,
        nextBreatherSeconds: round(this.rival.nextBreatherSeconds, 3),
        recoveryRemainingSeconds: round(this.rival.recoveryRemaining, 3),
        recoveryX: round(this.rival.recoveryX),
        orbitSide: this.rival.orbitSide,
        hoverTarget: {
          x: round(this.rival.hoverTargetX),
          y: round(this.rival.hoverTargetY),
        },
        rubberBand: {
          active: this.rival.rubberBandActive,
          pending: this.rival.rubberBandPending,
          strength: round(this.rival.rubberBandStrength, 3),
          verticalScale: round(
            lerp(
              1,
              RIVAL_JETPACK.rubberBandMaximumVerticalScale,
              this.rival.rubberBandStrength,
            ),
            3,
          ),
          screenY: round(this.rival.rubberBandScreenY),
          verticalLag: round(this.rival.rubberBandVerticalLag),
          offscreenSeconds: round(
            this.rival.rubberBandOffscreenSeconds,
            3,
          ),
          maximumOffscreenSeconds: round(
            this.rival.rubberBandMaximumOffscreenSeconds,
            3,
          ),
        },
        verticalPressure: {
          relation:
            this.player.y - this.rival.y >=
            RIVAL_JETPACK.abovePressureMinimumLead
              ? "above"
              : this.rival.y - this.player.y >=
                  RIVAL_JETPACK.overtakeTriggerBelowDistance
                ? "below"
                : "level",
          leadAboveCow: round(this.player.y - this.rival.y),
          targetMinimumLead: RIVAL_JETPACK.abovePressureMinimumLead,
          overtakeQueued:
            this.rival.overtakeQueued,
          postOvertakeHoldRemainingSeconds: round(
            this.rival.postOvertakeHoldRemaining,
            3,
          ),
          postOvertakeHoldY: round(this.rival.postOvertakeHoldY),
          engagedSeconds: round(this.rival.engagedSeconds, 3),
          abovePressureSeconds: round(
            this.rival.abovePressureSeconds,
            3,
          ),
          abovePressureRatio: round(
            this.rival.engagedSeconds > 0
              ? this.rival.abovePressureSeconds /
                  this.rival.engagedSeconds
              : 0,
            3,
          ),
        },
        attack: {
          kind: this.rival.attackKind,
          state: this.rival.attackState,
          timerSeconds: round(this.rival.attackTimer, 3),
          cooldownSeconds: round(this.rival.attackCooldown, 3),
          direction: this.rival.attackDirection,
          bowLaneY: round(this.rival.attackLockedY),
          hitCow: this.rival.attackHitCow,
          balloonsPopped: this.rival.attackBalloonPops,
          telegraphSeconds: RIVAL_BOW_SWIPE.telegraphSeconds,
          activeSeconds: RIVAL_BOW_SWIPE.activeSeconds,
          recoverySeconds: RIVAL_BOW_SWIPE.recoverySeconds,
          boostTelegraphSeconds: RIVAL_VERTICAL_BOOST.telegraphSeconds,
          boostActiveSeconds: RIVAL_VERTICAL_BOOST.activeSeconds,
          boostRecoverySeconds: RIVAL_VERTICAL_BOOST.recoverySeconds,
          boostHitHalfWidth: RIVAL_VERTICAL_BOOST.hitHalfWidth,
          boostHitReachAbove: RIVAL_VERTICAL_BOOST.hitReachAbove,
          boostKnockbackHorizontal:
            RIVAL_VERTICAL_BOOST.cowKnockbackHorizontal,
          boostKnockbackDown: RIVAL_VERTICAL_BOOST.cowKnockbackDown,
          boostKnockbackDownAdd:
            RIVAL_VERTICAL_BOOST.cowKnockbackDownAdd,
          boostHitCow: this.rival.boostHitCow,
          boostClanked: this.rival.boostClanked,
          boostBalloonsPopped: this.rival.boostBalloonPops,
          fiddleTelegraphSeconds: RIVAL_FIDDLE_DROP.telegraphSeconds,
          fiddleActiveSeconds: RIVAL_FIDDLE_DROP.activeSeconds,
          fiddleRecoverySeconds: RIVAL_FIDDLE_DROP.recoverySeconds,
          fiddleDirection: {
            x: round(this.rival.fiddleDirectionX, 4),
            y: round(this.rival.fiddleDirectionY, 4),
          },
          fiddleTarget: {
            x: round(this.rival.fiddleTargetX),
            y: round(this.rival.fiddleTargetY),
          },
          fiddleHitCow: this.rival.fiddleHitCow,
          fiddleBalloonsPopped: this.rival.fiddleBalloonPops,
        },
        exhaustTrail: this.rival.exhaustTrail.map((point) => ({
          x: round(point.x),
          y: round(point.y),
          ageSeconds: round(point.age, 3),
          facing: point.facing,
          visualFrame: point.visualFrame,
          intensity: round(point.intensity, 2),
        })),
        knockdownRemainingSeconds: round(
          this.rival.knockdownRemaining,
          3,
        ),
        retreatPending: this.rival.retreatPending,
        targetBalloonId: this.rival.targetBalloonId,
        lastBounceBalloonId: this.rival.lastBounceBalloonId,
        stats: { ...this.rival.stats },
        movementEnabled: this.rival.movementEnabled,
        collisionEnabled: this.rival.collisionEnabled,
        combatEnabled: this.rival.combatEnabled,
        attacksImplemented: { ...this.rival.attacksImplemented },
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
      scoreIsolation: {
        namespace: this.playMode,
        storageKey: scoreStorageKeyForMode(this.playMode),
        localBestEnabled: true,
        remoteLeaderboardEnabled: true,
        remoteScoresPath: this.leaderboard.scoresPath || null,
        modeSeparated: true,
      },
      leaderboard: {
        ...this.leaderboard,
        topScores: (this.leaderboard.topScores || []).map((entry) => ({
          ...entry,
        })),
      },
      leaderboards: Object.fromEntries(
        Object.entries(this.leaderboards).map(([playMode, snapshot]) => [
          playMode,
          {
            ...snapshot,
            topScores: (snapshot.topScores || []).map((entry) => ({
              ...entry,
            })),
          },
        ]),
      ),
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
        combatRedundancyEnabled:
          this.playMode === PLAY_MODES.COW_VS_CAT,
        combatBackupBalloonCount: this.rivalRouteBackupCount,
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
        modeSpecific: true,
        rivalProtected: true,
      },
      phaseEleven: {
        cowVsCatFoundationImplemented: true,
        publicMenuVisible: true,
        devEntryOnly: false,
        rivalConceptAsset: "rival-cat-jetpack-hover",
        rivalMovementImplemented: true,
        rivalCombatImplemented: true,
        classicScoreIsolationImplemented: true,
      },
      phaseSixteen: {
        publicCowVsCatImplemented: true,
        sharedCoreGameImplemented: true,
        modeSpecificLeaderboardsImplemented: true,
        modeSpecificOfflineQueuesImplemented: true,
        modeSpecificScoreBalloonsImplemented: true,
        mainMenuFromResultsImplemented: true,
        rivalArrivalAfterFirstCowPopImplemented: true,
      },
      phaseTwelve: {
        pursuitMovementImplemented: true,
        openingGraceImplemented: true,
        balloonTraversalImplemented: false,
        balloonTraversalConsumesBalloons: false,
        catPopsAffectCowScoreOrCombo: false,
        protectedCowRouteImplemented: false,
        breatherRhythmImplemented: true,
        softEngagementBandImplemented: true,
        offscreenRecoveryImplemented: true,
        recoveryUsesVisibleScreenBoundary: true,
        rivalHorizontalWrapEnabled: false,
        artificialRivalShadow: false,
        devFreezeAndSpeedControlsImplemented: true,
        cowCollisionImplemented: false,
        rivalCombatImplemented: true,
        supersededByJetpackPursuit: true,
      },
      phaseThirteen: {
        jetpackPursuitImplemented: true,
        balloonTraversalRequired: false,
        bowSwipeImplemented: true,
        telegraphActiveRecoveryWindows: true,
        swipePopsBalloons: true,
        touchDoesNotPopBalloons: true,
        cowDownwardKnockbackImplemented: true,
        counterFromAboveImplemented: true,
        threeCounterRetreatImplemented: true,
        combatRouteRedundancyImplemented: true,
        landmarkApproachProtectionImplemented: true,
        catPopsAffectCowScoreOrCombo: false,
        generatedActionSpriteSetImplemented: true,
        animatedJetFlamesImplemented: true,
        installedVisualFrames: [
          "hover",
          "bow-windup",
          "bow-slash",
          "fiddle-heavy",
          "concerto",
          "knockdown",
        ],
        fiddleSmashImplemented: false,
        catsConcertoImplemented: false,
      },
      phaseFourteen: {
        perFrameNozzleAnchorsImplemented: true,
        persistentHeatHazeTrailImplemented: true,
        counterBounceImplemented: true,
        counterBouncePreservesCombo: true,
        counterBounceNormalBalloonRatio:
          RIVAL_JETPACK.counterBounceSpeed / PLAYER.bounceSpeed,
        verticalBoostImplemented: true,
        verticalBoostLocksTrajectory: true,
        verticalBoostClankImplemented: true,
        verticalBoostClankNormalBalloonRatio:
          RIVAL_VERTICAL_BOOST.clankBounceSpeed / PLAYER.bounceSpeed,
        verticalBoostClankPreservesCombo: true,
        verticalBoostPopsMaximum:
          RIVAL_VERTICAL_BOOST.maximumBalloonPopsPerBoost,
        protectedLandmarkAndLeaderboardBalloons: true,
        boostVisualFrames: ["boost-charge", "boost-active"],
      },
      phaseFifteen: {
        widerMovingOrbitImplemented: true,
        minimumNeutralSideDistance:
          RIVAL_JETPACK.hoverSideDistance -
          RIVAL_JETPACK.hoverSideWanderAmplitude,
        maximumNeutralSideDistance:
          RIVAL_JETPACK.hoverSideDistance +
          RIVAL_JETPACK.hoverSideWanderAmplitude,
        weightedAttackDirectorImplemented: true,
        repeatAttackPreventionImplemented: true,
        attackWeights: {
          bowSwipe: RIVAL_BOW_SWIPE.selectionWeight,
          verticalBoost: RIVAL_VERTICAL_BOOST.selectionWeight,
          fiddleDrop: RIVAL_FIDDLE_DROP.selectionWeight,
        },
        fiddleDropImplemented: true,
        fiddleDropLocksTrajectory: true,
        fiddleDropPopsMaximum:
          RIVAL_FIDDLE_DROP.maximumBalloonPopsPerDrop,
        protectedLandmarkAndLeaderboardBalloons: true,
        fiddleDropVisualFrames: [
          "fiddle-drop-windup",
          "fiddle-drop-active",
        ],
        cameraRelativeRubberBandImplemented: true,
        rubberBandBeginsWhileVisible: true,
        rubberBandBottomStartRatio:
          RIVAL_JETPACK.rubberBandBottomStartRatio,
        rubberBandMaximumVerticalScale:
          RIVAL_JETPACK.rubberBandMaximumVerticalScale,
        attackSelectionSuppressedDuringCatchUp: true,
        committedAttackTrajectoriesPreserved: true,
        rubberBandFailsafeSeconds:
          RIVAL_JETPACK.rubberBandFailsafeSeconds,
        aboveRoutePressureImplemented: true,
        neutralLeadAboveCow: Math.abs(RIVAL_JETPACK.hoverVerticalOffset),
        overtakeBoostPriorityImplemented: true,
        postOvertakeVulnerabilitySeconds:
          RIVAL_JETPACK.postOvertakeHoldSeconds,
      },
    };
  }

  getRenderState(interpolation) {
    const alpha = clamp(Number(interpolation) || 0, 0, 1);
    const player = this.player;
    const rival = this.rival;
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
      rival: {
        ...snapshot.rival,
        renderX: lerp(rival.previousX, rival.x, alpha),
        renderY: lerp(rival.previousY, rival.y, alpha),
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

  debugSetRival(values = {}) {
    if (this.playMode !== PLAY_MODES.COW_VS_CAT) {
      return null;
    }
    if (
      values.skipGrace === true &&
      rivalCanBeForceActivated(this.rival)
    ) {
      this.#activateRival(this.rival.state === "recovering");
    }
    if (values.forceRecovery === true && this.rival.active) {
      this.#beginRivalRecovery();
    }
    if (Number.isFinite(Number(values.chaseSpeedScale))) {
      this.rival.chaseSpeedScale = clamp(
        Number(values.chaseSpeedScale),
        RIVAL_CHASE.speedMinimum,
        RIVAL_CHASE.speedMaximum,
      );
    }
    if (Number.isFinite(Number(values.breatherInSeconds))) {
      this.rival.nextBreatherSeconds = Math.max(
        0,
        Number(values.breatherInSeconds),
      );
    }
    if (Number.isFinite(Number(values.pauseRemaining))) {
      this.rival.pauseRemaining = Math.max(
        0,
        Number(values.pauseRemaining),
      );
    }
    if (Number.isFinite(Number(values.attackCooldown))) {
      this.rival.attackCooldown = Math.max(
        0,
        Number(values.attackCooldown),
      );
    }
    if (values.orbitSide === -1 || values.orbitSide === 1) {
      this.rival.orbitSide = values.orbitSide;
    }
    if (typeof values.frozen === "boolean") {
      if (values.frozen && rivalCanBeForceActivated(this.rival)) {
        this.#activateRival(false);
      }
      this.rival.frozen = values.frozen;
      if (values.frozen) {
        this.rival.state = "frozen";
        this.rival.visible = true;
        this.rival.active = true;
        this.rival.vx = 0;
        this.rival.vy = 0;
        this.rival.jetpackActive = false;
      } else if (this.rival.active) {
        this.rival.state =
          this.rival.entryRemaining > 0 ? "reentering" : "chasing";
        this.rival.nextBreatherSeconds = this.#nextRivalBreatherDelay();
        this.rival.jetpackActive = true;
      }
    }
    if (Number.isFinite(Number(values.x))) {
      this.rival.x = clamp(
        Number(values.x),
        RIVAL_CHASE.edgeInsetX,
        GAME_WIDTH - RIVAL_CHASE.edgeInsetX,
      );
    }
    if (Number.isFinite(Number(values.y))) {
      this.rival.y = Number(values.y);
    }
    if (Number.isFinite(Number(values.vx))) {
      this.rival.vx = Number(values.vx);
    }
    if (Number.isFinite(Number(values.vy))) {
      this.rival.vy = Number(values.vy);
    }
    if (typeof values.onGround === "boolean") {
      this.rival.onGround = values.onGround;
    }
    if (typeof values.visible === "boolean") {
      this.rival.visible = values.visible;
    }
    if (values.facing === -1 || values.facing === 1) {
      this.rival.facing = values.facing;
    }
    this.rival.previousX = this.rival.x;
    this.rival.previousY = this.rival.y;
    return { ...this.getSnapshot().rival };
  }

  debugForceRivalAttack(direction) {
    if (this.playMode !== PLAY_MODES.COW_VS_CAT) {
      return null;
    }
    if (rivalCanBeForceActivated(this.rival)) {
      this.#activateRival(this.rival.state === "recovering");
    }
    this.rival.frozen = false;
    this.rival.entryRemaining = 0;
    this.rival.attackState = "idle";
    this.rival.attackKind = "none";
    this.rival.attackCooldown = 0;
    this.#startRivalBowSwipe(direction);
    return { ...this.getSnapshot().rival };
  }

  debugForceRivalBoost() {
    if (this.playMode !== PLAY_MODES.COW_VS_CAT) {
      return null;
    }
    if (rivalCanBeForceActivated(this.rival)) {
      this.#activateRival(this.rival.state === "recovering");
    }
    const hoverFloorY = WORLD_FLOOR_Y - RIVAL_JETPACK.groundClearance;
    this.rival.frozen = false;
    this.rival.visible = true;
    this.rival.active = true;
    this.rival.entryRemaining = 0;
    this.rival.x = clamp(
      this.player.x,
      RIVAL_CHASE.edgeInsetX,
      GAME_WIDTH - RIVAL_CHASE.edgeInsetX,
    );
    this.rival.y = Math.min(
      this.player.y + RIVAL_VERTICAL_BOOST.setupBelowDistance,
      hoverFloorY,
    );
    this.rival.previousX = this.rival.x;
    this.rival.previousY = this.rival.y;
    this.rival.vx = 0;
    this.rival.vy = 0;
    this.rival.attackState = "idle";
    this.rival.attackKind = "none";
    this.rival.attackCooldown = 0;
    this.#beginRivalBoostTelegraph();
    return { ...this.getSnapshot().rival };
  }

  debugForceRivalOvertake() {
    if (this.playMode !== PLAY_MODES.COW_VS_CAT) {
      return null;
    }
    if (rivalCanBeForceActivated(this.rival)) {
      this.#activateRival(this.rival.state === "recovering");
    }
    const reviewY = this.cameraY + this.viewportHeight * 0.46;
    this.player.x = GAME_WIDTH * 0.5;
    this.player.y = reviewY;
    this.player.previousX = this.player.x;
    this.player.previousY = this.player.y;
    this.player.vx = 0;
    this.player.vy = -COMBO.comboBounceSpeed;
    this.player.onGround = false;
    this.#updateSpeedMultiplier();
    this.#updateCamera();
    this.#maintainRoute();
    this.rival.frozen = false;
    this.rival.visible = true;
    this.rival.active = true;
    this.rival.entryRemaining = 0;
    this.rival.x = clamp(
      this.player.x + 54,
      RIVAL_CHASE.edgeInsetX,
      GAME_WIDTH - RIVAL_CHASE.edgeInsetX,
    );
    this.rival.y =
      this.player.y + RIVAL_JETPACK.overtakeTriggerBelowDistance + 90;
    this.rival.previousX = this.rival.x;
    this.rival.previousY = this.rival.y;
    this.rival.vx = 0;
    this.rival.vy = 0;
    this.rival.attackState = "idle";
    this.rival.attackKind = "none";
    this.rival.attackCooldown = 0;
    this.rival.postOvertakeHoldRemaining = 0;
    this.rival.overtakeQueued = false;
    this.rival.boostOvertookCow = false;
    this.#startRivalVerticalBoost();
    return { ...this.getSnapshot().rival };
  }

  debugForceRivalFiddleDrop() {
    if (this.playMode !== PLAY_MODES.COW_VS_CAT) {
      return null;
    }
    if (rivalCanBeForceActivated(this.rival)) {
      this.#activateRival(this.rival.state === "recovering");
    }
    this.rival.frozen = false;
    this.rival.visible = true;
    this.rival.active = true;
    this.rival.entryRemaining = 0;
    this.rival.x = clamp(
      this.player.x - RIVAL_FIDDLE_DROP.setupSideDistance,
      RIVAL_CHASE.edgeInsetX,
      GAME_WIDTH - RIVAL_CHASE.edgeInsetX,
    );
    this.rival.y = this.player.y - RIVAL_FIDDLE_DROP.setupAboveDistance;
    this.rival.previousX = this.rival.x;
    this.rival.previousY = this.rival.y;
    this.rival.vx = 0;
    this.rival.vy = 0;
    this.rival.attackState = "idle";
    this.rival.attackKind = "none";
    this.rival.attackCooldown = 0;
    this.#beginRivalFiddleTelegraph();
    return { ...this.getSnapshot().rival };
  }

  debugForceRivalCounter() {
    if (this.playMode !== PLAY_MODES.COW_VS_CAT) {
      return null;
    }
    if (rivalCanBeForceActivated(this.rival)) {
      this.#activateRival(this.rival.state === "recovering");
    }
    const visibleY = this.cameraY + this.viewportHeight * 0.48;
    this.player.x = GAME_WIDTH * 0.5;
    this.player.y = visibleY;
    this.player.previousX = this.player.x;
    this.player.previousY = this.player.y;
    this.rival.x = this.player.x;
    this.rival.y = this.player.y + 62;
    this.rival.previousX = this.rival.x;
    this.rival.previousY = this.rival.y;
    this.rival.visible = true;
    this.rival.active = true;
    this.rival.frozen = false;
    this.rival.entryRemaining = 0;
    this.rival.attackState = "boost-recovery";
    this.rival.attackKind = "vertical-boost";
    this.rival.attackTimer = RIVAL_VERTICAL_BOOST.recoverySeconds;
    this.#knockDownRival();
    return { ...this.getSnapshot().rival };
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
    this.savedBestByMode[this.playMode] = this.savedBestHeight;
    if (persist) {
      writeSavedBest(
        this.savedBestHeight,
        scoreStorageKeyForMode(this.playMode),
      );
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

  setLeaderboard(playModeOrSnapshot = {}, nextSnapshot = null) {
    const snapshot =
      typeof playModeOrSnapshot === "string"
        ? nextSnapshot || {}
        : playModeOrSnapshot || {};
    const targetMode = normalizePlayMode(
      typeof playModeOrSnapshot === "string"
        ? playModeOrSnapshot
        : snapshot.playMode || PLAY_MODES.CLASSIC,
    );
    const previous = this.leaderboards[targetMode];
    this.leaderboards[targetMode] = {
      ...previous,
      ...snapshot,
      playMode: targetMode,
      topScores: (snapshot.topScores || previous.topScores || []).map(
        (entry) => ({ ...entry }),
      ),
    };
    this.savedBestByMode[targetMode] = Math.max(
      this.savedBestByMode[targetMode],
      Math.floor(Number(this.leaderboards[targetMode].localBest) || 0),
    );
    if (this.playMode === targetMode) {
      this.leaderboard = this.leaderboards[targetMode];
      this.savedBestHeight = this.savedBestByMode[targetMode];
      this.#syncLeaderboardBalloons();
    }
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

  returnToMenu() {
    if (this.mode === "menu") {
      return false;
    }
    this.mode = "menu";
    this.deathView = "summary";
    this.nameEntry = null;
    this.nameEntrySubmitted = false;
    this.qualifiesForLeaderboard = false;
    this.player.onGround = true;
    this.player.vx = 0;
    this.player.vy = 0;
    this.cameraY = this.#baseCameraY();
    this.previousCameraY = this.cameraY;
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
    const isFirstCowBalloonPop = this.totalPopped === 0;
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
    if (
      isFirstCowBalloonPop &&
      this.playMode === PLAY_MODES.COW_VS_CAT &&
      this.rival.state === "waiting-first-pop"
    ) {
      this.#beginRivalOpeningGrace();
    }

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

  #updateRival(dt) {
    const rival = this.rival;
    if (
      this.playMode !== PLAY_MODES.COW_VS_CAT ||
      !rival.present ||
      !rival.movementEnabled
    ) {
      return;
    }

    if (rival.state === "waiting-first-pop") {
      rival.visible = false;
      rival.active = false;
      rival.jetpackActive = false;
      rival.vx = 0;
      rival.vy = 0;
      return;
    }

    this.#updateRivalExhaustTrail(dt);

    if (rival.frozen) {
      rival.state = "frozen";
      rival.active = true;
      rival.visible = true;
      rival.vx = 0;
      rival.vy = 0;
      rival.jetpackActive = false;
      return;
    }

    if (rival.state === "grace") {
      rival.graceRemaining = Math.max(0, rival.graceRemaining - dt);
      if (rival.graceRemaining <= 0) {
        this.#activateRival(false);
      }
      return;
    }

    if (rival.state === "recovering") {
      rival.recoveryRemaining = Math.max(
        0,
        rival.recoveryRemaining - dt,
      );
      if (rival.recoveryRemaining <= 0) {
        this.#activateRival(true);
      }
      return;
    }

    if (!rival.active || !rival.visible) {
      return;
    }

    rival.postOvertakeHoldRemaining = Math.max(
      0,
      rival.postOvertakeHoldRemaining - dt,
    );
    rival.engagedSeconds += dt;
    if (
      this.player.y - rival.y >=
      RIVAL_JETPACK.abovePressureMinimumLead
    ) {
      rival.abovePressureSeconds += dt;
    }

    if (rival.state === "knocked-down") {
      this.#updateRivalKnockdown(dt);
      return;
    }

    if (this.#updateRivalRubberBand(dt)) {
      return;
    }

    rival.entryRemaining = Math.max(0, rival.entryRemaining - dt);
    rival.attackCooldown = Math.max(0, rival.attackCooldown - dt);

    if (rival.attackState === "boost-positioning") {
      this.#updateRivalBoostPositioning(dt);
      return;
    }

    if (rival.attackState === "boost-telegraph") {
      this.#updateRivalBoostTelegraph(dt);
      return;
    }

    if (rival.attackState === "boost-active") {
      this.#updateRivalBoostActive(dt);
      return;
    }

    if (rival.attackState === "boost-recovery") {
      this.#updateRivalBoostRecovery(dt);
      return;
    }

    if (rival.attackState === "fiddle-positioning") {
      this.#updateRivalFiddlePositioning(dt);
      return;
    }

    if (rival.attackState === "fiddle-telegraph") {
      this.#updateRivalFiddleTelegraph(dt);
      return;
    }

    if (rival.attackState === "fiddle-active") {
      this.#updateRivalFiddleActive(dt);
      return;
    }

    if (rival.attackState === "fiddle-recovery") {
      this.#updateRivalFiddleRecovery(dt);
      return;
    }

    if (rival.attackState === "active") {
      rival.state = "swiping";
      rival.jetpackActive = true;
      rival.attackTimer = Math.max(0, rival.attackTimer - dt);
      rival.facing = rival.attackDirection;
      rival.vx =
        rival.attackDirection *
        RIVAL_BOW_SWIPE.dashSpeed *
        rival.chaseSpeedScale;
      rival.vy *= 0.78;
      rival.x += rival.vx * dt;
      rival.y += rival.vy * dt;
      this.#constrainRivalHorizontally();
      this.#applyRivalSwipeHits();
      if (rival.attackTimer <= 0) {
        rival.attackState = "recovery";
        rival.attackTimer = RIVAL_BOW_SWIPE.recoverySeconds;
        rival.state = "swipe-recovery";
        rival.vx *= 0.35;
        rival.orbitSide = rival.attackDirection;
      }
      return;
    }

    if (rival.attackState === "telegraph") {
      rival.state = "swipe-telegraph";
      rival.attackTimer = Math.max(0, rival.attackTimer - dt);
      this.#updateRivalJetpack(dt, 0.28);
      // The warning glint promises a horizontal lane. Above-route neutral
      // pressure must not pull the cat into a different lane before the dash.
      rival.y = rival.attackLockedY;
      rival.vy = 0;
      rival.facing = rival.attackDirection;
      if (rival.attackTimer <= 0) {
        rival.attackState = "active";
        rival.attackTimer = RIVAL_BOW_SWIPE.activeSeconds;
        rival.state = "swiping";
        this.#emit("rivalSwipe");
      }
      return;
    }

    if (rival.attackState === "recovery") {
      rival.state = "swipe-recovery";
      rival.attackTimer = Math.max(0, rival.attackTimer - dt);
      this.#updateRivalJetpack(dt, 0.42);
      if (rival.attackTimer <= 0) {
        rival.attackState = "idle";
        rival.attackKind = "none";
        rival.state = "chasing";
        rival.attackCooldown = this.rivalRandom.uniform(
          RIVAL_BOW_SWIPE.cooldownMinimumSeconds,
          RIVAL_BOW_SWIPE.cooldownMaximumSeconds,
        );
      }
      return;
    }

    rival.state = rival.entryRemaining > 0 ? "reentering" : "chasing";
    this.#updateRivalJetpack(dt, 1);

    const needsOvertake =
      rival.postOvertakeHoldRemaining <= 0 &&
      rival.y - this.player.y >=
        RIVAL_JETPACK.overtakeTriggerBelowDistance &&
      this.player.y <=
        WORLD_FLOOR_Y -
          PLAYER.height * 0.5 -
          RIVAL_VERTICAL_BOOST.minimumPlayerFloorClearance;
    if (needsOvertake) {
      rival.overtakeQueued = true;
      rival.attackCooldown = Math.min(
        rival.attackCooldown,
        RIVAL_JETPACK.overtakeCooldownCapSeconds,
      );
    } else if (
      this.player.y >
      WORLD_FLOOR_Y -
        PLAYER.height * 0.5 -
        RIVAL_VERTICAL_BOOST.minimumPlayerFloorClearance
    ) {
      rival.overtakeQueued = false;
    }

    if (
      rival.entryRemaining <= 0 &&
      rival.attackCooldown <= 0 &&
      rival.postOvertakeHoldRemaining <= 0 &&
      !rival.rubberBandActive &&
      !rival.rubberBandPending
    ) {
      this.#selectRivalAttack();
    }
  }

  #selectRivalAttack() {
    const rival = this.rival;
    if (rival.rubberBandActive || rival.rubberBandPending) {
      return false;
    }
    const boostEligible =
      this.player.y <=
      WORLD_FLOOR_Y -
        PLAYER.height * 0.5 -
        RIVAL_VERTICAL_BOOST.minimumPlayerFloorClearance;
    const needsOvertake =
      boostEligible &&
      rival.postOvertakeHoldRemaining <= 0 &&
      (rival.overtakeQueued ||
        rival.y - this.player.y >=
          RIVAL_JETPACK.overtakeTriggerBelowDistance);
    const fiddleEligible =
      this.player.y - this.cameraY >=
      RIVAL_FIDDLE_DROP.setupAboveDistance + 48;
    const available = needsOvertake
      ? [
          {
            kind: "vertical-boost",
            weight: RIVAL_VERTICAL_BOOST.selectionWeight,
          },
        ]
      : [
          {
            kind: "bow-swipe",
            weight: RIVAL_BOW_SWIPE.selectionWeight,
          },
          ...(boostEligible &&
          rival.y - this.player.y >
            -RIVAL_JETPACK.abovePressureMinimumLead
            ? [
                {
                  kind: "vertical-boost",
                  weight: RIVAL_VERTICAL_BOOST.selectionWeight,
                },
              ]
            : []),
          ...(fiddleEligible
            ? [
                {
                  kind: "fiddle-drop",
                  weight: RIVAL_FIDDLE_DROP.selectionWeight,
                },
              ]
            : []),
        ];
    const withoutRepeat = available.filter(
      (candidate) => candidate.kind !== rival.lastAttackKind,
    );
    const candidates = withoutRepeat.length ? withoutRepeat : available;
    const totalWeight = candidates.reduce(
      (sum, candidate) => sum + candidate.weight,
      0,
    );
    let roll = this.rivalRandom.unit() * totalWeight;
    let selected = candidates[candidates.length - 1];
    for (const candidate of candidates) {
      roll -= candidate.weight;
      if (roll <= 0) {
        selected = candidate;
        break;
      }
    }
    const started =
      selected.kind === "vertical-boost"
        ? this.#startRivalVerticalBoost()
        : selected.kind === "fiddle-drop"
          ? this.#startRivalFiddleDrop()
          : this.#startRivalBowSwipe();
    if (started) {
      rival.stats.attackSelections += 1;
    } else {
      rival.attackCooldown = 0.2;
    }
    return started;
  }

  #updateRivalJetpack(dt, thrustScale) {
    const rival = this.rival;
    const hoverFloorY = WORLD_FLOOR_Y - RIVAL_JETPACK.groundClearance;
    const bob =
      Math.sin(
        this.runTimeSeconds *
          RIVAL_JETPACK.hoverBobCyclesPerSecond *
          Math.PI *
          2,
      ) * RIVAL_JETPACK.hoverBobAmplitude;
    const wanderAngle =
      this.runTimeSeconds *
      RIVAL_JETPACK.hoverWanderCyclesPerSecond *
      Math.PI *
      2;
    const sideDistance =
      RIVAL_JETPACK.hoverSideDistance +
      Math.sin(wanderAngle) * RIVAL_JETPACK.hoverSideWanderAmplitude;
    const verticalOffset =
      RIVAL_JETPACK.hoverVerticalOffset +
      Math.sin(wanderAngle * 1.31 + rival.orbitSide * 1.4) *
        RIVAL_JETPACK.hoverVerticalWanderAmplitude;
    rival.hoverTargetX = clamp(
      this.player.x + rival.orbitSide * sideDistance,
      RIVAL_CHASE.edgeInsetX,
      GAME_WIDTH - RIVAL_CHASE.edgeInsetX,
    );
    const movingVerticalTarget =
      Math.min(this.player.y + verticalOffset, hoverFloorY) + bob;
    const holdingAfterOvertake =
      rival.postOvertakeHoldRemaining > 0 &&
      !rival.rubberBandActive &&
      !rival.rubberBandPending;
    rival.hoverTargetY = holdingAfterOvertake
      ? Math.min(rival.postOvertakeHoldY, hoverFloorY)
      : movingVerticalTarget;

    const verticalCatchUpScale = rival.rubberBandActive
      ? lerp(
          1,
          RIVAL_JETPACK.rubberBandMaximumVerticalScale,
          rival.rubberBandStrength,
        )
      : 1;
    this.#steerRivalJetpackTo(
      dt,
      rival.hoverTargetX,
      rival.hoverTargetY,
      thrustScale,
      verticalCatchUpScale,
    );
  }

  #steerRivalJetpackTo(
    dt,
    targetX,
    targetY,
    thrustScale = 1,
    verticalCatchUpScale = 1,
  ) {
    const rival = this.rival;
    const speed = this.speedMultiplier * rival.chaseSpeedScale;
    rival.hoverTargetX = targetX;
    rival.hoverTargetY = targetY;

    const deltaX = targetX - rival.x;
    const deltaY = targetY - rival.y;
    if (Math.abs(deltaX) > RIVAL_JETPACK.horizontalDeadZone) {
      rival.vx +=
        Math.sign(deltaX) *
        RIVAL_JETPACK.horizontalAcceleration *
        speed *
        thrustScale *
        dt;
      rival.facing = Math.sign(deltaX) || rival.facing;
    }
    if (Math.abs(deltaY) > RIVAL_JETPACK.verticalDeadZone) {
      rival.vy +=
        Math.sign(deltaY) *
        RIVAL_JETPACK.verticalAcceleration *
        speed *
        Math.max(thrustScale, verticalCatchUpScale) *
        dt;
    }
    const damping = Math.pow(
      RIVAL_JETPACK.velocityDampingPerStep,
      dt * 60,
    );
    rival.vx *= damping;
    rival.vy *= damping;
    rival.vx = clamp(
      rival.vx,
      -RIVAL_JETPACK.maxHorizontalSpeed * speed,
      RIVAL_JETPACK.maxHorizontalSpeed * speed,
    );
    rival.vy = clamp(
      rival.vy,
      -RIVAL_JETPACK.maxVerticalSpeed * speed * verticalCatchUpScale,
      RIVAL_JETPACK.maxVerticalSpeed * speed * verticalCatchUpScale,
    );
    rival.x += rival.vx * dt;
    rival.y += rival.vy * dt;
    rival.jetpackActive = true;
    rival.onGround = false;
    rival.targetBalloonId = null;
    this.#constrainRivalHorizontally();
    return { deltaX, deltaY };
  }

  #rivalRubberBandEligible() {
    return [
      "idle",
      "recovery",
      "boost-recovery",
      "fiddle-recovery",
    ].includes(this.rival.attackState);
  }

  #updateRivalRubberBand(dt) {
    const rival = this.rival;
    const screenY = rival.y - this.cameraY;
    const verticalLag = rival.y - this.player.y;
    const cameraTrackingClimb = this.cameraY < this.#baseCameraY() - 0.5;
    const belowViewport = screenY > this.viewportHeight;
    const shouldMeasureCatchUp = cameraTrackingClimb || belowViewport;
    const visibleBandStrength = shouldMeasureCatchUp
      ? smoothstep(
          this.viewportHeight * RIVAL_JETPACK.rubberBandBottomStartRatio,
          this.viewportHeight * RIVAL_JETPACK.rubberBandBottomFullRatio,
          screenY,
        )
      : 0;
    const verticalLagStrength = shouldMeasureCatchUp
      ? smoothstep(
          RIVAL_JETPACK.rubberBandLagStartDistance,
          RIVAL_JETPACK.rubberBandLagFullDistance,
          verticalLag,
        )
      : 0;
    const strength = Math.max(visibleBandStrength, verticalLagStrength);
    const eligible = this.#rivalRubberBandEligible();
    const wasActive = rival.rubberBandActive;

    rival.rubberBandScreenY = screenY;
    rival.rubberBandVerticalLag = verticalLag;
    rival.rubberBandPending = strength > 0.001 && !eligible;
    rival.rubberBandActive = strength > 0.001 && eligible;
    rival.rubberBandStrength = rival.rubberBandActive ? strength : 0;

    if (rival.rubberBandActive && !wasActive) {
      rival.stats.rubberBandActivations += 1;
    }

    if (belowViewport) {
      rival.rubberBandOffscreenSeconds += dt;
      rival.rubberBandMaximumOffscreenSeconds = Math.max(
        rival.rubberBandMaximumOffscreenSeconds,
        rival.rubberBandOffscreenSeconds,
      );
    } else {
      rival.rubberBandOffscreenSeconds = 0;
    }

    if (
      eligible &&
      rival.rubberBandOffscreenSeconds >=
        RIVAL_JETPACK.rubberBandFailsafeSeconds
    ) {
      rival.stats.rubberBandFailsafes += 1;
      this.#beginRivalRecovery();
      return true;
    }
    return false;
  }

  #updateRivalExhaustTrail(dt) {
    const rival = this.rival;
    for (const point of rival.exhaustTrail) {
      point.age += dt;
    }
    rival.exhaustTrail = rival.exhaustTrail.filter(
      (point) => point.age < RIVAL_JETPACK.exhaustTrailLifetimeSeconds,
    );
    if (
      !rival.visible ||
      !rival.active ||
      !rival.jetpackActive ||
      rival.frozen
    ) {
      rival.exhaustEmitRemaining = 0;
      return;
    }

    rival.exhaustEmitRemaining -= dt;
    if (rival.exhaustEmitRemaining > 0) {
      return;
    }
    const boosting = rival.attackState === "boost-active";
    rival.exhaustEmitRemaining = boosting
      ? RIVAL_JETPACK.exhaustTrailBoostIntervalSeconds
      : RIVAL_JETPACK.exhaustTrailIntervalSeconds;
    rival.exhaustTrail.push({
      x: rival.x,
      y: rival.y,
      age: 0,
      facing: rival.facing,
      visualFrame: rivalVisualFrameFor(rival),
      intensity: boosting
        ? 2
        : rival.attackState === "boost-telegraph"
          ? 1.35
          : 1,
    });
    if (
      rival.exhaustTrail.length > RIVAL_JETPACK.exhaustTrailMaximumPoints
    ) {
      rival.exhaustTrail.splice(
        0,
        rival.exhaustTrail.length - RIVAL_JETPACK.exhaustTrailMaximumPoints,
      );
    }
  }

  #startRivalVerticalBoost() {
    const rival = this.rival;
    if (!rival.active || !rival.visible || rival.attackState !== "idle") {
      return false;
    }
    rival.attackKind = "vertical-boost";
    rival.lastAttackKind = "vertical-boost";
    rival.overtakeQueued = false;
    rival.attackState = "boost-positioning";
    rival.attackTimer = RIVAL_VERTICAL_BOOST.positioningSeconds;
    rival.attackHitCow = false;
    rival.attackBalloonPops = 0;
    rival.boostHitCow = false;
    rival.boostClanked = false;
    rival.boostBalloonPops = 0;
    rival.boostOvertookCow = false;
    rival.state = "boost-positioning";
    rival.jetpackActive = true;
    return true;
  }

  #updateRivalBoostPositioning(dt) {
    const rival = this.rival;
    rival.state = "boost-positioning";
    rival.jetpackActive = true;
    rival.attackTimer = Math.max(0, rival.attackTimer - dt);
    const hoverFloorY = WORLD_FLOOR_Y - RIVAL_JETPACK.groundClearance;
    const targetX = clamp(
      this.player.x,
      RIVAL_CHASE.edgeInsetX,
      GAME_WIDTH - RIVAL_CHASE.edgeInsetX,
    );
    const targetY = Math.min(
      this.player.y + RIVAL_VERTICAL_BOOST.setupBelowDistance,
      hoverFloorY,
    );
    const { deltaX, deltaY } = this.#steerRivalJetpackTo(
      dt,
      targetX,
      targetY,
      1.15,
    );
    if (
      (Math.abs(deltaX) <=
        RIVAL_VERTICAL_BOOST.setupHorizontalTolerance &&
        Math.abs(deltaY) <= RIVAL_VERTICAL_BOOST.setupVerticalTolerance) ||
      rival.attackTimer <= 0
    ) {
      this.#beginRivalBoostTelegraph();
    }
  }

  #beginRivalBoostTelegraph() {
    const rival = this.rival;
    rival.attackKind = "vertical-boost";
    rival.lastAttackKind = "vertical-boost";
    rival.attackState = "boost-telegraph";
    rival.attackTimer = RIVAL_VERTICAL_BOOST.telegraphSeconds;
    rival.boostLockedX = rival.x;
    rival.boostHitCow = false;
    rival.boostClanked = false;
    rival.boostBalloonPops = 0;
    rival.boostOvertookCow = false;
    rival.state = "boost-telegraph";
    rival.jetpackActive = true;
    rival.vx *= 0.18;
    rival.vy *= 0.18;
    rival.stats.verticalBoosts += 1;
    this.#emit("rivalBoostTelegraph");
    return true;
  }

  #updateRivalBoostTelegraph(dt) {
    const rival = this.rival;
    rival.state = "boost-telegraph";
    rival.jetpackActive = true;
    rival.attackTimer = Math.max(0, rival.attackTimer - dt);
    const damping = Math.pow(0.68, dt * 60);
    rival.vx *= damping;
    rival.vy *= damping;
    rival.x += rival.vx * dt;
    rival.y += rival.vy * dt;
    rival.boostLockedX = rival.x;
    rival.facing = Math.sign(this.player.x - rival.x) || rival.facing;
    this.#constrainRivalHorizontally();
    if (rival.attackTimer <= 0) {
      rival.attackState = "boost-active";
      rival.attackTimer = RIVAL_VERTICAL_BOOST.activeSeconds;
      rival.state = "boost-active";
      rival.vx = 0;
      rival.vy =
        -RIVAL_VERTICAL_BOOST.launchSpeed *
        this.speedMultiplier *
        rival.chaseSpeedScale;
      this.#emit("rivalBoost");
    }
  }

  #updateRivalBoostActive(dt) {
    const rival = this.rival;
    rival.state = "boost-active";
    rival.jetpackActive = true;
    rival.attackTimer = Math.max(0, rival.attackTimer - dt);
    rival.x = rival.boostLockedX;
    rival.vx = 0;
    rival.vy =
      -RIVAL_VERTICAL_BOOST.launchSpeed *
      this.speedMultiplier *
      rival.chaseSpeedScale;
    rival.y += rival.vy * dt;
    this.#applyRivalBoostHits();
    if (rival.attackTimer <= 0) {
      rival.boostOvertookCow =
        this.player.y - rival.y >=
        RIVAL_JETPACK.abovePressureMinimumLead;
      rival.attackState = "boost-recovery";
      rival.attackTimer = RIVAL_VERTICAL_BOOST.recoverySeconds;
      rival.state = "boost-recovery";
      rival.vy *= 0.24;
      rival.orbitSide *= -1;
    }
  }

  #updateRivalBoostRecovery(dt) {
    const rival = this.rival;
    rival.state = "boost-recovery";
    rival.jetpackActive = true;
    rival.attackTimer = Math.max(0, rival.attackTimer - dt);
    this.#updateRivalJetpack(dt, 0.36);
    if (rival.attackTimer <= 0) {
      if (
        rival.boostOvertookCow ||
        this.player.y - rival.y >=
          RIVAL_JETPACK.abovePressureMinimumLead
      ) {
        rival.stats.overtakes += 1;
        rival.postOvertakeHoldRemaining =
          RIVAL_JETPACK.postOvertakeHoldSeconds;
        rival.postOvertakeHoldY = rival.y;
      }
      rival.attackState = "idle";
      rival.attackKind = "none";
      rival.state = "chasing";
      rival.attackCooldown = this.rivalRandom.uniform(
        RIVAL_VERTICAL_BOOST.cooldownMinimumSeconds,
        RIVAL_VERTICAL_BOOST.cooldownMaximumSeconds,
      );
    }
  }

  #applyRivalBoostHits() {
    const rival = this.rival;
    if (
      !rival.boostHitCow &&
      !rival.boostClanked &&
      this.#rivalBoostHitsPlayer()
    ) {
      if (this.#swordClanksRivalBoost()) {
        rival.boostClanked = true;
        rival.stats.boostClanks += 1;
        this.#bounce(
          RIVAL_VERTICAL_BOOST.clankBounceSpeed * this.speedMultiplier,
        );
        this.fallPeakHeight = this.currentHeight;
        this.reentryStage = 0;
        this.hitPauseTimer = Math.max(this.hitPauseTimer, 0.045);
        this.#emit("rivalClank");
      } else {
        rival.boostHitCow = true;
        rival.stats.cowHits += 1;
        rival.stats.boostCowHits += 1;
        const direction =
          Math.sign(this.player.x - rival.x) || rival.facing || 1;
        this.player.vx =
          direction *
          RIVAL_VERTICAL_BOOST.cowKnockbackHorizontal *
          this.speedMultiplier;
        const downwardSpeed = Math.max(0, this.player.vy);
        this.player.vy = Math.max(
          RIVAL_VERTICAL_BOOST.cowKnockbackDown * this.speedMultiplier,
          downwardSpeed +
            RIVAL_VERTICAL_BOOST.cowKnockbackDownAdd *
              this.speedMultiplier,
        );
        this.player.onGround = false;
        this.player.slashTimer = 0;
        this.reentryStage = 0;
        this.hitPauseTimer = Math.max(this.hitPauseTimer, 0.04);
        this.#emit("rivalBoostHit");
      }
    }

    let remaining =
      RIVAL_VERTICAL_BOOST.maximumBalloonPopsPerBoost -
      rival.boostBalloonPops;
    if (remaining <= 0) {
      return;
    }
    const hitBalloons = this.balloons.filter(
      (balloon) =>
        balloon.alive &&
        this.#rivalMayPopBalloon(balloon) &&
        this.#rivalCanInteractOnScreen(balloon) &&
        this.#rivalBoostHitsCircle(balloon.x, balloon.y, balloon.radius),
    );
    for (const balloon of hitBalloons) {
      if (remaining <= 0) {
        break;
      }
      rival.boostBalloonPops += 1;
      rival.stats.boostBalloonPops += 1;
      remaining -= 1;
      this.#popBalloonForRival(balloon);
    }
  }

  #rivalBoostHitsPlayer() {
    return this.#rivalBoostHitsCircle(
      this.player.x,
      this.player.y,
      Math.max(PLAYER.width, PLAYER.height) * 0.42,
    );
  }

  #swordClanksRivalBoost() {
    if (!this.#isSlashing()) {
      return false;
    }
    return this.#circleHitsSegment(
      this.rival.boostLockedX,
      this.rival.y + RIVAL_VERTICAL_BOOST.clankSwordOffsetY,
      RIVAL_VERTICAL_BOOST.clankSwordRadius,
      ...this.#swordSegment(),
    );
  }

  #rivalBoostHitsCircle(x, y, radius) {
    const rival = this.rival;
    if (
      Math.abs(x - rival.boostLockedX) >
      RIVAL_VERTICAL_BOOST.hitHalfWidth + radius
    ) {
      return false;
    }
    const top =
      Math.min(rival.previousY, rival.y) -
      RIVAL_VERTICAL_BOOST.hitReachAbove;
    const bottom =
      Math.max(rival.previousY, rival.y) +
      RIVAL_CHASE.physicsHeight * 0.5;
    return y + radius >= top && y - radius <= bottom;
  }

  #startRivalFiddleDrop() {
    const rival = this.rival;
    if (!rival.active || !rival.visible || rival.attackState !== "idle") {
      return false;
    }
    rival.attackKind = "fiddle-drop";
    rival.lastAttackKind = "fiddle-drop";
    rival.attackState = "fiddle-positioning";
    rival.attackTimer = RIVAL_FIDDLE_DROP.positioningSeconds;
    rival.fiddleHitCow = false;
    rival.fiddleBalloonPops = 0;
    rival.state = "fiddle-positioning";
    rival.jetpackActive = true;
    return true;
  }

  #updateRivalFiddlePositioning(dt) {
    const rival = this.rival;
    rival.state = "fiddle-positioning";
    rival.jetpackActive = true;
    rival.attackTimer = Math.max(0, rival.attackTimer - dt);
    const targetX = clamp(
      this.player.x + rival.orbitSide * RIVAL_FIDDLE_DROP.setupSideDistance,
      RIVAL_CHASE.edgeInsetX,
      GAME_WIDTH - RIVAL_CHASE.edgeInsetX,
    );
    const targetY = this.player.y - RIVAL_FIDDLE_DROP.setupAboveDistance;
    const { deltaX, deltaY } = this.#steerRivalJetpackTo(
      dt,
      targetX,
      targetY,
      1.18,
    );
    if (
      (Math.abs(deltaX) <= RIVAL_FIDDLE_DROP.setupHorizontalTolerance &&
        Math.abs(deltaY) <= RIVAL_FIDDLE_DROP.setupVerticalTolerance) ||
      rival.attackTimer <= 0
    ) {
      this.#beginRivalFiddleTelegraph();
    }
  }

  #beginRivalFiddleTelegraph() {
    const rival = this.rival;
    rival.attackKind = "fiddle-drop";
    rival.lastAttackKind = "fiddle-drop";
    rival.attackState = "fiddle-telegraph";
    rival.attackTimer = RIVAL_FIDDLE_DROP.telegraphSeconds;
    rival.fiddleTargetX = clamp(
      this.player.x +
        this.player.vx * RIVAL_FIDDLE_DROP.targetLeadSeconds,
      RIVAL_CHASE.edgeInsetX,
      GAME_WIDTH - RIVAL_CHASE.edgeInsetX,
    );
    rival.fiddleTargetY =
      this.player.y + RIVAL_FIDDLE_DROP.targetPastPlayerDistance;
    const deltaX = rival.fiddleTargetX - rival.x;
    const deltaY = Math.max(1, rival.fiddleTargetY - rival.y);
    const length = Math.max(1, Math.hypot(deltaX, deltaY));
    rival.fiddleDirectionX = deltaX / length;
    rival.fiddleDirectionY = deltaY / length;
    rival.fiddleHitCow = false;
    rival.fiddleBalloonPops = 0;
    rival.state = "fiddle-telegraph";
    rival.jetpackActive = true;
    rival.vx *= 0.16;
    rival.vy *= 0.16;
    rival.facing = Math.sign(rival.fiddleDirectionX) || rival.facing;
    rival.stats.fiddleDrops += 1;
    this.#emit("rivalFiddleTelegraph");
    return true;
  }

  #updateRivalFiddleTelegraph(dt) {
    const rival = this.rival;
    rival.state = "fiddle-telegraph";
    rival.jetpackActive = true;
    rival.attackTimer = Math.max(0, rival.attackTimer - dt);
    const damping = Math.pow(0.66, dt * 60);
    rival.vx *= damping;
    rival.vy *= damping;
    rival.x += rival.vx * dt;
    rival.y += rival.vy * dt;
    this.#constrainRivalHorizontally();
    if (rival.attackTimer <= 0) {
      rival.attackState = "fiddle-active";
      rival.attackTimer = RIVAL_FIDDLE_DROP.activeSeconds;
      rival.state = "fiddle-active";
      rival.jetpackActive = false;
      rival.vx =
        rival.fiddleDirectionX *
        RIVAL_FIDDLE_DROP.diveSpeed *
        this.speedMultiplier *
        rival.chaseSpeedScale;
      rival.vy =
        rival.fiddleDirectionY *
        RIVAL_FIDDLE_DROP.diveSpeed *
        this.speedMultiplier *
        rival.chaseSpeedScale;
      this.#emit("rivalFiddleDrop");
    }
  }

  #updateRivalFiddleActive(dt) {
    const rival = this.rival;
    rival.state = "fiddle-active";
    rival.jetpackActive = false;
    rival.attackTimer = Math.max(0, rival.attackTimer - dt);
    const speed =
      RIVAL_FIDDLE_DROP.diveSpeed *
      this.speedMultiplier *
      rival.chaseSpeedScale;
    rival.vx = rival.fiddleDirectionX * speed;
    rival.vy = rival.fiddleDirectionY * speed;
    rival.x += rival.vx * dt;
    rival.y += rival.vy * dt;
    this.#applyRivalFiddleHits();
    const reachedEdge =
      rival.x <= RIVAL_CHASE.edgeInsetX ||
      rival.x >= GAME_WIDTH - RIVAL_CHASE.edgeInsetX;
    if (reachedEdge) {
      this.#constrainRivalHorizontally();
    }
    if (rival.attackTimer <= 0 || reachedEdge) {
      this.#beginRivalFiddleRecovery();
    }
  }

  #beginRivalFiddleRecovery() {
    const rival = this.rival;
    rival.attackState = "fiddle-recovery";
    rival.attackTimer = RIVAL_FIDDLE_DROP.recoverySeconds;
    rival.state = "fiddle-recovery";
    rival.jetpackActive = true;
    rival.vx *= 0.18;
    rival.vy *= 0.18;
    rival.orbitSide =
      Math.sign(rival.fiddleDirectionX) || -rival.orbitSide;
  }

  #updateRivalFiddleRecovery(dt) {
    const rival = this.rival;
    rival.state = "fiddle-recovery";
    rival.jetpackActive = true;
    rival.attackTimer = Math.max(0, rival.attackTimer - dt);
    this.#updateRivalJetpack(dt, 0.4);
    if (rival.attackTimer <= 0) {
      rival.attackState = "idle";
      rival.attackKind = "none";
      rival.state = "chasing";
      rival.attackCooldown = this.rivalRandom.uniform(
        RIVAL_FIDDLE_DROP.cooldownMinimumSeconds,
        RIVAL_FIDDLE_DROP.cooldownMaximumSeconds,
      );
    }
  }

  #applyRivalFiddleHits() {
    const rival = this.rival;
    if (!rival.fiddleHitCow && this.#rivalFiddleHitsPlayer()) {
      rival.fiddleHitCow = true;
      rival.stats.cowHits += 1;
      rival.stats.fiddleCowHits += 1;
      const direction =
        Math.sign(rival.fiddleDirectionX) || rival.facing || 1;
      this.player.vx =
        direction *
        RIVAL_FIDDLE_DROP.cowKnockbackHorizontal *
        this.speedMultiplier;
      this.player.vy = Math.max(
        this.player.vy,
        RIVAL_FIDDLE_DROP.cowKnockbackDown * this.speedMultiplier,
      );
      this.player.onGround = false;
      this.player.slashTimer = 0;
      this.reentryStage = 0;
      this.hitPauseTimer = Math.max(this.hitPauseTimer, 0.04);
      this.#emit("rivalFiddleHit");
    }

    let remaining =
      RIVAL_FIDDLE_DROP.maximumBalloonPopsPerDrop -
      rival.fiddleBalloonPops;
    if (remaining <= 0) {
      return;
    }
    const hitBalloons = this.balloons.filter(
      (balloon) =>
        balloon.alive &&
        this.#rivalMayPopBalloon(balloon) &&
        this.#rivalCanInteractOnScreen(balloon) &&
        this.#rivalFiddleHitsCircle(
          balloon.x,
          balloon.y,
          balloon.radius,
        ),
    );
    for (const balloon of hitBalloons) {
      if (remaining <= 0) {
        break;
      }
      rival.fiddleBalloonPops += 1;
      rival.stats.fiddleBalloonPops += 1;
      remaining -= 1;
      this.#popBalloonForRival(balloon);
    }
  }

  #rivalFiddleHitsPlayer() {
    return this.#rivalFiddleHitsCircle(
      this.player.x,
      this.player.y,
      Math.max(PLAYER.width, PLAYER.height) * 0.42,
    );
  }

  #rivalFiddleHitsCircle(x, y, radius) {
    return this.#circleHitsSegment(
      x,
      y,
      RIVAL_FIDDLE_DROP.collisionRadius + radius,
      [this.rival.previousX, this.rival.previousY],
      [this.rival.x, this.rival.y],
    );
  }

  #constrainRivalHorizontally() {
    const rival = this.rival;
    const left = RIVAL_CHASE.edgeInsetX;
    const right = GAME_WIDTH - RIVAL_CHASE.edgeInsetX;
    if (rival.x < left) {
      rival.x = left;
      rival.vx = Math.abs(rival.vx) * RIVAL_CHASE.edgeTurnVelocityRetention;
      rival.facing = 1;
      rival.orbitSide = 1;
      rival.stats.edgeTurns += 1;
    } else if (rival.x > right) {
      rival.x = right;
      rival.vx = -Math.abs(rival.vx) * RIVAL_CHASE.edgeTurnVelocityRetention;
      rival.facing = -1;
      rival.orbitSide = -1;
      rival.stats.edgeTurns += 1;
    }
  }

  #startRivalBowSwipe(direction) {
    const rival = this.rival;
    if (!rival.active || !rival.visible || rival.attackState !== "idle") {
      return false;
    }
    rival.attackState = "telegraph";
    rival.attackKind = "bow-swipe";
    rival.lastAttackKind = "bow-swipe";
    rival.attackTimer = RIVAL_BOW_SWIPE.telegraphSeconds;
    rival.attackDirection =
      Math.sign(Number(direction)) ||
      Math.sign(this.player.x - rival.x) ||
      rival.facing ||
      1;
    rival.attackLockedY = rival.y;
    rival.attackHitCow = false;
    rival.attackBalloonPops = 0;
    rival.attackLockedY = rival.y;
    rival.facing = rival.attackDirection;
    rival.state = "swipe-telegraph";
    rival.stats.bowSwipes += 1;
    this.#emit("rivalSwipeTelegraph");
    return true;
  }

  #applyRivalSwipeHits() {
    const rival = this.rival;
    if (!rival.attackHitCow && this.#rivalSwipeHitsPlayer()) {
      rival.attackHitCow = true;
      rival.stats.cowHits += 1;
      this.player.vx =
        rival.attackDirection *
        RIVAL_BOW_SWIPE.cowKnockbackHorizontal *
        this.speedMultiplier;
      this.player.vy = Math.max(
        this.player.vy,
        RIVAL_BOW_SWIPE.cowKnockbackDown * this.speedMultiplier,
      );
      this.player.onGround = false;
      this.player.slashTimer = 0;
      this.reentryStage = 0;
      this.hitPauseTimer = Math.max(this.hitPauseTimer, 0.035);
      this.#emit("rivalHit");
    }

    if (
      rival.attackBalloonPops >=
      RIVAL_BOW_SWIPE.maximumBalloonPopsPerSwipe
    ) {
      return;
    }
    const hitBalloon = this.balloons.find(
      (balloon) =>
        balloon.alive &&
        !balloon.landmarkApproach &&
        this.#rivalCanInteractOnScreen(balloon) &&
        this.#rivalSwipeHitsCircle(balloon.x, balloon.y, balloon.radius),
    );
    if (hitBalloon) {
      rival.attackBalloonPops += 1;
      this.#popBalloonForRival(hitBalloon);
    }
  }

  #rivalSwipeHitsPlayer() {
    return this.#rivalSwipeHitsCircle(
      this.player.x,
      this.player.y,
      Math.max(PLAYER.width, PLAYER.height) * 0.42,
    );
  }

  #rivalSwipeHitsCircle(x, y, radius) {
    const rival = this.rival;
    if (
      Math.abs(y - rival.y) >
      RIVAL_BOW_SWIPE.hitHalfHeight + radius
    ) {
      return false;
    }
    const direction = rival.attackDirection;
    const sweepStart = Math.min(rival.previousX, rival.x);
    const sweepEnd = Math.max(rival.previousX, rival.x);
    const left =
      direction > 0
        ? sweepStart - RIVAL_CHASE.physicsWidth * 0.25
        : sweepStart - RIVAL_BOW_SWIPE.hitReach;
    const right =
      direction > 0
        ? sweepEnd + RIVAL_BOW_SWIPE.hitReach
        : sweepEnd + RIVAL_CHASE.physicsWidth * 0.25;
    return x + radius >= left && x - radius <= right;
  }

  #swordHitsRival() {
    const rival = this.rival;
    if (
      this.playMode !== PLAY_MODES.COW_VS_CAT ||
      !rival.present ||
      !rival.visible ||
      !rival.active ||
      ![
        "telegraph",
        "recovery",
        "boost-telegraph",
        "boost-recovery",
        "fiddle-telegraph",
        "fiddle-recovery",
      ].includes(rival.attackState) ||
      !this.#isSlashing() ||
      this.player.y >= rival.y - 6
    ) {
      return false;
    }
    return this.#circleHitsSegment(
      rival.x,
      rival.y,
      46,
      ...this.#swordSegment(),
    );
  }

  #knockDownRival() {
    const rival = this.rival;
    rival.stats.counterHitsTaken += 1;
    rival.retreatPending =
      rival.stats.counterHitsTaken %
        RIVAL_JETPACK.countersBeforeRetreat ===
      0;
    if (rival.retreatPending) {
      rival.stats.retreats += 1;
    }
    rival.attackState = "idle";
    rival.attackKind = "none";
    rival.attackTimer = 0;
    rival.attackCooldown = RIVAL_JETPACK.postCounterAttackDelay;
    rival.postOvertakeHoldRemaining = 0;
    rival.overtakeQueued = false;
    rival.state = "knocked-down";
    rival.jetpackActive = false;
    rival.knockdownRemaining = RIVAL_JETPACK.knockdownSeconds;
    rival.vx =
      (Math.sign(rival.x - this.player.x) || -this.player.facing) *
      RIVAL_JETPACK.knockdownHorizontalSpeed;
    rival.vy = RIVAL_JETPACK.knockdownInitialDownSpeed;
    this.#bounce(
      RIVAL_JETPACK.counterBounceSpeed * this.speedMultiplier,
    );
    this.fallPeakHeight = this.currentHeight;
    this.reentryStage = 0;
    rival.stats.counterBouncesAwarded += 1;
    this.hitPauseTimer = Math.max(this.hitPauseTimer, 0.04);
    this.#emit(rival.retreatPending ? "rivalRetreat" : "rivalCounter");
  }

  #updateRivalKnockdown(dt) {
    const rival = this.rival;
    rival.knockdownRemaining = Math.max(0, rival.knockdownRemaining - dt);
    rival.vy += RIVAL_JETPACK.knockdownGravity * dt;
    rival.x += rival.vx * dt;
    rival.y += rival.vy * dt;
    rival.vx *= Math.pow(0.94, dt * 60);
    this.#constrainRivalHorizontally();
    if (this.#rivalIsBelowViewport()) {
      this.#beginRivalRecovery();
      return;
    }
    if (rival.knockdownRemaining <= 0 && !rival.retreatPending) {
      rival.state = "chasing";
      rival.jetpackActive = true;
      rival.attackState = "idle";
      rival.attackKind = "none";
      rival.attackCooldown = RIVAL_JETPACK.postCounterAttackDelay;
    }
  }

  #updateLegacyRival(dt) {
    const rival = this.rival;
    if (
      this.playMode !== PLAY_MODES.COW_VS_CAT ||
      !rival.present ||
      !rival.movementEnabled
    ) {
      return;
    }

    if (rival.frozen) {
      rival.state = "frozen";
      rival.active = true;
      rival.visible = true;
      rival.vx = 0;
      rival.vy = 0;
      return;
    }

    if (rival.state === "grace") {
      rival.graceRemaining = Math.max(0, rival.graceRemaining - dt);
      if (rival.graceRemaining <= 0) {
        this.#activateRival(false);
      }
      return;
    }

    if (rival.state === "recovering") {
      rival.recoveryRemaining = Math.max(
        0,
        rival.recoveryRemaining - dt,
      );
      if (rival.recoveryRemaining <= 0) {
        this.#activateRival(true);
      }
      return;
    }

    if (!rival.active || !rival.visible) {
      return;
    }

    if (this.#rivalIsBelowViewport()) {
      this.#beginRivalRecovery();
      return;
    }

    rival.entryRemaining = Math.max(0, rival.entryRemaining - dt);
    rival.lastBounceCooldown = Math.max(
      0,
      rival.lastBounceCooldown - dt,
    );
    rival.decisionRemaining = Math.max(0, rival.decisionRemaining - dt);

    const tooFarAhead =
      this.player.y - rival.y > RIVAL_CHASE.tooFarAheadDistance;
    if (tooFarAhead) {
      if (!rival.waitingForCow) {
        rival.waitingForCow = true;
        rival.stats.breathers += 1;
        this.#emit("rivalBreather");
      }
      rival.pauseRemaining = 0;
      rival.state = "breather";
      rival.targetBalloonId = null;
    } else {
      if (rival.waitingForCow) {
        rival.waitingForCow = false;
        rival.nextBreatherSeconds = this.#nextRivalBreatherDelay();
      }
      if (rival.pauseRemaining > 0) {
        rival.pauseRemaining = Math.max(0, rival.pauseRemaining - dt);
        rival.state = "breather";
        if (rival.pauseRemaining <= 0) {
          rival.state =
            rival.entryRemaining > 0 ? "reentering" : "chasing";
          rival.nextBreatherSeconds = this.#nextRivalBreatherDelay();
        }
      } else {
        rival.state = rival.entryRemaining > 0 ? "reentering" : "chasing";
        rival.nextBreatherSeconds -= dt;
        if (rival.nextBreatherSeconds <= 0) {
          this.#startRivalBreather();
        }
      }
    }

    if (rival.decisionRemaining <= 0) {
      this.#chooseRivalTargetBalloon();
      rival.decisionRemaining = RIVAL_CHASE.decisionIntervalSeconds;
    }

    const targetBalloon = this.balloons.find(
      (balloon) =>
        balloon.alive && balloon.id === rival.targetBalloonId,
    );
    const playerDelta = directDelta(rival.x, this.player.x);
    const closeInAltitude =
      Math.abs(rival.y - this.player.y) <=
      RIVAL_CHASE.engagementVerticalBand;
    let targetX = targetBalloon?.x ?? this.player.x;
    if (closeInAltitude) {
      const playerSide =
        Math.sign(playerDelta) || (rival.facing >= 0 ? 1 : -1);
      targetX =
        this.player.x - playerSide * RIVAL_CHASE.engagementDistanceX;
    }
    targetX = clamp(
      targetX,
      RIVAL_CHASE.edgeInsetX,
      GAME_WIDTH - RIVAL_CHASE.edgeInsetX,
    );
    const horizontalDelta = directDelta(rival.x, targetX);
    const speed = this.speedMultiplier * rival.chaseSpeedScale;
    const breathing = rival.state === "breather";

    if (!breathing && Math.abs(horizontalDelta) > RIVAL_CHASE.horizontalDeadZone) {
      const direction = Math.sign(horizontalDelta);
      rival.facing = direction || rival.facing;
      rival.vx += direction * RIVAL_CHASE.acceleration * speed * dt;
    } else {
      rival.vx *= breathing ? 0.78 : RIVAL_CHASE.airDragPerStep;
    }
    if (
      !breathing &&
      closeInAltitude &&
      Math.abs(playerDelta) < RIVAL_CHASE.minimumVisualSeparationX
    ) {
      const awayDirection =
        playerDelta >= 0 ? -1 : 1;
      rival.vx +=
        awayDirection * RIVAL_CHASE.acceleration * speed * dt * 0.8;
    }
    rival.vx = clamp(
      rival.vx,
      -RIVAL_CHASE.maxRunSpeed * speed,
      RIVAL_CHASE.maxRunSpeed * speed,
    );

    if (rival.onGround && !breathing) {
      rival.vy = -RIVAL_CHASE.groundJumpSpeed * speed;
      rival.onGround = false;
      rival.stats.jumps += 1;
    }

    rival.vy += RIVAL_CHASE.gravity * this.speedMultiplier * dt;
    rival.x += rival.vx * dt;
    rival.y += rival.vy * dt;

    if (rival.x < RIVAL_CHASE.edgeInsetX) {
      rival.x = RIVAL_CHASE.edgeInsetX;
      rival.vx = Math.abs(rival.vx) * RIVAL_CHASE.edgeTurnVelocityRetention;
      rival.facing = 1;
      rival.targetBalloonId = null;
      rival.stats.edgeTurns += 1;
    } else if (rival.x > GAME_WIDTH - RIVAL_CHASE.edgeInsetX) {
      rival.x = GAME_WIDTH - RIVAL_CHASE.edgeInsetX;
      rival.vx = -Math.abs(rival.vx) * RIVAL_CHASE.edgeTurnVelocityRetention;
      rival.facing = -1;
      rival.targetBalloonId = null;
      rival.stats.edgeTurns += 1;
    }

    if (this.#rivalIsBelowViewport()) {
      this.#beginRivalRecovery();
      return;
    }

    if (!breathing && rival.vy > 0) {
      const landingBalloon = this.balloons.find(
        (balloon) => this.#rivalTouchesBalloon(balloon),
      );
      if (landingBalloon) {
        const contactY =
          landingBalloon.y - landingBalloon.radius * 0.58;
        rival.y = contactY - RIVAL_CHASE.physicsHeight * 0.5;
        rival.vy = -RIVAL_CHASE.balloonBounceSpeed * speed;
        rival.onGround = false;
        rival.targetBalloonId = null;
        rival.lastBounceBalloonId = landingBalloon.id;
        rival.lastBounceCooldown =
          RIVAL_CHASE.repeatedBalloonCooldownSeconds;
        rival.stats.balloonBounces += 1;
        this.#popBalloonForRival(landingBalloon);
        this.#emit("rivalBounce");
      }
    }

    const floorY = WORLD_FLOOR_Y - RIVAL_CHASE.physicsHeight * 0.5;
    if (rival.y > floorY) {
      rival.y = floorY;
      rival.vy = 0;
      rival.onGround = true;
      rival.targetBalloonId = null;
    } else {
      rival.onGround = false;
    }
  }

  #activateRival(reentry) {
    const rival = this.rival;
    const spawnOnLeft = this.player.x >= GAME_WIDTH * 0.5;
    rival.x = reentry
      ? clamp(
          rival.recoveryX,
          RIVAL_CHASE.edgeInsetX,
          GAME_WIDTH - RIVAL_CHASE.edgeInsetX,
        )
      : spawnOnLeft
        ? RIVAL_CHASE.entryInsetX
        : GAME_WIDTH - RIVAL_CHASE.entryInsetX;
    const floorY = WORLD_FLOOR_Y - RIVAL_CHASE.physicsHeight * 0.5;
    const visibleBottomY =
      this.cameraY +
      this.viewportHeight -
      RIVAL_CHASE.entryVisibleBottomInset;
    rival.y = reentry ? Math.min(floorY, visibleBottomY) : floorY;
    rival.previousX = rival.x;
    rival.previousY = rival.y;
    rival.vx = 0;
    rival.vy = reentry ? -180 * rival.chaseSpeedScale : 0;
    rival.facing = Math.sign(directDelta(rival.x, this.player.x)) || 1;
    rival.orbitSide = Math.sign(rival.x - this.player.x) || -1;
    rival.onGround = false;
    rival.jetpackActive = true;
    rival.visible = true;
    rival.active = true;
    rival.state = reentry ? "reentering" : "chasing";
    rival.entryRemaining = reentry ? 0.85 : 0.55;
    rival.recoveryRemaining = 0;
    rival.graceRemaining = 0;
    rival.pauseRemaining = 0;
    rival.waitingForCow = false;
    rival.nextBreatherSeconds = this.#nextRivalBreatherDelay();
    rival.targetBalloonId = null;
    rival.decisionRemaining = 0;
    rival.attackState = "idle";
    rival.attackKind = "none";
    rival.attackTimer = 0;
    rival.attackCooldown = reentry
      ? RIVAL_JETPACK.postCounterAttackDelay
      : RIVAL_BOW_SWIPE.initialDelaySeconds;
    rival.attackHitCow = false;
    rival.attackBalloonPops = 0;
    rival.boostHitCow = false;
    rival.boostClanked = false;
    rival.boostBalloonPops = 0;
    rival.boostLockedX = rival.x;
    rival.boostOvertookCow = false;
    rival.postOvertakeHoldRemaining = 0;
    rival.postOvertakeHoldY = rival.y;
    rival.overtakeQueued = false;
    rival.fiddleDirectionX = 0;
    rival.fiddleDirectionY = 1;
    rival.fiddleTargetX = rival.x;
    rival.fiddleTargetY = rival.y;
    rival.fiddleHitCow = false;
    rival.fiddleBalloonPops = 0;
    rival.exhaustEmitRemaining = 0;
    rival.exhaustTrail = [];
    rival.rubberBandActive = false;
    rival.rubberBandPending = false;
    rival.rubberBandStrength = 0;
    rival.rubberBandScreenY = rival.y - this.cameraY;
    rival.rubberBandVerticalLag = rival.y - this.player.y;
    rival.rubberBandOffscreenSeconds = 0;
    rival.postOvertakeHoldRemaining = 0;
    rival.overtakeQueued = false;
    rival.knockdownRemaining = 0;
    rival.retreatPending = false;
    rival.stats.entries += 1;
    this.#emit(reentry ? "rivalReturn" : "rivalEnter");
  }

  #beginRivalOpeningGrace() {
    const rival = this.rival;
    rival.state = "grace";
    rival.graceRemaining = RIVAL_CHASE.openingGraceSeconds;
    rival.visible = false;
    rival.active = false;
    rival.jetpackActive = false;
    rival.vx = 0;
    rival.vy = 0;
  }

  #beginRivalRecovery() {
    const rival = this.rival;
    if (rival.state === "recovering") {
      return;
    }
    rival.state = "recovering";
    rival.recoveryX = clamp(
      rival.x,
      RIVAL_CHASE.edgeInsetX,
      GAME_WIDTH - RIVAL_CHASE.edgeInsetX,
    );
    rival.active = false;
    rival.visible = false;
    rival.jetpackActive = false;
    rival.vx = 0;
    rival.vy = 0;
    rival.attackState = "idle";
    rival.attackKind = "none";
    rival.attackTimer = 0;
    rival.recoveryRemaining = RIVAL_CHASE.recoveryDelaySeconds;
    rival.rubberBandActive = false;
    rival.rubberBandPending = false;
    rival.rubberBandStrength = 0;
    rival.rubberBandOffscreenSeconds = 0;
    rival.waitingForCow = false;
    rival.targetBalloonId = null;
    rival.stats.recoveries += 1;
    this.#emit("rivalRecover");
  }

  #startRivalBreather() {
    const rival = this.rival;
    if (rival.pauseRemaining > 0) {
      return;
    }
    rival.pauseRemaining = this.rivalRandom.uniform(
      RIVAL_CHASE.breatherMinimumDurationSeconds,
      RIVAL_CHASE.breatherMaximumDurationSeconds,
    );
    rival.state = "breather";
    rival.waitingForCow = false;
    rival.targetBalloonId = null;
    rival.stats.breathers += 1;
    this.#emit("rivalBreather");
  }

  #nextRivalBreatherDelay() {
    return this.rivalRandom.uniform(
      RIVAL_CHASE.breatherMinimumDelaySeconds,
      RIVAL_CHASE.breatherMaximumDelaySeconds,
    );
  }

  #chooseRivalTargetBalloon() {
    const rival = this.rival;
    const current = this.balloons.find(
      (balloon) =>
        balloon.alive &&
        balloon.id === rival.targetBalloonId &&
        this.#rivalMayPopBalloon(balloon),
    );
    if (current) {
      const verticalDelta = rival.y - current.y;
      const horizontalDistance = Math.abs(
        directDelta(rival.x, current.x),
      );
      if (
        verticalDelta >= -190 &&
        verticalDelta <= RIVAL_CHASE.targetMaximumRise &&
        current.y >= this.player.y - RIVAL_CHASE.maximumLeadDistance &&
        horizontalDistance <=
          RIVAL_CHASE.targetMaximumHorizontalDistance + 45
      ) {
        return current;
      }
    }

    const candidates = this.balloons
      .filter((balloon) => {
        if (!balloon.alive) {
          return false;
        }
        if (!this.#rivalMayPopBalloon(balloon)) {
          return false;
        }
        if (
          balloon.y <
          this.player.y - RIVAL_CHASE.maximumLeadDistance
        ) {
          return false;
        }
        if (
          rival.lastBounceCooldown > 0 &&
          balloon.id === rival.lastBounceBalloonId
        ) {
          return false;
        }
        const rise = rival.y - balloon.y;
        const horizontalDistance = Math.abs(
          directDelta(rival.x, balloon.x),
        );
        return (
          rise >= RIVAL_CHASE.targetMinimumRise &&
          rise <= RIVAL_CHASE.targetMaximumRise &&
          horizontalDistance <= RIVAL_CHASE.targetMaximumHorizontalDistance
        );
      })
      .map((balloon) => {
        const rise = rival.y - balloon.y;
        const horizontalDistance = Math.abs(
          directDelta(rival.x, balloon.x),
        );
        return {
          balloon,
          score:
            rise * 1.35 -
            horizontalDistance * 0.72 +
            (balloon.routeRole === "side"
              ? RIVAL_CHASE.sideBalloonTargetBonus
              : 0),
        };
      })
      .sort((a, b) => b.score - a.score);

    rival.targetBalloonId = candidates[0]?.balloon.id || null;
    return candidates[0]?.balloon || null;
  }

  #rivalTouchesBalloon(balloon) {
    const rival = this.rival;
    if (
      !balloon.alive ||
      !this.#rivalMayPopBalloon(balloon) ||
      !this.#rivalCanInteractOnScreen(balloon)
    ) {
      return false;
    }
    if (
      balloon.y <
      this.player.y - RIVAL_CHASE.maximumLeadDistance
    ) {
      return false;
    }
    if (
      rival.lastBounceCooldown > 0 &&
      balloon.id === rival.lastBounceBalloonId
    ) {
      return false;
    }
    const contactY = balloon.y - balloon.radius * 0.58;
    const previousFootY =
      rival.previousY + RIVAL_CHASE.physicsHeight * 0.5;
    const footY = rival.y + RIVAL_CHASE.physicsHeight * 0.5;
    const horizontalDistance = Math.abs(
      directDelta(rival.x, balloon.x),
    );
    return (
      previousFootY <= contactY + RIVAL_CHASE.balloonContactPadding &&
      footY >= contactY &&
      horizontalDistance <=
        balloon.radius + RIVAL_CHASE.physicsWidth * 0.32
    );
  }

  #rivalMayPopBalloon(balloon) {
    if (!balloon?.alive || balloon.routeRole === "leaderboard") {
      return false;
    }
    if (balloon.routeRole === "side") {
      return true;
    }
    if (balloon.landmarkApproach) {
      return false;
    }
    return this.balloons.some(
      (alternative) =>
        alternative !== balloon &&
        alternative.alive &&
        alternative.routeRole === "side" &&
        Math.abs(alternative.y - balloon.y) <=
          RIVAL_CHASE.alternateBalloonVerticalBand &&
        Math.abs(directDelta(balloon.x, alternative.x)) <=
          RIVAL_CHASE.alternateBalloonMaximumHorizontalDistance,
    );
  }

  #rivalCanInteractOnScreen(balloon) {
    const margin = RIVAL_CHASE.visibleInteractionMargin;
    const rivalScreenY = this.rival.y - this.cameraY;
    const balloonScreenY = balloon.y - this.cameraY;
    return (
      rivalScreenY >= -margin &&
      rivalScreenY <= this.viewportHeight + margin &&
      balloonScreenY >= -margin &&
      balloonScreenY <= this.viewportHeight + margin
    );
  }

  #rivalIsBelowViewport() {
    return (
      this.rival.y - this.cameraY >
      this.viewportHeight + RIVAL_CHASE.recoveryOffscreenMargin
    );
  }

  #popBalloonForRival(balloon) {
    balloon.alive = false;
    balloon.poppedTimer = 0.001;
    if (!this.debugBalloonOverride) {
      this.poppedBalloonIds.add(balloon.id);
    }
    this.popEffects.push({
      x: balloon.x,
      y: balloon.y,
      age: 0,
      color: balloon.color,
      boosted: false,
      source: "rival",
    });
    this.rival.stats.balloonPops += 1;
    if (balloon.routeRole === "side") {
      this.rival.stats.sideBalloonPops += 1;
    } else {
      this.rival.stats.mainBalloonPops += 1;
    }
    this.#emit("rivalBalloonPop");
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
      const id = leaderboardBalloonIdentity(
        this.playMode,
        entry,
        duplicateIndex,
      );
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
    const generated = this.#ensureRivalRouteRedundancy(
      this.route.spawnThrough(activeTopY),
    );
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

  #ensureRivalRouteRedundancy(generated) {
    if (
      this.playMode !== PLAY_MODES.COW_VS_CAT ||
      this.debugBalloonOverride ||
      !generated.length
    ) {
      return generated;
    }
    const results = [...generated];
    const mainBalloons = generated.filter(
      (balloon) =>
        balloon.routeRole === "main" && !balloon.landmarkApproach,
    );
    for (const main of mainBalloons) {
      const hasNearbySide = results.some(
        (balloon) =>
          balloon.routeRole === "side" &&
          Math.abs(balloon.y - main.y) <= ROUTE.sideYJitter + 1,
      );
      if (hasNearbySide) {
        continue;
      }
      const numericId = Number.parseInt(main.id.replace(/\D/g, ""), 10) || 1;
      const radius =
        RIVAL_ROUTE.backupRadiusMinimum +
        (numericId %
          (RIVAL_ROUTE.backupRadiusMaximum -
            RIVAL_ROUTE.backupRadiusMinimum +
            1));
      const margin = radius + 32;
      const direction = main.x <= GAME_WIDTH * 0.5 ? 1 : -1;
      const x = clamp(
        main.x + direction * RIVAL_ROUTE.backupHorizontalOffset,
        margin,
        GAME_WIDTH - margin,
      );
      results.push({
        id: `${main.id}-combat-backup`,
        x,
        y: main.y,
        radius,
        color: ROUTE.colors[(numericId + 1) % ROUTE.colors.length],
        wobble: ((numericId * 1.61803398875) % 1) * Math.PI * 2,
        routeRole: "side",
        landmarkApproach: null,
        alive: true,
        poppedTimer: 0,
      });
      this.rivalRouteBackupCount += 1;
    }
    return results;
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
      this.savedBestByMode[this.playMode] = this.savedBestHeight;
      writeSavedBest(
        this.savedBestHeight,
        scoreStorageKeyForMode(this.playMode),
      );
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
export const PhaseElevenGame = PhaseSixGame;
export const PhaseTwelveGame = PhaseSixGame;
export const PhaseThirteenGame = PhaseSixGame;
export const PhaseFourteenGame = PhaseSixGame;
export const PhaseFifteenGame = PhaseSixGame;
export const OverTheMoonGame = PhaseSixGame;
