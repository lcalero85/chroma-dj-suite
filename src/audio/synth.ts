// Polyphonic multi-preset synthesizer with live FX (reverb, delay, filter, chorus).
// Routed directly to the master bus. Lightweight: oscillator-based, no samples.
import { getEngine, ensureRunning } from "./engine";

export type SynthPresetId =
  | "piano" | "lead" | "bass" | "pad" | "pluck" | "brass" | "organ" | "bell";

export interface SynthPreset {
  id: SynthPresetId;
  label: string;
  oscs: { type: OscillatorType; detune: number; gain: number }[];
  env: { attack: number; decay: number; sustain: number; release: number };
  filter: { freq: number; q: number; envAmount: number };
  gain: number;
}

export const SYNTH_PRESETS: SynthPreset[] = [
  { id: "piano",  label: "Piano",
    oscs: [{ type: "triangle", detune: 0, gain: 0.7 }, { type: "sine", detune: -7, gain: 0.4 }],
    env: { attack: 0.005, decay: 0.6, sustain: 0.25, release: 0.5 },
    filter: { freq: 5000, q: 0.7, envAmount: 1500 }, gain: 0.6 },
  { id: "lead",   label: "Lead",
    oscs: [{ type: "sawtooth", detune: 0, gain: 0.6 }, { type: "square", detune: 7, gain: 0.3 }],
    env: { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.25 },
    filter: { freq: 3500, q: 4, envAmount: 2500 }, gain: 0.5 },
  { id: "bass",   label: "Bass",
    oscs: [{ type: "sawtooth", detune: 0, gain: 0.6 }, { type: "square", detune: -12, gain: 0.5 }],
    env: { attack: 0.005, decay: 0.3, sustain: 0.6, release: 0.2 },
    filter: { freq: 900, q: 6, envAmount: 1500 }, gain: 0.7 },
  { id: "pad",    label: "Pad",
    oscs: [{ type: "sawtooth", detune: -7, gain: 0.5 }, { type: "sawtooth", detune: 7, gain: 0.5 }, { type: "triangle", detune: 0, gain: 0.4 }],
    env: { attack: 0.6, decay: 0.5, sustain: 0.85, release: 1.4 },
    filter: { freq: 2200, q: 1, envAmount: 800 }, gain: 0.45 },
  { id: "pluck",  label: "Pluck",
    oscs: [{ type: "triangle", detune: 0, gain: 0.7 }, { type: "sine", detune: 12, gain: 0.3 }],
    env: { attack: 0.002, decay: 0.25, sustain: 0, release: 0.2 },
    filter: { freq: 4000, q: 2, envAmount: 3000 }, gain: 0.6 },
  { id: "brass",  label: "Brass",
    oscs: [{ type: "sawtooth", detune: -3, gain: 0.55 }, { type: "sawtooth", detune: 3, gain: 0.55 }],
    env: { attack: 0.05, decay: 0.25, sustain: 0.75, release: 0.35 },
    filter: { freq: 2800, q: 1.2, envAmount: 1800 }, gain: 0.5 },
  { id: "organ",  label: "Organ",
    oscs: [{ type: "sine", detune: 0, gain: 0.5 }, { type: "sine", detune: 1200, gain: 0.35 }, { type: "sine", detune: 1900, gain: 0.25 }],
    env: { attack: 0.005, decay: 0.0, sustain: 1.0, release: 0.15 },
    filter: { freq: 6000, q: 0.7, envAmount: 0 }, gain: 0.5 },
  { id: "bell",   label: "Bell",
    oscs: [{ type: "sine", detune: 0, gain: 0.6 }, { type: "sine", detune: 1900, gain: 0.4 }, { type: "triangle", detune: 2800, gain: 0.2 }],
    env: { attack: 0.002, decay: 1.5, sustain: 0.0, release: 1.0 },
    filter: { freq: 8000, q: 0.7, envAmount: 0 }, gain: 0.45 },
];

export interface SynthFx {
  reverb: number;
  delay: number;
  filter: number;
  chorus: number;
}

interface Voice {
  oscs: OscillatorNode[];
  envGain: GainNode;
  filter: BiquadFilterNode;
  noteOff: (when?: number) => void;
}

