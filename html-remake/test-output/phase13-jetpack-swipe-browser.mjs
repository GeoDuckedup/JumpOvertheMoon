import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "/Users/danemerman/.codex/skills/develop-web-game/node_modules/playwright/index.mjs";

const sourceUrl =
  process.env.OTM_URL || "http://127.0.0.1:5201/html-remake/";
const outputDirectory = path.resolve(
  "html-remake/test-output/phase13-jetpack-swipe-browser",
);
fs.mkdirSync(outputDirectory, { recursive: true });

const mockScores = {
  first: { initials: "MOO", score: 1200, timestamp: 3 },
  second: { initials: "CAT", score: 900, timestamp: 2 },
  third: { initials: "BOW", score: 600, timestamp: 1 },
};
const errors = [];
let firebaseWrites = 0;

const attachDiagnostics = (page, label) => {
  page.on("pageerror", (error) =>
    errors.push(`${label} pageerror: ${error.message}`),
  );
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`${label} console: ${message.text()}`);
    }
  });
  return page.route("**/jumpoverthemoon/scores.json**", (route) => {
    if (route.request().method() !== "GET") {
      firebaseWrites += 1;
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockScores),
    });
  });
};

const stateOf = (page) =>
  page.evaluate(() => JSON.parse(window.render_game_to_text()));
const waitForReady = (page) =>
  page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() || "{}");
    return (
      state.phase === 15 &&
      state.release?.version === "15.2.1" &&
      state.assets?.loaded === 35 &&
      state.assets?.loaded === state.assets?.total &&
      state.assets?.failures?.length === 0 &&
      state.game?.leaderboard?.status === "ready"
    );
  });

