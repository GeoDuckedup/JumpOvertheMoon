import fs from "node:fs";
import path from "node:path";
import { chromium } from "/Users/danemerman/.codex/skills/develop-web-game/node_modules/playwright/index.mjs";

const url =
  process.env.OTM_URL || "http://127.0.0.1:5173/html-remake/";
const outputDirectory = path.resolve(
  "html-remake/test-output/phase9-belly-up-death",
);
fs.mkdirSync(outputDirectory, { recursive: true });

const failures = [];
const browserErrors = [];
const assert = (condition, message) => {
  if (!condition) {
    failures.push(message);
  }
};
const readState = (page) =>
  page.evaluate(() => JSON.parse(window.render_game_to_text()));

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
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
      state.assets?.loaded === 25 &&
      state.assets?.loaded === state.assets?.total &&
      state.assets?.failures?.length === 0
    );
  });
  await page.locator("#start-button").click();
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).mode === "playing",
  );
  await page.evaluate(() => {
    window.__OTM.setManualMode(true);
    window.__OTM.restartRun(0x9110);
  });

  let state = await readState(page);
  assert(
    state.game.player.onGround && state.game.player.pose === "upright",
    "A new run should begin upright on the ground.",
  );

  await page.evaluate(() => {
    window.__OTM.debugPopBalloon("red");
    window.__OTM.debugSetPlayer({
      x: 270,
      y: 620,
      vx: 0,
      vy: 720,
      facing: 1,
      onGround: false,
      slashTimer: 0,
      cooldown: 0,
    });
    window.advanceTime(250);
  });
  state = await readState(page);
  assert(state.mode === "gameover", "The forced fall should end the run.");
  assert(
    state.game.player.onGround,
    "The fatal fall should finish on the ground.",
  );
  assert(
    state.game.player.sprite === "idle" &&
      state.game.player.pose === "belly-up",
    "The grounded game-over state should reuse the idle cow belly-up.",
  );

  const deathScreenshot = path.join(
    outputDirectory,
    "phone-fatal-landing.png",
  );
  await page.locator("#game-stage").screenshot({ path: deathScreenshot });

  await page.locator("#death-retry").click();
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).mode === "playing",
  );
  state = await readState(page);
  assert(
    state.game.player.onGround && state.game.player.pose === "upright",
    "CLIMB AGAIN should restore the upright ground pose.",
  );
  const restartScreenshot = path.join(
    outputDirectory,
    "phone-restarted-upright.png",
  );
  await page.locator("#game-stage").screenshot({ path: restartScreenshot });

  assert(browserErrors.length === 0, browserErrors.join("; "));
  if (failures.length) {
    throw new Error(failures.join("\n"));
  }

  console.log(
    JSON.stringify(
      {
        url,
        fatalLanding: {
          mode: "gameover",
          onGround: true,
          sprite: "idle",
          pose: "belly-up",
        },
        resetPose: "upright",
        screenshots: {
          death: deathScreenshot,
          restart: restartScreenshot,
        },
        browserErrors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
