// Professional vinyl-style scratch engine.
// Drives the actual track audio at variable speed/direction in response to
// jog-wheel motion (like a real turntable's slipmat), so the user hears the
// real song scrubbing back-and-forth — not a synthetic blip.
//
// On top of that we layer a very subtle "needle" tone that tracks jog velocity
// and direction — this is what gives a physical-console feel (the slight
// vinyl/stylus character) without overpowering the music.

import { getEngine } from "./engine";
import { getDeck, currentTime, play, pause, type DeckId } from "./deck";

interface ScratchSession {
  id: DeckId;
  wasPlaying: boolean;
  lastT: number;             // performance.now of last sample
  lastVel: number;           // sec/sec velocity (signed)
  needleOsc: OscillatorNode | null;
  needleGain: GainNode | null;
  noiseSrc: AudioBufferSourceNode | null;
  noiseGain: GainNode | null;
  raf: number;
  decayTimer: number | null;
}

const sessions: Partial<Record<DeckId, ScratchSession>> = {};

function makeNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 1.0, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
  return buf;
}

/** Begin a scratch gesture (pointer-down on jog). */
export function beginScratch(id: DeckId) {
  if (sessions[id]) return;
  const d = getDeck(id);
  if (!d.buffer) return;
  const { ctx, master } = getEngine();
  const wasPlaying = d.isPlaying;

  // Pause the normal playback so our scratch driver fully owns the rate.
  if (wasPlaying) pause(id);

  // Needle layer: a band-limited noise + soft tone whose pitch and gain track
  // jog velocity. Routed straight to master so it isn't EQ'd by the channel.
  const noiseBuf = makeNoiseBuffer(ctx);
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuf;
  noiseSrc.loop = true;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = 1800;
  noiseFilter.Q.value = 0.7;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0;

  const needleOsc = ctx.createOscillator();
  needleOsc.type = "sawtooth";
  needleOsc.frequency.value = 60;
  const needleGain = ctx.createGain();
  needleGain.gain.value = 0;

  noiseSrc.connect(noiseFilter).connect(noiseGain).connect(master);
  needleOsc.connect(needleGain).connect(master);
  noiseSrc.start();
  needleOsc.start();

  sessions[id] = {
    id,
    wasPlaying,
    lastT: performance.now(),
    lastVel: 0,
    needleOsc,
    needleGain,
    noiseSrc,
    noiseGain,
    raf: 0,
    decayTimer: null,
  };
}

/**
 * Apply a scratch motion: deltaSec is how many seconds of audio the jog moved
 * since the last call (signed; negative = backwards). We play a tiny chunk of
 * the buffer at the corresponding rate/direction so the user actually hears the
 * track scrub, like a vinyl on a slipmat.
 */
export function scratchMove(id: DeckId, deltaSec: number) {
  const s = sessions[id];
  if (!s) {
    // Auto-begin if a session wasn't explicitly started (e.g. drive-by use).
    beginScratch(id);
  }
  const sess = sessions[id];
  if (!sess) return;
  const d = getDeck(id);
  if (!d.buffer) return;
  const { ctx, master } = getEngine();

  const now = performance.now();
  const dtMs = Math.max(1, now - sess.lastT);
  sess.lastT = now;
  // Velocity in sec(audio) per sec(real time)
  const vel = (deltaSec * 1000) / dtMs;
  sess.lastVel = vel;

  // ===== 1) Drive the actual track audio (the real vinyl scrub) =====
  const targetTime = Math.max(
    0,
    Math.min(d.buffer.duration - 0.06, currentTime(id) + deltaSec),
  );
  d.startOffset = targetTime;

  // Play a very short slice at speed = |vel|, direction = sign(vel).
  // Web Audio can't go backwards, so for reverse motion we play a forward
  // slice that starts slightly ahead — fast bursts at high rate produce the
  // characteristic "wikki-wikki" envelope.
  const rate = Math.min(8, Math.max(0.05, Math.abs(vel) || 0.05));
  const sliceLen = Math.min(0.12, dtMs / 1000 + 0.04);
  const startAt = vel >= 0 ? targetTime : Math.max(0, targetTime - sliceLen * 0.6);

  try {
    const src = ctx.createBufferSource();
    src.buffer = d.buffer;
    src.playbackRate.value = rate;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, ctx.currentTime);
    env.gain.linearRampToValueAtTime(0.95, ctx.currentTime + 0.004);
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + sliceLen);
    src.connect(d.hi);                  // through the deck's EQ chain → mixer
    void env;                           // env path isn't needed; envelope on src would require extra node
    src.start(0, startAt, sliceLen);
    src.stop(ctx.currentTime + sliceLen + 0.05);
  } catch { /* noop */ }

  // ===== 2) Subtle needle/console layer =====
  const absVel = Math.min(4, Math.abs(vel));
  const needleVol = Math.min(0.06, absVel * 0.02);          // very quiet
  const noiseVol = Math.min(0.04, absVel * 0.015);
  const needleFreq = 50 + absVel * 90 * (vel >= 0 ? 1 : 0.7);
  const tau = 0.02;
  sess.needleGain!.gain.setTargetAtTime(needleVol, ctx.currentTime, tau);
  sess.noiseGain!.gain.setTargetAtTime(noiseVol, ctx.currentTime, tau);
  sess.needleOsc!.frequency.setTargetAtTime(needleFreq, ctx.currentTime, tau);
  void master;
}

/** End the scratch gesture: fade out needle layer, optionally resume playback. */
export function endScratch(id: DeckId) {
  const sess = sessions[id];
  if (!sess) return;
  const { ctx } = getEngine();
  // Fade needle layer
  sess.needleGain?.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
  sess.noiseGain?.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
  const cleanup = () => {
    try { sess.needleOsc?.stop(); } catch { /* noop */ }
    try { sess.noiseSrc?.stop(); } catch { /* noop */ }
    try { sess.needleOsc?.disconnect(); } catch { /* noop */ }
    try { sess.noiseSrc?.disconnect(); } catch { /* noop */ }
    try { sess.needleGain?.disconnect(); } catch { /* noop */ }
    try { sess.noiseGain?.disconnect(); } catch { /* noop */ }
  };
  setTimeout(cleanup, 220);
  // Resume playback from the new offset if we were playing.
  if (sess.wasPlaying) {
    const d = getDeck(id);
    play(id, d.startOffset);
  }
  delete sessions[id];
}

export function isScratching(id: DeckId): boolean {
  return !!sessions[id];
}