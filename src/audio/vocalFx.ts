// Live vocal FX chain with autotune (scale-quantized pitch correction),
// harmonizer, formant shift, de-esser, compressor, EQ, reverb and delay.
//
// The chain is inserted in series between the engine's mic FX output and the
// master/recordTap. We do NOT touch engine.ts wiring directly; instead we
// expose `attachVocalChain(input, ...outputs)` which the controller calls
// when the user toggles the live-vocal panel.
//
// Pitch shifting uses a classic two-tap modulated delay (granular) approach,
// which works in plain Web Audio without an AudioWorklet. Pitch detection
// uses autocorrelation inside a ScriptProcessor running on a side-chain tap.

export type ScaleId =
  | "chromatic"
  | "major"
  | "minor"
  | "dorian"
  | "mixolydian"
  | "harmonicMinor"
  | "pentaMajor"
  | "pentaMinor"
  | "blues";

export const SCALE_INTERVALS: Record<ScaleId, number[]> = {
  chromatic:    [0,1,2,3,4,5,6,7,8,9,10,11],
  major:        [0,2,4,5,7,9,11],
  minor:        [0,2,3,5,7,8,10],
  dorian:       [0,2,3,5,7,9,10],
  mixolydian:   [0,2,4,5,7,9,10],
  harmonicMinor:[0,2,3,5,7,8,11],
  pentaMajor:   [0,2,4,7,9],
  pentaMinor:   [0,3,5,7,10],
  blues:        [0,3,5,6,7,10],
};

export const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"] as const;

export interface VocalFxParams {
  bypass: boolean;
  // Autotune
  autotune: boolean;
  scale: ScaleId;
  rootPc: number;        // 0..11 (C..B)
  retune: number;        // 0..1 — speed (0 = off, 1 = hard tune / T-Pain)
  formant: number;       // -12..+12 semitones (timbre shift, separate from pitch)
  // Harmonizer (third + fifth)
  harmonyMix: number;    // 0..1
  harmony3rd: number;    // semitones (e.g. +3 minor third / +4 major)
  harmony5th: number;    // semitones (e.g. +7)
  // Octaver
  octaveDown: number;    // 0..1 (mix)
  octaveUp: number;      // 0..1 (mix)
  // Dynamics / tone
  deEsser: number;       // 0..1 (sibilance reduction)
  compress: number;      // 0..1 (vocal compressor amount)
  eqLow: number;         // -12..+12 dB
  eqMid: number;         // -12..+12 dB
  eqHi: number;          // -12..+12 dB
  presence: number;      // 0..1 — air shelf
  // Spatial
  reverbMix: number;     // 0..1
  reverbSize: number;    // 0..1 (room size)
  delayMix: number;      // 0..1
  delayTime: number;     // 0..1 -> 0..0.8s
  delayFb: number;       // 0..0.85
  // Style
  doubler: number;       // 0..1 (micro-detune doubling)
}

export const DEFAULT_VOCAL_FX: VocalFxParams = {
  bypass: false,
  autotune: false,
  scale: "chromatic",
  rootPc: 0,
  retune: 0.5,
  formant: 0,
  harmonyMix: 0,
  harmony3rd: 4,
  harmony5th: 7,
  octaveDown: 0,
  octaveUp: 0,
  deEsser: 0,
  compress: 0.4,
  eqLow: 0,
  eqMid: 0,
  eqHi: 0,
  presence: 0.3,
  reverbMix: 0,
  reverbSize: 0.5,
  delayMix: 0,
  delayTime: 0.25,
  delayFb: 0.3,
  doubler: 0,
};

export interface VocalFxPreset {
  id: string;
  label: string;
  patch: Partial<VocalFxParams>;
}

