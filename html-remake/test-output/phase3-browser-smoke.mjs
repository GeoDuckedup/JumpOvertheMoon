import fs from "node:fs";
import path from "node:path";
import { chromium } from "/Users/danemerman/.codex/skills/develop-web-game/node_modules/playwright/index.mjs";

const url = "http://127.0.0.1:5175/html-remake/";
const outputDirectory = path.resolve(
  "html-remake/test-output/phase3-browser-smoke",
);
fs.mkdirSync(outputDirectory, { recursive: true });

const failures = [];
const results = {};
const assert = (condition, message) => {
  if (!condition) {
    failures.push(message);
  }
};

const waitUntilReady = async (page) => {
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() || "{}");
    return state.assets?.loaded === state.assets?.total && state.assets?.total > 0;
  });
};

const stateOf = (page) =>
  page.evaluate(() => JSON.parse(window.render_game_to_text()));

const advanceFrames = (page, count) =>
  page.evaluate(
    async ({ frames, step }) => {
      for (let index = 0; index < frames; index += 1) {
        await window.advanceTime(step);
      }
    },
    { frames: count, step: 1000 / 60 },
  );

const attachErrorCapture = (page, bucket) => {
  page.on("pageerror", (error) => bucket.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      bucket.push(`console: ${message.text()}`);
    }
  });
};

