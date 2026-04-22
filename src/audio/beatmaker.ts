// Professional in-browser Beat Maker: synthesized drum kit + step sequencer
// with shuffle/swing, master gain, per-track mute/solo/volume/pan, and
// audio export (WAV) via OfflineAudioContext.
//
// The live engine writes to the master bus so the beat is included in the
// global recorder, the live stream, and the cue analyser — exactly like the
// rest of the app's audio sources.

import { getEngine, ensureRunning } from "./engine";

export type BeatTrackId =
  | "kick" | "snare" | "clap" | "chh" | "ohh" | "tomL" | "tomH" | "crash" | "rim" | "perc";

export interface BeatTrack {
  id: BeatTrackId;
  label: string;
  steps: boolean[];     // length = stepsPerBar
  volume: number;       // 0..1.5
  pan: number;          // -1..1
  mute: boolean;
  solo: boolean;
  accent: boolean[];    // per-step accent (louder)
}

export interface BeatPattern {
  bpm: number;
  steps: number;        // 8/16/32
  swing: number;        // 0..0.6 (proportion of step length to delay even-numbered 16ths)
  master: number;       // 0..1.5
  tracks: BeatTrack[];
}

const DEFAULT_LABELS: Record<BeatTrackId, string> = {
  kick: "Kick",
  snare: "Snare",
  clap: "Clap",
  chh: "Closed Hat",
  ohh: "Open Hat",
  tomL: "Tom Low",
  tomH: "Tom High",
  crash: "Crash",
  rim: "Rim",
  perc: "Perc",
};

export function makeEmptyTrack(id: BeatTrackId, steps = 16): BeatTrack {
  return {
    id,
    label: DEFAULT_LABELS[id],
    steps: new Array(steps).fill(false),
    accent: new Array(steps).fill(false),
    volume: 1,
    pan: 0,
    mute: false,
    solo: false,
  };
}

export function makeDefaultPattern(steps = 16): BeatPattern {
  const ids: BeatTrackId[] = ["kick", "snare", "clap", "chh", "ohh", "tomL", "tomH", "crash", "rim", "perc"];
  const tracks = ids.map((id) => makeEmptyTrack(id, steps));
  // Seed a friendly four-on-the-floor groove so users hear something immediately.
  const kick = tracks.find((t) => t.id === "kick")!;
  const snare = tracks.find((t) => t.id === "snare")!;
  const chh = tracks.find((t) => t.id === "chh")!;
  for (let i = 0; i < steps; i += 4) kick.steps[i] = true;
  for (let i = 4; i < steps; i += 8) snare.steps[i] = true;
  for (let i = 0; i < steps; i += 2) chh.steps[i] = true;
  return { bpm: 120, steps, swing: 0, master: 0.9, tracks };
}

// ---- Drum synth voices ----
// Each voice schedules nodes against a target AudioNode (master OR offline).
// The destination MUST be reachable to a valid AudioContext.destination.
function voiceKick(ctx: BaseAudioContext, dest: AudioNode, t: number, vol: number) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  o.connect(g).connect(dest);
  o.start(t); o.stop(t + 0.4);
}

function noiseBuffer(ctx: BaseAudioContext, sec = 0.4): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * sec));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function voiceSnare(ctx: BaseAudioContext, dest: AudioNode, t: number, vol: number) {
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx, 0.3);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass"; hp.frequency.value = 1200;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(vol * 0.9, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  noise.connect(hp).connect(ng).connect(dest);
  // tonal body
  const osc = ctx.createOscillator();
  const og = ctx.createGain();
  osc.type = "triangle"; osc.frequency.setValueAtTime(220, t);
  osc.frequency.exponentialRampToValueAtTime(140, t + 0.1);
  og.gain.setValueAtTime(vol * 0.6, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
  osc.connect(og).connect(dest);
  noise.start(t); noise.stop(t + 0.25);
  osc.start(t); osc.stop(t + 0.18);
}

