import { AssetLoader } from "./assets.js?v=10.2.0";
import { GameAudio } from "./audio.js?v=10.2.0";
import {
  ASSET_MANIFEST,
  BUILD_VERSION,
  PHASE,
  QUALITY_PROFILE_ORDER,
  RELEASE_CONFIG,
  RUNTIME_CONFIG,
  detectInitialQuality,
  resolveQualityProfile,
} from "./config.js?v=10.2.0";
import { CAMERA } from "./game-config.js?v=10.2.0";
import { OverTheMoonGame } from "./game.js?v=10.2.0";
import { InputController } from "./input.js?v=10.2.0";
import { LayoutController } from "./layout.js?v=10.2.0";
import { LeaderboardService } from "./leaderboard.js?v=10.2.0";
import { AdaptiveQualityController } from "./performance.js?v=10.2.0";
import { ShellRenderer } from "./renderer.js?v=10.2.0";
import { FixedStepRuntime } from "./runtime.js?v=10.2.0";

const root = document.querySelector("#viewport-root");
const stage = document.querySelector("#game-stage");
const canvas = document.querySelector("#game-canvas");
const fullscreenButton = document.querySelector("#fullscreen-button");
const soundButton = document.querySelector("#sound-button");
const devButton = document.querySelector("#dev-button");
const devPanel = document.querySelector("#dev-panel");
const devClose = document.querySelector("#dev-close");
const devLandmarkSelect = document.querySelector("#dev-landmark-select");
const devLandmarkHeight = document.querySelector("#dev-landmark-height");
const devPrevious = document.querySelector("#dev-previous");
const devNext = document.querySelector("#dev-next");
const devSpeedToggle = document.querySelector("#dev-speed-toggle");
const devSpeedStatus = document.querySelector("#dev-speed-status");
const devTestBird = document.querySelector("#dev-test-bird");
const devTestSaucer = document.querySelector("#dev-test-saucer");
const devWarp = document.querySelector("#dev-warp");
const startOverlay = document.querySelector("#start-overlay");
const startButton = document.querySelector("#start-button");
const howToPlayButton = document.querySelector("#how-to-play-button");
const menuLeaderboardButton = document.querySelector(
  "#menu-leaderboard-button",
);
const howToPlayOverlay = document.querySelector("#how-to-play-overlay");
const howToPlayClose = document.querySelector("#how-to-play-close");
const howToPlayBack = document.querySelector("#how-to-play-back");
const howToAppTip = document.querySelector("#how-to-app-tip");
const touchControls = document.querySelector("#touch-controls");
const touchLeft = document.querySelector("#touch-left");
const touchRight = document.querySelector("#touch-right");
const touchAction = document.querySelector("#touch-action");
const touchActionLabel = document.querySelector(".touch-action-label");
const deathActions = document.querySelector("#death-actions");
const deathPrimary = document.querySelector("#death-primary");
const deathRetry = document.querySelector("#death-retry");
const leaderboardPanel = document.querySelector("#leaderboard-panel");
const leaderboardRunSummary = document.querySelector(
  "#leaderboard-run-summary",
);
const leaderboardRunScore = document.querySelector("#leaderboard-run-score");
const leaderboardEntry = document.querySelector("#leaderboard-entry");
const leaderboardInitials = document.querySelector("#leaderboard-initials");
const leaderboardSubmit = document.querySelector("#leaderboard-submit");
const leaderboardEntryStatus = document.querySelector(
  "#leaderboard-entry-status",
);
const leaderboardList = document.querySelector("#leaderboard-list");
const leaderboardEmpty = document.querySelector("#leaderboard-empty");
const leaderboardActions = document.querySelector("#leaderboard-actions");
const leaderboardBack = document.querySelector("#leaderboard-back");
const leaderboardRetry = document.querySelector("#leaderboard-retry");
const rotateOverlay = document.querySelector("#rotate-overlay");
const appModeOverlay = document.querySelector("#app-mode-overlay");
const appModeClose = document.querySelector("#app-mode-close");
const liveStatus = document.querySelector("#live-status");

if (
  !(
    root &&
    stage &&
    canvas &&
    fullscreenButton &&
    soundButton &&
    devButton &&
    devPanel &&
    devClose &&
    devLandmarkSelect &&
    devLandmarkHeight &&
    devPrevious &&
    devNext &&
    devSpeedToggle &&
    devSpeedStatus &&
    devTestBird &&
    devTestSaucer &&
    devWarp &&
    startOverlay &&
    startButton &&
    howToPlayButton &&
    menuLeaderboardButton &&
    howToPlayOverlay &&
    howToPlayClose &&
    howToPlayBack &&
    howToAppTip &&
    touchControls &&
    touchLeft &&
    touchRight &&
    touchAction &&
    touchActionLabel &&
    deathActions &&
    deathPrimary &&
    deathRetry &&
    leaderboardPanel &&
    leaderboardRunSummary &&
    leaderboardRunScore &&
    leaderboardEntry &&
    leaderboardInitials &&
    leaderboardSubmit &&
    leaderboardEntryStatus &&
    leaderboardList &&
    leaderboardEmpty &&
    leaderboardActions &&
    leaderboardBack &&
    leaderboardRetry &&
    rotateOverlay &&
    appModeOverlay &&
    appModeClose &&
    liveStatus
  )
) {
  throw new Error(`Phase ${PHASE} is missing required DOM elements.`);
}

const standaloneMedia = globalThis.matchMedia?.("(display-mode: standalone)");
const coarsePointerMedia = globalThis.matchMedia?.("(pointer: coarse)");
const isIPhone = /iPhone|iPod/i.test(navigator.userAgent);
const detectStandalone = () =>
  standaloneMedia?.matches === true || navigator.standalone === true;
const fullscreenApiAvailable =
  document.fullscreenEnabled === true &&
  typeof stage.requestFullscreen === "function";
