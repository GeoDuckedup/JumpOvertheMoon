import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "/Users/danemerman/.codex/skills/develop-web-game/node_modules/playwright/index.mjs";

const baseUrl =
  process.env.OTM_TEST_URL ||
  "http://127.0.0.1:5207/html-remake/?dev=1&build=16.0.2";
const screenshotDirectory = new URL(
  "./phase16-first-pop-screens/",
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
await page.evaluate(async () => {
  await window.__OTM.startCowVsCat(16_101);
  window.__OTM.setManualMode(true);
});

let state = await page.evaluate(() => window.__OTM.getState());
const openingBalloonIds = state.game.balloons
  .filter((balloon) => balloon.alive)
  .map((balloon) => balloon.id);
assert.equal(state.game.rival.state, "waiting-first-pop");
assert.equal(state.game.rival.waitingForFirstCowPop, true);
assert.equal(state.game.rival.visible, false);
assert.equal(state.game.rival.active, false);
await page.evaluate(() => window.advanceTime(7300));
state = await page.evaluate(() => window.__OTM.getState());
assert.equal(state.game.rival.state, "waiting-first-pop");
assert.equal(state.game.rival.visible, false);
assert.equal(state.game.rival.stats.balloonPops, 0);
assert.equal(state.game.totalPopped, 0);
const aliveBeforePop = new Set(
  state.game.balloons
    .filter((balloon) => balloon.alive)
    .map((balloon) => balloon.id),
);
assert(openingBalloonIds.every((id) => aliveBeforePop.has(id)));
await page.locator("#game-stage").screenshot({
  path: new URL("cat-waiting-before-first-pop.png", screenshotDirectory)
    .pathname,
});

await page.evaluate(() => window.__OTM.debugPopBalloon("red"));
state = await page.evaluate(() => window.__OTM.getState());
assert.equal(state.game.totalPopped, 1);
assert.equal(state.game.rival.state, "grace");
assert.equal(state.game.rival.waitingForFirstCowPop, false);
assert.equal(state.game.rival.visible, false);

await page.evaluate(async () => {
  for (let elapsed = 0; elapsed < 2450; elapsed += 50) {
    window.__OTM.debugSetPlayer({ x: 270, y: 300, vy: 0, onGround: false });
    await window.advanceTime(50);
  }
});
state = await page.evaluate(() => window.__OTM.getState());
assert(state.game.rival.visible);
assert(state.game.rival.active);
assert.notEqual(state.game.rival.state, "waiting-first-pop");
assert.notEqual(state.game.rival.state, "grace");
assert.equal(state.game.eventCounts.rivalEnter, 1);
await page.locator("#game-stage").screenshot({
  path: new URL("cat-arrived-after-first-pop.png", screenshotDirectory)
    .pathname,
});

assert.deepEqual(errors, []);
await context.close();
await browser.close();

console.log(
  JSON.stringify(
    {
      phase16_0_1_browser: {
        viewport: "390x844",
        prePopWaitSeconds: 7.3,
        firstBalloonProtected: true,
        postPopArrival: true,
        screenshots: 2,
        consoleErrors: errors.length,
      },
    },
    null,
    2,
  ),
);