export const VOCAL_FX_PRESETS: VocalFxPreset[] = [
  { id: "off",      label: "Sin efecto",       patch: { bypass: true } },
  { id: "tpain",    label: "T-Pain (Hard tune)", patch: { autotune: true, scale: "minor", retune: 1, doubler: 0.15, compress: 0.6, presence: 0.5, reverbMix: 0.15 } },
  { id: "soft",     label: "Auto-Tune Suave",  patch: { autotune: true, scale: "major", retune: 0.35, compress: 0.5, presence: 0.4, reverbMix: 0.1 } },
  { id: "trap",     label: "Trap Vocal",       patch: { autotune: true, scale: "minor", retune: 0.85, harmonyMix: 0.2, harmony3rd: 3, harmony5th: 7, reverbMix: 0.25, delayMix: 0.2, delayTime: 0.3, delayFb: 0.35, compress: 0.7 } },
  { id: "rnb",      label: "R&B Studio",       patch: { autotune: true, scale: "major", retune: 0.25, doubler: 0.2, presence: 0.6, eqHi: 3, reverbMix: 0.3, reverbSize: 0.7 } },
  { id: "reggae",   label: "Reggae Echo",      patch: { autotune: false, delayMix: 0.45, delayTime: 0.35, delayFb: 0.55, reverbMix: 0.2, eqLow: 2, presence: 0.4 } },
  { id: "doubler",  label: "Doblador Coro",    patch: { autotune: false, doubler: 0.6, harmonyMix: 0.35, harmony3rd: 12, harmony5th: -12, reverbMix: 0.2 } },
  { id: "robot",    label: "Robot Vocoder",    patch: { autotune: true, scale: "chromatic", retune: 1, formant: -5, harmonyMix: 0.3, harmony3rd: 7, harmony5th: 12, octaveDown: 0.4 } },
  { id: "chipmunk", label: "Chipmunk",         patch: { autotune: false, formant: 8, octaveUp: 0.5, presence: 0.4 } },
  { id: "demon",    label: "Demonio",          patch: { autotune: false, formant: -10, octaveDown: 0.7, eqLow: 4, reverbMix: 0.3, reverbSize: 0.9 } },
  { id: "stadium",  label: "Estadio",          patch: { reverbMix: 0.55, reverbSize: 0.95, delayMix: 0.25, delayTime: 0.4, delayFb: 0.3, presence: 0.4 } },
  { id: "phone",    label: "Teléfono",         patch: { eqLow: -12, eqHi: -8, eqMid: 6, compress: 0.8, presence: 0.6 } },
  { id: "harmony",  label: "Armonía 3+5",      patch: { autotune: true, scale: "major", retune: 0.6, harmonyMix: 0.55, harmony3rd: 4, harmony5th: 7, reverbMix: 0.2 } },
];

// ===========================================================================
// Internal nodes
// ===========================================================================

interface PitchShifter {
  input: GainNode;
  output: GainNode;
  setSemitones: (st: number) => void;
  setFormant: (st: number) => void;
  destroy: () => void;
}

function makeImpulseResponse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * seconds));
  const impulse = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

/**
 * Granular pitch shifter using two crossfaded modulated delay lines.
 * grainSize ~ 0.08s yields acceptable vocal quality with low latency.
 */
