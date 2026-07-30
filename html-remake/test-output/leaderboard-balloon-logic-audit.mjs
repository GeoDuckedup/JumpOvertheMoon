import assert from "node:assert/strict";
import { PhaseSixGame } from "../src/game.js";
import {
  LEADERBOARD_BALLOONS,
  PLAYER,
  WORLD_FLOOR_Y,
} from "../src/game-config.js";

const topScores = Array.from({ length: 12 }, (_, index) => ({
  initials: `A${String(index).padStart(2, "0")}`.slice(-3),
  score: 1_200 - index * 75,
  timestamp: 1_000 + index,
}));
const leaderboard = {
  implemented: true,
  status: "ready",
  localBest: 0,
  localInitials: "AAA",
  topScores,
  pendingCount: 0,
  offlineFallback: true,
  error: null,
};
const events = [];
const game = new PhaseSixGame({
  leaderboard,
  onEvent: (name) => events.push(name),
});
const idleInput = {
  direction: 0,
  consumeAction: () => false,
};

game.start(10_300);
let snapshot = game.getSnapshot();
assert.equal(
  snapshot.leaderboardBalloonCount,
  LEADERBOARD_BALLOONS.limit,
);
assert.equal(snapshot.aliveLeaderboardBalloonCount, 10);
assert.equal(snapshot.poppedLeaderboardBalloonCount, 0);
assert(snapshot.leaderboardBalloonFeature.implemented);
assert(snapshot.leaderboardBalloonFeature.interactive);
assert(snapshot.leaderboardBalloonFeature.goldAura);
assert.equal(
  snapshot.leaderboardBalloonFeature.comboBehavior,
  "displayed-color",
);
assert.deepEqual(
  snapshot.leaderboardBalloonFeature.baseColors,
  LEADERBOARD_BALLOONS.colors,
);
assert(
  snapshot.leaderboardBalloons.every(
    (balloon) =>
      LEADERBOARD_BALLOONS.colors.includes(balloon.color) &&
      balloon.routeRole === "leaderboard" &&
      balloon.leaderboard,
  ),
);
assert.deepEqual(
  snapshot.leaderboardBalloons.map((balloon) => balloon.color),
  ["red", "blue", "green", "yellow", "red", "blue", "green", "yellow", "red", "blue"],
);
assert.deepEqual(
  snapshot.leaderboardBalloons.map((balloon) => balloon.leaderboard.rank),
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
);
assert.deepEqual(
  snapshot.leaderboardBalloons.map((balloon) => balloon.leaderboard.initials),
  topScores.slice(0, 10).map((entry) => entry.initials),
);
for (const balloon of snapshot.leaderboardBalloons) {
  assert.equal(
    balloon.y,
    WORLD_FLOOR_Y - balloon.leaderboard.scoreMeters * 10,
  );
}
assert(
  snapshot.balloonCount <= snapshot.route.maxActiveBalloons,
  "Leaderboard balloons must not count against the bounded route collection.",
);

const warp = game.debugWarpBelowLeaderboardBalloon(1, 3);
assert.equal(warp.leaderboardBalloon.leaderboard.rank, 1);
assert.equal(warp.requestedBalloonsBelow, 3);
assert(warp.targetBalloon);
assert(warp.targetBalloon.y > warp.leaderboardBalloon.y);

game.debugSetBalloons([]);
game.debugSetCombo("red", 2);
const target = game.leaderboardBalloons[0];
target.x = 270;
target.y = 400;
game.debugSetPlayer({
  x: target.x,
  y: target.y - 64,
  vx: 0,
  vy: 0,
  onGround: false,
  slashTimer: 0,
  cooldown: 0,
});
let actionQueued = true;
const slashInput = {
  direction: 0,
  consumeAction: () => {
    const queued = actionQueued;
    actionQueued = false;
    return queued;
  },
};
for (let frame = 0; frame < 12 && target.alive; frame += 1) {
  game.update(1000 / 60, slashInput);
}

snapshot = game.getSnapshot();
assert.equal(snapshot.aliveLeaderboardBalloonCount, 9);
assert.equal(snapshot.poppedLeaderboardBalloonCount, 1);
assert.equal(snapshot.totalPopped, 1);
assert(snapshot.hasPoppedBalloon);
assert.equal(snapshot.combo.color, "red");
assert.equal(snapshot.combo.streak, 3);
assert.equal(snapshot.combo.lastReward, "combo!");
assert.equal(snapshot.leaderboardBalloons[0].alive, false);
assert.equal(snapshot.leaderboardBalloons[0].color, "red");
assert(game.player.vy < -PLAYER.bounceSpeed * 1.1);
assert(events.includes("balloonPop"));
assert(events.includes("bounce"));
assert(!events.includes("match"));
assert(events.includes("combo"));

game.setLeaderboard({ ...leaderboard, status: "loading" });
assert.equal(
  game.getSnapshot().leaderboardBalloons[0].alive,
  false,
  "A leaderboard refresh must not respawn a popped leaderboard balloon.",
);

game.start(10_301);
snapshot = game.getSnapshot();
assert.equal(snapshot.aliveLeaderboardBalloonCount, 10);
assert.equal(snapshot.poppedLeaderboardBalloonCount, 0);
assert.equal(snapshot.leaderboardBalloons[0].alive, true);

const emptyGame = new PhaseSixGame({
  leaderboard: { ...leaderboard, topScores: [] },
});
emptyGame.start(10_302);
emptyGame.update(1000 / 60, idleInput);
assert.equal(emptyGame.getSnapshot().leaderboardBalloonCount, 0);

console.log(
  JSON.stringify(
    {
      leaderboardBalloons: {
        limit: LEADERBOARD_BALLOONS.limit,
        exactScoreHeightMapping: true,
        rankAndInitialsExposed: true,
        interactiveSlashPopBounce: true,
        fourColorRotation: [...LEADERBOARD_BALLOONS.colors],
        goldAuraAndPopEffect: true,
        displayedColorComboBehavior: true,
        poppedStateSurvivesRefresh: true,
        freshRunRespawnsMarkers: true,
        separateFromRouteActiveLimit: true,
        emptyLeaderboardHandled: true,
      },
      networkWritesPerformed: 0,
    },
    null,
    2,
  ),
);
