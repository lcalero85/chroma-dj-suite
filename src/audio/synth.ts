// Polyphonic multi-preset synthesizer with rich live FX, inspired by famous
// hardware/virtual synths. Routed directly to the master bus.
import { getEngine, ensureRunning } from "./engine";

export type SynthPresetId =
  // Original 8 (kept for back-compat)
  | "piano" | "lead" | "bass" | "pad" | "pluck" | "brass" | "organ" | "bell"
  // Famous synth-inspired additions
  | "moogBass"        // Minimoog-style fat bass
  | "acidBass"        // TB-303 squelch
  | "dx7ep"           // DX7 electric piano
  | "jupiterStrings"  // Jupiter-8 strings
  | "prophetPad"      // Prophet-5 lush pad
  | "obxBrass"        // Oberheim OB-X brass
  | "reggaeSkank"     // Reggae offbeat organ skank
  | "dubStab"         // Dub-style brass stab
  | "wurliReggae"     // Wurlitzer EP — reggae/soul
  | "rhodes"          // Rhodes EP — jazz/lover's rock
  | "808Sub"          // 808 sub bass
  | "trapLead"        // Trap pluck lead
  | "houseStab"       // House piano stab
  | "psyLead"         // Psytrance saw lead
  | "synthwave"       // Synthwave PWM lead
  | "futureBass"      // Future bass supersaw chord
  // Full-kit / multi-element presets
  | "drumKit"         // Synthetic drum kit (kick/snare/hat mapped per key)
  | "bassKit"         // Bass guitar / synth bass kit (slap + pick + sub layers)
  | "guitarKit"       // Electric guitar kit (clean + power chord + harmonics)
  | "reggaeFull";     // Full reggae kit (skank + bubble + bassline + horns)

export interface SynthPreset {
  id: SynthPresetId;
  label: string;
  oscs: { type: OscillatorType; detune: number; gain: number }[];
  env: { attack: number; decay: number; sustain: number; release: number };
  filter: { freq: number; q: number; envAmount: number };
  gain: number;
}

