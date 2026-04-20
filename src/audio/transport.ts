// Pro transport features: beat jump, brake (spin-down), reverse, sleep timer.
import type { DeckId } from "@/state/store";
import { useApp } from "@/state/store";
import { getDeck, currentTime, seek, pause, play, setPlaybackRate } from "./deck";
import { setMasterVolume } from "./engine";

/** Jump N beats forward/backward keeping play state. */
export function beatJump(id: DeckId, beats: number) {
  const ds = useApp.getState().decks[id];
  if (!ds.bpm) return;
  const d = getDeck(id);
  if (!d.buffer) return;
  const sec = (60 / ds.bpm) * beats;
  const target = Math.max(0, Math.min(d.buffer.duration - 0.05, currentTime(id) + sec));
  seek(id, target);
  useApp.getState().updateDeck(id, { position: target / d.buffer.duration });
}

/** Brake / spin-down: ramps playbackRate to 0 over `seconds`, then pauses. */
export function brake(id: DeckId, seconds = 1.2) {
  const d = getDeck(id);
  if (!d.isPlaying || !d.source) return;
  const startRate = d.playbackRate;
  const t0 = performance.now();
  const tick = () => {
    const t = (performance.now() - t0) / 1000;
    if (t >= seconds) {
      pause(id);
      // restore nominal rate so next play uses pitch-based rate
      setPlaybackRate(id, startRate);
      return;
    }
    const k = 1 - t / seconds;
    const r = Math.max(0.01, startRate * k * k);
    if (d.source) {
      try {
        const { ctx } = (d.source as AudioBufferSourceNode).context as unknown as { ctx: AudioContext };
        void ctx;
      } catch { /* noop */ }
      d.source.playbackRate.setTargetAtTime(r, d.source.context.currentTime, 0.02);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Toggle reverse playback by flipping playbackRate sign is not supported in
 *  Web Audio. We emulate by swapping the buffer with a reversed copy. */
const reversedCache = new WeakMap<AudioBuffer, AudioBuffer>();
export function setReverse(id: DeckId, on: boolean) {
  const d = getDeck(id);
  if (!d.buffer) return;
  const wasPlaying = d.isPlaying;
  const pos = currentTime(id);
  const dur = d.buffer.duration;
  const original = d.buffer;
  // We always store the canonical (forward) buffer in the reversed map's key;
  // toggling means swapping in/out the reversed twin.
  let target: AudioBuffer;
  if (on) {
    let rev = reversedCache.get(original);
    if (!rev) {
      rev = reverseBuffer(original);
      reversedCache.set(original, rev);
      reversedCache.set(rev, original);
    }
    target = rev;
  } else {
    target = reversedCache.get(original) ?? original;
    // when toggling off, ensure we land on the forward buffer
    if (target.duration === original.duration && reversedCache.get(original) && target !== original) {
      // we are currently on reversed; the "forward" twin is its mapped value
      target = reversedCache.get(original) === original ? original : (reversedCache.get(original) ?? original);
    }
  }
  if (wasPlaying) pause(id);
  d.buffer = target;
  const newPos = on ? Math.max(0, dur - pos) : Math.max(0, dur - pos);
  d.startOffset = newPos;
  if (wasPlaying) play(id, newPos);
  useApp.getState().updateDeck(id, { reverse: on });
}

function reverseBuffer(buf: AudioBuffer): AudioBuffer {
  const ctx = buf as unknown as { context?: BaseAudioContext };
  const audioCtx: BaseAudioContext = (ctx.context as BaseAudioContext) ?? new OfflineAudioContext(buf.numberOfChannels, buf.length, buf.sampleRate);
  const out = audioCtx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const src = buf.getChannelData(c);
    const dst = out.getChannelData(c);
    for (let i = 0, n = src.length; i < n; i++) dst[i] = src[n - 1 - i];
  }
  return out;
}

/** Sleep timer: gently fades master to 0 over the last 8s of the period, then mutes. */
let sleepTimer: ReturnType<typeof setTimeout> | null = null;
export function setSleepTimer(minutes: number) {
  if (sleepTimer) {
    clearTimeout(sleepTimer);
    sleepTimer = null;
  }
  useApp.getState().updateMixer({ sleepMinutes: minutes });
  if (minutes <= 0) return;
  const ms = minutes * 60_000;
  const startVol = useApp.getState().mixer.master;
  sleepTimer = setTimeout(() => {
    const fadeMs = 8000;
    const t0 = performance.now();
    const tick = () => {
      const e = performance.now() - t0;
      const k = Math.max(0, 1 - e / fadeMs);
      setMasterVolume(startVol * k);
      if (k > 0) requestAnimationFrame(tick);
      else useApp.getState().updateMixer({ sleepMinutes: 0 });
    };
    requestAnimationFrame(tick);
  }, Math.max(0, ms - 8000));
}

/** Auto-mix: gradually slide crossfader from current to target over `seconds`. */
let autoMixRaf: number | null = null;
export function autoMixTo(target: -1 | 1, seconds = 8) {
  if (autoMixRaf) cancelAnimationFrame(autoMixRaf);
  const start = useApp.getState().mixer.xfader;
  const t0 = performance.now();
  const step = () => {
    const t = (performance.now() - t0) / (seconds * 1000);
    const k = Math.min(1, t);
    const v = start + (target - start) * k;
    // call through controller to keep curve applied
    import("@/state/controller").then(({ setXfaderPosition }) => setXfaderPosition(v));
    if (k < 1) autoMixRaf = requestAnimationFrame(step);
    else autoMixRaf = null;
  };
  autoMixRaf = requestAnimationFrame(step);
}

/** Tap tempo: returns BPM after 4+ taps; resets after 2s of inactivity. */
const taps: number[] = [];
export function tap(): number | null {
  const now = performance.now();
  if (taps.length && now - taps[taps.length - 1] > 2000) taps.length = 0;
  taps.push(now);
  if (taps.length < 2) return null;
  const intervals: number[] = [];
  for (let i = 1; i < taps.length; i++) intervals.push(taps[i] - taps[i - 1]);
  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  return Math.max(40, Math.min(220, 60_000 / avg));
}

/** Quantize a position to the nearest beat using deck BPM. */
export function quantizeToBeat(id: DeckId, sec: number): number {
  const ds = useApp.getState().decks[id];
  if (!ds.bpm) return sec;
  const beat = 60 / ds.bpm;
  return Math.round(sec / beat) * beat;
}