const hasCoarsePointer = () => coarsePointerMedia?.matches === true;
const DEV_TOOLS_STORAGE_KEY = "over-the-moon.dev-tools";
const devModeParameter = new URLSearchParams(
  globalThis.location.search,
).get(RELEASE_CONFIG.devToolsQueryParameter);
const readRememberedDevMode = () => {
  try {
    return globalThis.localStorage?.getItem(DEV_TOOLS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};
const rememberDevMode = (enabled) => {
  try {
    if (enabled) {
      globalThis.localStorage?.setItem(DEV_TOOLS_STORAGE_KEY, "1");
    } else {
      globalThis.localStorage?.removeItem(DEV_TOOLS_STORAGE_KEY);
    }
  } catch {
    // Query-gated dev mode still works when storage is unavailable.
  }
};
if (devModeParameter === "1") {
  rememberDevMode(true);
} else if (devModeParameter === "0") {
  rememberDevMode(false);
}
const devModeEnabled =
  devModeParameter === "1" ||
  (devModeParameter !== "0" && readRememberedDevMode());
const serviceWorkerSupported = "serviceWorker" in navigator;

const initialQuality = detectInitialQuality();
const loader = new AssetLoader(ASSET_MANIFEST);
const renderer = new ShellRenderer(canvas);
const audio = new GameAudio();
const leaderboard = new LeaderboardService();
const game = new OverTheMoonGame({
  leaderboard: leaderboard.getSnapshot(),
  onEvent: (name, snapshot) => {
    audio.play(name);
    if (name === "gameOver") {
      audio.setAltitude(snapshot.heightMeters, "gameover");
      leaderboard.refresh({ force: true });
      liveStatus.textContent = snapshot.newBest
        ? `Run over at ${snapshot.finalScoreMeters} meters. New local best.`
        : `Run over at ${snapshot.finalScoreMeters} meters.`;
    } else if (name === "scoreSubmit") {
      leaderboard.submit(
        snapshot.nameEntry.initials,
        snapshot.finalScoreMeters,
      );
      liveStatus.textContent =
        `Submitting ${snapshot.nameEntry.initials} at ` +
        `${snapshot.finalScoreMeters} meters.`;
    } else if (name === "invalidInitials") {
      liveStatus.textContent = "Please choose different initials.";
    }
  },
});
const devLandmarks = game
  .getSnapshot()
  .goalMarkers.map(({ id, name, heightMeters }) => ({
    id,
    name,
    heightMeters,
  }));
const devOptions = document.createDocumentFragment();
for (const marker of devLandmarks) {
  const option = document.createElement("option");
  option.value = marker.id;
  option.textContent = `${marker.name} · ${marker.heightMeters} m`;
  devOptions.append(option);
}
devLandmarkSelect.replaceChildren(devOptions);

const state = {
  mode: "loading",
  phase: PHASE,
  elapsedMs: 0,
  interpolation: 0,
  assetsReady: false,
  assetProgress: 0,
  assetsLoaded: 0,
  assetsTotal: ASSET_MANIFEST.length,
  assetFailures: [],
  quality: initialQuality,
  qualityReason: "initial-device-profile",
  qualityControl: null,
  runtime: null,
  layout: null,
  game: game.getRenderState(0),
  input: null,
  audio: audio.getSnapshot(),
  touchControlsVisible: false,
  starting: false,
  menu: {
    view: "main",
  },
  devTools: {
    enabled: devModeEnabled,
    apiExposed: devModeEnabled,
    panelOpen: false,
    selectedIndex: 0,
    selectedLandmarkId: devLandmarks[0]?.id || null,
    selectedLandmarkName: devLandmarks[0]?.name || null,
    selectedHeightMeters: devLandmarks[0]?.heightMeters || 0,
    warpDepthBalloons: 3,
    speedLockedAtOne: false,
    lastWarp: null,
    lastFlyby: null,
  },
  display: {
    fullscreenSupported: fullscreenApiAvailable && !isIPhone,
    standalone: detectStandalone(),
    appModeGuidance: false,
    appModeOverlayOpen: false,
  },
  release: {
    ...RELEASE_CONFIG,
    pwa: {
      supported: serviceWorkerSupported,
      secureContext: Boolean(globalThis.isSecureContext),
      controlled: Boolean(navigator.serviceWorker?.controller),
      status: serviceWorkerSupported
        ? globalThis.isSecureContext
          ? "pending"
          : "requires-https"
        : "unsupported",
      cacheName: `over-the-moon-${BUILD_VERSION}`,
      registrationScope: null,
      updateFound: false,
      error: null,
    },
  },
  error: null,
};

let layoutController = null;
let runtime = null;
let qualityController = null;
let input = null;
let devPreviousManualMode = null;

const cleanInitialsInput = (value) =>
  String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 3);

const setHidden = (element, hidden) => {
  if (element.hidden !== hidden) {
    element.hidden = hidden;
  }
};

const setDisabled = (element, disabled) => {
  if (element.disabled !== disabled) {
    element.disabled = disabled;
  }
};

let leaderboardRowsSignature = "";
const syncLeaderboardRows = (snapshot) => {
  const rows = (snapshot?.topScores || []).slice(0, 10);
  const signature = JSON.stringify({
    rows: rows.map(({ initials, score }) => [initials, score]),
    localInitials: snapshot?.localInitials || "",
    localBest: snapshot?.localBest || 0,
    status: snapshot?.status || "idle",
  });
  if (signature === leaderboardRowsSignature) {
    return;
  }
  leaderboardRowsSignature = signature;

  const fragment = document.createDocumentFragment();
  rows.forEach((entry, index) => {
    const item = document.createElement("li");
    const isLocal =
      entry.initials === snapshot.localInitials &&
      entry.score === snapshot.localBest;
    item.dataset.local = String(isLocal);

    const rank = document.createElement("span");
    rank.className = "leaderboard-rank";
    rank.textContent = `${index + 1}.`;
    const name = document.createElement("span");
    name.className = "leaderboard-name";
    name.textContent = entry.initials;
    const score = document.createElement("span");
    score.className = "leaderboard-score";
    score.textContent = `${entry.score} m`;
    item.append(rank, name, score);
    fragment.append(item);
  });
  leaderboardList.replaceChildren(fragment);

  const hasRows = rows.length > 0;
  setHidden(leaderboardList, !hasRows);
  setHidden(leaderboardEmpty, hasRows);
  leaderboardEmpty.textContent =
    snapshot?.status === "loading"
      ? "Calling mission control…"
      : "No shared scores cached yet.";
};

const submittedStatusText = (leaderboardState) => {
  if (leaderboardState?.status === "error") {
    return leaderboardState.pendingCount
      ? "OFFLINE · SCORE QUEUED LOCALLY"
      : "OFFLINE · CACHED SCORES";
  }
  if (
    leaderboardState?.status === "submitting" ||
    leaderboardState?.status === "loading"
  ) {
    return "SAVING SCORE…";
  }
  return "SCORE SAVED";
};

const setMenuView = (view) => {
  if (game.mode !== "menu") {
    return false;
  }
  const nextView = ["main", "how-to-play", "leaderboard"].includes(view)
    ? view
    : "main";
  if (state.menu.view === nextView) {
    return false;
  }
  state.menu.view = nextView;
  input?.clear();
  if (nextView === "leaderboard") {
    leaderboard.refresh({ force: true });
    liveStatus.textContent = "Showing the shared leaderboard.";
  } else if (nextView === "how-to-play") {
    liveStatus.textContent = "Showing how to play.";
  } else {
    liveStatus.textContent = "Main menu.";
  }
  audio.play("ui");
  render();
  if (nextView === "how-to-play") {
    howToPlayClose.focus({ preventScroll: true });
  } else if (nextView === "leaderboard") {
    leaderboardBack.focus({ preventScroll: true });
  } else {
    startButton.focus({ preventScroll: true });
  }
  return true;
};

const syncDevToolsUi = () => {
  const devTools = state.devTools;
  const marker =
    devLandmarks[devTools.selectedIndex] || devLandmarks[0] || null;
  devTools.selectedLandmarkId = marker?.id || null;
  devTools.selectedLandmarkName = marker?.name || null;
  devTools.selectedHeightMeters = marker?.heightMeters || 0;

  setHidden(devButton, !devTools.enabled || devTools.panelOpen);
  setHidden(devPanel, !devTools.enabled || !devTools.panelOpen);
  devButton.setAttribute("aria-expanded", String(devTools.panelOpen));
  devPanel.setAttribute(
    "aria-hidden",
    String(!devTools.enabled || !devTools.panelOpen),
  );

  if (marker) {
    if (devLandmarkSelect.value !== marker.id) {
      devLandmarkSelect.value = marker.id;
    }
    const heightLabel = `${marker.heightMeters.toLocaleString()} m`;
    if (devLandmarkHeight.textContent !== heightLabel) {
      devLandmarkHeight.textContent = heightLabel;
    }
  }
  setDisabled(devPrevious, devTools.selectedIndex <= 0);
  setDisabled(
    devNext,
    devTools.selectedIndex >= devLandmarks.length - 1,
  );
  const speedLockedAtOne = state.game?.speed?.devLockedAtOne === true;
  devTools.speedLockedAtOne = speedLockedAtOne;
  devSpeedToggle.dataset.locked = String(speedLockedAtOne);
  devSpeedToggle.setAttribute("aria-pressed", String(speedLockedAtOne));
  devSpeedToggle.setAttribute(
    "aria-label",
    speedLockedAtOne
      ? "Disable one-times speed lock and restore the normal speed ramp"
      : "Lock game speed at one-times and disable the speed ramp",
  );
  devSpeedStatus.textContent = speedLockedAtOne
    ? "ON · FIXED 1×"
    : "OFF · NORMAL RAMP";
  setDisabled(devSpeedToggle, state.starting);
  setDisabled(devTestBird, !state.assetsReady || state.starting);
  setDisabled(devTestSaucer, !state.assetsReady || state.starting);
  setDisabled(devWarp, !state.assetsReady || state.starting || !marker);
};

const syncUi = () => {
  const playing = game.mode === "playing";
  const gameOver = game.mode === "gameover";
  const menuOpen = game.mode === "menu";
  if (!menuOpen && state.menu.view !== "main") {
    state.menu.view = "main";
  }
  const startMenuOpen = menuOpen && state.menu.view === "main";
  const howToPlayOpen = menuOpen && state.menu.view === "how-to-play";
  const menuLeaderboardOpen =
    menuOpen && state.menu.view === "leaderboard";
  const nameEntryActive = gameOver && game.isNameEntryActive();
  state.mode = state.assetsReady ? game.mode : "loading";
  state.touchControlsVisible =
    (playing || nameEntryActive) &&
    hasCoarsePointer() &&
    !state.devTools.panelOpen;
  state.starting = Boolean(state.starting);

  startOverlay.hidden = !startMenuOpen;
  setHidden(howToPlayOverlay, !howToPlayOpen);
  howToPlayOverlay.setAttribute("aria-hidden", String(!howToPlayOpen));
  setHidden(howToAppTip, !state.display.appModeGuidance);
  startButton.disabled = !state.assetsReady || state.starting;
  startButton.textContent = state.starting
    ? "STARTING…"
    : state.assetsReady
      ? "OVER THE MOON"
      : "LOADING…";
  setDisabled(menuLeaderboardButton, !state.assetsReady || state.starting);

  setHidden(touchControls, !state.touchControlsVisible);
  const runLeaderboardOpen =
    gameOver && state.game.deathScreen?.view === "leaderboard";
  const leaderboardOpen = runLeaderboardOpen || menuLeaderboardOpen;
  const showLeaderboardEntry =
    runLeaderboardOpen &&
    state.game.deathScreen?.qualifiesForLeaderboard;
  setHidden(leaderboardPanel, !leaderboardOpen);
  setHidden(leaderboardEntry, !showLeaderboardEntry);
  setHidden(leaderboardRunSummary, menuLeaderboardOpen);
  leaderboardActions.dataset.menu = String(menuLeaderboardOpen);
  leaderboardBack.textContent = menuLeaderboardOpen
    ? "BACK TO MENU"
    : "BACK TO RESULTS";
  leaderboardBack.setAttribute(
    "aria-label",
    menuLeaderboardOpen ? "Back to main menu" : "Back to results",
  );
  setHidden(leaderboardRetry, menuLeaderboardOpen);
  if (leaderboardOpen) {
    if (runLeaderboardOpen) {
      const scoreLabel = `${state.game.finalScoreMeters} m`;
      if (leaderboardRunScore.textContent !== scoreLabel) {
        leaderboardRunScore.textContent = scoreLabel;
      }
    }
    syncLeaderboardRows(state.game.leaderboard);
  }
  if (showLeaderboardEntry) {
    const runKey = String(state.game.runId);
    if (leaderboardEntry.dataset.runId !== runKey) {
      leaderboardEntry.dataset.runId = runKey;
      leaderboardInitials.value = cleanInitialsInput(
        state.game.leaderboard.localInitials || "AAA",
      );
      leaderboardEntry.dataset.invalid = "false";
      leaderboardEntryStatus.textContent = "A–Z / 0–9 · THREE CHARACTERS";
    }
    const submitted = Boolean(state.game.deathScreen.submitted);
    setDisabled(leaderboardInitials, submitted);
    setDisabled(
      leaderboardSubmit,
      submitted || cleanInitialsInput(leaderboardInitials.value).length !== 3,
    );
    const submitLabel = submitted ? "SUBMITTED" : "SUBMIT RUN";
    if (leaderboardSubmit.textContent !== submitLabel) {
      leaderboardSubmit.textContent = submitLabel;
    }
    if (submitted) {
      const scoreStatus = submittedStatusText(state.game.leaderboard);
      if (leaderboardEntryStatus.textContent !== scoreStatus) {
        leaderboardEntryStatus.textContent = scoreStatus;
      }
    }
  } else if (document.activeElement === leaderboardInitials) {
    leaderboardInitials.blur();
  }
  setHidden(deathActions, !gameOver || nameEntryActive || runLeaderboardOpen);
  if (gameOver && !nameEntryActive && !runLeaderboardOpen) {
    deathActions.dataset.view = "summary";
    deathPrimary.textContent = "VIEW LEADERBOARD";
    deathPrimary.setAttribute("aria-label", "View leaderboard");
    deathRetry.textContent = "CLIMB AGAIN";
    deathRetry.setAttribute("aria-label", "Climb again");
  }
  const actionLabel = gameOver
    ? game.isNameEntryActive()
      ? "ENTER"
      : "RETRY"
    : game.player.onGround
      ? "JUMP"
      : "SLASH";
  touchActionLabel.dataset.label = actionLabel;
  touchAction.setAttribute(
    "aria-label",
    actionLabel === "RETRY"
      ? "Retry"
      : actionLabel === "ENTER"
        ? "Enter initials"
      : actionLabel === "JUMP"
        ? "Jump"
        : "Slash",
  );

  const audioState = audio.getSnapshot();
  soundButton.dataset.muted = String(audioState.muted);
  soundButton.querySelector("span[aria-hidden]").textContent = audioState.muted
    ? "×"
    : "♪";
  soundButton.setAttribute(
    "aria-label",
    audioState.muted ? "Turn sound on" : "Mute sound",
  );
  soundButton.title = audioState.muted ? "Turn sound on" : "Mute sound";
  updateFullscreenButton();
  syncDevToolsUi();
};

const render = () => {
  state.runtime = runtime?.getSnapshot() || state.runtime;
  state.qualityControl = qualityController?.getSnapshot() || state.qualityControl;
  state.game = game.getRenderState(state.interpolation);
  state.input = input?.getSnapshot() || state.input;
  state.audio = audio.getSnapshot();
  syncUi();
  renderer.render(state, state.layout, loader.images);
};

const registerOfflineShell = async () => {
  const pwa = state.release.pwa;
  if (!pwa.supported || !pwa.secureContext) {
    return false;
  }

  pwa.status = "registering";
  pwa.error = null;
  render();
  try {
    const registration = await navigator.serviceWorker.register(
      `./service-worker.js?v=${BUILD_VERSION}`,
      {
        scope: "./",
        updateViaCache: "none",
      },
    );
    pwa.registrationScope = registration.scope;
    registration.addEventListener("updatefound", () => {
      pwa.updateFound = Boolean(navigator.serviceWorker.controller);
      pwa.status = "installing";
      render();
    });
    await navigator.serviceWorker.ready;
    pwa.controlled = Boolean(navigator.serviceWorker.controller);
    pwa.status = pwa.controlled ? "controlled" : "ready";
    render();
    return true;
  } catch (error) {
    pwa.status = "error";
    pwa.error = error instanceof Error ? error.message : String(error);
    render();
    return false;
  }
};

const setDevPanelOpen = (open) => {
  if (!state.devTools.enabled) {
    return false;
  }
  const nextOpen = Boolean(open);
  if (nextOpen === state.devTools.panelOpen) {
    return false;
  }

  state.devTools.panelOpen = nextOpen;
  input?.clear();
  if (nextOpen) {
    devPreviousManualMode =
      runtime?.getSnapshot().manualMode ?? false;
    runtime?.setManualMode(true);
  } else {
    const restoreAutomaticRuntime = devPreviousManualMode === false;
    devPreviousManualMode = null;
    if (restoreAutomaticRuntime) {
      runtime?.setManualMode(false);
    }
  }
  render();
  if (nextOpen) {
    devLandmarkSelect.focus({ preventScroll: true });
  } else if (!devButton.hidden) {
    devButton.focus({ preventScroll: true });
  }
  return true;
};

const setDevLandmarkIndex = (index) => {
  const nextIndex = Math.max(
    0,
    Math.min(devLandmarks.length - 1, Math.floor(Number(index) || 0)),
  );
  if (nextIndex === state.devTools.selectedIndex) {
    return false;
  }
  state.devTools.selectedIndex = nextIndex;
  audio.play("ui");
  render();
  return true;
};

const setDevSpeedLock = (locked) => {
  if (!state.devTools.enabled) {
    return false;
  }
  const nextLocked = Boolean(locked);
  const currentlyLocked = game.getSnapshot().speed.devLockedAtOne;
  if (nextLocked === currentlyLocked) {
    return false;
  }
  game.setSpeedRampEnabled(!nextLocked);
  state.devTools.speedLockedAtOne = nextLocked;
  liveStatus.textContent = nextLocked
    ? "Dev speed lock enabled. The run will stay at one-times speed."
    : "Dev speed lock disabled. The normal altitude speed ramp is active.";
  audio.play("ui");
  render();
  return true;
};

const previewDevAmbientFlyby = async (type) => {
  if (
    !state.devTools.enabled ||
    !state.assetsReady ||
    state.starting
  ) {
    return false;
  }

  state.starting = true;
  syncUi();
  await audio.unlock();
  if (game.mode !== "playing") {
    game.start();
    input.clear();
    leaderboard.retryPending();
  }
  const flyby = game.debugSpawnAmbientFlyby(type);
  state.devTools.lastFlyby = flyby
    ? {
        type: flyby.type,
        direction: flyby.direction,
        lifetimeSeconds: flyby.lifetimeSeconds,
      }
    : null;
  audio.setAltitude(game.currentHeight, "playing");
  state.starting = false;
  liveStatus.textContent =
    type === "bird"
      ? "Dev preview: distant bird flyby."
      : "Dev preview: distant flying saucer flyby.";
  audio.play("ui");
  if (!setDevPanelOpen(false)) {
    render();
  }
  return Boolean(flyby);
};

leaderboard.setOnChange((snapshot) => {
  game.setLeaderboard(snapshot);
  render();
});

const startGame = async (source = "button", seed) => {
  if (!state.assetsReady || state.starting || game.mode === "playing") {
    return false;
  }
  const retrying = game.mode === "gameover";
  state.starting = true;
  state.menu.view = "main";
  input.clear();
  syncUi();
  await audio.unlock();
  game.start(seed);
  audio.setAltitude(0, "playing");
  leaderboard.retryPending();
  input.clear();
  state.starting = false;
  audio.play(retrying ? "retry" : "ui");
  liveStatus.textContent = retrying
    ? `Phase ${PHASE} climb restarted by ${source}.`
    : `Phase ${PHASE} climb started by ${source}.`;
  render();
  return true;
};

const warpToSelectedLandmark = async () => {
  const marker = devLandmarks[state.devTools.selectedIndex];
  if (
    !state.devTools.enabled ||
    !marker ||
    !state.assetsReady ||
    state.starting
  ) {
    return false;
  }

  state.starting = true;
  syncUi();
  await audio.unlock();
  game.start();
  input.clear();
  const warp = game.debugWarpBelowLandmark(
    marker.id,
    state.devTools.warpDepthBalloons,
  );
  audio.setAltitude(game.currentHeight, "playing");
  leaderboard.retryPending();
  state.devTools.lastWarp = {
    landmarkId: warp.marker.id,
    landmarkName: warp.marker.name,
    heightMeters: warp.marker.heightMeters,
    requestedBalloonsBelow: warp.requestedBalloonsBelow,
    targetBalloonId: warp.targetBalloon?.id || null,
  };
  state.starting = false;
  liveStatus.textContent =
    `Dev jump: ${warp.marker.name}, ` +
    `${warp.requestedBalloonsBelow} balloons below.`;
  audio.play("ui");
  setDevPanelOpen(false);
  return true;
};

input = new InputController({
  leftButton: touchLeft,
  rightButton: touchRight,
  actionButton: touchAction,
  onActionPressed: (source) => {
    if (
      game.mode === "menu" &&
      document.activeElement?.matches?.("button")
    ) {
      input.clearAction();
      return;
    }
    if (game.mode === "gameover" && game.isNameEntryActive()) {
      input.clearAction();
      game.advanceNameEntry();
      render();
    } else if (
      (game.mode === "menu" && state.menu.view === "main") ||
      game.mode === "gameover"
    ) {
      input.clearAction();
      startGame(source);
    }
  },
  onStartRequested: (source) => {
    if (
      game.mode === "menu" &&
      document.activeElement?.matches?.("button")
    ) {
      return;
    }
    if (game.mode === "gameover" && game.isNameEntryActive()) {
      if (source !== "keyboard-r") {
        game.advanceNameEntry();
        render();
      }
    } else if (
      (game.mode === "menu" && state.menu.view === "main") ||
      game.mode === "gameover"
    ) {
      startGame(source);
    }
  },
  onDirectionPressed: (direction) => {
    if (game.mode === "gameover" && game.isNameEntryActive()) {
      game.cycleNameEntry(direction);
      render();
    }
  },
  onBackPressed: () => {
    if (game.mode === "gameover" && game.isNameEntryActive()) {
      game.backspaceNameEntry();
      render();
    }
  },
  onCharacterPressed: (character) => {
    if (game.mode !== "gameover" || !game.isNameEntryActive()) {
      return false;
    }
    const changed = game.typeNameEntryCharacter(character);
    render();
    return changed;
  },
});

const updateOrientationOverlay = () => {
  const blocked = Boolean(state.layout?.orientationBlocked);
  const keyboardOpen = Boolean(state.layout?.keyboardOpen);
  rotateOverlay.hidden = !blocked;
  rotateOverlay.setAttribute("aria-hidden", String(!blocked));
  stage.dataset.orientationBlocked = String(blocked);
  stage.dataset.keyboardOpen = String(keyboardOpen);
};

const updateFullscreenButton = () => {
  fullscreenButton.hidden = true;
};

const setAppModeOverlay = (open) => {
  const nextOpen = Boolean(open && state.display.appModeGuidance);
  state.display.appModeOverlayOpen = nextOpen;
  appModeOverlay.hidden = !nextOpen;
  appModeOverlay.setAttribute("aria-hidden", String(!nextOpen));
  if (nextOpen) {
    appModeClose.focus({ preventScroll: true });
  } else if (!fullscreenButton.hidden) {
    fullscreenButton.focus({ preventScroll: true });
  }
};

const refreshDisplayMode = () => {
  state.display.standalone = detectStandalone();
  state.display.appModeGuidance = isIPhone && !state.display.standalone;
  if (!state.display.appModeGuidance && state.display.appModeOverlayOpen) {
    setAppModeOverlay(false);
  }
  updateFullscreenButton();
  render();
};

const toggleFullscreen = async () => {
  if (state.display.appModeGuidance) {
    setAppModeOverlay(true);
    return;
  }
  if (!state.display.fullscreenSupported) {
    return;
  }

  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await stage.requestFullscreen({ navigationUI: "hide" });
    }
  } catch (error) {
    state.error = error instanceof Error ? error.message : String(error);
    liveStatus.textContent = `Fullscreen unavailable: ${state.error}`;
  } finally {
    layoutController?.schedule();
    render();
  }
};

