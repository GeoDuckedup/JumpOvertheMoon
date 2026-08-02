import {
  BACKGROUND_PHASES,
  COMBO,
  EFFECTS,
  GAME_WIDTH,
  GOALS,
  PLAYER,
  REENTRY,
  RIVAL_BOW_SWIPE,
  RIVAL_FIDDLE_DROP,
  RIVAL_FOUNDATION,
  RIVAL_JETPACK,
  RIVAL_VERTICAL_BOOST,
  WORLD_FLOOR_Y,
} from "./game-config.js?v=16.0.2";

const COLORS = Object.freeze({
  ink: "#070a18",
  white: "#f7f7ef",
  blueWhite: "#d8e8f4",
  gold: "#ffe180",
  cyan: "#86ddff",
  grass: "#526753",
  grassEdge: "#32433c",
  earth: "#293536",
});

const CAT_TARGET_HEIGHTS = Object.freeze({
  idle: 104,
  jump: 142,
  slash: 124,
  fall: 112,
});

const CAT_OFFSETS = Object.freeze({
  idle: [0, 2],
  jump: [0, 0],
  slash: [8, 15],
  fall: [0, 4],
});

const RIVAL_FRAME_PRESENTATION = Object.freeze({
  hover: Object.freeze({
    asset: "rival-cat-jetpack-hover",
    width: RIVAL_FOUNDATION.renderWidth,
    nozzle: Object.freeze([-0.195, -0.11]),
    exhaust: Object.freeze([-0.78, 0.63]),
    flameScale: 1,
  }),
  "bow-windup": Object.freeze({
    asset: "rival-cat-jetpack-bow-windup",
    width: RIVAL_FOUNDATION.renderWidth,
    nozzle: Object.freeze([-0.195, -0.117]),
    exhaust: Object.freeze([-0.78, 0.63]),
    flameScale: 1.08,
  }),
  "bow-slash": Object.freeze({
    asset: "rival-cat-jetpack-bow-slash",
    width: RIVAL_FOUNDATION.renderWidth,
    nozzle: Object.freeze([-0.148, -0.07]),
    exhaust: Object.freeze([-0.8, 0.6]),
    flameScale: 1.28,
  }),
  "boost-charge": Object.freeze({
    asset: "rival-cat-jetpack-boost-charge",
    width: 190,
    nozzle: Object.freeze([-0.202, 0.156]),
    exhaust: Object.freeze([0, 1]),
    flameScale: 1.45,
  }),
  "boost-active": Object.freeze({
    asset: "rival-cat-jetpack-boost-active",
    width: 240,
    nozzle: Object.freeze([-0.135, 0.115]),
    exhaust: Object.freeze([0, 1]),
    flameScale: 2.5,
  }),
  "fiddle-drop-windup": Object.freeze({
    asset: "rival-cat-jetpack-fiddle-drop-windup",
    width: RIVAL_FOUNDATION.renderWidth,
    nozzle: Object.freeze([-0.142, -0.045]),
    exhaust: Object.freeze([-0.78, 0.63]),
    flameScale: 1.18,
  }),
  "fiddle-drop-active": Object.freeze({
    asset: "rival-cat-jetpack-fiddle-drop-active",
    width: RIVAL_FOUNDATION.renderWidth,
    nozzle: Object.freeze([-0.12, -0.148]),
    exhaust: Object.freeze([-0.88, 0.48]),
    flameScale: 0,
  }),
  "fiddle-heavy": Object.freeze({
    asset: "rival-cat-jetpack-fiddle-heavy",
    width: RIVAL_FOUNDATION.renderWidth,
    nozzle: Object.freeze([-0.146, 0.027]),
    exhaust: Object.freeze([-0.78, 0.63]),
    flameScale: 0.88,
  }),
  knockdown: Object.freeze({
    asset: "rival-cat-jetpack-knockdown",
    width: RIVAL_FOUNDATION.renderWidth,
    nozzle: Object.freeze([-0.17, -0.07]),
    exhaust: Object.freeze([-0.75, 0.66]),
    flameScale: 0,
  }),
});

const rivalPresentation = (frame) =>
  RIVAL_FRAME_PRESENTATION[frame] || RIVAL_FRAME_PRESENTATION.hover;

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawImageCover(ctx, image, targetWidth, targetHeight, focusX = 0.5) {
  const sourceAspect = image.width / image.height;
  const targetAspect = targetWidth / targetHeight;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.width;
  let sourceHeight = image.height;

  if (sourceAspect > targetAspect) {
    sourceWidth = image.height * targetAspect;
    sourceX =
      (image.width - sourceWidth) * Math.max(0, Math.min(1, focusX));
  } else {
    sourceHeight = image.width / targetAspect;
    sourceY = (image.height - sourceHeight) / 2;
  }
  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    targetWidth,
    targetHeight,
  );
}

function seededUnit(index) {
  const value = Math.sin(index * 91.733 + 17.17) * 43758.5453;
  return value - Math.floor(value);
}

