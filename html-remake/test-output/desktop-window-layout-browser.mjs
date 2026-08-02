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
    "html-remake/test-output/desktop-window-layout",
);
fs.mkdirSync(outputDirectory, { recursive: true });

const viewports = [
  { width: 520, height: 720 },
  { width: 640, height: 720 },
  { width: 900, height: 760 },
  { width: 1000, height: 800 },
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
];
const failures = [];
const browserErrors = [];
const samples = [];
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
        state.assets?.loaded === state.assets?.total &&
        state.assets?.failures?.length === 0
      );
    },
    BUILD_VERSION,
  );
const listenForErrors = (page, label) => {
  page.on("pageerror", (error) =>
    browserErrors.push(`${label} pageerror: ${error.message}`),
  );
  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(`${label} console: ${message.text()}`);
    }
  });
};
const inspectLayout = async (page, viewport, label) => {
  await page.waitForFunction(
    ({ width, height }) => {
      const state = JSON.parse(window.render_game_to_text());
      return (
        state.layout?.viewport.width === width &&
        state.layout?.viewport.height === height
      );
    },
    viewport,
  );
  const state = await stateOf(page);
  const rect = await page.locator("#game-stage").evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      left: bounds.left,
      top: bounds.top,
      right: bounds.right,
      bottom: bounds.bottom,
      width: bounds.width,
      height: bounds.height,
    };
  });
  const stage = state.layout.stageCss;
  const stageAspect = stage.height / stage.width;
  const centeredX = Math.abs(rect.left - (viewport.width - rect.width) / 2);

  assert(state.layout.desktopFramed, `${label} must use the desktop frame.`);
  assert(stage.width <= 500.01, `${label} exceeded the 500px desktop width cap.`);
  assert(
    stage.height <= viewport.height - 31.5,
    `${label} did not fit inside the available window height.`,
  );
  assert(
    stageAspect >= 1.45,
    `${label} rendered as a landscape slice (${stage.width} x ${stage.height}).`,
  );
  assert(
    state.layout.logical.height >= 780,
    `${label} exposed too little vertical game world (${state.layout.logical.height}).`,
  );
  assert(
    rect.top >= 15.5 && rect.bottom <= viewport.height - 15.5,
    `${label} stage was clipped vertically (${rect.top}..${rect.bottom}).`,
  );
  assert(centeredX <= 0.75, `${label} stage was not centered horizontally.`);

  return {
    viewport,
    stage,
    logical: state.layout.logical,
    stageAspect: Math.round(stageAspect * 1000) / 1000,
    rect,
  };
};

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of viewports) {
    const label = `${viewport.width}x${viewport.height}`;
    const context = await browser.newContext({
      viewport,
      screen: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
    });
    const page = await context.newPage();
    listenForErrors(page, label);
    const url = new URL(appUrl);
    url.searchParams.set("dev", "0");
    url.searchParams.set("desktopLayoutAudit", label);
    await page.goto(url.href, { waitUntil: "networkidle" });
    await waitForReady(page);
    samples.push(await inspectLayout(page, viewport, label));

    if (viewport.width === 1000 && viewport.height === 800) {
      await page.screenshot({
        path: path.join(outputDirectory, "desktop-1000x800-menu.png"),
        fullPage: true,
      });
      await page.locator("#start-button").click();
      await page.waitForFunction(
        () => JSON.parse(window.render_game_to_text()).mode === "playing",
      );
      await page.screenshot({
        path: path.join(outputDirectory, "desktop-1000x800-gameplay.png"),
        fullPage: true,
      });

      const resizeSequence = [
        { width: 1440, height: 900 },
        { width: 960, height: 720 },
        { width: 1000, height: 800 },
      ];
      for (const resizedViewport of resizeSequence) {
        await page.setViewportSize(resizedViewport);
        samples.push(
          await inspectLayout(
            page,
            resizedViewport,
            `resize-${resizedViewport.width}x${resizedViewport.height}`,
          ),
        );
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}

if (browserErrors.length) {
  failures.push(`Browser errors: ${browserErrors.join(" | ")}`);
}
if (failures.length) {
  throw new Error(`Desktop window layout failures: ${failures.join(" | ")}`);
}

console.log(
  JSON.stringify(
    {
      appUrl,
      buildVersion: BUILD_VERSION,
      samples,
      browserErrors,
    },
    null,
    2,
  ),
);
