import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ASSET_MANIFEST,
  BUILD_VERSION,
  PHASE,
  RELEASE_CHANNEL,
} from "../src/config.js";
import {
  GAME_WIDTH,
  GOALS,
  GOAL_MARKERS,
  PLAYER,
  SPEED_RAMP,
  WORLD_FLOOR_Y,
} from "../src/game-config.js";
import { PhaseTenGame } from "../src/game.js";
import { normalizeLeaderboardEntries } from "../src/leaderboard.js";
import { BalloonRoute } from "../src/route.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const htmlRoot = path.resolve(scriptDirectory, "..");
const repositoryRoot = path.resolve(htmlRoot, "..");
const releaseRoot = path.join(repositoryRoot, "release", "over-the-moon");
const sourceDirectory = path.join(htmlRoot, "src");

assert.equal(PHASE, 10);
assert.equal(BUILD_VERSION, "10.3.1");
assert.equal(RELEASE_CHANNEL, "production");
assert.equal(ASSET_MANIFEST.length, 25);
for (const asset of ASSET_MANIFEST) {
  assert(
    fs.existsSync(fileURLToPath(asset.src)),
    `Missing production asset: ${asset.id}`,
  );
}

const indexHtml = fs.readFileSync(path.join(htmlRoot, "index.html"), "utf8");
assert(!indexHtml.includes("PHASE 10 · RELEASE CANDIDATE"));
assert(indexHtml.includes('id="how-to-play-button"'));
assert(indexHtml.includes('id="menu-leaderboard-button"'));
assert(!indexHtml.includes('id="start-instructions"'));
assert(indexHtml.includes(`./styles.css?v=${BUILD_VERSION}`));
assert(indexHtml.includes(`./src/main.js?v=${BUILD_VERSION}`));
assert(!indexHtml.includes("HTML Rebuild"));

const sourceFiles = fs
  .readdirSync(sourceDirectory)
  .filter((filename) => filename.endsWith(".js"))
  .sort();
