import fs from "node:fs";
import path from "node:path";
import { chromium } from "/Users/danemerman/.codex/skills/develop-web-game/node_modules/playwright/index.mjs";

const url = process.env.OTM_URL || "http://127.0.0.1:5173/html-remake/";
const outputDirectory = path.resolve(
  "html-remake/test-output/phase7-browser-smoke",
);
fs.mkdirSync(outputDirectory, { recursive: true });

const cosmicLandmarks = [
  "pluto",
  "kuiper-object",
  "heliopause",
  "voyager-1",
  "oort-comet",
  "proxima-centauri",
  "black-hole",
];
const failures = [];
const browserErrors = [];
const assert = (condition, message) => {
  if (!condition) {
    failures.push(message);
  }
};

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  page.on("pageerror", (error) =>
    browserErrors.push(`pageerror: ${error.message}`),
  );
  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(`console: ${message.text()}`);
    }
  });

  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() || "{}");
    return (
      state.assets?.loaded === state.assets?.total &&
      state.assets?.total > 0 &&
      state.assets?.failures?.length === 0
    );
  });

  let state = await page.evaluate(() =>
    JSON.parse(window.render_game_to_text()),
  );
  assert(
    state.phase >= 7,
    "The current page should retain the Phase 7 landmark foundation.",
  );
  assert(
    state.assets.total === 25,
    "The complete landmark-art build should load all 25 assets.",
  );
  assert(state.game.goalMarkers.length === 15, "All 15 landmarks should load.");
  assert(
    state.game.runStats.totalLandmarks === 15,
    "The dynamic run-stat landmark total should be 15.",
  );
  assert(
    state.layout.stageCss.width === 390 &&
      state.layout.stageCss.height === 844 &&
      !state.layout.desktopFramed,
    "The phone stage should fill the 390 × 844 viewport.",
  );

  await page.locator("#start-button").click();
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).mode === "playing",
  );
  await page.evaluate(() => {
    window.__OTM.setManualMode(true);
    window.__OTM.restartRun(0x7007);
  });

  const captures = [];
  for (const id of cosmicLandmarks) {
    const marker = await page.evaluate((landmarkId) => {
      return window.__OTM.debugJumpToLandmark(landmarkId);
    }, id);
    state = await page.evaluate(() =>
      JSON.parse(window.render_game_to_text()),
    );
    const stateMarker = state.game.goalMarkers.find(
      (candidate) => candidate.id === id,
    );
    assert(marker.id === id, `Debug access should return ${id}.`);
    assert(
      stateMarker &&
        stateMarker.heightMeters === marker.heightMeters &&
        stateMarker.alive,
      `${id} should be alive at its configured altitude.`,
    );
    assert(
      state.game.balloonCount <= state.game.route.maxActiveBalloons,
      `${id} should retain bounded balloon state.`,
    );
    const screenshot = path.join(outputDirectory, `phone-${id}.png`);
    await page.locator("#game-stage").screenshot({ path: screenshot });
    captures.push({
      id,
      heightMeters: marker.heightMeters,
      screenshot,
      activeBalloons: state.game.balloonCount,
    });
  }

  const oortCollision = await page.evaluate(() => {
    const marker = window.__OTM.debugJumpToLandmark("oort-comet");
    window.__OTM.debugSetBalloons([]);
    window.__OTM.debugSetPlayer({
      x: marker.x - 115,
      y: marker.y - 110,
      vx: 0,
      vy: 0,
      facing: -1,
      onGround: false,
      slashTimer: 0,
      cooldown: 0,
    });
    window.__OTM.queueAction();
    for (let frame = 0; frame < 16; frame += 1) {
      window.advanceTime(1000 / 60);
    }
    const afterTail = window.__OTM
      .getState()
      .game.goalMarkers.find((candidate) => candidate.id === "oort-comet");

    window.__OTM.debugSetPlayer({
      x: marker.x,
      y: marker.y - 100,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: false,
      slashTimer: 0,
      cooldown: 0,
    });
    window.__OTM.queueAction();
    for (let frame = 0; frame < 16; frame += 1) {
      window.advanceTime(1000 / 60);
    }
    const afterNucleus = window.__OTM.getState().game;
    return {
      tailLeftAlive: afterTail.alive,
      nucleusCleared: !afterNucleus.goalMarkers.find(
        (candidate) => candidate.id === "oort-comet",
      ).alive,
      landmarksCleared: afterNucleus.runStats.landmarksCleared,
      playerVy: afterNucleus.player.vy,
    };
  });
  assert(
    oortCollision.tailLeftAlive,
    "Slashing the decorative Oort tail should not clear the landmark.",
  );
  assert(
    oortCollision.nucleusCleared &&
      oortCollision.landmarksCleared === 1 &&
      oortCollision.playerVy < 0,
    "Slashing the Oort nucleus should clear it and bounce the player.",
  );

  state = await page.evaluate(() =>
    JSON.parse(window.render_game_to_text()),
  );
  assert(
    state.game.route.goalApproachMarkerIds.length === 15,
    "The upper climb should generate all 15 landmark approaches.",
  );
  assert(
    state.game.phaseSeven.finalLandmarkHeightMeters === 18500 &&
      state.game.phaseSeven.endlessBeyondFinalLandmark,
    "The Phase 7 state should expose the final altitude and endless continuation.",
  );
  assert(
    !state.game.phaseSeven.proceduralPlaceholderArt,
    "All seven cosmic landmarks should use approved production art.",
  );

  await page.evaluate(() => window.__OTM.debugFinishRun(19000));
  state = await page.evaluate(() =>
    JSON.parse(window.render_game_to_text()),
  );
  assert(state.game.mode === "gameover", "The results view should open.");
  assert(
    state.game.runStats.totalLandmarks === 15,
    "The results view should still expose the 15-landmark total.",
  );
  const resultsScreenshot = path.join(
    outputDirectory,
    "phone-results-dynamic-total.png",
  );
  await page.locator("#game-stage").screenshot({ path: resultsScreenshot });

  assert(browserErrors.length === 0, browserErrors.join("; "));
  if (failures.length) {
    throw new Error(failures.join("\n"));
  }

  console.log(
    JSON.stringify(
      {
        url,
        phase: state.phase,
        landmarkCount: state.game.goalMarkers.length,
        captures,
        oortCollision,
        routeApproaches: state.game.route.goalApproachMarkerIds.length,
        proceduralPlaceholderArt:
          state.game.phaseSeven.proceduralPlaceholderArt,
        phoneFillVerified: true,
        resultsDynamicTotal: state.game.runStats.totalLandmarks,
        browserErrors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