const browser = await chromium.launch({ headless: true });
try {
  const publicContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block",
  });
  const publicPage = await publicContext.newPage();
  await attachDiagnostics(publicPage, "public");
  await publicPage.goto(`${sourceUrl}?dev=0&phase13=1`, {
    waitUntil: "networkidle",
  });
  await waitForReady(publicPage);
  assert(await publicPage.locator("#dev-button").isHidden());
  assert.equal(
    await publicPage.evaluate(() => typeof window.__OTM.startCowVsCat),
    "undefined",
  );
  await publicPage.locator("#start-button").click();
  await publicPage.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text());
    return state.mode === "playing" && state.game.playMode === "classic";
  });
  let publicState = await stateOf(publicPage);
  assert.equal(publicState.game.rival.present, false);
  assert.equal(publicState.game.route.combatRedundancyEnabled, false);
  assert.equal(publicState.game.route.combatBackupBalloonCount, 0);
  assert.equal(publicState.game.leaderboardBalloonCount, 3);
  await publicPage.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-classic-unchanged.png"),
  });
  await publicContext.close();

  const devContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block",
  });
  const page = await devContext.newPage();
  await attachDiagnostics(page, "dev");
  await page.goto(`${sourceUrl}?dev=1&phase13=1`, {
    waitUntil: "networkidle",
  });
  await waitForReady(page);
  await page.locator("#dev-button").click();
  await page.locator("#dev-rival-attack").waitFor({ state: "visible" });
  assert.equal(
    (await page.locator(".dev-mode-label").textContent()).trim(),
    "COW VS CAT · PHASE 15",
  );
  assert.equal(
    (await page.locator("#dev-rival-attack").textContent()).trim(),
    "TEST BOW SWIPE",
  );
  await page.locator("#dev-panel .dev-card").screenshot({
    path: path.join(outputDirectory, "phone-phase13-dev-controls.png"),
  });
  await page.locator("#dev-start-rival").click();
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text());
    return (
      state.mode === "playing" &&
      state.game.playMode === "cow-vs-cat" &&
      state.game.rival.state === "waiting-first-pop"
    );
  });
  await page.evaluate(() => window.__OTM.setManualMode(true));
  await page.locator("#dev-button").click();
  await page.locator("#dev-rival-attack").click();
  let state = await stateOf(page);
  assert.equal(state.devTools.panelOpen, false);
  assert.equal(state.game.rival.attack.state, "telegraph");
  assert.equal(state.game.eventCounts.rivalSwipeTelegraph, 1);
  await page.evaluate(async () => {
    await window.__OTM.startCowVsCat(13_013);
    window.__OTM.setManualMode(true);
  });
  await page.evaluate(() => window.advanceTime(3000));
  state = await stateOf(page);
  assert.equal(state.game.rival.state, "waiting-first-pop");
  assert.equal(state.game.rival.visible, false);
  await page.evaluate(async () => {
    window.__OTM.debugPopBalloon("red");
    for (let elapsed = 0; elapsed < 2450; elapsed += 50) {
      window.__OTM.debugSetPlayer({ x: 270, y: 300, vy: 0, onGround: false });
      await window.advanceTime(50);
    }
  });
  state = await stateOf(page);
  assert(state.game.rival.active);
  assert(state.game.rival.visible);
  assert(state.game.rival.jetpackActive);
  assert.equal(state.game.rival.movementModel, "jetpack");
  assert.equal(state.game.rival.visualFrame, "hover");
  assert(state.game.rival.attacksImplemented.bowSwipe);
  assert(state.game.route.combatBackupBalloonCount > 0);

  await page.evaluate(() => {
    window.__OTM.debugSetBalloons([]);
    window.__OTM.debugSetPlayer({
      x: 390,
      y: 520,
      vy: -220,
      onGround: false,
    });
    window.__OTM.debugSetRival({
      x: 195,
      y: 500,
      vx: 0,
      vy: 0,
      attackCooldown: 99,
      orbitSide: -1,
    });
  });
  await page.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-cat-jetpack-hover.png"),
  });

  await page.evaluate(() => {
    window.__OTM.debugSetBalloons([
      {
        x: 200,
        y: 500,
        radius: 30,
        color: "blue",
        routeRole: "side",
      },
    ]);
    window.__OTM.debugSetPlayer({ x: 470, y: 637, vy: 0, onGround: true });
    window.__OTM.debugSetRival({
      x: 200,
      y: 500,
      vx: 0,
      vy: 0,
      attackCooldown: 99,
    });
    return window.advanceTime(300);
  });
  state = await stateOf(page);
  assert(state.game.balloons[0].alive);
  assert.equal(state.game.rival.stats.balloonPops, 0);

  await page.evaluate(() => {
    window.__OTM.debugSetBalloons([
      {
        x: 300,
        y: 500,
        radius: 30,
        color: "red",
        routeRole: "main",
      },
      {
        x: 330,
        y: 500,
        radius: 26,
        color: "green",
        routeRole: "side",
      },
    ]);
    window.__OTM.debugSetPlayer({ x: 470, y: 637, vy: 0, onGround: true });
    window.__OTM.debugSetRival({
      x: 200,
      y: 500,
      vx: 0,
      vy: 0,
      attackCooldown: 99,
    });
    window.__OTM.forceRivalAttack(1);
  });
  state = await stateOf(page);
  assert.equal(state.game.rival.attack.state, "telegraph");
  assert.equal(state.game.rival.visualFrame, "bow-windup");
  await page.evaluate(() => window.advanceTime(290));
  await page.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-bow-swipe-telegraph.png"),
  });
  await page.evaluate(() => window.advanceTime(370));
  state = await stateOf(page);
  assert.equal(state.game.rival.attack.state, "active");
  assert.equal(state.game.rival.visualFrame, "bow-slash");
  assert.equal(
    state.game.balloons.filter((balloon) => !balloon.alive).length,
    1,
  );
  assert.equal(state.game.rival.stats.balloonPops, 1);
  assert.equal(state.game.totalPopped, 0);
  assert.equal(state.game.combo.streak, 0);
  assert.equal(state.audio.requestCounts.rivalSwipeTelegraph, 2);
  assert.equal(state.audio.requestCounts.rivalSwipe, 1);
  assert.equal(state.audio.requestCounts.rivalBalloonPop, 1);
  await page.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-bow-swipe-collateral-pop.png"),
  });

  await page.evaluate(() => window.advanceTime(700));
  state = await stateOf(page);
  const cowHitsBeforeForcedSwipe = state.game.rival.stats.cowHits;
  const rivalHitEventsBeforeForcedSwipe =
    state.game.eventCounts.rivalHit || 0;
  const rivalHitSoundsBeforeForcedSwipe =
    state.audio.requestCounts.rivalHit || 0;
  await page.evaluate(() => {
    window.__OTM.debugSetBalloons([]);
    window.__OTM.debugSetPlayer({
      x: 330,
      y: 637,
      vy: 0,
      onGround: true,
    });
    window.__OTM.debugSetRival({
      x: 200,
      y: 576,
      vx: 0,
      vy: 0,
      attackCooldown: 99,
    });
    window.__OTM.forceRivalAttack(1);
    const startingHits = window.__OTM.getState().game.rival.stats.cowHits;
    for (let frame = 0; frame < 60; frame += 1) {
      window.advanceTime(1000 / 60);
      if (
        window.__OTM.getState().game.rival.stats.cowHits > startingHits
      ) {
        break;
      }
    }
  });
  state = await stateOf(page);
  assert.equal(
    state.game.rival.stats.cowHits,
    cowHitsBeforeForcedSwipe + 1,
  );
  assert(state.game.player.vx > 0);
  assert(state.game.player.vy > 0);
  assert.equal(
    state.game.eventCounts.rivalHit,
    rivalHitEventsBeforeForcedSwipe + 1,
  );
  assert.equal(
    state.audio.requestCounts.rivalHit,
    rivalHitSoundsBeforeForcedSwipe + 1,
  );
  await page.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-cow-hit-downward.png"),
  });

  await page.evaluate(() => window.advanceTime(800));
  await page.evaluate(() => {
    window.__OTM.debugSetRival({
      x: 280,
      y: 450,
      vx: 0,
      vy: 0,
      attackCooldown: 99,
    });
    window.__OTM.debugSetPlayer({
      x: 260,
      y: 395,
      vy: -200,
      onGround: false,
      facing: 1,
      slashTimer: 0.2016,
      cooldown: 0.4,
    });
    window.__OTM.forceRivalAttack(-1);
    return window.advanceTime(1000 / 60);
  });
  state = await stateOf(page);
  assert.equal(state.game.rival.state, "knocked-down");
  assert.equal(state.game.rival.visualFrame, "knockdown");
  assert.equal(state.game.rival.stats.counterHitsTaken, 1);
  assert.equal(state.game.rival.jetpackActive, false);
  assert.equal(state.audio.requestCounts.rivalCounter, 1);
  await page.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-cow-counter.png"),
  });

  await page.evaluate(() => window.advanceTime(800));
  await page.evaluate(() => {
    window.__OTM.debugSetPlayer({ x: 500, y: 500, vy: 0, onGround: false });
    window.__OTM.debugSetRival({
      x: 481,
      y: 500,
      vx: 385,
      vy: 0,
      orbitSide: 1,
      attackCooldown: 99,
    });
    return window.advanceTime(1000 / 60);
  });
  state = await stateOf(page);
  assert.equal(state.game.rival.x, 460);
  assert(state.game.rival.vx < 0);
  assert.equal(state.game.rival.facing, -1);
  assert(state.game.rival.stats.edgeTurns >= 1);

  assert.equal(firebaseWrites, 0);
  assert.deepEqual(errors, []);
  await devContext.close();
  console.log("Phase 13 jetpack + bow swipe browser audit passed.");
} finally {
  await browser.close();
}
