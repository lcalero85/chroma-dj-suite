// Built-in backing instrumentals for the Live Vocal panel.
// Each instrumental is a procedurally-rendered offline AudioBuffer (mono → played
// stereo) that loops seamlessly. The user can play / stop them from the panel.
import { getEngine, ensureRunning } from "./engine";

export interface Instrumental {
  id: string;
  labelKey: "instReggae" | "instLoFi" | "instTrap" | "instAcoustic" | "instHouse";
  bpm: number;
  bars: number;
  /** beats=4 fixed; events: { freq, beat, dur, gain, type } */
  build: (ctx: OfflineAudioContext, bpm: number, bars: number) => void;
}

const beatSec = (bpm: number) => 60 / bpm;

function addOsc(
  ctx: OfflineAudioContext,
  dest: AudioNode,
  type: OscillatorType,
  freq: number,
  start: number,
  dur: number,
  gain = 0.4,
  attack = 0.005,
) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g).connect(dest);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function addNoiseHit(ctx: OfflineAudioContext, dest: AudioNode, start: number, dur: number, hp: number, gain = 0.3) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * (dur + 0.02)));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = "highpass"; filt.frequency.value = hp;
  const g = ctx.createGain(); g.gain.value = gain;
  src.connect(filt).connect(g).connect(dest);
  src.start(start);
}

function addKick(ctx: OfflineAudioContext, dest: AudioNode, start: number, gain = 0.7) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150, start);
  osc.frequency.exponentialRampToValueAtTime(45, start + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
  osc.connect(g).connect(dest);
  osc.start(start);
  osc.stop(start + 0.5);
}

function addSnare(ctx: OfflineAudioContext, dest: AudioNode, start: number, gain = 0.5) {
  addNoiseHit(ctx, dest, start, 0.18, 1500, gain);
  addOsc(ctx, dest, "triangle", 220, start, 0.12, gain * 0.5);
}

function addHat(ctx: OfflineAudioContext, dest: AudioNode, start: number, open = false, gain = 0.18) {
  addNoiseHit(ctx, dest, start, open ? 0.25 : 0.06, 8000, gain);
}