let _initialized = false;
let _input: GainNode | null = null;
let _outGain: GainNode | null = null;
let _master: GainNode | null = null;
let _globalFilter: BiquadFilterNode | null = null;
let _chorusDelay: DelayNode | null = null;
let _chorusLfo: OscillatorNode | null = null;
let _chorusLfoGain: GainNode | null = null;
let _chorusWet: GainNode | null = null;
let _chorusDry: GainNode | null = null;
let _delayNode: DelayNode | null = null;
let _delayFb: GainNode | null = null;
let _delayWet: GainNode | null = null;
let _delayDry: GainNode | null = null;
let _reverb: ConvolverNode | null = null;
let _reverbWet: GainNode | null = null;
let _reverbDry: GainNode | null = null;

let _currentPreset: SynthPreset = SYNTH_PRESETS[0];
const activeVoices = new Map<number, Voice>();

function makeImpulse(ctx: AudioContext, seconds = 2.2, decay = 2.5): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

function ensureSynth() {
  if (_initialized) return;
  const { ctx, master } = getEngine();
  _input = ctx.createGain();
  _input.gain.value = 1;
  _outGain = ctx.createGain();
  _outGain.gain.value = 0.8;
  _master = master;

  _globalFilter = ctx.createBiquadFilter();
  _globalFilter.type = "lowpass";
  _globalFilter.frequency.value = 18000;
  _globalFilter.Q.value = 0.7;

  _chorusDelay = ctx.createDelay(0.05);
  _chorusDelay.delayTime.value = 0.018;
  _chorusLfo = ctx.createOscillator();
  _chorusLfo.frequency.value = 0.8;
  _chorusLfoGain = ctx.createGain();
  _chorusLfoGain.gain.value = 0.005;
  _chorusLfo.connect(_chorusLfoGain);
  _chorusLfoGain.connect(_chorusDelay.delayTime);
  _chorusLfo.start();
  _chorusDry = ctx.createGain(); _chorusDry.gain.value = 1;
  _chorusWet = ctx.createGain(); _chorusWet.gain.value = 0;

  _delayNode = ctx.createDelay(2);
  _delayNode.delayTime.value = 0.32;
  _delayFb = ctx.createGain(); _delayFb.gain.value = 0.35;
  _delayDry = ctx.createGain(); _delayDry.gain.value = 1;
  _delayWet = ctx.createGain(); _delayWet.gain.value = 0;

  _reverb = ctx.createConvolver();
  _reverb.buffer = makeImpulse(ctx);
  _reverbDry = ctx.createGain(); _reverbDry.gain.value = 1;
  _reverbWet = ctx.createGain(); _reverbWet.gain.value = 0;

  const sumA = ctx.createGain();
  const sumB = ctx.createGain();
  const sumC = ctx.createGain();

  _input.connect(_globalFilter);
  _globalFilter.connect(_chorusDry);
  _globalFilter.connect(_chorusDelay);
  _chorusDelay.connect(_chorusWet);
  _chorusDry.connect(sumA);
  _chorusWet.connect(sumA);

  sumA.connect(_delayDry);
  sumA.connect(_delayNode);
  _delayNode.connect(_delayWet);
  _delayNode.connect(_delayFb);
  _delayFb.connect(_delayNode);
  _delayDry.connect(sumB);
  _delayWet.connect(sumB);

  sumB.connect(_reverbDry);
  sumB.connect(_reverb);
  _reverb.connect(_reverbWet);
  _reverbDry.connect(sumC);
  _reverbWet.connect(sumC);

  sumC.connect(_outGain);
  _outGain.connect(_master);

  _initialized = true;
}

export function setSynthPreset(id: SynthPresetId) {
  ensureSynth();
  const p = SYNTH_PRESETS.find((x) => x.id === id);
  if (p) _currentPreset = p;
}

export function getCurrentSynthPreset(): SynthPresetId {
  return _currentPreset.id;
}

