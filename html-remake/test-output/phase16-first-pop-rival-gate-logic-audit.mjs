import assert from "node:assert/strict";
import { OverTheMoonGame } from "../src/game.js";
import {
  PLAY_MODES,
  RIVAL_CHASE,
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

const holdCowAndAdvance = (game, seconds) => {
  for (let frame = 0; frame < Math.ceil(seconds * 60); frame += 1) {
    game.debugSetPlayer({ x: 270, y: 300, vy: 0, onGround: false });
    game.update(1000 / 60, idleInput);
  }
};

const game = new OverTheMoonGame({ leaderboard });
game.setViewportHeight(800, 140);
game.start(16_101, PLAY_MODES.COW_VS_CAT);

let snapshot = game.getSnapshot();
const openingBalloonIds = snapshot.balloons
  .filter((balloon) => balloon.alive)
  .map((balloon) => balloon.id);
assert.equal(snapshot.rival.state, "waiting-first-pop");
assert.equal(snapshot.rival.waitingForFirstCowPop, true);
assert.equal(snapshot.rival.visible, false);
assert.equal(snapshot.rival.active, false);
assert.equal(snapshot.rival.jetpackActive, false);
assert.equal(snapshot.rival.graceRemainingSeconds, 0);
assert.equal(snapshot.totalPopped, 0);
assert(snapshot.phaseSixteen.rivalArrivalAfterFirstCowPopImplemented);

holdCowAndAdvance(game, RIVAL_CHASE.openingGraceSeconds + 5);
snapshot = game.getSnapshot();
assert.equal(snapshot.rival.state, "waiting-first-pop");
assert.equal(snapshot.rival.waitingForFirstCowPop, true);
assert.equal(snapshot.rival.visible, false);
assert.equal(snapshot.rival.active, false);
assert.equal(snapshot.rival.stats.balloonPops, 0);
assert.equal(snapshot.totalPopped, 0);
const aliveBalloonIds = new Set(
  snapshot.balloons
    .filter((balloon) => balloon.alive)
    .map((balloon) => balloon.id),
);
assert(
  openingBalloonIds.every((id) => aliveBalloonIds.has(id)),
  "The cat must not consume any opening balloon while waiting.",
);

game.debugPopBalloon("blue");
snapshot = game.getSnapshot();
assert.equal(snapshot.totalPopped, 1);
assert.equal(snapshot.hasPoppedBalloon, true);
assert.equal(snapshot.rival.state, "grace");
assert.equal(snapshot.rival.waitingForFirstCowPop, false);
assert.equal(snapshot.rival.visible, false);
assert.equal(snapshot.rival.active, false);
assert.equal(
  snapshot.rival.graceRemainingSeconds,
  RIVAL_CHASE.openingGraceSeconds,
);

holdCowAndAdvance(game, RIVAL_CHASE.openingGraceSeconds - 0.1);
snapshot = game.getSnapshot();
assert.equal(snapshot.rival.state, "grace");
assert.equal(snapshot.rival.visible, false);

holdCowAndAdvance(game, 0.2);
snapshot = game.getSnapshot();
assert(
  snapshot.rival.state === "chasing" ||
    snapshot.rival.state === "reentering",
);
assert.equal(snapshot.rival.visible, true);
assert.equal(snapshot.rival.active, true);
assert.equal(snapshot.rival.jetpackActive, true);
assert.equal(snapshot.eventCounts.rivalEnter, 1);

game.start(16_102, PLAY_MODES.COW_VS_CAT);
snapshot = game.getSnapshot();
assert.equal(snapshot.rival.state, "waiting-first-pop");
assert.equal(snapshot.totalPopped, 0);

const forced = game.debugForceRivalAttack(1);
assert.equal(forced.visible, true);
assert.equal(forced.active, true);
assert.equal(forced.attack.state, "telegraph");

game.start(16_103, PLAY_MODES.CLASSIC);
snapshot = game.getSnapshot();
assert.equal(snapshot.rival.state, "absent");
assert.equal(snapshot.rival.present, false);
game.debugPopBalloon("green");
snapshot = game.getSnapshot();
assert.equal(snapshot.rival.state, "absent");
assert.equal(snapshot.totalPopped, 1);

console.log(
  JSON.stringify(
    {
      phase16_0_1: {
        openingGate: "first-cow-balloon-pop",
        prePopWaitTestedSeconds: RIVAL_CHASE.openingGraceSeconds + 5,
        postPopGraceSeconds: RIVAL_CHASE.openingGraceSeconds,
        firstBalloonProtected: true,
        devForceBypassPreserved: true,
        classicModeUnaffected: true,
      },
    },
    null,
    2,
  ),
);