qualityController = new AdaptiveQualityController({
  profiles: QUALITY_PROFILE_ORDER,
  initialProfile: initialQuality,
  onChange: (profile, context) => {
    state.quality = profile;
    state.qualityReason = context.reason;
    layoutController?.setQuality(profile);
    render();
  },
});

layoutController = new LayoutController({
  root,
  stage,
  canvas,
  quality: initialQuality,
  onChange: (layout) => {
    state.layout = layout;
    game.setViewportHeight(
      layout.logicalHeight,
      hasCoarsePointer()
        ? CAMERA.touchViewportFloorMargin
        : CAMERA.tallViewportFloorMargin,
    );
    updateOrientationOverlay();
    updateFullscreenButton();
    render();
  },
});

runtime = new FixedStepRuntime({
  ...RUNTIME_CONFIG,
  onUpdate: (stepMs) => {
    state.elapsedMs += stepMs;
    game.update(stepMs, input);
    audio.setAltitude(game.currentHeight, game.mode);
  },
  onRender: (interpolation) => {
    state.interpolation = interpolation;
    render();
  },
  onMetrics: (metrics) => {
    if (state.assetsReady) {
      qualityController.observe(metrics);
    }
  },
  onVisibilityChange: (snapshot) => {
    audio.setPageHidden(snapshot.suspended);
    if (snapshot.suspended) {
      liveStatus.textContent = "Over the Moon paused while hidden.";
    } else if (state.assetsReady) {
      liveStatus.textContent = `Phase ${PHASE} ${game.mode}.`;
    }
  },
});