const localImportPattern =
  /from\s+["'](\.\/[^"']+\.js)(\?v=([^"']+))?["']/g;
const importEdges = [];
for (const filename of sourceFiles) {
  const source = fs.readFileSync(path.join(sourceDirectory, filename), "utf8");
  for (const match of source.matchAll(localImportPattern)) {
    importEdges.push({
      importer: filename,
      imported: match[1],
      version: match[3] || null,
    });
    assert.equal(
      match[3],
      BUILD_VERSION,
      `${filename} must version ${match[1]} with the release cache key.`,
    );
  }
}

const serviceWorker = fs.readFileSync(
  path.join(htmlRoot, "service-worker.js"),
  "utf8",
);
assert(serviceWorker.includes(`const BUILD_VERSION = "${BUILD_VERSION}"`));
assert(serviceWorker.includes("self.clients.claim()"));
assert(serviceWorker.includes("request.mode === \"navigate\""));
for (const asset of ASSET_MANIFEST) {
  assert(
    serviceWorker.includes(path.basename(fileURLToPath(asset.src))),
    `Offline shell must precache ${asset.id}.`,
  );
}
for (const filename of sourceFiles) {
  assert(
    serviceWorker.includes(`./src/${filename}?v=${BUILD_VERSION}`),
    `Offline shell must precache ${filename}.`,
  );
}

const webManifest = JSON.parse(
  fs.readFileSync(path.join(htmlRoot, "manifest.webmanifest"), "utf8"),
);
assert.equal(webManifest.orientation, "portrait");
assert.equal(webManifest.start_url, "./");
assert.equal(webManifest.scope, "./");
assert(webManifest.display_override.includes("standalone"));
assert(webManifest.description.toLowerCase().includes("black hole"));

const normalizeSample = normalizeLeaderboardEntries({
  valid: { initials: "moo", score: 123, timestamp: 3 },
  zero: { initials: "ZER", score: 0, timestamp: 2 },
  blocked: { initials: "ASS", score: 999, timestamp: 1 },
  malformed: { initials: "", score: 1000, timestamp: 0 },
});
assert.deepEqual(
  normalizeSample.map(({ initials, score }) => [initials, score]),
  [["MOO", 123]],
);

const speedAtY = (y, type) => {
  if (type === "ground") {
    return 1;
  }
  const heightMeters = Math.max(0, (WORLD_FLOOR_Y - y) / 10);
  return Math.min(
    SPEED_RAMP.maximumMultiplier,
    1 + heightMeters / SPEED_RAMP.referenceHeightMeters,
  );
};

const transitionMargin = (lower, upper) => {
  const verticalGap = lower.y - upper.y;
  if (verticalGap <= 0) {
    return null;
  }
  const multiplier = speedAtY(lower.y, lower.type);
  const launchSpeed = lower.bounceSpeed * multiplier;
  const gravity = PLAYER.gravity * multiplier;
  const discriminant =
    launchSpeed * launchSpeed - 2 * gravity * verticalGap;
  if (discriminant <= 0) {
    return null;
  }

  const descendingCrossingSeconds =
    (launchSpeed + Math.sqrt(discriminant)) / gravity;
  const acceleration = PLAYER.moveAcceleration * multiplier;
  const maximumSpeed = PLAYER.maxRunSpeed * multiplier;
  const accelerationSeconds = maximumSpeed / acceleration;
  const horizontalCapacity =
    descendingCrossingSeconds <= accelerationSeconds
      ? 0.5 *
        acceleration *
        descendingCrossingSeconds *
        descendingCrossingSeconds
      : 0.5 *
          acceleration *
          accelerationSeconds *
          accelerationSeconds +
        maximumSpeed *
          (descendingCrossingSeconds - accelerationSeconds);
  const directDistance = Math.abs(lower.x - upper.x);
  const wrappedDistance = Math.min(
    directDistance,
    GAME_WIDTH - directDistance,
  );
  return {
    horizontal: horizontalCapacity - wrappedDistance,
    vertical:
      (launchSpeed * launchSpeed) / (2 * gravity) - verticalGap,
    verticalGap,
  };
};

const routeSeeds = 1_000;
const swordReachAllowance = 70;
let minimumHorizontalMargin = Number.POSITIVE_INFINITY;
let minimumVerticalMargin = Number.POSITIVE_INFINITY;
let maximumRequiredGap = 0;
let generatedBalloons = 0;
let maximumChoiceCount = 1;

for (let seed = 1; seed <= routeSeeds; seed += 1) {
  const route = new BalloonRoute(seed);
  const balloons = route.spawnThrough(
    GOAL_MARKERS.at(-1).clearanceTopY - 1_200,
  );
  generatedBalloons += balloons.length;
  const surfaces = [
    {
      id: "ground",
      type: "ground",
      x: GAME_WIDTH * 0.5,
      y: WORLD_FLOOR_Y - PLAYER.height * 0.5,
      bounceSpeed: PLAYER.groundJumpSpeed,
    },
    ...balloons
      .filter((balloon) => balloon.routeRole === "main")
      .map((balloon) => ({
        id: balloon.id,
        type: "balloon",
        x: balloon.x,
        y: balloon.y,
        bounceSpeed: PLAYER.bounceSpeed,
      })),
    ...GOAL_MARKERS.map((marker) => ({
      id: marker.id,
      type: "landmark",
      x: marker.x,
      y:
        marker.y +
        marker.hitOffsetY +
        marker.hitHeight * 0.5 -
        swordReachAllowance,
      bounceSpeed: GOALS.bounceSpeed,
    })),
  ].sort((a, b) => b.y - a.y);

  const altitudeGroups = [];
  for (const surface of surfaces) {
    const existing = altitudeGroups.at(-1);
    if (existing?.y === surface.y) {
      existing.surfaces.push(surface);
    } else {
      altitudeGroups.push({
        y: surface.y,
        surfaces: [surface],
      });
    }
  }
  maximumChoiceCount = Math.max(
    maximumChoiceCount,
    ...altitudeGroups.map((group) => group.surfaces.length),
  );

  let reachable = altitudeGroups[0].surfaces.map((surface) => ({
    surface,
    horizontalMargin: Number.POSITIVE_INFINITY,
    verticalMargin: Number.POSITIVE_INFINITY,
  }));
  for (let index = 1; index < altitudeGroups.length; index += 1) {
    const nextReachable = [];
    for (const upper of altitudeGroups[index].surfaces) {
      let best = null;
      for (const lowerPath of reachable) {
        const margin = transitionMargin(lowerPath.surface, upper);
        if (!margin || margin.horizontal < 0 || margin.vertical < 0) {
          continue;
        }
        const candidate = {
          surface: upper,
          horizontalMargin: Math.min(
            lowerPath.horizontalMargin,
            margin.horizontal,
          ),
          verticalMargin: Math.min(
            lowerPath.verticalMargin,
            margin.vertical,
          ),
        };
        if (!best || candidate.horizontalMargin > best.horizontalMargin) {
          best = candidate;
        }
        maximumRequiredGap = Math.max(
          maximumRequiredGap,
          margin.verticalGap,
        );
      }
      if (best) {
        nextReachable.push(best);
      }
    }
    assert(
      nextReachable.length > 0,
      `Seed ${seed} has no reachable main path at ${altitudeGroups[index].y}.`,
    );
    reachable = nextReachable;
  }

  const safestFinish = reachable.sort(
    (a, b) => b.horizontalMargin - a.horizontalMargin,
  )[0];
  minimumHorizontalMargin = Math.min(
    minimumHorizontalMargin,
    safestFinish.horizontalMargin,
  );
  minimumVerticalMargin = Math.min(
    minimumVerticalMargin,
    safestFinish.verticalMargin,
  );
}
assert(minimumHorizontalMargin > 70);
assert(minimumVerticalMargin > 40);

const historyGame = new PhaseTenGame();
historyGame.setViewportHeight(844);
historyGame.start(0x10_00_00);
historyGame.debugJumpToLandmark("black-hole");
const historySnapshot = historyGame.getSnapshot();
assert(historySnapshot.balloonCount <= historySnapshot.route.maxActiveBalloons);
assert(historySnapshot.route.historyBalloonCount > 1_500);
assert(historySnapshot.route.activeHistoryChunkCount <= 4);

const releaseManifestPath = path.join(
  releaseRoot,
  "release-manifest.json",
);
assert(
  fs.existsSync(releaseManifestPath),
  "Run the Phase 10 release build before the release audit.",
);
const releaseManifest = JSON.parse(
  fs.readFileSync(releaseManifestPath, "utf8"),
);
assert.equal(releaseManifest.version, BUILD_VERSION);
assert.equal(releaseManifest.phase, PHASE);
assert.equal(releaseManifest.channel, RELEASE_CHANNEL);
assert.equal(releaseManifest.gameAssetCount, ASSET_MANIFEST.length);
assert.equal(releaseManifest.fileCount, releaseManifest.files.length);
for (const file of releaseManifest.files) {
  const filename = path.join(releaseRoot, file.path);
  assert(fs.existsSync(filename), `Missing release file: ${file.path}`);
  const hash = crypto
    .createHash("sha256")
    .update(fs.readFileSync(filename))
    .digest("hex");
  assert.equal(hash, file.sha256, `Release hash mismatch: ${file.path}`);
}

console.log(
  JSON.stringify(
    {
      release: {
        phase: PHASE,
        version: BUILD_VERSION,
        channel: RELEASE_CHANNEL,
        sourceModules: sourceFiles.length,
        versionedImportEdges: importEdges.length,
        offlineAssets: ASSET_MANIFEST.length,
        packagedFiles: releaseManifest.fileCount,
        packagedBytes: releaseManifest.totalBytes,
        hashesVerified: releaseManifest.files.length,
      },
      routeFairness: {
        seeds: routeSeeds,
        generatedBalloons,
        landmarks: GOAL_MARKERS.length,
        minimumHorizontalMargin: Number(
          minimumHorizontalMargin.toFixed(2),
        ),
        minimumVerticalMargin: Number(minimumVerticalMargin.toFixed(2)),
        maximumRequiredGap: Number(maximumRequiredGap.toFixed(2)),
        maximumSameAltitudeChoices: maximumChoiceCount,
      },
      retainedRoute: {
        historyBalloonsAtBlackHole:
          historySnapshot.route.historyBalloonCount,
        historyChunksAtBlackHole:
          historySnapshot.route.historyChunkCount,
        activeBalloonsAtBlackHole: historySnapshot.balloonCount,
        activeHistoryChunks:
          historySnapshot.route.activeHistoryChunkCount,
      },
      leaderboard: {
        malformedRemoteRowsFiltered: true,
        zeroScoresFiltered: true,
        blockedInitialsFiltered: true,
      },
      pwa: {
        portraitManifest: true,
        completePrecache: true,
        cacheVersion: BUILD_VERSION,
      },
    },
    null,
    2,
  ),
);
