import assert from "node:assert/strict";
import { PhaseFiveGame } from "../src/game.js";
import { GOAL_MARKERS } from "../src/game-config.js";
import { BalloonRoute } from "../src/route.js";

const routeSignatures = new Set();
const colors = new Set();
let generatedBalloons = 0;
let sideBalloons = 0;
const routeTargetY = GOAL_MARKERS.at(-1).clearanceTopY - 1200;

for (let seed = 1; seed <= 240; seed += 1) {
  const route = new BalloonRoute(seed);
  const balloons = route.spawnThrough(routeTargetY);
  const repeated = new BalloonRoute(seed).spawnThrough(routeTargetY);
  const signatureOf = (items) =>
    JSON.stringify(
      items.slice(0, 18).map(
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
  const signature = signatureOf(balloons);
  routeSignatures.add(signature);
  assert.equal(signature, signatureOf(repeated));

  generatedBalloons += balloons.length;
  for (let index = 0; index < balloons.length; index += 1) {
    const balloon = balloons[index];
    colors.add(balloon.color);
    assert(balloon.x >= balloon.radius + 32);
    assert(balloon.x <= 540 - balloon.radius - 32);
    assert(
      !GOAL_MARKERS.some(
        (marker) =>
          balloon.y >= marker.clearanceTopY &&
          balloon.y <= marker.clearanceBottomY,
      ),
    );
    if (balloon.routeRole === "side") {
      sideBalloons += 1;
      const parent = balloons[index - 1];
      assert.equal(parent.routeRole, "main");
      assert(Math.abs(balloon.y - parent.y) <= 46);
      assert(Math.abs(balloon.x - parent.x) >= 97.5);
    }
  }

  for (const marker of GOAL_MARKERS) {
    const approaches = balloons.filter(
      (balloon) => balloon.landmarkApproach === marker.id,
    );
    assert.equal(approaches.length, 1);
    assert.equal(
      approaches[0].y,
      marker.clearanceBottomY + 42,
    );
    assert(Math.abs(approaches[0].x - marker.x) <= 58);
  }
}

assert.equal(routeSignatures.size, 240);
assert.deepEqual([...colors].sort(), ["blue", "green", "red", "yellow"]);

const events = [];
const game = new PhaseFiveGame({
  onEvent: (name) => events.push(name),
});
const input = {
  direction: 0,
  consumeAction: () => false,
};

game.start(123);
game.debugSetPlayer({
  x: 270,
  y: 660 - 19000 * 10,
  vx: 0,
  vy: 0,
  onGround: false,
});
let snapshot = game.getSnapshot();
assert.equal(snapshot.background.current, "black-hole-region");
assert.equal(
  snapshot.route.goalApproachMarkerIds.length,
  GOAL_MARKERS.length,
);
assert(snapshot.balloonCount <= snapshot.route.maxActiveBalloons);
assert(snapshot.culledBalloonCount > 100);

game.start(456);
game.debugSetBalloons([]);
game.debugSetGoalMarker("prop-plane", { y: 540 });
game.debugSetPlayer({
  x: 270,
  y: 500,
  vx: 0,
  vy: 0,
  onGround: false,
  slashTimer: 0.1,
  cooldown: 0.1,
});
game.update(1000 / 60, input);
snapshot = game.getSnapshot();
assert.equal(snapshot.totalLandmarksCleared, 1);
assert(snapshot.goalMarkers.find((marker) => marker.id === "prop-plane").reached);
assert(snapshot.player.vy < -1000);
assert.equal(snapshot.eventCounts.landmarkClear, 1);

game.start(789);
game.debugSetBalloons([]);
game.debugPopBalloon("red");
snapshot = game.getSnapshot();
assert.equal(snapshot.combo.streak, 1);
assert.equal(snapshot.combo.lastReward, null);
assert(Math.abs(snapshot.player.vy + 920) < 0.01);

game.debugPopBalloon("red");
snapshot = game.getSnapshot();
assert.equal(snapshot.combo.streak, 2);
assert.equal(snapshot.combo.lastReward, "match!");
assert(Math.abs(snapshot.player.vy + 1028.5913) < 0.02);

game.debugPopBalloon("red");
snapshot = game.getSnapshot();
assert.equal(snapshot.combo.streak, 3);
assert.equal(snapshot.combo.lastReward, "combo!");
assert(Math.abs(snapshot.player.vy + 1217.0456) < 0.02);
assert.equal(snapshot.eventCounts.match, 1);
assert.equal(snapshot.eventCounts.combo, 1);

game.debugPopBalloon("red");
game.debugPopBalloon("blue");
snapshot = game.getSnapshot();
assert.equal(snapshot.combo.color, "blue");
assert.equal(snapshot.combo.streak, 1);
assert.equal(snapshot.combo.lastReward, null);

game.start(101112);
game.debugSetPlayer({
  x: 270,
  y: 660 - 1200 * 10,
  vx: 0,
  vy: 0,
  onGround: false,
});
game.debugSetFallPeak(1200);
game.debugSetPlayer({
  x: 270,
  y: 660 - 950 * 10,
  vx: 0,
  vy: 800,
  onGround: false,
});
game.update(1000 / 60, input);
snapshot = game.getSnapshot();
assert(snapshot.reentry.active);
assert(snapshot.reentry.fallDistanceMeters >= 220);
assert(snapshot.player.vy >= 700);

game.debugSetPlayer({ vy: -200, onGround: false });
game.update(1000 / 60, input);
snapshot = game.getSnapshot();
assert(!snapshot.reentry.active);

console.log(
  JSON.stringify(
    {
      routeAudit: {
        seeds: 240,
        uniqueEarlyRoutes: routeSignatures.size,
        generatedBalloons,
        sideBalloons,
        colors: [...colors].sort(),
        landmarkClearanceViolations: 0,
        approachFailures: 0,
      },
      mechanics: {
        landmarkClear: true,
        matchBounceSpeed: 1028.5913,
        comboBounceSpeed: 1217.0456,
        comboReset: true,
        reentryLatchAndReset: true,
        rollingRouteBounded: true,
      },
      events,
    },
    null,
    2,
  ),
);