function createPitchShifter(ctx: AudioContext, grainSize = 0.08): PitchShifter {
  const input = ctx.createGain();
  const output = ctx.createGain();

  const delayA = ctx.createDelay(1);
  const delayB = ctx.createDelay(1);
  delayA.delayTime.value = 0;
  delayB.delayTime.value = grainSize / 2;

  const gainA = ctx.createGain();
  const gainB = ctx.createGain();
  gainA.gain.value = 0;
  gainB.gain.value = 0;

  // LFO: sawtooth ramp 0 -> grainSize, repeated. We use a manual oscillator
  // built from an offset constant + custom periodic wave for stability.
  // Simpler: drive delay times procedurally with setValueAtTime ramps.
  let semis = 0;
  let timer: number | null = null;

  // Triangular crossfade window of duration grainSize per grain.
  const period = grainSize; // seconds per grain

  function schedule() {
    const ratio = Math.pow(2, semis / 12);
    const rate = 1 - ratio; // delta delay per second
    const now = ctx.currentTime;
    const lookahead = 0.1;
    // Each grain spans `period` seconds. delayTime ramps linearly.
    // Use cancelAndHold then ramp.
    [delayA, delayB].forEach((d, idx) => {
      const start = idx * (period / 2);
      const startTime = now + start;
      try {
        d.delayTime.cancelScheduledValues(now);
      } catch { /* noop */ }
      // Build a few periods ahead.
      for (let k = 0; k < 4; k++) {
        const t0 = startTime + k * period;
        const t1 = t0 + period;
        const startVal = ratio >= 1 ? grainSize : 0;
        const endVal = startVal + rate * period;
        // Clamp to [0, grainSize]
        const sv = Math.max(0.0001, Math.min(grainSize, startVal));
        const ev = Math.max(0.0001, Math.min(grainSize, endVal));
        d.delayTime.setValueAtTime(sv, t0);
        d.delayTime.linearRampToValueAtTime(ev, t1);
      }
      const g = idx === 0 ? gainA : gainB;
      try { g.gain.cancelScheduledValues(now); } catch { /* noop */ }
      for (let k = 0; k < 4; k++) {
        const t0 = startTime + k * period;
        const t1 = t0 + period / 2;
        const t2 = t0 + period;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(1, t1);
        g.gain.linearRampToValueAtTime(0, t2);
      }
    });
    timer = window.setTimeout(schedule, period * 3 * 1000 - 50) as unknown as number;
    void lookahead;
  }

  // Formant: high-shelf + low-shelf pair to roughly compensate timbre.
  const formantLo = ctx.createBiquadFilter();
  formantLo.type = "lowshelf";
  formantLo.frequency.value = 700;
  formantLo.gain.value = 0;
  const formantHi = ctx.createBiquadFilter();
  formantHi.type = "highshelf";
  formantHi.frequency.value = 2500;
  formantHi.gain.value = 0;

  input.connect(delayA);
  input.connect(delayB);
  delayA.connect(gainA);
  delayB.connect(gainB);
  gainA.connect(formantLo);
  gainB.connect(formantLo);
  formantLo.connect(formantHi);
  formantHi.connect(output);

  schedule();

  return {
    input,
    output,
    setSemitones: (st: number) => {
      const clamped = Math.max(-24, Math.min(24, st));
      if (Math.abs(clamped - semis) < 0.01) return;
      semis = clamped;
      schedule();
    },
    setFormant: (st: number) => {
      const t = ctx.currentTime;
      // +st semitones -> boost highs, cut lows (and vice-versa)
      const dB = Math.max(-12, Math.min(12, st));
      formantLo.gain.setTargetAtTime(-dB * 0.6, t, 0.05);
      formantHi.gain.setTargetAtTime(dB * 0.8, t, 0.05);
    },
    destroy: () => {
      if (timer != null) clearTimeout(timer);
      try { input.disconnect(); } catch { /* noop */ }
      try { output.disconnect(); } catch { /* noop */ }
    },
  };
}

// ===========================================================================
// Vocal chain
// ===========================================================================

export interface VocalChainHandles {
  setParams: (p: Partial<VocalFxParams>) => void;
  getDetectedNote: () => { midi: number; cents: number } | null;
  destroy: () => void;
}

let _chain: {
  input: GainNode;
  outputs: AudioNode[];
  handles: VocalChainHandles;
} | null = null;

let _params: VocalFxParams = { ...DEFAULT_VOCAL_FX };
let _detected: { midi: number; cents: number } | null = null;

export function getVocalParams(): VocalFxParams {
  return { ..._params };
}

/** Find nearest pitch-class in scale, return target semitone offset. */
function snapToScale(midiFloat: number, rootPc: number, scale: ScaleId): number {
  const intervals = SCALE_INTERVALS[scale];
  const rounded = Math.round(midiFloat);
  const pc = ((rounded - rootPc) % 12 + 12) % 12;
  let bestDist = Infinity;
  let bestOffset = 0;
  for (const iv of intervals) {
    const cands = [iv, iv - 12, iv + 12];
    for (const c of cands) {
      const dist = Math.abs(pc - c);
      if (dist < bestDist) {
        bestDist = dist;
        bestOffset = c - pc;
      }
    }
  }
  return rounded + bestOffset;
}

