import assert from "node:assert/strict";
import { PLAY_MODES } from "../src/game-config.js";
import { OverTheMoonGame } from "../src/game.js";
import {
  LEADERBOARD_MODES,
  LeaderboardService,
} from "../src/leaderboard.js";

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};

const remote = {
  [PLAY_MODES.CLASSIC]: [
    { initials: "MOO", score: 900, timestamp: 1 },
  ],
  [PLAY_MODES.COW_VS_CAT]: [
    { initials: "CAT", score: 700, timestamp: 2 },
    { initials: "BOW", score: 450, timestamp: 3 },
  ],
};
const requests = [];
globalThis.fetch = async (url, options = {}) => {
  const playMode = String(url).includes("/cowvscat/")
    ? PLAY_MODES.COW_VS_CAT
    : PLAY_MODES.CLASSIC;
  const method = options.method || "GET";
  requests.push({ playMode, method, url: String(url) });
  if (method === "POST") {
    remote[playMode].push(JSON.parse(options.body));
    return new Response(JSON.stringify({ name: "phase16-test" }));
  }
  return new Response(
    JSON.stringify(
      Object.fromEntries(
        remote[playMode].map((entry, index) => [`row-${index}`, entry]),
      ),
    ),
  );
};

assert.equal(
  LEADERBOARD_MODES.classic.scoresPath,
  "/jumpoverthemoon/scores",
  "Classic must keep its shipping Firebase path.",
);
assert.equal(
  LEADERBOARD_MODES[PLAY_MODES.COW_VS_CAT].scoresPath,
  "/jumpoverthemoon/cowvscat/scores",
);
assert.notEqual(
  LEADERBOARD_MODES.classic.cacheKey,
  LEADERBOARD_MODES[PLAY_MODES.COW_VS_CAT].cacheKey,
);
assert.notEqual(
  LEADERBOARD_MODES.classic.localBestKey,
  LEADERBOARD_MODES[PLAY_MODES.COW_VS_CAT].localBestKey,
);

const classicService = new LeaderboardService({
  playMode: PLAY_MODES.CLASSIC,
});
const rivalService = new LeaderboardService({
  playMode: PLAY_MODES.COW_VS_CAT,
});
await Promise.all([
  classicService.refresh({ force: true }),
  rivalService.refresh({ force: true }),
]);
assert.deepEqual(
  classicService.getSnapshot().topScores.map((entry) => entry.initials),
  ["MOO"],
);
assert.deepEqual(
  rivalService.getSnapshot().topScores.map((entry) => entry.initials),
  ["CAT", "BOW"],
);

await rivalService.submit("RIV", 825);
assert.equal(rivalService.getSnapshot().localBest, 825);
assert.equal(classicService.getSnapshot().localBest, 0);
assert.equal(rivalService.getSnapshot().pendingCount, 0);
assert.equal(classicService.getSnapshot().pendingCount, 0);
assert(
  requests.some(
    (request) =>
      request.playMode === PLAY_MODES.COW_VS_CAT &&
      request.method === "POST" &&
      request.url.includes("/jumpoverthemoon/cowvscat/scores.json"),
  ),
);
assert.equal(
  requests.filter(
    (request) =>
      request.playMode === PLAY_MODES.CLASSIC && request.method === "POST",
  ).length,
  0,
  "A Cat submission must never write to the Classic path.",
);

const classicCache = JSON.parse(
  storage.get(LEADERBOARD_MODES.classic.cacheKey),
);
const rivalCache = JSON.parse(
  storage.get(LEADERBOARD_MODES[PLAY_MODES.COW_VS_CAT].cacheKey),
);
assert.equal(classicCache.best, 0);
assert.equal(rivalCache.best, 825);
assert.equal(
  storage.get(LEADERBOARD_MODES.classic.localBestKey),
  "0",
);
assert.equal(
  storage.get(LEADERBOARD_MODES[PLAY_MODES.COW_VS_CAT].localBestKey),
  "825",
);

