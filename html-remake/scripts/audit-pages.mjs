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

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const htmlRoot = path.resolve(scriptDirectory, "..");
const repositoryRoot = path.resolve(htmlRoot, "..");
const pagesRoot = path.join(repositoryRoot, "docs");
const expectedPublicUrl =
  "https://geoduckedup.github.io/JumpOvertheMoon/";

const sha256 = (filename) =>
  crypto.createHash("sha256").update(fs.readFileSync(filename)).digest("hex");

assert(fs.existsSync(path.join(pagesRoot, ".over-the-moon-pages")));
assert(fs.existsSync(path.join(pagesRoot, ".nojekyll")));
assert(!fs.existsSync(path.join(pagesRoot, "html-remake")));
assert(!fs.existsSync(path.join(pagesRoot, "cat-sword-climb.apk")));
assert(!fs.existsSync(path.join(pagesRoot, "cat-sword-climb.tar.gz")));

const indexHtml = fs.readFileSync(path.join(pagesRoot, "index.html"), "utf8");
assert(indexHtml.includes(`./styles.css?v=${BUILD_VERSION}`));
assert(indexHtml.includes(`./src/main.js?v=${BUILD_VERSION}`));
assert(indexHtml.includes('id="start-button"'));
assert(!indexHtml.includes("pygbag"));
assert(!indexHtml.includes("pygame-web.github.io"));

const pagesConfig = fs.readFileSync(
  path.join(pagesRoot, "src", "config.js"),
  "utf8",
);
assert(pagesConfig.includes("../assets/game/"));
assert(!pagesConfig.includes("../../cat-sword-climb/assets/"));

const serviceWorker = fs.readFileSync(
  path.join(pagesRoot, "service-worker.js"),
  "utf8",
);
assert(serviceWorker.includes(`const BUILD_VERSION = "${BUILD_VERSION}"`));
assert(serviceWorker.includes("./assets/game/"));
assert(!serviceWorker.includes("../cat-sword-climb/assets/"));

const webManifest = JSON.parse(
  fs.readFileSync(
    path.join(pagesRoot, "manifest.webmanifest"),
    "utf8",
  ),
);
assert.equal(webManifest.start_url, "./");
assert.equal(webManifest.scope, "./");
assert(
  webManifest.icons.every((icon) =>
    icon.src.startsWith("./assets/game/"),
  ),
);

const leaderboardSource = fs.readFileSync(
  path.join(pagesRoot, "src", "leaderboard.js"),
  "utf8",
);
assert(
  leaderboardSource.includes(
    "https://over-the-moon-14b50-default-rtdb.firebaseio.com",
  ),
);
assert(
  leaderboardSource.includes(
    'scoresPath: "/jumpoverthemoon/scores"',
  ),
);
assert(
  leaderboardSource.includes(
    'scoresPath: "/jumpoverthemoon/cowvscat/scores"',
  ),
);

for (const asset of ASSET_MANIFEST) {
  const filename = path.basename(fileURLToPath(asset.src));
  assert(
    fs.existsSync(path.join(pagesRoot, "assets", "game", filename)),
    `Missing Pages game asset: ${filename}`,
  );
  assert(
    serviceWorker.includes(`./assets/game/${filename}`),
    `Pages service worker does not precache ${filename}.`,
  );
}

const releaseManifestPath = path.join(
  pagesRoot,
  "release-manifest.json",
);
const releaseManifest = JSON.parse(
  fs.readFileSync(releaseManifestPath, "utf8"),
);
assert.equal(releaseManifest.version, BUILD_VERSION);
assert.equal(releaseManifest.phase, PHASE);
assert.equal(releaseManifest.channel, RELEASE_CHANNEL);
assert.equal(releaseManifest.hosting, "github-pages");
assert.equal(releaseManifest.publicUrl, expectedPublicUrl);
assert.equal(releaseManifest.entry, "./");
assert.equal(releaseManifest.gameAssetCount, ASSET_MANIFEST.length);
assert.equal(releaseManifest.files.length, releaseManifest.fileCount);

for (const file of releaseManifest.files) {
  const filename = path.join(pagesRoot, file.path);
  assert(fs.existsSync(filename), `Missing packaged file: ${file.path}`);
  assert.equal(fs.statSync(filename).size, file.bytes);
  assert.equal(sha256(filename), file.sha256);
}

console.log(
  JSON.stringify(
    {
      version: BUILD_VERSION,
      phase: PHASE,
      publicUrl: expectedPublicUrl,
      fileCount: releaseManifest.fileCount,
      totalBytes: releaseManifest.totalBytes,
      gameAssetCount: releaseManifest.gameAssetCount,
      firebaseProject: "over-the-moon-14b50",
      firebasePath: "/jumpoverthemoon/scores",
      rootEntry: true,
      serviceWorkerRootScope: true,
      hashesVerified: releaseManifest.fileCount,
    },
    null,
    2,
  ),
);
