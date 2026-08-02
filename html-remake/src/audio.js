const STORAGE_KEYS = Object.freeze({
  muted: "over-the-moon.audio.muted",
  effects: "over-the-moon.audio.effects",
  ambience: "over-the-moon.audio.ambience",
});

const BALLOON_POP_URL = new URL(
  "../assets/audio/balloon-pop-cc0.wav",
  import.meta.url,
).href;

const clamp = (value, minimum, maximum) =>
  Math.max(minimum, Math.min(maximum, value));

const AMBIENCE_PROFILES = Object.freeze([
  Object.freeze({
    height: 0,
    name: "ground-air",
    airLevel: 0.032,
    airCutoffHz: 900,
    humFrequencyHz: 58,
    humLevel: 0,
  }),
  Object.freeze({
    height: 7600,
    name: "kuiper-belt",
    airLevel: 0.011,
    airCutoffHz: 2800,
    humFrequencyHz: 76,
    humLevel: 0.012,
  }),
  Object.freeze({
    height: 9600,
    name: "kuiper-belt",
    airLevel: 0.011,
    airCutoffHz: 2800,
    humFrequencyHz: 76,
    humLevel: 0.012,
  }),
  Object.freeze({
    height: 10400,
    name: "heliopause",
    airLevel: 0.0135,
    airCutoffHz: 3300,
    humFrequencyHz: 84,
    humLevel: 0.013,
  }),
  Object.freeze({
    height: 12100,
    name: "heliopause",
    airLevel: 0.0135,
    airCutoffHz: 3300,
    humFrequencyHz: 84,
    humLevel: 0.013,
  }),
  Object.freeze({
    height: 12800,
    name: "interstellar",
    airLevel: 0.0065,
    airCutoffHz: 1700,
    humFrequencyHz: 62,
    humLevel: 0.008,
  }),
  Object.freeze({
    height: 15100,
    name: "interstellar",
    airLevel: 0.006,
    airCutoffHz: 1650,
    humFrequencyHz: 61,
    humLevel: 0.008,
  }),
  Object.freeze({
    height: 15800,
    name: "proxima-region",
    airLevel: 0.0085,
    airCutoffHz: 2350,
    humFrequencyHz: 70,
    humLevel: 0.012,
  }),
  Object.freeze({
    height: 17200,
    name: "proxima-region",
    airLevel: 0.0085,
    airCutoffHz: 2350,
    humFrequencyHz: 70,
    humLevel: 0.012,
  }),
  Object.freeze({
    height: 17800,
    name: "black-hole-region",
    airLevel: 0.0045,
    airCutoffHz: 1400,
    humFrequencyHz: 46,
    humLevel: 0.014,
  }),
]);

const mixNumber = (a, b, amount) => a * (1 - amount) + b * amount;
const rounded = (value) => Number(value.toFixed(4));

export function ambienceProfileAtHeight(heightMeters) {
  const height = Math.max(0, Number(heightMeters) || 0);
  for (let index = 0; index < AMBIENCE_PROFILES.length - 1; index += 1) {
    const current = AMBIENCE_PROFILES[index];
    const next = AMBIENCE_PROFILES[index + 1];
    if (height <= next.height) {
      const raw = clamp(
        (height - current.height) / (next.height - current.height),
        0,
        1,
      );
      const mix = raw * raw * (3 - 2 * raw);
      const dominant = mix < 0.5 ? current : next;
      return {
        current: current.name,
        next: next.name,
        dominant: dominant.name,
        mix: rounded(mix),
        airLevel: rounded(mixNumber(current.airLevel, next.airLevel, mix)),
        airCutoffHz: rounded(
          mixNumber(current.airCutoffHz, next.airCutoffHz, mix),
        ),
        humFrequencyHz: rounded(
          mixNumber(current.humFrequencyHz, next.humFrequencyHz, mix),
        ),
        humLevel: rounded(mixNumber(current.humLevel, next.humLevel, mix)),
      };
    }
  }
  const last = AMBIENCE_PROFILES.at(-1);
  return {
    current: last.name,
    next: last.name,
    dominant: last.name,
    mix: 0,
    airLevel: last.airLevel,
    airCutoffHz: last.airCutoffHz,
    humFrequencyHz: last.humFrequencyHz,
    humLevel: last.humLevel,
  };
}

