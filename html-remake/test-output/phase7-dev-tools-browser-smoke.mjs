import fs from "node:fs";
import path from "node:path";
import { chromium } from "/Users/danemerman/.codex/skills/develop-web-game/node_modules/playwright/index.mjs";

const baseUrl =
  process.env.OTM_URL || "http://127.0.0.1:5173/html-remake/";
const devUrl = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}dev=1`;
const disableDevUrl =
  `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}dev=0`;
const outputDirectory = path.resolve(
  "html-remake/test-output/phase7-dev-tools-browser-smoke",
);
fs.mkdirSync(outputDirectory, { recursive: true });

const failures = [];
const browserErrors = [];
const assert = (condition, message) => {
  if (!condition) {
    failures.push(message);
  }
};
const stateOf = (page) =>
  page.evaluate(() => JSON.parse(window.render_game_to_text()));
const waitUntilReady = (page) =>
  page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() || "{}");
    return (
      state.assets?.loaded === state.assets?.total &&
      state.assets?.total > 0 &&
      state.assets?.failures?.length === 0
    );
  });

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  page.on("pageerror", (error) =>
    browserErrors.push(`pageerror: ${error.message}`),
  );
  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(`console: ${message.text()}`);
    }
  });

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await waitUntilReady(page);
  let state = await stateOf(page);
  assert(!state.devTools.enabled, "The normal URL must keep cheats disabled.");
  assert(
    await page.locator("#dev-button").isHidden(),
    "The normal URL must hide the DEV button.",
  );
  assert(
    await page.locator("#dev-panel").isHidden(),
    "The normal URL must hide the dev panel.",
  );

  await page.goto(devUrl, { waitUntil: "networkidle" });
  await waitUntilReady(page);
  state = await stateOf(page);
  assert(state.devTools.enabled, "The ?dev=1 URL should enable cheats.");
  assert(
    await page.locator("#dev-button").isVisible(),
    "The dev URL should show the DEV button.",
  );
  assert(
    (await page.locator("#dev-landmark-select option").count()) === 15,
    "The dev selector should list all 15 landmarks.",
  );

  await page.locator("#dev-button").click();
  state = await stateOf(page);
  assert(state.devTools.panelOpen, "DEV should open the landmark panel.");
  assert(state.runtime.manualMode, "Opening the panel should pause simulation.");
  assert(!state.touchControlsVisible, "Gameplay controls should hide under the panel.");
  assert(!state.devTools.speedLockedAtOne);
  assert(!state.game.speed.devLockedAtOne);
  assert(
    (await page.locator("#dev-speed-status").textContent()) ===
      "OFF · NORMAL RAMP",
  );
  await page.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-dev-panel.png"),
  });

  await page.locator("#dev-speed-toggle").click();
  state = await stateOf(page);
  assert(state.devTools.speedLockedAtOne);
  assert(state.game.speed.devLockedAtOne);
  assert(
    (await page.locator("#dev-speed-status").textContent()) ===
      "ON · FIXED 1×",
    "The DEV control should visibly confirm the one-times lock.",
  );

  await page.locator("#dev-landmark-select").selectOption("pluto");
  state = await stateOf(page);
  assert(
    state.devTools.selectedLandmarkId === "pluto" &&
      state.devTools.selectedHeightMeters === 8600,
    "Selecting Pluto should update the dev target.",
  );
  await page.locator("#dev-warp").click();
  await page.waitForFunction(() => {
    const current = JSON.parse(window.render_game_to_text());
    return (
      current.mode === "playing" &&
      !current.devTools.panelOpen &&
      current.devTools.lastWarp?.landmarkId === "pluto"
    );
  });
  state = await stateOf(page);
  const pluto = state.game.goalMarkers.find(({ id }) => id === "pluto");
  const plutoTarget = state.game.balloons.find(
    ({ id }) => id === state.devTools.lastWarp.targetBalloonId,
  );
  assert(state.devTools.lastWarp.requestedBalloonsBelow === 3);
  assert(plutoTarget, "The Pluto warp should target a live route balloon.");
  assert(
    state.game.player.y > pluto.clearanceBottomY &&
      state.game.player.y < plutoTarget.y,
    "The cow should arrive above a balloon and below Pluto.",
  );
  assert(
    state.game.balloons.filter(
      (balloon) =>
        balloon.routeRole === "main" &&
        balloon.y > pluto.clearanceBottomY &&
        balloon.y <= plutoTarget.y,
    ).length >= 3,
    "The Pluto target should be the third main balloon below the landmark.",
  );
  assert(
    !state.runtime.manualMode && state.touchControlsVisible,
    "Warping should resume gameplay and restore touch controls.",
  );
  assert(
    state.game.speed.multiplier === 1 && state.game.speed.devLockedAtOne,
    "The speed lock should survive the fresh run created by a warp.",
  );
  await page.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-pluto-warp.png"),
  });

  await page.evaluate(() => window.__OTM.setManualMode(true));
  await page.locator("#touch-action").click();
  await page.evaluate(async () => {
    for (let frame = 0; frame < 18; frame += 1) {
      await window.advanceTime(1000 / 60);
    }
  });
  state = await stateOf(page);
  assert(
    state.game.totalPopped === 1,
    "The first slash after warping should pop the target balloon.",
  );
  await page.evaluate(() => window.__OTM.setManualMode(false));

  const plutoRunId = state.game.runId;
  await page.locator("#dev-button").click();
  await page.locator("#dev-landmark-select").selectOption("black-hole");
  await page.locator("#dev-warp").click();
  await page.waitForFunction(() => {
    const current = JSON.parse(window.render_game_to_text());
    return current.devTools.lastWarp?.landmarkId === "black-hole";
  });
  state = await stateOf(page);
  const blackHole = state.game.goalMarkers.find(
    ({ id }) => id === "black-hole",
  );
  assert(
    state.game.runId > plutoRunId,
    "Each warp should start a fresh test run.",
  );
  assert(
    state.game.player.y > blackHole.clearanceBottomY,
    "The black-hole warp should also start below its clearance band.",
  );
  assert(
    state.game.balloonCount <= state.game.route.maxActiveBalloons,
    "The black-hole warp should preserve bounded route state.",
  );
  assert(
    state.game.route.historyBalloonCount > 1500 &&
      state.game.route.historyChunkCount > 100,
    "The black-hole route should be retained as compact history chunks.",
  );
  await page.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-black-hole-warp.png"),
  });

  const blackHoleHistoryCount = state.game.route.historyBalloonCount;
  await page.evaluate(() => {
    window.__OTM.setManualMode(true);
    window.__OTM.debugSetPlayer({
      y: 660 - 7320 * 10,
      vx: 0,
      vy: 1200,
      onGround: false,
      slashTimer: 0,
      cooldown: 0,
    });
  });
  state = await stateOf(page);
  assert(
    state.game.heightMeters >= 7319 && state.game.heightMeters <= 7321,
    "The long-fall check should return the cow to Neptune altitude.",
  );
  assert(
    state.game.route.historyBalloonCount === blackHoleHistoryCount,
    "Descending should reuse history instead of generating a second route.",
  );
  assert(
    state.game.route.rehydratedBalloonCount > 0 &&
      state.game.aliveBalloonCount > 0,
    "Nearby old balloons should reappear during descent.",
  );
  assert(
    state.game.balloonCount <= state.game.route.maxActiveBalloons,
    "Descent rehydration must keep the active set bounded.",
  );
  assert(
    state.game.speed.multiplier === 1,
    "The one-times lock should still apply during the long-fall check.",
  );
  await page.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-long-fall-neptune-route.png"),
  });
  await page.evaluate(() => window.__OTM.setManualMode(false));

  await page.locator("#dev-button").click();
  await page.locator("#dev-speed-toggle").click();
  state = await stateOf(page);
  assert(
    !state.game.speed.devLockedAtOne &&
      state.game.speed.rampEnabled &&
      state.game.speed.multiplier > 1.9,
    "Turning the DEV lock off should immediately restore the altitude ramp.",
  );
  await page.locator("#dev-landmark-select").selectOption("heliopause");
  await page.locator("#dev-previous").click();
  state = await stateOf(page);
  assert(
    state.devTools.selectedLandmarkId === "kuiper-object",
    "PREVIOUS should move one landmark down.",
  );
  await page.locator("#dev-next").click();
  state = await stateOf(page);
  assert(
    state.devTools.selectedLandmarkId === "heliopause",
    "NEXT should move one landmark up.",
  );
  await page.locator("#dev-close").click();
  state = await stateOf(page);
  assert(
    !state.devTools.panelOpen && !state.runtime.manualMode,
    "Close should dismiss the panel and resume the current run.",
  );

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await waitUntilReady(page);
  state = await stateOf(page);
  assert(
    state.devTools.enabled && (await page.locator("#dev-button").isVisible()),
    "Dev activation should persist for an installed-app-style relaunch.",
  );

  await page.goto(disableDevUrl, { waitUntil: "networkidle" });
  await waitUntilReady(page);
  state = await stateOf(page);
  assert(
    !state.devTools.enabled && (await page.locator("#dev-button").isHidden()),
    "?dev=0 should clear and hide the temporary tools.",
  );

  assert(browserErrors.length === 0, browserErrors.join("; "));
  if (failures.length) {
    throw new Error(failures.join("\n"));
  }

  console.log(
    JSON.stringify(
      {
        baseUrl,
        devUrl,
        disableDevUrl,
        normalUrlHidden: true,
        installedAppPersistence: true,
        disableQueryClearsTools: true,
        landmarkOptions: 15,
        panelPauseAndClose: true,
        previousNextSelection: true,
        plutoThirdBalloonWarp: true,
        immediateRoutePop: true,
        blackHoleFreshRunWarp: true,
        boundedRoute: true,
        compactRouteHistory: true,
        descentRouteRehydration: true,
        speedLockSurvivesWarp: true,
        speedRampRestores: true,
        browserErrors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
