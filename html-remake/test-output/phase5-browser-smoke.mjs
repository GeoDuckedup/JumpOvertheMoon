import fs from "node:fs";
import path from "node:path";
import { chromium } from "/Users/danemerman/.codex/skills/develop-web-game/node_modules/playwright/index.mjs";

const url =
  process.env.OTM_URL || "http://127.0.0.1:5175/html-remake/";
const outputDirectory = path.resolve(
  "html-remake/test-output/phase5-browser-smoke",
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
  assert(
    state.phase >= 5,
    "The browser state should retain the Phase 5 gameplay foundation.",
  );
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
    window.__OTM.restartRun(0x5a17c0de);
  });

  const routeAudit = await desktop.evaluate(async () => {
    const [{ BalloonRoute }, { GOAL_MARKERS }] = await Promise.all([
      import("./src/route.js"),
      import("./src/game-config.js"),
    ]);
    const auditFailures = [];
    const signatures = new Set();
    const colors = new Set();
    let generatedBalloons = 0;
    let sideBalloons = 0;

    for (let seed = 1; seed <= 240; seed += 1) {
      const route = new BalloonRoute(seed);
      const balloons = route.spawnThrough(-74000);
      const repeated = new BalloonRoute(seed).spawnThrough(-74000);
      const signature = JSON.stringify(
        balloons.slice(0, 18).map(
          ({ x, y, radius, color, routeRole, landmarkApproach }) => [
            x,
            y,
            radius,
            color,
            routeRole,
            landmarkApproach,
          ],
        ),
      );
      signatures.add(signature);
      if (
        signature !==
        JSON.stringify(
          repeated.slice(0, 18).map(
            ({ x, y, radius, color, routeRole, landmarkApproach }) => [
              x,
              y,
              radius,
              color,
              routeRole,
              landmarkApproach,
            ],
          ),
        )
      ) {
        auditFailures.push(`seed ${seed}: deterministic replay mismatch`);
      }

      generatedBalloons += balloons.length;
      for (let index = 0; index < balloons.length; index += 1) {
        const balloon = balloons[index];
        colors.add(balloon.color);
        if (
          balloon.x < balloon.radius + 32 ||
          balloon.x > 540 - balloon.radius - 32
        ) {
          auditFailures.push(`seed ${seed}: unsafe side margin`);
        }
        const bandViolation = GOAL_MARKERS.find(
          (marker) =>
            balloon.y >= marker.clearanceTopY &&
            balloon.y <= marker.clearanceBottomY,
        );
        if (bandViolation) {
          auditFailures.push(
            `seed ${seed}: balloon inside ${bandViolation.name} clearance`,
          );
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

      for (const marker of GOAL_MARKERS) {
        const approaches = balloons.filter(
          (balloon) => balloon.landmarkApproach === marker.id,
        );
        if (approaches.length !== 1) {
          auditFailures.push(
            `seed ${seed}: ${marker.name} has ${approaches.length} approaches`,
          );
          continue;
        }
        const approach = approaches[0];
        if (
          approach.y !== marker.clearanceBottomY + 42 ||
          Math.abs(approach.x - marker.x) > 58
        ) {
          auditFailures.push(
            `seed ${seed}: ${marker.name} approach is misplaced`,
          );
        }
      }
    }

    return {
      seeds: 240,
      uniqueEarlyRoutes: signatures.size,
      generatedBalloons,
      sideBalloons,
      colors: [...colors].sort(),
      failures: auditFailures.slice(0, 30),
    };
  });
  results.routeAudit = routeAudit;
  assert(
    routeAudit.failures.length === 0,
    `Landmark route audit failed: ${routeAudit.failures.join("; ")}`,
  );
  assert(
    routeAudit.uniqueEarlyRoutes === routeAudit.seeds,
    "Every audited seed should retain a unique early route.",
  );
  assert(
    routeAudit.colors.join(",") === "blue,green,red,yellow",
    "The route audit should cover all four balloon colors.",
  );

  const altitudeCases = [
    { name: "sky", height: 10, current: "sky" },
    { name: "plane", height: 380, current: "sky" },
    { name: "high-atmosphere", height: 1400, current: "high-atmosphere" },
    { name: "near-space", height: 2500, current: "near-space" },
    { name: "deep-space", height: 4300, current: "deep-space" },
    { name: "cosmic-space", height: 6500, current: "cosmic-space" },
    { name: "kuiper-belt", height: 7800, current: "kuiper-belt" },
  ];
  results.altitudes = [];
  for (const altitudeCase of altitudeCases) {
    await desktop.evaluate((height) => {
      window.__OTM.debugSetPlayer({
        x: 270,
        y: 660 - height * 10,
        vx: 0,
        vy: 0,
        onGround: false,
      });
    }, altitudeCase.height);
    state = await stateOf(desktop);
    results.altitudes.push({
      name: altitudeCase.name,
      height: state.game.heightMeters,
      background: state.game.background,
      balloonCount: state.game.balloonCount,
      route: state.game.route,
    });
    assert(
      state.game.background.current === altitudeCase.current,
      `${altitudeCase.name} should use its expected background chapter.`,
    );
    assert(
      state.game.balloonCount <= state.game.route.maxActiveBalloons,
      `${altitudeCase.name} should keep the rolling balloon cap.`,
    );
    if (
      ["plane", "near-space", "deep-space", "kuiper-belt"].includes(
        altitudeCase.name,
      )
    ) {
      await desktop.locator("#game-stage").screenshot({
        path: path.join(
          outputDirectory,
          `desktop-${altitudeCase.name}.png`,
        ),
      });
    }
  }
  state = await stateOf(desktop);
  assert(
    state.game.route.goalApproachMarkerIds.length === 8,
    "Climbing past Neptune should generate all eight landmark approaches.",
  );
  assert(
    state.game.culledBalloonCount > 100,
    "The upper-cosmos climb should cull old route balloons.",
  );

  await desktop.evaluate(() => {
    window.__OTM.restartRun(111);
    window.__OTM.debugSetBalloons([]);
    window.__OTM.debugSetGoalMarker("prop-plane", { y: 540 });
    window.__OTM.debugSetPlayer({
      x: 270,
      y: 500,
      vx: 0,
      vy: 0,
      onGround: false,
      slashTimer: 0.1,
      cooldown: 0.1,
    });
  });
  await advanceFrames(desktop, 2);
  state = await stateOf(desktop);
  results.landmarkClear = state;
  const plane = state.game.goalMarkers.find(
    (marker) => marker.id === "prop-plane",
  );
  assert(
    plane.reached && !plane.alive,
    "A downslash through a landmark hitbox should clear it.",
  );
  assert(
    state.game.totalLandmarksCleared === 1 &&
      state.game.player.vy < -1000,
    "A cleared landmark should count and grant the stronger landmark bounce.",
  );
  assert(
    state.game.eventCounts.landmarkClear === 1 &&
      state.audio.playCounts.landmarkClear >= 1,
    "Landmark clear should emit and play its chime.",
  );
  await desktop
    .locator("#game-stage")
    .screenshot({ path: path.join(outputDirectory, "desktop-landmark-clear.png") });

  await desktop.evaluate(() => {
    window.__OTM.restartRun(222);
    window.__OTM.debugSetBalloons([]);
    window.__OTM.debugPopBalloon("red");
  });
  state = await stateOf(desktop);
  assert(
    state.game.combo.streak === 1 &&
      state.game.combo.lastReward === null &&
      Math.abs(state.game.player.vy + 920) < 0.01,
    "The first color hit should begin a streak with the normal bounce.",
  );
  await desktop.evaluate(() => window.__OTM.debugPopBalloon("red"));
  state = await stateOf(desktop);
  assert(
    state.game.combo.streak === 2 &&
      state.game.combo.lastReward === "match!" &&
      Math.abs(state.game.player.vy + 1028.5913) < 0.02,
    "The second same-color hit should grant the 1.25x-height match bounce.",
  );
  await desktop.evaluate(() => window.__OTM.debugPopBalloon("red"));
  state = await stateOf(desktop);
  results.combo = state;
  assert(
    state.game.combo.streak === 3 &&
      state.game.combo.lastReward === "combo!" &&
      Math.abs(state.game.player.vy + 1217.0456) < 0.02,
    "The third same-color hit should grant the 1.75x-height combo bounce.",
  );
  assert(
    state.game.eventCounts.match === 1 &&
      state.game.eventCounts.combo === 1 &&
      state.audio.playCounts.match >= 1 &&
      state.audio.playCounts.combo >= 1,
    "Match and combo rewards should each emit and play their feedback.",
  );
  await desktop
    .locator("#game-stage")
    .screenshot({ path: path.join(outputDirectory, "desktop-combo.png") });
  await desktop.evaluate(() => {
    window.__OTM.debugPopBalloon("red");
    window.__OTM.debugPopBalloon("blue");
  });
  state = await stateOf(desktop);
  assert(
    state.game.combo.color === "blue" &&
      state.game.combo.streak === 1 &&
      state.game.combo.lastReward === null,
    "A different popped color should reset the streak to one.",
  );

  await desktop.evaluate(() => {
    window.__OTM.restartRun(333);
    window.__OTM.debugSetPlayer({
      x: 270,
      y: 660 - 1200 * 10,
      vx: 0,
      vy: 0,
      onGround: false,
    });
    window.__OTM.debugSetFallPeak(1200);
    window.__OTM.debugSetPlayer({
      x: 270,
      y: 660 - 950 * 10,
      vx: 0,
      vy: 800,
      onGround: false,
    });
  });
  await advanceFrames(desktop, 2);
  state = await stateOf(desktop);
  results.reentry = state;
  assert(
    state.game.reentry.active &&
      state.game.reentry.fallDistanceMeters >= 220 &&
      state.game.player.vy >= 700,
    "A high, long, fast fall should latch the light re-entry trail.",
  );
  await desktop
    .locator("#game-stage")
    .screenshot({ path: path.join(outputDirectory, "desktop-reentry.png") });
  await desktop.evaluate(() => {
    window.__OTM.debugSetPlayer({
      vy: -200,
      onGround: false,
    });
  });
  await advanceFrames(desktop, 1);
  state = await stateOf(desktop);
  assert(
    !state.game.reentry.active,
    "Rising again should reset the re-entry trail.",
  );

  await desktop.evaluate(() => window.__OTM.debugFinishRun(321));
  state = await stateOf(desktop);
  assert(state.mode === "gameover", "Phase 5 should retain game over.");
  const previousRunId = state.game.runId;
  await desktop.keyboard.press("r");
  await desktop.waitForFunction(
    (runId) =>
      JSON.parse(window.render_game_to_text()).game.runId > runId,
    previousRunId,
  );
  state = await stateOf(desktop);
  assert(
    state.mode === "playing" &&
      state.game.combo.streak === 0 &&
      state.game.totalLandmarksCleared === 0 &&
      !state.game.reentry.active,
    "Retry should clean every new Phase 5 progression state.",
  );

  await desktop.evaluate(() => window.__OTM.toggleFullscreen());
  await desktop.waitForTimeout(100);
  state = await stateOf(desktop);
  assert(state.layout.fullscreen, "Desktop fullscreen should still enter.");
  await desktop.evaluate(() => window.__OTM.toggleFullscreen());
  await desktop.waitForTimeout(100);
  state = await stateOf(desktop);
  assert(!state.layout.fullscreen, "Desktop fullscreen should still exit.");
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
  await mobile.locator("#fullscreen-button").click();
  assert(
    await mobile.locator("#app-mode-overlay").isVisible(),
    "APP MODE should retain its iPhone guidance.",
  );
  await mobile.locator("#app-mode-close").click();
  await mobile.locator("#start-button").click();
  await mobile.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).mode === "playing",
  );
  await mobile.evaluate(() => {
    window.__OTM.setManualMode(true);
    window.__OTM.debugSetPlayer({
      x: 270,
      y: 660 - 1980 * 10,
      vx: 0,
      vy: 0,
      onGround: false,
    });
  });
  await mobile
    .locator("#game-stage")
    .screenshot({ path: path.join(outputDirectory, "phone-moon.png") });

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
    "Continuous left-to-right touch steering should survive Phase 5.",
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
  await mobile.evaluate(() => window.__OTM.debugFinishRun(77));
  assert(
    (await mobile.locator(".touch-action-label").textContent()) === "RETRY",
    "The phone action button should still become RETRY.",
  );
  await mobile.locator("#touch-action").click();
  await mobile.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).mode === "playing",
  );
  assert(
    (await mobile.locator(".touch-action-label").textContent()) === "JUMP",
    "Touch retry should restore JUMP.",
  );
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
  assert(
    state.display.standalone &&
      (await installed.locator("#fullscreen-button").isHidden()),
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
    state.layout.orientationBlocked &&
      (await landscape.locator("#rotate-overlay").isVisible()),
    "Touch landscape should still request portrait orientation.",
  );
  await landscapeContext.close();

  fs.writeFileSync(
    path.join(outputDirectory, "results.json"),
    JSON.stringify({ failures, results }, null, 2),
  );
} finally {
  await browser.close();
}

if (failures.length) {
  throw new Error(`Phase 5 browser smoke failed:\n- ${failures.join("\n- ")}`);
}

console.log("Phase 5 browser smoke passed.");