const browser = await chromium.launch({ headless: true });
try {
  const desktopErrors = [];
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const desktop = await desktopContext.newPage();
  attachErrorCapture(desktop, desktopErrors);
  await desktop.goto(url, { waitUntil: "networkidle" });
  await waitUntilReady(desktop);
  await desktop.evaluate(() => localStorage.clear());
  await desktop.reload({ waitUntil: "networkidle" });
  await waitUntilReady(desktop);

  let state = await stateOf(desktop);
  assert(state.mode === "menu", "Desktop should begin at the menu.");
  assert(
    state.layout.desktopFramed && state.layout.stageCss.width <= 500,
    "Desktop stage should stay centered at a maximum width of 500 CSS pixels.",
  );
  assert(!state.audio.unlocked, "Audio should wait for a user gesture.");
  assert(
    await desktop.locator("#start-overlay").isVisible(),
    "Start overlay should be visible before play.",
  );
  await desktop
    .locator("#game-stage")
    .screenshot({ path: path.join(outputDirectory, "desktop-menu.png") });

  await desktop.locator("#start-button").click();
  await desktop.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).mode === "playing",
  );
  state = await stateOf(desktop);
  assert(state.audio.unlocked, "Start should unlock Web Audio.");
  assert(
    state.audio.contextState === "running",
    "Web Audio should run after the Start gesture.",
  );
  assert(
    state.audio.playCounts.ui === 1,
    "Start should play the first UI sound.",
  );
  assert(
    state.audio.audioAssets.balloonPopReady &&
      state.audio.audioAssets.failures.length === 0,
    "The recorded balloon-pop asset should decode without failures.",
  );
  assert(
    state.audio.soundDesign.balloonPop ===
      "recorded-cc0-soft-balloon-pop-v4c",
    "The real recorded balloon pop should replace the synthesized fallback.",
  );

  await desktop.evaluate(() => {
    window.__OTM.setManualMode(true);
    window.__OTM.restartSlice();
  });
  await desktop.keyboard.press("Space");
  await advanceFrames(desktop, 8);
  await desktop.keyboard.press("Space");
  await advanceFrames(desktop, 4);
  state = await stateOf(desktop);
  results.desktopPop = state;
  assert(!state.game.balloon.alive, "Keyboard slash should pop the balloon.");
  assert(
    state.game.eventCounts.jump === 1 &&
      state.game.eventCounts.slash === 1 &&
      state.game.eventCounts.balloonPop === 1 &&
      state.game.eventCounts.bounce === 1,
    "Jump, slash, balloon-pop, and bounce events should each fire once.",
  );
  assert(
    state.audio.playCounts.jump >= 1 &&
      state.audio.playCounts.slash >= 1 &&
      state.audio.playCounts.balloonPop >= 1 &&
      state.audio.playCounts.bounce >= 1,
    "The playable sequence should request and play every core action sound.",
  );
  assert(state.game.player.vy < 0, "Balloon contact should bounce the cow upward.");
  await desktop
    .locator("#game-stage")
    .screenshot({ path: path.join(outputDirectory, "desktop-pop.png") });

  await advanceFrames(desktop, 150);
  state = await stateOf(desktop);
  assert(state.game.player.onGround, "The cow should land after the bounce.");
  assert(
    state.game.eventCounts.landing === 1,
    "Landing should emit exactly once after the bounce.",
  );
  assert(
    state.audio.playCounts.landing >= 1,
    "Landing should play its sound.",
  );

  await desktop.evaluate(() => window.__OTM.restartSlice());
  await desktop.keyboard.down("ArrowRight");
  await advanceFrames(desktop, 10);
  await desktop.keyboard.up("ArrowRight");
  state = await stateOf(desktop);
  assert(
    state.game.player.x > 270,
    "Holding the right keyboard control should move the cow.",
  );

  await desktop.evaluate(() => {
    window.__OTM.debugSetPlayer({
      x: 579,
      y: 637,
      vx: 0,
      vy: 0,
      onGround: true,
    });
  });
  await advanceFrames(desktop, 1);
  state = await stateOf(desktop);
  assert(
    state.game.player.x === -38,
    "Crossing the right edge should wrap to the left padding.",
  );

  await desktop.evaluate(() => {
    window.__OTM.debugSetPlayer({
      x: 270,
      y: 100,
      vx: 0,
      vy: 0,
      onGround: false,
    });
  });
  await advanceFrames(desktop, 1);
  state = await stateOf(desktop);
  assert(state.game.camera.y < 0, "The camera should follow upward movement.");

  await desktop.evaluate(() => {
    window.__OTM.restartSlice();
    window.__OTM.debugSetPlayer({
      x: 330,
      y: 550,
      vx: 0,
      vy: 0,
      onGround: false,
      slashTimer: 0.2,
      cooldown: 0.2,
    });
  });
  await advanceFrames(desktop, 1);
  state = await stateOf(desktop);
  assert(
    state.game.balloon.alive,
    "A slash from below should not pop the balloon.",
  );

  await desktop.evaluate(() => window.__OTM.setSuspendedForTest(true));
  await desktop.waitForTimeout(80);
  state = await stateOf(desktop);
  assert(state.runtime.suspended, "The runtime should suspend while hidden.");
  assert(
    state.audio.pageHidden && state.audio.contextState === "suspended",
    "Audio should suspend with the page.",
  );
  await desktop.evaluate(() => window.__OTM.setSuspendedForTest(false));
  await desktop.waitForTimeout(80);
  state = await stateOf(desktop);
  assert(!state.runtime.suspended, "The runtime should resume when visible.");
  assert(
    !state.audio.pageHidden && state.audio.contextState === "running",
    "Audio should resume with the page.",
  );

  for (let index = 0; index < 25; index += 1) {
    await desktop.evaluate(async () => {
      window.__OTM.restartSlice();
      window.__OTM.queueAction();
      await window.advanceTime(1000 / 60);
    });
  }
  state = await stateOf(desktop);
  assert(
    state.audio.activeVoices <= state.audio.maxVoices,
    "The audio voice pool should remain bounded.",
  );

  await desktop.evaluate(() => window.__OTM.setMuted(true));
  state = await stateOf(desktop);
  assert(state.audio.muted, "Mute should update immediately.");
  await desktop.reload({ waitUntil: "networkidle" });
  await waitUntilReady(desktop);
  state = await stateOf(desktop);
  assert(state.audio.muted, "Mute should persist across reloads.");

  await desktop.evaluate(() => window.__OTM.setMuted(false));
  await desktop.locator("#start-button").click();
  await desktop.evaluate(() => window.__OTM.toggleFullscreen());
  await desktop.waitForTimeout(120);
  state = await stateOf(desktop);
  assert(
    state.layout.fullscreen && state.display.fullscreenSupported,
    "Desktop fullscreen should still enter through the Phase 3 shell.",
  );
  await desktop.evaluate(() => window.__OTM.toggleFullscreen());
  await desktop.waitForTimeout(120);
  state = await stateOf(desktop);
  assert(!state.layout.fullscreen, "Desktop fullscreen should exit cleanly.");
  assert(desktopErrors.length === 0, `Desktop errors: ${desktopErrors.join("; ")}`);
  results.desktopFinal = state;
  await desktopContext.close();

  const mobileErrors = [];
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 3,
  });
  const mobile = await mobileContext.newPage();
  attachErrorCapture(mobile, mobileErrors);
  await mobile.goto(url, { waitUntil: "networkidle" });
  await waitUntilReady(mobile);
  state = await stateOf(mobile);
  assert(
    state.layout.stageCss.width === 390 && state.layout.stageCss.height === 844,
    "Phone stage should fill the viewport.",
  );
  assert(
    state.display.appModeGuidance,
    "iPhone should offer Add-to-Home-Screen app mode.",
  );
  await mobile
    .locator("#game-stage")
    .screenshot({ path: path.join(outputDirectory, "phone-menu.png") });

  await mobile.locator("#fullscreen-button").click();
  assert(
    await mobile.locator("#app-mode-overlay").isVisible(),
    "APP MODE should open its iPhone instructions.",
  );
  await mobile.locator("#app-mode-close").click();
  assert(
    !(await mobile.locator("#app-mode-overlay").isVisible()),
    "APP MODE instructions should close.",
  );

  await mobile.locator("#start-button").click();
  await mobile.evaluate(() => {
    window.__OTM.setManualMode(true);
    window.__OTM.restartSlice();
  });
  state = await stateOf(mobile);
  assert(state.touchControlsVisible, "Touch controls should show during phone play.");
  assert(
    await mobile.locator("#touch-controls").isVisible(),
    "Touch control DOM should be visible during phone play.",
  );
  assert(
    state.input.directionSwipeEnabled,
    "Directional controls should advertise swipe switching.",
  );

  await mobile.locator("#touch-action").click();
  await advanceFrames(mobile, 8);
  assert(
    (await mobile.locator(".touch-action-label").textContent()) === "SLASH",
    "The phone action label should switch from JUMP to SLASH in air.",
  );
  await mobile.locator("#touch-action").click();
  await advanceFrames(mobile, 4);
  state = await stateOf(mobile);
  results.mobilePop = state;
  assert(!state.game.balloon.alive, "Touch jump/slash should pop the balloon.");
  assert(
    state.audio.playCounts.balloonPop >= 1,
    "Touch balloon contact should play the pop sound.",
  );

  const directionCenters = await mobile.evaluate(() => {
    const left = document.querySelector("#touch-left").getBoundingClientRect();
    const right = document.querySelector("#touch-right").getBoundingClientRect();
    return {
      left: {
        x: left.left + left.width / 2,
        y: left.top + left.height / 2,
      },
      right: {
        x: right.left + right.width / 2,
        y: right.top + right.height / 2,
      },
    };
  });
  const beforeMoveX = state.game.player.x;
  await mobile.locator("#touch-left").dispatchEvent("pointerdown", {
    pointerId: 91,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: directionCenters.left.x,
    clientY: directionCenters.left.y,
  });
  state = await stateOf(mobile);
  assert(
    state.input.direction === -1 &&
      (await mobile.locator("#touch-left").getAttribute("data-pressed")) ===
        "true",
    "A left touch should begin left movement and press the left visual.",
  );
  await advanceFrames(mobile, 8);
  state = await stateOf(mobile);
  assert(
    state.game.player.x < beforeMoveX,
    "Holding the left touch control should move the cow left.",
  );

  await mobile.locator("#touch-left").dispatchEvent("pointermove", {
    pointerId: 91,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: directionCenters.right.x,
    clientY: directionCenters.right.y,
  });
  state = await stateOf(mobile);
  assert(
    state.input.direction === 1 &&
      (await mobile.locator("#touch-left").getAttribute("data-pressed")) ===
        "false" &&
      (await mobile.locator("#touch-right").getAttribute("data-pressed")) ===
        "true",
    "Dragging the held finger onto right should switch input and visuals.",
  );
  await advanceFrames(mobile, 20);
  state = await stateOf(mobile);
  assert(
    state.game.player.vx > 0,
    "Continuing the same touch on right should reverse horizontal velocity.",
  );

  await mobile.locator("#touch-left").dispatchEvent("pointermove", {
    pointerId: 91,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: directionCenters.left.x,
    clientY: directionCenters.left.y,
  });
  state = await stateOf(mobile);
  assert(
    state.input.direction === -1 &&
      (await mobile.locator("#touch-left").getAttribute("data-pressed")) ===
        "true" &&
      (await mobile.locator("#touch-right").getAttribute("data-pressed")) ===
        "false",
    "Dragging the same finger back onto left should switch back immediately.",
  );
  await advanceFrames(mobile, 20);
  state = await stateOf(mobile);
  assert(
    state.game.player.vx < 0,
    "Repeated swiping should reverse horizontal velocity again.",
  );

  await mobile.locator("#touch-left").dispatchEvent("pointerup", {
    pointerId: 91,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    buttons: 0,
    clientX: directionCenters.left.x,
    clientY: directionCenters.left.y,
  });
  state = await stateOf(mobile);
  assert(
    state.input.activePointers === 0 &&
      !state.input.left &&
      !state.input.right,
    "Releasing a touch control should clear its pointer.",
  );
  await mobile
    .locator("#game-stage")
    .screenshot({ path: path.join(outputDirectory, "phone-gameplay.png") });
  assert(mobileErrors.length === 0, `Mobile errors: ${mobileErrors.join("; ")}`);
  await mobileContext.close();

  const installedContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
    hasTouch: true,
    isMobile: true,
  });
  await installedContext.addInitScript(() => {
    Object.defineProperty(navigator, "standalone", {
      configurable: true,
      get: () => true,
    });
  });
  const installed = await installedContext.newPage();
  await installed.goto(url, { waitUntil: "networkidle" });
  await waitUntilReady(installed);
  state = await stateOf(installed);
  assert(state.display.standalone, "Installed iPhone mode should be detected.");
  assert(
    await installed.locator("#fullscreen-button").isHidden(),
    "Installed iPhone mode should hide APP MODE.",
  );
  await installedContext.close();

  const landscapeContext = await browser.newContext({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
  });
  const landscape = await landscapeContext.newPage();
  await landscape.goto(url, { waitUntil: "networkidle" });
  await waitUntilReady(landscape);
  state = await stateOf(landscape);
  assert(
    state.layout.orientationBlocked,
    "Touch landscape should request portrait orientation.",
  );
  assert(
    await landscape.locator("#rotate-overlay").isVisible(),
    "The rotate-to-portrait overlay should be visible.",
  );
  await landscape
    .locator("#game-stage")
    .screenshot({ path: path.join(outputDirectory, "touch-landscape.png") });
  await landscapeContext.close();

  fs.writeFileSync(
    path.join(outputDirectory, "results.json"),
    JSON.stringify({ failures, results }, null, 2),
  );
} finally {
  await browser.close();
}

if (failures.length) {
  throw new Error(`Phase 3 browser smoke failed:\n- ${failures.join("\n- ")}`);
}

console.log("Phase 3 browser smoke passed.");