function voiceClap(ctx: BaseAudioContext, dest: AudioNode, t: number, vol: number) {
  // 4 short bursts of bandpassed noise to mimic a hand clap.
  for (let i = 0; i < 4; i++) {
    const t0 = t + i * 0.012;
    const n = ctx.createBufferSource();
    n.buffer = noiseBuffer(ctx, 0.08);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 1500; bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * (i === 3 ? 0.9 : 0.55), t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (i === 3 ? 0.18 : 0.05));
    n.connect(bp).connect(g).connect(dest);
    n.start(t0); n.stop(t0 + 0.2);
  }
}

function voiceHat(ctx: BaseAudioContext, dest: AudioNode, t: number, vol: number, open: boolean) {
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx, open ? 0.4 : 0.1);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass"; hp.frequency.value = 6500;
  const g = ctx.createGain();
  const dur = open ? 0.32 : 0.06;
  g.gain.setValueAtTime(vol * 0.6, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(hp).connect(g).connect(dest);
  n.start(t); n.stop(t + dur + 0.05);
}

function voiceTom(ctx: BaseAudioContext, dest: AudioNode, t: number, vol: number, freq: number) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(freq * 1.6, t);
  o.frequency.exponentialRampToValueAtTime(freq, t + 0.2);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol * 0.9, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  o.connect(g).connect(dest);
  o.start(t); o.stop(t + 0.45);
}

function voiceCrash(ctx: BaseAudioContext, dest: AudioNode, t: number, vol: number) {
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx, 1.4);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass"; hp.frequency.value = 4000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol * 0.55, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
  n.connect(hp).connect(g).connect(dest);
  n.start(t); n.stop(t + 1.3);
}

function voiceRim(ctx: BaseAudioContext, dest: AudioNode, t: number, vol: number) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "square"; o.frequency.value = 1700;
  g.gain.setValueAtTime(vol * 0.4, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  o.connect(g).connect(dest);
  o.start(t); o.stop(t + 0.06);
}

function voicePerc(ctx: BaseAudioContext, dest: AudioNode, t: number, vol: number) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "triangle";
  o.frequency.setValueAtTime(900, t);
  o.frequency.exponentialRampToValueAtTime(500, t + 0.08);
  g.gain.setValueAtTime(vol * 0.6, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(g).connect(dest);
  o.start(t); o.stop(t + 0.14);
}

function triggerVoice(
  ctx: BaseAudioContext,
  dest: AudioNode,
  id: BeatTrackId,
  t: number,
  vol: number,
) {
  switch (id) {
    case "kick":  return voiceKick(ctx, dest, t, vol);
    case "snare": return voiceSnare(ctx, dest, t, vol);
    case "clap":  return voiceClap(ctx, dest, t, vol);
    case "chh":   return voiceHat(ctx, dest, t, vol, false);
    case "ohh":   return voiceHat(ctx, dest, t, vol, true);
    case "tomL":  return voiceTom(ctx, dest, t, vol, 110);
    case "tomH":  return voiceTom(ctx, dest, t, vol, 180);
    case "crash": return voiceCrash(ctx, dest, t, vol);
    case "rim":   return voiceRim(ctx, dest, t, vol);
    case "perc":  return voicePerc(ctx, dest, t, vol);
  }
}

// ---- Live scheduler ----
let _liveTimer: number | null = null;
let _liveStep = 0;
let _liveNextTime = 0;
let _livePattern: BeatPattern | null = null;
let _liveBus: GainNode | null = null;
let _onStep: ((step: number) => void) | null = null;
const LOOKAHEAD = 0.12; // sec
const TICK_MS = 25;

function stepDuration(p: BeatPattern): number {
  // Treat sequencer as 16th-note grid; if steps=8 → 8th-note grid; if 32 → 32nd-note grid.
  const denom = p.steps === 8 ? 8 : p.steps === 32 ? 32 : 16;
  return (60 / p.bpm) * (4 / denom);
}

function effectiveStepStart(p: BeatPattern, baseTime: number, step: number): number {
  // Apply swing: every odd 16th-note step is delayed by swing * stepDuration.
  const sd = stepDuration(p);
  let t = baseTime;
  if (p.swing > 0 && step % 2 === 1) t += sd * p.swing * 0.5;
  return t;
}

