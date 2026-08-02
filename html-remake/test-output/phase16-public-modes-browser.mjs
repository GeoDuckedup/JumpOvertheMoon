import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "/Users/danemerman/.codex/skills/develop-web-game/node_modules/playwright/index.mjs";

const baseUrl =
  process.env.OTM_TEST_URL ||
  "http://127.0.0.1:5207/html-remake/?dev=1&phase16-browser=1";
const screenshotDirectory = new URL("./phase16-screens/", import.meta.url);
fs.mkdirSync(screenshotDirectory, { recursive: true });

const remote = {
  classic: {
    classic1: { initials: "MOO", score: 920, timestamp: 1 },
  },
  "cow-vs-cat": {
    rival1: { initials: "CAT", score: 780, timestamp: 2 },
    rival2: { initials: "BOW", score: 510, timestamp: 3 },
  },
};
const requests = [];
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
  async (route) => {
    const request = route.request();
    const playMode = request.url().includes("/cowvscat/")
      ? "cow-vs-cat"
      : "classic";
    const method = request.method();
    requests.push({ method, playMode, url: request.url() });
    if (method === "POST") {
      const entry = request.postDataJSON();
      remote[playMode][`submitted-${requests.length}`] = entry;
      await route.fulfill({ json: { name: `submitted-${requests.length}` } });
      return;
    }
    await route.fulfill({ json: remote[playMode] });
  },
);

await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__OTM?.getState().assets.progress === 1);
await page.waitForFunction(() => window.__OTM?.getState().mode === "menu");

const menuLabels = await page
  .locator(
    "#start-button, #cow-vs-cat-button, #how-to-play-button, #menu-leaderboard-button",
  )
  .allTextContents();
assert.deepEqual(
  menuLabels.map((label) => label.trim()),
  ["OVER THE MOON", "COW VS CAT", "HOW TO PLAY", "LEADERBOARD"],
);
const menuBoxes = await Promise.all(
  [
    "#start-button",
    "#cow-vs-cat-button",
    "#how-to-play-button",
    "#menu-leaderboard-button",
  ].map((selector) => page.locator(selector).boundingBox()),
);
assert(menuBoxes.every(Boolean));
for (let index = 1; index < menuBoxes.length; index += 1) {
  assert(menuBoxes[index].y > menuBoxes[index - 1].y);
  assert.equal(Math.round(menuBoxes[index].width), Math.round(menuBoxes[0].width));
}
await page.locator("#game-stage").screenshot({
  path: new URL("menu-phone.png", screenshotDirectory).pathname,
});

await page.click("#how-to-play-button");
await page.waitForFunction(
  () => window.__OTM.getState().menu.howToPlayVisible,
);
assert(
  (await page.locator(".rival-help-row").innerText()).includes("COW VS CAT"),
);
const howToBackBox = await page.locator("#how-to-play-back").boundingBox();
assert(howToBackBox && howToBackBox.y + howToBackBox.height <= 844);
await page.click("#how-to-play-back");

await page.click("#cow-vs-cat-button");
await page.waitForFunction(
  () => window.__OTM.getState().game.playMode === "cow-vs-cat",
);
await page.waitForFunction(
  () =>
    window.__OTM.getState().game.leaderboards["cow-vs-cat"].status ===
      "ready" &&
    window.__OTM.getState().game.leaderboardBalloonCount === 2,
);
let state = await page.evaluate(() => window.__OTM.getState());
assert.equal(state.game.mode, "playing");
assert(state.game.rival.present);
assert.equal(
  state.game.scoreIsolation.remoteScoresPath,
  "/jumpoverthemoon/cowvscat/scores",
);
assert.equal(state.game.leaderboardBalloonCount, 2);
assert(
  state.game.leaderboardBalloons.every((balloon) =>
    balloon.id.includes("cow-vs-cat"),
  ),
);

await page.evaluate(() => window.__OTM.debugFinishRun(333));
assert(await page.locator("#death-primary").isVisible());
assert(await page.locator("#death-retry").isVisible());
assert(await page.locator("#death-menu").isVisible());
assert.equal((await page.locator("#death-retry").innerText()).trim(), "RIVAL AGAIN");
await page.locator("#game-stage").screenshot({
  path: new URL("rival-results-phone.png", screenshotDirectory).pathname,
});