export const SYNTH_PRESETS: SynthPreset[] = [
  // ---- Originals ----
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

  // ---- Famous synth-inspired ----
  { id: "moogBass", label: "Moog Bass",
    oscs: [{ type: "sawtooth", detune: 0, gain: 0.7 }, { type: "square", detune: -12, gain: 0.55 }, { type: "triangle", detune: -24, gain: 0.4 }],
    env: { attack: 0.004, decay: 0.4, sustain: 0.55, release: 0.25 },
    filter: { freq: 600, q: 8, envAmount: 1800 }, gain: 0.75 },
  { id: "acidBass", label: "303 Acid",
    oscs: [{ type: "sawtooth", detune: 0, gain: 0.85 }],
    env: { attack: 0.002, decay: 0.18, sustain: 0.0, release: 0.12 },
    filter: { freq: 350, q: 18, envAmount: 3500 }, gain: 0.7 },
  { id: "dx7ep", label: "DX7 EP",
    oscs: [{ type: "sine", detune: 0, gain: 0.55 }, { type: "sine", detune: 1200, gain: 0.3 }, { type: "triangle", detune: 7, gain: 0.2 }],
    env: { attack: 0.003, decay: 0.9, sustain: 0.35, release: 0.7 },
    filter: { freq: 5500, q: 0.8, envAmount: 600 }, gain: 0.55 },
  { id: "jupiterStrings", label: "Jupiter Strings",
    oscs: [{ type: "sawtooth", detune: -9, gain: 0.45 }, { type: "sawtooth", detune: 9, gain: 0.45 }, { type: "sawtooth", detune: 0, gain: 0.35 }],
    env: { attack: 0.4, decay: 0.6, sustain: 0.85, release: 1.6 },
    filter: { freq: 2800, q: 1, envAmount: 700 }, gain: 0.5 },
  { id: "prophetPad", label: "Prophet Pad",
    oscs: [{ type: "sawtooth", detune: -5, gain: 0.5 }, { type: "sawtooth", detune: 5, gain: 0.5 }, { type: "triangle", detune: -12, gain: 0.35 }],
    env: { attack: 0.8, decay: 0.6, sustain: 0.9, release: 2.0 },
    filter: { freq: 1800, q: 1.2, envAmount: 900 }, gain: 0.45 },
  { id: "obxBrass", label: "OB-X Brass",
    oscs: [{ type: "sawtooth", detune: -4, gain: 0.55 }, { type: "sawtooth", detune: 4, gain: 0.55 }, { type: "square", detune: 0, gain: 0.3 }],
    env: { attack: 0.06, decay: 0.3, sustain: 0.7, release: 0.4 },
    filter: { freq: 2400, q: 1.5, envAmount: 2000 }, gain: 0.55 },
  { id: "reggaeSkank", label: "Reggae Skank",
    oscs: [{ type: "square", detune: 0, gain: 0.45 }, { type: "sine", detune: 1200, gain: 0.3 }, { type: "triangle", detune: 0, gain: 0.25 }],
    env: { attack: 0.002, decay: 0.18, sustain: 0.0, release: 0.12 },
    filter: { freq: 2400, q: 2, envAmount: 1500 }, gain: 0.6 },
  { id: "dubStab", label: "Dub Stab",
    oscs: [{ type: "sawtooth", detune: -3, gain: 0.55 }, { type: "sawtooth", detune: 3, gain: 0.55 }],
    env: { attack: 0.005, decay: 0.22, sustain: 0.0, release: 0.4 },
    filter: { freq: 1600, q: 4, envAmount: 2200 }, gain: 0.6 },
  { id: "wurliReggae", label: "Wurlitzer",
    oscs: [{ type: "triangle", detune: 0, gain: 0.55 }, { type: "square", detune: 0, gain: 0.25 }, { type: "sine", detune: 1900, gain: 0.2 }],
    env: { attack: 0.004, decay: 0.7, sustain: 0.4, release: 0.5 },
    filter: { freq: 3800, q: 1.2, envAmount: 800 }, gain: 0.55 },
  { id: "rhodes", label: "Rhodes EP",
    oscs: [{ type: "sine", detune: 0, gain: 0.6 }, { type: "sine", detune: 1200, gain: 0.25 }, { type: "triangle", detune: 7, gain: 0.2 }],
    env: { attack: 0.003, decay: 1.0, sustain: 0.3, release: 0.9 },
    filter: { freq: 4500, q: 0.7, envAmount: 500 }, gain: 0.55 },
  { id: "808Sub", label: "808 Sub",
    oscs: [{ type: "sine", detune: 0, gain: 0.95 }, { type: "triangle", detune: -12, gain: 0.25 }],
    env: { attack: 0.003, decay: 1.2, sustain: 0.4, release: 0.9 },
    filter: { freq: 350, q: 0.7, envAmount: 0 }, gain: 0.85 },
  { id: "trapLead", label: "Trap Lead",
    oscs: [{ type: "triangle", detune: 0, gain: 0.6 }, { type: "square", detune: 12, gain: 0.3 }],
    env: { attack: 0.002, decay: 0.4, sustain: 0.0, release: 0.3 },
    filter: { freq: 4500, q: 3, envAmount: 2200 }, gain: 0.6 },
  { id: "houseStab", label: "House Stab",
    oscs: [{ type: "sawtooth", detune: -7, gain: 0.5 }, { type: "sawtooth", detune: 7, gain: 0.5 }],
    env: { attack: 0.003, decay: 0.25, sustain: 0.0, release: 0.25 },
    filter: { freq: 3200, q: 2.5, envAmount: 2000 }, gain: 0.6 },
  { id: "psyLead", label: "Psy Lead",
    oscs: [{ type: "sawtooth", detune: -10, gain: 0.55 }, { type: "sawtooth", detune: 10, gain: 0.55 }, { type: "square", detune: 0, gain: 0.35 }],
    env: { attack: 0.005, decay: 0.2, sustain: 0.85, release: 0.2 },
    filter: { freq: 3200, q: 5, envAmount: 3000 }, gain: 0.55 },
  { id: "synthwave", label: "Synthwave",
    oscs: [{ type: "square", detune: -7, gain: 0.45 }, { type: "sawtooth", detune: 7, gain: 0.45 }, { type: "triangle", detune: 0, gain: 0.3 }],
    env: { attack: 0.02, decay: 0.4, sustain: 0.6, release: 0.6 },
    filter: { freq: 2800, q: 2, envAmount: 1800 }, gain: 0.55 },
  { id: "futureBass", label: "Future Bass",
    oscs: [{ type: "sawtooth", detune: -12, gain: 0.45 }, { type: "sawtooth", detune: -5, gain: 0.45 }, { type: "sawtooth", detune: 5, gain: 0.45 }, { type: "sawtooth", detune: 12, gain: 0.45 }],
    env: { attack: 0.05, decay: 0.4, sustain: 0.8, release: 0.6 },
    filter: { freq: 2400, q: 1.5, envAmount: 1500 }, gain: 0.5 },
  // ---- Full-kit presets (multi-element synthesized "instruments") ----
  { id: "drumKit", label: "Drum Kit",
    // Kit handled by special voice path; oscs here only used for fallback tone
    oscs: [{ type: "sine", detune: 0, gain: 0.7 }],
    env: { attack: 0.001, decay: 0.25, sustain: 0.0, release: 0.15 },
    filter: { freq: 8000, q: 0.7, envAmount: 0 }, gain: 0.85 },
  { id: "bassKit", label: "Bass Kit",
    // Layered: square + saw + sub sine for slap/pick/sub character
    oscs: [
      { type: "square",   detune: 0,   gain: 0.5 },
      { type: "sawtooth", detune: 0,   gain: 0.4 },
      { type: "sine",     detune: -12, gain: 0.55 },
      { type: "triangle", detune: 7,   gain: 0.18 },
    ],
    env: { attack: 0.004, decay: 0.5, sustain: 0.55, release: 0.22 },
    filter: { freq: 1100, q: 5, envAmount: 1800 }, gain: 0.78 },
  { id: "guitarKit", label: "Guitar Kit",
    // Karplus-flavored layered tone: triangle pluck + saw body + harmonic
    oscs: [
      { type: "triangle", detune: 0,    gain: 0.55 },
      { type: "sawtooth", detune: -7,   gain: 0.35 },
      { type: "square",   detune: 7,    gain: 0.22 },
      { type: "sine",     detune: 1200, gain: 0.18 },
    ],
    env: { attack: 0.003, decay: 0.5, sustain: 0.22, release: 0.5 },
    filter: { freq: 3200, q: 2.5, envAmount: 2400 }, gain: 0.65 },
  { id: "reggaeFull", label: "Reggae Full",
    // Skank organ + sub-bass + brass layered into one playable preset
    oscs: [
      { type: "square",   detune: 0,    gain: 0.4 },   // organ skank
      { type: "sine",     detune: 1200, gain: 0.28 },  // organ harmonic
      { type: "triangle", detune: -12,  gain: 0.45 },  // sub support
      { type: "sawtooth", detune: 7,    gain: 0.25 },  // brass shimmer
    ],
    env: { attack: 0.004, decay: 0.45, sustain: 0.35, release: 0.45 },
    filter: { freq: 2200, q: 2, envAmount: 1500 }, gain: 0.62 },
];

