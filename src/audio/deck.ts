// Per-deck audio graph. Each deck owns its own EQ, filter, channel gain, VU.
// Connects to either master bus (when channel fader > 0) or cue bus.

import { getEngine } from "./engine";

export interface DeckHandles {
  source: AudioBufferSourceNode | null;
  buffer: AudioBuffer | null;
  startedAt: number; // ctx time when started
  startOffset: number; // offset into buffer when last started
  isPlaying: boolean;
  playbackRate: number;
  hi: BiquadFilterNode;
  mid: BiquadFilterNode;
  lo: BiquadFilterNode;
  filter: BiquadFilterNode;
  channelGain: GainNode; // pre-fader trim (gain knob)
  fader: GainNode;       // channel fader
  xfaderGain: GainNode;  // crossfader contribution
  cueGain: GainNode;     // PFL send to cue bus
  analyser: AnalyserNode;
  // Vocal-cut bus: parallel dry/wet center-channel cancellation
  vocalDry: GainNode;
  vocalWet: GainNode;
  vocalSum: GainNode;
}

export type DeckId = "A" | "B" | "C" | "D";

const decks: Partial<Record<DeckId, DeckHandles>> = {};

export function getDeck(id: DeckId): DeckHandles {
  let d = decks[id];
  if (d) return d;
  const { ctx, master, cueBus } = getEngine();

  const hi = ctx.createBiquadFilter();
  hi.type = "highshelf";
  hi.frequency.value = 3200;
  hi.gain.value = 0;

  const mid = ctx.createBiquadFilter();
  mid.type = "peaking";
  mid.frequency.value = 1000;
  mid.Q.value = 0.8;
  mid.gain.value = 0;

  const lo = ctx.createBiquadFilter();
  lo.type = "lowshelf";
  lo.frequency.value = 220;
  lo.gain.value = 0;

  const filter = ctx.createBiquadFilter();
  filter.type = "allpass"; // bypass
  filter.frequency.value = 1000;

  const channelGain = ctx.createGain();
  channelGain.gain.value = 1;

  const fader = ctx.createGain();
  fader.gain.value = 0.85;

  const xfaderGain = ctx.createGain();
  xfaderGain.gain.value = 1;

  const cueGain = ctx.createGain();
  cueGain.gain.value = 0;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;

  // ===== Vocal-cut bus =====
  // Center-channel cancellation: split L/R, invert one channel, sum to mono.
  // Anything panned to the center (most lead vocals) cancels out.
  // Dry/Wet ramp lets us blend smoothly between original and instrumental.
  const splitter = ctx.createChannelSplitter(2);
  const merger = ctx.createChannelMerger(2);
  const invert = ctx.createGain();
  invert.gain.value = -1;
  // L straight, R inverted → both channels carry (L - R), summed = side signal (instrumental-ish)
  splitter.connect(merger, 0, 0);
  splitter.connect(invert, 1);
  invert.connect(merger, 0, 1);

  const vocalDry = ctx.createGain();
  vocalDry.gain.value = 1;
  const vocalWet = ctx.createGain();
  vocalWet.gain.value = 0;
  const vocalSum = ctx.createGain();

  // Routing: hi→mid→lo→filter→[dry, splitter→merger→wet]→sum→channelGain→...
  hi.connect(mid);
  mid.connect(lo);
  lo.connect(filter);
  filter.connect(vocalDry);
  filter.connect(splitter);
  merger.connect(vocalWet);
  vocalDry.connect(vocalSum);
  vocalWet.connect(vocalSum);
  vocalSum.connect(channelGain);
  channelGain.connect(fader);
  fader.connect(xfaderGain);
  xfaderGain.connect(master);
  channelGain.connect(cueGain);
  cueGain.connect(cueBus);
  channelGain.connect(analyser);

  d = {
    source: null,
    buffer: null,
    startedAt: 0,
    startOffset: 0,
    isPlaying: false,
    playbackRate: 1,
    hi,
    mid,
    lo,
    filter,
    channelGain,
    fader,
    xfaderGain,
    cueGain,
    analyser,
    vocalDry,
    vocalWet,
    vocalSum,
  };
  decks[id] = d;
  return d;
}

export function loadBuffer(id: DeckId, buffer: AudioBuffer) {
  const d = getDeck(id);
  if (d.source) {
    try { d.source.stop(); } catch { /* noop */ }
    try { d.source.disconnect(); } catch { /* noop */ }
  }
  d.buffer = buffer;
  d.source = null;
  d.isPlaying = false;
  d.startOffset = 0;
}