function anySolo(p: BeatPattern): boolean {
  return p.tracks.some((t) => t.solo);
}

function shouldPlay(p: BeatPattern, tr: BeatTrack): boolean {
  if (tr.mute) return false;
  const solo = anySolo(p);
  if (solo && !tr.solo) return false;
  return true;
}

function scheduleStep(ctx: AudioContext, dest: AudioNode, p: BeatPattern, step: number, baseTime: number) {
  const t = effectiveStepStart(p, baseTime, step);
  for (const tr of p.tracks) {
    if (!shouldPlay(p, tr)) continue;
    if (!tr.steps[step]) continue;
    const accent = tr.accent[step] ? 1.35 : 1;
    const v = Math.max(0, Math.min(1.5, tr.volume * p.master * accent));
    // Per-track pan via a transient StereoPannerNode. Keeps voice routing clean.
    let trackDest: AudioNode = dest;
    if (tr.pan !== 0 && (ctx as AudioContext).createStereoPanner) {
      const pan = (ctx as AudioContext).createStereoPanner();
      pan.pan.value = Math.max(-1, Math.min(1, tr.pan));
      pan.connect(dest);
      trackDest = pan;
    }
    triggerVoice(ctx, trackDest, tr.id, t, v);
  }
}

export function startLive(pattern: BeatPattern, onStep?: (step: number) => void) {
  void ensureRunning();
  const { ctx, master } = getEngine();
  if (!_liveBus) {
    _liveBus = ctx.createGain();
    _liveBus.gain.value = 1;
    _liveBus.connect(master);
  }
  _livePattern = pattern;
  _liveStep = 0;
  _liveNextTime = ctx.currentTime + 0.05;
  _onStep = onStep ?? null;
  if (_liveTimer != null) window.clearInterval(_liveTimer);
  _liveTimer = window.setInterval(() => {
    if (!_livePattern || !_liveBus) return;
    const horizon = ctx.currentTime + LOOKAHEAD;
    while (_liveNextTime < horizon) {
      scheduleStep(ctx, _liveBus, _livePattern, _liveStep, _liveNextTime);
      const s = _liveStep;
      const fireAt = (_liveNextTime - ctx.currentTime) * 1000;
      window.setTimeout(() => _onStep?.(s), Math.max(0, fireAt));
      _liveStep = (_liveStep + 1) % _livePattern.steps;
      _liveNextTime += stepDuration(_livePattern);
    }
  }, TICK_MS);
}

export function stopLive() {
  if (_liveTimer != null) window.clearInterval(_liveTimer);
  _liveTimer = null;
  _liveStep = 0;
  _onStep = null;
}

export function isLive(): boolean {
  return _liveTimer != null;
}

export function updateLivePattern(p: BeatPattern) {
  _livePattern = p;
}

/** Audition a single drum voice (used when clicking a step preview button). */
export function previewVoice(id: BeatTrackId, vol = 1) {
  void ensureRunning();
  const { ctx, master } = getEngine();
  triggerVoice(ctx, master, id, ctx.currentTime + 0.005, vol);
}

// ---- Offline render → WAV ----
/** Render the pattern looped `bars` times to an offline buffer for export. */
export async function renderPatternToBuffer(p: BeatPattern, bars = 1): Promise<AudioBuffer> {
  const sd = stepDuration(p);
  const totalSteps = p.steps * Math.max(1, bars);
  const totalSec = sd * totalSteps + 1.6; // tail for crash/reverb-free sustain
  const sampleRate = 48000;
  const Off = (window as unknown as { OfflineAudioContext: typeof OfflineAudioContext }).OfflineAudioContext;
  const oc = new Off(2, Math.ceil(totalSec * sampleRate), sampleRate);
  const out = oc.createGain();
  out.gain.value = 1;
  // Soft limiter to avoid clipping.
  const comp = oc.createDynamicsCompressor();
  comp.threshold.value = -6;
  comp.knee.value = 12;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.12;
  out.connect(comp).connect(oc.destination);
  let t = 0.05;
  for (let s = 0; s < totalSteps; s++) {
    scheduleStep(oc as unknown as AudioContext, out, p, s % p.steps, t);
    t += sd;
  }
  return await oc.startRendering();
}

