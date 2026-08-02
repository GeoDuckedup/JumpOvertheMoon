import assert from "node:assert/strict";
import { PhaseThirteenGame } from "../src/game.js";
import {
  GAME_WIDTH,
  PLAY_MODES,
  PLAYER,
  RIVAL_BOW_SWIPE,
  RIVAL_CHASE,
  RIVAL_JETPACK,
  ROUTE,
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
  topScores: [
    { initials: "MOO", score: 1200, timestamp: 3 },
    { initials: "CAT", score: 900, timestamp: 2 },
    { initials: "BOW", score: 600, timestamp: 1 },
  ],
  pendingCount: 0,
  offlineFallback: true,
  error: null,
};

const classic = new PhaseThirteenGame({ leaderboard });
classic.start(13_000, PLAY_MODES.CLASSIC);
let snapshot = classic.getSnapshot();
assert.equal(snapshot.playMode, PLAY_MODES.CLASSIC);
assert.equal(snapshot.rival.present, false);
assert.equal(snapshot.route.combatRedundancyEnabled, false);
assert.equal(snapshot.route.combatBackupBalloonCount, 0);
assert.equal(
  snapshot.balloons.some((balloon) =>
    balloon.id.endsWith("-combat-backup"),
  ),
  false,
);
assert.equal(snapshot.leaderboardBalloonCount, 3);

const game = new PhaseThirteenGame({ leaderboard });
game.start(13_001, PLAY_MODES.COW_VS_CAT);
snapshot = game.getSnapshot();
assert.equal(snapshot.rival.state, "waiting-first-pop");
assert.equal(snapshot.rival.visible, false);
assert.equal(snapshot.rival.waitingForFirstCowPop, true);
assert.equal(snapshot.rival.movementModel, "jetpack");
assert(snapshot.rival.combatEnabled);
assert.deepEqual(snapshot.rival.attacksImplemented, {
  bowSwipe: true,
  verticalBoost: true,
  fiddleDrop: true,
  fiddleSmash: true,
  catsConcerto: false,
});
assert(snapshot.phaseThirteen.jetpackPursuitImplemented);
assert(snapshot.phaseThirteen.bowSwipeImplemented);
assert(snapshot.phaseThirteen.telegraphActiveRecoveryWindows);
assert(snapshot.phaseThirteen.swipePopsBalloons);
assert(snapshot.phaseThirteen.touchDoesNotPopBalloons);
assert(snapshot.phaseThirteen.counterFromAboveImplemented);
assert(snapshot.phaseThirteen.threeCounterRetreatImplemented);
assert(snapshot.phaseThirteen.generatedActionSpriteSetImplemented);
assert(snapshot.phaseThirteen.animatedJetFlamesImplemented);
assert.deepEqual(snapshot.phaseThirteen.installedVisualFrames, [
  "hover",
  "bow-windup",
  "bow-slash",
  "fiddle-heavy",
  "concerto",
  "knockdown",
]);
assert(snapshot.route.combatRedundancyEnabled);
assert(snapshot.route.combatBackupBalloonCount > 0);
assert.equal(snapshot.leaderboardBalloonCount, 0);
assert.equal(snapshot.scoreIsolation.remoteLeaderboardEnabled, true);
assert(snapshot.scoreIsolation.modeSeparated);

const normalMains = snapshot.balloons.filter(
  (balloon) =>
    balloon.routeRole === "main" && !balloon.landmarkApproach,
);
for (const main of normalMains) {
  assert(
    snapshot.balloons.some(
      (balloon) =>
        balloon.routeRole === "side" &&
        Math.abs(balloon.y - main.y) <= ROUTE.sideYJitter + 1,
    ),
    `missing Cow vs Cat backup near ${main.id}`,
  );
}