function paintSoftEllipse(
  ctx,
  x,
  y,
  radiusX,
  radiusY,
  rotation,
  stops,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(radiusX, radiusY);
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  for (const [offset, color] of stops) {
    gradient.addColorStop(offset, color);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

export class ShellRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.backgroundCache = document.createElement("canvas");
    this.backgroundContext = this.backgroundCache.getContext("2d", {
      alpha: false,
    });
    this.backgroundCacheKey = "";
    this.spriteCache = new Map();
    this.cosmosTextureCache = new Map();
  }

  render(state, layout, assets) {
    if (!layout || !this.ctx) {
      return;
    }
    const ctx = this.ctx;
    ctx.setTransform(layout.scale, 0, 0, layout.scale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (
      state.game?.mode === "playing" ||
      state.game?.mode === "gameover"
    ) {
      this.#drawGameplay(ctx, state, layout, assets);
    } else {
      this.#drawMenu(ctx, state, layout, assets);
    }
  }

  #drawMenu(ctx, state, layout, assets) {
    const width = layout.logicalWidth;
    const height = layout.logicalHeight;
    const splash = assets.get("splash");

    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(0, 0, width, height);
    if (splash) {
      this.#ensureMenuBackgroundCache(splash, width, height);
      ctx.drawImage(this.backgroundCache, 0, 0, width, height);
    } else {
      this.#drawLoadingSky(ctx, width, height, state.elapsedMs);
      this.#drawReadabilityLayers(ctx, width, height, false);
    }
  }

  #drawGameplay(ctx, state, layout, assets) {
    const game = state.game;
    const width = layout.logicalWidth;
    const height = layout.logicalHeight;
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(0, 0, width, height);
    this.#drawGameplaySky(ctx, width, height, game, state.elapsedMs);
    this.#drawShootingStars(ctx, game);
    this.#drawAmbientFlyby(ctx, game);
    this.#drawFloor(ctx, width, height, game);
    this.#drawGoalMarkers(ctx, game, assets);
    this.#drawBalloons(ctx, game, assets);
    this.#drawPopEffects(ctx, game);
    this.#drawReentryTrail(ctx, game, assets);
    this.#drawRivalFoundation(ctx, game, assets);
    this.#drawPlayer(ctx, game, assets);
    this.#drawComboFeedback(ctx, game);
    this.#drawHud(ctx, state, layout);
    if (game.mode === "gameover") {
      this.#drawGameOver(ctx, state, layout);
    }
  }

  #ensureMenuBackgroundCache(splash, width, height) {
    if (!this.backgroundContext) {
      return;
    }
    const cacheKey = `${width}x${height}:${splash.currentSrc || splash.src}`;
    if (cacheKey === this.backgroundCacheKey) {
      return;
    }

    this.backgroundCache.width = width;
    this.backgroundCache.height = height;
    const ctx = this.backgroundContext;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(0, 0, width, height);
    drawImageCover(ctx, splash, width, height, 0.22);
    this.#drawReadabilityLayers(ctx, width, height, true);
    this.backgroundCacheKey = cacheKey;
  }

  #drawLoadingSky(ctx, width, height, elapsedMs) {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#101d42");
    gradient.addColorStop(0.55, "#091129");
    gradient.addColorStop(1, "#03050f");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const drift = elapsedMs * 0.00002;
    for (let index = 0; index < 72; index += 1) {
      const x = seededUnit(index) * width;
      const y =
        ((seededUnit(index + 100) + drift * (1 + (index % 4))) % 1) *
        height;
      const radius = index % 9 === 0 ? 1.5 : 0.8;
      ctx.globalAlpha = 0.3 + seededUnit(index + 200) * 0.6;
      ctx.fillStyle = index % 7 === 0 ? COLORS.gold : COLORS.white;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  #drawReadabilityLayers(ctx, width, height, hasSplash) {
    const topFade = ctx.createLinearGradient(0, 0, 0, height * 0.3);
    topFade.addColorStop(0, "rgb(2 4 13 / 58%)");
    topFade.addColorStop(1, "rgb(2 4 13 / 0%)");
    ctx.fillStyle = topFade;
    ctx.fillRect(0, 0, width, height * 0.3);

    const bottomFade = ctx.createLinearGradient(0, height * 0.5, 0, height);
    bottomFade.addColorStop(0, "rgb(2 4 13 / 0%)");
    bottomFade.addColorStop(
      1,
      hasSplash ? "rgb(2 4 13 / 88%)" : "rgb(2 4 13 / 70%)",
    );
    ctx.fillStyle = bottomFade;
    ctx.fillRect(0, height * 0.5, width, height * 0.5);

    const vignette = ctx.createRadialGradient(
      width / 2,
      height * 0.44,
      width * 0.22,
      width / 2,
      height * 0.44,
      Math.max(width, height) * 0.72,
    );
    vignette.addColorStop(0, "rgb(0 0 0 / 0%)");
    vignette.addColorStop(1, "rgb(0 0 0 / 50%)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  #drawGameplaySky(ctx, width, height, game, elapsedMs) {
    const altitude = game.heightMeters;
    const { phase, next, mix } = this.#backgroundBlend(altitude);
    const top = this.#mixColor(phase.top, next.top, mix);
    const bottom = this.#mixColor(phase.bottom, next.bottom, mix);
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const nebula = this.#mixNumber(phase.nebula, next.nebula, mix);
    if (nebula > 0.02) {
      const texture = this.#getCosmosTexture("nebula", width, height);
      const driftX = Math.sin(elapsedMs * 0.00009) * 8;
      const driftY =
        Math.cos(
          elapsedMs * 0.00007 + game.camera.renderY * 0.00035,
        ) * 11;
      ctx.save();
      ctx.globalAlpha = 0.72 * nebula;
      ctx.drawImage(
        texture,
        -18 + driftX,
        -26 + driftY,
        width + 36,
        height + 52,
      );
      ctx.restore();
    }

    this.#drawUpperCosmosChapters(
      ctx,
      width,
      height,
      game,
      elapsedMs,
      phase,
      next,
      mix,
    );

    const atmosphereRaw = Math.max(0, Math.min(1, altitude / 950));
    const atmosphere =
      atmosphereRaw * atmosphereRaw * (3 - 2 * atmosphereRaw);
    const starStrength = Math.max(
      this.#mixNumber(phase.star, next.star, mix),
      Math.max(0, Math.min(1, (atmosphere - 0.05) / 0.65)),
    );
    const starDensity = this.#mixNumber(
      phase.starDensity ?? 1,
      next.starDensity ?? 1,
      mix,
    );
    const starWarmth = this.#mixNumber(
      phase.starWarmth ?? 0,
      next.starWarmth ?? 0,
      mix,
    );
    const twinkleTime = elapsedMs * 0.002;
    for (let index = 0; index < 72; index += 1) {
      const x = seededUnit(index + 300) * width;
      const worldY = seededUnit(index + 500) * (height + 260) - 130;
      const y =
        ((worldY - game.camera.renderY * 0.08 + height + 260) %
          (height + 260)) -
        130;
      const twinkle =
        0.65 +
        0.35 *
          Math.sin(twinkleTime + seededUnit(index + 700) * Math.PI * 2);
      const densityFade = Math.max(
        0,
        Math.min(
          1,
          (starDensity - seededUnit(index + 1300)) * 8 + 1,
        ),
      );
      if (densityFade <= 0) {
        continue;
      }
      ctx.globalAlpha = starStrength * twinkle * densityFade;
      const baseStar =
        index % 8 === 0 ? [255, 225, 128] : [247, 247, 239];
      const warmth =
        starWarmth * (0.28 + seededUnit(index + 1500) * 0.72);
      ctx.fillStyle = this.#mixColor(
        baseStar,
        [255, 132, 103],
        warmth,
      );
      ctx.beginPath();
      ctx.arc(x, y, index % 9 === 0 ? 1.7 : 0.9, 0, Math.PI * 2);
      ctx.fill();
      if (index % 9 === 0 && starStrength > 0.7) {
        ctx.strokeStyle = COLORS.white;
        ctx.lineWidth = 0.75;
        ctx.beginPath();
        ctx.moveTo(x - 3, y);
        ctx.lineTo(x + 3, y);
        ctx.moveTo(x, y - 3);
        ctx.lineTo(x, y + 3);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    const cloudStrength = Math.min(
      this.#mixNumber(phase.cloud, next.cloud, mix),
      Math.max(0, 1 - atmosphere * 1.15),
    );
    ctx.fillStyle = `rgb(239 246 244 / ${0.23 * cloudStrength})`;
    for (let index = 0; index < 9; index += 1) {
      const x = seededUnit(index + 900) * width;
      const worldY = 160 + index * 155;
      const y =
        ((worldY - game.camera.renderY * 0.28 + height + 240) %
          (height + 240)) -
        120;
      const size = 38 + seededUnit(index + 950) * 42;
      ctx.beginPath();
      ctx.ellipse(x, y, size, size * 0.25, 0, 0, Math.PI * 2);
      ctx.ellipse(
        x + size * 0.28,
        y - size * 0.12,
        size * 0.56,
        size * 0.3,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  #drawUpperCosmosChapters(
    ctx,
    width,
    height,
    game,
    elapsedMs,
    phase,
    next,
    mix,
  ) {
    const strength = (key) =>
      this.#mixNumber(
        Number(phase[key]) || 0,
        Number(next[key]) || 0,
        mix,
      );
    const kuiper = strength("kuiper");
    const heliopause = strength("heliopause");
    const interstellar = strength("interstellar");
    const proxima = strength("proxima");
    const gravity = strength("gravity");

    if (kuiper > 0.01) {
      this.#drawKuiperField(ctx, width, height, game, kuiper);
    }
    if (heliopause > 0.01) {
      this.#drawHeliopauseVeil(
        ctx,
        width,
        height,
        game,
        elapsedMs,
        heliopause,
      );
    }
    if (interstellar > 0.01) {
      this.#drawInterstellarVoid(
        ctx,
        width,
        height,
        game,
        interstellar,
      );
    }
    if (proxima > 0.01) {
      this.#drawProximaRegion(
        ctx,
        width,
        height,
        game,
        elapsedMs,
        proxima,
      );
    }
    if (gravity > 0.01) {
      this.#drawGravityWell(
        ctx,
        width,
        height,
        elapsedMs,
        gravity,
      );
    }
  }

  #drawKuiperField(ctx, width, height, game, strength) {
    ctx.save();
    ctx.translate(width * 0.5, height * 0.54);
    ctx.rotate(-0.13);
    const band = ctx.createLinearGradient(0, -42, 0, 42);
    band.addColorStop(0, "rgb(98 147 188 / 0%)");
    band.addColorStop(0.32, "rgb(111 158 194 / 8%)");
    band.addColorStop(0.5, "rgb(119 166 198 / 18%)");
    band.addColorStop(0.68, "rgb(111 158 194 / 8%)");
    band.addColorStop(1, "rgb(98 147 188 / 0%)");
    ctx.globalAlpha = 0.5 * strength;
    ctx.fillStyle = band;
    ctx.fillRect(-width * 0.7, -42, width * 1.4, 84);
    ctx.restore();

    ctx.save();
    const span = height + 220;
    for (let index = 0; index < 22; index += 1) {
      const x = seededUnit(index + 1800) * (width + 56) - 28;
      const base =
        seededUnit(index + 1900) * span -
        game.camera.renderY * (0.024 + (index % 3) * 0.004);
      const y = ((base % span) + span) % span - 110;
      const radius = 1.4 + seededUnit(index + 2000) * 3.4;
      ctx.globalAlpha =
        strength * (0.09 + seededUnit(index + 2100) * 0.17);
      ctx.fillStyle =
        index % 4 === 0
          ? "#a8c8d8"
          : index % 4 === 1
            ? "#7e95a5"
            : "#b29a87";
      ctx.strokeStyle = "rgb(225 242 248 / 42%)";
      ctx.lineWidth = 0.65;
      ctx.beginPath();
      ctx.moveTo(x - radius, y + radius * 0.2);
      ctx.lineTo(x - radius * 0.2, y - radius * 0.75);
      ctx.lineTo(x + radius, y - radius * 0.15);
      ctx.lineTo(x + radius * 0.35, y + radius * 0.8);
      ctx.closePath();
      ctx.fill();
      if (index % 3 === 0) {
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  #drawHeliopauseVeil(
    ctx,
    width,
    height,
    game,
    elapsedMs,
    strength,
  ) {
    ctx.save();
    const centerX = -width * 0.18;
    const centerY =
      height * 0.47 +
      Math.sin(elapsedMs * 0.00014 + game.camera.renderY * 0.0007) * 18;
    const glow = ctx.createRadialGradient(
      centerX,
      centerY,
      width * 0.18,
      centerX,
      centerY,
      width * 1.18,
    );
    glow.addColorStop(0, "rgb(73 192 231 / 5%)");
    glow.addColorStop(0.58, "rgb(75 155 235 / 9%)");
    glow.addColorStop(0.76, "rgb(162 82 221 / 12%)");
    glow.addColorStop(1, "rgb(95 45 154 / 0%)");
    ctx.globalAlpha = strength;
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    const texture = this.#getCosmosTexture(
      "heliopause",
      width,
      height,
    );
    const driftX = Math.sin(elapsedMs * 0.00012) * 10;
    const driftY =
      Math.sin(
        elapsedMs * 0.0001 + game.camera.renderY * 0.00055,
      ) * 14;
    ctx.globalAlpha = strength * 0.86;
    ctx.drawImage(
      texture,
      -20 + driftX,
      -30 + driftY,
      width + 40,
      height + 60,
    );
    ctx.restore();
  }

  #drawInterstellarVoid(ctx, width, height, game, strength) {
    ctx.save();
    const vignette = ctx.createRadialGradient(
      width * 0.5,
      height * 0.44,
      width * 0.12,
      width * 0.5,
      height * 0.44,
      Math.max(width, height) * 0.72,
    );
    vignette.addColorStop(0, "rgb(0 0 5 / 0%)");
    vignette.addColorStop(0.62, "rgb(0 1 8 / 10%)");
    vignette.addColorStop(1, "rgb(0 0 4 / 34%)");
    ctx.globalAlpha = strength;
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    const span = height + 200;
    for (let index = 0; index < 16; index += 1) {
      const x = seededUnit(index + 2300) * width;
      const base =
        seededUnit(index + 2400) * span - game.camera.renderY * 0.018;
      const y = ((base % span) + span) % span - 100;
      ctx.globalAlpha =
        strength * (0.08 + seededUnit(index + 2500) * 0.17);
      ctx.fillStyle = index % 3 === 0 ? "#d89d86" : "#8db6d9";
      ctx.beginPath();
      ctx.arc(
        x,
        y,
        index % 5 === 0 ? 1.25 : 0.65,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.restore();
  }

  #drawProximaRegion(
    ctx,
    width,
    height,
    game,
    elapsedMs,
    strength,
  ) {
    ctx.save();
    const glowX =
      width * 1.06 + Math.sin(elapsedMs * 0.00011) * width * 0.025;
    const glowY = height * 0.27;
    const glow = ctx.createRadialGradient(
      glowX,
      glowY,
      0,
      glowX,
      glowY,
      Math.max(width, height) * 0.68,
    );
    glow.addColorStop(0, "rgb(255 102 54 / 30%)");
    glow.addColorStop(0.24, "rgb(202 49 40 / 17%)");
    glow.addColorStop(0.58, "rgb(113 25 44 / 8%)");
    glow.addColorStop(1, "rgb(55 12 31 / 0%)");
    ctx.globalAlpha = strength;
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    const span = height + 180;
    for (let index = 0; index < 18; index += 1) {
      const x = seededUnit(index + 2700) * width;
      const base =
        seededUnit(index + 2800) * span -
        game.camera.renderY * (0.015 + (index % 2) * 0.005);
      const y = ((base % span) + span) % span - 90;
      const pulse =
        0.72 +
        Math.sin(elapsedMs * 0.001 + seededUnit(index + 2900) * 6.28) *
          0.28;
      ctx.globalAlpha =
        strength *
        pulse *
        (0.08 + seededUnit(index + 3000) * 0.15);
      ctx.fillStyle = index % 4 === 0 ? "#ffd08b" : "#e86a4c";
      ctx.beginPath();
      ctx.arc(
        x,
        y,
        index % 6 === 0 ? 1.45 : 0.75,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.restore();
  }

  #drawGravityWell(ctx, width, height, elapsedMs, strength) {
    ctx.save();
    const centerX = width * 0.5;
    const centerY = height * 0.36;
    const sink = ctx.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      Math.max(width, height) * 0.58,
    );
    sink.addColorStop(0, "rgb(0 0 2 / 34%)");
    sink.addColorStop(0.26, "rgb(0 0 4 / 23%)");
    sink.addColorStop(0.6, "rgb(16 3 28 / 8%)");
    sink.addColorStop(1, "rgb(9 1 18 / 0%)");
    ctx.globalAlpha = strength;
    ctx.fillStyle = sink;
    ctx.fillRect(0, 0, width, height);

    const texture = this.#getCosmosTexture("gravity", width, height);
    const driftX = Math.sin(elapsedMs * 0.00011) * 7;
    const driftY = Math.cos(elapsedMs * 0.00008) * 8;
    const pulse = 0.78 + Math.sin(elapsedMs * 0.00023) * 0.08;
    ctx.globalAlpha = strength * pulse;
    ctx.drawImage(
      texture,
      -18 + driftX,
      -24 + driftY,
      width + 36,
      height + 48,
    );
    ctx.restore();
  }

  #getCosmosTexture(kind, width, height) {
    const textureWidth = Math.max(180, Math.ceil(width * 0.5));
    const textureHeight = Math.max(240, Math.ceil(height * 0.5));
    const key = `${kind}:${textureWidth}x${textureHeight}`;
    const cached = this.cosmosTextureCache.get(key);
    if (cached) {
      return cached;
    }

    const texture = document.createElement("canvas");
    texture.width = textureWidth;
    texture.height = textureHeight;
    const ctx = texture.getContext("2d");
    const w = textureWidth;
    const h = textureHeight;
    ctx.clearRect(0, 0, w, h);

    if (kind === "nebula") {
      paintSoftEllipse(ctx, w * 0.18, h * 0.16, w * 0.72, h * 0.3, -0.24, [
        [0, "rgb(63 138 218 / 30%)"],
        [0.46, "rgb(61 104 190 / 15%)"],
        [1, "rgb(33 62 136 / 0%)"],
      ]);
      paintSoftEllipse(ctx, w * 0.82, h * 0.45, w * 0.74, h * 0.28, 0.18, [
        [0, "rgb(155 60 151 / 25%)"],
        [0.5, "rgb(105 45 137 / 12%)"],
        [1, "rgb(66 28 108 / 0%)"],
      ]);
      paintSoftEllipse(ctx, w * 0.28, h * 0.84, w * 0.62, h * 0.25, 0.16, [
        [0, "rgb(209 108 74 / 18%)"],
        [0.48, "rgb(134 60 105 / 9%)"],
        [1, "rgb(73 34 90 / 0%)"],
      ]);
    } else if (kind === "heliopause") {
      paintSoftEllipse(ctx, w * -0.02, h * 0.46, w * 0.76, h * 0.62, 0, [
        [0, "rgb(68 179 228 / 22%)"],
        [0.48, "rgb(72 129 215 / 13%)"],
        [1, "rgb(81 54 157 / 0%)"],
      ]);
      paintSoftEllipse(ctx, w * 0.22, h * 0.18, w * 0.7, h * 0.16, -0.3, [
        [0, "rgb(101 218 239 / 21%)"],
        [0.5, "rgb(75 158 226 / 11%)"],
        [1, "rgb(52 94 185 / 0%)"],
      ]);
      paintSoftEllipse(ctx, w * 0.52, h * 0.43, w * 0.72, h * 0.14, 0.12, [
        [0, "rgb(147 103 220 / 22%)"],
        [0.52, "rgb(100 81 191 / 10%)"],
        [1, "rgb(66 43 139 / 0%)"],
      ]);
      paintSoftEllipse(ctx, w * 0.32, h * 0.7, w * 0.68, h * 0.17, 0.27, [
        [0, "rgb(82 181 227 / 18%)"],
        [0.5, "rgb(102 102 208 / 9%)"],
        [1, "rgb(70 54 151 / 0%)"],
      ]);
      paintSoftEllipse(ctx, w * 0.84, h * 0.78, w * 0.58, h * 0.2, -0.18, [
        [0, "rgb(168 83 204 / 16%)"],
        [0.54, "rgb(104 61 169 / 8%)"],
        [1, "rgb(62 37 123 / 0%)"],
      ]);
    } else if (kind === "gravity") {
      paintSoftEllipse(ctx, w * 0.18, h * 0.34, w * 0.48, h * 0.1, -0.18, [
        [0, "rgb(223 117 70 / 19%)"],
        [0.48, "rgb(150 67 78 / 9%)"],
        [1, "rgb(86 34 73 / 0%)"],
      ]);
      paintSoftEllipse(ctx, w * 0.77, h * 0.29, w * 0.44, h * 0.09, 0.16, [
        [0, "rgb(150 92 205 / 19%)"],
        [0.48, "rgb(100 58 155 / 9%)"],
        [1, "rgb(59 31 105 / 0%)"],
      ]);
      paintSoftEllipse(ctx, w * 0.72, h * 0.48, w * 0.52, h * 0.1, -0.14, [
        [0, "rgb(237 145 83 / 15%)"],
        [0.5, "rgb(147 69 92 / 8%)"],
        [1, "rgb(77 34 72 / 0%)"],
      ]);
      paintSoftEllipse(ctx, w * 0.28, h * 0.55, w * 0.46, h * 0.08, 0.2, [
        [0, "rgb(130 84 192 / 16%)"],
        [0.5, "rgb(84 51 139 / 8%)"],
        [1, "rgb(49 27 92 / 0%)"],
      ]);
      paintSoftEllipse(ctx, w * 0.52, h * 0.38, w * 0.3, h * 0.12, 0, [
        [0, "rgb(58 27 87 / 16%)"],
        [0.48, "rgb(37 15 60 / 9%)"],
        [1, "rgb(19 7 37 / 0%)"],
      ]);
    }

    if (this.cosmosTextureCache.size >= 12) {
      const oldestKey = this.cosmosTextureCache.keys().next().value;
      this.cosmosTextureCache.delete(oldestKey);
    }
    this.cosmosTextureCache.set(key, texture);
    return texture;
  }

  #drawShootingStars(ctx, game) {
    for (const star of game.shootingStars || []) {
      const progress = Math.max(
        0,
        Math.min(1, star.ageSeconds / star.lifetimeSeconds),
      );
      const fade = Math.sin(progress * Math.PI);
      if (fade <= 0) {
        continue;
      }
      const speed = Math.max(1, Math.hypot(star.vx, star.vy));
      const dx = star.vx / speed;
      const dy = star.vy / speed;
      const alpha = 0.8 * fade;
      ctx.lineCap = "round";
      for (let segment = 0; segment < 4; segment += 1) {
        const startRatio = segment / 4;
        const endRatio = (segment + 1) / 4;
        ctx.globalAlpha = alpha * (1 - startRatio) ** 1.7;
        ctx.strokeStyle = COLORS.white;
        ctx.lineWidth = Math.max(1, star.width - Math.floor(segment / 2));
        ctx.beginPath();
        ctx.moveTo(
          star.x - dx * star.length * startRatio,
          star.y - dy * star.length * startRatio,
        );
        ctx.lineTo(
          star.x - dx * star.length * endRatio,
          star.y - dy * star.length * endRatio,
        );
        ctx.stroke();
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#fffff1";
      ctx.beginPath();
      ctx.arc(star.x, star.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = "butt";
  }

  #drawAmbientFlyby(ctx, game) {
    const flyby = game.ambientFlyby?.active;
    if (!flyby) {
      return;
    }
    const progress = Math.max(0, Math.min(1, flyby.progress));
    const fade = Math.sin(progress * Math.PI);
    if (fade <= 0) {
      return;
    }
    if (flyby.type === "bird") {
      this.#drawBirdFlyby(ctx, flyby, fade);
    } else if (flyby.type === "saucer") {
      this.#drawSaucerFlyby(ctx, flyby, fade);
    }
  }

  #drawBirdFlyby(ctx, flyby, fade) {
    const wingY = -1.5 - flyby.wing * 9.5;
    ctx.save();
    ctx.translate(flyby.x, flyby.y);
    ctx.rotate(flyby.rotationRadians);
    ctx.scale(flyby.direction * flyby.scale, flyby.scale);
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#53626b";
    ctx.lineWidth = 0.8;

    ctx.globalAlpha = 0.56 * fade;
    ctx.fillStyle = "#aebbc2";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-3.5, wingY * 0.74, -11.5, wingY * 0.68);
    ctx.quadraticCurveTo(-7, 0.8, 2.5, 1.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.globalAlpha = 0.9 * fade;
    ctx.fillStyle = "#edf4f2";
    ctx.beginPath();
    ctx.moveTo(0.5, -0.5);
    ctx.quadraticCurveTo(-4.5, wingY, -14, wingY * 0.84);
    ctx.quadraticCurveTo(-8.5, 1.4, 3, 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(0, 0.6, 7.4, 2.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(6.4, -0.25, 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#d8c783";
    ctx.beginPath();
    ctx.moveTo(8.1, -0.6);
    ctx.lineTo(11.5, 0);
    ctx.lineTo(8.1, 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#dbe5e4";
    ctx.beginPath();
    ctx.moveTo(-6.2, 0.15);
    ctx.lineTo(-10.6, -2.2);
    ctx.lineTo(-9.2, 1.3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  #drawSaucerFlyby(ctx, flyby, fade) {
    const blink = Math.max(0, Math.min(1, flyby.blink));
    ctx.save();
    ctx.translate(flyby.x, flyby.y);
    ctx.rotate(flyby.rotationRadians);
    ctx.scale(flyby.scale, flyby.scale);
    ctx.globalAlpha = 0.22 * fade;
    ctx.fillStyle = "#87dfff";
    ctx.shadowColor = "rgb(112 218 255 / 70%)";
    ctx.shadowBlur = 9;
    ctx.beginPath();
    ctx.ellipse(0, 2, 18, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.globalAlpha = 0.6 * fade;
    const hull = ctx.createLinearGradient(0, -5, 0, 7);
    hull.addColorStop(0, "#e9f1f2");
    hull.addColorStop(0.46, "#8799a5");
    hull.addColorStop(1, "#394b59");
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.ellipse(0, 1.5, 17, 5.3, 0, 0, Math.PI * 2);
    ctx.fill();

    const dome = ctx.createLinearGradient(0, -7, 0, 1);
    dome.addColorStop(0, "#c9f3ff");
    dome.addColorStop(1, "#587589");
    ctx.fillStyle = dome;
    ctx.beginPath();
    ctx.ellipse(0, -1.6, 7.4, 5.2, 0, Math.PI, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = (0.24 + blink * 0.34) * fade;
    ctx.fillStyle = "#b7f5ff";
    for (const x of [-9, 0, 9]) {
      ctx.beginPath();
      ctx.arc(x, 3.5, 1.25, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  #drawGoalMarkers(ctx, game, assets) {
    const cameraY = game.camera.renderY;
    for (const marker of game.goalMarkers) {
      const screenY = marker.y - cameraY;
      if (!marker.alive) {
        if (
          marker.poppedTimer > 0 &&
          marker.poppedTimer < GOALS.popLifetimeSeconds
        ) {
          const t = marker.poppedTimer / GOALS.popLifetimeSeconds;
          const centerY = marker.y + marker.hitOffsetY - cameraY;
          ctx.strokeStyle = COLORS.gold;
          ctx.lineWidth = Math.max(1, 5 * (1 - t));
          for (let index = 0; index < 14; index += 1) {
            const angle = (index * Math.PI * 2) / 14 + t * 0.8;
            const distance = 28 + t * 125;
            ctx.beginPath();
            ctx.moveTo(marker.x, centerY);
            ctx.lineTo(
              marker.x + Math.cos(angle) * distance,
              centerY + Math.sin(angle) * distance,
            );
            ctx.stroke();
          }
          this.#drawGoalLabel(
            ctx,
            `${marker.name} cleared`,
            marker.x,
            centerY - 96 * t,
            true,
          );
        }
        continue;
      }

      const sprite = assets.get(`goal-${marker.assetName}`);
      const top = screenY - marker.spriteOffsetY;
      const spriteHeight =
        sprite?.height || marker.spriteHeight || marker.hitHeight;
      if (
        top > game.camera.viewportHeight + 90 ||
        top + spriteHeight < -90
      ) {
        continue;
      }
      if (sprite) {
        ctx.drawImage(sprite, marker.x - sprite.width / 2, top);
        this.#drawGoalLabel(
          ctx,
          `${marker.name}  ${marker.heightMeters}m`,
          marker.x,
          top - 16,
          false,
        );
      } else {
        this.#drawProceduralGoal(ctx, marker, top);
        this.#drawGoalLabel(
          ctx,
          `${marker.name}  ${marker.heightMeters}m`,
          marker.x,
          top - 16,
          false,
        );
      }
    }
  }

  #drawProceduralGoal(ctx, marker, top) {
    const width = marker.hitWidth;
    const height = marker.spriteHeight || marker.hitHeight;
    const halfWidth = width * 0.5;
    const halfHeight = height * 0.5;
    const centerY = top + halfHeight;

    ctx.save();
    ctx.translate(marker.x, centerY);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (marker.id === "pluto") {
      const radius = Math.min(halfWidth, halfHeight) * 0.76;
      const glow = ctx.createRadialGradient(
        -radius * 0.28,
        -radius * 0.3,
        radius * 0.08,
        0,
        0,
        radius * 1.22,
      );
      glow.addColorStop(0, "#f7eee4");
      glow.addColorStop(0.55, "#b8c8d3");
      glow.addColorStop(1, "#667785");
      ctx.shadowColor = "rgb(164 216 255 / 38%)";
      ctx.shadowBlur = 22;
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgb(95 112 125 / 48%)";
      for (const [x, y, r] of [
        [-0.32, -0.3, 0.12],
        [0.36, -0.18, 0.09],
        [-0.27, 0.38, 0.08],
        [0.38, 0.3, 0.14],
      ]) {
        ctx.beginPath();
        ctx.arc(x * radius, y * radius, r * radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "rgb(230 202 189 / 82%)";
      ctx.beginPath();
      ctx.moveTo(-radius * 0.12, radius * 0.1);
      ctx.bezierCurveTo(
        -radius * 0.5,
        -radius * 0.18,
        -radius * 0.53,
        radius * 0.35,
        0,
        radius * 0.57,
      );
      ctx.bezierCurveTo(
        radius * 0.49,
        radius * 0.3,
        radius * 0.4,
        -radius * 0.2,
        radius * 0.08,
        radius * 0.08,
      );
      ctx.closePath();
      ctx.fill();
    } else if (marker.id === "kuiper-object") {
      ctx.shadowColor = "rgb(132 209 255 / 35%)";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#8797a6";
      ctx.strokeStyle = "#c7d8e1";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-halfWidth * 0.31, -halfHeight * 0.43);
      ctx.lineTo(halfWidth * 0.22, -halfHeight * 0.52);
      ctx.lineTo(halfWidth * 0.48, -halfHeight * 0.14);
      ctx.lineTo(halfWidth * 0.36, halfHeight * 0.32);
      ctx.lineTo(-halfWidth * 0.08, halfHeight * 0.52);
      ctx.lineTo(-halfWidth * 0.48, halfHeight * 0.2);
      ctx.lineTo(-halfWidth * 0.5, -halfHeight * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#536273";
      for (const [x, y, radius] of [
        [-0.18, -0.12, 12],
        [0.22, 0.14, 9],
        [0.06, -0.3, 7],
      ]) {
        ctx.beginPath();
        ctx.arc(x * halfWidth, y * halfHeight, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#a9c3d5";
      for (const [x, y, radius] of [
        [-0.77, -0.5, 7],
        [0.74, -0.42, 9],
        [0.7, 0.48, 5],
        [-0.72, 0.5, 6],
      ]) {
        ctx.beginPath();
        ctx.arc(x * halfWidth, y * halfHeight, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (marker.id === "heliopause") {
      ctx.shadowColor = "rgb(103 221 255 / 72%)";
      ctx.shadowBlur = 24;
      for (let ring = 0; ring < 4; ring += 1) {
        ctx.globalAlpha = 0.95 - ring * 0.16;
        ctx.strokeStyle = ring % 2 ? "#ffe180" : "#7fe1ff";
        ctx.lineWidth = 5 - ring * 0.7;
        ctx.beginPath();
        ctx.ellipse(
          0,
          0,
          halfWidth * (0.42 + ring * 0.14),
          halfHeight * (0.48 + ring * 0.12),
          -0.18,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgb(255 225 128 / 88%)";
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgb(255 255 255 / 72%)";
      ctx.lineWidth = 2;
      for (let spoke = 0; spoke < 8; spoke += 1) {
        const angle = (spoke * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 28, Math.sin(angle) * 28);
        ctx.lineTo(
          Math.cos(angle) * halfWidth * 0.82,
          Math.sin(angle) * halfHeight * 0.82,
        );
        ctx.stroke();
      }
    } else if (marker.id === "voyager-1") {
      ctx.rotate(-0.12);
      ctx.shadowColor = "rgb(255 225 128 / 35%)";
      ctx.shadowBlur = 15;
      ctx.strokeStyle = "#eef4f5";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-halfWidth * 0.58, 0);
      ctx.lineTo(halfWidth * 0.55, 0);
      ctx.moveTo(halfWidth * 0.2, -halfHeight * 0.12);
      ctx.lineTo(halfWidth * 0.65, -halfHeight * 0.48);
      ctx.moveTo(halfWidth * 0.2, halfHeight * 0.1);
      ctx.lineTo(halfWidth * 0.66, halfHeight * 0.43);
      ctx.stroke();
      ctx.fillStyle = "#d0d9de";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(
        -halfWidth * 0.25,
        0,
        halfWidth * 0.3,
        halfHeight * 0.42,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffe180";
      ctx.fillRect(-14, -17, 56, 34);
      ctx.fillStyle = "#263347";
      ctx.fillRect(7, -12, 29, 24);
      ctx.fillStyle = "#f7f7ef";
      ctx.beginPath();
      ctx.arc(-halfWidth * 0.25, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (marker.id === "oort-comet") {
      ctx.shadowColor = "rgb(134 221 255 / 58%)";
      ctx.shadowBlur = 20;
      ctx.fillStyle = "rgb(100 207 255 / 34%)";
      ctx.beginPath();
      ctx.moveTo(-halfWidth * 0.78, halfHeight * 0.43);
      ctx.quadraticCurveTo(
        -halfWidth * 0.18,
        halfHeight * 0.02,
        halfWidth * 0.25,
        -halfHeight * 0.16,
      );
      ctx.quadraticCurveTo(
        -halfWidth * 0.12,
        halfHeight * 0.36,
        -halfWidth * 0.78,
        halfHeight * 0.43,
      );
      ctx.fill();
      ctx.fillStyle = "rgb(235 250 255 / 74%)";
      ctx.beginPath();
      ctx.moveTo(-halfWidth * 0.74, halfHeight * 0.17);
      ctx.quadraticCurveTo(
        -halfWidth * 0.12,
        -halfHeight * 0.16,
        halfWidth * 0.3,
        -halfHeight * 0.23,
      );
      ctx.quadraticCurveTo(
        -halfWidth * 0.22,
        halfHeight * 0.11,
        -halfWidth * 0.74,
        halfHeight * 0.17,
      );
      ctx.fill();
      ctx.fillStyle = "#dceef4";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(halfWidth * 0.33, -halfHeight * 0.24, 31, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#718695";
      ctx.beginPath();
      ctx.arc(halfWidth * 0.25, -halfHeight * 0.32, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(halfWidth * 0.4, -halfHeight * 0.14, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (marker.id === "proxima-centauri") {
      const radius = Math.min(halfWidth, halfHeight) * 0.48;
      ctx.shadowColor = "rgb(255 95 70 / 75%)";
      ctx.shadowBlur = 30;
      ctx.strokeStyle = "#ff8b63";
      ctx.lineWidth = 7;
      for (let ray = 0; ray < 12; ray += 1) {
        const angle = (ray * Math.PI) / 6;
        const inner = radius * 1.18;
        const outer = radius * (ray % 2 ? 1.55 : 1.78);
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
        ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
        ctx.stroke();
      }
      const star = ctx.createRadialGradient(
        -radius * 0.28,
        -radius * 0.32,
        3,
        0,
        0,
        radius,
      );
      star.addColorStop(0, "#fff6c7");
      star.addColorStop(0.35, "#ffbd66");
      star.addColorStop(0.72, "#f35f43");
      star.addColorStop(1, "#a91f37");
      ctx.fillStyle = star;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgb(255 245 198 / 55%)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(-radius * 0.1, radius * 0.03, radius * 0.68, 0.4, 2.2);
      ctx.stroke();
    } else if (marker.id === "black-hole") {
      ctx.shadowColor = "rgb(162 92 255 / 80%)";
      ctx.shadowBlur = 32;
      ctx.strokeStyle = "#824dff";
      ctx.lineWidth = 19;
      ctx.beginPath();
      ctx.ellipse(0, 0, halfWidth * 0.73, halfHeight * 0.4, -0.16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#ff9361";
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.ellipse(0, 0, halfWidth * 0.82, halfHeight * 0.31, -0.16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#ffe180";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, 0, halfWidth * 0.92, halfHeight * 0.24, -0.16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#010109";
      ctx.beginPath();
      ctx.ellipse(0, 0, halfWidth * 0.43, halfHeight * 0.48, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgb(238 220 255 / 75%)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, Math.min(halfWidth, halfHeight) * 0.53, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      roundedRect(
        ctx,
        -marker.hitWidth / 2,
        -marker.hitHeight / 2,
        marker.hitWidth,
        marker.hitHeight,
        12,
      );
      ctx.fillStyle = "#b4bbb8";
      ctx.fill();
      ctx.strokeStyle = COLORS.ink;
      ctx.stroke();
    }
    ctx.restore();
  }

  #drawGoalLabel(ctx, text, x, y, cleared) {
    ctx.font = "900 12px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const width = ctx.measureText(text).width + 22;
    roundedRect(ctx, x - width / 2, y - 13, width, 26, 13);
    ctx.fillStyle = "rgb(5 10 27 / 76%)";
    ctx.fill();
    ctx.fillStyle = cleared ? COLORS.gold : COLORS.white;
    ctx.fillText(text, x, y + 0.5);
  }

  #drawFloor(ctx, width, height, game) {
    const floorY = WORLD_FLOOR_Y - game.camera.renderY;
    if (floorY < -80 || floorY >= height) {
      return;
    }
    const earthGradient = ctx.createLinearGradient(0, floorY, 0, height);
    earthGradient.addColorStop(0, COLORS.grass);
    earthGradient.addColorStop(0.12, COLORS.earth);
    earthGradient.addColorStop(1, "#182125");
    ctx.fillStyle = earthGradient;
    ctx.fillRect(0, floorY, width, height - floorY);
    ctx.fillStyle = COLORS.grassEdge;
    ctx.fillRect(0, floorY, width, 10);

    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = "#bdd4c4";
    ctx.lineWidth = 2;
    for (let x = 8; x < width; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, floorY + 1);
      ctx.lineTo(x + 4, floorY - 8 - (x % 5));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  #drawBalloons(ctx, game, assets) {
    const cameraY = game.camera.renderY;
    const balloons = [
      ...game.balloons,
      ...(game.leaderboardBalloons || []),
    ];
    for (const balloon of balloons) {
      const wobbleX = Math.sin(balloon.wobble) * 4;
      const wobbleY = Math.cos(balloon.wobble * 0.7) * 3;
      const screenX = balloon.x + wobbleX;
      const screenY = balloon.y - cameraY + wobbleY;
      if (screenY < -130 || screenY > game.camera.viewportHeight + 130) {
        continue;
      }

      if (balloon.alive) {
        const isLeaderboardBalloon =
          balloon.routeRole === "leaderboard";
        if (isLeaderboardBalloon) {
          this.#drawLeaderboardBalloonAura(
            ctx,
            balloon,
            screenX,
            screenY,
          );
        }
        const sprite = assets.get(`balloon-${balloon.color}`);
        if (sprite) {
          const scale = balloon.radius / 43;
          const width = sprite.width * scale;
          const height = sprite.height * scale;
          ctx.drawImage(
            sprite,
            screenX - width / 2,
            screenY - 48 * scale,
            width,
            height,
          );
        } else {
          ctx.fillStyle = this.#balloonColor(balloon.color);
          ctx.beginPath();
          ctx.arc(screenX, screenY, balloon.radius, 0, Math.PI * 2);
          ctx.fill();
        }

        if (isLeaderboardBalloon) {
          this.#drawLeaderboardBalloonMarker(
            ctx,
            balloon,
            screenX,
            screenY,
          );
        }

        if (balloon.showHint) {
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = "900 11px Inter, system-ui, sans-serif";
          ctx.fillStyle = "rgb(6 12 25 / 78%)";
          roundedRect(ctx, screenX - 75, screenY - 78, 150, 25, 12);
          ctx.fill();
          ctx.fillStyle = COLORS.gold;
          ctx.fillText("SLASH FROM ABOVE", screenX, screenY - 65);
        }
      } else if (balloon.poppedTimer < 0.32) {
        const burst = Math.min(1, balloon.poppedTimer / 0.25);
        const radius = balloon.radius + 26 * burst;
        ctx.strokeStyle = this.#balloonColor(balloon.color);
        ctx.lineWidth = Math.max(1, 4 * (1 - burst));
        for (let index = 0; index < 8; index += 1) {
          const angle = (index * Math.PI * 2) / 8 + balloon.wobble;
          ctx.beginPath();
          ctx.moveTo(screenX, screenY);
          ctx.lineTo(
            screenX + Math.cos(angle) * radius,
            screenY + Math.sin(angle) * radius,
          );
          ctx.stroke();
        }
      }
    }
  }

  #drawLeaderboardBalloonAura(ctx, balloon, screenX, screenY) {
    const pulse = 0.5 + Math.sin(balloon.wobble * 0.18) * 0.5;
    const haloRadius = balloon.radius * (1.85 + pulse * 0.16);
    const halo = ctx.createRadialGradient(
      screenX,
      screenY - balloon.radius * 0.16,
      balloon.radius * 0.88,
      screenX,
      screenY - balloon.radius * 0.16,
      haloRadius,
    );
    halo.addColorStop(0, "rgb(255 225 128 / 0%)");
    halo.addColorStop(0.28, "rgb(255 225 128 / 13%)");
    halo.addColorStop(0.68, "rgb(255 198 55 / 22%)");
    halo.addColorStop(1, "rgb(255 198 55 / 0%)");

    ctx.save();
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(
      screenX,
      screenY - balloon.radius * 0.16,
      haloRadius,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    ctx.strokeStyle = `rgb(255 225 128 / ${0.52 + pulse * 0.18})`;
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgb(255 201 60 / 76%)";
    ctx.shadowBlur = 8 + pulse * 4;
    ctx.beginPath();
    ctx.ellipse(
      screenX,
      screenY - balloon.radius * 0.14,
      balloon.radius * 1.34,
      balloon.radius * 1.48,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();

    ctx.strokeStyle = `rgb(255 196 45 / ${0.22 + pulse * 0.12})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(
      screenX,
      screenY - balloon.radius * 0.14,
      balloon.radius * 1.58,
      balloon.radius * 1.72,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();

    ctx.shadowBlur = 5;
    ctx.strokeStyle = "rgb(255 211 76 / 82%)";
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(screenX, screenY + balloon.radius * 0.82);
    ctx.quadraticCurveTo(
      screenX + 5,
      screenY + balloon.radius * 1.55,
      screenX + Math.sin(balloon.wobble) * 3,
      screenY + balloon.radius * 2.52,
    );
    ctx.stroke();
    ctx.restore();
  }

  #drawLeaderboardBalloonMarker(ctx, balloon, screenX, screenY) {
    const sparkleX = screenX + balloon.radius * 0.48;
    const sparkleY = screenY - balloon.radius * 0.88;
    const sparkleSize = 5 + (Math.sin(balloon.wobble * 1.7) + 1) * 2;
    ctx.save();
    ctx.translate(sparkleX, sparkleY);
    ctx.fillStyle = "#fff8c9";
    ctx.shadowColor = "#ffe180";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0, -sparkleSize);
    ctx.lineTo(sparkleSize * 0.28, -sparkleSize * 0.28);
    ctx.lineTo(sparkleSize, 0);
    ctx.lineTo(sparkleSize * 0.28, sparkleSize * 0.28);
    ctx.lineTo(0, sparkleSize);
    ctx.lineTo(-sparkleSize * 0.28, sparkleSize * 0.28);
    ctx.lineTo(-sparkleSize, 0);
    ctx.lineTo(-sparkleSize * 0.28, -sparkleSize * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    const score = Math.max(
      0,
      Math.floor(Number(balloon.leaderboardScoreMeters) || 0),
    );
    const label =
      `#${balloon.leaderboardRank} ${balloon.leaderboardInitials}` +
      ` · ${score.toLocaleString()}m`;
    ctx.font = "950 10px Inter, system-ui, sans-serif";
    const labelWidth = Math.min(150, ctx.measureText(label).width + 18);
    const labelY = screenY - balloon.radius - 45;
    ctx.fillStyle = "rgb(5 10 27 / 88%)";
    roundedRect(
      ctx,
      screenX - labelWidth * 0.5,
      labelY - 11,
      labelWidth,
      23,
      11,
    );
    ctx.fill();
    ctx.strokeStyle = "rgb(255 225 128 / 78%)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffe180";
    ctx.fillText(label, screenX, labelY + 0.5);
  }

  #drawPopEffects(ctx, game) {
    for (const effect of game.popEffects) {
      const t = effect.age / EFFECTS.popLifetimeSeconds;
      const x = effect.x;
      const y = effect.y - game.camera.renderY;
      const particleCount = effect.boosted ? 18 : 10;
      const maxDistance = effect.boosted ? 84 : 52;
      for (let index = 0; index < particleCount; index += 1) {
        const angle = (index * Math.PI * 2) / particleCount;
        const distance = 12 + t * maxDistance;
        const size = Math.max(1, (effect.boosted ? 7 : 5) * (1 - t));
        ctx.fillStyle =
          index % 3 === 0 ? COLORS.gold : this.#balloonColor(effect.color);
        ctx.beginPath();
        ctx.arc(
          x + Math.cos(angle) * distance,
          y + Math.sin(angle) * distance + t * 18,
          size,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }

  #drawReentryTrail(ctx, game, assets) {
    if (
      !game.reentry.active ||
      game.player.onGround ||
      game.player.vy <= 0
    ) {
      return;
    }
    const sprite = assets.get("reentry-trail");
    if (!sprite) {
      return;
    }
    const targetHeight = REENTRY.trailTargetHeight;
    const targetWidth = (sprite.width / sprite.height) * targetHeight;
    const x = game.player.renderX;
    const y = game.player.renderY - game.camera.renderY;
    ctx.drawImage(
      sprite,
      x - targetWidth / 2,
      y + 72 - targetHeight,
      targetWidth,
      targetHeight,
    );
  }

  #drawPlayer(ctx, game, assets) {
    const player = game.player;
    const spriteName = player.sprite;
    const sprite = assets.get(`cat-${spriteName}`);
    const x = player.renderX;
    const y = player.renderY - game.camera.renderY;
    if (!sprite) {
      ctx.fillStyle = "#ecbe7c";
      ctx.beginPath();
      ctx.ellipse(x, y, 20, 27, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    const targetHeight = CAT_TARGET_HEIGHTS[spriteName];
    const [offsetX, offsetY] = CAT_OFFSETS[spriteName];
    const image = this.#scaledSprite(
      sprite,
      targetHeight,
      player.facing < 0,
      spriteName,
    );
    const drawX = x + offsetX * player.facing;
    const drawY = y + offsetY;
    if (player.pose === "belly-up") {
      ctx.save();
      ctx.translate(drawX, drawY);
      ctx.rotate(Math.PI);
      ctx.drawImage(image, -image.width / 2, -image.height / 2);
      ctx.restore();
    } else {
      ctx.drawImage(
        image,
        drawX - image.width / 2,
        drawY - image.height / 2,
      );
    }

    if (game.hitPauseSeconds > 0) {
      const rivalCounter = game.rival?.state === "knocked-down";
      ctx.globalAlpha = rivalCounter
        ? Math.min(0.32, game.hitPauseSeconds * 6)
        : Math.min(0.65, game.hitPauseSeconds * 10);
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = rivalCounter ? 2.25 : 4;
      ctx.beginPath();
      ctx.arc(x, y, 58, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  #drawRivalFoundation(ctx, game, assets) {
    const rival = game.rival;
    if (!rival?.present || !rival.visible) {
      return;
    }
    const presentation = rivalPresentation(rival.visualFrame);
    const sprite = assets.get(presentation.asset);
    const x = rival.renderX;
    const y = rival.renderY - game.camera.renderY;
    this.#drawRivalExhaustTrail(ctx, game);
    if (!sprite || y < -150 || y > game.camera.viewportHeight + 150) {
      return;
    }

    const width = presentation.width;
    const height = (sprite.height / sprite.width) * width;
    const speedTilt = Math.max(-0.12, Math.min(0.12, rival.vx / 1900));
    const airTilt = Math.max(-0.055, Math.min(0.055, rival.vy / 5200));
    const fiddleDirection = rival.attack.fiddleDirection;
    const fiddleDiveTilt =
      Math.sign(fiddleDirection?.x || rival.facing || 1) *
      Math.atan2(
        Math.max(0, fiddleDirection?.y || 0),
        Math.max(0.001, Math.abs(fiddleDirection?.x || 0)),
      );
    const tilt = rival.frozen
      ? 0
      : rival.attack.state === "fiddle-active"
        ? Math.max(-0.82, Math.min(0.82, fiddleDiveTilt))
        : speedTilt + airTilt;
    ctx.save();
    ctx.globalAlpha = rival.state === "reentering" ? 0.9 : 0.98;
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.scale(rival.facing < 0 ? -1 : 1, 1);
    this.#drawRivalJetFlames(
      ctx,
      rival,
      game.runStats.durationSeconds,
      width,
      height,
      presentation,
    );
    ctx.drawImage(sprite, -width * 0.5, -height * 0.5, width, height);
    ctx.restore();

    this.#drawRivalSwipe(ctx, rival, x, y);
    this.#drawRivalBoostWarning(ctx, rival, x, y);
    this.#drawRivalFiddleWarning(ctx, rival, x, y);

    if (rival.frozen) {
      const label = "CAT PAUSED";
      ctx.save();
      ctx.font = "950 9px Inter, system-ui, sans-serif";
      const labelWidth = ctx.measureText(label).width + 16;
      const labelY = y - height * 0.5 - 11;
      ctx.fillStyle = "rgb(5 10 27 / 82%)";
      roundedRect(
        ctx,
        x - labelWidth * 0.5,
        labelY - 9,
        labelWidth,
        18,
        9,
      );
      ctx.fill();
      ctx.fillStyle = COLORS.cyan;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x, labelY);
      ctx.restore();
    }
  }

  #drawRivalExhaustTrail(ctx, game) {
    const rival = game.rival;
    const lifetime = RIVAL_JETPACK.exhaustTrailLifetimeSeconds;
    for (const point of rival.exhaustTrail || []) {
      const presentation = rivalPresentation(point.visualFrame);
      const width = presentation.width;
      const height = width * (2 / 3);
      const mirror = point.facing < 0 ? -1 : 1;
      const directionX = presentation.exhaust[0] * mirror;
      const directionY = presentation.exhaust[1];
      const nozzleX =
        point.x + presentation.nozzle[0] * width * mirror;
      const nozzleY =
        point.y - game.camera.renderY + presentation.nozzle[1] * height;
      const progress = Math.max(0, Math.min(1, point.ageSeconds / lifetime));
      const alpha = (1 - progress) ** 1.7 * 0.3;
      const drift = (6 + progress * 34) * point.intensity;
      const x = nozzleX + directionX * drift;
      const y = nozzleY + directionY * drift;
      const rippleLength = 6 + progress * 20 * point.intensity;
      const rippleWidth = 2.2 + progress * 6.5;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(directionY, directionX));
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "rgb(224 247 255 / 72%)";
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      ctx.ellipse(0, 0, rippleWidth, rippleLength, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.5;
      ctx.strokeStyle = "rgb(99 211 255 / 60%)";
      ctx.beginPath();
      ctx.ellipse(
        -2 - Math.sin(point.ageSeconds * 42) * 2,
        0,
        rippleWidth * 0.58,
        rippleLength * 0.7,
        0,
        -1.2,
        1.2,
      );
      ctx.stroke();
      ctx.restore();
    }
  }

  #drawRivalJetFlames(
    ctx,
    rival,
    timeSeconds,
    width,
    height,
    presentation,
  ) {
    if (!rival.jetpackActive || rival.frozen) {
      return;
    }
    const activeBoost = presentation.flameScale;
    const flicker =
      0.86 + Math.sin(timeSeconds * 34 + rival.x * 0.045) * 0.14;
    const flameLength = height * 0.26 * activeBoost * flicker;
    const directionX = presentation.exhaust[0];
    const directionY = presentation.exhaust[1];
    const startX = presentation.nozzle[0] * width;
    const startY = presentation.nozzle[1] * height;
    ctx.save();
    const endX = startX + directionX * flameLength;
    const endY = startY + directionY * flameLength;
    const halfWidth = height * 0.045 * Math.min(1.35, activeBoost);
    const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
    gradient.addColorStop(0, "rgb(239 253 255 / 98%)");
    gradient.addColorStop(0.24, "rgb(82 210 255 / 94%)");
    gradient.addColorStop(0.66, "rgb(255 194 66 / 84%)");
    gradient.addColorStop(1, "rgb(255 98 42 / 0%)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(
      startX - directionY * halfWidth,
      startY + directionX * halfWidth,
    );
    ctx.quadraticCurveTo(
      startX + directionX * flameLength * 0.58,
      startY + directionY * flameLength * 0.58,
      endX,
      endY,
    );
    ctx.quadraticCurveTo(
      startX + directionY * halfWidth,
      startY - directionX * halfWidth,
      startX + directionY * halfWidth,
      startY - directionX * halfWidth,
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  #drawRivalBoostWarning(ctx, rival, x, y) {
    if (rival.attack.state !== "boost-telegraph") {
      return;
    }
    const progress =
      1 -
      rival.attack.timerSeconds / RIVAL_VERTICAL_BOOST.telegraphSeconds;
    const top = Math.max(-28, y - 285);
    ctx.save();
    ctx.globalAlpha = 0.12 + progress * 0.1;
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 1.25;
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.moveTo(x, y - 34);
    ctx.lineTo(x, top + 18);
    ctx.stroke();
    ctx.restore();
  }

  #drawRivalSwipe(ctx, rival, x, y) {
    if (rival.attack.state !== "telegraph") {
      return;
    }
    const direction = rival.attack.direction || rival.facing || 1;
    const progress =
      1 - rival.attack.timerSeconds / RIVAL_BOW_SWIPE.telegraphSeconds;
    const pulse = Math.sin(progress * Math.PI);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(direction, 1);
    ctx.lineCap = "round";
    // The wind-up frame carries the bow over the cat's shoulder; keep the
    // warning attached to its visible tip instead of floating ahead of the
    // whole sprite.
    ctx.translate(-38, -42);
    ctx.globalAlpha = 0.12 + pulse * 0.22;
    ctx.strokeStyle = "#ffe7a0";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, 3.5 + pulse * 2.5, 0, Math.PI * 2);
    ctx.stroke();
    for (let index = 0; index < 4; index += 1) {
      const angle = index * (Math.PI / 2) + Math.PI / 4;
      const inner = 7 + pulse * 2;
      const outer = inner + 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.stroke();
    }
    ctx.restore();
  }

  #drawRivalFiddleWarning(ctx, rival, x, y) {
    if (rival.attack.state !== "fiddle-telegraph") {
      return;
    }
    const direction = rival.attack.fiddleDirection;
    const progress =
      1 - rival.attack.timerSeconds / RIVAL_FIDDLE_DROP.telegraphSeconds;
    const startDistance = 38;
    const endDistance = 310;
    ctx.save();
    ctx.globalAlpha = 0.1 + progress * 0.1;
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 9]);
    ctx.beginPath();
    ctx.moveTo(
      x + direction.x * startDistance,
      y + direction.y * startDistance,
    );
    ctx.lineTo(
      x + direction.x * endDistance,
      y + direction.y * endDistance,
    );
    ctx.stroke();
    ctx.restore();
  }

  #scaledSprite(source, targetHeight, flipped, name) {
    const targetWidth = Math.max(
      1,
      Math.round((source.width / source.height) * targetHeight),
    );
    const key = `${name}:${targetWidth}x${targetHeight}:${flipped}`;
    if (this.spriteCache.has(key)) {
      return this.spriteCache.get(key);
    }
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    if (flipped) {
      ctx.translate(targetWidth, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
    this.spriteCache.set(key, canvas);
    return canvas;
  }

  #drawComboFeedback(ctx, game) {
    for (const feedback of game.comboFeedbacks) {
      const t = feedback.age / COMBO.feedbackLifetimeSeconds;
      if (t >= 1) {
        continue;
      }
      const x = feedback.x;
      const baseY = feedback.y - game.camera.renderY;
      const y = baseY - 72 * t - 34;
      const pulse = 1 + Math.sin(t * Math.PI) * 0.14;
      const ringRadius = (28 + 44 * t) * pulse;
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = Math.max(1, 5 * (1 - t));
      ctx.beginPath();
      ctx.arc(x, baseY, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = this.#balloonColor(feedback.color);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, baseY, Math.max(4, ringRadius * 0.28), 0, Math.PI * 2);
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "950 28px Inter, system-ui, sans-serif";
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgb(5 8 20 / 88%)";
      ctx.strokeText(feedback.label, x, y);
      ctx.fillStyle = COLORS.gold;
      ctx.fillText(feedback.label, x, y);
    }
  }

  #drawHud(ctx, state, layout) {
    const game = state.game;
    const safeTop =
      (layout.safeArea.top * layout.logicalWidth) / layout.cssWidth;
    const safeLeft =
      (layout.safeArea.left * layout.logicalWidth) / layout.cssWidth;
    const x = Math.max(16, safeLeft + 12);
    const y = Math.max(16, safeTop + 12);
    roundedRect(ctx, x, y, 148, 66, 18);
    ctx.fillStyle = "rgb(5 10 27 / 70%)";
    ctx.fill();
    ctx.strokeStyle = "rgb(194 225 255 / 28%)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = COLORS.white;
    ctx.font = "950 27px Inter, system-ui, sans-serif";
    ctx.fillText(`${game.heightMeters} m`, x + 15, y + 31);
    ctx.fillStyle = COLORS.blueWhite;
    ctx.font = "800 10px Inter, system-ui, sans-serif";
    ctx.fillText(`LOCAL BEST ${game.savedBestHeightMeters} m`, x + 16, y + 51);

    if (
      game.combo.streak >= game.combo.matchAt &&
      game.combo.color
    ) {
      const comboY = y + 74;
      const comboWidth = 176;
      roundedRect(ctx, x, comboY, comboWidth, 34, 17);
      ctx.fillStyle = "rgb(5 10 27 / 78%)";
      ctx.fill();
      ctx.strokeStyle = this.#balloonColor(game.combo.color);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = this.#balloonColor(game.combo.color);
      ctx.font = "900 11px Inter, system-ui, sans-serif";
      const reward =
        game.combo.streak >= game.combo.comboAt
          ? "COMBO"
          : game.combo.streak >= game.combo.matchAt
            ? "MATCH"
            : "STREAK";
      ctx.fillText(
        `${game.combo.color.toUpperCase()} ${game.combo.streak}/${game.combo.comboAt} · ${reward}`,
        x + comboWidth / 2,
        comboY + 17,
      );
    }

    if (!state.touchControlsVisible && game.mode === "playing") {
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "rgb(7 10 24 / 62%)";
      ctx.font = "800 11px Inter, system-ui, sans-serif";
      ctx.fillText(
        "← → MOVE   ·   SPACE JUMP / SLASH",
        GAME_WIDTH / 2,
        layout.logicalHeight - 18,
      );
    }
  }

  #drawGameOver(ctx, state, layout) {
    const game = state.game;
    const width = layout.logicalWidth;
    const height = layout.logicalHeight;
    ctx.fillStyle = "rgb(2 5 15 / 66%)";
    ctx.fillRect(0, 0, width, height);

    if (game.deathScreen?.view === "leaderboard") {
      return;
    }
    this.#drawDeathSummary(ctx, state, layout);
  }

  #drawDeathSummary(ctx, state, layout) {
    const { game } = state;
    const width = layout.logicalWidth;
    const height = layout.logicalHeight;
    const cardWidth = Math.min(458, width - 32);
    const cardHeight = 390;
    const cardX = (width - cardWidth) / 2;
    const cardY = Math.max(70, (height - cardHeight) * 0.31);
    roundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 26);
    ctx.fillStyle = "rgb(5 10 27 / 95%)";
    ctx.fill();
    ctx.strokeStyle = game.newBest
      ? "rgb(255 225 128 / 78%)"
      : "rgb(134 221 255 / 58%)";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = game.newBest ? COLORS.gold : COLORS.cyan;
    ctx.font = "950 14px Inter, system-ui, sans-serif";
    ctx.fillText(
      game.newBest ? "NEW HIGH SCORE" : "RUN COMPLETE",
      width / 2,
      cardY + 34,
    );

    ctx.fillStyle = COLORS.white;
    ctx.font = "950 35px Inter, system-ui, sans-serif";
    ctx.fillText("SPLAT!", width / 2, cardY + 75);

    ctx.fillStyle = COLORS.gold;
    ctx.font = "950 48px Inter, system-ui, sans-serif";
    ctx.fillText(
      `${game.finalScoreMeters} m`,
      width / 2,
      cardY + 128,
    );

    const stats = [
      ["BALLOONS POPPED", game.runStats.balloonsPopped],
      [
        "BEST COLOR STREAK",
        game.runStats.bestCombo
          ? `${game.runStats.bestCombo}×`
          : "—",
      ],
      ["FLIGHT TIME", this.#formatRunTime(game.runStats.durationSeconds)],
    ];
    const rowLeft = cardX + 30;
    const rowRight = cardX + cardWidth - 30;
    const rowStart = cardY + 184;
    stats.forEach(([label, value], index) => {
      const y = rowStart + index * 52;
      ctx.strokeStyle = "rgb(255 255 255 / 11%)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rowLeft, y + 22);
      ctx.lineTo(rowRight, y + 22);
      ctx.stroke();
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillStyle = "rgb(216 232 244 / 62%)";
      ctx.font = "850 11px Inter, system-ui, sans-serif";
      ctx.fillText(label, rowLeft, y);
      ctx.textAlign = "right";
      ctx.fillStyle = COLORS.white;
      ctx.font = "950 18px Inter, system-ui, sans-serif";
      ctx.fillText(String(value), rowRight, y);
    });

    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.blueWhite;
    ctx.font = "800 11px Inter, system-ui, sans-serif";
    ctx.fillText(
      game.deathScreen.qualifiesForLeaderboard
        ? "THIS RUN CAN BE SUBMITTED"
        : "VIEW THE SHARED TOP TEN",
      width / 2,
      cardY + cardHeight - 24,
    );
  }

  #drawNameEntry(ctx, state, layout) {
    const { game } = state;
    const entry = game.nameEntry;
    const width = layout.logicalWidth;
    const height = layout.logicalHeight;
    const cardWidth = Math.min(450, width - 36);
    const cardHeight = 410;
    const cardX = (width - cardWidth) / 2;
    const cardY = Math.max(82, (height - cardHeight) * 0.38);
    roundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 26);
    ctx.fillStyle = "rgb(5 10 27 / 94%)";
    ctx.fill();
    ctx.strokeStyle =
      entry.invalidFlashSeconds > 0
        ? "rgb(232 112 104 / 92%)"
        : "rgb(134 221 255 / 62%)";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle =
      entry.invalidFlashSeconds > 0 ? "#e87068" : COLORS.gold;
    ctx.font = "950 17px Inter, system-ui, sans-serif";
    ctx.fillText(
      entry.invalidFlashSeconds > 0
        ? "TRY ANOTHER NAME"
        : "LEADERBOARD ENTRY",
      width / 2,
      cardY + 40,
    );

    ctx.fillStyle = COLORS.blueWhite;
    ctx.font = "850 13px Inter, system-ui, sans-serif";
    ctx.fillText(`HEIGHT ${game.finalScoreMeters} m`, width / 2, cardY + 70);

    const slotWidth = 78;
    const slotGap = 18;
    const startX =
      width / 2 - (slotWidth * 3 + slotGap * 2) / 2;
    const slotY = cardY + 105;
    for (let index = 0; index < 3; index += 1) {
      const x = startX + index * (slotWidth + slotGap);
      const active = !entry.confirming && index === entry.slot;
      roundedRect(ctx, x, slotY, slotWidth, 94, 14);
      ctx.fillStyle = active ? "#182033" : "#0d121f";
      ctx.fill();
      ctx.strokeStyle = active ? COLORS.gold : "#5e748f";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = COLORS.white;
      ctx.font = "950 42px Inter, system-ui, sans-serif";
      ctx.fillText(entry.initials[index], x + slotWidth / 2, slotY + 48);
      if (active) {
        ctx.strokeStyle = COLORS.gold;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x + 17, slotY + 107);
        ctx.lineTo(x + slotWidth - 17, slotY + 107);
        ctx.stroke();
      }
    }

    ctx.fillStyle = COLORS.blueWhite;
    ctx.font = "800 12px Inter, system-ui, sans-serif";
    ctx.fillText(
      entry.confirming
        ? state.touchControlsVisible
          ? "Arrows choose SUBMIT or REDO"
          : "Arrow keys choose SUBMIT or REDO"
        : state.touchControlsVisible
          ? "Arrows change the highlighted character"
          : "Type A-Z / 0-9 or use the arrow keys",
      width / 2,
      cardY + 247,
    );
    ctx.fillText(
      state.touchControlsVisible
        ? "Tap ENTER to continue"
        : "Space or Return continues · Backspace goes back",
      width / 2,
      cardY + 272,
    );

    if (entry.confirming) {
      const submitSelected = entry.confirmChoice === "submit";
      ctx.font = "950 19px Inter, system-ui, sans-serif";
      ctx.fillStyle = submitSelected ? COLORS.gold : "#a0b5ca";
      ctx.fillText("SUBMIT", width / 2 - 74, cardY + 322);
      ctx.fillStyle = submitSelected ? "#a0b5ca" : COLORS.gold;
      ctx.fillText("REDO", width / 2 + 76, cardY + 322);
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 3;
      ctx.beginPath();
      const underlineX = submitSelected ? width / 2 - 74 : width / 2 + 76;
      ctx.moveTo(underlineX - 37, cardY + 339);
      ctx.lineTo(underlineX + 37, cardY + 339);
      ctx.stroke();
    }

    const status = this.#leaderboardStatus(game.leaderboard);
    if (status && !entry.confirming) {
      ctx.fillStyle = COLORS.cyan;
      ctx.font = "800 12px Inter, system-ui, sans-serif";
      ctx.fillText(status, width / 2, cardY + 322);
    }
  }

  #drawLeaderboard(ctx, state, layout) {
    const { game } = state;
    const width = layout.logicalWidth;
    const height = layout.logicalHeight;
    const cardWidth = Math.min(468, width - 32);
    const cardHeight = Math.min(540, height - 96);
    const cardX = (width - cardWidth) / 2;
    const cardY = Math.max(56, (height - cardHeight) * 0.34);
    roundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 26);
    ctx.fillStyle = "rgb(5 10 27 / 95%)";
    ctx.fill();
    ctx.strokeStyle = "rgb(255 225 128 / 54%)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = COLORS.white;
    ctx.font = "950 31px Inter, system-ui, sans-serif";
    ctx.fillText("LEADERBOARD", width / 2, cardY + 47);
    ctx.fillStyle = COLORS.gold;
    ctx.font = "900 17px Inter, system-ui, sans-serif";
    ctx.fillText(
      `THIS RUN  ${game.finalScoreMeters} m`,
      width / 2,
      cardY + 86,
    );

    ctx.fillStyle = COLORS.gold;
    ctx.font = "950 13px Inter, system-ui, sans-serif";
    ctx.fillText("TOP CLIMBERS", width / 2, cardY + 126);
    const entryVisible =
      game.deathScreen?.qualifiesForLeaderboard === true;
    const status = this.#leaderboardStatus(game.leaderboard);
    if (status && !entryVisible) {
      ctx.fillStyle = COLORS.cyan;
      ctx.font = "800 11px Inter, system-ui, sans-serif";
      ctx.fillText(status, width / 2, cardY + 154);
    }

    const rows = game.leaderboard.topScores || [];
    const rowStart = cardY + (entryVisible ? 210 : 176);
    const rowHeight = Math.min(
      24,
      (cardHeight - (entryVisible ? 270 : 236)) / 10,
    );
    if (rows.length) {
      rows.slice(0, 10).forEach((entry, index) => {
        const y = rowStart + index * rowHeight;
        const isLocal =
          entry.initials === game.leaderboard.localInitials &&
          entry.score === game.leaderboard.localBest;
        ctx.font = "850 13px Inter, system-ui, sans-serif";
        ctx.textAlign = "right";
        ctx.fillStyle = "#91a8bf";
        ctx.fillText(`${index + 1}.`, width / 2 - 108, y);
        ctx.textAlign = "left";
        ctx.fillStyle = isLocal ? COLORS.gold : COLORS.white;
        ctx.fillText(entry.initials, width / 2 - 91, y);
        ctx.textAlign = "right";
        ctx.fillText(`${entry.score} m`, width / 2 + 117, y);
      });
    } else {
      ctx.textAlign = "center";
      ctx.fillStyle = COLORS.blueWhite;
      ctx.font = "800 13px Inter, system-ui, sans-serif";
      ctx.fillText(
        game.leaderboard.status === "loading"
          ? "Calling mission control…"
          : "No shared scores cached yet.",
        width / 2,
        rowStart + 28,
      );
    }

    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.white;
    ctx.font = "900 14px Inter, system-ui, sans-serif";
    ctx.fillText(
      state.touchControlsVisible
        ? "Tap RETRY to climb again"
        : "Press R, Enter, or Space to retry",
      width / 2,
      cardY + cardHeight - 31,
    );
  }

  #leaderboardStatus(leaderboard) {
    if (!leaderboard) {
      return "";
    }
    if (leaderboard.status === "loading") {
      return "LOADING LEADERBOARD…";
    }
    if (leaderboard.status === "submitting") {
      return "SAVING SCORE…";
    }
    if (leaderboard.status === "submitted") {
      return "SCORE SAVED";
    }
    if (leaderboard.status === "error") {
      return leaderboard.pendingCount
        ? "OFFLINE · SCORE QUEUED LOCALLY"
        : "OFFLINE · CACHED SCORES";
    }
    return "";
  }

  #formatRunTime(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const minutes = Math.floor(total / 60);
    const remainder = total % 60;
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
  }

  #balloonColor(name) {
    return (
      {
        red: "#ef565e",
        yellow: "#f2cd4b",
        green: "#69ba68",
        blue: "#5aa8e8",
        gold: "#ffd34c",
        goal: "#f5f5e2",
      }[name] || "#ef565e"
    );
  }

  #backgroundBlend(height) {
    for (let index = 0; index < BACKGROUND_PHASES.length - 1; index += 1) {
      const phase = BACKGROUND_PHASES[index];
      const next = BACKGROUND_PHASES[index + 1];
      if (height <= next.height) {
        const raw = Math.max(
          0,
          Math.min(1, (height - phase.height) / (next.height - phase.height)),
        );
        return {
          phase,
          next,
          mix: raw * raw * (3 - 2 * raw),
        };
      }
    }
    const phase = BACKGROUND_PHASES.at(-1);
    return { phase, next: phase, mix: 0 };
  }

  #mixNumber(a, b, t) {
    return a * (1 - t) + b * t;
  }

  #mixColor(a, b, t) {
    return `rgb(${Math.round(a[0] * (1 - t) + b[0] * t)} ${Math.round(
      a[1] * (1 - t) + b[1] * t,
    )} ${Math.round(a[2] * (1 - t) + b[2] * t)})`;
  }
}
