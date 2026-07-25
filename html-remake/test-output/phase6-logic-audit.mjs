import assert from "node:assert/strict";
import { PhaseSixGame } from "../src/game.js";
import {
  GOAL_MARKERS,
  SHOOTING_STARS,
  SPEED_RAMP,
} from "../src/game-config.js";
import {
  LeaderboardService,
  normalizeLeaderboardEntries,
} from "../src/leaderboard.js";
import { resolvePhysicalLandscape } from "../src/layout.js";
import { NameEntry, sanitizeInitials } from "../src/name-entry.js";

const leaderboard = {
  implemented: true,
  status: "ready",
  localBest: 0,
  localInitials: "AAA",
  topScores: [],
  pendingCount: 0,
  offlineFallback: true,
  error: null,
};
const events = [];
const game = new PhaseSixGame({
  leaderboard,
  onEvent: (name, snapshot) => {
    events.push({
      name,
      initials: snapshot.nameEntry?.initials || null,
    });
  },
});
const input = {
  direction: 0,
  consumeAction: () => false,
};

game.start(617);
let snapshot = game.getSnapshot();
assert.equal(snapshot.speed.multiplier, 1);
assert.equal(SPEED_RAMP.referenceHeightMeters, 7320);
assert.equal(SPEED_RAMP.maximumMultiplier, 2);
assert.equal(
  GOAL_MARKERS.find((marker) => marker.id === "neptune").heightMeters,
  SPEED_RAMP.referenceHeightMeters,
);

game.debugSetPlayer({
  y: 660 - 1800 * 10,
  vy: 0,
  onGround: false,
});
snapshot = game.getSnapshot();
assert.equal(
  snapshot.speed.multiplier,
  Number((1 + 1800 / SPEED_RAMP.referenceHeightMeters).toFixed(4)),
);

game.debugSetPlayer({
  y: 660 - 3660 * 10,
  vy: 0,
  onGround: false,
});
snapshot = game.getSnapshot();
assert.equal(snapshot.speed.multiplier, 1.5);

game.debugSetPlayer({
  y: 660 - SPEED_RAMP.referenceHeightMeters * 10,
  vy: 0,
  onGround: false,
});
snapshot = game.getSnapshot();
assert.equal(snapshot.speed.multiplier, SPEED_RAMP.maximumMultiplier);
game.debugSetBalloons([]);
game.debugPopBalloon("red");
snapshot = game.getSnapshot();
assert(
  Math.abs(
    snapshot.player.vy +
      920 * SPEED_RAMP.maximumMultiplier,
  ) < 0.01,
);

const captureStar = (seed) => {
  game.start(seed);
  game.debugSetPlayer({
    y: 660 - SHOOTING_STARS.minimumHeightMeters * 10,
    vy: 0,
    onGround: false,
  });
  game.debugSpawnShootingStar();
  return game.getSnapshot().shootingStars[0];
};
const star = captureStar(8675309);
assert.deepEqual(star, captureStar(8675309));
assert(star.length >= SHOOTING_STARS.lengthMin);
assert(star.length <= SHOOTING_STARS.lengthMax);
assert(Math.hypot(star.vx, star.vy) >= SHOOTING_STARS.speedMin - 0.01);
assert(Math.hypot(star.vx, star.vy) <= SHOOTING_STARS.speedMax + 0.01);
assert(star.vy > 0);

const entry = new NameEntry("A!1");
assert.equal(entry.initials, "A1A");
entry.cycle(1);
assert.equal(entry.initials, "B1A");
assert.equal(entry.advance(), "next");
assert.equal(entry.advance(), "next");
assert.equal(entry.advance(), "confirm");
assert.equal(entry.advance(), "submit");
assert(entry.done);

const blocked = new NameEntry("ASS");
blocked.advance();
blocked.advance();
blocked.advance();
assert.equal(blocked.advance(), "blocked");
assert(!blocked.done);
assert(blocked.invalidFlashTimer > 0);
blocked.cycle(1);
assert.equal(blocked.confirmChoice, "redo");
assert.equal(blocked.advance(), "redo");
assert(!blocked.confirming);

const typed = new NameEntry("AAA");
assert(typed.typeCharacter("D"));
assert(typed.typeCharacter("A"));
assert(typed.typeCharacter("N"));
assert.equal(typed.initials, "DAN");
assert(typed.confirming);

