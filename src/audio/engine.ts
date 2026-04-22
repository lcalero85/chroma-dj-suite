// Audio engine singleton: master bus, limiter, recorder tap, cue bus,
// microphone chain with FX presets for voice-over.

let _ctx: AudioContext | null = null;
let _master: GainNode | null = null;
let _masterDuck: GainNode | null = null;
let _limiter: DynamicsCompressorNode | null = null;
let _masterAnalyser: AnalyserNode | null = null;
let _cueBus: GainNode | null = null;
let _cueAnalyser: AnalyserNode | null = null;
let _recorderDest: MediaStreamAudioDestinationNode | null = null;
let _recordTap: GainNode | null = null;
let _micGain: GainNode | null = null;
let _micDuck: GainNode | null = null;
let _micSource: MediaStreamAudioSourceNode | null = null;
let _micStream: MediaStream | null = null;
let _micAnalyser: AnalyserNode | null = null;

// Web monitoring (default browser output) is on by default. When false, the
// app routes ONLY through the selected output sink (e.g. an external V8 card)
// via a hidden <audio> element bound to a MediaStreamDestination.
let _webMonitoring = true;
let _sinkAudioEl: HTMLAudioElement | null = null;
let _sinkStreamDest: MediaStreamAudioDestinationNode | null = null;
let _currentSinkId = "";

// Mic FX chain: micGain -> micFxIn -> [hp -> peak -> shaperBus -> delayBus] -> micFxOut -> micDuck
let _micFxIn: GainNode | null = null;
let _micFxOut: GainNode | null = null;
let _micHp: BiquadFilterNode | null = null;
let _micPeak: BiquadFilterNode | null = null;
let _micShaper: WaveShaperNode | null = null;
let _micShaperWet: GainNode | null = null;
let _micShaperDry: GainNode | null = null;
let _micShaperSum: GainNode | null = null;
let _micDelay: DelayNode | null = null;
let _micDelayFb: GainNode | null = null;
let _micDelayWet: GainNode | null = null;
let _micDelayDry: GainNode | null = null;
let _micDelaySum: GainNode | null = null;

export interface EngineHandles {
  ctx: AudioContext;
  master: GainNode;
  masterDuck: GainNode;
  limiter: DynamicsCompressorNode;
  masterAnalyser: AnalyserNode;
  cueBus: GainNode;
  cueAnalyser: AnalyserNode;
  recorderDest: MediaStreamAudioDestinationNode;
  recordTap: GainNode;
  micGain: GainNode;
  micDuck: GainNode;
  micAnalyser: AnalyserNode;
}

const safe = (n: number, fb = 0) => (Number.isFinite(n) ? n : fb);

