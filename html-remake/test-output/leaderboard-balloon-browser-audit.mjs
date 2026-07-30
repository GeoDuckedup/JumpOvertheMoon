import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "/Users/danemerman/.codex/skills/develop-web-game/node_modules/playwright/index.mjs";

const url =
  process.env.OTM_URL || "http://127.0.0.1:5174/html-remake/?dev=1";
const outputDirectory = path.resolve(
  "html-remake/test-output/leaderboard-balloon-browser-audit",
);
fs.mkdirSync(outputDirectory, { recursive: true });

const mockScores = Object.fromEntries(
  Array.from({ length: 10 }, (_, index) => [
    `score-${index + 1}`,
    {
      initials: ["TOP", "MO0", "COW", "SKY", "MOO"][index % 5],
      score: 16_000 - index * 1_200,
      timestamp: 10_000 + index,
    },
  ]),
);
const browser = await chromium.launch({ headless: true });
const errors = [];

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`console: ${message.text()}`);
    }
  });
  await page.route("**/jumpoverthemoon/scores.json?**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockScores),
    }),
  );

  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() || "{}");
    return (
      state.assets?.loaded === state.assets?.total &&
      state.assets?.total > 0 &&
      state.game?.leaderboard?.status === "ready" &&
      state.game?.leaderboardBalloonCount === 10
    );
  });

  await page.locator("#dev-button").click();
  const goldButton = page.locator("#dev-test-gold");
  await goldButton.waitFor({ state: "visible" });
  assert(await goldButton.isEnabled());
  await goldButton.click();
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text());
    return (
      state.mode === "playing" &&
      state.devTools?.lastWarp?.leaderboardRank === 1
    );
  });

  const markerState = JSON.parse(
    await page.evaluate(() => window.render_game_to_text()),
  );
  const marker = markerState.game.leaderboardBalloons[0];
  assert.equal(marker.color, "red");
  assert.equal(marker.routeRole, "leaderboard");
  assert.equal(marker.leaderboard.rank, 1);
  assert.equal(marker.leaderboard.initials, "TOP");
  assert.equal(marker.leaderboard.scoreMeters, 16_000);
  assert(marker.alive);
  assert(markerState.game.leaderboardBalloonFeature.goldAura);
  assert.equal(
    markerState.game.leaderboardBalloonFeature.comboBehavior,
    "displayed-color",
  );
  assert(markerState.game.balloonCount <= markerState.game.route.maxActiveBalloons);
  assert.equal(markerState.game.aliveLeaderboardBalloonCount, 10);
  await page.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-gold-marker.png"),
  });

  await page.evaluate(() => {
    window.__OTM.setManualMode(true);
    const state = JSON.parse(window.render_game_to_text());
    const target = state.game.leaderboardBalloons[0];
    window.__OTM.debugSetBalloons([]);
    window.__OTM.debugSetCombo("red", 2);
    window.__OTM.debugSetPlayer({
      x: target.x,
      y: target.y - 64,
      vx: 0,
      vy: 0,
      onGround: false,
      slashTimer: 0,
      cooldown: 0,
    });
    window.__OTM.queueAction();
    window.advanceTime(200);
  });
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text());
    return state.game?.poppedLeaderboardBalloonCount === 1;
  });
  const poppedState = JSON.parse(
    await page.evaluate(() => window.render_game_to_text()),
  );
  assert.equal(poppedState.game.aliveLeaderboardBalloonCount, 9);
  assert.equal(poppedState.game.totalPopped, 1);
  assert.equal(poppedState.game.combo.color, "red");
  assert.equal(poppedState.game.combo.streak, 3);
  assert.equal(poppedState.game.combo.lastReward, "combo!");
  assert.equal(poppedState.game.eventCounts.balloonPop, 1);
  assert.equal(poppedState.game.eventCounts.bounce, 1);
  assert.equal(poppedState.game.eventCounts.combo, 1);
  assert(poppedState.game.player.vy < 0);
  await page.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-gold-pop.png"),
  });

  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        phoneViewport: "390x844",
        mockedLeaderboardRows: 10,
        devTopRankWarpButton: true,
        rankInitialsAndHeightExposed: true,
        fourColorCoreAndGoldAuraRendered: true,
        slashPopBounce: true,
        displayedColorComboBehavior: true,
        routeActiveLimitSeparate: true,
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
