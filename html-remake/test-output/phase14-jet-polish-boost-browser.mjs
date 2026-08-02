import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "/Users/danemerman/.codex/skills/develop-web-game/node_modules/playwright/index.mjs";
import {
  PLAYER,
  RIVAL_JETPACK,
  RIVAL_VERTICAL_BOOST,
} from "../src/game-config.js";

const sourceUrl =
  process.env.OTM_URL || "http://127.0.0.1:5201/html-remake/";
const outputDirectory = path.resolve(
  "html-remake/test-output/phase14-jet-polish-boost-browser",
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

  await page.goto(`${sourceUrl}?dev=1&phase14=1`, {
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
    (await page.locator("#dev-rival-boost").textContent()).trim(),
    "TEST OVERTAKE",
  );
  assert.equal(
    (await page.locator("#dev-rival-counter").textContent()).trim(),
    "TEST COUNTER BOUNCE",
  );
  await page.locator("#dev-panel .dev-card").screenshot({
    path: path.join(outputDirectory, "phone-phase14-dev-controls.png"),
  });
  await page.locator("#dev-close").click();

  await page.evaluate(async () => {
    await window.__OTM.startCowVsCat(14_014);
    window.__OTM.setManualMode(true);
    window.__OTM.debugSetBalloons([]);
    window.__OTM.debugSetPlayer({
      x: 390,
      y: 410,
      vy: -260,
      onGround: false,
    });
    window.__OTM.debugSetRival({
      skipGrace: true,
      x: 185,
      y: 430,
      vx: 80,
      vy: -40,
      attackCooldown: 99,
    });
    window.advanceTime(360);
  });
  let state = await stateOf(page);
  assert.equal(state.game.playMode, "cow-vs-cat");
  assert(state.game.rival.exhaustTrail.length >= 3);
  assert(state.game.phaseFourteen.persistentHeatHazeTrailImplemented);
  await page.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-aligned-exhaust-trail.png"),
  });

  await page.evaluate(() => {
    window.__OTM.debugSetPlayer({
      x: 270,
      y: 330,
      vy: -460,
      onGround: false,
    });
    window.__OTM.forceRivalBoost();
  });
  state = await stateOf(page);
  assert.equal(state.game.rival.attack.state, "boost-telegraph");
  assert.equal(state.game.rival.visualFrame, "boost-charge");
  assert.equal(state.audio.requestCounts.rivalBoostTelegraph, 1);
  await page.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-boost-telegraph.png"),
  });

  await page.evaluate(() => {
    window.__OTM.debugSetPlayer({
      x: 470,
      y: 320,
      vy: -400,
      onGround: false,
    });
    window.advanceTime(600);
    window.advanceTime(40);
  });
  state = await stateOf(page);
  assert.equal(state.game.rival.attack.state, "boost-active");
  assert.equal(state.game.rival.visualFrame, "boost-active");
  assert.equal(state.audio.requestCounts.rivalBoost, 1);
  assert.equal(
    state.game.phaseFourteen.counterBounceNormalBalloonRatio,
    0.75,
  );
  assert.equal(
    state.game.phaseFourteen.verticalBoostClankNormalBalloonRatio,
    0.5,
  );
  assert(
    state.game.rival.exhaustTrail.some((point) => point.intensity === 2),
  );
  await page.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-boost-active.png"),
  });

  await page.evaluate(
    ({ rivalX, rivalY, slashTime, slashCooldown }) => {
      window.__OTM.debugSetCombo("green", 2);
      window.__OTM.debugSetPlayer({
        x: rivalX - 28,
        y: rivalY - 60,
        vy: -120,
        onGround: false,
        facing: 1,
        slashTimer: slashTime * 0.72,
        cooldown: slashCooldown,
      });
      window.advanceTime(17);
    },
    {
      rivalX: state.game.rival.x,
      rivalY: state.game.rival.y,
      slashTime: PLAYER.slashTime,
      slashCooldown: PLAYER.slashCooldown,
    },
  );
  state = await stateOf(page);
  assert.equal(state.game.rival.attack.state, "boost-active");
  assert.equal(state.game.rival.attack.boostClanked, true);
  assert.equal(state.game.rival.attack.boostHitCow, false);
  assert.equal(state.game.rival.stats.boostClanks, 1);
  assert.equal(state.game.rival.stats.boostCowHits, 0);
  assert.equal(state.game.eventCounts.rivalClank, 1);
  assert.equal(state.audio.requestCounts.rivalClank, 1);
  assert.equal(state.audio.playCounts.rivalClank, 1);
  assert.equal(
    state.audio.soundDesign.rivalClank,
    "short-soft-metal-tink-v1",
  );
  assert.equal(state.game.combo.color, "green");
  assert.equal(state.game.combo.streak, 2);
  assert(
    Math.abs(state.game.player.vy) >=
      RIVAL_VERTICAL_BOOST.clankBounceSpeed,
  );
  assert(
    Math.abs(state.game.player.vy) <
      RIVAL_JETPACK.counterBounceSpeed,
  );
  await page.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-moonshot-sword-clank.png"),
  });

  await page.evaluate(() => {
    window.__OTM.debugSetCombo("yellow", 2);
    window.__OTM.forceRivalCounter();
  });
  state = await stateOf(page);
  assert.equal(state.game.rival.state, "knocked-down");
  assert(state.game.player.vy < -500);
  assert.equal(state.game.combo.color, "yellow");
  assert.equal(state.game.combo.streak, 2);
  assert.equal(state.game.rival.stats.counterBouncesAwarded, 1);
  await page.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-counter-bounce.png"),
  });

  assert.equal(firebaseWrites, 0);
  assert.deepEqual(errors, []);
  await context.close();
  console.log("Phase 14 jet polish + vertical boost browser audit passed.");
} finally {
  await browser.close();
}