function makeShaperCurve(amount: number) {
  const k = Math.max(0, Math.min(1, amount)) * 100;
  const samples = 1024;
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

export function getEngine(): EngineHandles {
  if (
    _ctx && _master && _masterDuck && _limiter && _masterAnalyser &&
    _cueBus && _cueAnalyser && _recorderDest && _recordTap &&
    _micGain && _micDuck && _micAnalyser
  ) {
    return {
      ctx: _ctx,
      master: _master,
      masterDuck: _masterDuck,
      limiter: _limiter,
      masterAnalyser: _masterAnalyser,
      cueBus: _cueBus,
      cueAnalyser: _cueAnalyser,
      recorderDest: _recorderDest,
      recordTap: _recordTap,
      micGain: _micGain,
      micDuck: _micDuck,
      micAnalyser: _micAnalyser,
    };
  }
  if (typeof window === "undefined") {
    throw new Error("AudioEngine not available during SSR");
  }
  const Ctx =
    (window as unknown as { AudioContext: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  _ctx = new Ctx({ latencyHint: "interactive", sampleRate: 44100 });

  _master = _ctx.createGain();
  _master.gain.value = 0.85;
  _masterDuck = _ctx.createGain();
  _masterDuck.gain.value = 1;

  _limiter = _ctx.createDynamicsCompressor();
  _limiter.threshold.value = -1;
  _limiter.knee.value = 0;
  _limiter.ratio.value = 20;
  _limiter.attack.value = 0.003;
  _limiter.release.value = 0.05;

  _masterAnalyser = _ctx.createAnalyser();
  _masterAnalyser.fftSize = 1024;
  _masterAnalyser.smoothingTimeConstant = 0.6;

  _recorderDest = _ctx.createMediaStreamDestination();
  // recordTap is a real audio Gain that sums master + mic; the recorder's
  // ScriptProcessor reads from this node directly (no MediaStream round-trip).
  _recordTap = _ctx.createGain();
  _recordTap.gain.value = 1;

  // ===== Mic chain (voice-over) =====
  _micGain = _ctx.createGain();
  _micGain.gain.value = 0; // off until enabled
  _micDuck = _ctx.createGain();
  _micDuck.gain.value = 1;
  _micAnalyser = _ctx.createAnalyser();
  _micAnalyser.fftSize = 512;

  // FX chain pieces
  _micFxIn = _ctx.createGain();
  _micFxOut = _ctx.createGain();
  _micHp = _ctx.createBiquadFilter();
  _micHp.type = "highpass";
  _micHp.frequency.value = 80;
  _micHp.Q.value = 0.7;
  _micPeak = _ctx.createBiquadFilter();
  _micPeak.type = "peaking";
  _micPeak.frequency.value = 2200;
  _micPeak.Q.value = 1;
  _micPeak.gain.value = 0;

  // Shaper bus (parallel dry/wet)
  _micShaper = _ctx.createWaveShaper();
  _micShaper.curve = makeShaperCurve(0);
  _micShaper.oversample = "2x";
  _micShaperDry = _ctx.createGain();
  _micShaperDry.gain.value = 1;
  _micShaperWet = _ctx.createGain();
  _micShaperWet.gain.value = 0;
  _micShaperSum = _ctx.createGain();

  // Delay bus (parallel dry/wet)
  _micDelay = _ctx.createDelay(2);
  _micDelay.delayTime.value = 0.25;
  _micDelayFb = _ctx.createGain();
  _micDelayFb.gain.value = 0;
  _micDelayDry = _ctx.createGain();
  _micDelayDry.gain.value = 1;
  _micDelayWet = _ctx.createGain();
  _micDelayWet.gain.value = 0;
  _micDelaySum = _ctx.createGain();

  // Wire mic chain
  _micGain.connect(_micFxIn);
  _micFxIn.connect(_micHp);
  _micHp.connect(_micPeak);

  // Shaper parallel
  _micPeak.connect(_micShaperDry);
  _micPeak.connect(_micShaper);
  _micShaper.connect(_micShaperWet);
  _micShaperDry.connect(_micShaperSum);
  _micShaperWet.connect(_micShaperSum);

  // Delay parallel
  _micShaperSum.connect(_micDelayDry);
  _micShaperSum.connect(_micDelay);
  _micDelay.connect(_micDelayWet);
  _micDelay.connect(_micDelayFb);
  _micDelayFb.connect(_micDelay);
  _micDelayDry.connect(_micDelaySum);
  _micDelayWet.connect(_micDelaySum);

  _micDelaySum.connect(_micFxOut);
  _micFxOut.connect(_micDuck);
  _micFxOut.connect(_micAnalyser);

  // ===== Master routing =====
  _master.connect(_masterDuck);
  _masterDuck.connect(_limiter);
  _limiter.connect(_masterAnalyser);
  _masterAnalyser.connect(_ctx.destination);

  // Record tap: master(post-limiter) + mic(post-FX) -> recordTap (audible silently to keep ScriptProcessor alive isn't needed; recorder will pull data directly)
  _limiter.connect(_recordTap);
  _micDuck.connect(_recordTap);
  // Also send mic to speakers
  _micDuck.connect(_ctx.destination);
  // Also keep MediaStream destination available (legacy / future use)
  _recordTap.connect(_recorderDest);

  // Sink (custom output device) tap: same content as ctx.destination, but routed
  // to a hidden <audio> element so we can call setSinkId() to send audio to a
  // specific output (e.g. Behringer V8 USB card).
  _sinkStreamDest = _ctx.createMediaStreamDestination();
  _masterAnalyser.connect(_sinkStreamDest);
  _micDuck.connect(_sinkStreamDest);

  _cueBus = _ctx.createGain();
  _cueBus.gain.value = 0;
  _cueAnalyser = _ctx.createAnalyser();
  _cueAnalyser.fftSize = 512;
  _cueBus.connect(_cueAnalyser);

  return {
    ctx: _ctx,
    master: _master,
    masterDuck: _masterDuck,
    limiter: _limiter,
    masterAnalyser: _masterAnalyser,
    cueBus: _cueBus,
    cueAnalyser: _cueAnalyser,
    recorderDest: _recorderDest,
    recordTap: _recordTap,
    micGain: _micGain,
    micDuck: _micDuck,
    micAnalyser: _micAnalyser,
  };
}

export async function ensureRunning() {
  const { ctx } = getEngine();
  if (ctx.state !== "running") {
    try { await ctx.resume(); } catch { /* user gesture pending */ }
  }
  return ctx;
}

export function setMasterVolume(v: number) {
  const { master, ctx } = getEngine();
  master.gain.setTargetAtTime(safe(Math.max(0, Math.min(1.2, v)), 0.85), ctx.currentTime, 0.01);
}

export function setLimiter(enabled: boolean) {
  const { ctx, masterDuck, limiter, masterAnalyser, recordTap, recorderDest, micDuck } = getEngine();
  try {
    masterDuck.disconnect();
    limiter.disconnect();
    masterAnalyser.disconnect();
    recordTap.disconnect();
  } catch { /* noop */ }
  if (enabled) {
    masterDuck.connect(limiter);
    limiter.connect(masterAnalyser);
    limiter.connect(recordTap);
  } else {
    masterDuck.connect(masterAnalyser);
    masterDuck.connect(recordTap);
  }
  if (_webMonitoring) masterAnalyser.connect(ctx.destination);
  if (_sinkStreamDest) masterAnalyser.connect(_sinkStreamDest);
  // Reconnect mic into recordTap (was lost on micDuck.disconnect? not called here, but be safe)
  try { micDuck.connect(recordTap); } catch { /* already connected */ }
  recordTap.connect(recorderDest);
}

// ===== Output device routing =====
/** Enable/disable browser default monitoring. When disabled, only the
 *  selected sink device (e.g. V8) outputs audio. */
export function setWebMonitoring(on: boolean) {
  const { masterAnalyser, micDuck, ctx } = getEngine();
  _webMonitoring = on;
  try { masterAnalyser.disconnect(ctx.destination); } catch { /* noop */ }
  try { micDuck.disconnect(ctx.destination); } catch { /* noop */ }
  if (on) {
    masterAnalyser.connect(ctx.destination);
    micDuck.connect(ctx.destination);
  }
}

/** Route audio to the given output device id ("" or "default" = system default).
 *  Uses a hidden <audio> element + setSinkId. Returns true on success. */
export async function setAudioOutputDevice(deviceId: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  getEngine(); // ensure engine and _sinkStreamDest exist
  if (!_sinkStreamDest) return false;
  if (!_sinkAudioEl) {
    _sinkAudioEl = document.createElement("audio");
    _sinkAudioEl.autoplay = true;
    (_sinkAudioEl as HTMLAudioElement).srcObject = _sinkStreamDest.stream;
    _sinkAudioEl.style.display = "none";
    document.body.appendChild(_sinkAudioEl);
  }
  try {
    const el = _sinkAudioEl as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
    if (typeof el.setSinkId !== "function") return false;
    await el.setSinkId(deviceId || "default");
    _currentSinkId = deviceId;
    try { await _sinkAudioEl.play(); } catch { /* user gesture pending */ }
    return true;
  } catch (e) {
    console.warn("setSinkId failed", e);
    return false;
  }
}

export function getCurrentSinkId() { return _currentSinkId; }
export function isWebMonitoringEnabled() { return _webMonitoring; }

// ===== Microphone (voice-over) =====
export interface MicOptions {
  deviceId?: string;
  noiseSuppression?: boolean;
  echoCancellation?: boolean;
  autoGainControl?: boolean;
}

export async function enableMic(opts: MicOptions = {}): Promise<boolean> {
  const { ctx, micGain } = getEngine();
  if (_micStream) {
    // Already running — if caller wants to switch device, restart.
    if (opts.deviceId !== undefined) disableMic();
    else return true;
  }
  // Build a list of progressively-relaxed constraint attempts. If a saved
  // deviceId no longer exists (or sample rate / processing flags aren't
 // supported), getUserMedia throws OverconstrainedError. We retry with
  // softer constraints before giving up.
  const attempts: MediaTrackConstraints[] = [];
  const base: MediaTrackConstraints = {
    echoCancellation: opts.echoCancellation ?? true,
    noiseSuppression: opts.noiseSuppression ?? true,
    autoGainControl: opts.autoGainControl ?? false,
  };
  if (opts.deviceId) {
    // 1) exact device with processing
    attempts.push({ ...base, deviceId: { exact: opts.deviceId } });
    // 2) preferred device (ideal) with processing — falls back to default if missing
    attempts.push({ ...base, deviceId: { ideal: opts.deviceId } });
  }
  // 3) processing flags only
  attempts.push({ ...base });
  // 4) bare minimum — just audio:true
  attempts.push({});

  let lastErr: unknown = null;
  for (const audio of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: Object.keys(audio).length ? audio : true,
      });
      _micStream = stream;
      _micSource = ctx.createMediaStreamSource(stream);
      _micSource.connect(micGain);
      return true;
    } catch (e) {
      lastErr = e;
      const name = (e as DOMException)?.name;
      // Only retry on constraint-related failures. Permission errors are terminal.
      if (name !== "OverconstrainedError" && name !== "NotFoundError" && name !== "NotReadableError") {
        break;
      }
    }
  }
  console.error("Mic error", lastErr);
  return false;
}