/** Autocorrelation pitch detection (YIN-lite). Returns midi or null. */
function detectPitch(buf: Float32Array, sampleRate: number): number | null {
  const SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return null;

  let r1 = 0;
  let r2 = SIZE - 1;
  const thresh = 0.2;
  for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < thresh) { r1 = i; break; }
  for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < thresh) { r2 = SIZE - i; break; }
  const trimmed = buf.subarray(r1, r2);
  const n = trimmed.length;
  if (n < 64) return null;

  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < n - i; j++) sum += trimmed[j] * trimmed[j + i];
    c[i] = sum;
  }

  let d = 0;
  while (d < n - 1 && c[d] > c[d + 1]) d++;
  let maxVal = -1;
  let maxPos = -1;
  for (let i = d; i < n; i++) {
    if (c[i] > maxVal) { maxVal = c[i]; maxPos = i; }
  }
  if (maxPos <= 0) return null;

  // Parabolic interpolation
  const x1 = c[maxPos - 1] || 0;
  const x2 = c[maxPos];
  const x3 = c[maxPos + 1] || 0;
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  const shift = a !== 0 ? -b / (2 * a) : 0;
  const period = maxPos + shift;
  const freq = sampleRate / period;
  if (freq < 60 || freq > 1200) return null;
  const midi = 69 + 12 * Math.log2(freq / 440);
  return midi;
}

