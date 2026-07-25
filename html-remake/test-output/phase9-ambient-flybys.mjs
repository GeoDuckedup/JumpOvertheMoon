import fs from "node:fs";
import path from "node:path";
import { chromium } from "/Users/danemerman/.codex/skills/develop-web-game/node_modules/playwright/index.mjs";

const baseUrl =
  process.env.OTM_URL || "http://127.0.0.1:5173/html-remake/";
const url = new URL(baseUrl);
url.searchParams.set("dev", "1");
const outputDirectory = path.resolve(
  "html-remake/test-output/phase9-ambient-flybys",
);
fs.mkdirSync(outputDirectory, { recursive: true });

const failures = [];
const browserErrors = [];
const assert = (condition, message) => {
  if (!condition) {
    failures.push(message);
  }
};
const readState = (page) =>
  page.evaluate(() => JSON.parse(window.render_game_to_text()));

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
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

  await page.goto(url.href, { waitUntil: "networkidle" });
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() || "{}");
    return (
      state.assets?.loaded === 25 &&
      state.assets?.loaded === state.assets?.total &&
      state.assets?.failures?.length === 0
    );
  });
  await page.locator("#start-button").click();
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).mode === "playing",
  );
  await page.evaluate(() => {
    window.__OTM.setManualMode(true);
    window.__OTM.restartRun(0x9200);
  });

  let state = await readState(page);
  assert(
    state.game.phaseNine.ambientFlybysImplemented,
    "Phase 9 should expose the ambient-flyby feature.",
  );
  assert(
    state.game.ambientFlyby.eligibleType === "bird" &&
      state.game.ambientFlyby.bird.minimumHeightMeters === 0 &&
      state.game.ambientFlyby.bird.maximumHeightMeters === 900,
    "Birds should be naturally eligible only from 0 m through 899 m.",
  );
  assert(
    state.game.ambientFlyby.saucer.minimumHeightMeters === 12500 &&
      state.game.ambientFlyby.saucer.maximumHeightMeters === 17500,
    "Saucers should be naturally eligible from 12,500 m through 17,499 m.",
  );

  await page.locator("#dev-button").click();
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).devTools.panelOpen,
  );
  assert(
    await page.locator("#dev-test-bird").isVisible(),
    "The phone DEV panel should expose TEST BIRD.",
  );
  assert(
    await page.locator("#dev-test-saucer").isVisible(),
    "The phone DEV panel should expose TEST SAUCER.",
  );
  const panelBox = await page.locator(".dev-card").boundingBox();
  assert(
    panelBox &&
      panelBox.y >= 0 &&
      panelBox.y + panelBox.height <= 844,
    "The expanded DEV card should remain inside the phone viewport.",
  );
  const devPanelScreenshot = path.join(
    outputDirectory,
    "phone-dev-flyby-controls.png",
  );
  await page.locator("#game-stage").screenshot({
    path: devPanelScreenshot,
  });

  await page.locator("#dev-test-bird").click();
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text());
    return (
      !state.devTools.panelOpen &&
      state.game.ambientFlyby.active?.type === "bird"
    );
  });
  const birdStart = (await readState(page)).game.ambientFlyby.active;
  assert(
    birdStart.lifetimeSeconds >= 6.8 &&
      birdStart.lifetimeSeconds <= 8.4,
    "The bird should make a relaxed six-to-eight-second crossing.",
  );

  const birdMidpoint = await page.evaluate(() => {
    let latest = window.__OTM.getState().game.ambientFlyby.active;
    for (let step = 0; step < 160; step += 1) {
      window.advanceTime(50);
      latest = window.__OTM.getState().game.ambientFlyby.active;
      if (
        latest &&
        latest.x > 150 &&
        latest.x < 390 &&
        Math.abs(latest.wing) > 0.72
      ) {
        break;
      }
    }
    return latest;
  });
  assert(
    birdMidpoint &&
      birdMidpoint.progress > 0.2 &&
      birdMidpoint.progress < 0.8,
    "The forced bird should reach a visible mid-screen wingbeat.",
  );
  const birdScreenshot = path.join(
    outputDirectory,
    "phone-bird-midflight.png",
  );
  await page.locator("#game-canvas").screenshot({ path: birdScreenshot });

  const birdMotion = await page.evaluate(() => {
    const samples = [];
    let active = window.__OTM.getState().game.ambientFlyby.active;
    while (active && samples.length < 180) {
      samples.push(active);
      window.advanceTime(50);
      active = window.__OTM.getState().game.ambientFlyby.active;
    }
    return samples;
  });
  const birdXs = birdMotion.map(({ x }) => x);
  const birdYs = birdMotion.map(({ y }) => y);
  const birdWings = birdMotion.map(({ wing }) => wing);
  const birdDirection = birdStart.direction;
  assert(
    birdXs.every(
      (x, index) =>
        index === 0 ||
        (x - birdXs[index - 1]) * birdDirection > 0,
    ),
    "The bird should travel steadily in its chosen horizontal direction.",
  );
  assert(
    Math.max(...birdYs) - Math.min(...birdYs) < 24,
    "The bird path should drift naturally without saucer-like bobbing.",
  );
  assert(
    Math.min(...birdWings) < -0.7 &&
      Math.max(...birdWings) > 0.7,
    "The bird should visibly alternate through full wingbeats.",
  );

  await page.evaluate(() => {
    window.__OTM.debugSetPlayer({
      x: 270,
      y: 660 - 14000 * 10,
      vx: 0,
      vy: 0,
      onGround: false,
    });
    window.__OTM.openDevTools();
  });
  await page.locator("#dev-test-saucer").click();
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text());
    return (
      !state.devTools.panelOpen &&
      state.game.ambientFlyby.active?.type === "saucer"
    );
  });
  const saucerStart = (await readState(page)).game.ambientFlyby.active;
  assert(
    saucerStart.lifetimeSeconds >= 4.5 &&
      saucerStart.lifetimeSeconds <= 5.7,
    "The saucer should make a brisk four-to-six-second crossing.",
  );

  const saucerMidpoint = await page.evaluate(() => {
    let latest = window.__OTM.getState().game.ambientFlyby.active;
    for (let step = 0; step < 55; step += 1) {
      window.advanceTime(100);
      latest = window.__OTM.getState().game.ambientFlyby.active;
      if (
        latest &&
        latest.x > 150 &&
        latest.x < 390 &&
        latest.progress > 0.3
      ) {
        break;
      }
    }
    return latest;
  });
  assert(
    saucerMidpoint &&
      saucerMidpoint.progress > 0.25 &&
      saucerMidpoint.progress < 0.75,
    "The forced saucer should reach a visible mid-screen bob.",
  );
  const saucerScreenshot = path.join(
    outputDirectory,
    "phone-saucer-midflight.png",
  );
  await page.locator("#game-canvas").screenshot({
    path: saucerScreenshot,
  });

  const saucerMotion = await page.evaluate(() => {
    const samples = [];
    let active = window.__OTM.getState().game.ambientFlyby.active;
    while (active && samples.length < 90) {
      samples.push(active);
      window.advanceTime(80);
      active = window.__OTM.getState().game.ambientFlyby.active;
    }
    return samples;
  });
  const saucerYs = saucerMotion.map(({ y }) => y);
  const saucerDeltas = saucerYs
    .slice(1)
    .map((y, index) => y - saucerYs[index])
    .filter((delta) => Math.abs(delta) > 0.15);
  let saucerReversals = 0;
  for (let index = 1; index < saucerDeltas.length; index += 1) {
    if (Math.sign(saucerDeltas[index]) !== Math.sign(saucerDeltas[index - 1])) {
      saucerReversals += 1;
    }
  }
  assert(
    Math.max(...saucerYs) - Math.min(...saucerYs) >=
      saucerStart.bobAmplitude * 1.65,
    "The saucer should use its clearly readable cartoon bob amplitude.",
  );
  assert(
    saucerReversals >= 3,
    "The saucer should reverse vertical direction several times.",
  );

  const altitudeRules = await page.evaluate(() => {
    const check = (height, type) => {
      window.__OTM.restartRun(0x9201);
      window.__OTM.debugClearAmbientFlyby();
      window.__OTM.debugSetPlayer({
        x: 270,
        y: 660 - height * 10,
        vx: 0,
        vy: 0,
        onGround: false,
      });
      window.__OTM.debugSetAmbientFlybyTimer(type, 0);
      window.advanceTime(1000 / 60);
      const snapshot = window.__OTM.getState().game.ambientFlyby;
      return {
        height,
        type,
        eligibleType: snapshot.eligibleType,
        activeType: snapshot.active?.type || null,
      };
    };
    return [
      check(500, "bird"),
      check(1200, "bird"),
      check(14000, "saucer"),
      check(18000, "saucer"),
    ];
  });
  assert(
    altitudeRules[0].activeType === "bird" &&
      altitudeRules[1].activeType === null,
    "Natural bird scheduling should activate low and remain off above 900 m.",
  );
  assert(
    altitudeRules[2].activeType === "saucer" &&
      altitudeRules[3].activeType === null,
    "Natural saucer scheduling should activate high and stop before the black-hole region.",
  );

  const sharedLane = await page.evaluate(() => {
    window.__OTM.restartRun(0x9202);
    window.__OTM.debugSpawnShootingStar();
    const before = window.__OTM.getState().game;
    window.__OTM.debugSpawnAmbientFlyby("bird");
    const after = window.__OTM.getState().game;
    return {
      starBefore: before.shootingStar.activeCount,
      starAfter: after.shootingStar.activeCount,
      flybyAfter: after.ambientFlyby.active?.type || null,
    };
  });
  assert(
    sharedLane.starBefore === 1 &&
      sharedLane.starAfter === 0 &&
      sharedLane.flybyAfter === "bird",
    "A forced flyby should occupy the single background-event lane.",
  );

  assert(browserErrors.length === 0, browserErrors.join("; "));
  if (failures.length) {
    throw new Error(failures.join("\n"));
  }

  console.log(
    JSON.stringify(
      {
        url: url.href,
        bird: {
          lifetimeSeconds: birdStart.lifetimeSeconds,
          observedVerticalRange: Number(
            (Math.max(...birdYs) - Math.min(...birdYs)).toFixed(2),
          ),
          wingRange: [
            Number(Math.min(...birdWings).toFixed(2)),
            Number(Math.max(...birdWings).toFixed(2)),
          ],
        },
        saucer: {
          lifetimeSeconds: saucerStart.lifetimeSeconds,
          configuredBobAmplitude: saucerStart.bobAmplitude,
          observedVerticalRange: Number(
            (Math.max(...saucerYs) - Math.min(...saucerYs)).toFixed(2),
          ),
          verticalDirectionReversals: saucerReversals,
        },
        altitudeRules,
        sharedLane,
        screenshots: {
          devPanel: devPanelScreenshot,
          bird: birdScreenshot,
          saucer: saucerScreenshot,
        },
        browserErrors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
