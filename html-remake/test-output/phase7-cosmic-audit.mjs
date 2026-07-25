import assert from "node:assert/strict";
import { PhaseSevenGame } from "../src/game.js";
import { GOAL_MARKERS, ROUTE, WORLD_FLOOR_Y } from "../src/game-config.js";
import { BalloonRoute } from "../src/route.js";

const expectedLandmarks = [
  ["prop-plane", 380],
  ["space-station", 1133],
  ["moon", 1980],
  ["mars", 2921],
  ["jupiter", 3932],
  ["saturn", 4991],
  ["uranus", 6120],
  ["neptune", 7320],
  ["pluto", 8600],
  ["kuiper-object", 10000],
  ["heliopause", 11500],
  ["voyager-1", 13100],
  ["oort-comet", 14800],
  ["proxima-centauri", 16600],
  ["black-hole", 18500],
];

assert.deepEqual(
  GOAL_MARKERS.map(({ id, heightMeters }) => [id, heightMeters]),
  expectedLandmarks,
);
assert.equal(GOAL_MARKERS.length, 15);

for (let index = 1; index < GOAL_MARKERS.length; index += 1) {
  assert(
    GOAL_MARKERS[index].heightMeters >
      GOAL_MARKERS[index - 1].heightMeters,
  );
  assert(
    GOAL_MARKERS[index].clearanceBottomY <
      GOAL_MARKERS[index - 1].clearanceTopY,
    "Landmark clearance bands must remain separated.",
  );
}

const route = new BalloonRoute(7007);
const beyondBlackHoleY = GOAL_MARKERS.at(-1).clearanceTopY - 5000;
const generated = route.spawnThrough(beyondBlackHoleY);
assert.equal(
  route.getSnapshot().goalApproachMarkerIds.length,
  GOAL_MARKERS.length,
);
assert(
  generated.some(
    (balloon) => balloon.y < GOAL_MARKERS.at(-1).clearanceTopY,
  ),
  "The route must continue above the final landmark.",
);

for (const marker of GOAL_MARKERS) {
  const approaches = generated.filter(
    (balloon) => balloon.landmarkApproach === marker.id,
  );
  assert.equal(approaches.length, 1);
  assert.equal(approaches[0].y, marker.clearanceBottomY + 42);
}

const game = new PhaseSevenGame();
game.start(7007);
let snapshot = game.getSnapshot();
assert.equal(snapshot.runStats.totalLandmarks, GOAL_MARKERS.length);
assert.equal(snapshot.phaseSeven.totalLandmarks, GOAL_MARKERS.length);
assert.equal(snapshot.phaseSeven.finalLandmarkHeightMeters, 18500);
assert.equal(snapshot.phaseSeven.proceduralPlaceholderArt, false);
assert(snapshot.phaseSeven.endlessBeyondFinalLandmark);

for (const [index, marker] of GOAL_MARKERS.entries()) {
  const jumped = game.debugJumpToLandmark(marker.id);
  assert.equal(jumped.id, marker.id);
  snapshot = game.getSnapshot();
  assert.equal(snapshot.nextLandmark, "Prop Plane");
  assert(
    Math.abs(snapshot.camera.y - (marker.y - marker.spriteOffsetY - 136)) <
      40,
    `Debug camera should frame landmark ${marker.id}.`,
  );
  assert(snapshot.balloonCount <= ROUTE.maxActiveBalloons);

  const byIndex = game.debugJumpToLandmark(index);
  assert.equal(byIndex.id, marker.id);
}

for (const marker of GOAL_MARKERS) {
  game.start(7007);
  const warp = game.debugWarpBelowLandmark(marker.id, 3);
  snapshot = game.getSnapshot();
  const warpedMarker = snapshot.goalMarkers.find(
    (candidate) => candidate.id === marker.id,
  );
  assert.equal(warp.marker.id, marker.id);
  assert.equal(warp.requestedBalloonsBelow, 3);
  assert(warp.targetBalloon);
  assert(warp.targetBalloon.y > warpedMarker.clearanceBottomY);
  assert(snapshot.player.y > warpedMarker.clearanceBottomY);
  assert(snapshot.player.y < warp.targetBalloon.y);
  assert(
    snapshot.balloons.filter(
      (balloon) =>
        balloon.routeRole === "main" &&
        balloon.y > warpedMarker.clearanceBottomY &&
        balloon.y <= warp.targetBalloon.y,
    ).length >= 3,
  );
  assert(snapshot.balloonCount <= ROUTE.maxActiveBalloons);
}

game.debugJumpToLandmark("black-hole");
snapshot = game.getSnapshot();
assert(snapshot.heightMeters > GOAL_MARKERS.at(-1).heightMeters - 100);
assert.equal(snapshot.speed.multiplier, 2);
assert(snapshot.route.goalApproachMarkerIds.includes("black-hole"));
assert(snapshot.balloonCount <= ROUTE.maxActiveBalloons);

const finalMarker = GOAL_MARKERS.at(-1);
game.debugSetBalloons([]);
game.debugSetGoalMarker("black-hole", {
  x: 270,
  y: 540,
  clearanceTopY: 300,
  clearanceBottomY: 800,
});
game.debugSetPlayer({
  x: 270,
  y: 500,
  vx: 0,
  vy: 0,
  onGround: false,
  slashTimer: 0.1,
  cooldown: 0.1,
});
game.update(1000 / 60, {
  direction: 0,
  consumeAction: () => false,
});
snapshot = game.getSnapshot();
assert(snapshot.goalMarkers.find(({ id }) => id === "black-hole").reached);
assert.equal(snapshot.totalLandmarksCleared, 1);
assert.equal(snapshot.eventCounts.landmarkClear, 1);
assert(snapshot.player.vy < -1000);

assert.equal(
  finalMarker.y,
  WORLD_FLOOR_Y - finalMarker.heightMeters * 10,
);

console.log(
  JSON.stringify(
    {
      landmarks: {
        total: GOAL_MARKERS.length,
        firstCosmicHeightMeters: 8600,
        finalHeightMeters: 18500,
        exactOrderAndSpacing: true,
        debugAccessVerified: GOAL_MARKERS.length,
        playableWarpTargetsVerified: GOAL_MARKERS.length,
      },
      route: {
        approachesVerified: GOAL_MARKERS.length,
        continuesBeyondBlackHole: true,
        boundedActiveState: true,
      },
      mechanics: {
        blackHoleCollision: true,
        dynamicResultsTotal: true,
        speedCapPreserved: true,
      },
    },
    null,
    2,
  ),
);
