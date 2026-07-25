import assert from "node:assert/strict";
import { ambienceProfileAtHeight } from "../src/audio.js";
import {
  BACKGROUND_PHASES,
  GOAL_MARKERS,
  UPPER_COSMOS_CHAPTERS,
} from "../src/game-config.js";
import { PhaseNineGame } from "../src/game.js";

const expectedChapters = [
  ["kuiper-belt", 7600, 8600, "kuiper"],
  ["heliopause", 10000, 11500, "heliopause"],
  ["interstellar", 12500, 14000, "interstellar"],
  ["proxima-region", 15500, 16600, "proxima"],
  ["black-hole-region", 17500, 18500, "gravity"],
];

assert.deepEqual(
  UPPER_COSMOS_CHAPTERS.map(({ id, startHeightMeters }) => [
    id,
    startHeightMeters,
  ]),
  expectedChapters.map(([id, startHeightMeters]) => [
    id,
    startHeightMeters,
  ]),
);
for (let index = 1; index < BACKGROUND_PHASES.length; index += 1) {
  assert(
    BACKGROUND_PHASES[index].height > BACKGROUND_PHASES[index - 1].height,
    "Background anchors must remain strictly ordered.",
  );
}

const game = new PhaseNineGame();
game.start(9009);
const chapterSnapshots = [];
for (const [id, , heightMeters, motif] of expectedChapters) {
  game.debugSetPlayer({
    x: 270,
    y: 660 - heightMeters * 10,
    vx: 0,
    vy: 0,
    onGround: false,
  });
  const snapshot = game.getSnapshot();
  const ambience = ambienceProfileAtHeight(heightMeters);
  assert.equal(snapshot.background.dominant, id);
  assert.equal(snapshot.background.dominantLabel.length > 0, true);
  assert(
    snapshot.background.motifs[motif] >= 0.999,
    `${id} should expose its full visual motif at ${heightMeters} m.`,
  );
  assert.equal(ambience.dominant, id);
  assert(snapshot.balloonCount <= snapshot.route.maxActiveBalloons);
  chapterSnapshots.push({
    id,
    heightMeters,
    background: snapshot.background,
    ambience,
  });
}

const transitionCases = [
  [10000, "kuiper", "heliopause"],
  [12450, "heliopause", "interstellar"],
  [15450, "interstellar", "proxima"],
  [17500, "proxima", "gravity"],
];
const transitions = [];
for (const [heightMeters, from, to] of transitionCases) {
  game.debugSetPlayer({
    y: 660 - heightMeters * 10,
    vy: 0,
    onGround: false,
  });
  const background = game.getSnapshot().background;
  assert(
    background.motifs[from] > 0.45 &&
      background.motifs[from] < 0.55 &&
      background.motifs[to] > 0.45 &&
      background.motifs[to] < 0.55,
    `${heightMeters} m should be a smooth midpoint crossfade.`,
  );
  const ambience = ambienceProfileAtHeight(heightMeters);
  assert(ambience.mix > 0.45 && ambience.mix < 0.55);
  transitions.push({ heightMeters, background, ambience });
}

for (let heightMeters = 0; heightMeters <= 22000; heightMeters += 100) {
  game.debugSetPlayer({
    y: 660 - heightMeters * 10,
    vy: 0,
    onGround: false,
  });
  const background = game.getSnapshot().background;
  for (const value of Object.values(background.motifs)) {
    assert(Number.isFinite(value));
    assert(value >= 0 && value <= 1);
  }
  const ambience = ambienceProfileAtHeight(heightMeters);
  assert(ambience.airLevel >= 0 && ambience.airLevel <= 0.04);
  assert(
    ambience.airCutoffHz >= 1000 - 100 &&
      ambience.airCutoffHz <= 3400,
  );
  assert(
    ambience.humFrequencyHz >= 40 &&
      ambience.humFrequencyHz <= 90,
  );
  assert(ambience.humLevel >= 0 && ambience.humLevel <= 0.02);
}

const finalSnapshot = game.getSnapshot();
assert(finalSnapshot.phaseNine.upperCosmosChaptersImplemented);
assert(finalSnapshot.phaseNine.chapterAwareAmbienceImplemented);
assert(finalSnapshot.phaseNine.smoothCrossfadesImplemented);
assert(finalSnapshot.phaseNine.gameplayGeometryUnchanged);
assert.equal(finalSnapshot.phaseNine.chapters.length, 5);
assert.equal(GOAL_MARKERS.length, 15);
assert.equal(
  GOAL_MARKERS.at(-1).heightMeters,
  18500,
  "Phase 9 must not move the approved landmark route.",
);

console.log(
  JSON.stringify(
    {
      chapters: chapterSnapshots,
      transitions,
      backgroundAnchorCount: BACKGROUND_PHASES.length,
      landmarkGeometryPreserved: true,
      boundedRoutePreserved: true,
    },
    null,
    2,
  ),
);