startButton.addEventListener("click", () => startGame("button"));
howToPlayButton.addEventListener("click", async () => {
  await audio.unlock();
  setMenuView("how-to-play");
});
menuLeaderboardButton.addEventListener("click", async () => {
  await audio.unlock();
  setMenuView("leaderboard");
});
howToPlayClose.addEventListener("click", () => setMenuView("main"));
howToPlayBack.addEventListener("click", () => setMenuView("main"));
howToPlayOverlay.addEventListener("click", (event) => {
  if (event.target === howToPlayOverlay) {
    setMenuView("main");
  }
});
deathPrimary.addEventListener("click", () => {
  game.openLeaderboard();
  leaderboard.refresh({ force: true });
  liveStatus.textContent = "Showing the shared leaderboard.";
  render();
});
deathRetry.addEventListener("click", () => startGame("results-button"));
leaderboardBack.addEventListener("click", () => {
  if (game.mode === "menu") {
    setMenuView("main");
  } else {
    game.showDeathSummary();
    liveStatus.textContent = "Showing run results.";
    render();
  }
});
leaderboardRetry.addEventListener("click", () =>
  startGame("leaderboard-button"),
);
leaderboardInitials.addEventListener("input", () => {
  const alphanumeric = String(leaderboardInitials.value || "")
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 3);
  if (leaderboardInitials.value !== alphanumeric) {
    leaderboardInitials.value = alphanumeric;
  }
  const cleaned = cleanInitialsInput(alphanumeric);
  leaderboardEntry.dataset.invalid = "false";
  leaderboardEntryStatus.textContent = "A–Z / 0–9 · THREE CHARACTERS";
  setDisabled(leaderboardSubmit, cleaned.length !== 3);
});
leaderboardInitials.addEventListener("blur", () => {
  const cleaned = cleanInitialsInput(leaderboardInitials.value);
  if (leaderboardInitials.value !== cleaned) {
    leaderboardInitials.value = cleaned;
  }
});
leaderboardEntry.addEventListener("submit", (event) => {
  event.preventDefault();
  const cleaned = cleanInitialsInput(leaderboardInitials.value);
  if (leaderboardInitials.value !== cleaned) {
    leaderboardInitials.value = cleaned;
  }
  const result = game.submitTypedInitials(cleaned);
  if (result === "blocked") {
    leaderboardEntry.dataset.invalid = "true";
    leaderboardEntryStatus.textContent = "TRY ANOTHER NAME";
    leaderboardInitials.focus({ preventScroll: true });
    leaderboardInitials.select();
  } else if (result === "length") {
    leaderboardEntry.dataset.invalid = "true";
    leaderboardEntryStatus.textContent = "ENTER EXACTLY THREE CHARACTERS";
    leaderboardInitials.focus({ preventScroll: true });
  } else if (result === "submitted") {
    leaderboardInitials.blur();
  }
  render();
});
soundButton.addEventListener("click", async () => {
  await audio.unlock();
  const muted = audio.toggleMuted();
  if (!muted) {
    audio.play("ui");
  }
  render();
});
fullscreenButton.addEventListener("click", toggleFullscreen);
appModeClose.addEventListener("click", () => setAppModeOverlay(false));
appModeOverlay.addEventListener("click", (event) => {
  if (event.target === appModeOverlay) {
    setAppModeOverlay(false);
  }
});
devButton.addEventListener("click", () => setDevPanelOpen(true));
devClose.addEventListener("click", () => setDevPanelOpen(false));
devPanel.addEventListener("click", (event) => {
  if (event.target === devPanel) {
    setDevPanelOpen(false);
  }
});
devPanel.addEventListener("keydown", (event) => {
  event.stopPropagation();
  if (event.code === "Escape") {
    event.preventDefault();
    setDevPanelOpen(false);
  }
});
devLandmarkSelect.addEventListener("change", () => {
  const index = devLandmarks.findIndex(
    (marker) => marker.id === devLandmarkSelect.value,
  );
  setDevLandmarkIndex(index);
});
devPrevious.addEventListener("click", () =>
  setDevLandmarkIndex(state.devTools.selectedIndex - 1),
);
devNext.addEventListener("click", () =>
  setDevLandmarkIndex(state.devTools.selectedIndex + 1),
);
devSpeedToggle.addEventListener("click", () =>
  setDevSpeedLock(!game.getSnapshot().speed.devLockedAtOne),
);
devTestBird.addEventListener("click", () =>
  previewDevAmbientFlyby("bird"),
);
devTestSaucer.addEventListener("click", () =>
  previewDevAmbientFlyby("saucer"),
);
devWarp.addEventListener("click", warpToSelectedLandmark);
document.addEventListener("fullscreenchange", () => {
  updateFullscreenButton();
  layoutController.schedule();
});
window.addEventListener("keydown", (event) => {
  if (
    event.target?.matches?.("input, textarea, select") ||
    event.target?.isContentEditable
  ) {
    return;
  }
  if (event.code === "Escape" && state.display.appModeOverlayOpen) {
    event.preventDefault();
    setAppModeOverlay(false);
    return;
  }
  if (event.code === "Escape" && game.mode === "menu") {
    if (state.menu.view !== "main") {
      event.preventDefault();
      setMenuView("main");
    }
    return;
  }
  if (game.isNameEntryActive()) {
    return;
  }
  if (
    event.code === "KeyF" &&
    state.display.fullscreenSupported &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey
  ) {
    event.preventDefault();
    toggleFullscreen();
  }
});
if (typeof standaloneMedia?.addEventListener === "function") {
  standaloneMedia.addEventListener("change", refreshDisplayMode);
} else {
  standaloneMedia?.addListener?.(refreshDisplayMode);
}
if (typeof coarsePointerMedia?.addEventListener === "function") {
  coarsePointerMedia.addEventListener("change", render);
}
if (serviceWorkerSupported) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    state.release.pwa.controlled = Boolean(
      navigator.serviceWorker.controller,
    );
    state.release.pwa.status = state.release.pwa.controlled
      ? "controlled"
      : "ready";
    render();
  });
}

