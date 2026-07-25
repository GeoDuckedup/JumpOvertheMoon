import fs from "node:fs";
import path from "node:path";
import { chromium } from "/Users/danemerman/.codex/skills/develop-web-game/node_modules/playwright/index.mjs";

const url = "http://127.0.0.1:5175/html-remake/";
const outputDirectory = path.resolve(
  "html-remake/test-output/phase4-browser-smoke",
);
fs.mkdirSync(outputDirectory, { recursive: true });

const failures = [];
const results = {};
const assert = (condition, message) => {
  if (!condition) {
    failures.push(message);
  }
};

const waitUntilReady = async (page) => {
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() || "{}");
    return state.assets?.loaded === state.assets?.total && state.assets?.total > 0;
  });
};

const stateOf = (page) =>
  page.evaluate(() => JSON.parse(window.render_game_to_text()));

const advanceFrames = (page, count) =>
  page.evaluate(
    async ({ frames, step }) => {
      for (let index = 0; index < frames; index += 1) {
        await window.advanceTime(step);
      }
    },
    { frames: count, step: 1000 / 60 },
  );

const attachErrorCapture = (page, bucket) => {
  page.on("pageerror", (error) => bucket.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      bucket.push(`console: ${message.text()}`);
    }
  });
};

const routeSignature = (state) =>
  state.game.balloons.map(
    ({ x, y, radius, color, routeRole }) =>
      `${routeRole}:${x}:${y}:${radius}:${color}`,
  );

const validateRoute = (state, label) => {
  const balloons = state.game.balloons;
  const main = balloons.filter((balloon) => balloon.routeRole === "main");
  assert(main.length >= 10, `${label} should preload at least 10 main balloons.`);
  assert(
    new Set(balloons.map((balloon) => balloon.color)).size >= 3,
    `${label} should visibly mix the four-color palette.`,
  );
  for (const balloon of balloons) {
    assert(
      ["red", "yellow", "green", "blue"].includes(balloon.color),
      `${label} generated an unsupported color.`,
    );
    assert(
      balloon.x >= balloon.radius + 32 &&
        balloon.x <= 540 - balloon.radius - 32,
      `${label} generated a balloon outside its safe side margins.`,
    );
  }
  for (let index = 1; index < main.length; index += 1) {
    const spacing = main[index - 1].y - main[index].y;
    assert(
      spacing >= 115 && spacing <= 179,
      `${label} main-route vertical spacing left the 115-179 range.`,
    );
    assert(
      Math.abs(main[index].x - main[index - 1].x) <= 160,
      `${label} main-route horizontal drift exceeded its bounded allowance.`,
    );
  }
};

