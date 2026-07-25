import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { PhaseSevenGame } from "../src/game.js";
import {
  ROUTE,
  SPEED_RAMP,
  WORLD_FLOOR_Y,
} from "../src/game-config.js";

const input = {
  direction: 0,
  consumeAction: () => false,
};
const game = new PhaseSevenGame();
game.setViewportHeight(844);
game.start(720072);

let snapshot = game.getSnapshot();
const startingBalloon = snapshot.balloons.find(
  (balloon) => balloon.alive && balloon.routeRole === "main",
);
assert(startingBalloon, "A fresh route should expose a starting balloon.");

game.debugJumpToLandmark("black-hole");
snapshot = game.getSnapshot();
const peakHistoryCount = snapshot.route.historyBalloonCount;
assert(
  peakHistoryCount > 1_500,
  "A black-hole climb should archive the complete generated route.",
);
assert.equal(peakHistoryCount, snapshot.route.totalGenerated);
assert(snapshot.route.historyChunkCount > 100);
assert(snapshot.route.activeHistoryChunkCount <= 4);
assert(snapshot.balloonCount <= ROUTE.maxActiveBalloons);
assert(
  !snapshot.balloons.some((balloon) => balloon.id === startingBalloon.id),
  "Low-route balloons should leave the active window at high altitude.",
);

game.debugSetPlayer({
  x: startingBalloon.x,
  y: startingBalloon.y - 180,
  vx: 0,
  vy: 900,
  onGround: false,
  slashTimer: 0,
  cooldown: 0,
});
snapshot = game.getSnapshot();
const restoredStartingBalloon = snapshot.balloons.find(
  (balloon) => balloon.id === startingBalloon.id,
);
assert(
  restoredStartingBalloon,
  "Descending to the original route should rehydrate its balloons.",
);
assert.equal(restoredStartingBalloon.x, startingBalloon.x);
assert.equal(restoredStartingBalloon.y, startingBalloon.y);
assert.equal(restoredStartingBalloon.color, startingBalloon.color);
assert(snapshot.route.rehydratedBalloonCount > 0);
assert.equal(snapshot.route.historyBalloonCount, peakHistoryCount);
assert(snapshot.balloonCount <= ROUTE.maxActiveBalloons);

const popTarget = snapshot.balloons.find(
  (balloon) => balloon.alive && balloon.routeRole === "main",
);
assert(popTarget);
game.debugSetPlayer({
  x: popTarget.x,
  y: popTarget.y - 52,
  vx: 0,
  vy: 0,
  facing: 1,
  onGround: false,
  slashTimer: 0.1,
  cooldown: 0.1,
});
game.update(1000 / 60, input);
snapshot = game.getSnapshot();
assert.equal(snapshot.totalPopped, 1);
assert.equal(snapshot.route.poppedHistoryBalloonCount, 1);
assert(
  snapshot.balloons.some(
    (balloon) => balloon.id === popTarget.id && !balloon.alive,
  ),
  "The short pop animation should remain in the nearby active window.",
);

game.debugJumpToLandmark("black-hole");
game.debugSetPlayer({
  x: popTarget.x,
  y: popTarget.y - 180,
  vx: 0,
  vy: 900,
  onGround: false,
  slashTimer: 0,
  cooldown: 0,
});
snapshot = game.getSnapshot();
assert(
  !snapshot.balloons.some((balloon) => balloon.id === popTarget.id),
  "Popped balloons must not respawn when their old route chunk returns.",
);

const stressStartedAt = performance.now();
let maximumActive = 0;
for (let heightMeters = 18_500; heightMeters >= 0; heightMeters -= 125) {
  game.debugSetPlayer({
    y: WORLD_FLOOR_Y - heightMeters * 10,
    vx: 0,
    vy: 1_200,
    onGround: false,
    slashTimer: 0,
    cooldown: 0,
  });
  snapshot = game.getSnapshot();
  maximumActive = Math.max(maximumActive, snapshot.balloonCount);
  assert(snapshot.balloonCount <= ROUTE.maxActiveBalloons);
  assert(snapshot.route.activeHistoryChunkCount <= 4);
}
const stressDurationMs = performance.now() - stressStartedAt;
snapshot = game.getSnapshot();
assert.equal(snapshot.route.historyBalloonCount, peakHistoryCount);
assert(snapshot.route.rehydratedBalloonCount > 1_000);
const descentRehydrationCount = snapshot.route.rehydratedBalloonCount;

game.debugSetPlayer({
  y: WORLD_FLOOR_Y - SPEED_RAMP.referenceHeightMeters * 10,
  vy: 0,
  onGround: false,
});
snapshot = game.getSnapshot();
assert.equal(snapshot.speed.multiplier, SPEED_RAMP.maximumMultiplier);
assert(snapshot.speed.rampEnabled);
assert(!snapshot.speed.devLockedAtOne);

game.setSpeedRampEnabled(false);
snapshot = game.getSnapshot();
assert.equal(snapshot.speed.multiplier, 1);
assert(!snapshot.speed.rampEnabled);
assert(snapshot.speed.devLockedAtOne);

game.start(720072);
game.debugJumpToLandmark("black-hole");
snapshot = game.getSnapshot();
assert.equal(
  snapshot.speed.multiplier,
  1,
  "The DEV speed lock should survive a fresh landmark-warp run.",
);

game.setSpeedRampEnabled(true);
snapshot = game.getSnapshot();
assert.equal(snapshot.speed.multiplier, SPEED_RAMP.maximumMultiplier);
assert(snapshot.speed.rampEnabled);

console.log(
  JSON.stringify(
    {
      routeHistory: {
        archivedBalloonsAtBlackHole: peakHistoryCount,
        chunkPixels: ROUTE.historyChunkPixels,
        chunksAtBlackHole: snapshot.route.historyChunkCount,
        poppedBalloonStayedPopped: true,
        descentRehydrationCount,
      },
      activeWindow: {
        cap: ROUTE.maxActiveBalloons,
        maximumObserved: maximumActive,
        stressCameraPositions: Math.floor(18_500 / 125) + 1,
        stressDurationMs: Number(stressDurationMs.toFixed(2)),
      },
      devSpeedLock: {
        locksAtOne: true,
        survivesFreshRun: true,
        normalRampRestored: true,
      },
    },
    null,
    2,
  ),
);