export interface SynthFx {
  // Original 4
  reverb: number;
  delay: number;
  filter: number;
  chorus: number;
  // New famous-synth FX
  drive: number;       // overdrive/distortion (Boss DS-1, Pro Co Rat vibe)
  bitcrush: number;    // 0..1 — bit reduction (lo-fi, SP-1200)
  phaser: number;      // wet amount
  flanger: number;     // wet amount
  tremolo: number;     // depth (Fender amp / Wurlitzer feel)
  eqLow: number;       // -1..+1 mapped from 0..1 (0.5 = flat)
  eqHi: number;        // -1..+1 mapped from 0..1 (0.5 = flat)
  width: number;       // stereo width 0..1
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
let _eqLow: BiquadFilterNode | null = null;
let _eqHi: BiquadFilterNode | null = null;
// Chorus
let _chorusDelay: DelayNode | null = null;
let _chorusLfo: OscillatorNode | null = null;
let _chorusLfoGain: GainNode | null = null;
let _chorusWet: GainNode | null = null;
let _chorusDry: GainNode | null = null;
// Phaser (allpass cascade modulated by LFO)
let _phaserAll: BiquadFilterNode[] = [];
let _phaserLfo: OscillatorNode | null = null;
let _phaserLfoGain: GainNode | null = null;
let _phaserWet: GainNode | null = null;
let _phaserDry: GainNode | null = null;
// Flanger
let _flangerDelay: DelayNode | null = null;
let _flangerLfo: OscillatorNode | null = null;
let _flangerLfoGain: GainNode | null = null;
let _flangerFb: GainNode | null = null;
let _flangerWet: GainNode | null = null;
let _flangerDry: GainNode | null = null;
// Tremolo
let _tremoloGain: GainNode | null = null;
let _tremoloLfo: OscillatorNode | null = null;
let _tremoloLfoGain: GainNode | null = null;
// Drive
let _driveShaper: WaveShaperNode | null = null;
let _driveDry: GainNode | null = null;
let _driveWet: GainNode | null = null;
let _drivePre: GainNode | null = null;
// Bitcrusher (via WaveShaper quantization curve + sample-and-hold approximation)
let _bitcrushShaper: WaveShaperNode | null = null;
let _bitcrushWet: GainNode | null = null;
let _bitcrushDry: GainNode | null = null;
// Delay
let _delayNode: DelayNode | null = null;
let _delayFb: GainNode | null = null;
let _delayWet: GainNode | null = null;
let _delayDry: GainNode | null = null;
// Reverb
let _reverb: ConvolverNode | null = null;
let _reverbWet: GainNode | null = null;
let _reverbDry: GainNode | null = null;
// Stereo width via simple M/S-ish split
let _widthSplit: ChannelSplitterNode | null = null;
let _widthMerge: ChannelMergerNode | null = null;
let _widthMid: GainNode | null = null;
let _widthSide: GainNode | null = null;

let _currentPreset: SynthPreset = SYNTH_PRESETS[0];
/** Active layered presets — when length > 1 each MIDI note plays across all of them. */
let _activeLayers: SynthPresetId[] = [];
/** Active voices keyed by `${midi}:${presetId}` so layered notes don't collide. */
const activeVoices = new Map<string, Voice>();

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

function makeDriveCurve(amount = 50): Float32Array {
  const n = 4096;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const k = amount;
  const deg = Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

function makeBitcrushCurve(bits = 6): Float32Array {
  const n = 4096;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const steps = Math.pow(2, bits);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = Math.round(x * steps) / steps;
  }
  return curve;
}

function ensureSynth() {
  if (_initialized) return;
  const { ctx, master } = getEngine();
  _input = ctx.createGain();
  _input.gain.value = 1;
  _outGain = ctx.createGain();
  _outGain.gain.value = 0.8;
  _master = master;

  // EQ low/high shelves
  _eqLow = ctx.createBiquadFilter();
  _eqLow.type = "lowshelf"; _eqLow.frequency.value = 200; _eqLow.gain.value = 0;
  _eqHi = ctx.createBiquadFilter();
  _eqHi.type = "highshelf"; _eqHi.frequency.value = 4000; _eqHi.gain.value = 0;

  _globalFilter = ctx.createBiquadFilter();
  _globalFilter.type = "lowpass";
  _globalFilter.frequency.value = 18000;
  _globalFilter.Q.value = 0.7;

  // Drive
  _drivePre = ctx.createGain(); _drivePre.gain.value = 1;
  _driveShaper = ctx.createWaveShaper();
  _driveShaper.curve = makeDriveCurve(40) as unknown as WaveShaperNode["curve"];
  _driveShaper.oversample = "2x";
  _driveDry = ctx.createGain(); _driveDry.gain.value = 1;
  _driveWet = ctx.createGain(); _driveWet.gain.value = 0;

  // Bitcrush
  _bitcrushShaper = ctx.createWaveShaper();
  _bitcrushShaper.curve = makeBitcrushCurve(8) as unknown as WaveShaperNode["curve"];
  _bitcrushDry = ctx.createGain(); _bitcrushDry.gain.value = 1;
  _bitcrushWet = ctx.createGain(); _bitcrushWet.gain.value = 0;

  // Chorus
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

  // Phaser — 4 stage allpass cascade
  _phaserAll = [];
  for (let i = 0; i < 4; i++) {
    const ap = ctx.createBiquadFilter();
    ap.type = "allpass";
    ap.frequency.value = 600 + i * 400;
    ap.Q.value = 1.2;
    _phaserAll.push(ap);
  }
  for (let i = 0; i < _phaserAll.length - 1; i++) _phaserAll[i].connect(_phaserAll[i + 1]);
  _phaserLfo = ctx.createOscillator();
  _phaserLfo.frequency.value = 0.4;
  _phaserLfoGain = ctx.createGain();
  _phaserLfoGain.gain.value = 800;
  _phaserLfo.connect(_phaserLfoGain);
  for (const ap of _phaserAll) _phaserLfoGain.connect(ap.frequency);
  _phaserLfo.start();
  _phaserDry = ctx.createGain(); _phaserDry.gain.value = 1;
  _phaserWet = ctx.createGain(); _phaserWet.gain.value = 0;

  // Flanger
  _flangerDelay = ctx.createDelay(0.02);
  _flangerDelay.delayTime.value = 0.005;
  _flangerLfo = ctx.createOscillator();
  _flangerLfo.frequency.value = 0.25;
  _flangerLfoGain = ctx.createGain();
  _flangerLfoGain.gain.value = 0.003;
  _flangerLfo.connect(_flangerLfoGain);
  _flangerLfoGain.connect(_flangerDelay.delayTime);
  _flangerLfo.start();
  _flangerFb = ctx.createGain(); _flangerFb.gain.value = 0.55;
  _flangerDry = ctx.createGain(); _flangerDry.gain.value = 1;
  _flangerWet = ctx.createGain(); _flangerWet.gain.value = 0;

  // Tremolo (amplitude modulation on a pre-master gain)
  _tremoloGain = ctx.createGain(); _tremoloGain.gain.value = 1;
  _tremoloLfo = ctx.createOscillator();
  _tremoloLfo.frequency.value = 5;
  _tremoloLfoGain = ctx.createGain();
  _tremoloLfoGain.gain.value = 0;
  _tremoloLfo.connect(_tremoloLfoGain);
  _tremoloLfoGain.connect(_tremoloGain.gain);
  _tremoloLfo.start();

  // Delay
  _delayNode = ctx.createDelay(2);
  _delayNode.delayTime.value = 0.32;
  _delayFb = ctx.createGain(); _delayFb.gain.value = 0.35;
  _delayDry = ctx.createGain(); _delayDry.gain.value = 1;
  _delayWet = ctx.createGain(); _delayWet.gain.value = 0;

  // Reverb
  _reverb = ctx.createConvolver();
  _reverb.buffer = makeImpulse(ctx);
  _reverbDry = ctx.createGain(); _reverbDry.gain.value = 1;
  _reverbWet = ctx.createGain(); _reverbWet.gain.value = 0;

  // Stereo width
  _widthSplit = ctx.createChannelSplitter(2);
  _widthMerge = ctx.createChannelMerger(2);
  _widthMid = ctx.createGain(); _widthMid.gain.value = 1;
  _widthSide = ctx.createGain(); _widthSide.gain.value = 1;

  // ----- Routing -----
  // input → eqLow → eqHi → globalFilter → drive(parallel) → bitcrush(parallel)
  // → chorus(parallel) → phaser(parallel) → flanger(parallel)
  // → tremoloGain → delay(parallel) → reverb(parallel) → outGain → master
  const sumDrive = ctx.createGain();
  const sumBit = ctx.createGain();
  const sumChor = ctx.createGain();
  const sumPhase = ctx.createGain();
  const sumFlange = ctx.createGain();
  const sumDelay = ctx.createGain();
  const sumReverb = ctx.createGain();

  _input.connect(_eqLow);
  _eqLow.connect(_eqHi);
  _eqHi.connect(_globalFilter);

  // Drive parallel
  _globalFilter.connect(_driveDry);
  _globalFilter.connect(_drivePre);
  _drivePre.connect(_driveShaper);
  _driveShaper.connect(_driveWet);
  _driveDry.connect(sumDrive);
  _driveWet.connect(sumDrive);

  // Bitcrush parallel
  sumDrive.connect(_bitcrushDry);
  sumDrive.connect(_bitcrushShaper);
  _bitcrushShaper.connect(_bitcrushWet);
  _bitcrushDry.connect(sumBit);
  _bitcrushWet.connect(sumBit);

  // Chorus parallel
  sumBit.connect(_chorusDry);
  sumBit.connect(_chorusDelay);
  _chorusDelay.connect(_chorusWet);
  _chorusDry.connect(sumChor);
  _chorusWet.connect(sumChor);

  // Phaser parallel
  sumChor.connect(_phaserDry);
  sumChor.connect(_phaserAll[0]);
  _phaserAll[_phaserAll.length - 1].connect(_phaserWet);
  _phaserDry.connect(sumPhase);
  _phaserWet.connect(sumPhase);

  // Flanger parallel
  sumPhase.connect(_flangerDry);
  sumPhase.connect(_flangerDelay);
  _flangerDelay.connect(_flangerWet);
  _flangerDelay.connect(_flangerFb);
  _flangerFb.connect(_flangerDelay);
  _flangerDry.connect(sumFlange);
  _flangerWet.connect(sumFlange);

  // Tremolo (in series)
  sumFlange.connect(_tremoloGain);

  // Delay parallel
  _tremoloGain.connect(_delayDry);
  _tremoloGain.connect(_delayNode);
  _delayNode.connect(_delayWet);
  _delayNode.connect(_delayFb);
  _delayFb.connect(_delayNode);
  _delayDry.connect(sumDelay);
  _delayWet.connect(sumDelay);

  // Reverb parallel
  sumDelay.connect(_reverbDry);
  sumDelay.connect(_reverb);
  _reverb.connect(_reverbWet);
  _reverbDry.connect(sumReverb);
  _reverbWet.connect(sumReverb);

  // Stereo width: simple — controlled via mid/side gains is complex; here we
  // just route through a splitter/merger with side channels boosted/attenuated.
  sumReverb.connect(_outGain);
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

/**
 * Configure additional layered presets that play on top of the main preset.
 * Pass [] to disable layering (single-preset mode).
 */
export function setSynthLayers(ids: SynthPresetId[]) {
  // Filter to known presets and de-duplicate
  const valid = SYNTH_PRESETS.map((p) => p.id);
  const seen = new Set<SynthPresetId>();
  _activeLayers = [];
  for (const id of ids) {
    if (valid.includes(id) && !seen.has(id)) { _activeLayers.push(id); seen.add(id); }
  }
}

export function getSynthLayers(): SynthPresetId[] { return [..._activeLayers]; }

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
  if (typeof fx.drive === "number" && _driveWet && _drivePre) {
    const w = Math.max(0, Math.min(1, fx.drive));
    _driveWet.gain.setTargetAtTime(w, t, tau);
    _drivePre.gain.setTargetAtTime(1 + w * 4, t, tau);
  }
  if (typeof fx.bitcrush === "number" && _bitcrushWet && _bitcrushShaper) {
    const w = Math.max(0, Math.min(1, fx.bitcrush));
    _bitcrushWet.gain.setTargetAtTime(w, t, tau);
    // Re-map curve based on amount: more crush = fewer bits
    const bits = Math.max(2, Math.round(12 - w * 10));
    _bitcrushShaper.curve = makeBitcrushCurve(bits) as unknown as WaveShaperNode["curve"];
  }
  if (typeof fx.phaser === "number" && _phaserWet && _phaserDry) {
    const w = Math.max(0, Math.min(1, fx.phaser));
    _phaserWet.gain.setTargetAtTime(w, t, tau);
    _phaserDry.gain.setTargetAtTime(1 - w * 0.3, t, tau);
  }
  if (typeof fx.flanger === "number" && _flangerWet && _flangerDry && _flangerFb) {
    const w = Math.max(0, Math.min(1, fx.flanger));
    _flangerWet.gain.setTargetAtTime(w, t, tau);
    _flangerDry.gain.setTargetAtTime(1 - w * 0.3, t, tau);
    _flangerFb.gain.setTargetAtTime(0.3 + w * 0.5, t, tau);
  }
  if (typeof fx.tremolo === "number" && _tremoloLfoGain) {
    const w = Math.max(0, Math.min(1, fx.tremolo));
    _tremoloLfoGain.gain.setTargetAtTime(w * 0.7, t, tau);
  }
  if (typeof fx.eqLow === "number" && _eqLow) {
    const v = Math.max(0, Math.min(1, fx.eqLow));
    const db = (v - 0.5) * 24; // -12..+12 dB
    _eqLow.gain.setTargetAtTime(db, t, tau);
  }
  if (typeof fx.eqHi === "number" && _eqHi) {
    const v = Math.max(0, Math.min(1, fx.eqHi));
    const db = (v - 0.5) * 24;
    _eqHi.gain.setTargetAtTime(db, t, tau);
  }
  if (typeof fx.width === "number") {
    // width currently unused in routing; reserved for future M/S processing.
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

/**
 * Drum-kit voice — maps MIDI note ranges to synthesized percussion:
 *  - low (≤47, B2)            → kick
 *  - mid (48..59, C3..B3)     → snare/clap
 *  - high (≥60, ≥C4)          → hat / cymbal
 *  Specific notes also pick variants (toms, rim, ride).
 */
function startDrumVoice(midi: number, velocity: number, ctx: AudioContext, key: string) {
  if (!_input) return;
  const t0 = ctx.currentTime;
  const env = ctx.createGain();
  env.gain.value = 0;
  const out = env;
  const peak = Math.max(0, Math.min(1, velocity)) * 0.85;
  let sustain = 0.2;

  if (midi <= 47) {
    // Kick: sine sweep from ~110 → 45 Hz, fast click on top.
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(160, t0);
    osc.frequency.exponentialRampToValueAtTime(45, t0 + 0.12);
    const click = ctx.createOscillator();
    click.type = "triangle";
    click.frequency.value = 1800;
    const clickGain = ctx.createGain();
    clickGain.gain.value = 0.15;
    clickGain.gain.setValueAtTime(0.15, t0);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.03);
    osc.connect(env);
    click.connect(clickGain).connect(env);
    osc.start(t0); click.start(t0);
    osc.stop(t0 + 0.6); click.stop(t0 + 0.05);
    sustain = 0.32;
  } else if (midi <= 59) {
    // Snare: noise + tonal tail.
    const noise = makeNoiseSource(ctx, 0.4);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 1800; bp.Q.value = 0.7;
    const tone = ctx.createOscillator();
    tone.type = "triangle"; tone.frequency.value = 220;
    const toneG = ctx.createGain(); toneG.gain.value = 0.4;
    noise.connect(bp).connect(env);
    tone.connect(toneG).connect(env);
    noise.start(t0); tone.start(t0);
    noise.stop(t0 + 0.4); tone.stop(t0 + 0.18);
    sustain = 0.22;
  } else {
    // Hi-hat / cymbal: high-pass filtered noise. Note ≥ 72 = open hat.
    const open = midi >= 72;
    const noise = makeNoiseSource(ctx, open ? 0.6 : 0.18);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 7000; hp.Q.value = 0.5;
    noise.connect(hp).connect(env);
    noise.start(t0);
    noise.stop(t0 + (open ? 0.6 : 0.18));
    sustain = open ? 0.5 : 0.12;
  }

  out.connect(_input);
  env.gain.cancelScheduledValues(t0);
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(peak, t0 + 0.002);
  env.gain.exponentialRampToValueAtTime(0.001, t0 + sustain);

  const noteOff = (when?: number) => {
    const t = when ?? ctx.currentTime;
    try {
      env.gain.cancelScheduledValues(t);
      env.gain.setValueAtTime(env.gain.value, t);
      env.gain.linearRampToValueAtTime(0, t + 0.05);
    } catch { /* noop */ }
    setTimeout(() => { try { env.disconnect(); } catch { /* noop */ } }, 800);
    activeVoices.delete(key);
  };

  // Drums are one-shots — auto-clean.
  setTimeout(() => activeVoices.delete(key), Math.ceil((sustain + 0.1) * 1000));
  activeVoices.set(key, { oscs: [], envGain: env, filter: env as unknown as BiquadFilterNode, noteOff });
}

function makeNoiseSource(ctx: AudioContext, durationSec: number): AudioBufferSourceNode {
  const len = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  return src;
}

export async function noteOn(midi: number, velocity = 0.85) {
  ensureSynth();
  await ensureRunning();
  if (!_input) return;
  const { ctx } = getEngine();

  // Build the list of presets to play: main + any extra layers.
  const layerIds: SynthPresetId[] = [_currentPreset.id];
  for (const lid of _activeLayers) {
    if (lid !== _currentPreset.id && !layerIds.includes(lid)) layerIds.push(lid);
  }
  for (const pid of layerIds) {
    const p = SYNTH_PRESETS.find((x) => x.id === pid);
    if (p) startVoice(midi, velocity, p, ctx);
  }
}

function startVoice(midi: number, velocity: number, p: SynthPreset, ctx: AudioContext) {
  if (!_input) return;
  const key = `${midi}:${p.id}`;
  const existing = activeVoices.get(key);
  if (existing) existing.noteOff(ctx.currentTime);

  // Drum-kit special path: synthesize percussive sounds per note class.
  if (p.id === "drumKit") {
    startDrumVoice(midi, velocity, ctx, key);
    return;
  }

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
    activeVoices.delete(key);
  };

  activeVoices.set(key, { oscs, envGain, filter, noteOff });
}

export function noteOff(midi: number) {
  // Stop every layer's voice for this midi note.
  const prefix = `${midi}:`;
  for (const [k, v] of activeVoices) {
    if (k.startsWith(prefix)) v.noteOff();
  }
}

export function allNotesOff() {
  for (const v of activeVoices.values()) v.noteOff();
  activeVoices.clear();
}

// =====================================================================
// Demos: short sequenced patterns the user can preview.
// Each demo is a list of {note, time, dur} events looped at `bars` * `bpm`.
// =====================================================================

export interface SynthDemo {
  id: string;
  label: string;
  preset: SynthPresetId;
  bpm: number;
  bars: number;
  /** Beats per bar = 4 fixed. Each event uses beat-time within the loop. */
  events: { note: number; beat: number; dur: number; vel?: number }[];
}

export const SYNTH_DEMOS: SynthDemo[] = [
  {
    id: "demoReggae",
    label: "Reggae Skank",
    preset: "reggaeSkank",
    bpm: 78, bars: 2,
    events: [
      // Offbeat skank chord (Am): A3, C4, E4 stabs on 2 and 4 of every beat
      ...[0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5].flatMap((b) => [
        { note: 57, beat: b, dur: 0.18 },
        { note: 60, beat: b, dur: 0.18 },
        { note: 64, beat: b, dur: 0.18 },
      ]),
    ],
  },
  {
    id: "demoDub",
    label: "Dub Bass",
    preset: "moogBass",
    bpm: 76, bars: 2,
    events: [
      { note: 33, beat: 0, dur: 0.5 }, { note: 33, beat: 1, dur: 0.5 },
      { note: 36, beat: 2, dur: 0.5 }, { note: 33, beat: 3, dur: 0.5 },
      { note: 31, beat: 4, dur: 0.5 }, { note: 31, beat: 5, dur: 0.5 },
      { note: 36, beat: 6, dur: 0.5 }, { note: 33, beat: 7, dur: 0.5 },
    ],
  },
  {
    id: "demoAcid",
    label: "Acid 303",
    preset: "acidBass",
    bpm: 128, bars: 1,
    events: [
      { note: 36, beat: 0,    dur: 0.18 }, { note: 36, beat: 0.25, dur: 0.18 },
      { note: 48, beat: 0.5,  dur: 0.18 }, { note: 36, beat: 0.75, dur: 0.18 },
      { note: 39, beat: 1,    dur: 0.18 }, { note: 36, beat: 1.5,  dur: 0.18 },
      { note: 43, beat: 2,    dur: 0.18 }, { note: 36, beat: 2.5,  dur: 0.18 },
      { note: 36, beat: 3,    dur: 0.18 }, { note: 48, beat: 3.5,  dur: 0.18 },
    ],
  },
  {
    id: "demoSynthwave",
    label: "Synthwave",
    preset: "synthwave",
    bpm: 100, bars: 2,
    events: [
      { note: 64, beat: 0, dur: 0.9 }, { note: 67, beat: 1, dur: 0.9 },
      { note: 71, beat: 2, dur: 0.9 }, { note: 74, beat: 3, dur: 0.9 },
      { note: 72, beat: 4, dur: 0.9 }, { note: 69, beat: 5, dur: 0.9 },
      { note: 67, beat: 6, dur: 0.9 }, { note: 64, beat: 7, dur: 0.9 },
    ],
  },
  {
    id: "demoHouse",
    label: "House Stab",
    preset: "houseStab",
    bpm: 124, bars: 2,
    events: [
      ...[0, 1, 2, 3, 4, 5, 6, 7].flatMap((b) => [
        { note: 60, beat: b + 0.5, dur: 0.2 },
        { note: 63, beat: b + 0.5, dur: 0.2 },
        { note: 67, beat: b + 0.5, dur: 0.2 },
      ]),
    ],
  },
  {
    id: "demoTrap",
    label: "Trap",
    preset: "808Sub",
    bpm: 140, bars: 2,
    events: [
      { note: 28, beat: 0,   dur: 0.9 },
      { note: 28, beat: 1.5, dur: 0.4 },
      { note: 31, beat: 3,   dur: 0.9 },
      { note: 33, beat: 4,   dur: 0.9 },
      { note: 31, beat: 5.5, dur: 0.4 },
      { note: 28, beat: 7,   dur: 0.9 },
    ],
  },
  {
    id: "demoJazzRhodes",
    label: "Rhodes Jazz",
    preset: "rhodes",
    bpm: 92, bars: 2,
    events: [
      // Cmaj7 → Am7 → Dm7 → G7
      { note: 60, beat: 0, dur: 0.9 }, { note: 64, beat: 0, dur: 0.9 }, { note: 67, beat: 0, dur: 0.9 }, { note: 71, beat: 0, dur: 0.9 },
      { note: 57, beat: 2, dur: 0.9 }, { note: 60, beat: 2, dur: 0.9 }, { note: 64, beat: 2, dur: 0.9 }, { note: 67, beat: 2, dur: 0.9 },
      { note: 62, beat: 4, dur: 0.9 }, { note: 65, beat: 4, dur: 0.9 }, { note: 69, beat: 4, dur: 0.9 }, { note: 72, beat: 4, dur: 0.9 },
      { note: 55, beat: 6, dur: 0.9 }, { note: 59, beat: 6, dur: 0.9 }, { note: 62, beat: 6, dur: 0.9 }, { note: 65, beat: 6, dur: 0.9 },
    ],
  },
  {
    id: "demoPad80s",
    label: "80s Pad",
    preset: "prophetPad",
    bpm: 84, bars: 4,
    events: [
      { note: 60, beat: 0,  dur: 3.8 }, { note: 64, beat: 0,  dur: 3.8 }, { note: 67, beat: 0,  dur: 3.8 },
      { note: 57, beat: 4,  dur: 3.8 }, { note: 60, beat: 4,  dur: 3.8 }, { note: 64, beat: 4,  dur: 3.8 },
      { note: 65, beat: 8,  dur: 3.8 }, { note: 69, beat: 8,  dur: 3.8 }, { note: 72, beat: 8,  dur: 3.8 },
      { note: 55, beat: 12, dur: 3.8 }, { note: 59, beat: 12, dur: 3.8 }, { note: 62, beat: 12, dur: 3.8 },
    ],
  },
];

let _demoTimers: number[] = [];
let _demoActive = false;
let _demoLoopId: number | null = null;

export function isDemoPlaying(): boolean { return _demoActive; }

export async function playDemo(id: string) {
  stopDemo();
  const demo = SYNTH_DEMOS.find((d) => d.id === id);
  if (!demo) return;
  await ensureRunning();
  ensureSynth();
  const prevPreset = _currentPreset.id;
  setSynthPreset(demo.preset);

  const beatMs = 60000 / demo.bpm;
  const loopBeats = demo.bars * 4;
  const loopMs = loopBeats * beatMs;
  _demoActive = true;

  const schedule = () => {
    if (!_demoActive) return;
    for (const ev of demo.events) {
      const startMs = ev.beat * beatMs;
      const stopMs = startMs + ev.dur * beatMs;
      const onId = window.setTimeout(() => { void noteOn(ev.note, ev.vel ?? 0.8); }, startMs);
      const offId = window.setTimeout(() => { noteOff(ev.note); }, stopMs);
      _demoTimers.push(onId, offId);
    }
  };
  schedule();
  _demoLoopId = window.setInterval(schedule, loopMs);

  // Restore preset on stop happens in stopDemo via closure
  (stopDemo as unknown as { _restorePreset?: SynthPresetId })._restorePreset = prevPreset;
}

export function stopDemo() {
  _demoActive = false;
  if (_demoLoopId !== null) { window.clearInterval(_demoLoopId); _demoLoopId = null; }
  for (const id of _demoTimers) window.clearTimeout(id);
  _demoTimers = [];
  allNotesOff();
  const restore = (stopDemo as unknown as { _restorePreset?: SynthPresetId })._restorePreset;
  if (restore) {
    setSynthPreset(restore);
    (stopDemo as unknown as { _restorePreset?: SynthPresetId })._restorePreset = undefined;
  }
}
