import fs from "node:fs";
import path from "node:path";
import { chromium } from "/Users/danemerman/.codex/skills/develop-web-game/node_modules/playwright/index.mjs";

const url =
  process.env.OTM_URL || "http://127.0.0.1:5174/html-remake/";
const outputDirectory = path.resolve(
  "html-remake/test-output/phase9-browser-smoke",
);
fs.mkdirSync(outputDirectory, { recursive: true });

const chapterCases = [
  {
    id: "kuiper-belt",
    landmarkId: "pluto",
    motif: "kuiper",
  },
  {
    id: "heliopause",
    landmarkId: "heliopause",
    motif: "heliopause",
  },
  {
    id: "interstellar",
    landmarkId: "voyager-1",
    motif: "interstellar",
  },
  {
    id: "proxima-region",
    landmarkId: "proxima-centauri",
    motif: "proxima",
  },
  {
    id: "black-hole-region",
    landmarkId: "black-hole",
    motif: "gravity",
  },
];

const transitionCases = [
  [10000, "kuiper", "heliopause"],
  [12450, "heliopause", "interstellar"],
  [15450, "interstellar", "proxima"],
  [17500, "proxima", "gravity"],
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
      state.assets?.total === 25 &&
      state.assets?.failures?.length === 0
    );
  });
  await page.locator("#start-button").click();
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).mode === "playing",
  );
  await page.evaluate(() => {
    window.__OTM.setManualMode(true);
    window.__OTM.restartRun(0x9009);
  });

  let state = await page.evaluate(() =>
    JSON.parse(window.render_game_to_text()),
  );
  assert(
    state.phase >= 9,
    "The live build should retain the Phase 9 chapter foundation.",
  );
  assert(
    state.game.phaseNine?.upperCosmosChaptersImplemented &&
      state.game.phaseNine?.chapters?.length === 5,
    "Phase 9 should expose all five upper-cosmos chapters.",
  );
  assert(
    state.layout.stageCss.width === 390 &&
      state.layout.stageCss.height === 844 &&
      !state.layout.desktopFramed,
    "The Phase 9 phone stage should still fill 390 × 844.",
  );

  const captures = [];
  for (const chapterCase of chapterCases) {
    const result = await page.evaluate((landmarkId) => {
      const marker = window.__OTM.debugJumpToLandmark(landmarkId);
      window.advanceTime(1000 / 60);
      return marker;
    }, chapterCase.landmarkId);
    state = await page.evaluate(() =>
      JSON.parse(window.render_game_to_text()),
    );
    assert(
      state.game.background.dominant === chapterCase.id,
      `${chapterCase.landmarkId} should use ${chapterCase.id}.`,
    );
    assert(
      state.game.background.motifs[chapterCase.motif] >= 0.99,
      `${chapterCase.id} should render its full ${chapterCase.motif} motif.`,
    );
    assert(
      state.audio.adaptiveAmbience.chapter.dominant === chapterCase.id,
      `${chapterCase.id} should use its matching ambience profile.`,
    );
    assert(
      state.game.balloonCount <= state.game.route.maxActiveBalloons,
      `${chapterCase.id} should preserve the bounded active route.`,
    );

    const screenshot = path.join(
      outputDirectory,
      `phone-${chapterCase.id}.png`,
    );
    await page.locator("#game-stage").screenshot({ path: screenshot });

    const renderBenchmark = await page.evaluate(() => {
      const before = performance.now();
      for (let frame = 0; frame < 90; frame += 1) {
        window.advanceTime(1000 / 60);
      }
      return (performance.now() - before) / 90;
    });
    assert(
      renderBenchmark < 20,
      `${chapterCase.id} averaged ${renderBenchmark.toFixed(2)} ms per deterministic frame.`,
    );

    captures.push({
      id: chapterCase.id,
      landmarkId: chapterCase.landmarkId,
      heightMeters: result.heightMeters,
      screenshot,
      averageDeterministicFrameMs: Number(renderBenchmark.toFixed(3)),
      ambience: state.audio.adaptiveAmbience.chapter,
    });
  }

  const transitions = [];
  for (const [heightMeters, from, to] of transitionCases) {
    await page.evaluate((height) => {
      window.__OTM.debugSetPlayer({
        x: 270,
        y: 660 - height * 10,
        vx: 0,
        vy: 0,
        onGround: false,
      });
      window.advanceTime(1000 / 60);
    }, heightMeters);
    state = await page.evaluate(() =>
      JSON.parse(window.render_game_to_text()),
    );
    assert(
      state.game.background.motifs[from] > 0.4 &&
        state.game.background.motifs[from] < 0.6 &&
        state.game.background.motifs[to] > 0.4 &&
        state.game.background.motifs[to] < 0.6,
      `${heightMeters} m should remain a smooth ${from}/${to} crossfade.`,
    );
    transitions.push({
      heightMeters,
      background: state.game.background,
      ambience: state.audio.adaptiveAmbience.chapter,
    });
  }

  assert(browserErrors.length === 0, browserErrors.join("; "));
  if (failures.length) {
    throw new Error(failures.join("\n"));
  }

  console.log(
    JSON.stringify(
      {
        url,
        phase: state.phase,
        chapterCount: state.game.phaseNine.chapters.length,
        captures,
        transitions,
        phoneFillVerified: true,
        assetCount: state.assets.total,
        browserErrors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