/** List available audio input/output devices. Requires prior mic permission for full labels. */
export async function listAudioDevices(): Promise<{ inputs: MediaDeviceInfo[]; outputs: MediaDeviceInfo[] }> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
    return { inputs: [], outputs: [] };
  }
  const all = await navigator.mediaDevices.enumerateDevices();
  return {
    inputs: all.filter((d) => d.kind === "audioinput"),
    outputs: all.filter((d) => d.kind === "audiooutput"),
  };
}

export function disableMic() {
  const { micGain, ctx } = getEngine();
  micGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
  if (_micSource) {
    try { _micSource.disconnect(); } catch { /* noop */ }
    _micSource = null;
  }
  if (_micStream) {
    _micStream.getTracks().forEach((t) => t.stop());
    _micStream = null;
  }
}

export function setMicLevel(v: number) {
  const { micGain, ctx } = getEngine();
  micGain.gain.setTargetAtTime(safe(Math.max(0, Math.min(2, v)), 1), ctx.currentTime, 0.02);
}

export function setMicDuck(amount: number) {
  const { ctx, masterDuck } = getEngine();
  const k = 1 - safe(Math.max(0, Math.min(0.9, amount)), 0);
  masterDuck.gain.setTargetAtTime(k, ctx.currentTime, 0.08);
}

