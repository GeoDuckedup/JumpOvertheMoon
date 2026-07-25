import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const playwrightModule =
  process.env.PLAYWRIGHT_MODULE ||
  path.join(
    os.homedir(),
    ".codex",
    "skills",
    "develop-web-game",
    "node_modules",
    "playwright",
    "index.mjs",
  );
const { chromium } = await import(pathToFileURL(playwrightModule).href);

const sourceUrl =
  process.env.OTM_URL || "http://127.0.0.1:5173/html-remake/";
const releaseUrl =
  process.env.OTM_RELEASE_URL ||
  "http://127.0.0.1:5173/release/over-the-moon/html-remake/";
const outputDirectory = path.resolve(
  "html-remake/test-output/phase10-browser-release",
);
fs.mkdirSync(outputDirectory, { recursive: true });

const failures = [];
const browserErrors = [];
let expectedOfflineNetworkFailure = false;
const assert = (condition, message) => {
  if (!condition) {
    failures.push(message);
  }
};
const stateOf = (page) =>
  page.evaluate(() => JSON.parse(window.render_game_to_text()));
const waitForReady = (page) =>
  page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() || "{}");
    return (
      state.phase === 10 &&
      state.release?.version === "10.2.0" &&
      state.assets?.loaded === 25 &&
      state.assets?.loaded === state.assets?.total &&
      state.assets?.failures?.length === 0
    );
  });
const listenForErrors = (page, label) => {
  page.on("pageerror", (error) =>
    browserErrors.push(`${label} pageerror: ${error.message}`),
  );
  page.on("console", (message) => {
    if (message.type() === "error") {
      if (
        expectedOfflineNetworkFailure &&
        message.text().includes("ERR_INTERNET_DISCONNECTED")
      ) {
        return;
      }
      browserErrors.push(`${label} console: ${message.text()}`);
    }
  });
};

const browser = await chromium.launch({ headless: true });
const captures = {};
const performanceSamples = [];
let offlineState = null;
let phoneState = null;
let devState = null;
let desktopState = null;