window.advanceTime = (milliseconds) =>
  Promise.resolve(runtime.advanceTime(milliseconds));

window.render_game_to_text = () =>
  JSON.stringify({
    phase: state.phase,
    mode: state.mode,
    release: {
      ...state.release,
      pwa: { ...state.release.pwa },
    },
    coordinateSystem: {
      origin: "top-left world space",
      xAxis: "right",
      yAxis: "down",
      units: "logical game units",
      cameraTransform: "screenY = worldY - cameraY",
    },
    layout: state.layout
      ? {
          viewport: {
            width: state.layout.viewportWidth,
            height: state.layout.viewportHeight,
          },
          stageCss: {
            width: state.layout.cssWidth,
            height: state.layout.cssHeight,
          },
          logical: {
            width: state.layout.logicalWidth,
            height: state.layout.logicalHeight,
          },
          backing: {
            width: state.layout.backingWidth,
            height: state.layout.backingHeight,
          },
          dpr: state.layout.effectiveDpr,
          desktopFramed: state.layout.desktopFramed,
          desktopMaxWidth: state.layout.desktopMaxWidth,
          editableFocused: state.layout.editableFocused,
          keyboardOpen: state.layout.keyboardOpen,
          orientationLandscape: state.layout.orientationLandscape,
          orientationBlocked: state.layout.orientationBlocked,
          fullscreen: state.layout.fullscreen,
          safeAreaCssPixels: state.layout.safeArea,
        }
      : null,
    game: game.getSnapshot(),
    input: input.getSnapshot(),
    audio: audio.getSnapshot(),
    quality: state.quality.name,
    qualityControl: state.qualityControl,
    runtime: state.runtime,
    assets: {
      loaded: state.assetsLoaded,
      total: state.assetsTotal,
      progress: Number(state.assetProgress.toFixed(3)),
      failures: state.assetFailures,
    },
    menu: {
      view: state.menu.view,
      mainVisible: game.mode === "menu" && state.menu.view === "main",
      howToPlayVisible:
        game.mode === "menu" && state.menu.view === "how-to-play",
      leaderboardVisible:
        game.mode === "menu" && state.menu.view === "leaderboard",
    },
    display: { ...state.display },
    devTools: {
      ...state.devTools,
      lastWarp: state.devTools.lastWarp
        ? { ...state.devTools.lastWarp }
        : null,
    },
    touchControlsVisible: state.touchControlsVisible,
    gameplayImplemented: true,
    audioImplemented: true,
    error: state.error,
  });

