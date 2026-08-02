import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "/Users/danemerman/.codex/skills/develop-web-game/node_modules/playwright/index.mjs";

const sourceUrl =
  process.env.OTM_URL || "http://127.0.0.1:5201/html-remake/";
const outputDirectory = path.resolve(
  "html-remake/test-output/phase15-rival-pressure-fiddle-browser",
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

  await page.goto(`${sourceUrl}?dev=1&phase15=1`, {
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

  await page.locator("#dev-button").click();
  assert.equal(
    (await page.locator(".dev-mode-label").textContent()).trim(),
    "COW VS CAT · PHASE 15",
  );
  assert.equal(
    (await page.locator("#dev-rival-dive").textContent()).trim(),
    "TEST FIDDLE DROP",
  );
  await page.locator("#dev-panel .dev-card").screenshot({
    path: path.join(outputDirectory, "phone-phase15-dev-controls.png"),
  });
  await page.locator("#dev-close").click();

  await page.evaluate(async () => {
    await window.__OTM.startCowVsCat(15_015);
    window.__OTM.setManualMode(true);
    window.__OTM.debugSetBalloons([]);
    window.__OTM.debugSetPlayer({
      x: 270,
      y: 400,
      vy: 0,
      onGround: false,
    });
    window.__OTM.debugSetRival({
      skipGrace: true,
      x: 80,
      y: 420,
      vx: 0,
      vy: 0,
      attackCooldown: 99,
      orbitSide: -1,
    });
    window.advanceTime(1200);
  });
  let state = await stateOf(page);
  const neutralDistance = Math.abs(
    state.game.rival.hoverTarget.x - state.game.player.x,
  );
  assert(neutralDistance >= 178 && neutralDistance <= 232);
  assert(state.game.phaseFifteen.widerMovingOrbitImplemented);
  await page.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-wide-neutral-orbit.png"),
  });

  await page.evaluate(() => {
    window.__OTM.debugSetPlayer({
      x: 315,
      y: 390,
      vy: -80,
      onGround: false,
    });
    window.__OTM.forceRivalFiddleDrop();
    window.advanceTime(320);
  });
  state = await stateOf(page);
  assert.equal(state.game.rival.attack.kind, "fiddle-drop");
  assert.equal(state.game.rival.attack.state, "fiddle-telegraph");
  assert.equal(state.game.rival.visualFrame, "fiddle-drop-windup");
  assert.equal(state.audio.requestCounts.rivalFiddleTelegraph, 1);
  const lockedDirection = { ...state.game.rival.attack.fiddleDirection };
  await page.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-fiddle-drop-telegraph.png"),
  });

  await page.evaluate(() => {
    window.__OTM.debugSetPlayer({
      x: 70,
      y: 520,
      vy: 0,
      onGround: false,
    });
    window.advanceTime(370);
  });
  state = await stateOf(page);
  assert.equal(state.game.rival.attack.state, "fiddle-active");
  assert.equal(state.game.rival.visualFrame, "fiddle-drop-active");
  assert.deepEqual(state.game.rival.attack.fiddleDirection, lockedDirection);
  assert.equal(state.game.rival.jetpackActive, false);
  assert.equal(state.audio.requestCounts.rivalFiddleDrop, 1);
  await page.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-fiddle-drop-active.png"),
  });

  await page.evaluate(async () => {
    await window.__OTM.startCowVsCat(15_016);
    window.__OTM.setManualMode(true);
    window.__OTM.debugSetBalloons([]);
    window.__OTM.debugSetPlayer({ x: 280, y: 390, vy: 0, onGround: false });
    window.__OTM.forceRivalFiddleDrop();
    window.advanceTime(670);
    const state = window.__OTM.getState();
    const direction = state.game.rival.attack.fiddleDirection;
    window.__OTM.debugSetPlayer({
      x: state.game.rival.x + direction.x * 52,
      y: state.game.rival.y + direction.y * 52,
      vy: -100,
      onGround: false,
    });
    window.advanceTime(80);
  });
  state = await stateOf(page);
  assert(state.game.rival.attack.fiddleHitCow);
  assert.equal(state.game.rival.stats.fiddleCowHits, 1);
  assert(state.game.player.vy > 0);
  assert.equal(state.audio.requestCounts.rivalFiddleHit, 1);
  await page.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-fiddle-drop-hit.png"),
  });

  assert.equal(firebaseWrites, 0);
  assert.deepEqual(errors, []);
  await context.close();
  console.log("Phase 15 rival pressure + Fiddle Drop browser audit passed.");
} finally {
  await browser.close();
}