await page.click("#death-primary");
assert.equal(
  await page.locator("#leaderboard-tab-rival").getAttribute("aria-selected"),
  "true",
);
assert.equal(
  (await page.locator("#leaderboard-scores-title").innerText()).trim(),
  "TOP RIVALS",
);
assert(await page.locator("#leaderboard-entry").isVisible());
await page.locator("#leaderboard-initials").fill("V16");
await page.click("#leaderboard-submit");
await page.waitForFunction(
  () => window.__OTM.getState().game.deathScreen.submitted,
);
await page.waitForFunction(
  () => window.__OTM.getState().game.leaderboard.pendingCount === 0,
);
assert.equal(
  requests.filter(
    (request) => request.method === "POST" && request.playMode === "cow-vs-cat",
  ).length,
  1,
);
assert.equal(
  requests.filter(
    (request) => request.method === "POST" && request.playMode === "classic",
  ).length,
  0,
);

await page.click("#leaderboard-tab-classic");
assert.equal(
  await page.locator("#leaderboard-tab-classic").getAttribute("aria-selected"),
  "true",
);
assert(await page.locator("#leaderboard-entry").isHidden());
assert((await page.locator("#leaderboard-list").innerText()).includes("MOO"));
await page.click("#leaderboard-tab-rival");
assert((await page.locator("#leaderboard-list").innerText()).includes("V16"));
await page.locator("#game-stage").screenshot({
  path: new URL("rival-leaderboard-phone.png", screenshotDirectory).pathname,
});

await page.click("#leaderboard-menu");
state = await page.evaluate(() => window.__OTM.getState());
assert.equal(state.game.mode, "menu");
assert(state.menu.mainVisible);

await page.click("#menu-leaderboard-button");
assert.equal(
  await page.locator("#leaderboard-tab-classic").getAttribute("aria-selected"),
  "true",
);
assert((await page.locator("#leaderboard-list").innerText()).includes("MOO"));
await page.click("#leaderboard-tab-rival");
assert((await page.locator("#leaderboard-list").innerText()).includes("V16"));
assert(await page.locator("#leaderboard-entry").isHidden());
await page.click("#leaderboard-back");

await page.click("#start-button");
await page.waitForFunction(
  () => window.__OTM.getState().game.playMode === "classic",
);
state = await page.evaluate(() => window.__OTM.getState());
assert.equal(state.game.leaderboard.playMode, "classic");
assert.equal(state.game.leaderboardBalloonCount, 1);
assert.equal(state.game.leaderboardBalloons[0].leaderboard.initials, "MOO");
assert.equal(state.game.savedBestHeightMeters, 0);

const desktopContext = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
});
const desktopPage = await desktopContext.newPage();
await desktopPage.route(
  "https://over-the-moon-14b50-default-rtdb.firebaseio.com/**",
  (route) => route.fulfill({ json: remote.classic }),
);
await desktopPage.goto(baseUrl, { waitUntil: "domcontentloaded" });
await desktopPage.waitForFunction(() => window.__OTM?.getState().mode === "menu");
const desktopStage = await desktopPage.locator("#game-stage").boundingBox();
assert(desktopStage);
assert(desktopStage.width <= 500);
assert(desktopStage.height <= 688.5);
for (const selector of [
  "#start-button",
  "#cow-vs-cat-button",
  "#how-to-play-button",
  "#menu-leaderboard-button",
]) {
  const box = await desktopPage.locator(selector).boundingBox();
  assert(box, `${selector} should be visible on desktop`);
  assert(box.y >= desktopStage.y);
  assert(box.y + box.height <= desktopStage.y + desktopStage.height);
}
await desktopPage.locator("#game-stage").screenshot({
  path: new URL("menu-desktop.png", screenshotDirectory).pathname,
});

assert.deepEqual(errors, []);
await desktopContext.close();
await browser.close();

console.log(
  JSON.stringify(
    {
      phase16Browser: {
        phoneViewport: "390x844",
        desktopViewport: "1280x720",
        publicMenuOrder: menuLabels.map((label) => label.trim()),
        rivalResultActions: 3,
        leaderboardTabs: 2,
        rivalPosts: 1,
        classicPostsDuringRivalSubmission: 0,
        screenshots: 4,
        consoleErrors: errors.length,
      },
    },
    null,
    2,
  ),
);