const readStoredNumber = (key, fallback) => {
  try {
    const parsed = Number.parseFloat(localStorage.getItem(key));
    return Number.isFinite(parsed) ? clamp(parsed, 0, 1) : fallback;
  } catch {
    return fallback;
  }
};

const readStoredBoolean = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === "true";
  } catch {
    return fallback;
  }
};

const writeStored = (key, value) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Storage is optional; audio must remain playable without it.
  }
};

export class GameAudio {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.effectsGain = null;
    this.ambienceGain = null;
    this.unlocked = false;
    this.pageHidden = Boolean(document.hidden);
    this.muted = readStoredBoolean(STORAGE_KEYS.muted, false);
    this.effectsVolume = readStoredNumber(STORAGE_KEYS.effects, 0.82);
    this.ambienceVolume = readStoredNumber(STORAGE_KEYS.ambience, 0.55);
    this.maxVoices = 16;
    this.voices = [];
    this.balloonPopBuffer = null;
    this.balloonPopLoadPromise = null;
    this.ambienceNodes = null;
    this.ambienceHeight = 0;
    this.ambienceMode = "menu";
    this.lastAmbienceAppliedHeight = Number.NaN;
    this.lastAmbienceAppliedMode = null;
    this.audioAssetFailures = [];
    this.requestCounts = {};
    this.playCounts = {};
    this.lastEvent = null;
    this.error = null;
  }

  async unlock() {
    try {
      if (!this.context) {
        const AudioContextClass =
          globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AudioContextClass) {
          throw new Error("Web Audio is unavailable in this browser.");
        }
        this.context = new AudioContextClass();
        this.masterGain = this.context.createGain();
        this.effectsGain = this.context.createGain();
        this.ambienceGain = this.context.createGain();
        this.effectsGain.connect(this.masterGain);
        this.ambienceGain.connect(this.masterGain);
        this.masterGain.connect(this.context.destination);
        this.#startAdaptiveAmbience();
        this.#applyGains();
      }
      await this.#loadRecordedSounds();
      if (!this.pageHidden && this.context.state === "suspended") {
        await this.context.resume();
      }
      this.unlocked = true;
      this.error = null;
      return true;
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  async setPageHidden(hidden) {
    this.pageHidden = Boolean(hidden);
    if (!this.context || !this.unlocked) {
      return;
    }
    try {
      if (this.pageHidden && this.context.state === "running") {
        await this.context.suspend();
      } else if (!this.pageHidden && this.context.state === "suspended") {
        await this.context.resume();
      }
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    }
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    writeStored(STORAGE_KEYS.muted, this.muted);
    this.#applyGains();
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setEffectsVolume(value) {
    this.effectsVolume = clamp(Number(value) || 0, 0, 1);
    writeStored(STORAGE_KEYS.effects, this.effectsVolume);
    this.#applyGains();
  }

  setAmbienceVolume(value) {
    this.ambienceVolume = clamp(Number(value) || 0, 0, 1);
    writeStored(STORAGE_KEYS.ambience, this.ambienceVolume);
    this.#applyGains();
  }

  setAltitude(heightMeters, mode = "playing") {
    this.ambienceHeight = Math.max(0, Number(heightMeters) || 0);
    this.ambienceMode = mode;
    if (
      this.lastAmbienceAppliedMode === mode &&
      Math.abs(this.ambienceHeight - this.lastAmbienceAppliedHeight) < 20
    ) {
      return;
    }
    this.lastAmbienceAppliedHeight = this.ambienceHeight;
    this.lastAmbienceAppliedMode = mode;
    this.#applyAmbienceMix();
  }

  play(name) {
    this.requestCounts[name] = (this.requestCounts[name] || 0) + 1;
    this.lastEvent = name;
    if (
      !this.context ||
      !this.unlocked ||
      this.muted ||
      this.pageHidden ||
      this.context.state !== "running"
    ) {
      return false;
    }

    const now = this.context.currentTime + 0.005;
    switch (name) {
      case "ui":
        this.#tone(now, 0.09, 420, 650, "sine", 0.12);
        break;
      case "jump":
        this.#tone(now, 0.14, 250, 520, "triangle", 0.18);
        break;
      case "slash":
        this.#swordSwish(now);
        break;
      case "rivalSwipeTelegraph":
        this.#tone(now, 0.11, 540, 690, "triangle", 0.055);
        this.#tone(now + 0.13, 0.12, 610, 790, "sine", 0.045);
        break;
      case "rivalSwipe":
        this.#swordSwish(now);
        break;
      case "rivalBoostTelegraph":
        this.#tone(now, 0.16, 190, 330, "triangle", 0.055);
        this.#tone(now + 0.13, 0.2, 280, 540, "sine", 0.045);
        break;
      case "rivalBoost":
        this.#tone(now, 0.22, 160, 690, "sawtooth", 0.075);
        this.#swordSwish(now + 0.025);
        break;
      case "rivalBoostHit":
        this.#tone(now, 0.14, 180, 82, "triangle", 0.12);
        this.#tone(now + 0.03, 0.11, 350, 145, "sine", 0.06);
        break;
      case "rivalClank":
        this.#tone(now, 0.065, 520, 390, "triangle", 0.05);
        this.#tone(now + 0.008, 0.045, 780, 560, "sine", 0.025);
        break;
      case "rivalFiddleTelegraph":
        this.#tone(now, 0.16, 330, 225, "triangle", 0.06);
        this.#tone(now + 0.16, 0.18, 270, 185, "sine", 0.05);
        break;
      case "rivalFiddleDrop":
        this.#tone(now, 0.24, 270, 82, "sawtooth", 0.07);
        this.#swordSwish(now + 0.035);
        break;
      case "rivalFiddleHit":
        this.#tone(now, 0.16, 145, 62, "triangle", 0.13);
        this.#tone(now + 0.025, 0.12, 250, 96, "sine", 0.065);
        break;
      case "rivalHit":
        this.#tone(now, 0.13, 155, 74, "triangle", 0.12);
        this.#tone(now + 0.025, 0.09, 290, 118, "sine", 0.055);
        break;
      case "rivalCounter":
        this.#tone(now, 0.12, 310, 620, "triangle", 0.08);
        this.#tone(now + 0.045, 0.13, 520, 880, "sine", 0.055);
        break;
      case "rivalRetreat":
        this.#tone(now, 0.11, 410, 220, "triangle", 0.07);
        this.#tone(now + 0.09, 0.16, 270, 105, "sine", 0.06);
        break;
      case "balloonPop":
      case "rivalBalloonPop":
        this.#mouthBalloonPop(now);
        break;
      case "bounce":
        this.#tone(now + 0.025, 0.18, 280, 720, "sine", 0.18);
        break;
      case "match":
        this.#tone(now, 0.12, 430, 620, "sine", 0.09);
        this.#tone(now + 0.055, 0.13, 560, 820, "triangle", 0.07);
        break;
      case "combo":
        this.#tone(now, 0.14, 420, 700, "sine", 0.09);
        this.#tone(now + 0.06, 0.16, 590, 980, "triangle", 0.08);
        this.#tone(now + 0.12, 0.18, 760, 1240, "sine", 0.06);
        break;
      case "landmarkClear":
        this.#tone(now, 0.24, 300, 660, "triangle", 0.11);
        this.#tone(now + 0.09, 0.3, 520, 1040, "sine", 0.08);
        break;
      case "landing":
        this.#tone(now, 0.09, 145, 72, "triangle", 0.13);
        break;
      case "gameOver":
        this.#tone(now, 0.3, 330, 135, "triangle", 0.11);
        this.#tone(now + 0.1, 0.34, 220, 82, "sine", 0.07);
        break;
      case "retry":
        this.#tone(now, 0.12, 260, 510, "triangle", 0.12);
        this.#tone(now + 0.07, 0.14, 390, 720, "sine", 0.08);
        break;
      case "invalidInitials":
        this.#tone(now, 0.11, 210, 165, "triangle", 0.07);
        this.#tone(now + 0.08, 0.13, 175, 125, "sine", 0.055);
        break;
      case "scoreSubmit":
        this.#tone(now, 0.13, 430, 650, "triangle", 0.08);
        this.#tone(now + 0.075, 0.18, 620, 930, "sine", 0.065);
        break;
      default:
        return false;
    }
    this.playCounts[name] = (this.playCounts[name] || 0) + 1;
    return true;
  }

  getSnapshot() {
    return {
      implemented: true,
      unlocked: this.unlocked,
      contextState: this.context?.state || "not-created",
      muted: this.muted,
      effectsVolume: this.effectsVolume,
      ambienceVolume: this.ambienceVolume,
      independentBuses: ["effects", "ambience"],
      soundDesign: {
        slash: "filtered-noise-swish-v2",
        rivalSwipeTelegraph: "soft-two-note-warning-v1",
        rivalSwipe: "filtered-noise-swish-v2",
        rivalBoostTelegraph: "two-stage-rising-engine-warning-v1",
        rivalBoost: "rising-jet-and-bow-swish-v1",
        rivalBoostHit: "short-vertical-impact-v1",
        rivalClank: "short-soft-metal-tink-v1",
        rivalFiddleTelegraph: "two-note-low-string-warning-v1",
        rivalFiddleDrop: "descending-fiddle-rush-v1",
        rivalFiddleHit: "short-heavy-fiddle-impact-v1",
        rivalHit: "short-low-impact-v1",
        rivalCounter: "short-rising-counter-v1",
        rivalRetreat: "short-descending-retreat-v1",
        balloonPop: "quiet-mouth-pop-v5",
        gameOver: "soft-descending-two-tone-v1",
        retry: "short-rising-two-tone-v1",
        match: "short-two-note-rise-v1",
        combo: "three-note-rise-v1",
        landmarkClear: "wide-two-note-chime-v1",
        adaptiveAmbience: "filtered-air-and-upper-cosmos-hum-v2",
      },
      adaptiveAmbience: {
        implemented: true,
        active: Boolean(this.ambienceNodes),
        heightMeters: Math.floor(this.ambienceHeight),
        mode: this.ambienceMode,
        chapter: ambienceProfileAtHeight(this.ambienceHeight),
      },
      audioAssets: {
        balloonPopReady: Boolean(this.balloonPopBuffer),
        failures: [...this.audioAssetFailures],
      },
      activeVoices: this.voices.length,
      maxVoices: this.maxVoices,
      pageHidden: this.pageHidden,
      lastEvent: this.lastEvent,
      requestCounts: { ...this.requestCounts },
      playCounts: { ...this.playCounts },
      error: this.error,
    };
  }

  #applyGains() {
    if (!(this.masterGain && this.effectsGain && this.ambienceGain)) {
      return;
    }
    const now = this.context.currentTime;
    this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 1, now, 0.01);
    this.effectsGain.gain.setTargetAtTime(this.effectsVolume, now, 0.01);
    this.ambienceGain.gain.setTargetAtTime(this.ambienceVolume, now, 0.01);
    this.#applyAmbienceMix();
  }

  #startAdaptiveAmbience() {
    const duration = 2;
    const sampleCount = Math.max(
      1,
      Math.round(this.context.sampleRate * duration),
    );
    const noiseBuffer = this.context.createBuffer(
      1,
      sampleCount,
      this.context.sampleRate,
    );
    const samples = noiseBuffer.getChannelData(0);
    let smoothed = 0;
    for (let index = 0; index < samples.length; index += 1) {
      smoothed = smoothed * 0.975 + (Math.random() * 2 - 1) * 0.025;
      samples[index] = smoothed * 3.2;
    }

    const air = this.context.createBufferSource();
    const airHighpass = this.context.createBiquadFilter();
    const airLowpass = this.context.createBiquadFilter();
    const airGain = this.context.createGain();
    air.buffer = noiseBuffer;
    air.loop = true;
    airHighpass.type = "highpass";
    airHighpass.frequency.value = 75;
    airLowpass.type = "lowpass";
    airLowpass.frequency.value = 980;
    airGain.gain.value = 0.0001;
    air.connect(airHighpass);
    airHighpass.connect(airLowpass);
    airLowpass.connect(airGain);
    airGain.connect(this.ambienceGain);

    const hum = this.context.createOscillator();
    const humFilter = this.context.createBiquadFilter();
    const humGain = this.context.createGain();
    hum.type = "sine";
    hum.frequency.value = 58;
    humFilter.type = "lowpass";
    humFilter.frequency.value = 180;
    humGain.gain.value = 0.0001;
    hum.connect(humFilter);
    humFilter.connect(humGain);
    humGain.connect(this.ambienceGain);

    air.start();
    hum.start();
    this.ambienceNodes = {
      air,
      airLowpass,
      airGain,
      hum,
      humGain,
    };
    this.#applyAmbienceMix();
  }

  #applyAmbienceMix() {
    if (!(this.context && this.ambienceNodes)) {
      return;
    }
    const now = this.context.currentTime;
    const profile = ambienceProfileAtHeight(this.ambienceHeight);
    const modeGain =
      this.ambienceMode === "playing"
        ? 1
        : this.ambienceMode === "gameover"
          ? 0.45
          : 0;
    const airLevel = modeGain * profile.airLevel;
    const humLevel = modeGain * profile.humLevel;
    this.ambienceNodes.airGain.gain.setTargetAtTime(
      Math.max(0.0001, airLevel),
      now,
      0.65,
    );
    this.ambienceNodes.airLowpass.frequency.setTargetAtTime(
      profile.airCutoffHz,
      now,
      0.8,
    );
    this.ambienceNodes.hum.frequency.setTargetAtTime(
      profile.humFrequencyHz,
      now,
      0.8,
    );
    this.ambienceNodes.humGain.gain.setTargetAtTime(
      Math.max(0.0001, humLevel),
      now,
      0.8,
    );
  }

  #tone(start, duration, startFrequency, endFrequency, type, peakGain) {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(20, endFrequency),
      start + duration,
    );
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peakGain, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.effectsGain);
    this.#registerVoice(oscillator);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  #swordSwish(start) {
    const duration = 0.19;
    const sampleCount = Math.max(
      1,
      Math.round(this.context.sampleRate * duration),
    );
    const buffer = this.context.createBuffer(
      1,
      sampleCount,
      this.context.sampleRate,
    );
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.random() * 2 - 1;
    }
    const source = this.context.createBufferSource();
    const highpass = this.context.createBiquadFilter();
    const lowpass = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer;
    highpass.type = "highpass";
    highpass.frequency.setValueAtTime(260, start);
    highpass.Q.setValueAtTime(0.55, start);
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(5200, start);
    lowpass.frequency.exponentialRampToValueAtTime(850, start + duration);
    lowpass.Q.setValueAtTime(0.75, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.09, start + 0.045);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(this.effectsGain);
    this.#registerVoice(source);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  #recordedBalloonPop(start) {
    const source = this.context.createBufferSource();
    const lowpass = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.balloonPopBuffer;
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(3200, start);
    lowpass.Q.setValueAtTime(0.5, start);
    gain.gain.setValueAtTime(0.12, start);
    source.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(this.effectsGain);
    this.#registerVoice(source);
    source.start(start);
  }

  #mouthBalloonPop(start) {
    const burstDuration = 0.047;
    const sampleCount = Math.max(
      1,
      Math.round(this.context.sampleRate * burstDuration),
    );
    const buffer = this.context.createBuffer(
      1,
      sampleCount,
      this.context.sampleRate,
    );
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      const progress = index / samples.length;
      const lipEnvelope = (1 - progress) ** 2.8;
      samples[index] = (Math.random() * 2 - 1) * lipEnvelope;
    }
    const burst = this.context.createBufferSource();
    const highpass = this.context.createBiquadFilter();
    const lowpass = this.context.createBiquadFilter();
    const burstGain = this.context.createGain();
    burst.buffer = buffer;
    highpass.type = "highpass";
    highpass.frequency.setValueAtTime(105, start);
    highpass.Q.setValueAtTime(0.45, start);
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(1450, start);
    lowpass.Q.setValueAtTime(0.7, start);
    burstGain.gain.setValueAtTime(0.044, start);
    burstGain.gain.exponentialRampToValueAtTime(
      0.0001,
      start + burstDuration,
    );
    burst.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(burstGain);
    burstGain.connect(this.effectsGain);
    this.#registerVoice(burst);
    burst.start(start);
    burst.stop(start + burstDuration + 0.02);

    const bodyDuration = 0.072;
    const body = this.context.createOscillator();
    const bodyGain = this.context.createGain();
    body.type = "triangle";
    body.frequency.setValueAtTime(185, start);
    body.frequency.exponentialRampToValueAtTime(
      112,
      start + bodyDuration,
    );
    bodyGain.gain.setValueAtTime(0.0001, start);
    bodyGain.gain.exponentialRampToValueAtTime(0.021, start + 0.003);
    bodyGain.gain.exponentialRampToValueAtTime(
      0.0001,
      start + bodyDuration,
    );
    body.connect(bodyGain);
    bodyGain.connect(this.effectsGain);
    this.#registerVoice(body);
    body.start(start);
    body.stop(start + bodyDuration + 0.02);

    const mouthDuration = 0.058;
    const mouth = this.context.createOscillator();
    const mouthGain = this.context.createGain();
    mouth.type = "sine";
    mouth.frequency.setValueAtTime(560, start + 0.003);
    mouth.frequency.exponentialRampToValueAtTime(
      390,
      start + mouthDuration,
    );
    mouthGain.gain.setValueAtTime(0.0001, start);
    mouthGain.gain.exponentialRampToValueAtTime(0.008, start + 0.006);
    mouthGain.gain.exponentialRampToValueAtTime(
      0.0001,
      start + mouthDuration,
    );
    mouth.connect(mouthGain);
    mouthGain.connect(this.effectsGain);
    this.#registerVoice(mouth);
    mouth.start(start);
    mouth.stop(start + mouthDuration + 0.02);
  }

  #mellowBalloonPop(start) {
    const noiseDuration = 0.042;
    const sampleCount = Math.max(
      1,
      Math.round(this.context.sampleRate * noiseDuration),
    );
    const buffer = this.context.createBuffer(
      1,
      sampleCount,
      this.context.sampleRate,
    );
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.random() * 2 - 1;
    }
    const source = this.context.createBufferSource();
    const highpass = this.context.createBiquadFilter();
    const lowpass = this.context.createBiquadFilter();
    const noiseGain = this.context.createGain();
    source.buffer = buffer;
    highpass.type = "highpass";
    highpass.frequency.setValueAtTime(220, start);
    highpass.Q.setValueAtTime(0.45, start);
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(2300, start);
    lowpass.Q.setValueAtTime(0.5, start);
    noiseGain.gain.setValueAtTime(0.068, start);
    noiseGain.gain.exponentialRampToValueAtTime(
      0.0001,
      start + noiseDuration,
    );
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(noiseGain);
    noiseGain.connect(this.effectsGain);
    this.#registerVoice(source);
    source.start(start);
    source.stop(start + noiseDuration + 0.02);

    const bodyDuration = 0.038;
    const oscillator = this.context.createOscillator();
    const bodyGain = this.context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(180, start);
    oscillator.frequency.exponentialRampToValueAtTime(
      150,
      start + bodyDuration,
    );
    bodyGain.gain.setValueAtTime(0.0001, start);
    bodyGain.gain.exponentialRampToValueAtTime(0.038, start + 0.0015);
    bodyGain.gain.exponentialRampToValueAtTime(
      0.0001,
      start + bodyDuration,
    );
    oscillator.connect(bodyGain);
    bodyGain.connect(this.effectsGain);
    this.#registerVoice(oscillator);
    oscillator.start(start);
    oscillator.stop(start + bodyDuration + 0.02);
  }

  async #loadRecordedSounds() {
    if (this.balloonPopBuffer) {
      return true;
    }
    if (!this.balloonPopLoadPromise) {
      this.balloonPopLoadPromise = fetch(BALLOON_POP_URL)
        .then((response) => {
          if (!response.ok) {
            throw new Error(
              `Balloon pop request failed with HTTP ${response.status}.`,
            );
          }
          return response.arrayBuffer();
        })
        .then((data) => this.context.decodeAudioData(data))
        .then((buffer) => {
          this.balloonPopBuffer = buffer;
          return true;
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          if (!this.audioAssetFailures.includes(message)) {
            this.audioAssetFailures.push(message);
          }
          return false;
        });
    }
    return this.balloonPopLoadPromise;
  }

  #registerVoice(source) {
    while (this.voices.length >= this.maxVoices) {
      const oldest = this.voices.shift();
      try {
        oldest.stop();
      } catch {
        // A voice may have already ended between pruning and stop().
      }
    }
    this.voices.push(source);
    source.addEventListener("ended", () => {
      this.voices = this.voices.filter((voice) => voice !== source);
    });
  }
}