try {
  const phoneContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const phonePage = await phoneContext.newPage();
  listenForErrors(phonePage, "phone");

  const publicUrl = new URL(sourceUrl);
  publicUrl.searchParams.set("dev", "0");
  await phonePage.goto(publicUrl.href, { waitUntil: "networkidle" });
  await waitForReady(phonePage);
  await phonePage.waitForFunction(() => {
    const pwa = JSON.parse(window.render_game_to_text()).release.pwa;
    return pwa.status === "controlled" || pwa.status === "ready";
  });
  phoneState = await stateOf(phonePage);
  assert(
    phoneState.layout.stageCss.width === 390 &&
      phoneState.layout.stageCss.height === 844 &&
      !phoneState.layout.desktopFramed,
    "The public phone release must fill 390 × 844.",
  );
  assert(
    phoneState.release.channel === "production" &&
      phoneState.release.pwa.error === null,
    "The public phone release must expose a healthy RC offline shell.",
  );
  assert(
    phoneState.devTools.enabled === false &&
      phoneState.devTools.apiExposed === false &&
      (await phonePage.locator("#dev-button").isHidden()),
    "The public URL must hide developer controls.",
  );
  assert(
    await phonePage.evaluate(
      () => typeof window.__OTM.debugFinishRun === "undefined",
    ),
    "The public URL must not expose score-mutating debug hooks.",
  );
  assert(
    (await phonePage.locator("#start-button").textContent())?.trim() ===
      "OVER THE MOON" &&
      (await phonePage.locator("#how-to-play-button").isVisible()) &&
      (await phonePage.locator("#menu-leaderboard-button").isVisible()) &&
      (await phonePage.locator("#fullscreen-button").isHidden()),
    "The public splash must use the clean three-button menu and sound-only utility row.",
  );
  captures.phoneSplash = path.join(outputDirectory, "phone-splash.png");
  await phonePage.screenshot({
    path: captures.phoneSplash,
    fullPage: true,
  });

  await phonePage.locator("#start-button").click();
  await phonePage.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).mode === "playing",
  );
  const leftBox = await phonePage.locator("#touch-left").boundingBox();
  const rightBox = await phonePage.locator("#touch-right").boundingBox();
  assert(leftBox && rightBox, "Touch direction controls must be visible.");
  if (leftBox && rightBox) {
    const leftPoint = {
      clientX: leftBox.x + leftBox.width * 0.5,
      clientY: leftBox.y + leftBox.height * 0.5,
    };
    const rightPoint = {
      clientX: rightBox.x + rightBox.width * 0.5,
      clientY: rightBox.y + rightBox.height * 0.5,
    };
    await phonePage.locator("#touch-left").dispatchEvent("pointerdown", {
      pointerId: 41,
      pointerType: "touch",
      isPrimary: true,
      bubbles: true,
      cancelable: true,
      ...leftPoint,
    });
    assert(
      (await stateOf(phonePage)).input.direction === -1,
      "Touch hold must engage left.",
    );
    await phonePage.locator("#touch-left").dispatchEvent("pointermove", {
      pointerId: 41,
      pointerType: "touch",
      isPrimary: true,
      bubbles: true,
      cancelable: true,
      ...rightPoint,
    });
    assert(
      (await stateOf(phonePage)).input.direction === 1,
      "A held direction pointer must swipe from left to right.",
    );
    await phonePage.locator("#touch-left").dispatchEvent("pointerup", {
      pointerId: 41,
      pointerType: "touch",
      isPrimary: true,
      bubbles: true,
      cancelable: true,
      ...rightPoint,
    });
    assert(
      (await stateOf(phonePage)).input.direction === 0,
      "Touch direction must clear on release.",
    );
  }
  await phonePage.locator("#touch-action").click();
  await phonePage.evaluate(() => window.advanceTime(250));
  const playingState = await stateOf(phonePage);
  assert(
    playingState.game.eventCounts.jump === 1 &&
      playingState.audio.unlocked,
    "The phone action must jump and unlock native audio.",
  );
  captures.phoneGameplay = path.join(outputDirectory, "phone-gameplay.png");
  await phonePage.screenshot({
    path: captures.phoneGameplay,
    fullPage: true,
  });

  await phonePage.waitForFunction(
    () =>
      JSON.parse(window.render_game_to_text()).release.pwa.controlled ===
      true,
  );
  expectedOfflineNetworkFailure = true;
  await phoneContext.setOffline(true);
  await phonePage.reload({ waitUntil: "domcontentloaded" });
  await waitForReady(phonePage);
  offlineState = await stateOf(phonePage);
  assert(
    offlineState.release.pwa.controlled &&
      offlineState.assets.loaded === 25 &&
      offlineState.assets.failures.length === 0,
    "The installed release must reload all game assets while offline.",
  );
  assert(
    (await phonePage.locator("#start-button").textContent())?.trim() ===
      "OVER THE MOON" &&
      (await phonePage.locator(".start-kicker").count()) === 0,
    "The offline splash must use the clean current release shell.",
  );
  await phoneContext.setOffline(false);
  expectedOfflineNetworkFailure = false;

  const devUrl = new URL(sourceUrl);
  devUrl.searchParams.set("dev", "1");
  await phonePage.goto(devUrl.href, { waitUntil: "networkidle" });
  await waitForReady(phonePage);
  assert(
    await phonePage.evaluate(
      () =>
        typeof window.__OTM.debugFinishRun === "function" &&
        typeof window.__OTM.debugWarpBelowLandmark === "function",
    ),
    "The explicit DEV URL must expose deterministic test hooks.",
  );
  await phonePage.locator("#start-button").click();
  await phonePage.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).mode === "playing",
  );
  await phonePage.evaluate(() => {
    window.__OTM.setManualMode(true);
    window.__OTM.restartRun(0xca6e2a);
    window.__OTM.debugSetPlayer({
      x: 270,
      y: -5000,
      vx: 0,
      vy: -100,
      onGround: false,
    });
    window.advanceTime(1000 / 60);
  });
  const ascentCameraState = await stateOf(phonePage);
  const ascentScreenRatio =
    (ascentCameraState.game.player.y - ascentCameraState.game.camera.y) /
    ascentCameraState.game.camera.viewportHeight;
  assert(
    Math.abs(ascentScreenRatio - 0.44) < 0.002,
    `The rising cow must follow at 44% screen height, got ${ascentScreenRatio}.`,
  );
  captures.phoneCameraAscent = path.join(
    outputDirectory,
    "phone-camera-ascent.png",
  );
  await phonePage.screenshot({
    path: captures.phoneCameraAscent,
    fullPage: true,
  });
  await phonePage.evaluate(() => {
    window.__OTM.debugSetPlayer({
      x: 270,
      y: -4000,
      vx: 0,
      vy: 100,
      onGround: false,
    });
    window.advanceTime(1000 / 60);
  });
  const descentCameraState = await stateOf(phonePage);
  const descentScreenRatio =
    (descentCameraState.game.player.y - descentCameraState.game.camera.y) /
    descentCameraState.game.camera.viewportHeight;
  assert(
    Math.abs(descentScreenRatio - 0.57) < 0.002,
    `The falling cow must follow at 57% screen height, got ${descentScreenRatio}.`,
  );
  captures.phoneCameraDescent = path.join(
    outputDirectory,
    "phone-camera-descent.png",
  );
  await phonePage.screenshot({
    path: captures.phoneCameraDescent,
    fullPage: true,
  });
  await phonePage.evaluate(() => {
    window.__OTM.restartRun(0x10_10);
    window.__OTM.debugWarpBelowLandmark("black-hole", 3);
  });
  devState = await stateOf(phonePage);
  assert(
    devState.devTools.enabled &&
      devState.devTools.apiExposed &&
      devState.game.speed.multiplier === 2 &&
      devState.game.balloonCount <= 42,
    "DEV mode must retain black-hole warp and the bounded 2× route.",
  );
  await phonePage.evaluate(() => window.__OTM.setSpeedRampLocked(true));
  assert(
    (await stateOf(phonePage)).game.speed.multiplier === 1,
    "The Phase 10 DEV build must retain the 1× speed lock.",
  );
  await phonePage.evaluate(() => window.__OTM.setSpeedRampLocked(false));

  for (const [id, heightMeters] of [
    ["ground", 100],
    ["neptune", 7320],
    ["heliopause", 11500],
    ["proxima-centauri", 16600],
    ["black-hole", 18500],
  ]) {
    const sample = await phonePage.evaluate(
      ({ id: landmarkId, height }) => {
        if (landmarkId === "ground") {
          window.__OTM.debugSetPlayer({
            x: 270,
            y: 660 - height * 10,
            vx: 0,
            vy: 0,
            onGround: false,
          });
        } else {
          window.__OTM.debugJumpToLandmark(landmarkId);
        }
        const started = performance.now();
        for (let frame = 0; frame < 180; frame += 1) {
          window.advanceTime(1000 / 60);
        }
        return {
          elapsedMs: performance.now() - started,
          state: JSON.parse(window.render_game_to_text()),
        };
      },
      { id, height: heightMeters },
    );
    const averageFrameMs = sample.elapsedMs / 180;
    performanceSamples.push({
      id,
      heightMeters: sample.state.game.heightMeters,
      averageFrameMs: Number(averageFrameMs.toFixed(3)),
      activeBalloons: sample.state.game.balloonCount,
      quality: sample.state.quality,
    });
    assert(
      averageFrameMs < 20,
      `${id} deterministic long-fall work must stay below 20 ms per frame.`,
    );
    assert(
      sample.state.game.balloonCount <= 42,
      `${id} must preserve the active balloon cap.`,
    );
  }
  await phonePage.evaluate(() => {
    window.__OTM.debugJumpToLandmark("black-hole");
    window.advanceTime(1000 / 60);
  });
  captures.phoneBlackHole = path.join(
    outputDirectory,
    "phone-black-hole-dev.png",
  );
  await phonePage.screenshot({
    path: captures.phoneBlackHole,
    fullPage: true,
  });
  await phoneContext.close();

  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    screen: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  });
  const desktopPage = await desktopContext.newPage();
  listenForErrors(desktopPage, "release-desktop");
  const packagedUrl = new URL(releaseUrl);
  packagedUrl.searchParams.set("dev", "0");
  await desktopPage.goto(packagedUrl.href, { waitUntil: "networkidle" });
  await waitForReady(desktopPage);
  desktopState = await stateOf(desktopPage);
  assert(
    desktopState.layout.desktopFramed &&
      desktopState.layout.stageCss.width <= 500 &&
      desktopState.layout.stageCss.height <= 900,
    "The packaged desktop release must stay in its fixed-width frame.",
  );
  assert(
    desktopState.release.version === "10.2.0" &&
      desktopState.assets.loaded === 25 &&
      !desktopState.devTools.enabled,
    "The packaged release must contain the complete public build.",
  );
  await desktopPage.locator("#start-button").click();
  await desktopPage.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).mode === "playing",
  );
  assert(
    await desktopPage.locator("#fullscreen-button").isHidden(),
    "The desktop gameplay UI must not show a fullscreen button.",
  );
  const desktopStartX = (await stateOf(desktopPage)).game.player.x;
  await desktopPage.evaluate(async () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        code: "ArrowRight",
        bubbles: true,
        cancelable: true,
      }),
    );
    await window.advanceTime(200);
    window.dispatchEvent(
      new KeyboardEvent("keyup", {
        code: "ArrowRight",
        bubbles: true,
        cancelable: true,
      }),
    );
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        code: "Space",
        bubbles: true,
        cancelable: true,
      }),
    );
    await window.advanceTime(120);
    window.dispatchEvent(
      new KeyboardEvent("keyup", {
        code: "Space",
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  const desktopPlaying = await stateOf(desktopPage);
  assert(
    desktopPlaying.game.player.x > desktopStartX + 1 &&
      desktopPlaying.game.eventCounts.jump === 1,
    `Packaged desktop controls must work (x ${desktopStartX} -> ` +
      `${desktopPlaying.game.player.x}, jumps ` +
      `${desktopPlaying.game.eventCounts.jump || 0}).`,
  );
  captures.desktopGameplay = path.join(
    outputDirectory,
    "desktop-packaged-gameplay.png",
  );
  await desktopPage.screenshot({
    path: captures.desktopGameplay,
    fullPage: true,
  });
  await desktopContext.close();
} finally {
  await browser.close();
}

if (browserErrors.length) {
  failures.push(`Browser errors: ${browserErrors.join(" | ")}`);
}
if (failures.length) {
  throw new Error(`Phase 10 browser failures: ${failures.join(" | ")}`);
}

console.log(
  JSON.stringify(
    {
      sourceUrl,
      releaseUrl,
      release: {
        phase: phoneState?.phase,
        version: phoneState?.release.version,
        channel: phoneState?.release.channel,
        publicDevToolsHidden: !phoneState?.devTools.enabled,
        publicDebugApiHidden: !phoneState?.devTools.apiExposed,
      },
      phone: {
        viewportFill: phoneState?.layout.stageCss,
        touchSwipeVerified: true,
        audioUnlocked: true,
      },
      offline: {
        controlled: offlineState?.release.pwa.controlled,
        assetsLoaded: offlineState?.assets.loaded,
        failures: offlineState?.assets.failures,
      },
      developerBuild: {
        enabled: devState?.devTools.enabled,
        blackHoleWarp: true,
        speedLock: true,
      },
      performanceSamples,
      packagedDesktop: {
        stageCss: desktopState?.layout.stageCss,
        fixedWidth: desktopState?.layout.desktopFramed,
        controlsVerified: true,
      },
      captures,
      browserErrors,
    },
    null,
    2,
  ),
);
