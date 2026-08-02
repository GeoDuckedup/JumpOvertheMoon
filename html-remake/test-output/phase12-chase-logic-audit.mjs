import assert from "node:assert/strict";
import { PhaseTwelveGame } from "../src/game.js";
import {
  PLAY_MODES,
  RIVAL_CHASE,
  RIVAL_FOUNDATION,
} from "../src/game-config.js";

const idleInput = {
  direction: 0,
  consumeAction() {
    return false;
  },
};

const advance = (game, seconds) => {
  const frames = Math.round(seconds * 60);
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

const classic = new PhaseTwelveGame({ leaderboard });
classic.start(12_000, PLAY_MODES.CLASSIC);
let snapshot = classic.getSnapshot();
assert.equal(snapshot.playMode, PLAY_MODES.CLASSIC);
assert.equal(snapshot.rival.present, false);
assert.equal(snapshot.rival.movementEnabled, false);
assert.equal(snapshot.leaderboardBalloonCount, 3);

const game = new PhaseTwelveGame({ leaderboard });
game.start(12_001, PLAY_MODES.COW_VS_CAT);
snapshot = game.getSnapshot();
assert.equal(snapshot.rival.state, "grace");
assert.equal(snapshot.rival.visible, false);
assert.equal(snapshot.rival.active, false);
assert.equal(snapshot.rival.movementEnabled, true);
assert.equal(snapshot.rival.graceRemainingSeconds, 2.75);
assert.equal(snapshot.rival.collisionEnabled, false);
assert.equal(snapshot.rival.combatEnabled, false);
assert.deepEqual(snapshot.rival.attacksImplemented, {
  bowSwipe: false,
  fiddleSmash: false,
  catsConcerto: false,
});
assert(snapshot.phaseTwelve.pursuitMovementImplemented);
assert(snapshot.phaseTwelve.openingGraceImplemented);
assert(snapshot.phaseTwelve.balloonTraversalImplemented);
assert(snapshot.phaseTwelve.balloonTraversalConsumesBalloons);
assert.equal(snapshot.phaseTwelve.catPopsAffectCowScoreOrCombo, false);
assert(snapshot.phaseTwelve.protectedCowRouteImplemented);
assert(snapshot.phaseTwelve.recoveryUsesVisibleScreenBoundary);
assert.equal(snapshot.phaseTwelve.rivalHorizontalWrapEnabled, false);
assert.equal(snapshot.phaseTwelve.artificialRivalShadow, false);
assert(snapshot.phaseTwelve.softEngagementBandImplemented);
assert.equal(snapshot.leaderboardBalloonCount, 0);
assert.equal(
  snapshot.scoreIsolation.storageKey,
  RIVAL_FOUNDATION.scoreStorageKey,
);
assert.equal(snapshot.scoreIsolation.remoteLeaderboardEnabled, false);

advance(game, 2.5);
snapshot = game.getSnapshot();
assert.equal(snapshot.rival.state, "grace");
assert.equal(snapshot.rival.visible, false);

advance(game, 2.5);
snapshot = game.getSnapshot();
assert(snapshot.rival.active);
assert(snapshot.rival.visible);
assert.notEqual(snapshot.rival.state, "grace");
assert(snapshot.rival.stats.entries >= 1);
assert(snapshot.rival.stats.jumps >= 1);
assert.equal(snapshot.totalPopped, 0);
assert.equal(snapshot.hasPoppedBalloon, false);

const stageRivalLanding = (landingGame, balloons, balloonIndex = 0) => {
  landingGame.start(22_000 + balloonIndex, PLAY_MODES.COW_VS_CAT);
  landingGame.debugSetBalloons(balloons);
  const balloon = balloons[balloonIndex];
  landingGame.debugSetRival({
    skipGrace: true,
    x: balloon.x,
    y:
      balloon.y -
      balloon.radius * 0.58 -
      RIVAL_CHASE.physicsHeight * 0.5 -
      1,
    vx: 0,
    vy: 120,
    onGround: false,
  });
  advance(landingGame, 1 / 60);
  return landingGame.getSnapshot();
};

const sidePopGame = new PhaseTwelveGame({ leaderboard });
snapshot = stageRivalLanding(sidePopGame, [
  {
    x: 200,
    y: 500,
    radius: 30,
    color: "blue",
    routeRole: "side",
  },
]);
assert.equal(snapshot.balloons[0].alive, false);
assert.equal(snapshot.rival.stats.balloonBounces, 1);
assert.equal(snapshot.rival.stats.balloonPops, 1);
assert.equal(snapshot.rival.stats.sideBalloonPops, 1);
assert.equal(snapshot.rival.stats.mainBalloonPops, 0);
assert.equal(snapshot.eventCounts.rivalBalloonPop, 1);
assert.equal(snapshot.totalPopped, 0);
assert.equal(snapshot.hasPoppedBalloon, false);
assert.equal(snapshot.combo.color, null);
assert.equal(snapshot.combo.streak, 0);
assert.equal(snapshot.floorRule, "safe-before-first-pop");

const protectedMainGame = new PhaseTwelveGame({ leaderboard });
snapshot = stageRivalLanding(protectedMainGame, [
  {
    x: 200,
    y: 500,
    radius: 30,
    color: "red",
    routeRole: "main",
  },
]);
assert(snapshot.balloons[0].alive);
assert.equal(snapshot.rival.stats.balloonBounces, 0);
assert.equal(snapshot.rival.stats.balloonPops, 0);

const alternateRouteGame = new PhaseTwelveGame({ leaderboard });
snapshot = stageRivalLanding(alternateRouteGame, [
  {
    x: 200,
    y: 500,
    radius: 30,
    color: "red",
    routeRole: "main",
  },
  {
    x: 400,
    y: 530,
    radius: 28,
    color: "green",
    routeRole: "side",
  },
]);
assert.equal(snapshot.balloons[0].alive, false);
assert(snapshot.balloons[1].alive);
assert.equal(snapshot.rival.stats.mainBalloonPops, 1);
assert.equal(snapshot.totalPopped, 0);

const landmarkApproachGame = new PhaseTwelveGame({ leaderboard });
snapshot = stageRivalLanding(landmarkApproachGame, [
  {
    x: 200,
    y: 500,
    radius: 30,
    color: "yellow",
    routeRole: "main",
    landmarkApproach: "prop-plane",
  },
  {
    x: 400,
    y: 530,
    radius: 28,
    color: "green",
    routeRole: "side",
  },
]);
assert(snapshot.balloons[0].alive);
assert.equal(snapshot.rival.stats.balloonPops, 0);

const frozen = game.debugSetRival({ frozen: true });
assert.equal(frozen.state, "frozen");
const frozenPosition = { x: frozen.x, y: frozen.y };
advance(game, 1);
snapshot = game.getSnapshot();
assert.deepEqual(
  { x: snapshot.rival.x, y: snapshot.rival.y },
  frozenPosition,
);

assert.equal(
  game.debugSetRival({ chaseSpeedScale: -100 }).chaseSpeedScale,
  RIVAL_CHASE.speedMinimum,
);
assert.equal(
  game.debugSetRival({ chaseSpeedScale: 100 }).chaseSpeedScale,
  RIVAL_CHASE.speedMaximum,
);
game.debugSetRival({ chaseSpeedScale: 1, frozen: false });
game.debugSetRival({ breatherInSeconds: 0 });
advance(game, 1 / 60);
snapshot = game.getSnapshot();
assert.equal(snapshot.rival.state, "breather");
assert(snapshot.rival.stats.breathers >= 1);

game.debugSetRival({
  x: 481,
  y: 500,
  vx: RIVAL_CHASE.maxRunSpeed,
  vy: 0,
  onGround: false,
  frozen: false,
});
advance(game, 1 / 60);
snapshot = game.getSnapshot();
assert.equal(snapshot.rival.x, 482);
assert(snapshot.rival.vx < 0);
assert.equal(snapshot.rival.facing, -1);
assert(snapshot.rival.stats.edgeTurns >= 1);

game.debugSetPlayer({
  x: 270,
  y: -2200,
  previousY: -2200,
  vy: 0,
  onGround: false,
});
const offscreenRecoveryX = 178;
snapshot = game.getSnapshot();
game.debugSetRival({
  x: offscreenRecoveryX,
  y:
    snapshot.camera.y +
    snapshot.camera.viewportHeight +
    RIVAL_CHASE.recoveryOffscreenMargin +
    1,
  frozen: false,
  vy: 10,
  onGround: false,
});
advance(game, 1 / 60);
snapshot = game.getSnapshot();
assert.equal(snapshot.rival.state, "recovering");
assert.equal(snapshot.rival.visible, false);
assert.equal(snapshot.rival.active, false);
assert.equal(snapshot.rival.stats.recoveries, 1);
assert.equal(snapshot.rival.recoveryX, offscreenRecoveryX);
advance(game, RIVAL_CHASE.recoveryDelaySeconds);
snapshot = game.getSnapshot();
assert.equal(snapshot.rival.state, "reentering");
assert(snapshot.rival.visible);
assert(snapshot.rival.active);
assert.equal(snapshot.rival.stats.entries, 2);
assert.equal(snapshot.rival.x, offscreenRecoveryX);

game.debugFinishRun(240);
snapshot = game.getSnapshot();
assert.equal(snapshot.mode, "gameover");
assert.equal(snapshot.deathScreen.qualifiesForLeaderboard, false);
assert.equal(game.openLeaderboard(), false);
assert.equal(game.submitTypedInitials("MOO"), "unavailable");

const deterministicA = new PhaseTwelveGame({ leaderboard });
const deterministicB = new PhaseTwelveGame({ leaderboard });
deterministicA.start(12_777, PLAY_MODES.COW_VS_CAT);
deterministicB.start(12_777, PLAY_MODES.COW_VS_CAT);
advance(deterministicA, 8);
advance(deterministicB, 8);
assert.deepEqual(
  deterministicA.getSnapshot().rival,
  deterministicB.getSnapshot().rival,
);

console.log(
  JSON.stringify(
    {
      phaseTwelve: {
        devOnlyModePreserved: true,
        deterministicPursuit: true,
        openingGraceSeconds: RIVAL_CHASE.openingGraceSeconds,
        activeJumpAndBalloonTraversal: true,
        catPopsVisibleBalloons: true,
        catPopsDoNotAffectCowScoreOrCombo: true,
        mainRouteProtectedWithoutAlternative: true,
        landmarkApproachesProtected: true,
        directEdgeTurnsWithoutWrap: true,
        breatherRhythm: true,
        softEngagementBand: true,
        visibleScreenBoundaryRecoveryAndSameXReturn: true,
        freezeControl: true,
        chaseSpeedRange: [
          RIVAL_CHASE.speedMinimum,
          RIVAL_CHASE.speedMaximum,
        ],
        cowCollision: false,
        rivalCombat: false,
        classicScoreSubmissionBlocked: true,
      },
      networkWritesPerformed: 0,
    },
    null,
    2,
  ),
);
