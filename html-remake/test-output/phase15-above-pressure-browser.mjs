import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "/Users/danemerman/.codex/skills/develop-web-game/node_modules/playwright/index.mjs";
import { BUILD_VERSION } from "../src/config.js";
import { RIVAL_JETPACK } from "../src/game-config.js";

const sourceUrl =
  process.env.OTM_URL || "http://127.0.0.1:5202/html-remake/";
const outputDirectory = path.resolve(
  "html-remake/test-output/phase15-above-pressure-browser",
);
fs.mkdirSync(outputDirectory, { recursive: true });

const errors = [];
let firebaseWrites = 0;
const browser = await chromium.launch({ headless: true });
const stateOf = (page) =>
  page.evaluate(() => JSON.parse(window.render_game_to_text()));

const pinAndAdvanceUntil = async (
  page,
  fixedPlayerY,
  acceptedStates,
  maximumFrames,
) =>
  page.evaluate(
    async ({ fixedPlayerY, acceptedStates, maximumFrames }) => {
      for (let frame = 0; frame < maximumFrames; frame += 1) {
        window.__OTM.debugSetPlayer({
          x: 270,
          y: fixedPlayerY,
          vx: 0,
          vy: 0,
          onGround: false,
        });
        await window.advanceTime(1000 / 60);
        const state = JSON.parse(window.render_game_to_text());
        if (acceptedStates.includes(state.game.rival.attack.state)) {
          return { found: true, frame, state };
        }
      }
      return {
        found: false,
        frame: maximumFrames,
        state: JSON.parse(window.render_game_to_text()),
      };
    },
    { fixedPlayerY, acceptedStates, maximumFrames },
  );

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

  const url = new URL(sourceUrl);
  url.searchParams.set("dev", "1");
  url.searchParams.set("abovePressure", BUILD_VERSION);
  await page.goto(url.href, { waitUntil: "networkidle" });
  await page.waitForFunction(
    (version) => {
      const state = JSON.parse(window.render_game_to_text?.() || "{}");
      return (
        state.release?.version === version &&
        state.assets?.loaded === 35 &&
        state.assets?.loaded === state.assets?.total &&
        state.assets?.failures?.length === 0
      );
    },
    BUILD_VERSION,
  );

  await page.evaluate(async () => {
    await window.__OTM.startCowVsCat(15_204);
    window.__OTM.setManualMode(true);
    window.__OTM.debugSetBalloons([]);
  });
  await page.locator("#dev-button").click();
  assert.equal(
    (await page.locator("#dev-rival-boost").textContent()).trim(),
    "TEST OVERTAKE",
  );
  await page.locator("#dev-rival-boost").click();
  let state = await stateOf(page);
  const fixedPlayerY = state.game.player.y;
  assert.equal(state.game.rival.attack.state, "boost-positioning");
  assert(
    state.game.rival.verticalPressure.leadAboveCow <=
      -RIVAL_JETPACK.overtakeTriggerBelowDistance,
  );
  await page.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-overtake-start-below.png"),
  });

  let result = await pinAndAdvanceUntil(
    page,
    fixedPlayerY,
    ["boost-active"],
    150,
  );
  assert(result.found, "Moonshot never entered its active pass");
  state = result.state;
  await page.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-overtake-active.png"),
  });

  result = await pinAndAdvanceUntil(page, fixedPlayerY, ["idle"], 120);
  assert(result.found, "Moonshot never settled into neutral pressure");
  state = result.state;
  assert.equal(state.game.rival.verticalPressure.relation, "above");
  assert(state.game.rival.stats.overtakes >= 1);
  assert(
    state.game.rival.verticalPressure.postOvertakeHoldRemainingSeconds >= 1,
  );
  const catScreenY = state.game.rival.y - state.game.camera.y;
  assert(catScreenY > 0 && catScreenY < state.game.camera.viewportHeight);
  await page.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-overtake-pressure-above.png"),
  });

  const heldCatY = state.game.rival.verticalPressure.postOvertakeHoldY;
  const skilledCowY = state.game.rival.y - 105;
  const selectionsBeforeWindow = state.game.rival.stats.attackSelections;
  await page.evaluate(
    async ({ skilledCowY, frames }) => {
      for (let frame = 0; frame < frames; frame += 1) {
        window.__OTM.debugSetPlayer({
          x: 270,
          y: skilledCowY,
          vx: 0,
          vy: 0,
          onGround: false,
        });
        await window.advanceTime(1000 / 60);
      }
    },
    { skilledCowY, frames: 36 },
  );
  state = await stateOf(page);
  assert.equal(state.game.rival.attack.state, "idle");
  assert.equal(state.game.rival.stats.attackSelections, selectionsBeforeWindow);
  assert(
    Math.abs(state.game.rival.hoverTarget.y - heldCatY) <= 0.01,
  );
  assert(
    state.game.rival.verticalPressure.postOvertakeHoldRemainingSeconds > 0.35,
  );

  result = await pinAndAdvanceUntil(
    page,
    skilledCowY,
    ["boost-positioning", "boost-telegraph"],
    120,
  );
  assert(result.found, "cat did not re-engage after the skill window");
  state = result.state;
  await page.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-overtake-reengage.png"),
  });

  assert.equal(firebaseWrites, 0);
  assert.deepEqual(errors, []);
  await context.close();
  console.log(
    JSON.stringify(
      {
        phase15_2Browser: {
          build: BUILD_VERSION,
          leadAfterOvertake:
            state.game.rival.verticalPressure.leadAboveCow,
          postOvertakeWindowSeconds:
            RIVAL_JETPACK.postOvertakeHoldSeconds,
          reengageState: state.game.rival.attack.state,
          firebaseWrites,
          errors,
        },
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
