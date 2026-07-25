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
const releaseRoot = path.join(repositoryRoot, "release", "over-the-moon");
const releaseHtmlRoot = path.join(releaseRoot, "html-remake");
const releaseAssetRoot = path.join(
  releaseRoot,
  "cat-sword-climb",
  "assets",
);
const pagesRoot = path.join(repositoryRoot, "docs");
const markerName = ".over-the-moon-pages";
const publicUrl = "https://geoduckedup.github.io/JumpOvertheMoon/";
const legacyFiles = new Set([
  "cat-sword-climb.apk",
  "cat-sword-climb.tar.gz",
  "favicon.png",
  "index.html",
  "splash_over_the_moon.png",
]);

const copyTree = (source, destination) => {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyTree(sourcePath, destinationPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
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

const validateRelease = () => {
  const manifestPath = path.join(releaseRoot, "release-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      "Missing release package. Run npm run build before building Pages.",
    );
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (
    manifest.version !== BUILD_VERSION ||
    manifest.phase !== PHASE ||
    manifest.channel !== RELEASE_CHANNEL
  ) {
    throw new Error(
      `Release package does not match build ${BUILD_VERSION} / phase ${PHASE}.`,
    );
  }
  if (!fs.existsSync(releaseHtmlRoot) || !fs.existsSync(releaseAssetRoot)) {
    throw new Error("Release package is missing its HTML or game assets.");
  }
};

const validateExistingPagesTarget = () => {
  if (!fs.existsSync(pagesRoot)) {
    return;
  }
  if (fs.existsSync(path.join(pagesRoot, markerName))) {
    return;
  }
  const existingFiles = walkFiles(pagesRoot)
    .map((filename) =>
      path.relative(pagesRoot, filename).split(path.sep).join("/"),
    )
    .filter((filename) => filename !== ".DS_Store");
  const unexpected = existingFiles.filter(
    (filename) => !legacyFiles.has(filename),
  );
  if (
    unexpected.length ||
    existingFiles.length !== legacyFiles.size ||
    existingFiles.some((filename) => !legacyFiles.has(filename))
  ) {
    throw new Error(
      `Refusing to replace unrecognized docs/ contents: ${
        unexpected.join(", ") || existingFiles.join(", ")
      }`,
    );
  }
};

const rewriteFile = (filename, replacements) => {
  let source = fs.readFileSync(filename, "utf8");
  for (const [before, after] of replacements) {
    if (!source.includes(before)) {
      throw new Error(
        `Expected Pages path token was not found in ${filename}: ${before}`,
      );
    }
    source = source.split(before).join(after);
  }
  fs.writeFileSync(filename, source, "utf8");
};

validateRelease();
validateExistingPagesTarget();

const temporaryParent = fs.mkdtempSync(
  path.join(repositoryRoot, ".over-the-moon-pages-"),
);
const temporaryRoot = path.join(temporaryParent, "docs");
const previousRoot = path.join(temporaryParent, "previous-docs");
let previousMoved = false;

try {
  copyTree(releaseHtmlRoot, temporaryRoot);
  copyTree(releaseAssetRoot, path.join(temporaryRoot, "assets", "game"));

  rewriteFile(path.join(temporaryRoot, "src", "config.js"), [
    ["../../cat-sword-climb/assets/", "../assets/game/"],
  ]);
  rewriteFile(path.join(temporaryRoot, "service-worker.js"), [
    ["../cat-sword-climb/assets/", "./assets/game/"],
  ]);

  const manifestPath = path.join(temporaryRoot, "manifest.webmanifest");
  const webManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  webManifest.icons = webManifest.icons.map((icon) => ({
    ...icon,
    src: icon.src.replace(
      "../cat-sword-climb/assets/",
      "./assets/game/",
    ),
  }));
  fs.writeFileSync(
    manifestPath,
    `${JSON.stringify(webManifest, null, 2)}\n`,
    "utf8",
  );

  fs.writeFileSync(path.join(temporaryRoot, ".nojekyll"), "", "utf8");
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
        path: path
          .relative(temporaryRoot, filename)
          .split(path.sep)
          .join("/"),
        bytes: stats.size,
        sha256: sha256(filename),
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
  const pagesManifest = {
    name: "Over the Moon",
    version: BUILD_VERSION,
    phase: PHASE,
    channel: RELEASE_CHANNEL,
    hosting: "github-pages",
    publicUrl,
    entry: "./",
    generatedAt: new Date().toISOString(),
    fileCount: packagedFiles.length,
    totalBytes: packagedFiles.reduce((sum, file) => sum + file.bytes, 0),
    gameAssetCount: ASSET_MANIFEST.length,
    files: packagedFiles,
  };
  fs.writeFileSync(
    path.join(temporaryRoot, "release-manifest.json"),
    `${JSON.stringify(pagesManifest, null, 2)}\n`,
    "utf8",
  );

  if (fs.existsSync(pagesRoot)) {
    fs.renameSync(pagesRoot, previousRoot);
    previousMoved = true;
  }
  try {
    fs.renameSync(temporaryRoot, pagesRoot);
  } catch (error) {
    if (previousMoved && !fs.existsSync(pagesRoot)) {
      fs.renameSync(previousRoot, pagesRoot);
      previousMoved = false;
    }
    throw error;
  }
  if (previousMoved) {
    fs.rmSync(previousRoot, { recursive: true, force: true });
    previousMoved = false;
  }

  console.log(
    JSON.stringify(
      {
        pagesRoot,
        publicUrl,
        version: BUILD_VERSION,
        phase: PHASE,
        fileCount: pagesManifest.fileCount,
        totalBytes: pagesManifest.totalBytes,
        gameAssetCount: pagesManifest.gameAssetCount,
      },
      null,
      2,
    ),
  );
} finally {
  if (previousMoved && !fs.existsSync(pagesRoot)) {
    fs.renameSync(previousRoot, pagesRoot);
  }
  fs.rmSync(temporaryParent, { recursive: true, force: true });
}
