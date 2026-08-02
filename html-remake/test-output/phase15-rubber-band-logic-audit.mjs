import assert from "node:assert/strict";
import { PhaseFifteenGame } from "../src/game.js";
import {
  COMBO,
  PLAY_MODES,
  RIVAL_FIDDLE_DROP,
  RIVAL_JETPACK,
  WORLD_FLOOR_Y,
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

const groundGame = new PhaseFifteenGame({ leaderboard });
groundGame.setViewportHeight(800, 140);
groundGame.start(15_101, PLAY_MODES.COW_VS_CAT);
groundGame.debugSetRival({ skipGrace: true, attackCooldown: 99 });
for (let frame = 0; frame < 30; frame += 1) {
  groundGame.update(frameMs, idleInput);
}
let snapshot = groundGame.getSnapshot();
assert.equal(snapshot.rival.rubberBand.active, false);
assert.equal(snapshot.rival.rubberBand.pending, false);

const comboGame = new PhaseFifteenGame({ leaderboard });
comboGame.setViewportHeight(800, 140);
comboGame.start(15_102, PLAY_MODES.COW_VS_CAT);
comboGame.debugSetBalloons([]);
comboGame.debugSetPlayer({
  x: 270,
  y: 340,
  vy: -COMBO.comboBounceSpeed,
  onGround: false,
});
comboGame.debugSetRival({
  skipGrace: true,
  x: 80,
  y: 480,
  vx: 0,
  vy: 0,
  orbitSide: -1,
  attackCooldown: 0.18,
});

let maximumScreenY = Number.NEGATIVE_INFINITY;
let maximumVerticalScale = 1;
let activeFrames = 0;
let offscreenFrames = 0;
let attacksSelectedDuringCatchUp = 0;
let previousAttackSelections = 0;
for (let frame = 0; frame < 150; frame += 1) {
  comboGame.update(frameMs, idleInput);
  snapshot = comboGame.getSnapshot();
  maximumScreenY = Math.max(
    maximumScreenY,
    snapshot.rival.y - snapshot.camera.y,
  );
  maximumVerticalScale = Math.max(
    maximumVerticalScale,
    snapshot.rival.rubberBand.verticalScale,
  );
  if (snapshot.rival.y - snapshot.camera.y > snapshot.camera.viewportHeight) {
    offscreenFrames += 1;
  }
  if (snapshot.rival.rubberBand.active) {
    activeFrames += 1;
    if (snapshot.rival.stats.attackSelections > previousAttackSelections) {
      attacksSelectedDuringCatchUp += 1;
    }
  }
  previousAttackSelections = snapshot.rival.stats.attackSelections;
}
assert(activeFrames > 0);
assert(snapshot.rival.stats.rubberBandActivations >= 1);
assert(maximumVerticalScale > 1.25);
assert(
  maximumVerticalScale <=
    RIVAL_JETPACK.rubberBandMaximumVerticalScale + 0.001,
);
assert.equal(attacksSelectedDuringCatchUp, 0);
assert(
  offscreenFrames <= 8,
  `cat remained offscreen for ${offscreenFrames} combo-ascent frames`,
);
assert(
  maximumScreenY <= 850,
  `cat fell too far below the view: ${maximumScreenY}`,
);
assert.equal(snapshot.rival.stats.rubberBandFailsafes, 0);

const committedGame = new PhaseFifteenGame({ leaderboard });
committedGame.setViewportHeight(800, 140);
committedGame.start(15_103, PLAY_MODES.COW_VS_CAT);
committedGame.debugSetBalloons([]);
committedGame.debugSetPlayer({ x: 270, y: 340, vy: 0, onGround: false });
snapshot = committedGame.debugForceRivalFiddleDrop();
const lockedDirection = { ...snapshot.attack.fiddleDirection };
for (
  let frame = 0;
  frame < Math.ceil((RIVAL_FIDDLE_DROP.telegraphSeconds + 1 / 60) * 60);
  frame += 1
) {
  committedGame.update(frameMs, idleInput);
}
snapshot = committedGame.getSnapshot();
assert.equal(snapshot.rival.attack.state, "fiddle-active");
committedGame.debugSetPlayer({
  x: 80,
  y: snapshot.player.y - 720,
  vy: -COMBO.comboBounceSpeed,
  onGround: false,
});
committedGame.update(frameMs, idleInput);
snapshot = committedGame.getSnapshot();
assert.equal(snapshot.rival.attack.state, "fiddle-active");
assert.equal(snapshot.rival.rubberBand.active, false);
assert.equal(snapshot.rival.rubberBand.pending, true);
assert.deepEqual(snapshot.rival.attack.fiddleDirection, lockedDirection);

const failsafeGame = new PhaseFifteenGame({ leaderboard });
failsafeGame.setViewportHeight(800, 140);
failsafeGame.start(15_104, PLAY_MODES.COW_VS_CAT);
failsafeGame.debugSetBalloons([]);
failsafeGame.debugSetPlayer({ x: 270, y: -900, vy: 0, onGround: false });
const cameraY = failsafeGame.getSnapshot().camera.y;
failsafeGame.debugSetRival({
  skipGrace: true,
  x: 80,
  y: cameraY + 3200,
  vx: 0,
  vy: 0,
  attackCooldown: 99,
});
for (
  let frame = 0;
  frame < Math.ceil((RIVAL_JETPACK.rubberBandFailsafeSeconds + 0.2) * 60);
  frame += 1
) {
  failsafeGame.debugSetPlayer({
    x: 270,
    y: -900,
    vy: 0,
    onGround: false,
  });
  failsafeGame.update(frameMs, idleInput);
  if (failsafeGame.getSnapshot().rival.state === "recovering") {
    break;
  }
}
snapshot = failsafeGame.getSnapshot();
assert.equal(snapshot.rival.state, "recovering");
assert.equal(snapshot.rival.stats.rubberBandFailsafes, 1);
assert.equal(snapshot.rival.visible, false);
assert(snapshot.player.y < WORLD_FLOOR_Y);

console.log(
  JSON.stringify(
    {
      phase15_1: {
        groundFalsePositive: false,
        comboBounceSpeed: Number(COMBO.comboBounceSpeed.toFixed(3)),
        activeFrames,
        offscreenFrames,
        maximumScreenY: Number(maximumScreenY.toFixed(3)),
        maximumVerticalScale: Number(maximumVerticalScale.toFixed(3)),
        committedDivePreserved: true,
        failsafeSeconds: RIVAL_JETPACK.rubberBandFailsafeSeconds,
      },
    },
    null,
    2,
  ),
);
