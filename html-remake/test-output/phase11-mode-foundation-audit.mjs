import assert from "node:assert/strict";
import { PhaseElevenGame } from "../src/game.js";
import {
  PLAY_MODES,
  RIVAL_FOUNDATION,
} from "../src/game-config.js";

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

const game = new PhaseElevenGame({ leaderboard });

assert.equal(RIVAL_FOUNDATION.renderWidth, 160);

game.start(11_001, PLAY_MODES.CLASSIC);
let snapshot = game.getSnapshot();
assert.equal(snapshot.playMode, PLAY_MODES.CLASSIC);
assert.equal(snapshot.rival.present, false);
assert.equal(snapshot.rival.visible, false);
assert.equal(snapshot.leaderboardBalloonCount, 3);
assert(snapshot.scoreIsolation.remoteLeaderboardEnabled);
assert(!snapshot.scoreIsolation.classicLeaderboardWritesBlocked);
assert.equal(snapshot.phaseEleven.publicMenuVisible, false);
assert(snapshot.phaseEleven.devEntryOnly);

game.debugSetSavedBest(123);
game.start(11_002, PLAY_MODES.COW_VS_CAT);
snapshot = game.getSnapshot();
assert.equal(snapshot.playMode, PLAY_MODES.COW_VS_CAT);
assert(snapshot.rival.implemented);
assert(snapshot.rival.present);
assert(snapshot.rival.visible);
assert.equal(snapshot.rival.active, false);
assert.equal(snapshot.rival.state, "inactive-concept");
assert.equal(snapshot.rival.movementEnabled, false);
assert.equal(snapshot.rival.collisionEnabled, false);
assert.equal(snapshot.rival.combatEnabled, false);
assert.deepEqual(snapshot.rival.attacksImplemented, {
  bowSwipe: false,
  fiddleSmash: false,
  catsConcerto: false,
});
assert.equal(snapshot.leaderboardBalloonCount, 0);
assert.equal(snapshot.savedBestHeightMeters, 0);
assert.equal(
  snapshot.scoreIsolation.storageKey,
  RIVAL_FOUNDATION.scoreStorageKey,
);
assert(!snapshot.scoreIsolation.remoteLeaderboardEnabled);
assert(snapshot.scoreIsolation.classicLeaderboardWritesBlocked);

let rival = game.debugSetRival({ x: -10_000 });
assert.equal(rival.x, RIVAL_FOUNDATION.minimumX);
rival = game.debugSetRival({ x: 10_000 });
assert.equal(rival.x, RIVAL_FOUNDATION.maximumX);
rival = game.debugSetRival({ x: 270, visible: false, facing: 1 });
assert.equal(rival.x, 270);
assert.equal(rival.visible, false);
assert.equal(rival.facing, 1);

game.setLeaderboard({
  ...leaderboard,
  topScores: [
    { initials: "NEW", score: 2000, timestamp: 4 },
    ...leaderboard.topScores,
  ],
});
assert.equal(
  game.getSnapshot().leaderboardBalloonCount,
  0,
  "Classic leaderboard markers must stay out of Cow vs Cat runs.",
);

game.debugFinishRun(240);
snapshot = game.getSnapshot();
assert.equal(snapshot.mode, "gameover");
assert.equal(snapshot.finalScoreMeters, 240);
assert.equal(snapshot.savedBestHeightMeters, 240);
assert.equal(snapshot.deathScreen.qualifiesForLeaderboard, false);
assert.equal(game.openLeaderboard(), false);
assert.equal(game.submitTypedInitials("MOO"), "unavailable");

game.start(11_003, PLAY_MODES.CLASSIC);
snapshot = game.getSnapshot();
assert.equal(snapshot.playMode, PLAY_MODES.CLASSIC);
assert.equal(snapshot.savedBestHeightMeters, 123);
assert.equal(snapshot.rival.present, false);
assert.equal(snapshot.leaderboardBalloonCount, 4);
assert.equal(game.debugSetRival({ x: 270 }), null);

console.log(
  JSON.stringify(
    {
      phaseEleven: {
        classicDefaultPreserved: true,
        cowVsCatDevFoundation: true,
        inactiveRivalActor: true,
        rivalScaleRelativeToCow: "about 80%",
        debugPositionClamping: true,
        movementCollisionCombatInactive: true,
        classicLeaderboardMarkersExcluded: true,
        separateLocalBestNamespace: true,
        classicRemoteSubmissionBlocked: true,
        classicModeRestoredWithoutScoreLeak: true,
      },
      networkWritesPerformed: 0,
    },
    null,
    2,
  ),
);
