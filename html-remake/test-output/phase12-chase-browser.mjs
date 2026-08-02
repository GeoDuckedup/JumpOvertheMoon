import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "/Users/danemerman/.codex/skills/develop-web-game/node_modules/playwright/index.mjs";

const sourceUrl =
  process.env.OTM_URL || "http://127.0.0.1:5198/html-remake/";
const outputDirectory = path.resolve(
  "html-remake/test-output/phase12-chase-browser",
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
      state.phase === 12 &&
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
    return state.mode === "playing" && state.game.playMode === "classic";
  });
  let publicState = await stateOf(publicPage);
  assert.equal(publicState.game.rival.present, false);
  assert.equal(publicState.game.leaderboardBalloonCount, 3);
  assert(publicState.game.scoreIsolation.remoteLeaderboardEnabled);
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
  assert.equal(
    (await devPage.locator(".dev-mode-label").textContent()).trim(),
    "COW VS CAT · PHASE 12",
  );
  assert.equal(
    (await devPage.locator("#dev-rival-toggle").textContent()).trim(),
    "RELEASE CAT",
  );
  assert.equal(
    (await devPage.locator("#dev-rival-speed").textContent()).trim(),
    "CHASE 1.00×",
  );
  await devPage.locator("#dev-panel .dev-card").screenshot({
    path: path.join(outputDirectory, "phone-phase12-dev-controls.png"),
  });
  await devPage.locator("#dev-start-rival").click();
  await devPage.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text());
    return (
      state.mode === "playing" &&
      state.game.playMode === "cow-vs-cat" &&
      state.game.rival.state === "grace"
    );
  });
  let devState = await stateOf(devPage);
  assert.equal(devState.game.rival.visible, false);
  assert.equal(devState.game.rival.movementEnabled, true);
  assert.equal(devState.game.rival.collisionEnabled, false);
  assert.equal(devState.game.rival.combatEnabled, false);
  assert.equal(devState.game.leaderboardBalloonCount, 0);
  assert(!devState.game.scoreIsolation.remoteLeaderboardEnabled);

  await devPage.evaluate(() => window.advanceTime(3000));
  devState = await stateOf(devPage);
  assert(devState.game.rival.active);
  assert(devState.game.rival.visible);
  assert(devState.game.rival.stats.entries >= 1);
  assert(devState.game.rival.stats.jumps >= 1);
  await devPage.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-cat-enters-chase.png"),
  });

  await devPage.evaluate(async () => {
    window.__OTM.debugSetBalloons([
      {
        x: 210,
        y: 500,
        radius: 30,
        color: "blue",
        routeRole: "side",
      },
    ]);
    window.__OTM.debugSetRival({
      x: 210,
      y: 462.6,
      vx: 0,
      vy: 120,
      onGround: false,
    });
    await window.advanceTime(1000 / 60);
  });
  devState = await stateOf(devPage);
  assert.equal(devState.game.balloons[0].alive, false);
  assert.equal(devState.game.rival.stats.balloonBounces, 1);
  assert.equal(devState.game.rival.stats.balloonPops, 1);
  assert.equal(devState.game.rival.stats.sideBalloonPops, 1);
  assert.equal(devState.game.totalPopped, 0);
  assert.equal(devState.game.hasPoppedBalloon, false);
  assert.equal(devState.game.combo.color, null);
  assert.equal(devState.game.combo.streak, 0);
  assert.equal(devState.game.floorRule, "safe-before-first-pop");
  assert.equal(devState.game.eventCounts.rivalBalloonPop, 1);
  assert.equal(devState.audio.requestCounts.rivalBalloonPop, 1);
  await devPage.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-cat-balloon-pop.png"),
  });

  await devPage.evaluate(async () => {
    window.__OTM.debugSetBalloons([
      {
        x: 210,
        y: 500,
        radius: 30,
        color: "red",
        routeRole: "main",
      },
    ]);
    window.__OTM.debugSetRival({
      x: 210,
      y: 462.6,
      vx: 0,
      vy: 120,
      onGround: false,
    });
    await window.advanceTime(1000 / 60);
  });
  devState = await stateOf(devPage);
  assert(devState.game.balloons[0].alive);
  assert.equal(devState.game.rival.stats.balloonPops, 1);

  await devPage.locator("#dev-button").click();
  await devPage.locator("#dev-rival-toggle").click();
  devState = await stateOf(devPage);
  assert.equal(devState.game.rival.state, "frozen");
  assert(devState.game.rival.frozen);
  const frozenPosition = {
    x: devState.game.rival.x,
    y: devState.game.rival.y,
  };
  await devPage.locator("#dev-close").click();
  await devPage.evaluate(() => window.advanceTime(1000));
  devState = await stateOf(devPage);
  assert.deepEqual(
    { x: devState.game.rival.x, y: devState.game.rival.y },
    frozenPosition,
  );
  await devPage.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-cat-frozen.png"),
  });

  await devPage.locator("#dev-button").click();
  await devPage.locator("#dev-rival-speed").click();
  devState = await stateOf(devPage);
  assert.equal(devState.game.rival.chaseSpeedScale, 1.2);
  await devPage.locator("#dev-rival-toggle").click();
  devState = await stateOf(devPage);
  assert.equal(devState.game.rival.frozen, false);
  await devPage.locator("#dev-close").click();
  const cowStartX = devState.game.player.x;
  await devPage.keyboard.down("ArrowRight");
  await devPage.evaluate(() => {
    window.__OTM.queueAction();
    window.advanceTime(350);
  });
  await devPage.keyboard.up("ArrowRight");
  devState = await stateOf(devPage);
  assert.notEqual(devState.game.player.x, cowStartX);
  assert.equal(devState.game.player.onGround, false);
  assert(devState.game.rival.active);
  await devPage.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-cow-and-cat-moving.png"),
  });

  await devPage.evaluate(() => window.advanceTime(500));
  devState = await stateOf(devPage);
  assert.notDeepEqual(
    { x: devState.game.rival.x, y: devState.game.rival.y },
    frozenPosition,
  );

  await devPage.evaluate(async () => {
    window.__OTM.debugSetPlayer({
      x: 270,
      y: 637,
      vy: 0,
      onGround: true,
    });
    window.__OTM.debugSetRival({
      x: 481,
      y: 500,
      vx: 405,
      vy: 0,
      onGround: false,
      frozen: false,
      pauseRemaining: 0,
      breatherInSeconds: 10,
    });
    await window.advanceTime(1000 / 60);
  });
  devState = await stateOf(devPage);
  assert.equal(devState.game.rival.x, 482);
  assert(devState.game.rival.vx < 0);
  assert.equal(devState.game.rival.facing, -1);
  assert(devState.game.rival.stats.edgeTurns >= 1);
  await devPage.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-cat-edge-turn.png"),
  });

  const recoveryX = 178;
  await devPage.evaluate(async ({ recoveryX }) => {
    window.__OTM.debugSetPlayer({
      x: 270,
      y: -2200,
      previousY: -2200,
      vy: 0,
      onGround: false,
    });
    const state = JSON.parse(window.render_game_to_text());
    window.__OTM.debugSetRival({
      x: recoveryX,
      y:
        state.game.camera.y +
        state.game.camera.viewportHeight +
        49,
      vy: 10,
      onGround: false,
      frozen: false,
    });
    await window.advanceTime(1000 / 60);
  }, { recoveryX });
  devState = await stateOf(devPage);
  assert.equal(devState.game.rival.state, "recovering");
  assert.equal(devState.game.rival.visible, false);
  assert.equal(devState.game.rival.recoveryX, recoveryX);
  await devPage.evaluate(() => window.advanceTime(650));
  devState = await stateOf(devPage);
  assert.equal(devState.game.rival.state, "reentering");
  assert(devState.game.rival.visible);
  assert(devState.game.rival.stats.recoveries >= 1);
  assert(Math.abs(devState.game.rival.x - recoveryX) < 9);
  await devPage.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-cat-screen-return.png"),
  });

  await devPage.locator("#dev-button").click();
  await devPage.locator("#dev-start-classic").click();
  await devPage.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text());
    return state.game.playMode === "classic";
  });
  devState = await stateOf(devPage);
  assert.equal(devState.game.rival.present, false);
  assert.equal(devState.game.leaderboardBalloonCount, 3);
  assert(devState.game.scoreIsolation.remoteLeaderboardEnabled);
  assert.equal(firebaseWrites, 0);
  assert.deepEqual(errors, []);

  console.log(
    JSON.stringify(
      {
        phase: 12,
        version: "15.2.1",
        phoneViewport: "390x844",
        publicClassicEntryUnchanged: true,
        cowVsCatDevOnly: true,
        openingGrace: true,
        activePursuitAndBalloonPopping: true,
        cowScoreAndComboIsolation: true,
        protectedMainRoute: true,
        directEdgeTurnWithoutWrap: true,
        freezeAndSpeedControls: true,
        visibleScreenRecoveryAndSameXReturn: true,
        collisionAndCombatDisabled: true,
        firebaseWrites,
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
