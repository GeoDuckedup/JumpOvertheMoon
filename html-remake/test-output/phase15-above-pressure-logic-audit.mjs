import assert from "node:assert/strict";
import { PhaseFifteenGame } from "../src/game.js";
import {
  PLAY_MODES,
  RIVAL_JETPACK,
} from "../src/game-config.js";

const idleInput = {
  direction: 0,
  consumeAction() {
    return false;
  },
};

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

const frameMs = 1000 / 60;
const pinPlayer = (game, y = 340) => {
  game.debugSetPlayer({ x: 270, y, vx: 0, vy: 0, onGround: false });
};

const neutralGame = new PhaseFifteenGame({ leaderboard });
neutralGame.setViewportHeight(800, 140);
neutralGame.start(15_201, PLAY_MODES.COW_VS_CAT);
neutralGame.debugSetBalloons([]);
pinPlayer(neutralGame);
neutralGame.debugSetRival({
  skipGrace: true,
  x: 80,
  y: 220,
  vx: 0,
  vy: 0,
  attackCooldown: 99,
});

let neutralFramesAbove = 0;
let minimumTargetLead = Number.POSITIVE_INFINITY;
let maximumTargetLead = Number.NEGATIVE_INFINITY;
for (let frame = 0; frame < 600; frame += 1) {
  pinPlayer(neutralGame);
  neutralGame.update(frameMs, idleInput);
  if (frame < 150) {
    continue;
  }
  const state = neutralGame.getSnapshot();
  const targetLead = state.player.y - state.rival.hoverTarget.y;
  minimumTargetLead = Math.min(minimumTargetLead, targetLead);
  maximumTargetLead = Math.max(maximumTargetLead, targetLead);
  if (state.rival.verticalPressure.relation === "above") {
    neutralFramesAbove += 1;
  }
}
let snapshot = neutralGame.getSnapshot();
assert.equal(snapshot.rival.attack.state, "idle");
assert(minimumTargetLead >= 95, `neutral lead dipped to ${minimumTargetLead}`);
assert(maximumTargetLead <= 145, `neutral lead rose to ${maximumTargetLead}`);
assert(
  neutralFramesAbove / 450 >= 0.9,
  "settled neutral pursuit did not stay above the cow",
);

const pressureGame = new PhaseFifteenGame({ leaderboard });
pressureGame.setViewportHeight(800, 140);
pressureGame.start(15_202, PLAY_MODES.COW_VS_CAT);
pressureGame.debugSetBalloons([]);
pinPlayer(pressureGame);
pressureGame.debugSetRival({
  skipGrace: true,
  x: 80,
  y: 500,
  vx: 0,
  vy: 0,
  attackCooldown: 0.1,
});
for (let frame = 0; frame < 3_600; frame += 1) {
  pinPlayer(pressureGame);
  pressureGame.update(frameMs, idleInput);
}
snapshot = pressureGame.getSnapshot();
assert(
  snapshot.rival.verticalPressure.abovePressureRatio >= 0.6 &&
    snapshot.rival.verticalPressure.abovePressureRatio <= 0.72,
  `engaged above-pressure ratio was ${snapshot.rival.verticalPressure.abovePressureRatio}`,
);
assert(snapshot.rival.stats.bowSwipes >= 1);
assert(snapshot.rival.stats.verticalBoosts >= 1);
assert(snapshot.rival.stats.fiddleDrops >= 1);
assert(snapshot.rival.stats.overtakes >= 1);

const overtakeGame = new PhaseFifteenGame({ leaderboard });
overtakeGame.setViewportHeight(800, 140);
overtakeGame.start(15_203, PLAY_MODES.COW_VS_CAT);
overtakeGame.debugSetBalloons([]);
snapshot = overtakeGame.debugForceRivalOvertake();
assert.equal(snapshot.attack.state, "boost-positioning");
assert(
  snapshot.verticalPressure.leadAboveCow <=
    -RIVAL_JETPACK.overtakeTriggerBelowDistance,
);
const fixedPlayerY = overtakeGame.getSnapshot().player.y;
const observedStates = new Set();
let peakLead = Number.NEGATIVE_INFINITY;
for (let frame = 0; frame < 180; frame += 1) {
  pinPlayer(overtakeGame, fixedPlayerY);
  overtakeGame.update(frameMs, idleInput);
  snapshot = overtakeGame.getSnapshot();
  observedStates.add(snapshot.rival.attack.state);
  peakLead = Math.max(peakLead, snapshot.rival.verticalPressure.leadAboveCow);
  if (
    snapshot.rival.attack.state === "idle" &&
    snapshot.rival.verticalPressure.postOvertakeHoldRemainingSeconds > 0
  ) {
    break;
  }
}
assert(observedStates.has("boost-telegraph"));
assert(observedStates.has("boost-active"));
assert(observedStates.has("boost-recovery"));
assert(peakLead >= RIVAL_JETPACK.abovePressureMinimumLead);
assert.equal(snapshot.rival.stats.overtakes, 1);
assert(
  snapshot.rival.verticalPressure.postOvertakeHoldRemainingSeconds >= 1,
);

const heldCatY = snapshot.rival.verticalPressure.postOvertakeHoldY;
const skilledCowY = snapshot.rival.y - 105;
const selectionsBeforeWindow = snapshot.rival.stats.attackSelections;
for (let frame = 0; frame < 36; frame += 1) {
  pinPlayer(overtakeGame, skilledCowY);
  overtakeGame.update(frameMs, idleInput);
}
snapshot = overtakeGame.getSnapshot();
assert.equal(snapshot.rival.attack.state, "idle");
assert.equal(snapshot.rival.stats.attackSelections, selectionsBeforeWindow);
assert(snapshot.rival.verticalPressure.postOvertakeHoldRemainingSeconds > 0.35);
assert(
  Math.abs(snapshot.rival.hoverTarget.y - heldCatY) <= 0.01,
  "cat tracked the cow vertically during the skill window",
);

let reboostStarted = false;
for (let frame = 0; frame < 120; frame += 1) {
  pinPlayer(overtakeGame, skilledCowY);
  overtakeGame.update(frameMs, idleInput);
  snapshot = overtakeGame.getSnapshot();
  if (
    snapshot.rival.attack.state === "boost-positioning" ||
    snapshot.rival.attack.state === "boost-telegraph"
  ) {
    reboostStarted = true;
    break;
  }
}
assert(reboostStarted, "cat did not answer the cow's overtake after the window");

console.log(
  JSON.stringify(
    {
      phase15_2: {
        neutralTargetLead: [minimumTargetLead, maximumTargetLead],
        neutralAboveRatio: neutralFramesAbove / 450,
        engagedAbovePressureRatio:
          pressureGame.getSnapshot().rival.verticalPressure.abovePressureRatio,
        peakOvertakeLead: peakLead,
        postOvertakeWindowSeconds: RIVAL_JETPACK.postOvertakeHoldSeconds,
        reboostStarted,
      },
    },
    null,
    2,
  ),
);
