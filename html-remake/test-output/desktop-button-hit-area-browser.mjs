import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { BUILD_VERSION } from "../src/config.js";

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

const appUrl = process.env.OTM_URL || "http://127.0.0.1:5201/html-remake/";
const outputDirectory = path.resolve(
  process.env.OTM_OUTPUT ||
    "html-remake/test-output/desktop-button-hit-area",
);
fs.mkdirSync(outputDirectory, { recursive: true });

const failures = [];
const browserErrors = [];
const checks = [];
const assert = (condition, message) => {
  if (!condition) {
    failures.push(message);
  }
};
const stateOf = (page) =>
  page.evaluate(() => JSON.parse(window.render_game_to_text()));
const waitForReady = (page) =>
  page.waitForFunction(
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

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1000, height: 800 },
  screen: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  isMobile: false,
  hasTouch: false,
});
const page = await context.newPage();
page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") {
    browserErrors.push(`console: ${message.text()}`);
  }
});

const pointFor = (selector, area = "text") =>
  page.locator(selector).evaluate((element, requestedArea) => {
    const bounds = element.getBoundingClientRect();
    let x = bounds.left + bounds.width / 2;
    let y = bounds.top + bounds.height / 2;
    if (requestedArea === "edge") {
      x = bounds.left + 12;
    } else if (requestedArea === "text") {
      const range = document.createRange();
      range.selectNodeContents(element);
      const textBounds = range.getBoundingClientRect();
      if (textBounds.width && textBounds.height) {
        x = textBounds.left + textBounds.width / 2;
        y = textBounds.top + textBounds.height / 2;
      }
    }
    const hit = document.elementFromPoint(x, y);
    return {
      x,
      y,
      hitId: hit?.id || null,
      hitTag: hit?.tagName || null,
      buttonId: hit?.closest?.("button")?.id || null,
    };
  }, area);

const clickAndCheck = async ({
  selector,
  area = "text",
  label,
  predicate,
}) => {
  const point = await pointFor(selector, area);
  const expectedButtonId = selector.startsWith("#") ? selector.slice(1) : null;
  assert(
    point.hitTag === "BUTTON" && point.hitId === expectedButtonId,
    `${label} ${area} point hit ${point.hitTag || "nothing"}#${point.hitId || ""}.`,
  );
  await page.mouse.click(point.x, point.y);
  try {
    await page.waitForFunction(predicate, null, { timeout: 2500 });
  } catch {
    failures.push(`${label} did not complete from its ${area} point.`);
  }
  checks.push({ label, area, point, state: await stateOf(page) });
};

try {
  const url = new URL(appUrl);
  url.searchParams.set("dev", "1");
  url.searchParams.set("buttonHitAudit", BUILD_VERSION);
  await page.goto(url.href, { waitUntil: "networkidle" });
  await waitForReady(page);

  await clickAndCheck({
    selector: "#how-to-play-button",
    label: "How to Play",
    predicate: () =>
      JSON.parse(window.render_game_to_text()).menu?.view === "how-to-play",
  });
  await clickAndCheck({
    selector: "#how-to-play-back",
    area: "edge",
    label: "How to Play back",
    predicate: () => JSON.parse(window.render_game_to_text()).menu?.view === "main",
  });

  await clickAndCheck({
    selector: "#menu-leaderboard-button",
    label: "Menu leaderboard",
    predicate: () =>
      JSON.parse(window.render_game_to_text()).menu?.view === "leaderboard",
  });
  await clickAndCheck({
    selector: "#leaderboard-back",
    area: "edge",
    label: "Leaderboard back",
    predicate: () => JSON.parse(window.render_game_to_text()).menu?.view === "main",
  });

  const mutedBefore = (await stateOf(page)).audio.muted;
  await clickAndCheck({
    selector: "#sound-button",
    label: "Sound",
    predicate: (previous) =>
      JSON.parse(window.render_game_to_text()).audio?.muted !== previous,
  });
  assert(
    (await stateOf(page)).audio.muted !== mutedBefore,
    "Sound text/icon click did not toggle mute.",
  );

  await clickAndCheck({
    selector: "#dev-button",
    label: "Dev tools",
    predicate: () =>
      JSON.parse(window.render_game_to_text()).devTools?.panelOpen === true,
  });
  await clickAndCheck({
    selector: "#dev-speed-toggle",
    label: "Nested dev speed label",
    predicate: () =>
      JSON.parse(window.render_game_to_text()).devTools?.speedLockedAtOne === true,
  });
  await clickAndCheck({
    selector: "#dev-close",
    area: "edge",
    label: "Dev close",
    predicate: () =>
      JSON.parse(window.render_game_to_text()).devTools?.panelOpen === false,
  });

  await clickAndCheck({
    selector: "#start-button",
    label: "Start",
    predicate: () => JSON.parse(window.render_game_to_text()).mode === "playing",
  });

  await page.evaluate(() => window.__OTM.debugFinishRun(136));
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).mode === "gameover",
  );
  await clickAndCheck({
    selector: "#death-primary",
    label: "View leaderboard",
    predicate: () =>
      JSON.parse(window.render_game_to_text()).game?.deathScreen?.view ===
      "leaderboard",
  });
  await clickAndCheck({
    selector: "#leaderboard-back",
    area: "edge",
    label: "Back to results",
    predicate: () =>
      JSON.parse(window.render_game_to_text()).game?.deathScreen?.view ===
      "summary",
  });
  await clickAndCheck({
    selector: "#death-retry",
    label: "Climb again",
    predicate: () => JSON.parse(window.render_game_to_text()).mode === "playing",
  });

  await page.screenshot({
    path: path.join(outputDirectory, "desktop-button-hit-area-final.png"),
    fullPage: true,
  });
} finally {
  await context.close();
  await browser.close();
}

if (browserErrors.length) {
  failures.push(`Browser errors: ${browserErrors.join(" | ")}`);
}
if (failures.length) {
  throw new Error(`Desktop button hit-area failures: ${failures.join(" | ")}`);
}

console.log(
  JSON.stringify(
    {
      appUrl,
      buildVersion: BUILD_VERSION,
      checkedButtons: checks.map(({ label, area, point }) => ({
        label,
        area,
        hitId: point.hitId,
        point: { x: point.x, y: point.y },
      })),
      browserErrors,
    },
    null,
    2,
  ),
);