/** Build the entire vocal FX chain and connect input -> outputs. */
export function attachVocalChain(
  ctx: AudioContext,
  src: AudioNode,
  outputs: AudioNode[],
): VocalChainHandles {
  // Cleanup previous
  if (_chain) {
    _chain.handles.destroy();
    _chain = null;
  }

  const input = ctx.createGain();
  const dryBypass = ctx.createGain();
  const fxIn = ctx.createGain();
  const fxOut = ctx.createGain();
  const sumOut = ctx.createGain();

  // EQ
  const eqLo = ctx.createBiquadFilter(); eqLo.type = "lowshelf"; eqLo.frequency.value = 200;
  const eqMid = ctx.createBiquadFilter(); eqMid.type = "peaking"; eqMid.frequency.value = 1500; eqMid.Q.value = 0.9;
  const eqHi = ctx.createBiquadFilter(); eqHi.type = "highshelf"; eqHi.frequency.value = 5000;
  const presence = ctx.createBiquadFilter(); presence.type = "highshelf"; presence.frequency.value = 9000; presence.gain.value = 0;

  // De-esser: a peaking notch around 6.5kHz controlled by gain.
  const deEsser = ctx.createBiquadFilter(); deEsser.type = "peaking"; deEsser.frequency.value = 6500; deEsser.Q.value = 4; deEsser.gain.value = 0;

  // Compressor (vocal)
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.003; comp.release.value = 0.12;

  // Pitch shifters
  const tuner = createPitchShifter(ctx, 0.07);
  const harm3 = createPitchShifter(ctx, 0.09);
  const harm5 = createPitchShifter(ctx, 0.09);
  const octD = createPitchShifter(ctx, 0.10);
  const octU = createPitchShifter(ctx, 0.07);
  const dbl1 = createPitchShifter(ctx, 0.06);
  const dbl2 = createPitchShifter(ctx, 0.06);

  const tunerMix = ctx.createGain(); tunerMix.gain.value = 1;
  const harm3Mix = ctx.createGain(); harm3Mix.gain.value = 0;
  const harm5Mix = ctx.createGain(); harm5Mix.gain.value = 0;
  const octDMix = ctx.createGain(); octDMix.gain.value = 0;
  const octUMix = ctx.createGain(); octUMix.gain.value = 0;
  const dblMix = ctx.createGain(); dblMix.gain.value = 0;

  // Reverb
  const reverb = ctx.createConvolver();
  reverb.buffer = makeImpulseResponse(ctx, 2.0, 3);
  const reverbWet = ctx.createGain(); reverbWet.gain.value = 0;
  const reverbDry = ctx.createGain(); reverbDry.gain.value = 1;

  // Delay
  const delay = ctx.createDelay(2);
  delay.delayTime.value = 0.25;
  const delayFb = ctx.createGain(); delayFb.gain.value = 0.3;
  const delayWet = ctx.createGain(); delayWet.gain.value = 0;
  const delayDry = ctx.createGain(); delayDry.gain.value = 1;

  // Side-chain analyser for pitch detection
  const detectGain = ctx.createGain(); detectGain.gain.value = 1;
  // Mono down-mix via channelMerger isn't needed; ScriptProcessor handles ch0.
  // Fall back to AnalyserNode for non-realtime polling.
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  detectGain.connect(analyser);

  src.connect(input);
  input.connect(dryBypass); // tap for bypass
  input.connect(fxIn);
  input.connect(detectGain);

  // Tuner path (fxIn -> tuner -> tunerMix -> EQ chain)
  fxIn.connect(tuner.input);
  tuner.output.connect(tunerMix);
  // Harmony / octave taps in parallel
  fxIn.connect(harm3.input); harm3.output.connect(harm3Mix);
  fxIn.connect(harm5.input); harm5.output.connect(harm5Mix);
  fxIn.connect(octD.input); octD.output.connect(octDMix);
  fxIn.connect(octU.input); octU.output.connect(octUMix);
  // Doubler (two slightly-detuned voices)
  fxIn.connect(dbl1.input); dbl1.output.connect(dblMix);
  fxIn.connect(dbl2.input); dbl2.output.connect(dblMix);
  dbl1.setSemitones(0.12);
  dbl2.setSemitones(-0.15);

  // Sum to EQ
  const blend = ctx.createGain();
  tunerMix.connect(blend);
  harm3Mix.connect(blend);
  harm5Mix.connect(blend);
  octDMix.connect(blend);
  octUMix.connect(blend);
  dblMix.connect(blend);
  octD.setSemitones(-12);
  octU.setSemitones(12);
  harm3.setSemitones(4);
  harm5.setSemitones(7);

  blend.connect(deEsser);
  deEsser.connect(eqLo); eqLo.connect(eqMid); eqMid.connect(eqHi); eqHi.connect(presence);
  presence.connect(comp);

  // Reverb send
  comp.connect(reverbDry);
  comp.connect(reverb);
  reverb.connect(reverbWet);
  const reverbSum = ctx.createGain();
  reverbDry.connect(reverbSum);
  reverbWet.connect(reverbSum);

  // Delay send
  reverbSum.connect(delayDry);
  reverbSum.connect(delay);
  delay.connect(delayFb); delayFb.connect(delay);
  delay.connect(delayWet);
  const delaySum = ctx.createGain();
  delayDry.connect(delaySum);
  delayWet.connect(delaySum);

  delaySum.connect(fxOut);

  // Bypass mixer
  dryBypass.gain.value = 0;
  fxOut.connect(sumOut);
  dryBypass.connect(sumOut);

  for (const out of outputs) sumOut.connect(out);

  // ===== Pitch detection loop =====
  const fftBuf = new Float32Array(analyser.fftSize);
  let detectTimer: number | null = null;
  function pollPitch() {
    if (!_params.autotune) {
      _detected = null;
      tuner.setSemitones(0);
    } else {
      analyser.getFloatTimeDomainData(fftBuf);
      const midi = detectPitch(fftBuf, ctx.sampleRate);
      if (midi !== null) {
        const target = snapToScale(midi, _params.rootPc, _params.scale);
        const correction = target - midi;
        // Retune speed: 0 = no correction, 1 = full snap. We map smoothly.
        const amt = Math.max(0, Math.min(1, _params.retune));
        // Fast snap for hard tune (>0.85)
        const applied = correction * (amt > 0.85 ? 1 : amt);
        const cents = Math.round((midi - Math.round(midi)) * 100);
        _detected = { midi: Math.round(midi), cents };
        tuner.setSemitones(applied);
      } else {
        _detected = null;
      }
    }
    detectTimer = window.setTimeout(pollPitch, 40) as unknown as number;
  }
  pollPitch();

  function setParams(patch: Partial<VocalFxParams>) {
    _params = { ..._params, ...patch };
    const t = ctx.currentTime;
    const tau = 0.04;

    if (_params.bypass) {
      dryBypass.gain.setTargetAtTime(1, t, tau);
      fxOut.gain.setTargetAtTime(0, t, tau);
      return;
    }
    dryBypass.gain.setTargetAtTime(0, t, tau);
    fxOut.gain.setTargetAtTime(1, t, tau);

    // Formant shift on tuner
    tuner.setFormant(_params.formant);

    // Harmony levels & intervals
    harm3.setSemitones(_params.harmony3rd);
    harm5.setSemitones(_params.harmony5th);
    harm3Mix.gain.setTargetAtTime(_params.harmonyMix * 0.7, t, tau);
    harm5Mix.gain.setTargetAtTime(_params.harmonyMix * 0.55, t, tau);

    // Octaver
    octDMix.gain.setTargetAtTime(_params.octaveDown, t, tau);
    octUMix.gain.setTargetAtTime(_params.octaveUp * 0.7, t, tau);

    // Doubler
    dblMix.gain.setTargetAtTime(_params.doubler * 0.45, t, tau);

    // EQ
    eqLo.gain.setTargetAtTime(_params.eqLow, t, tau);
    eqMid.gain.setTargetAtTime(_params.eqMid, t, tau);
    eqHi.gain.setTargetAtTime(_params.eqHi, t, tau);
    presence.gain.setTargetAtTime(_params.presence * 8, t, tau);

    // De-esser (negative gain at sibilance band)
    deEsser.gain.setTargetAtTime(-_params.deEsser * 12, t, tau);

    // Compressor
    const c = _params.compress;
    comp.threshold.setTargetAtTime(-12 - c * 18, t, tau);
    comp.ratio.setTargetAtTime(2 + c * 8, t, tau);

    // Reverb
    reverbWet.gain.setTargetAtTime(_params.reverbMix, t, tau);
    reverbDry.gain.setTargetAtTime(1 - _params.reverbMix * 0.5, t, tau);
    if (Math.abs((reverb.buffer?.duration ?? 0) - (0.5 + _params.reverbSize * 3.5)) > 0.3) {
      reverb.buffer = makeImpulseResponse(ctx, 0.5 + _params.reverbSize * 3.5, 2 + _params.reverbSize * 3);
    }

    // Delay
    delay.delayTime.setTargetAtTime(0.05 + _params.delayTime * 0.75, t, tau);
    delayFb.gain.setTargetAtTime(_params.delayFb, t, tau);
    delayWet.gain.setTargetAtTime(_params.delayMix, t, tau);
    delayDry.gain.setTargetAtTime(1 - _params.delayMix * 0.4, t, tau);
  }

  setParams(_params);

  const handles: VocalChainHandles = {
    setParams,
    getDetectedNote: () => _detected,
    destroy: () => {
      if (detectTimer != null) clearTimeout(detectTimer);
      try { sumOut.disconnect(); } catch { /* noop */ }
      try { input.disconnect(); } catch { /* noop */ }
      tuner.destroy(); harm3.destroy(); harm5.destroy();
      octD.destroy(); octU.destroy(); dbl1.destroy(); dbl2.destroy();
    },
  };

  _chain = { input, outputs, handles };
  return handles;
}

export function setVocalParams(patch: Partial<VocalFxParams>) {
  _params = { ..._params, ...patch };
  if (_chain) _chain.handles.setParams(patch);
}

export function applyVocalPreset(presetId: string) {
  const p = VOCAL_FX_PRESETS.find((x) => x.id === presetId);
  if (!p) return;
  // Reset to defaults then apply patch (so unset fields revert).
  const next: VocalFxParams = { ...DEFAULT_VOCAL_FX, ...p.patch };
  setVocalParams(next);
}

export function getDetectedVocalNote() {
  return _chain?.handles.getDetectedNote() ?? null;
}

export function detachVocalChain() {
  if (_chain) {
    _chain.handles.destroy();
    _chain = null;
  }
}

export function isVocalChainAttached() {
  return _chain !== null;
}