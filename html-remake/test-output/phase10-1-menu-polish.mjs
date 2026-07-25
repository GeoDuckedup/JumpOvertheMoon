import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const playwrightModule =
  process.env.PLAYWRIGHT_MODULE ||
  path.join(
    os.homedir(),
    ".codex",
    "skills",
    "develop-web-game",
    "node_modules",
    "playwright",
    "index.mjs",
  );
const { chromium } = await import(pathToFileURL(playwrightModule).href);

const baseUrl =
  process.env.OTM_URL || "http://127.0.0.1:5173/html-remake/";
const outputDirectory = path.resolve(
  "html-remake/test-output/phase10-1-menu-polish",
);
fs.mkdirSync(outputDirectory, { recursive: true });

const failures = [];
const browserErrors = [];
const assert = (condition, message) => {
  if (!condition) {
    failures.push(message);
  }
};
const stateOf = (page) =>
  page.evaluate(() => JSON.parse(window.render_game_to_text()));
const waitForReady = (page) =>
  page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() || "{}");
    return (
      state.release?.version === "10.1.0" &&
      state.assets?.loaded === 25 &&
      state.assets?.loaded === state.assets?.total &&
      state.assets?.failures?.length === 0
    );
  });
const listenForErrors = (page) => {
  page.on("pageerror", (error) =>
    browserErrors.push(`pageerror: ${error.message}`),
  );
  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(`console: ${message.text()}`);
    }
  });
};