export const INSTRUMENTALS: Instrumental[] = [
  {
    id: "reggae", labelKey: "instReggae", bpm: 78, bars: 4,
    build: (ctx, bpm, bars) => {
      const b = beatSec(bpm);
      const dest = ctx.destination;
      for (let bar = 0; bar < bars; bar++) {
        const o = bar * 4 * b;
        // One-drop: kick on beat 3, snare on beat 3, hats on offbeats
        addKick(ctx, dest, o + 2 * b);
        addSnare(ctx, dest, o + 2 * b);
        for (let beat = 0; beat < 4; beat++) {
          addHat(ctx, dest, o + (beat + 0.5) * b);
        }
        // Bass: A2 root, then E2 turnaround
        const bassRoot = bar % 2 === 0 ? 110 : 82.4;
        for (const beat of [0, 1, 2, 3]) {
          addOsc(ctx, dest, "sine", bassRoot, o + beat * b, b * 0.95, 0.45, 0.005);
        }
        // Skank chord on offbeats (Am: A C E)
        for (const beat of [0.5, 1.5, 2.5, 3.5]) {
          for (const f of [220, 261.6, 329.6]) {
            addOsc(ctx, dest, "square", f, o + beat * b, 0.18, 0.06, 0.003);
          }
        }
      }
    },
  },
  {
    id: "lofi", labelKey: "instLoFi", bpm: 80, bars: 4,
    build: (ctx, bpm, bars) => {
      const b = beatSec(bpm);
      const dest = ctx.destination;
      // Cmaj7 → Am7 → Fmaj7 → G7 chord pad
      const chords: number[][] = [
        [261.6, 329.6, 392, 493.9],
        [220, 261.6, 329.6, 392],
        [174.6, 220, 261.6, 329.6],
        [196, 246.9, 293.7, 349.2],
      ];
      for (let bar = 0; bar < bars; bar++) {
        const o = bar * 4 * b;
        const ch = chords[bar % 4];
        for (const f of ch) addOsc(ctx, dest, "triangle", f, o, b * 4 * 0.95, 0.07, 0.05);
        // Soft kick on 1 and 3
        addKick(ctx, dest, o, 0.45);
        addKick(ctx, dest, o + 2 * b, 0.45);
        // Lazy snare on 2 and 4
        addSnare(ctx, dest, o + 1 * b, 0.32);
        addSnare(ctx, dest, o + 3 * b, 0.32);
        // Off-grid hats
        for (let beat = 0; beat < 4; beat++) addHat(ctx, dest, o + (beat + 0.5) * b, false, 0.12);
      }
    },
  },
  {
    id: "trap", labelKey: "instTrap", bpm: 140, bars: 2,
    build: (ctx, bpm, bars) => {
      const b = beatSec(bpm);
      const dest = ctx.destination;
      for (let bar = 0; bar < bars; bar++) {
        const o = bar * 4 * b;
        // 808 sub bass following a pattern
        const pattern = [{ f: 41.2, beat: 0, dur: 1.4 }, { f: 41.2, beat: 1.5, dur: 0.4 }, { f: 49, beat: 3, dur: 0.9 }];
        for (const p of pattern) addOsc(ctx, dest, "sine", p.f, o + p.beat * b, p.dur * b, 0.65, 0.005);
        // Trap kick
        addKick(ctx, dest, o, 0.7);
        addKick(ctx, dest, o + 2 * b, 0.7);
        // Clap on 2/4
        addSnare(ctx, dest, o + 1 * b, 0.45);
        addSnare(ctx, dest, o + 3 * b, 0.45);
        // Rolling hi-hats — 16ths with occasional 32nd rolls
        for (let i = 0; i < 16; i++) {
          const t = o + (i / 4) * b;
          addHat(ctx, dest, t, false, 0.1 + (i % 4 === 0 ? 0.05 : 0));
        }
        // 32nd roll on bar end
        for (let i = 0; i < 4; i++) addHat(ctx, dest, o + 3.5 * b + (i / 8) * b, false, 0.08);
      }
    },
  },
  {
    id: "acoustic", labelKey: "instAcoustic", bpm: 96, bars: 4,
    build: (ctx, bpm, bars) => {
      const b = beatSec(bpm);
      const dest = ctx.destination;
      // C-G-Am-F arpeggios
      const chords: number[][] = [
        [261.6, 329.6, 392],
        [196, 246.9, 293.7],
        [220, 261.6, 329.6],
        [174.6, 220, 261.6],
      ];
      for (let bar = 0; bar < bars; bar++) {
        const o = bar * 4 * b;
        const ch = chords[bar % 4];
        // Strummed: 8 16th-notes per bar
        for (let i = 0; i < 8; i++) {
          const t = o + (i / 2) * b;
          const f = ch[i % ch.length];
          addOsc(ctx, dest, "triangle", f, t, b * 0.6, 0.18, 0.003);
          addOsc(ctx, dest, "sine", f * 2, t, b * 0.4, 0.08, 0.003);
        }
        // Soft kick + brush on the 2 and 4
        addKick(ctx, dest, o, 0.4);
        addNoiseHit(ctx, dest, o + 1 * b, 0.18, 4000, 0.18);
        addNoiseHit(ctx, dest, o + 3 * b, 0.18, 4000, 0.18);
      }
    },
  },
  {
    id: "house", labelKey: "instHouse", bpm: 124, bars: 4,
    build: (ctx, bpm, bars) => {
      const b = beatSec(bpm);
      const dest = ctx.destination;
      for (let bar = 0; bar < bars; bar++) {
        const o = bar * 4 * b;
        // Four-on-the-floor kick
        for (let beat = 0; beat < 4; beat++) addKick(ctx, dest, o + beat * b, 0.65);
        // Open hat on offbeats
        for (let beat = 0; beat < 4; beat++) addHat(ctx, dest, o + (beat + 0.5) * b, true, 0.18);
        // Clap on 2 and 4
        addSnare(ctx, dest, o + 1 * b, 0.4);
        addSnare(ctx, dest, o + 3 * b, 0.4);
        // Bassline: root note of current chord
        const root = [65.4, 73.4, 82.4, 73.4][bar % 4];
        for (let beat = 0; beat < 4; beat++) {
          addOsc(ctx, dest, "sawtooth", root, o + (beat + 0.25) * b, b * 0.5, 0.22, 0.005);
        }
        // Stab chord on every offbeat
        const chord = [[261.6, 329.6, 392], [293.7, 349.2, 440], [329.6, 392, 493.9], [293.7, 349.2, 440]][bar % 4];
        for (const beat of [0.5, 1.5, 2.5, 3.5]) {
          for (const f of chord) addOsc(ctx, dest, "sawtooth", f, o + beat * b, 0.2, 0.07, 0.003);
        }
      }
    },
  },
];

const buffers = new Map<string, AudioBuffer>();
const sources = new Map<string, AudioBufferSourceNode>();
let _gain: GainNode | null = null;

async function ensureBuffer(id: string): Promise<AudioBuffer | null> {
  if (buffers.has(id)) return buffers.get(id) ?? null;
  const inst = INSTRUMENTALS.find((x) => x.id === id);
  if (!inst) return null;
  await ensureRunning();
  const { ctx } = getEngine();
  const sec = (inst.bars * 4 * 60) / inst.bpm;
  const Off =
    (window as unknown as { OfflineAudioContext: typeof OfflineAudioContext }).OfflineAudioContext;
  const oc = new Off(2, Math.ceil(ctx.sampleRate * sec), ctx.sampleRate);
  inst.build(oc, inst.bpm, inst.bars);
  const rendered = await oc.startRendering();
  buffers.set(id, rendered);
  return rendered;
}

export async function playInstrumental(id: string, volume = 0.8): Promise<boolean> {
  const buf = await ensureBuffer(id);
  if (!buf) return false;
  const { ctx, master } = getEngine();
  stopInstrumental(id);
  if (!_gain) {
    _gain = ctx.createGain();
    _gain.gain.value = volume;
    _gain.connect(master);
  } else {
    _gain.gain.setTargetAtTime(volume, ctx.currentTime, 0.02);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.connect(_gain);
  src.start();
  sources.set(id, src);
  return true;
}

export function stopInstrumental(id: string) {
  const s = sources.get(id);
  if (s) { try { s.stop(); s.disconnect(); } catch { /* noop */ } sources.delete(id); }
}

export function stopAllInstrumentals() {
  for (const id of Array.from(sources.keys())) stopInstrumental(id);
}

export function setInstrumentalVolume(v: number) {
  if (!_gain) return;
  const { ctx } = getEngine();
  _gain.gain.setTargetAtTime(Math.max(0, Math.min(1.5, v)), ctx.currentTime, 0.02);
}

export function isInstrumentalPlaying(id: string): boolean {
  return sources.has(id);
}
