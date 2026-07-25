import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "/Users/danemerman/.codex/skills/develop-web-game/node_modules/playwright/index.mjs";

const url =
  process.env.OTM_URL || "http://127.0.0.1:5174/html-remake/";
const outputDirectory = path.resolve(
  "html-remake/test-output/leaderboard-browser-audit",
);
fs.mkdirSync(outputDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
const errors = [];

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`console: ${message.text()}`);
    }
  });

  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => {
    const state = JSON.parse(window.render_game_to_text?.() || "{}");
    return state.assets?.loaded === state.assets?.total && state.assets?.total > 0;
  });
  await page.locator("#start-button").click();
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).mode === "playing",
  );
  await page.evaluate(() => {
    window.__OTM.setManualMode(true);
    window.__OTM.debugFinishRun(136);
    window.__OTM.openLeaderboard();
  });
  await page.locator("#leaderboard-panel").waitFor({ state: "visible" });

  const readLayout = () =>
    page.evaluate(() => {
      const rect = (selector) => {
        const box = document.querySelector(selector).getBoundingClientRect();
        return {
          top: box.top,
          right: box.right,
          bottom: box.bottom,
          left: box.left,
          width: box.width,
          height: box.height,
        };
      };
      const state = JSON.parse(window.render_game_to_text());
      const stage = rect("#game-stage");
      const card = rect(".leaderboard-card");
      const heading = rect(".leaderboard-heading");
      const entry = rect("#leaderboard-entry");
      const scores = rect("#leaderboard-scores");
      const actions = rect("#leaderboard-actions");
      return {
        state,
        stage,
        card,
        heading,
        entry,
        scores,
        actions,
        focused: document.activeElement?.id || null,
        rotateHidden: document.querySelector("#rotate-overlay").hidden,
        panelHidden: document.querySelector("#leaderboard-panel").hidden,
        deathActionsHidden: document.querySelector("#death-actions").hidden,
        rowCount: document.querySelectorAll("#leaderboard-list > li").length,
      };
    });

  const assertFlowLayout = (layout, label) => {
    assert(!layout.panelHidden, `${label}: leaderboard panel is hidden.`);
    assert(layout.deathActionsHidden, `${label}: old death actions are visible.`);
    assert(
      layout.card.top >= layout.stage.top - 1 &&
        layout.card.left >= layout.stage.left - 1 &&
        layout.card.right <= layout.stage.right + 1 &&
        layout.card.bottom <= layout.stage.bottom + 1,
      `${label}: leaderboard card leaves the game stage.`,
    );
    assert(
      layout.entry.top >= layout.heading.bottom - 1,
      `${label}: entry overlaps the leaderboard heading.`,
    );
    assert(
      layout.scores.top >= layout.entry.bottom - 1,
      `${label}: rankings overlap the initials form.`,
    );
    assert(
      layout.actions.top >= layout.scores.bottom - 1,
      `${label}: actions overlap the rankings.`,
    );
  };

  const normalLayout = await readLayout();
  assertFlowLayout(normalLayout, "portrait");
  assert(normalLayout.rowCount > 0, "Leaderboard rows did not render.");
  assert(normalLayout.rotateHidden, "Portrait should not show rotation guidance.");
  await page.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-leaderboard.png"),
  });

  const initials = page.locator("#leaderboard-initials");
  await initials.click();
  await initials.fill("");
  await initials.pressSequentially("dan");
  assert.equal(await initials.inputValue(), "dan");
  assert.equal(
    await page.evaluate(() => document.activeElement?.id),
    "leaderboard-initials",
  );
  await page.keyboard.press("Backspace");
  assert.equal(await initials.inputValue(), "da");
  assert.equal(
    await page.evaluate(() => document.activeElement?.id),
    "leaderboard-initials",
  );
  await page.keyboard.type("n");
  assert.equal(await initials.inputValue(), "dan");
  assert.equal(
    await page.evaluate(() => document.activeElement?.id),
    "leaderboard-initials",
  );

  await page.setViewportSize({ width: 390, height: 430 });
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).layout.keyboardOpen === true,
  );
  const keyboardLayout = await readLayout();
  assertFlowLayout(keyboardLayout, "keyboard-sized viewport");
  assert(
    keyboardLayout.state.layout.orientationLandscape === false,
    "Keyboard-sized viewport changed the physical orientation.",
  );
  assert(
    keyboardLayout.state.layout.orientationBlocked === false &&
      keyboardLayout.rotateHidden,
    "Keyboard-sized portrait incorrectly showed rotation guidance.",
  );
  assert.equal(
    keyboardLayout.focused,
    "leaderboard-initials",
    "The initials field lost focus after viewport resizing.",
  );
  await page.locator("#game-stage").screenshot({
    path: path.join(outputDirectory, "phone-leaderboard-keyboard-space.png"),
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#leaderboard-retry").click();
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).mode === "playing",
  );
  assert.equal(
    JSON.parse(await page.evaluate(() => window.render_game_to_text())).mode,
    "playing",
    "Run Again should work without submitting a score.",
  );
  assert.deepEqual(errors, []);

  console.log(
    JSON.stringify(
      {
        portraitFlowLayout: true,
        keyboardFlowLayout: true,
        canvasLeaderboardSuppressed: normalLayout.deathActionsHidden,
        initialsFocusSurvivedTypingAndBackspace: true,
        keyboardDidNotTriggerOrientationBlock: true,
        runAgainWithoutSubmission: true,
        rowCount: normalLayout.rowCount,
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
