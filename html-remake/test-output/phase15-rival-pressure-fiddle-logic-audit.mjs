import assert from "node:assert/strict";
import { PhaseFifteenGame } from "../src/game.js";
import {
  PLAY_MODES,
  PLAYER,
  RIVAL_BOW_SWIPE,
  RIVAL_FIDDLE_DROP,
  RIVAL_JETPACK,
  RIVAL_VERTICAL_BOOST,
} from "../src/game-config.js";

const idleInput = {
  direction: 0,
  consumeAction() {
    return false;
  },
};

const advance = (game, seconds) => {
  const frames = Math.ceil(seconds * 60);
  for (let frame = 0; frame < frames; frame += 1) {
    game.update(1000 / 60, idleInput);
  }
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

const foundation = new PhaseFifteenGame({ leaderboard });
foundation.start(15_000, PLAY_MODES.COW_VS_CAT);
let snapshot = foundation.getSnapshot();
assert(snapshot.phaseFifteen.widerMovingOrbitImplemented);
assert(snapshot.phaseFifteen.weightedAttackDirectorImplemented);
assert(snapshot.phaseFifteen.repeatAttackPreventionImplemented);
assert(snapshot.phaseFifteen.fiddleDropImplemented);
assert(snapshot.phaseFifteen.fiddleDropLocksTrajectory);
assert.equal(
  snapshot.phaseFifteen.minimumNeutralSideDistance,
  RIVAL_JETPACK.hoverSideDistance - RIVAL_JETPACK.hoverSideWanderAmplitude,
);
assert.equal(
  snapshot.phaseFifteen.maximumNeutralSideDistance,
  RIVAL_JETPACK.hoverSideDistance + RIVAL_JETPACK.hoverSideWanderAmplitude,
);
assert.deepEqual(snapshot.phaseFifteen.attackWeights, {
  bowSwipe: RIVAL_BOW_SWIPE.selectionWeight,
  verticalBoost: RIVAL_VERTICAL_BOOST.selectionWeight,
  fiddleDrop: RIVAL_FIDDLE_DROP.selectionWeight,
});
assert(snapshot.rival.attacksImplemented.fiddleDrop);

foundation.debugSetPlayer({ x: 270, y: 360, vy: 0, onGround: false });
foundation.debugSetRival({ skipGrace: true, attackCooldown: 99 });
advance(foundation, 1.2);
snapshot = foundation.getSnapshot();
const neutralSideDistance = Math.abs(
  snapshot.rival.hoverTarget.x - snapshot.player.x,
);
assert(
  neutralSideDistance >=
    RIVAL_JETPACK.hoverSideDistance -
      RIVAL_JETPACK.hoverSideWanderAmplitude -
      2,
);
assert(
  neutralSideDistance <=
    RIVAL_JETPACK.hoverSideDistance +
      RIVAL_JETPACK.hoverSideWanderAmplitude +
      2,
);

const directorGame = new PhaseFifteenGame({ leaderboard });
directorGame.start(15_001, PLAY_MODES.COW_VS_CAT);
directorGame.debugSetPlayer({ x: 270, y: 340, vy: 0, onGround: false });
directorGame.debugSetRival({ skipGrace: true, attackCooldown: 0 });
const selectedKinds = [];
const selectionTimes = [];
let previousSelections = 0;
for (let frame = 0; frame < 60 * 32; frame += 1) {
  if (frame % 24 === 0) {
    directorGame.debugSetPlayer({ x: 270, y: 340, vy: 0, onGround: false });
  }
  directorGame.update(1000 / 60, idleInput);
  const current = directorGame.getSnapshot();
  if (current.rival.stats.attackSelections > previousSelections) {
    selectedKinds.push(current.rival.attack.kind);
    selectionTimes.push(frame / 60);
    previousSelections = current.rival.stats.attackSelections;
  }
}
assert(selectedKinds.length >= 7, `only ${selectedKinds.length} attacks selected`);
assert(selectedKinds.includes("bow-swipe"));
assert(selectedKinds.includes("vertical-boost"));
assert(selectedKinds.includes("fiddle-drop"));
for (let index = 1; index < selectedKinds.length; index += 1) {
  assert.notEqual(selectedKinds[index], selectedKinds[index - 1]);
  assert(
    selectionTimes[index] - selectionTimes[index - 1] < 6,
    `attack gap too long: ${selectionTimes[index] - selectionTimes[index - 1]}`,
  );
}

const popGame = new PhaseFifteenGame({ leaderboard });
popGame.start(15_002, PLAY_MODES.COW_VS_CAT);
popGame.debugSetBalloons([]);
popGame.debugSetCombo("yellow", 2);
popGame.debugSetPlayer({ x: 270, y: 360, vy: -120, onGround: false });
snapshot = popGame.debugForceRivalFiddleDrop();
assert.equal(snapshot.attack.kind, "fiddle-drop");
assert.equal(snapshot.attack.state, "fiddle-telegraph");
assert.equal(snapshot.visualFrame, "fiddle-drop-windup");
assert.equal(snapshot.stats.fiddleDrops, 1);
const origin = { x: snapshot.x, y: snapshot.y };
const direction = snapshot.attack.fiddleDirection;
popGame.debugSetPlayer({ x: 470, y: 340, vy: -100, onGround: false });
popGame.debugSetBalloons([
  {
    x: origin.x + direction.x * 72,
    y: origin.y + direction.y * 72,
    radius: 23,
    color: "red",
    routeRole: "side",
  },
  {
    x: origin.x + direction.x * 150,
    y: origin.y + direction.y * 150,
    radius: 23,
    color: "blue",
    routeRole: "side",
  },
  {
    x: origin.x + direction.x * 228,
    y: origin.y + direction.y * 228,
    radius: 23,
    color: "green",
    routeRole: "side",
  },
  {
    x: origin.x + direction.x * 112,
    y: origin.y + direction.y * 112,
    radius: 26,
    color: "yellow",
    routeRole: "main",
    landmarkApproach: "prop-plane",
  },
]);
advance(popGame, RIVAL_FIDDLE_DROP.telegraphSeconds + 1 / 60);
snapshot = popGame.getSnapshot();
assert.equal(snapshot.rival.attack.state, "fiddle-active");
assert.equal(snapshot.rival.visualFrame, "fiddle-drop-active");
const lockedDirection = { ...snapshot.rival.attack.fiddleDirection };
popGame.debugSetPlayer({ x: 70, y: 520, vy: 0, onGround: false });
advance(popGame, 0.28);
snapshot = popGame.getSnapshot();
assert.deepEqual(snapshot.rival.attack.fiddleDirection, lockedDirection);
assert.equal(
  snapshot.balloons.filter((balloon) => !balloon.alive).length,
  RIVAL_FIDDLE_DROP.maximumBalloonPopsPerDrop,
);
assert(snapshot.balloons.find((balloon) => balloon.landmarkApproach).alive);
assert.equal(snapshot.rival.stats.fiddleBalloonPops, 2);
assert.equal(snapshot.totalPopped, 0);
assert.equal(snapshot.combo.color, "yellow");
assert.equal(snapshot.combo.streak, 2);
assert.equal(snapshot.eventCounts.rivalFiddleTelegraph, 1);
assert.equal(snapshot.eventCounts.rivalFiddleDrop, 1);
assert.equal(snapshot.eventCounts.rivalBalloonPop, 2);

const hitGame = new PhaseFifteenGame({ leaderboard });
hitGame.start(15_003, PLAY_MODES.COW_VS_CAT);
hitGame.debugSetBalloons([]);
hitGame.debugSetPlayer({ x: 270, y: 360, vy: -120, onGround: false });
snapshot = hitGame.debugForceRivalFiddleDrop();
const hitDirection = snapshot.attack.fiddleDirection;
advance(hitGame, RIVAL_FIDDLE_DROP.telegraphSeconds + 1 / 60);
snapshot = hitGame.getSnapshot();
hitGame.debugSetPlayer({
  x: snapshot.rival.x + hitDirection.x * 54,
  y: snapshot.rival.y + hitDirection.y * 54,
  vy: -100,
  onGround: false,
});
advance(hitGame, 0.08);
snapshot = hitGame.getSnapshot();
assert(snapshot.rival.attack.fiddleHitCow);
assert.equal(snapshot.rival.stats.fiddleCowHits, 1);
assert(snapshot.player.vy > 0);
assert.equal(snapshot.eventCounts.rivalFiddleHit, 1);

const counterGame = new PhaseFifteenGame({ leaderboard });
counterGame.start(15_004, PLAY_MODES.COW_VS_CAT);
counterGame.debugSetBalloons([]);
counterGame.debugSetPlayer({ x: 270, y: 360, vy: -120, onGround: false });
counterGame.debugForceRivalFiddleDrop();
advance(
  counterGame,
  RIVAL_FIDDLE_DROP.telegraphSeconds +
    RIVAL_FIDDLE_DROP.activeSeconds +
    1 / 60,
);
snapshot = counterGame.getSnapshot();
assert.equal(snapshot.rival.attack.state, "fiddle-recovery");
counterGame.debugSetPlayer({
  x: snapshot.rival.x - 14,
  y: snapshot.rival.y - 54,
  vy: -180,
  onGround: false,
  facing: 1,
  slashTimer: PLAYER.slashTime * 0.72,
  cooldown: 0.4,
});
advance(counterGame, 1 / 60);
snapshot = counterGame.getSnapshot();
assert.equal(snapshot.rival.state, "knocked-down");
assert.equal(snapshot.rival.stats.counterBouncesAwarded, 1);

console.log("Phase 15 rival pressure + Fiddle Drop logic audit passed.");