advance(game, RIVAL_CHASE.openingGraceSeconds + 0.1);
snapshot = game.getSnapshot();
assert.equal(snapshot.rival.state, "waiting-first-pop");
assert.equal(snapshot.rival.visible, false);
game.debugPopBalloon("red");
snapshot = game.getSnapshot();
assert.equal(snapshot.rival.state, "grace");
assert.equal(snapshot.rival.waitingForFirstCowPop, false);
for (
  let frame = 0;
  frame < Math.ceil((RIVAL_CHASE.openingGraceSeconds + 0.1) * 60);
  frame += 1
) {
  game.debugSetPlayer({ y: 300, vy: 0, onGround: false });
  game.update(1000 / 60, idleInput);
}
snapshot = game.getSnapshot();
assert(snapshot.rival.active);
assert(snapshot.rival.visible);
assert(snapshot.rival.jetpackActive);
assert.equal(snapshot.rival.onGround, false);

const touchGame = new PhaseThirteenGame({ leaderboard });
touchGame.start(13_002, PLAY_MODES.COW_VS_CAT);
touchGame.debugSetBalloons([
  {
    x: 200,
    y: 500,
    radius: 30,
    color: "blue",
    routeRole: "side",
  },
]);
touchGame.debugSetPlayer({ x: 470, y: 637, vy: 0, onGround: true });
touchGame.debugSetRival({
  skipGrace: true,
  x: 200,
  y: 500,
  vx: 0,
  vy: 0,
  attackCooldown: 99,
});
advance(touchGame, 0.3);
snapshot = touchGame.getSnapshot();
assert(snapshot.balloons[0].alive);
assert.equal(snapshot.rival.stats.balloonPops, 0);
assert.equal(snapshot.eventCounts.rivalBalloonPop, undefined);

const swipePopGame = new PhaseThirteenGame({ leaderboard });
swipePopGame.start(13_003, PLAY_MODES.COW_VS_CAT);
swipePopGame.debugSetBalloons([
  {
    x: 300,
    y: 500,
    radius: 30,
    color: "red",
    routeRole: "main",
  },
  {
    x: 330,
    y: 500,
    radius: 26,
    color: "green",
    routeRole: "side",
  },
]);
swipePopGame.debugSetPlayer({ x: 470, y: 637, vy: 0, onGround: true });
swipePopGame.debugSetRival({
  skipGrace: true,
  x: 200,
  y: 500,
  vx: 0,
  vy: 0,
  attackCooldown: 99,
});
snapshot = swipePopGame.debugForceRivalAttack(1);
assert.equal(snapshot.attack.state, "telegraph");
assert.equal(snapshot.eventCounts, undefined);
advance(
  swipePopGame,
  RIVAL_BOW_SWIPE.telegraphSeconds + RIVAL_BOW_SWIPE.activeSeconds + 0.1,
);
snapshot = swipePopGame.getSnapshot();
assert.equal(
  snapshot.balloons.filter((balloon) => !balloon.alive).length,
  RIVAL_BOW_SWIPE.maximumBalloonPopsPerSwipe,
);
assert.equal(snapshot.rival.stats.bowSwipes, 1);
assert.equal(snapshot.rival.stats.balloonPops, 1);
assert.equal(snapshot.rival.attack.balloonsPopped, 1);
assert.equal(snapshot.eventCounts.rivalSwipeTelegraph, 1);
assert.equal(snapshot.eventCounts.rivalSwipe, 1);
assert.equal(snapshot.eventCounts.rivalBalloonPop, 1);
assert.equal(snapshot.totalPopped, 0);
assert.equal(snapshot.hasPoppedBalloon, false);
assert.equal(snapshot.combo.color, null);
assert.equal(snapshot.combo.streak, 0);
assert.equal(snapshot.floorRule, "safe-before-first-pop");

