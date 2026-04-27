/**
 * Harmonic Mixing AI — real Camelot key detection from an AudioBuffer using
 * a chroma vector + Krumhansl–Schmuckler key profiles.
 *
 * Returns a CamelotKey (1A..12B). Falls back to a deterministic pseudo key
 * when the audio is silent or too short.
 *
 * Algorithm:
 *  1. Downsample to ~8 kHz mono via OfflineAudioContext.
 *  2. Compute a 12-bin chroma vector with a sliding FFT (mag spectrum
 *     mapped to pitch classes via log2 binning).
 *  3. Correlate chroma against the 24 Krumhansl key templates (12 major +
 *     12 minor) and pick the highest correlation.
 *  4. Map (pitchClass, mode) → Camelot.
 */
import type { CamelotKey } from "@/lib/camelot";
import { pseudoDetectKey } from "@/lib/camelot";

/** Krumhansl–Schmuckler tonal hierarchy profiles (C major / C minor). */
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/** Map (pitchClass, mode) → Camelot. pitchClass 0=C, 1=C#, …, 11=B. */
const CAMELOT_MAJOR: Record<number, CamelotKey> = {
  0: "8B", 1: "3B", 2: "10B", 3: "5B", 4: "12B", 5: "7B",
  6: "2B", 7: "9B", 8: "4B", 9: "11B", 10: "6B", 11: "1B",
};
const CAMELOT_MINOR: Record<number, CamelotKey> = {
  0: "5A", 1: "12A", 2: "7A", 3: "2A", 4: "9A", 5: "4A",
  6: "11A", 7: "6A", 8: "1A", 9: "8A", 10: "3A", 11: "10A",
};

function rotate(arr: number[], n: number): number[] {
  const out = new Array(arr.length);
  for (let i = 0; i < arr.length; i++) out[i] = arr[(i + n) % arr.length];
  return out;
}

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  let sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { sa += a[i]; sb += b[i]; }
  const ma = sa / n, mb = sb / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const xa = a[i] - ma, xb = b[i] - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  const denom = Math.sqrt(da * db);
  return denom > 1e-9 ? num / denom : 0;
}

function fftPow2(N: number): number {
  let p = 1;
  while (p < N) p <<= 1;
  return p;
}

/** Naive but adequate radix-2 FFT (Cooley–Tukey). N must be a power of 2. */
function fftReal(input: Float32Array): { re: Float32Array; im: Float32Array } {
  const N = input.length;
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  // bit reversal
  let j = 0;
  for (let i = 0; i < N; i++) {
    re[j] = input[i];
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
  }
  for (let len = 2; len <= N; len <<= 1) {
    const half = len >> 1;
    const ang = -2 * Math.PI / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < N; i += len) {
      let cRe = 1, cIm = 0;
      for (let k = 0; k < half; k++) {
        const tRe = cRe * re[i + k + half] - cIm * im[i + k + half];
        const tIm = cRe * im[i + k + half] + cIm * re[i + k + half];
        re[i + k + half] = re[i + k] - tRe;
        im[i + k + half] = im[i + k] - tIm;
        re[i + k] += tRe;
        im[i + k] += tIm;
        const nRe = cRe * wRe - cIm * wIm;
        cIm = cRe * wIm + cIm * wRe;
        cRe = nRe;
      }
    }
  }
  return { re, im };
}

/** Build a 12-bin chroma vector from mono samples at `sr`. */
function chroma(samples: Float32Array, sr: number): number[] {
  const N = fftPow2(Math.min(8192, samples.length));
  const win = new Float32Array(N);
  // Hann window over the first N samples (or all of them if shorter).
  for (let i = 0; i < N; i++) {
    const v = i < samples.length ? samples[i] : 0;
    win[i] = v * 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
  }
  const { re, im } = fftReal(win);
  const chr = new Array(12).fill(0);
  // Use bins between ~80 Hz (lowest fundamental we care about) and ~4 kHz.
  const binHz = sr / N;
  const minBin = Math.max(1, Math.floor(80 / binHz));
  const maxBin = Math.min(N >> 1, Math.floor(4000 / binHz));
  for (let k = minBin; k < maxBin; k++) {
    const f = k * binHz;
    if (f <= 0) continue;
    const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
    // Pitch class: 12 * log2(f / 261.6256) mod 12, with 0 = C.
    const pc = ((Math.round(12 * Math.log2(f / 261.6256)) % 12) + 12) % 12;
    chr[pc] += mag;
  }
  // Normalize.
  const sum = chr.reduce((a, b) => a + b, 0);
  if (sum > 1e-9) for (let i = 0; i < 12; i++) chr[i] /= sum;
  return chr;
}

/** Detect Camelot key from an AudioBuffer (offline rendered to 8 kHz). */
export async function detectCamelotKey(buffer: AudioBuffer, fallbackSeed?: string): Promise<CamelotKey> {
  try {
    const sr = 8000;
    // Use up to 60s starting at 30s in (skip intros, often vocal-only).
    const startSec = buffer.duration > 90 ? 30 : 0;
    const dur = Math.min(60, Math.max(8, buffer.duration - startSec));
    if (dur < 4) return pseudoDetectKey(fallbackSeed ?? "key");
    const length = Math.floor(sr * dur);
    const offline = new OfflineAudioContext(1, length, sr);
    const src = offline.createBufferSource();
    src.buffer = buffer;
    // Bandpass the harmonic content (cuts hihats and sub bass).
    const hp = offline.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 80;
    const lp = offline.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 4000;
    src.connect(hp); hp.connect(lp); lp.connect(offline.destination);
    src.start(0, startSec);
    const rendered = await offline.startRendering();
    const data = rendered.getChannelData(0);
    // Average chroma over multiple windows for robustness.
    const winSize = 8192;
    const hop = winSize;
    const acc = new Array(12).fill(0);
    let nWin = 0;
    for (let off = 0; off + winSize <= data.length; off += hop) {
      const slice = data.subarray(off, off + winSize);
      const c = chroma(slice as Float32Array, sr);
      for (let i = 0; i < 12; i++) acc[i] += c[i];
      nWin++;
    }
    if (nWin === 0) return pseudoDetectKey(fallbackSeed ?? "key");
    for (let i = 0; i < 12; i++) acc[i] /= nWin;
    // Correlate against all 24 keys.
    let bestPc = 0, bestMode: "maj" | "min" = "maj", bestScore = -Infinity;
    for (let pc = 0; pc < 12; pc++) {
      const tplMaj = rotate(MAJOR_PROFILE, (12 - pc) % 12);
      const tplMin = rotate(MINOR_PROFILE, (12 - pc) % 12);
      const sMaj = pearson(acc, tplMaj);
      const sMin = pearson(acc, tplMin);
      if (sMaj > bestScore) { bestScore = sMaj; bestPc = pc; bestMode = "maj"; }
      if (sMin > bestScore) { bestScore = sMin; bestPc = pc; bestMode = "min"; }
    }
    return bestMode === "maj" ? CAMELOT_MAJOR[bestPc] : CAMELOT_MINOR[bestPc];
  } catch {
    return pseudoDetectKey(fallbackSeed ?? "key");
  }
}
