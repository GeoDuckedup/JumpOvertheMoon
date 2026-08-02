import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "/Users/danemerman/.codex/skills/develop-web-game/node_modules/playwright/index.mjs";

const sourceUrl =
  process.env.OTM_URL || "http://127.0.0.1:5201/html-remake/";
const outputDirectory = path.resolve(
  "html-remake/test-output/phase15-rubber-band-browser",
);
fs.mkdirSync(outputDirectory, { recursive: true });

const errors = [];
let firebaseWrites = 0;
const browser = await chromium.launch({ headless: true });
const stateOf = (page) =>
  page.evaluate(() => JSON.parse(window.render_game_to_text()));

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`console: ${message.text()}`);
    }
  });
  await page.route("**/jumpoverthemoon/scores.json**", (route) => {
    if (route.request().method() !== "GET") {
      firebaseWrites += 1;
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });

  await page.goto(`${sourceUrl}?dev=1&phase15-1=1`, {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() || "{}");
    return (
      state.phase === 15 &&
      state.release?.version === "15.2.1" &&
      state.assets?.loaded === 35 &&
      state.assets?.loaded === state.assets?.total &&
      state.assets?.failures?.length === 0
    );
  });

  await page.evaluate(async () => {
    await window.__OTM.startCowVsCat(15_110);
    window.__OTM.setManualMode(true);
    window.__OTM.debugSetBalloons([]);
    window.__OTM.debugSetPlayer({
      x: 270,
      y: 200,
      vy: -1217.046,
      onGround: false,
    });
    window.__OTM.debugSetRival({
      skipGrace: true,
      x: 80,
      y: 340,
      vx: 0,
      vy: 0,
      orbitSide: -1,
      attackCooldown: 0.18,
    });
  });
  await page.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-combo-catchup-start.png"),
  });

  await page.evaluate(() => window.advanceTime(520));
  let state = await stateOf(page);
  const catchUpScreenY = state.game.rival.y - state.game.camera.y;
  assert(state.game.rival.rubberBand.active);
  assert(state.game.rival.rubberBand.verticalScale > 1.25);
  assert.equal(state.game.rival.stats.attackSelections, 0);
  assert(catchUpScreenY < state.game.camera.viewportHeight);
  assert.equal(state.game.rival.attack.state, "idle");
  await page.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-combo-catchup-active.png"),
  });

  await page.evaluate(() => window.advanceTime(1100));
  state = await stateOf(page);
  const recoveredScreenY = state.game.rival.y - state.game.camera.y;
  assert(recoveredScreenY < state.game.camera.viewportHeight * 0.76);
  assert.equal(state.game.rival.stats.rubberBandFailsafes, 0);
  assert.equal(state.game.rival.rubberBand.maximumOffscreenSeconds, 0);
  await page.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-combo-catchup-recovered.png"),
  });

  assert.equal(firebaseWrites, 0);
  assert.deepEqual(errors, []);
  await context.close();
  console.log(
    JSON.stringify(
      {
        phase15_1Browser: {
          logicalViewportHeight: state.game.camera.viewportHeight,
          catchUpScreenY: Number(catchUpScreenY.toFixed(3)),
          recoveredScreenY: Number(recoveredScreenY.toFixed(3)),
          maximumOffscreenSeconds:
            state.game.rival.rubberBand.maximumOffscreenSeconds,
          firebaseWrites,
          errors,
        },
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