const browser = await chromium.launch({ headless: true });
const captures = {};
let groundClearance = null;
let birdState = null;

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
  listenForErrors(page);

  const publicUrl = new URL(baseUrl);
  publicUrl.searchParams.set("dev", "0");
  await page.goto(publicUrl.href, { waitUntil: "networkidle" });
  await waitForReady(page);

  const menuText = (await page.locator(".start-card").innerText())
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  assert(
    JSON.stringify(menuText) ===
      JSON.stringify(["OVER THE MOON", "HOW TO PLAY", "LEADERBOARD"]),
    "The public splash should contain only the three approved menu buttons.",
  );
  assert(
    (await page.locator("#sound-button").isVisible()) &&
      (await page.locator("#fullscreen-button").isHidden()) &&
      (await page.locator("#dev-button").isHidden()),
    "The public splash should show only the sound utility control.",
  );
  assert(
    (await page.locator(".start-kicker").count()) === 0 &&
      (await page.locator("#start-instructions").count()) === 0,
    "The splash should not include phase copy or inline instructions.",
  );
  captures.splash = path.join(outputDirectory, "phone-clean-splash.png");
  await page.screenshot({ path: captures.splash, fullPage: true });

  await page.locator("#how-to-play-button").click();
  await page.waitForFunction(
    () =>
      JSON.parse(window.render_game_to_text()).menu?.view ===
      "how-to-play",
  );
  let state = await stateOf(page);
  assert(
    state.menu.howToPlayVisible &&
      (await page.locator("#how-to-play-overlay").isVisible()) &&
      (await page.locator(".how-to-play-row").count()) === 4,
    "HOW TO PLAY should open the four-part instruction dialog.",
  );
  const howToBox = await page.locator(".how-to-play-card").boundingBox();
  assert(
    howToBox &&
      howToBox.y >= 0 &&
      howToBox.y + howToBox.height <= 844,
    "The How to Play card should fit inside the phone viewport.",
  );
  captures.howToPlay = path.join(
    outputDirectory,
    "phone-how-to-play.png",
  );
  await page.screenshot({ path: captures.howToPlay, fullPage: true });
  await page.locator("#how-to-play-back").click();
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).menu?.view === "main",
  );
  assert(
    (await stateOf(page)).menu.mainVisible,
    "BACK should return from How to Play to the main menu.",
  );

  await page.locator("#menu-leaderboard-button").click();
  await page.waitForFunction(
    () =>
      JSON.parse(window.render_game_to_text()).menu?.view ===
      "leaderboard",
  );
  state = await stateOf(page);
  assert(
    state.menu.leaderboardVisible &&
      (await page.locator("#leaderboard-panel").isVisible()) &&
      (await page.locator("#leaderboard-entry").isHidden()) &&
      (await page.locator("#leaderboard-retry").isHidden()) &&
      (await page.locator("#leaderboard-back").textContent()).trim() ===
        "BACK TO MENU",
    "The menu leaderboard should be read-only with one route back.",
  );
  captures.leaderboard = path.join(
    outputDirectory,
    "phone-menu-leaderboard.png",
  );
  await page.screenshot({ path: captures.leaderboard, fullPage: true });
  await page.locator("#leaderboard-back").click();
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).menu?.view === "main",
  );
  assert(
    (await stateOf(page)).menu.mainVisible,
    "The menu leaderboard should return to the main splash.",
  );

  await page.locator("#start-button").click();
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).mode === "playing",
  );
  state = await stateOf(page);
  const stageBox = await page.locator("#game-stage").boundingBox();
  const controlBoxes = await Promise.all([
    page.locator("#touch-left").boundingBox(),
    page.locator("#touch-right").boundingBox(),
    page.locator("#touch-action").boundingBox(),
  ]);
  const controlTop = Math.min(
    ...controlBoxes.filter(Boolean).map((box) => box.y),
  );
  const logicalScale = stageBox.width / state.layout.logical.width;
  const cowVisualBottom =
    stageBox.y +
    (state.game.player.y -
      state.game.camera.y +
      2 +
      104 * 0.5) *
      logicalScale;
  const grassY =
    stageBox.y +
    (660 - state.game.camera.y) * logicalScale;
  groundClearance = {
    floorMargin: state.game.camera.floorMargin,
    grassY: Number(grassY.toFixed(2)),
    cowVisualBottom: Number(cowVisualBottom.toFixed(2)),
    controlTop: Number(controlTop.toFixed(2)),
    cowControlGap: Number((controlTop - cowVisualBottom).toFixed(2)),
  };
  assert(
    state.game.camera.floorMargin === 230,
    "The coarse phone layout should use the raised-ground camera margin.",
  );
  assert(
    controlTop - cowVisualBottom >= 20,
    "The grounded cow should clear the touch controls by at least 20 CSS pixels.",
  );
  assert(
    grassY < controlTop,
    "The grass line should sit above the touch-control row.",
  );
  captures.ground = path.join(
    outputDirectory,
    "phone-raised-ground.png",
  );
  await page.screenshot({ path: captures.ground, fullPage: true });

  const devUrl = new URL(baseUrl);
  devUrl.searchParams.set("dev", "1");
  await page.goto(devUrl.href, { waitUntil: "networkidle" });
  await waitForReady(page);
  await page.locator("#start-button").click();
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).mode === "playing",
  );
  birdState = await page.evaluate(() => {
    window.__OTM.setManualMode(true);
    window.__OTM.restartRun(0x101b1);
    window.__OTM.debugSpawnAmbientFlyby("bird");
    let active = window.__OTM.getState().game.ambientFlyby.active;
    for (let step = 0; step < 100; step += 1) {
      window.advanceTime(50);
      active = window.__OTM.getState().game.ambientFlyby.active;
      if (
        active &&
        active.x > 130 &&
        active.x < 410 &&
        Math.abs(active.wing) > 0.8
      ) {
        break;
      }
    }
    return active;
  });
  assert(
    birdState &&
      birdState.scale >= 0.7 &&
      birdState.scale <= 0.84 &&
      birdState.flapRate >= 4.2 &&
      birdState.flapRate <= 5,
    "The revised bird should use the smaller scale and faster wingbeat range.",
  );
  captures.bird = path.join(
    outputDirectory,
    "phone-smaller-white-bird.png",
  );
  await page.screenshot({ path: captures.bird, fullPage: true });

  assert(browserErrors.length === 0, browserErrors.join("; "));
  if (failures.length) {
    throw new Error(failures.join("\n"));
  }

  console.log(
    JSON.stringify(
      {
        url: publicUrl.href,
        menuText,
        groundClearance,
        bird: birdState
          ? {
              scale: birdState.scale,
              flapRate: birdState.flapRate,
              wing: birdState.wing,
              progress: birdState.progress,
            }
          : null,
        captures,
        browserErrors,
      },
      null,
      2,
    ),
  );
  await context.close();
} finally {
  await browser.close();
}