export function play(id: DeckId, offsetSec?: number) {
  const d = getDeck(id);
  if (!d.buffer) return;
  const { ctx } = getEngine();
  if (d.source) {
    try { d.source.stop(); } catch { /* noop */ }
    try { d.source.disconnect(); } catch { /* noop */ }
  }
  const src = ctx.createBufferSource();
  src.buffer = d.buffer;
  src.playbackRate.value = d.playbackRate;
  src.connect(d.hi);
  const off = offsetSec ?? d.startOffset;
  src.start(0, Math.max(0, Math.min(off, d.buffer.duration - 0.01)));
  d.source = src;
  d.startedAt = ctx.currentTime;
  d.startOffset = off;
  d.isPlaying = true;
  src.onended = () => {
    if (d.source === src) d.isPlaying = false;
  };
}

export function pause(id: DeckId) {
  const d = getDeck(id);
  if (!d.isPlaying || !d.source) return;
  const { ctx } = getEngine();
  d.startOffset = currentTime(id);
  try { d.source.stop(); } catch { /* noop */ }
  try { d.source.disconnect(); } catch { /* noop */ }
  d.source = null;
  d.isPlaying = false;
  void ctx;
}

export function seek(id: DeckId, sec: number) {
  const d = getDeck(id);
  const wasPlaying = d.isPlaying;
  if (wasPlaying) {
    pause(id);
    d.startOffset = sec;
    play(id, sec);
  } else {
    d.startOffset = sec;
  }
}

export function currentTime(id: DeckId): number {
  const d = getDeck(id);
  if (!d.buffer) return 0;
  if (!d.isPlaying) return d.startOffset;
  const { ctx } = getEngine();
  return d.startOffset + (ctx.currentTime - d.startedAt) * d.playbackRate;
}

export function setPlaybackRate(id: DeckId, rate: number) {
  const d = getDeck(id);
  d.startOffset = currentTime(id);
  d.playbackRate = rate;
  if (d.source && d.isPlaying) {
    const { ctx } = getEngine();
    d.startedAt = ctx.currentTime;
    d.source.playbackRate.setTargetAtTime(rate, ctx.currentTime, 0.01);
  }
}

export function setEQ(id: DeckId, band: "hi" | "mid" | "lo", value: number) {
  // value -1..1; mapped to -26dB..+8dB (kill on -1)
  const d = getDeck(id);
  const { ctx } = getEngine();
  const db = value < -0.95 ? -40 : value * (value < 0 ? 26 : 8);
  d[band].gain.setTargetAtTime(db, ctx.currentTime, 0.01);
}

export function setFilter(id: DeckId, value: number) {
  // -1..1; 0 = bypass, >0 highpass, <0 lowpass
  const d = getDeck(id);
  const { ctx } = getEngine();
  if (Math.abs(value) < 0.02) {
    d.filter.type = "allpass";
    d.filter.frequency.setTargetAtTime(1000, ctx.currentTime, 0.01);
    return;
  }
  if (value > 0) {
    d.filter.type = "highpass";
    const f = 80 + value * value * 8000;
    d.filter.frequency.setTargetAtTime(f, ctx.currentTime, 0.01);
    d.filter.Q.value = 1 + value * 4;
  } else {
    d.filter.type = "lowpass";
    const f = 22000 - value * value * 21500;
    d.filter.frequency.setTargetAtTime(f, ctx.currentTime, 0.01);
    d.filter.Q.value = 1 + Math.abs(value) * 4;
  }
}

export function setGain(id: DeckId, v: number) {
  const d = getDeck(id);
  const { ctx } = getEngine();
  d.channelGain.gain.setTargetAtTime(Math.max(0, Math.min(2, v)), ctx.currentTime, 0.01);
}

export function setFader(id: DeckId, v: number) {
  const d = getDeck(id);
  const { ctx } = getEngine();
  d.fader.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime, 0.01);
}

export function setCue(id: DeckId, on: boolean) {
  const d = getDeck(id);
  const { ctx } = getEngine();
  d.cueGain.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.01);
}

export function setXfaderGain(id: DeckId, v: number) {
  const d = getDeck(id);
  const { ctx } = getEngine();
  d.xfaderGain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime, 0.01);
}

/** Vocal removal amount, 0 = original, 1 = full karaoke. Smooth ~150ms ramp. */
export function setVocalCut(id: DeckId, amount: number) {
  const d = getDeck(id);
  const { ctx } = getEngine();
  const a = Math.max(0, Math.min(1, amount));
  // Equal-power-ish crossfade with bass compensation: keep dry partially even at full kill
  const wet = a;
  const dry = 1 - a * 0.85;
  const tau = 0.15;
  d.vocalWet.gain.setTargetAtTime(wet, ctx.currentTime, tau);
  d.vocalDry.gain.setTargetAtTime(dry, ctx.currentTime, tau);
}

export function nudge(id: DeckId, deltaSec: number) {
  const d = getDeck(id);
  if (!d.buffer) return;
  d.startOffset = Math.max(0, Math.min(d.buffer.duration - 0.05, currentTime(id) + deltaSec));
  if (d.isPlaying) {
    play(id, d.startOffset);
  }
}

export function getDecksMap() {
  return decks;
}