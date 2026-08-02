const BUILD_VERSION = "16.0.2";
const CACHE_PREFIX = "over-the-moon-";
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_VERSION}`;

const CORE_ASSETS = Object.freeze([
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./styles.css?v=16.0.2",
  "./src/assets.js?v=16.0.2",
  "./src/audio.js?v=16.0.2",
  "./src/config.js?v=16.0.2",
  "./src/game-config.js?v=16.0.2",
  "./src/game.js?v=16.0.2",
  "./src/input.js?v=16.0.2",
  "./src/layout.js?v=16.0.2",
  "./src/leaderboard.js?v=16.0.2",
  "./src/main.js?v=16.0.2",
  "./src/name-entry.js?v=16.0.2",
  "./src/performance.js?v=16.0.2",
  "./src/renderer.js?v=16.0.2",
  "./src/route.js?v=16.0.2",
  "./src/runtime.js?v=16.0.2",
  "./assets/audio/balloon-pop-cc0.wav",
  "../cat-sword-climb/assets/splash_over_the_moon.png",
  "../cat-sword-climb/assets/rival_cat_jetpack_hover_v2.png",
  "../cat-sword-climb/assets/rival_cat_jetpack_bow_windup_v2.png",
  "../cat-sword-climb/assets/rival_cat_jetpack_bow_slash_v2.png",
  "../cat-sword-climb/assets/rival_cat_jetpack_fiddle_heavy_v2.png",
  "../cat-sword-climb/assets/rival_cat_jetpack_concerto_v2.png",
  "../cat-sword-climb/assets/rival_cat_jetpack_knockdown_v2.png",
  "../cat-sword-climb/assets/rival_cat_jetpack_boost_charge_v2.png",
  "../cat-sword-climb/assets/rival_cat_jetpack_boost_active_v2.png",
  "../cat-sword-climb/assets/rival_cat_jetpack_fiddle_drop_windup_v1.png",
  "../cat-sword-climb/assets/rival_cat_jetpack_fiddle_drop_active_v1.png",
  "../cat-sword-climb/assets/cat_idle.png",
  "../cat-sword-climb/assets/cat_jump.png",
  "../cat-sword-climb/assets/cat_slash.png",
  "../cat-sword-climb/assets/cat_fall.png",
  "../cat-sword-climb/assets/balloon_red.png",
  "../cat-sword-climb/assets/balloon_yellow.png",
  "../cat-sword-climb/assets/balloon_green.png",
  "../cat-sword-climb/assets/balloon_blue.png",
  "../cat-sword-climb/assets/goal_airplane.png",
  "../cat-sword-climb/assets/goal_station.png",
  "../cat-sword-climb/assets/goal_moon.png",
  "../cat-sword-climb/assets/goal_mars.png",
  "../cat-sword-climb/assets/goal_jupiter.png",
  "../cat-sword-climb/assets/goal_saturn.png",
  "../cat-sword-climb/assets/goal_uranus.png",
  "../cat-sword-climb/assets/goal_neptune.png",
  "../cat-sword-climb/assets/goal_pluto.png",
  "../cat-sword-climb/assets/goal_kuiper-object.png",
  "../cat-sword-climb/assets/goal_heliopause.png",
  "../cat-sword-climb/assets/goal_voyager-1.png",
  "../cat-sword-climb/assets/goal_oort-comet.png",
  "../cat-sword-climb/assets/goal_proxima-centauri.png",
  "../cat-sword-climb/assets/goal_black-hole.png",
  "../cat-sword-climb/assets/reentry_trail_light.png",
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter(
              (name) =>
                name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME,
            )
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches
              .open(CACHE_NAME)
              .then((cache) => cache.put("./index.html", copy));
          }
          return response;
        })
        .catch(() => caches.match("./index.html")),
    );
    return;
  }

  if (requestUrl.origin !== self.location.origin) {
    return;
  }
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request)),
  );
});
