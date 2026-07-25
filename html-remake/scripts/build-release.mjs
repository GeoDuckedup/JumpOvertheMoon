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
const htmlSource = path.resolve(scriptDirectory, "..");
const repositoryRoot = path.resolve(htmlSource, "..");
const releaseRoot = path.resolve(
  repositoryRoot,
  process.env.OTM_RELEASE_DIR || "release/over-the-moon",
);
const releaseParent = path.dirname(releaseRoot);
const markerName = ".over-the-moon-release";

const copyFile = (source, destination) => {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
};

const walkFiles = (directory) => {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
};

const sha256 = (filename) =>
  crypto.createHash("sha256").update(fs.readFileSync(filename)).digest("hex");

const validateExistingTarget = () => {
  if (!fs.existsSync(releaseRoot)) {
    return;
  }
  const marker = path.join(releaseRoot, markerName);
  if (!fs.existsSync(marker)) {
    throw new Error(
      `Refusing to replace unmarked directory: ${releaseRoot}`,
    );
  }
};

fs.mkdirSync(releaseParent, { recursive: true });
validateExistingTarget();
const temporaryParent = fs.mkdtempSync(
  path.join(releaseParent, ".over-the-moon-build-"),
);
const temporaryRoot = path.join(temporaryParent, "over-the-moon");
const temporaryHtml = path.join(temporaryRoot, "html-remake");
fs.mkdirSync(temporaryHtml, { recursive: true });

try {
  for (const filename of [
    "index.html",
    "manifest.webmanifest",
    "service-worker.js",
    "styles.css",
  ]) {
    copyFile(
      path.join(htmlSource, filename),
      path.join(temporaryHtml, filename),
    );
  }

  for (const filename of fs.readdirSync(path.join(htmlSource, "src"))) {
    if (filename.endsWith(".js")) {
      copyFile(
        path.join(htmlSource, "src", filename),
        path.join(temporaryHtml, "src", filename),
      );
    }
  }

  for (const filename of fs.readdirSync(
    path.join(htmlSource, "assets", "audio"),
  )) {
    if (filename.endsWith(".wav")) {
      copyFile(
        path.join(htmlSource, "assets", "audio", filename),
        path.join(temporaryHtml, "assets", "audio", filename),
      );
    }
  }

  const copiedAssetNames = new Set();
  for (const asset of ASSET_MANIFEST) {
    const source = fileURLToPath(asset.src);
    const filename = path.basename(source);
    if (copiedAssetNames.has(filename)) {
      continue;
    }
    copiedAssetNames.add(filename);
    copyFile(
      source,
      path.join(
        temporaryRoot,
        "cat-sword-climb",
        "assets",
        filename,
      ),
    );
  }

  const releaseReadme = [
    "# Over the Moon — Production Release",
    "",
    `Build ${BUILD_VERSION} · Phase ${PHASE} · ${RELEASE_CHANNEL}`,
    "",
    "Serve this directory as the web root, then open `/html-remake/`.",
    "Production hosting must use HTTPS for the offline service worker and",
    "installable app behavior. The game itself remains playable without a",
    "leaderboard connection; submitted scores queue locally until online.",
    "",
    "Developer controls are absent by default. Append `?dev=1` to opt in on",
    "a test device, and use `?dev=0` to clear the remembered setting.",
    "",
  ].join("\n");
  fs.writeFileSync(
    path.join(temporaryRoot, "README.md"),
    releaseReadme,
    "utf8",
  );
  fs.writeFileSync(
    path.join(temporaryRoot, markerName),
    `${BUILD_VERSION}\n`,
    "utf8",
  );

  const packagedFiles = walkFiles(temporaryRoot)
    .filter(
      (filename) =>
        path.basename(filename) !== "release-manifest.json",
    )
    .map((filename) => {
      const stats = fs.statSync(filename);
      return {
        path: path.relative(temporaryRoot, filename).split(path.sep).join("/"),
        bytes: stats.size,
        sha256: sha256(filename),
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
  const releaseManifest = {
    name: "Over the Moon",
    version: BUILD_VERSION,
    phase: PHASE,
    channel: RELEASE_CHANNEL,
    entry: "html-remake/",
    generatedAt: new Date().toISOString(),
    fileCount: packagedFiles.length,
    totalBytes: packagedFiles.reduce((sum, file) => sum + file.bytes, 0),
    gameAssetCount: copiedAssetNames.size,
    files: packagedFiles,
  };
  fs.writeFileSync(
    path.join(temporaryRoot, "release-manifest.json"),
    `${JSON.stringify(releaseManifest, null, 2)}\n`,
    "utf8",
  );

  if (fs.existsSync(releaseRoot)) {
    fs.rmSync(releaseRoot, { recursive: true, force: true });
  }
  fs.renameSync(temporaryRoot, releaseRoot);
  console.log(
    JSON.stringify(
      {
        releaseRoot,
        version: BUILD_VERSION,
        phase: PHASE,
        fileCount: releaseManifest.fileCount,
        totalBytes: releaseManifest.totalBytes,
        gameAssetCount: releaseManifest.gameAssetCount,
        entry: path.join(releaseRoot, releaseManifest.entry),
      },
      null,
      2,
    ),
  );
} finally {
  fs.rmSync(temporaryParent, { recursive: true, force: true });
}