export function setSynthFx(fx: Partial<SynthFx>) {
  ensureSynth();
  if (!_chorusWet || !_chorusDry || !_delayWet || !_delayDry || !_reverbWet || !_reverbDry || !_globalFilter) return;
  const { ctx } = getEngine();
  const t = ctx.currentTime;
  const tau = 0.04;
  if (typeof fx.chorus === "number") {
    const w = Math.max(0, Math.min(1, fx.chorus));
    _chorusWet.gain.setTargetAtTime(w, t, tau);
    _chorusDry.gain.setTargetAtTime(1 - w * 0.4, t, tau);
  }
  if (typeof fx.delay === "number") {
    const w = Math.max(0, Math.min(1, fx.delay));
    _delayWet.gain.setTargetAtTime(w, t, tau);
    _delayDry.gain.setTargetAtTime(1, t, tau);
  }
  if (typeof fx.reverb === "number") {
    const w = Math.max(0, Math.min(1, fx.reverb));
    _reverbWet.gain.setTargetAtTime(w, t, tau);
    _reverbDry.gain.setTargetAtTime(1, t, tau);
  }
  if (typeof fx.filter === "number") {
    const k = Math.max(0, Math.min(1, fx.filter));
    const freq = 18000 * Math.pow(120 / 18000, k);
    _globalFilter.frequency.setTargetAtTime(freq, t, tau);
  }
}

export function setSynthVolume(v: number) {
  ensureSynth();
  if (!_outGain) return;
  const { ctx } = getEngine();
  _outGain.gain.setTargetAtTime(Math.max(0, Math.min(1.5, v)), ctx.currentTime, 0.02);
}

function midiToFreq(note: number) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

export async function noteOn(midi: number, velocity = 0.85) {
  ensureSynth();
  await ensureRunning();
  if (!_input) return;
  const { ctx } = getEngine();
  const existing = activeVoices.get(midi);
  if (existing) existing.noteOff(ctx.currentTime);

  const p = _currentPreset;
  const freq = midiToFreq(midi);
  const t0 = ctx.currentTime;

  const envGain = ctx.createGain();
  envGain.gain.value = 0;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = p.filter.freq;
  filter.Q.value = p.filter.q;

  const oscs: OscillatorNode[] = [];
  for (const o of p.oscs) {
    const osc = ctx.createOscillator();
    osc.type = o.type;
    osc.frequency.value = freq;
    osc.detune.value = o.detune;
    const og = ctx.createGain();
    og.gain.value = o.gain;
    osc.connect(og);
    og.connect(filter);
    osc.start(t0);
    oscs.push(osc);
  }
  filter.connect(envGain);
  envGain.connect(_input);

  const peak = Math.max(0, Math.min(1, velocity)) * p.gain;
  envGain.gain.cancelScheduledValues(t0);
  envGain.gain.setValueAtTime(0, t0);
  envGain.gain.linearRampToValueAtTime(peak, t0 + p.env.attack);
  envGain.gain.linearRampToValueAtTime(peak * p.env.sustain, t0 + p.env.attack + p.env.decay);

  if (p.filter.envAmount > 0) {
    const fpeak = p.filter.freq + p.filter.envAmount;
    filter.frequency.cancelScheduledValues(t0);
    filter.frequency.setValueAtTime(p.filter.freq, t0);
    filter.frequency.linearRampToValueAtTime(fpeak, t0 + p.env.attack);
    filter.frequency.linearRampToValueAtTime(p.filter.freq, t0 + p.env.attack + p.env.decay);
  }

  const noteOff = (when?: number) => {
    const t = when ?? ctx.currentTime;
    try {
      envGain.gain.cancelScheduledValues(t);
      envGain.gain.setValueAtTime(envGain.gain.value, t);
      envGain.gain.linearRampToValueAtTime(0, t + Math.max(0.02, p.env.release));
      const stopAt = t + p.env.release + 0.05;
      for (const o of oscs) {
        try { o.stop(stopAt); } catch { /* noop */ }
      }
    } catch { /* noop */ }
    setTimeout(() => {
      try { envGain.disconnect(); filter.disconnect(); } catch { /* noop */ }
    }, (p.env.release + 0.2) * 1000);
    activeVoices.delete(midi);
  };

  activeVoices.set(midi, { oscs, envGain, filter, noteOff });
}

export function noteOff(midi: number) {
  const v = activeVoices.get(midi);
  if (v) v.noteOff();
}

export function allNotesOff() {
  for (const v of activeVoices.values()) v.noteOff();
  activeVoices.clear();
}
