import assert from "node:assert/strict";
import { PhaseFourteenGame } from "../src/game.js";
import {
  PLAY_MODES,
  PLAYER,
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

const foundation = new PhaseFourteenGame({ leaderboard });
foundation.start(14_000, PLAY_MODES.COW_VS_CAT);
let snapshot = foundation.getSnapshot();
assert(snapshot.phaseFourteen.perFrameNozzleAnchorsImplemented);
assert(snapshot.phaseFourteen.persistentHeatHazeTrailImplemented);
assert(snapshot.phaseFourteen.counterBounceImplemented);
assert(snapshot.phaseFourteen.counterBouncePreservesCombo);
assert.equal(RIVAL_JETPACK.counterBounceSpeed, PLAYER.bounceSpeed * 0.75);
assert.equal(snapshot.phaseFourteen.counterBounceNormalBalloonRatio, 0.75);
assert(snapshot.phaseFourteen.verticalBoostImplemented);
assert(snapshot.phaseFourteen.verticalBoostLocksTrajectory);
assert(snapshot.phaseFourteen.verticalBoostClankImplemented);
assert(snapshot.phaseFourteen.verticalBoostClankPreservesCombo);
assert.equal(RIVAL_VERTICAL_BOOST.hitHalfWidth, 42);
assert.equal(RIVAL_VERTICAL_BOOST.hitReachAbove, 88);
assert.equal(RIVAL_VERTICAL_BOOST.cowKnockbackHorizontal, 430);
assert.equal(RIVAL_VERTICAL_BOOST.cowKnockbackDown, 560);
assert.equal(RIVAL_VERTICAL_BOOST.cowKnockbackDownAdd, 180);
assert.equal(
  RIVAL_VERTICAL_BOOST.clankBounceSpeed,
  PLAYER.bounceSpeed * 0.5,
);
assert.equal(
  snapshot.phaseFourteen.verticalBoostClankNormalBalloonRatio,
  0.5,
);
assert.equal(
  snapshot.phaseFourteen.verticalBoostPopsMaximum,
  RIVAL_VERTICAL_BOOST.maximumBalloonPopsPerBoost,
);
assert.deepEqual(snapshot.phaseFourteen.boostVisualFrames, [
  "boost-charge",
  "boost-active",
]);
assert(snapshot.rival.attacksImplemented.verticalBoost);

foundation.debugSetRival({ skipGrace: true, attackCooldown: 99 });
advance(foundation, 0.3);
snapshot = foundation.getSnapshot();
assert(snapshot.rival.exhaustTrail.length >= 3);
assert(
  snapshot.rival.exhaustTrail.every(
    (point) =>
      point.ageSeconds >= 0 &&
      point.ageSeconds < RIVAL_JETPACK.exhaustTrailLifetimeSeconds,
  ),
);

const counterGame = new PhaseFourteenGame({ leaderboard });
counterGame.start(14_001, PLAY_MODES.COW_VS_CAT);
counterGame.debugSetBalloons([]);
counterGame.debugSetPlayer({
  x: 270,
  y: 360,
  vy: -120,
  onGround: false,
  facing: 1,
});
counterGame.debugSetCombo("yellow", 2);
snapshot = counterGame.debugForceRivalBoost();
counterGame.debugSetPlayer({
  x: snapshot.x - 18,
  y: snapshot.y - 54,
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
assert(snapshot.player.vy < -RIVAL_JETPACK.counterBounceSpeed);
assert(Math.abs(snapshot.player.vy) < PLAYER.bounceSpeed);
assert.equal(snapshot.combo.color, "yellow");
assert.equal(snapshot.combo.streak, 2);
assert.equal(snapshot.eventCounts.rivalCounter, 1);

const boostClankGame = new PhaseFourteenGame({ leaderboard });
boostClankGame.start(14_004, PLAY_MODES.COW_VS_CAT);
boostClankGame.debugSetBalloons([]);
boostClankGame.debugSetCombo("green", 2);
boostClankGame.debugSetPlayer({
  x: 270,
  y: 340,
  vy: -180,
  onGround: false,
});
boostClankGame.debugForceRivalBoost();
advance(
  boostClankGame,
  RIVAL_VERTICAL_BOOST.telegraphSeconds + 1 / 60,
);
snapshot = boostClankGame.getSnapshot();
assert.equal(snapshot.rival.attack.state, "boost-active");
boostClankGame.debugSetPlayer({
  x: snapshot.rival.x - 28,
  y: snapshot.rival.y - 60,
  vy: -120,
  onGround: false,
  facing: 1,
  slashTimer: PLAYER.slashTime * 0.72,
  cooldown: PLAYER.slashCooldown,
});
advance(boostClankGame, 1 / 60);
snapshot = boostClankGame.getSnapshot();
assert.equal(snapshot.rival.attack.state, "boost-active");
assert.equal(snapshot.rival.attack.boostClanked, true);
assert.equal(snapshot.rival.attack.boostHitCow, false);
assert.equal(snapshot.rival.stats.boostClanks, 1);
assert.equal(snapshot.rival.stats.boostCowHits, 0);
assert.equal(snapshot.eventCounts.rivalClank, 1);
assert.equal(snapshot.eventCounts.rivalBoostHit, undefined);
assert.equal(snapshot.combo.color, "green");
assert.equal(snapshot.combo.streak, 2);
assert.equal(snapshot.player.slashing, false);
assert(
  Math.abs(snapshot.player.vy) >=
    RIVAL_VERTICAL_BOOST.clankBounceSpeed,
);
assert(
  Math.abs(snapshot.player.vy) <
    RIVAL_JETPACK.counterBounceSpeed,
);
advance(boostClankGame, 0.08);
snapshot = boostClankGame.getSnapshot();
assert.equal(snapshot.rival.stats.boostClanks, 1);
assert.equal(snapshot.rival.stats.boostCowHits, 0);

const boostPopGame = new PhaseFourteenGame({ leaderboard });
boostPopGame.start(14_002, PLAY_MODES.COW_VS_CAT);
boostPopGame.debugSetBalloons([]);
boostPopGame.debugSetPlayer({ x: 270, y: 340, vy: -450, onGround: false });
snapshot = boostPopGame.debugForceRivalBoost();
assert.equal(snapshot.attack.kind, "vertical-boost");
assert.equal(snapshot.attack.state, "boost-telegraph");
assert.equal(snapshot.visualFrame, "boost-charge");
assert.equal(snapshot.eventCounts, undefined);
advance(boostPopGame, RIVAL_VERTICAL_BOOST.telegraphSeconds + 1 / 60);
snapshot = boostPopGame.getSnapshot();
assert.equal(snapshot.rival.attack.state, "boost-active");
assert.equal(snapshot.rival.visualFrame, "boost-active");
const launchX = snapshot.rival.x;
const launchY = snapshot.rival.y;
boostPopGame.debugSetPlayer({
  x: 470,
  y: launchY - 200,
  vy: -300,
  onGround: false,
});
boostPopGame.debugSetBalloons([
  {
    x: launchX,
    y: launchY - 42,
    radius: 24,
    color: "blue",
    routeRole: "side",
  },
  {
    x: launchX + 4,
    y: launchY - 126,
    radius: 24,
    color: "green",
    routeRole: "side",
  },
  {
    x: launchX,
    y: launchY - 84,
    radius: 26,
    color: "yellow",
    routeRole: "main",
    landmarkApproach: "prop-plane",
  },
]);
advance(boostPopGame, 0.18);
snapshot = boostPopGame.getSnapshot();
assert.equal(snapshot.rival.x, launchX);
assert.equal(
  snapshot.balloons.filter((balloon) => !balloon.alive).length,
  RIVAL_VERTICAL_BOOST.maximumBalloonPopsPerBoost,
);
assert(snapshot.balloons.find((balloon) => balloon.landmarkApproach).alive);
assert.equal(snapshot.rival.stats.boostBalloonPops, 2);
assert.equal(snapshot.totalPopped, 0);
assert.equal(snapshot.combo.color, null);
assert.equal(snapshot.combo.streak, 0);
assert.equal(snapshot.eventCounts.rivalBoostTelegraph, 1);
assert.equal(snapshot.eventCounts.rivalBoost, 1);
assert.equal(snapshot.eventCounts.rivalBalloonPop, 2);
assert(
  snapshot.rival.exhaustTrail.some((point) => point.intensity === 2),
);

const boostHitGame = new PhaseFourteenGame({ leaderboard });
boostHitGame.start(14_003, PLAY_MODES.COW_VS_CAT);
boostHitGame.debugSetBalloons([]);
boostHitGame.debugSetPlayer({ x: 270, y: 340, vy: -450, onGround: false });
boostHitGame.debugForceRivalBoost();
boostHitGame.debugSetPlayer({ x: 470, y: 340, vy: -450, onGround: false });
advance(boostHitGame, RIVAL_VERTICAL_BOOST.telegraphSeconds + 1 / 60);
snapshot = boostHitGame.getSnapshot();
boostHitGame.debugSetPlayer({
  x: snapshot.rival.x + 58,
  y: snapshot.rival.y - 48,
  vy: -200,
  onGround: false,
});
advance(boostHitGame, 1 / 60);
snapshot = boostHitGame.getSnapshot();
assert(snapshot.rival.attack.boostHitCow);
assert.equal(snapshot.rival.stats.boostCowHits, 1);
assert(
  Math.abs(snapshot.player.vx) >=
    RIVAL_VERTICAL_BOOST.cowKnockbackHorizontal,
);
assert(snapshot.player.vy >= RIVAL_VERTICAL_BOOST.cowKnockbackDown);
assert.equal(snapshot.eventCounts.rivalBoostHit, 1);

const fallingHitGame = new PhaseFourteenGame({ leaderboard });
fallingHitGame.start(14_005, PLAY_MODES.COW_VS_CAT);
fallingHitGame.debugSetBalloons([]);
fallingHitGame.debugSetPlayer({ x: 270, y: 340, vy: -450, onGround: false });
fallingHitGame.debugForceRivalBoost();
fallingHitGame.debugSetPlayer({ x: 470, y: 340, vy: -450, onGround: false });
advance(fallingHitGame, RIVAL_VERTICAL_BOOST.telegraphSeconds + 1 / 60);
snapshot = fallingHitGame.getSnapshot();
fallingHitGame.debugSetPlayer({
  x: snapshot.rival.x + 8,
  y: snapshot.rival.y - 48,
  vy: 650,
  onGround: false,
});
advance(fallingHitGame, 1 / 60);
snapshot = fallingHitGame.getSnapshot();
assert(snapshot.rival.attack.boostHitCow);
assert.equal(snapshot.rival.stats.boostCowHits, 1);
assert(
  snapshot.player.vy >=
    650 + RIVAL_VERTICAL_BOOST.cowKnockbackDownAdd,
);
assert.equal(snapshot.eventCounts.rivalBoostHit, 1);

console.log("Phase 14 jet polish + vertical boost logic audit passed.");