const browser = await chromium.launch({ headless: true });
try {
  const desktopErrors = [];
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const desktop = await desktopContext.newPage();
  attachErrorCapture(desktop, desktopErrors);
  await desktop.goto(url, { waitUntil: "networkidle" });
  await waitUntilReady(desktop);
  await desktop.evaluate(() => localStorage.clear());
  await desktop.reload({ waitUntil: "networkidle" });
  await waitUntilReady(desktop);

  let state = await stateOf(desktop);
  assert(state.phase === 4, "The browser state should identify Phase 4.");
  assert(state.mode === "menu", "Desktop should begin at the menu.");
  assert(
    state.layout.desktopFramed && state.layout.stageCss.width <= 500,
    "Desktop should remain framed at no more than 500 CSS pixels wide.",
  );
  await desktop.locator("#start-button").click();
  await desktop.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).mode === "playing",
  );
  await desktop.evaluate(() => {
    window.__OTM.setManualMode(true);
    window.__OTM.restartRun(0x12345678);
  });

  state = await stateOf(desktop);
  const routeAudit = await desktop.evaluate(async () => {
    const { BalloonRoute } = await import("./src/route.js");
    const auditFailures = [];
    const signatures = new Set();
    const colors = new Set();
    let generatedBalloons = 0;
    let sideBalloons = 0;

    for (let seed = 1; seed <= 400; seed += 1) {
      const route = new BalloonRoute(seed);
      const balloons = route.spawnThrough(-10000);
      const repeated = new BalloonRoute(seed).spawnThrough(-10000);
      const signature = JSON.stringify(
        balloons.slice(0, 16).map(({ x, y, radius, color, routeRole }) => [
          x,
          y,
          radius,
          color,
          routeRole,
        ]),
      );
      signatures.add(signature);
      if (
        signature !==
        JSON.stringify(
          repeated
            .slice(0, 16)
            .map(({ x, y, radius, color, routeRole }) => [
              x,
              y,
              radius,
              color,
              routeRole,
            ]),
        )
      ) {
        auditFailures.push(`seed ${seed}: repeat mismatch`);
      }

      generatedBalloons += balloons.length;
      const main = balloons.filter((balloon) => balloon.routeRole === "main");
      for (let index = 0; index < balloons.length; index += 1) {
        const balloon = balloons[index];
        colors.add(balloon.color);
        if (
          balloon.x < balloon.radius + 32 ||
          balloon.x > 540 - balloon.radius - 32
        ) {
          auditFailures.push(`seed ${seed}: unsafe side margin`);
        }
        if (balloon.routeRole === "side") {
          sideBalloons += 1;
          const parent = balloons[index - 1];
          if (
            !parent ||
            parent.routeRole !== "main" ||
            Math.abs(balloon.y - parent.y) > 46 ||
            Math.abs(balloon.x - parent.x) < 97.5
          ) {
            auditFailures.push(`seed ${seed}: invalid side balloon`);
          }
        }
      }
      for (let index = 1; index < main.length; index += 1) {
        const spacing = main[index - 1].y - main[index].y;
        if (
          spacing < 115 ||
          spacing > 179 ||
          Math.abs(main[index].x - main[index - 1].x) > 160
        ) {
          auditFailures.push(`seed ${seed}: unsafe main step`);
        }
      }
    }

    return {
      seeds: 400,
      uniqueEarlyRoutes: signatures.size,
      generatedBalloons,
      sideBalloons,
      colors: [...colors].sort(),
      failures: auditFailures.slice(0, 20),
    };
  });
  results.routeAudit = routeAudit;
  assert(
    routeAudit.failures.length === 0,
    `400-seed route audit failed: ${routeAudit.failures.join("; ")}`,
  );
  assert(
    routeAudit.uniqueEarlyRoutes === routeAudit.seeds,
    "Every audited seed should have a unique early route.",
  );
  assert(
    routeAudit.colors.join(",") === "blue,green,red,yellow",
    "The route audit should cover all four balloon colors.",
  );
  validateRoute(state, "Seeded desktop route");
  const firstSignature = routeSignature(state);
  assert(
    state.game.balloonCount <= state.game.route.maxActiveBalloons,
    "Initial route should respect the active-balloon cap.",
  );
  assert(
    state.game.floorRule === "safe-before-first-pop",
    "The floor should remain safe before the first pop.",
  );

  await desktop.evaluate(() => window.__OTM.restartRun(0x12345678));
  const repeatedState = await stateOf(desktop);
  assert(
    JSON.stringify(firstSignature) ===
      JSON.stringify(routeSignature(repeatedState)),
    "Repeating a seed should reproduce the same route.",
  );
  await desktop.evaluate(() => window.__OTM.restartRun(0x87654321));
  const alternateState = await stateOf(desktop);
  assert(
    JSON.stringify(firstSignature) !==
      JSON.stringify(routeSignature(alternateState)),
    "A different seed should produce a different route.",
  );

  await desktop.evaluate(() => {
    window.__OTM.debugSetPlayer({
      x: 270,
      y: -20000,
      vx: 0,
      vy: 0,
      onGround: false,
    });
  });
  await advanceFrames(desktop, 1);
  state = await stateOf(desktop);
  results.highRoute = state;
  validateRoute(state, "High-altitude rolling route");
  assert(
    state.game.balloonCount <= state.game.route.maxActiveBalloons,
    "The rolling route should remain bounded after a long climb.",
  );
  assert(
    state.game.culledBalloonCount > 100,
    "A long climb should cull balloons far behind the camera.",
  );
  await desktop
    .locator("#game-stage")
    .screenshot({ path: path.join(outputDirectory, "desktop-high-route.png") });

  await desktop.evaluate(() => {
    window.__OTM.restartRun(2468);
    window.__OTM.debugSetPlayer({
      x: 270,
      y: 630,
      vx: 0,
      vy: 300,
      onGround: false,
    });
  });
  await advanceFrames(desktop, 12);
  state = await stateOf(desktop);
  assert(
    state.mode === "playing" && state.game.player.onGround,
    "Landing on the floor before a pop should not end the run.",
  );

  await desktop.evaluate(() => {
    window.__OTM.restartRun(1357);
    window.__OTM.debugResetBalloon({
      x: 330,
      y: 520,
      radius: 43,
      color: "blue",
    });
  });
  await desktop.keyboard.press("Space");
  await advanceFrames(desktop, 8);
  await desktop.keyboard.press("Space");
  await advanceFrames(desktop, 4);
  state = await stateOf(desktop);
  assert(
    state.game.totalPopped === 1 && state.game.hasPoppedBalloon,
    "A valid downslash should pop one balloon and arm the fatal-floor rule.",
  );
  assert(
    state.game.floorRule === "fatal-after-first-pop",
    "The floor rule should switch immediately after the first pop.",
  );
  assert(
    state.game.eventCounts.balloonPop === 1 &&
      state.audio.playCounts.balloonPop >= 1,
    "The accepted recorded balloon pop should still play once per hit.",
  );

  await desktop.evaluate(() => {
    window.__OTM.debugSetPlayer({
      x: 330,
      y: 630,
      vx: 0,
      vy: 420,
      onGround: false,
    });
  });
  await advanceFrames(desktop, 12);
  state = await stateOf(desktop);
  results.desktopGameOver = state;
  fs.writeFileSync(
    path.join(outputDirectory, "desktop-game-over-state.json"),
    JSON.stringify(state, null, 2),
  );
  assert(state.mode === "gameover", "Returning to the floor should end the run.");
  assert(
    state.game.eventCounts.gameOver === 1 &&
      state.audio.playCounts.gameOver >= 1,
    "Game over should emit and play exactly once.",
  );
  assert(
    state.game.savedBestHeightMeters === state.game.finalScoreMeters,
    "The first completed run should save its height locally.",
  );
  assert(state.game.newBest, "The first completed run should be a new local best.");
  assert(
    await desktop.locator("#start-overlay").isHidden(),
    "The start card should stay hidden on the game-over screen.",
  );
  await desktop
    .locator("#game-stage")
    .screenshot({ path: path.join(outputDirectory, "desktop-game-over.png") });

  const previousRunId = state.game.runId;
  const previousSeed = state.game.runSeed;
  await desktop.keyboard.press("r");
  await desktop.waitForFunction(
    (runId) =>
      JSON.parse(window.render_game_to_text()).game.runId > runId,
    previousRunId,
  );
  state = await stateOf(desktop);
  assert(state.mode === "playing", "R should restart from game over.");
  assert(
    state.game.runSeed !== previousSeed,
    "A normal retry should produce a fresh route seed.",
  );
  assert(
    state.game.savedBestHeightMeters > 0,
    "The local best should survive a retry.",
  );
  assert(
    state.audio.playCounts.retry >= 1,
    "Retry should play its own short feedback sound.",
  );

  await desktop.reload({ waitUntil: "networkidle" });
  await waitUntilReady(desktop);
  state = await stateOf(desktop);
  assert(
    state.game.savedBestHeightMeters > 0,
    "The local best should survive a page reload.",
  );
  await desktop.locator("#start-button").click();
  await desktop.evaluate(() => window.__OTM.toggleFullscreen());
  await desktop.waitForTimeout(100);
  state = await stateOf(desktop);
  assert(
    state.layout.fullscreen && state.display.fullscreenSupported,
    "Desktop fullscreen should still enter during Phase 4.",
  );
  await desktop.evaluate(() => window.__OTM.toggleFullscreen());
  await desktop.waitForTimeout(100);
  state = await stateOf(desktop);
  assert(!state.layout.fullscreen, "Desktop fullscreen should exit cleanly.");
  assert(
    desktopErrors.length === 0,
    `Desktop errors: ${desktopErrors.join("; ")}`,
  );
  await desktopContext.close();

  const mobileErrors = [];
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 3,
  });
  const mobile = await mobileContext.newPage();
  attachErrorCapture(mobile, mobileErrors);
  await mobile.goto(url, { waitUntil: "networkidle" });
  await waitUntilReady(mobile);
  state = await stateOf(mobile);
  assert(
    state.layout.stageCss.width === 390 && state.layout.stageCss.height === 844,
    "Phone play should continue to fill the viewport.",
  );
  assert(
    state.display.appModeGuidance,
    "iPhone should retain Add-to-Home-Screen guidance.",
  );
  await mobile.locator("#fullscreen-button").click();
  assert(
    await mobile.locator("#app-mode-overlay").isVisible(),
    "APP MODE should open the iPhone full-screen guidance.",
  );
  await mobile.locator("#app-mode-close").click();
  assert(
    await mobile.locator("#app-mode-overlay").isHidden(),
    "APP MODE guidance should close cleanly.",
  );

  await mobile.locator("#start-button").click();
  await mobile.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).mode === "playing",
  );
  await mobile.evaluate(() => {
    window.__OTM.setManualMode(true);
    window.__OTM.debugFinishRun(42);
  });
  state = await stateOf(mobile);
  assert(state.mode === "gameover", "The phone should render game over.");
  assert(
    state.touchControlsVisible &&
      (await mobile.locator(".touch-action-label").textContent()) === "RETRY",
    "The phone action button should become RETRY on game over.",
  );
  await mobile
    .locator("#game-stage")
    .screenshot({ path: path.join(outputDirectory, "phone-game-over.png") });

  await mobile.locator("#touch-action").click();
  await mobile.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).mode === "playing",
  );
  state = await stateOf(mobile);
  assert(
    (await mobile.locator(".touch-action-label").textContent()) === "JUMP",
    "Touch retry should begin a fresh run and restore JUMP.",
  );

  const directionCenters = await mobile.evaluate(() => {
    const left = document.querySelector("#touch-left").getBoundingClientRect();
    const right = document.querySelector("#touch-right").getBoundingClientRect();
    return {
      left: {
        x: left.left + left.width / 2,
        y: left.top + left.height / 2,
      },
      right: {
        x: right.left + right.width / 2,
        y: right.top + right.height / 2,
      },
    };
  });
  await mobile.locator("#touch-left").dispatchEvent("pointerdown", {
    pointerId: 91,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: directionCenters.left.x,
    clientY: directionCenters.left.y,
  });
  await mobile.locator("#touch-left").dispatchEvent("pointermove", {
    pointerId: 91,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: directionCenters.right.x,
    clientY: directionCenters.right.y,
  });
  state = await stateOf(mobile);
  assert(
    state.input.direction === 1 &&
      (await mobile.locator("#touch-right").getAttribute("data-pressed")) ===
        "true",
    "Left-to-right directional swiping should survive Phase 4.",
  );
  await mobile.locator("#touch-left").dispatchEvent("pointerup", {
    pointerId: 91,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    buttons: 0,
    clientX: directionCenters.right.x,
    clientY: directionCenters.right.y,
  });
  assert(
    mobileErrors.length === 0,
    `Mobile errors: ${mobileErrors.join("; ")}`,
  );
  await mobileContext.close();

  const installedContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
    hasTouch: true,
    isMobile: true,
  });
  await installedContext.addInitScript(() => {
    Object.defineProperty(navigator, "standalone", {
      configurable: true,
      get: () => true,
    });
  });
  const installed = await installedContext.newPage();
  await installed.goto(url, { waitUntil: "networkidle" });
  await waitUntilReady(installed);
  state = await stateOf(installed);
  assert(state.display.standalone, "Installed iPhone mode should be detected.");
  assert(
    await installed.locator("#fullscreen-button").isHidden(),
    "Installed iPhone mode should hide APP MODE.",
  );
  await installedContext.close();

  const landscapeContext = await browser.newContext({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
  });
  const landscape = await landscapeContext.newPage();
  await landscape.goto(url, { waitUntil: "networkidle" });
  await waitUntilReady(landscape);
  state = await stateOf(landscape);
  assert(
    state.layout.orientationBlocked,
    "Touch landscape should remain blocked in favor of portrait play.",
  );
  assert(
    await landscape.locator("#rotate-overlay").isVisible(),
    "The touch-landscape rotate overlay should remain visible.",
  );
  await landscapeContext.close();

  const viewportCases = [
    { name: "compact-phone", width: 375, height: 667, touch: true },
    { name: "tall-phone", width: 430, height: 932, touch: true },
    { name: "tablet", width: 768, height: 1024, touch: true },
  ];
  results.viewportMatrix = [];
  for (const viewportCase of viewportCases) {
    const context = await browser.newContext({
      viewport: {
        width: viewportCase.width,
        height: viewportCase.height,
      },
      hasTouch: viewportCase.touch,
      isMobile: viewportCase.touch,
    });
    const page = await context.newPage();
    const caseErrors = [];
    attachErrorCapture(page, caseErrors);
    await page.goto(url, { waitUntil: "networkidle" });
    await waitUntilReady(page);
    const caseState = await stateOf(page);
    results.viewportMatrix.push({
      name: viewportCase.name,
      layout: caseState.layout,
      errors: caseErrors,
    });
    assert(
      caseState.layout.stageCss.width === viewportCase.width &&
        caseState.layout.stageCss.height === viewportCase.height,
      `${viewportCase.name} should fill its touch viewport.`,
    );
    assert(
      caseErrors.length === 0,
      `${viewportCase.name} errors: ${caseErrors.join("; ")}`,
    );
    await context.close();
  }

  fs.writeFileSync(
    path.join(outputDirectory, "results.json"),
    JSON.stringify({ failures, results }, null, 2),
  );
} finally {
  await browser.close();
}

if (failures.length) {
  throw new Error(`Phase 4 browser smoke failed:\n- ${failures.join("\n- ")}`);
}

console.log("Phase 4 browser smoke passed.");
