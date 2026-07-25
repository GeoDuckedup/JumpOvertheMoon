import {
  GAME_WIDTH,
  GOALS,
  GOAL_MARKERS,
  ROUTE,
} from "./game-config.js?v=10.2.0";

const clamp = (value, minimum, maximum) =>
  Math.max(minimum, Math.min(maximum, value));

const normalizeSeed = (seed) => {
  const numeric = Number(seed);
  return (Number.isFinite(numeric) ? numeric : 1) >>> 0 || 1;
};

export class SeededRandom {
  constructor(seed) {
    this.state = normalizeSeed(seed);
  }

  unit() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  integer(minimum, maximumInclusive) {
    return (
      minimum +
      Math.floor(this.unit() * (maximumInclusive - minimum + 1))
    );
  }

  uniform(minimum, maximum) {
    return minimum + this.unit() * (maximum - minimum);
  }

  choice(values) {
    return values[this.integer(0, values.length - 1)];
  }
}

export class BalloonRoute {
  constructor(seed) {
    this.reset(seed);
  }

  reset(seed) {
    this.seed = normalizeSeed(seed);
    this.random = new SeededRandom(this.seed);
    this.lastBalloonX = GAME_WIDTH * 0.5;
    this.nextBalloonY = ROUTE.firstY;
    this.nextBalloonId = 1;
    this.mainStepsGenerated = 0;
    this.totalGenerated = 0;
    this.goalApproachMarkerIds = new Set();
  }

  spawnThrough(targetTopY) {
    const balloons = [];
    while (this.nextBalloonY > targetTopY) {
      balloons.push(...this.#spawnStep());
    }
    return balloons;
  }

  getSnapshot() {
    return {
      seed: this.seed,
      nextBalloonY: this.nextBalloonY,
      lastBalloonX: this.lastBalloonX,
      mainStepsGenerated: this.mainStepsGenerated,
      totalGenerated: this.totalGenerated,
      goalApproachMarkerIds: [...this.goalApproachMarkerIds],
    };
  }

  #spawnStep() {
    const y = this.nextBalloonY;
    this.nextBalloonY -= this.random.integer(
      ROUTE.spacingMin,
      ROUTE.spacingMaxExclusive - 1,
    );
    this.mainStepsGenerated += 1;

    const nearbyMarker = this.#goalMarkerAtY(y);
    if (nearbyMarker) {
      this.lastBalloonX = nearbyMarker.x;
      const approach = this.#spawnGoalApproach(nearbyMarker);
      if (approach) {
        this.totalGenerated += 1;
        return [approach];
      }
      return [];
    }

    const radius = this.random.integer(
      ROUTE.mainRadiusMin,
      ROUTE.mainRadiusMax,
    );
    const margin = radius + 32;
    const x = this.#nextMainX(margin);
    this.lastBalloonX = x;

    const results = [this.#makeBalloon(x, y, radius, "main")];
    const side = this.#maybeSpawnSide(x, y);
    if (side) {
      results.push(side);
    }
    this.totalGenerated += results.length;
    return results;
  }

  #nextMainX(margin) {
    const left = margin;
    const right = GAME_WIDTH - margin;
    const baseX = clamp(this.lastBalloonX, left, right);
    let x =
      baseX +
      this.random.integer(
        -ROUTE.maxHorizontalDrift,
        ROUTE.maxHorizontalDrift,
      );

    while (x < left || x > right) {
      if (x < left) {
        x = left + (left - x);
      } else {
        x = right - (x - right);
      }
    }
    return x;
  }

  #maybeSpawnSide(mainX, mainY) {
    if (this.random.unit() > ROUTE.sideChance) {
      return null;
    }

    const radius = this.random.integer(
      ROUTE.sideRadiusMin,
      ROUTE.sideRadiusMax,
    );
    const margin = radius + 32;
    const x = this.#sideX(mainX, margin);
    if (Math.abs(x - mainX) < ROUTE.sideMinXOffset * 0.75) {
      return null;
    }

    return this.#makeBalloon(
      x,
      mainY +
        this.random.integer(-ROUTE.sideYJitter, ROUTE.sideYJitter),
      radius,
      "side",
      null,
      true,
    );
  }

  #sideX(mainX, margin) {
    const left = margin;
    const right = GAME_WIDTH - margin;
    const candidates = [];

    const leftMin = Math.max(left, mainX - ROUTE.sideMaxXOffset);
    const leftMax = Math.min(right, mainX - ROUTE.sideMinXOffset);
    if (leftMin <= leftMax) {
      candidates.push([leftMin, leftMax]);
    }

    const rightMin = Math.max(left, mainX + ROUTE.sideMinXOffset);
    const rightMax = Math.min(right, mainX + ROUTE.sideMaxXOffset);
    if (rightMin <= rightMax) {
      candidates.push([rightMin, rightMax]);
    }

    if (!candidates.length) {
      return clamp(mainX, left, right);
    }
    const [low, high] = this.random.choice(candidates);
    return this.random.integer(Math.round(low), Math.round(high));
  }

  #spawnGoalApproach(marker) {
    if (this.goalApproachMarkerIds.has(marker.id)) {
      return null;
    }
    this.goalApproachMarkerIds.add(marker.id);
    const radius = this.random.integer(27, 33);
    const margin = radius + 32;
    const x = clamp(
      marker.x +
        this.random.integer(-GOALS.approachXJitter, GOALS.approachXJitter),
      margin,
      GAME_WIDTH - margin,
    );
    return this.#makeBalloon(
      x,
      marker.clearanceBottomY + GOALS.approachBalloonGap,
      radius,
      "main",
      marker.id,
    );
  }

  #goalMarkerAtY(y) {
    return (
      GOAL_MARKERS.find(
        (marker) =>
          y >= marker.clearanceTopY && y <= marker.clearanceBottomY,
      ) || null
    );
  }

  #makeBalloon(
    x,
    y,
    radius,
    routeRole,
    landmarkApproach = null,
    rejectIfInGoalBand = false,
  ) {
    if (rejectIfInGoalBand && this.#goalMarkerAtY(y)) {
      return null;
    }
    return {
      id: `balloon-${this.nextBalloonId++}`,
      x,
      y,
      radius,
      color: this.random.choice(ROUTE.colors),
      wobble: this.random.unit() * Math.PI * 2,
      routeRole,
      landmarkApproach,
      alive: true,
      poppedTimer: 0,
    };
  }
}
