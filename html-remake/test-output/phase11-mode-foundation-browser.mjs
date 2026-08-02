import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "/Users/danemerman/.codex/skills/develop-web-game/node_modules/playwright/index.mjs";

const sourceUrl =
  process.env.OTM_URL || "http://127.0.0.1:5198/html-remake/";
const outputDirectory = path.resolve(
  "html-remake/test-output/phase11-mode-foundation-browser",
);
fs.mkdirSync(outputDirectory, { recursive: true });

const mockScores = {
  first: { initials: "MOO", score: 1200, timestamp: 3 },
  second: { initials: "CAT", score: 900, timestamp: 2 },
  third: { initials: "BOW", score: 600, timestamp: 1 },
};
const browser = await chromium.launch({ headless: true });
const errors = [];

const attachDiagnostics = (page, label) => {
  page.on("pageerror", (error) =>
    errors.push(`${label} pageerror: ${error.message}`),
  );
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`${label} console: ${message.text()}`);
    }
  });
  return page.route("**/jumpoverthemoon/scores.json?**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockScores),
    }),
  );
};

const waitForReady = (page) =>
  page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() || "{}");
    return (
      state.phase === 11 &&
      state.release?.version === "11.0.2" &&
      state.assets?.loaded === 35 &&
      state.assets?.loaded === state.assets?.total &&
      state.assets?.failures?.length === 0 &&
      state.game?.leaderboard?.status === "ready"
    );
  });

try {
  const publicContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const publicPage = await publicContext.newPage();
  await attachDiagnostics(publicPage, "public");
  await publicPage.goto(`${sourceUrl}?dev=0`, { waitUntil: "networkidle" });
  await waitForReady(publicPage);
  assert(await publicPage.locator("#dev-button").isHidden());
  assert(await publicPage.locator("#dev-start-rival").isHidden());
  assert.equal(
    await publicPage.evaluate(() => typeof window.__OTM.startCowVsCat),
    "undefined",
  );
  await publicPage.locator("#start-button").click();
  await publicPage.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text());
    return state.mode === "playing" && state.game?.playMode === "classic";
  });
  const publicState = JSON.parse(
    await publicPage.evaluate(() => window.render_game_to_text()),
  );
  assert.equal(publicState.game.rival.present, false);
  assert.equal(publicState.game.rival.visible, false);
  assert(publicState.game.scoreIsolation.remoteLeaderboardEnabled);
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
  });
  const devPage = await devContext.newPage();
  await attachDiagnostics(devPage, "dev");
  await devPage.goto(`${sourceUrl}?dev=1`, { waitUntil: "networkidle" });
  await waitForReady(devPage);
  await devPage.locator("#dev-button").click();
  await devPage.locator("#dev-start-rival").waitFor({ state: "visible" });
  await devPage.locator("#dev-panel .dev-card").screenshot({
    path: path.join(outputDirectory, "phone-dev-mode-controls.png"),
  });
  await devPage.locator("#dev-start-rival").click();
  await devPage.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text());
    return (
      state.mode === "playing" &&
      state.game?.playMode === "cow-vs-cat" &&
      state.game?.rival?.visible
    );
  });
  let devState = JSON.parse(
    await devPage.evaluate(() => window.render_game_to_text()),
  );
  assert.equal(devState.game.rival.state, "inactive-concept");
  assert.equal(devState.game.rival.active, false);
  assert.equal(devState.game.rival.movementEnabled, false);
  assert.equal(devState.game.rival.collisionEnabled, false);
  assert.equal(devState.game.rival.combatEnabled, false);
  assert.equal(devState.game.leaderboardBalloonCount, 0);
  assert(!devState.game.scoreIsolation.remoteLeaderboardEnabled);
  assert(devState.game.scoreIsolation.classicLeaderboardWritesBlocked);
  assert.equal(devState.game.phaseEleven.publicMenuVisible, false);
  await devPage.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-rival-concept.png"),
  });

  const startX = devState.game.rival.x;
  await devPage.locator("#dev-button").click();
  await devPage.locator("#dev-rival-left").click();
  devState = JSON.parse(
    await devPage.evaluate(() => window.render_game_to_text()),
  );
  assert(devState.game.rival.x < startX);
  await devPage.locator("#dev-rival-right").click();
  devState = JSON.parse(
    await devPage.evaluate(() => window.render_game_to_text()),
  );
  assert.equal(devState.game.rival.x, startX);
  await devPage.locator("#dev-close").click();

  await devPage.evaluate(() => window.__OTM.debugFinishRun(240));
  await devPage.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text());
    return state.mode === "gameover";
  });
  assert(await devPage.locator("#death-primary").isHidden());
  assert.equal(
    await devPage.locator("#death-retry").textContent(),
    "RIVAL AGAIN",
  );
  await devPage.locator("#death-retry").click();
  await devPage.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text());
    return (
      state.mode === "playing" &&
      state.game?.playMode === "cow-vs-cat" &&
      state.game?.rival?.visible
    );
  });

  await devPage.locator("#dev-button").click();
  await devPage.locator("#dev-start-classic").click();
  await devPage.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text());
    return state.game?.playMode === "classic";
  });
  devState = JSON.parse(
    await devPage.evaluate(() => window.render_game_to_text()),
  );
  assert.equal(devState.game.rival.present, false);
  assert.equal(devState.game.leaderboardBalloonCount, 3);
  assert(devState.game.scoreIsolation.remoteLeaderboardEnabled);
  assert.deepEqual(errors, []);

  console.log(
    JSON.stringify(
      {
        phase: 11,
        version: "11.0.2",
        phoneViewport: "390x844",
        publicClassicEntryUnchanged: true,
        cowVsCatDevOnly: true,
        rivalConceptRendered: true,
        debugPositionControls: true,
        rivalRetryPreservesMode: true,
        devClassicRestore: true,
        classicScoreSubmissionBlockedInRival: true,
        assetsLoaded: 33,
        errors,
      },
      null,
      2,
    ),
  );
  await devContext.close();
} finally {
  await browser.close();
}