assert.equal(sanitizeInitials("$b-9"), "B9A");
const normalized = normalizeLeaderboardEntries({
  slow: { initials: "bbb", score: 42, timestamp: 3 },
  fastLate: { initials: "CCC", score: 100, timestamp: 5 },
  fastEarly: { initials: "AAA", score: 100, timestamp: 2 },
});
assert.deepEqual(
  normalized.map(({ initials, score }) => [initials, score]),
  [
    ["AAA", 100],
    ["CCC", 100],
    ["BBB", 42],
  ],
);

assert.equal(
  resolvePhysicalLandscape({
    screenWidth: 390,
    screenHeight: 844,
    mediaLandscape: true,
    fallbackWidth: 390,
    fallbackHeight: 300,
  }),
  false,
  "A keyboard-shortened visual viewport must not turn portrait into landscape.",
);
assert.equal(
  resolvePhysicalLandscape({
    orientationType: "landscape-primary",
    screenWidth: 390,
    screenHeight: 844,
    mediaLandscape: false,
  }),
  true,
);

const service = new LeaderboardService();
service.topScores = Array.from({ length: 10 }, (_, index) => ({
  initials: "AAA",
  score: 1000 - index * 10,
  timestamp: index,
}));
assert(service.qualifies(911));
assert(!service.qualifies(910));

game.setLeaderboard(leaderboard);
game.start(2026);
game.debugSetSavedBest(0);
game.debugFinishRun(1234);
snapshot = game.getSnapshot();
assert.equal(snapshot.mode, "gameover");
assert.equal(snapshot.deathScreen.view, "summary");
assert.equal(snapshot.nameEntry, null);
game.openLeaderboard();
snapshot = game.getSnapshot();
assert.equal(snapshot.deathScreen.view, "leaderboard");
assert.equal(snapshot.nameEntry, null);
assert.equal(game.submitTypedInitials("A"), "length");
assert.equal(game.submitTypedInitials("ASS"), "blocked");
assert.equal(game.submitTypedInitials("BAA"), "submitted");
snapshot = game.getSnapshot();
assert(snapshot.nameEntry.done);
assert.equal(snapshot.nameEntry.initials, "BAA");
assert(snapshot.deathScreen.submitted);
assert.equal(
  events.filter(({ name }) => name === "scoreSubmit").length,
  1,
);

const lowRunGame = new PhaseSixGame({
  leaderboard: {
    ...leaderboard,
    localBest: 5000,
    topScores: Array.from({ length: 10 }, (_, index) => ({
      initials: "TOP",
      score: 10_000 - index * 100,
      timestamp: index,
    })),
  },
});
lowRunGame.start(2121);
lowRunGame.debugSetSavedBest(5000);
lowRunGame.debugFinishRun(25);
assert(lowRunGame.getSnapshot().deathScreen.qualifiesForLeaderboard);

const landingGame = new PhaseSixGame({ leaderboard });
landingGame.start(3030);
landingGame.debugPopBalloon("blue");
landingGame.debugSetPlayer({
  y: 400,
  vy: 30_000,
  onGround: false,
});
for (let frame = 0; frame < 5; frame += 1) {
  landingGame.update(1000 / 60, input);
}
const landedSnapshot = landingGame.getSnapshot();
const landedRender = landingGame.getRenderState(0);
assert.equal(landedSnapshot.mode, "gameover");
assert(landedSnapshot.player.onGround);
assert.equal(landedRender.player.renderY, landedSnapshot.player.y);
assert.equal(landedSnapshot.deathScreen.view, "summary");
assert.equal(landedSnapshot.runStats.balloonsPopped, 1);
assert.equal(landedSnapshot.runStats.bestCombo, 1);

console.log(
  JSON.stringify(
    {
      speedRamp: {
        referenceHeightMeters: SPEED_RAMP.referenceHeightMeters,
        maximumMultiplier: SPEED_RAMP.maximumMultiplier,
        scaledBounceVerified: true,
      },
      shootingStars: {
        minimumHeightMeters: SHOOTING_STARS.minimumHeightMeters,
        deterministicVisualStream: true,
        trajectoryBoundsVerified: true,
      },
      initials: {
        sanitization: true,
        blockedNameGuard: true,
        confirmRedoFlow: true,
        directKeyboardTyping: true,
        singleSubmissionEvent: true,
      },
      leaderboard: {
        normalizationAndSorting: true,
        topTenQualification: true,
        resultsBeforeLeaderboard: true,
        everyPositiveRunSubmittable: true,
        physicalOrientationIndependentOfKeyboard: true,
        networkWritesPerformed: 0,
      },
      deathSummary: {
        landedInterpolationSnapped: true,
        runStatsExposed: true,
      },
    },
    null,
    2,
  ),
);