const events = [];
const game = new OverTheMoonGame({
  leaderboards: {
    [PLAY_MODES.CLASSIC]: classicService.getSnapshot(),
    [PLAY_MODES.COW_VS_CAT]: rivalService.getSnapshot(),
  },
  onEvent: (name, snapshot) =>
    events.push({ name, playMode: snapshot.playMode }),
});
game.start(16_001, PLAY_MODES.COW_VS_CAT);
let snapshot = game.getSnapshot();
assert.equal(snapshot.playMode, PLAY_MODES.COW_VS_CAT);
assert.equal(snapshot.leaderboard.playMode, PLAY_MODES.COW_VS_CAT);
assert.equal(snapshot.leaderboard.scoresPath, "/jumpoverthemoon/cowvscat/scores");
assert.equal(snapshot.leaderboardBalloonCount, 3);
assert(
  snapshot.leaderboardBalloons.every((balloon) =>
    balloon.id.includes(PLAY_MODES.COW_VS_CAT),
  ),
);
assert(snapshot.leaderboardBalloonFeature.interactive);
assert(snapshot.leaderboardBalloonFeature.goldAura);
assert(snapshot.leaderboardBalloonFeature.modeSpecific);
assert(snapshot.leaderboardBalloonFeature.rivalProtected);
assert.equal(
  snapshot.leaderboardBalloonFeature.comboBehavior,
  "displayed-color",
);
assert(snapshot.phaseSixteen.publicCowVsCatImplemented);
assert(snapshot.phaseSixteen.modeSpecificLeaderboardsImplemented);
assert(snapshot.phaseSixteen.rivalArrivalAfterFirstCowPopImplemented);
assert(snapshot.scoreIsolation.modeSeparated);
assert.equal(snapshot.scoreIsolation.remoteLeaderboardEnabled, true);

game.setLeaderboard(PLAY_MODES.CLASSIC, {
  ...classicService.getSnapshot(),
  topScores: [{ initials: "SUN", score: 999, timestamp: 9 }],
});
snapshot = game.getSnapshot();
assert.equal(snapshot.leaderboard.playMode, PLAY_MODES.COW_VS_CAT);
assert.equal(snapshot.leaderboardBalloonCount, 3);
assert.equal(snapshot.leaderboards.classic.topScores[0].initials, "SUN");
assert.equal(
  snapshot.leaderboards[PLAY_MODES.COW_VS_CAT].topScores[0].initials,
  "RIV",
);

game.debugFinishRun(321);
assert(game.openLeaderboard());
assert.equal(game.submitTypedInitials("M16"), "submitted");
assert(
  events.some(
    (event) =>
      event.name === "scoreSubmit" &&
      event.playMode === PLAY_MODES.COW_VS_CAT,
  ),
);
assert(game.returnToMenu());
assert.equal(game.getSnapshot().mode, "menu");

game.start(16_002, PLAY_MODES.CLASSIC);
snapshot = game.getSnapshot();
assert.equal(snapshot.leaderboard.playMode, PLAY_MODES.CLASSIC);
assert.equal(snapshot.leaderboardBalloonCount, 1);
assert.equal(snapshot.leaderboardBalloons[0].leaderboard.initials, "SUN");
assert(
  snapshot.leaderboardBalloons.every((balloon) =>
    balloon.id.includes(PLAY_MODES.CLASSIC),
  ),
);

console.log(
  JSON.stringify(
    {
      phase16: {
        publicModes: [PLAY_MODES.CLASSIC, PLAY_MODES.COW_VS_CAT],
        classicPathPreserved: LEADERBOARD_MODES.classic.scoresPath,
        rivalPath:
          LEADERBOARD_MODES[PLAY_MODES.COW_VS_CAT].scoresPath,
        isolatedCaches: true,
        isolatedPendingQueues: true,
        modeSpecificInteractiveScoreBalloons: true,
        rivalCannotPopScoreBalloons: true,
        mainMenuReturn: true,
      },
      mockNetworkWrites: requests.filter(
        (request) => request.method === "POST",
      ).length,
      liveNetworkWrites: 0,
    },
    null,
    2,
  ),
);
