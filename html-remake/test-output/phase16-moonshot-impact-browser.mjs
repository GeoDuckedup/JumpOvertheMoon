import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "/Users/danemerman/.codex/skills/develop-web-game/node_modules/playwright/index.mjs";

const baseUrl =
  process.env.OTM_TEST_URL ||
  "http://127.0.0.1:5207/html-remake/?dev=1&build=16.0.2";
const screenshotDirectory = new URL(
  "./phase16-moonshot-impact-screens/",
  import.meta.url,
);
fs.mkdirSync(screenshotDirectory, { recursive: true });

const errors = [];
const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader"],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  serviceWorkers: "block",
});
const page = await context.newPage();
page.on("console", (message) => {
  if (message.type() === "error") {
    errors.push(`console: ${message.text()}`);
  }
});
page.on("pageerror", (error) => errors.push(`page: ${String(error)}`));
await page.route(
  "https://over-the-moon-14b50-default-rtdb.firebaseio.com/**",
  (route) => route.fulfill({ json: null }),
);

await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
await page.waitForFunction(
  () =>
    window.__OTM?.getState().assets.progress === 1 &&
    window.__OTM?.version === "16.0.2",
);

const startTestRun = (seed) =>
  page.evaluate(async (runSeed) => {
    await window.__OTM.startCowVsCat(runSeed);
    window.__OTM.setManualMode(true);
    window.__OTM.debugSetBalloons([]);
  }, seed);

await startTestRun(16_201);
await page.evaluate(async () => {
  window.__OTM.debugSetPlayer({
    x: 270,
    y: 340,
    vy: -920,
    onGround: false,
    slashTimer: 0,
    cooldown: 0,
  });
  window.__OTM.forceRivalBoost();
  await window.advanceTime(850);
});
let state = await page.evaluate(() => window.__OTM.getState());
assert.equal(state.game.rival.attack.boostHitCow, true);
assert.equal(state.game.rival.attack.boostClanked, false);
assert.equal(state.game.rival.stats.boostCowHits, 1);
assert.equal(state.game.eventCounts.rivalBoostHit, 1);
assert(Math.abs(state.game.player.vx) >= 430);
assert(state.game.player.vy >= 560);
assert.equal(state.game.rival.attack.boostHitHalfWidth, 42);
assert.equal(state.game.rival.attack.boostHitReachAbove, 88);
await page.locator("#game-stage").screenshot({
  path: new URL("moonshot-authoritative-hit.png", screenshotDirectory)
    .pathname,
});

await startTestRun(16_202);
await page.evaluate(async () => {
  window.__OTM.debugSetPlayer({ x: 270, y: 340, vy: -450, onGround: false });
  window.__OTM.forceRivalBoost();
  window.__OTM.debugSetPlayer({ x: 470, y: 340, vy: -450, onGround: false });
  await window.advanceTime(600);
  await window.advanceTime(40);
  const active = window.__OTM.getState();
  window.__OTM.debugSetPlayer({
    x: active.game.rival.x + 8,
    y: active.game.rival.y - 48,
    vy: 650,
    onGround: false,
    slashTimer: 0,
    cooldown: 0,
  });
  await window.advanceTime(17);
});
state = await page.evaluate(() => window.__OTM.getState());
assert.equal(state.game.rival.attack.boostHitCow, true);
assert.equal(state.game.rival.stats.boostCowHits, 1);
assert(state.game.player.vy >= 830);
assert.equal(state.game.eventCounts.rivalBoostHit, 1);

await startTestRun(16_203);
await page.evaluate(async () => {
  window.__OTM.debugSetCombo("green", 2);
  window.__OTM.debugSetPlayer({ x: 270, y: 340, vy: -450, onGround: false });
  window.__OTM.forceRivalBoost();
  window.__OTM.debugSetPlayer({ x: 470, y: 340, vy: -450, onGround: false });
  await window.advanceTime(600);
  await window.advanceTime(40);
  const active = window.__OTM.getState();
  window.__OTM.debugSetPlayer({
    x: active.game.rival.x - 28,
    y: active.game.rival.y - 60,
    vy: -120,
    onGround: false,
    facing: 1,
    slashTimer: 0.2016,
    cooldown: 0.12,
  });
  await window.advanceTime(17);
});
state = await page.evaluate(() => window.__OTM.getState());
assert.equal(state.game.rival.attack.boostClanked, true);
assert.equal(state.game.rival.attack.boostHitCow, false);
assert.equal(state.game.rival.stats.boostClanks, 1);
assert.equal(state.game.rival.stats.boostCowHits, 0);
assert.equal(state.game.eventCounts.rivalClank, 1);
assert.equal(state.game.eventCounts.rivalBoostHit, undefined);
assert.equal(state.game.combo.color, "green");
assert.equal(state.game.combo.streak, 2);
assert(state.game.player.vy < 0);
await page.locator("#game-stage").screenshot({
  path: new URL("moonshot-downslash-clank.png", screenshotDirectory)
    .pathname,
});

assert.deepEqual(errors, []);
await context.close();
await browser.close();

console.log(
  JSON.stringify(
    {
      phase16_0_2_browser: {
        viewport: "390x844",
        unprotectedHit: true,
        fallingCowReceivesAddedImpulse: true,
        downwardSlashClankPreserved: true,
        screenshots: 2,
        consoleErrors: errors.length,
      },
    },
    null,
    2,
  ),
);
