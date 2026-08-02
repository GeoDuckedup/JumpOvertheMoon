export const LOGICAL_WIDTH = 540;
export const REFERENCE_LOGICAL_HEIGHT = 800;
export const DESKTOP_MAX_WIDTH = 500;
export const PHASE = 16;
export const BUILD_VERSION = "16.0.2";
export const RELEASE_CHANNEL = "production";

export const RELEASE_CONFIG = Object.freeze({
  phase: PHASE,
  version: BUILD_VERSION,
  channel: RELEASE_CHANNEL,
  devToolsDefault: false,
  devToolsQueryParameter: "dev",
  offlineShell: true,
});

export const RUNTIME_CONFIG = Object.freeze({
  stepHz: 60,
  stepMs: 1000 / 60,
  maxFrameDeltaMs: 250,
  maxCatchUpSteps: 5,
  metricWindowFrames: 120,
  metricWarmupFrames: 60,
  metricPublishEveryFrames: 30,
  maxDeterministicAdvanceMs: 60_000,
});

export const QUALITY_PROFILES = Object.freeze({
  LOW: Object.freeze({ name: "LOW", dprCap: 1.15 }),
  MED: Object.freeze({ name: "MED", dprCap: 1.5 }),
  HIGH: Object.freeze({ name: "HIGH", dprCap: 2 }),
});

export const QUALITY_PROFILE_ORDER = Object.freeze([
  QUALITY_PROFILES.LOW,
  QUALITY_PROFILES.MED,
  QUALITY_PROFILES.HIGH,
]);

export function resolveQualityProfile(value) {
  const name = typeof value === "string" ? value : value?.name;
  return QUALITY_PROFILES[String(name || "").toUpperCase()] || null;
}

const assetUrl = (filename) =>
  new URL(`../../cat-sword-climb/assets/${filename}`, import.meta.url).href;

export const ASSET_MANIFEST = Object.freeze([
  Object.freeze({ id: "splash", src: assetUrl("splash_over_the_moon.png") }),
  Object.freeze({
    id: "rival-cat-jetpack-hover",
    src: assetUrl("rival_cat_jetpack_hover_v2.png"),
  }),
  Object.freeze({
    id: "rival-cat-jetpack-bow-windup",
    src: assetUrl("rival_cat_jetpack_bow_windup_v2.png"),
  }),
  Object.freeze({
    id: "rival-cat-jetpack-bow-slash",
    src: assetUrl("rival_cat_jetpack_bow_slash_v2.png"),
  }),
  Object.freeze({
    id: "rival-cat-jetpack-fiddle-heavy",
    src: assetUrl("rival_cat_jetpack_fiddle_heavy_v2.png"),
  }),
  Object.freeze({
    id: "rival-cat-jetpack-concerto",
    src: assetUrl("rival_cat_jetpack_concerto_v2.png"),
  }),
  Object.freeze({
    id: "rival-cat-jetpack-knockdown",
    src: assetUrl("rival_cat_jetpack_knockdown_v2.png"),
  }),
  Object.freeze({
    id: "rival-cat-jetpack-boost-charge",
    src: assetUrl("rival_cat_jetpack_boost_charge_v2.png"),
  }),
  Object.freeze({
    id: "rival-cat-jetpack-boost-active",
    src: assetUrl("rival_cat_jetpack_boost_active_v2.png"),
  }),
  Object.freeze({
    id: "rival-cat-jetpack-fiddle-drop-windup",
    src: assetUrl("rival_cat_jetpack_fiddle_drop_windup_v1.png"),
  }),
  Object.freeze({
    id: "rival-cat-jetpack-fiddle-drop-active",
    src: assetUrl("rival_cat_jetpack_fiddle_drop_active_v1.png"),
  }),
  Object.freeze({ id: "cat-idle", src: assetUrl("cat_idle.png") }),
  Object.freeze({ id: "cat-jump", src: assetUrl("cat_jump.png") }),
  Object.freeze({ id: "cat-slash", src: assetUrl("cat_slash.png") }),
  Object.freeze({ id: "cat-fall", src: assetUrl("cat_fall.png") }),
  Object.freeze({ id: "balloon-red", src: assetUrl("balloon_red.png") }),
  Object.freeze({ id: "balloon-yellow", src: assetUrl("balloon_yellow.png") }),
  Object.freeze({ id: "balloon-green", src: assetUrl("balloon_green.png") }),
  Object.freeze({ id: "balloon-blue", src: assetUrl("balloon_blue.png") }),
  Object.freeze({ id: "goal-airplane", src: assetUrl("goal_airplane.png") }),
  Object.freeze({ id: "goal-station", src: assetUrl("goal_station.png") }),
  Object.freeze({ id: "goal-moon", src: assetUrl("goal_moon.png") }),
  Object.freeze({ id: "goal-mars", src: assetUrl("goal_mars.png") }),
  Object.freeze({ id: "goal-jupiter", src: assetUrl("goal_jupiter.png") }),
  Object.freeze({ id: "goal-saturn", src: assetUrl("goal_saturn.png") }),
  Object.freeze({ id: "goal-uranus", src: assetUrl("goal_uranus.png") }),
  Object.freeze({ id: "goal-neptune", src: assetUrl("goal_neptune.png") }),
  Object.freeze({ id: "goal-pluto", src: assetUrl("goal_pluto.png") }),
  Object.freeze({
    id: "goal-kuiper-object",
    src: assetUrl("goal_kuiper-object.png"),
  }),
  Object.freeze({
    id: "goal-heliopause",
    src: assetUrl("goal_heliopause.png"),
  }),
  Object.freeze({
    id: "goal-voyager-1",
    src: assetUrl("goal_voyager-1.png"),
  }),
  Object.freeze({
    id: "goal-oort-comet",
    src: assetUrl("goal_oort-comet.png"),
  }),
  Object.freeze({
    id: "goal-proxima-centauri",
    src: assetUrl("goal_proxima-centauri.png"),
  }),
  Object.freeze({
    id: "goal-black-hole",
    src: assetUrl("goal_black-hole.png"),
  }),
  Object.freeze({ id: "reentry-trail", src: assetUrl("reentry_trail_light.png") }),
]);

export function detectInitialQuality() {
  const coarse = globalThis.matchMedia?.("(pointer: coarse)").matches ?? false;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;

  if (cores <= 2 || memory <= 2) {
    return QUALITY_PROFILES.LOW;
  }
  if (!coarse && cores >= 8 && memory >= 8) {
    return QUALITY_PROFILES.HIGH;
  }
  return QUALITY_PROFILES.MED;
}
