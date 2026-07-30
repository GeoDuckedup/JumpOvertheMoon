const BUILD_VERSION = "10.3.1";
const CACHE_PREFIX = "over-the-moon-";
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_VERSION}`;

const CORE_ASSETS = Object.freeze([
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./styles.css?v=10.3.1",
  "./src/assets.js?v=10.3.1",
  "./src/audio.js?v=10.3.1",
  "./src/config.js?v=10.3.1",
  "./src/game-config.js?v=10.3.1",
  "./src/game.js?v=10.3.1",
  "./src/input.js?v=10.3.1",
  "./src/layout.js?v=10.3.1",
  "./src/leaderboard.js?v=10.3.1",
  "./src/main.js?v=10.3.1",
  "./src/name-entry.js?v=10.3.1",
  "./src/performance.js?v=10.3.1",
  "./src/renderer.js?v=10.3.1",
  "./src/route.js?v=10.3.1",
  "./src/runtime.js?v=10.3.1",
  "./assets/audio/balloon-pop-cc0.wav",
  "./assets/game/splash_over_the_moon.png",
  "./assets/game/cat_idle.png",
  "./assets/game/cat_jump.png",
  "./assets/game/cat_slash.png",
  "./assets/game/cat_fall.png",
  "./assets/game/balloon_red.png",
  "./assets/game/balloon_yellow.png",
  "./assets/game/balloon_green.png",
  "./assets/game/balloon_blue.png",
  "./assets/game/goal_airplane.png",
  "./assets/game/goal_station.png",
  "./assets/game/goal_moon.png",
  "./assets/game/goal_mars.png",
  "./assets/game/goal_jupiter.png",
  "./assets/game/goal_saturn.png",
  "./assets/game/goal_uranus.png",
  "./assets/game/goal_neptune.png",
  "./assets/game/goal_pluto.png",
  "./assets/game/goal_kuiper-object.png",
  "./assets/game/goal_heliopause.png",
  "./assets/game/goal_voyager-1.png",
  "./assets/game/goal_oort-comet.png",
  "./assets/game/goal_proxima-centauri.png",
  "./assets/game/goal_black-hole.png",
  "./assets/game/reentry_trail_light.png",
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
