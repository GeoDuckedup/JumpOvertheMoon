import fs from "node:fs";
import path from "node:path";
import { chromium } from "/Users/danemerman/.codex/skills/develop-web-game/node_modules/playwright/index.mjs";

const url =
  process.env.OTM_URL || "http://127.0.0.1:5173/html-remake/";
const outputDirectory = path.resolve(
  "html-remake/test-output/phase9-presentation-polish",
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

  let state = await readState(page);
  assert(
    state.display.appModeGuidance,
    "The iPhone splash should offer App Mode guidance.",
  );
  assert(
    await page.locator("#fullscreen-button").isVisible(),
    "APP MODE should remain visible on the start splash.",
  );
  await page.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-splash.png"),
  });

  await page.locator("#start-button").click();
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).mode === "playing",
  );
  await page.evaluate(() => {
    window.__OTM.setManualMode(true);
    window.__OTM.restartRun(0x9100);
    const ctx = document.querySelector("#game-canvas").getContext("2d");
    const originalFillText = ctx.fillText.bind(ctx);
    window.__OTM_CAPTURED_TEXT = [];
    ctx.fillText = (text, ...args) => {
      window.__OTM_CAPTURED_TEXT.push(String(text));
      return originalFillText(text, ...args);
    };
  });

  assert(
    await page.locator("#fullscreen-button").isHidden(),
    "APP MODE should leave the live play UI after the climb begins.",
  );
  assert(
    await page.locator("#sound-button").isVisible(),
    "The sound control should remain available during play.",
  );

  const firstPopText = await page.evaluate(() => {
    window.__OTM_CAPTURED_TEXT.length = 0;
    window.__OTM.debugPopBalloon("blue");
    return [...window.__OTM_CAPTURED_TEXT];
  });
  assert(
    !firstPopText.some((text) => text.includes("POP")),
    "The live HUD should not show the run's total pop count.",
  );
  assert(
    !firstPopText.some((text) => text.includes("BLUE")),
    "A one-hit color streak should not create a persistent HUD badge.",
  );

  const matchText = await page.evaluate(() => {
    window.__OTM_CAPTURED_TEXT.length = 0;
    window.__OTM.debugPopBalloon("blue");
    return [...window.__OTM_CAPTURED_TEXT];
  });
  assert(
    matchText.includes("BLUE 2/3 · MATCH"),
    "The second matching pop should reveal the live MATCH badge.",
  );
  assert(
    !matchText.some((text) => text.includes("POP")),
    "The pop total should remain absent when the MATCH badge appears.",
  );
  await page.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-live-match.png"),
  });

  const backgroundCaptures = [];
  for (const [heightMeters, filename] of [
    [9883, "phone-heliopause-transition-9883.png"],
    [17974, "phone-black-hole-region-17974.png"],
  ]) {
    await page.evaluate((height) => {
      window.__OTM.debugSetCombo(null, 0);
      window.__OTM.debugSetPlayer({
        x: 270,
        y: 660 - height * 10,
        vx: 0,
        vy: 0,
        onGround: false,
      });
    }, heightMeters);
    state = await readState(page);
    const renderedHeightMeters = state.game.heightMeters;
    const dominantBackground = state.game.background.dominant;
    const motifs = state.game.background.motifs;
    const screenshot = path.join(outputDirectory, filename);
    await page.locator("#game-stage").screenshot({ path: screenshot });

    const benchmark = await page.evaluate(() => {
      const before = performance.now();
      for (let frame = 0; frame < 120; frame += 1) {
        window.__OTM.debugSetCombo(null, 0);
      }
      return (performance.now() - before) / 120;
    });
    assert(
      benchmark < 20,
      `${heightMeters} m averaged ${benchmark.toFixed(2)} ms per deterministic frame.`,
    );
    backgroundCaptures.push({
      requestedHeightMeters: heightMeters,
      renderedHeightMeters,
      dominantBackground,
      motifs,
      averageDeterministicFrameMs: Number(benchmark.toFixed(3)),
      screenshot,
    });
  }

  const deathText = await page.evaluate(() => {
    window.__OTM_CAPTURED_TEXT.length = 0;
    window.__OTM.debugFinishRun(17974);
    return [...window.__OTM_CAPTURED_TEXT];
  });
  state = await readState(page);
  assert(state.mode === "gameover", "The death summary should open.");
  assert(
    deathText.includes("BALLOONS POPPED") &&
      deathText.includes("BEST COLOR STREAK") &&
      deathText.includes("FLIGHT TIME"),
    "The death card should retain its three approved run statistics.",
  );
  assert(
    !deathText.some((text) => text.includes("LANDMARK")),
    "The death card should not render landmark progress.",
  );
  assert(
    await page.locator("#fullscreen-button").isHidden(),
    "APP MODE should remain hidden on the death summary.",
  );
  await page.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-death-summary.png"),
  });

  assert(browserErrors.length === 0, browserErrors.join("; "));
  if (failures.length) {
    throw new Error(failures.join("\n"));
  }

  console.log(
    JSON.stringify(
      {
        url,
        appModeSplashOnly: true,
        firstPopHudText: firstPopText,
        matchHudText: matchText,
        backgroundCaptures,
        deathCardText: deathText,
        browserErrors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