const developerTestApi = Object.freeze({
  phase: PHASE,
  version: BUILD_VERSION,
  channel: RELEASE_CONFIG.channel,
  getState: () => JSON.parse(window.render_game_to_text()),
  startGame,
  startWithSeed: (seed) => startGame("test-seed", seed),
  restartRun: (seed) => {
    game.start(seed);
    input.clear();
    render();
  },
  restartSlice: (seed) => {
    game.start(seed);
    input.clear();
    render();
  },
  queueAction: () => input.queueAction("test"),
  debugSetPlayer: (values) => {
    game.debugSetPlayer(values);
    render();
  },
  debugResetBalloon: (values) => {
    game.debugResetBalloon(values);
    render();
  },
  debugSetBalloons: (values) => {
    game.debugSetBalloons(values);
    render();
  },
  debugSetGoalMarker: (id, values) => {
    game.debugSetGoalMarker(id, values);
    render();
  },
  debugJumpToLandmark: (reference) => {
    const marker = game.debugJumpToLandmark(reference);
    render();
    return marker;
  },
  debugWarpBelowLandmark: (reference, balloonsBelow = 3) => {
    const result = game.debugWarpBelowLandmark(reference, balloonsBelow);
    render();
    return result;
  },
  openDevTools: () => setDevPanelOpen(true),
  closeDevTools: () => setDevPanelOpen(false),
  setSpeedRampLocked: (locked) => setDevSpeedLock(locked),
  previewAmbientFlyby: (type) => previewDevAmbientFlyby(type),
  selectDevLandmark: (reference) => {
    const normalized = String(reference || "").toLowerCase();
    const index =
      typeof reference === "number"
        ? reference
        : devLandmarks.findIndex(
            (marker) =>
              marker.id === reference ||
              marker.name.toLowerCase() === normalized,
          );
    return setDevLandmarkIndex(index);
  },
  warpToSelectedLandmark,
  debugSetCombo: (color, streak) => {
    game.debugSetCombo(color, streak);
    render();
  },
  debugPopBalloon: (color) => {
    game.debugPopBalloon(color);
    render();
  },
  debugSetFallPeak: (heightMeters) => {
    game.debugSetFallPeak(heightMeters);
    render();
  },
  debugFinishRun: (scoreMeters) => {
    game.debugFinishRun(scoreMeters);
    input.clear();
    render();
  },
  openLeaderboard: () => {
    const changed = game.openLeaderboard();
    render();
    return changed;
  },
  showDeathSummary: () => {
    const changed = game.showDeathSummary();
    render();
    return changed;
  },
  debugSetSavedBest: (scoreMeters, persist = false) => {
    game.debugSetSavedBest(scoreMeters, persist);
    render();
  },
  debugSpawnShootingStar: () => {
    game.debugSpawnShootingStar();
    render();
  },
  debugSpawnAmbientFlyby: (type) => {
    const flyby = game.debugSpawnAmbientFlyby(type);
    render();
    return flyby;
  },
  debugSetAmbientFlybyTimer: (type, seconds = 0) => {
    const timer = game.debugSetAmbientFlybyTimer(type, seconds);
    render();
    return timer;
  },
  debugClearAmbientFlyby: () => {
    game.debugClearAmbientFlyby();
    render();
  },
  cycleNameEntry: (direction) => {
    const changed = game.cycleNameEntry(direction);
    render();
    return changed;
  },
  backspaceNameEntry: () => {
    const changed = game.backspaceNameEntry();
    render();
    return changed;
  },
  typeNameEntryCharacter: (character) => {
    const changed = game.typeNameEntryCharacter(character);
    render();
    return changed;
  },
  advanceNameEntry: () => {
    const changed = game.advanceNameEntry();
    render();
    return changed;
  },
  setMuted: (muted) => {
    audio.setMuted(muted);
    render();
  },
  setEffectsVolume: (value) => {
    audio.setEffectsVolume(value);
    render();
  },
  setAmbienceVolume: (value) => {
    audio.setAmbienceVolume(value);
    render();
  },
  setQuality: (nextQuality) => {
    const profile = resolveQualityProfile(nextQuality);
    if (!profile) {
      throw new Error(`Unknown quality profile: ${String(nextQuality)}`);
    }
    qualityController.setProfile(profile, "manual");
    return qualityController.getSnapshot();
  },
  evaluatePerformance: (metrics, nowMs) => {
    const changed = qualityController.observe(
      metrics,
      Number.isFinite(nowMs) ? nowMs : performance.now(),
    );
    render();
    return changed;
  },
  setManualMode: (enabled) => {
    runtime.setManualMode(enabled);
    render();
  },
  setSuspendedForTest: (suspended) => {
    runtime.setSuspended(suspended, "test");
    render();
  },
  consumeFrameDeltaForTest: (milliseconds) =>
    runtime.consumeFrameDelta(milliseconds),
  resetPerformanceMetrics: () => {
    runtime.resetPerformanceMetrics();
    render();
  },
  toggleFullscreen,
  setAppModeOverlay,
  setMenuView,
});
const publicTestApi = Object.freeze({
  phase: PHASE,
  version: BUILD_VERSION,
  channel: RELEASE_CONFIG.channel,
  getState: developerTestApi.getState,
});
window.__OTM = state.devTools.enabled
  ? developerTestApi
  : publicTestApi;

syncUi();
refreshDisplayMode();
layoutController.start();
runtime.start();

loader
  .load(({ completed, total, ratio }) => {
    state.assetsLoaded = completed;
    state.assetsTotal = total;
    state.assetProgress = ratio;
    render();
  })
  .then(({ failures, loaded, total }) => {
    state.assetsLoaded = loaded;
    state.assetsTotal = total;
    state.assetProgress = total ? loaded / total : 1;
    state.assetFailures = failures;
    state.assetsReady = failures.length === 0;
    if (failures.length) {
      state.mode = "error";
      state.error = `${failures.length} image asset${failures.length === 1 ? "" : "s"} failed to load.`;
      liveStatus.textContent = state.error;
    } else {
      state.mode = "menu";
      liveStatus.textContent = `Phase ${PHASE} cosmic route ready.`;
      leaderboard.refresh();
    }
    runtime.resetPerformanceMetrics();
    render();
    if (!failures.length) {
      void registerOfflineShell();
    }
  })
  .catch((error) => {
    state.mode = "error";
    state.error = error instanceof Error ? error.message : String(error);
    liveStatus.textContent = `Unable to load Over the Moon: ${state.error}`;
    render();
  });