const landmarkGame = new PhaseThirteenGame({ leaderboard });
landmarkGame.start(13_004, PLAY_MODES.COW_VS_CAT);
landmarkGame.debugSetBalloons([
  {
    x: 300,
    y: 500,
    radius: 30,
    color: "yellow",
    routeRole: "main",
    landmarkApproach: "prop-plane",
  },
]);
landmarkGame.debugSetPlayer({ x: 470, y: 637, vy: 0, onGround: true });
landmarkGame.debugSetRival({ skipGrace: true, x: 200, y: 500 });
landmarkGame.debugForceRivalAttack(1);
advance(
  landmarkGame,
  RIVAL_BOW_SWIPE.telegraphSeconds + RIVAL_BOW_SWIPE.activeSeconds + 0.1,
);
snapshot = landmarkGame.getSnapshot();
assert(snapshot.balloons[0].alive);
assert.equal(snapshot.rival.stats.balloonPops, 0);

const hitGame = new PhaseThirteenGame({ leaderboard });
hitGame.start(13_005, PLAY_MODES.COW_VS_CAT);
hitGame.debugSetBalloons([]);
hitGame.debugSetPlayer({
  x: 330,
  y: 637,
  vy: 0,
  onGround: true,
});
hitGame.debugSetRival({ skipGrace: true, x: 200, y: 576, vx: 0, vy: 0 });
hitGame.debugForceRivalAttack(1);
for (let frame = 0; frame < 60; frame += 1) {
  hitGame.update(1000 / 60, idleInput);
  if (hitGame.getSnapshot().rival.stats.cowHits > 0) {
    break;
  }
}
snapshot = hitGame.getSnapshot();
assert.equal(snapshot.rival.stats.cowHits, 1);
assert(snapshot.rival.attack.hitCow);
assert(snapshot.player.vx > 0);
assert(snapshot.player.vy > 0);
assert.equal(snapshot.eventCounts.rivalHit, 1);
assert.equal(snapshot.mode, "playing");

const counterGame = new PhaseThirteenGame({ leaderboard });
counterGame.start(13_006, PLAY_MODES.COW_VS_CAT);
counterGame.debugSetBalloons([]);
for (let hit = 1; hit <= RIVAL_JETPACK.countersBeforeRetreat; hit += 1) {
  if (hit > 1) {
    advance(counterGame, RIVAL_JETPACK.knockdownSeconds + 0.1);
  }
  counterGame.debugSetRival({
    skipGrace: true,
    x: 280,
    y: 450,
    vx: 0,
    vy: 0,
    attackCooldown: 99,
  });
  counterGame.debugSetPlayer({
    x: 260,
    y: 395,
    vy: -200,
    onGround: false,
    facing: 1,
    slashTimer: PLAYER.slashTime * 0.72,
    cooldown: 0.4,
  });
  counterGame.debugForceRivalAttack(-1);
  advance(counterGame, 1 / 60);
  snapshot = counterGame.getSnapshot();
  assert.equal(snapshot.rival.state, "knocked-down");
  assert.equal(snapshot.rival.stats.counterHitsTaken, hit);
  assert.equal(snapshot.rival.jetpackActive, false);
}
assert(snapshot.rival.retreatPending);
assert.equal(snapshot.rival.stats.retreats, 1);
assert.equal(snapshot.eventCounts.rivalCounter, 2);
assert.equal(snapshot.eventCounts.rivalRetreat, 1);

const edgeGame = new PhaseThirteenGame({ leaderboard });
edgeGame.start(13_007, PLAY_MODES.COW_VS_CAT);
edgeGame.debugSetPlayer({ x: 500, y: 500, vy: 0, onGround: false });
edgeGame.debugSetRival({
  skipGrace: true,
  x: GAME_WIDTH - RIVAL_CHASE.edgeInsetX - 1,
  y: 500,
  vx: RIVAL_JETPACK.maxHorizontalSpeed,
  vy: 0,
  orbitSide: 1,
  attackCooldown: 99,
});
advance(edgeGame, 1 / 60);
snapshot = edgeGame.getSnapshot();
assert.equal(snapshot.rival.x, GAME_WIDTH - RIVAL_CHASE.edgeInsetX);
assert(snapshot.rival.vx < 0);
assert.equal(snapshot.rival.facing, -1);
assert(snapshot.rival.stats.edgeTurns >= 1);

console.log("Phase 13 jetpack + bow swipe logic audit passed.");