// ===== Voice-over presets =====
export interface VoicePreset {
  id: string;
  label: string;
  hp: number;       // highpass freq
  peakF: number;    // presence freq
  peakG: number;    // presence gain (dB)
  shaperAmt: number;// 0..1
  shaperWet: number;// 0..1
  delayTime: number;// seconds
  delayFb: number;  // 0..0.9
  delayWet: number; // 0..1
}

export const VOICE_PRESETS: VoicePreset[] = [
  { id: "off",       label: "Sin efecto",   hp: 80,  peakF: 2200, peakG: 0,  shaperAmt: 0,    shaperWet: 0,    delayTime: 0.25, delayFb: 0,    delayWet: 0 },
  { id: "radio",     label: "Locutor radio",hp: 200, peakF: 2800, peakG: 6,  shaperAmt: 0.15, shaperWet: 0.25, delayTime: 0.05, delayFb: 0,    delayWet: 0 },
  { id: "warm",      label: "Cálido club",  hp: 90,  peakF: 1800, peakG: 3,  shaperAmt: 0.05, shaperWet: 0.15, delayTime: 0.08, delayFb: 0,    delayWet: 0 },
  { id: "telephone", label: "Teléfono",     hp: 600, peakF: 1500, peakG: 8,  shaperAmt: 0.4,  shaperWet: 0.6,  delayTime: 0.02, delayFb: 0,    delayWet: 0 },
  { id: "megaphone", label: "Megáfono",     hp: 500, peakF: 2400, peakG: 10, shaperAmt: 0.7,  shaperWet: 0.8,  delayTime: 0.05, delayFb: 0,    delayWet: 0 },
  { id: "echo",      label: "Eco salón",    hp: 80,  peakF: 2200, peakG: 2,  shaperAmt: 0,    shaperWet: 0,    delayTime: 0.3,  delayFb: 0.4,  delayWet: 0.45 },
  { id: "doubler",   label: "Doblador",     hp: 80,  peakF: 2400, peakG: 3,  shaperAmt: 0,    shaperWet: 0,    delayTime: 0.04, delayFb: 0.1,  delayWet: 0.5 },
  { id: "robot",     label: "Robot",        hp: 200, peakF: 1200, peakG: 4,  shaperAmt: 0.85, shaperWet: 0.9,  delayTime: 0.012,delayFb: 0.5,  delayWet: 0.4 },
  { id: "stadium",   label: "Estadio",      hp: 120, peakF: 2400, peakG: 4,  shaperAmt: 0,    shaperWet: 0,    delayTime: 0.45, delayFb: 0.55, delayWet: 0.55 },
  { id: "whisper",   label: "Susurro",      hp: 400, peakF: 5000, peakG: 8,  shaperAmt: 0,    shaperWet: 0,    delayTime: 0.04, delayFb: 0.05, delayWet: 0.2 },
  { id: "monster",   label: "Monstruo",     hp: 60,  peakF: 600,  peakG: 10, shaperAmt: 0.95, shaperWet: 0.85, delayTime: 0.08, delayFb: 0.3,  delayWet: 0.3 },
];

