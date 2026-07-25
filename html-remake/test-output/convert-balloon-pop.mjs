import fs from "node:fs";
import { chromium } from "/Users/danemerman/.codex/skills/develop-web-game/node_modules/playwright/index.mjs";

const inputPath = "/tmp/over-the-moon-balloon-pop.flac";
const outputPath =
  "html-remake/assets/audio/balloon-pop-cc0.wav";

const browser = await chromium.launch({ headless: true });
let decoded;
try {
  const page = await browser.newPage();
  const base64 = fs.readFileSync(inputPath).toString("base64");
  decoded = await page.evaluate(async (encoded) => {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    const context = new AudioContext();
    const buffer = await context.decodeAudioData(bytes.buffer);
    const channel = buffer.getChannelData(0);
    const samples = Array.from(channel);
    await context.close();
    return {
      sampleRate: buffer.sampleRate,
      numberOfChannels: buffer.numberOfChannels,
      samples,
    };
  }, base64);
} finally {
  await browser.close();
}

const { sampleRate, samples } = decoded;
const byteLength = 44 + samples.length * 2;
const wav = Buffer.alloc(byteLength);
wav.write("RIFF", 0);
wav.writeUInt32LE(byteLength - 8, 4);
wav.write("WAVE", 8);
wav.write("fmt ", 12);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sampleRate, 24);
wav.writeUInt32LE(sampleRate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(samples.length * 2, 40);

let peak = 0;
let firstAudible = samples.length;
let lastAudible = 0;
for (let index = 0; index < samples.length; index += 1) {
  const sample = Math.max(-1, Math.min(1, samples[index]));
  const magnitude = Math.abs(sample);
  peak = Math.max(peak, magnitude);
  if (magnitude >= 0.005) {
    firstAudible = Math.min(firstAudible, index);
    lastAudible = index;
  }
  wav.writeInt16LE(
    Math.round(sample < 0 ? sample * 32768 : sample * 32767),
    44 + index * 2,
  );
}
fs.writeFileSync(outputPath, wav);

console.log(
  JSON.stringify(
    {
      outputPath,
      sampleRate,
      sourceChannels: decoded.numberOfChannels,
      sampleCount: samples.length,
      durationSeconds: samples.length / sampleRate,
      peak,
      firstAudibleSeconds: firstAudible / sampleRate,
      lastAudibleSeconds: lastAudible / sampleRate,
      byteLength,
    },
    null,
    2,
  ),
);