/** Encode an AudioBuffer to a 16-bit PCM WAV blob. */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numCh * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataLen = buffer.length * blockAlign;
  const bufferLen = 44 + dataLen;
  const ab = new ArrayBuffer(bufferLen);
  const view = new DataView(ab);

  function writeStr(off: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  }
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataLen, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeStr(36, "data");
  view.setUint32(40, dataLen, true);

  // Interleave channels.
  const channels: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c));
  let off = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numCh; c++) {
      let s = Math.max(-1, Math.min(1, channels[c][i]));
      s = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(off, s, true);
      off += 2;
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 250);
}

/** Built-in factory patterns covering common genres. */
export const FACTORY_PATTERNS: { id: string; label: string; build: () => BeatPattern }[] = [
  {
    id: "house", label: "House 4/4",
    build: () => {
      const p = makeDefaultPattern(16);
      p.bpm = 124;
      const t = (id: BeatTrackId) => p.tracks.find((x) => x.id === id)!;
      t("kick").steps = [true,false,false,false,true,false,false,false,true,false,false,false,true,false,false,false];
      t("clap").steps = [false,false,false,false,true,false,false,false,false,false,false,false,true,false,false,false];
      t("chh").steps = [false,false,true,false,false,false,true,false,false,false,true,false,false,false,true,false];
      t("ohh").steps = [false,false,false,false,false,false,false,true,false,false,false,false,false,false,false,true];
      return p;
    },
  },
  {
    id: "hiphop", label: "Hip-Hop Boom-Bap",
    build: () => {
      const p = makeDefaultPattern(16);
      p.bpm = 92; p.swing = 0.25;
      const t = (id: BeatTrackId) => p.tracks.find((x) => x.id === id)!;
      t("kick").steps = [true,false,false,false,false,false,true,false,false,false,true,false,false,false,false,false];
      t("snare").steps = [false,false,false,false,true,false,false,false,false,false,false,false,true,false,false,false];
      t("chh").steps = new Array(16).fill(true);
      return p;
    },
  },
  {
    id: "trap", label: "Trap",
    build: () => {
      const p = makeDefaultPattern(16);
      p.bpm = 140;
      const t = (id: BeatTrackId) => p.tracks.find((x) => x.id === id)!;
      t("kick").steps = [true,false,false,false,false,false,true,false,false,false,false,true,false,false,false,false];
      t("clap").steps = [false,false,false,false,true,false,false,false,false,false,false,false,true,false,false,false];
      t("chh").steps = [true,true,false,true,true,true,true,true,true,true,true,false,true,true,true,true];
      t("ohh").steps = [false,false,false,false,false,false,false,true,false,false,false,false,false,false,false,false];
      return p;
    },
  },
  {
    id: "reggae", label: "Reggae One Drop",
    build: () => {
      const p = makeDefaultPattern(16);
      p.bpm = 78;
      const t = (id: BeatTrackId) => p.tracks.find((x) => x.id === id)!;
      t("kick").steps = [false,false,false,false,false,false,false,false,true,false,false,false,false,false,false,false];
      t("snare").steps = [false,false,false,false,false,false,false,false,true,false,false,false,false,false,false,false];
      t("chh").steps = [false,false,true,false,false,false,true,false,false,false,true,false,false,false,true,false];
      t("rim").steps = [false,false,false,true,false,false,false,false,false,false,false,true,false,false,false,false];
      return p;
    },
  },
  {
    id: "techno", label: "Techno",
    build: () => {
      const p = makeDefaultPattern(16);
      p.bpm = 132;
      const t = (id: BeatTrackId) => p.tracks.find((x) => x.id === id)!;
      t("kick").steps = [true,false,false,false,true,false,false,false,true,false,false,false,true,false,false,false];
      t("chh").steps = [false,true,false,true,false,true,false,true,false,true,false,true,false,true,false,true];
      t("perc").steps = [false,false,false,true,false,false,false,false,false,false,true,false,false,false,false,true];
      return p;
    },
  },
];