export function applyVoicePreset(p: VoicePreset) {
  if (!_micHp || !_micPeak || !_micShaper || !_micShaperWet || !_micShaperDry || !_micDelay || !_micDelayFb || !_micDelayWet || !_micDelayDry || !_ctx) return;
  const t = _ctx.currentTime;
  const tau = 0.04;
  _micHp.frequency.setTargetAtTime(safe(p.hp, 80), t, tau);
  _micPeak.frequency.setTargetAtTime(safe(p.peakF, 2200), t, tau);
  _micPeak.gain.setTargetAtTime(safe(p.peakG, 0), t, tau);
  _micShaper.curve = makeShaperCurve(safe(p.shaperAmt, 0));
  _micShaperWet.gain.setTargetAtTime(safe(p.shaperWet, 0), t, tau);
  _micShaperDry.gain.setTargetAtTime(1 - safe(p.shaperWet, 0) * 0.5, t, tau);
  _micDelay.delayTime.setTargetAtTime(safe(p.delayTime, 0.25), t, tau);
  _micDelayFb.gain.setTargetAtTime(safe(p.delayFb, 0), t, tau);
  _micDelayWet.gain.setTargetAtTime(safe(p.delayWet, 0), t, tau);
  _micDelayDry.gain.setTargetAtTime(1, t, tau);
}

export const useAppMasterRef: { current: number | null } = { current: null };

// ===== Vocal FX chain insertion (autotune panel) =====
import {
  attachVocalChain,
  detachVocalChain,
  type VocalChainHandles,
} from "./vocalFx";

let _vocalChain: VocalChainHandles | null = null;

/**
 * Insert the live-vocal FX chain between mic FX output and mic duck.
 * Called by the controller when the user opens the Live Vocal panel.
 */
export function enableVocalChain(): VocalChainHandles | null {
  const { ctx, micDuck } = getEngine();
  if (_vocalChain || !_micFxOut) return _vocalChain;
  try { _micFxOut.disconnect(); } catch { /* noop */ }
  // Reconnect analyser tap so meters keep working
  if (_micAnalyser) _micFxOut.connect(_micAnalyser);
  _vocalChain = attachVocalChain(ctx, _micFxOut, [micDuck]);
  return _vocalChain;
}

export function disableVocalChain() {
  const { micDuck } = getEngine();
  if (!_vocalChain) return;
  detachVocalChain();
  _vocalChain = null;
  if (_micFxOut) {
    try { _micFxOut.disconnect(); } catch { /* noop */ }
    if (_micAnalyser) _micFxOut.connect(_micAnalyser);
    _micFxOut.connect(micDuck);
  }
}

export function isVocalChainEnabled() {
  return _vocalChain !== null;
}
