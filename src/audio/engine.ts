// Audio engine singleton: master bus, limiter, recorder tap, cue bus.
// All decks/sampler/fx route through the master bus.

let _ctx: AudioContext | null = null;
let _master: GainNode | null = null;
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

export interface EngineHandles {
  ctx: AudioContext;
  master: GainNode;
  limiter: DynamicsCompressorNode;
  masterAnalyser: AnalyserNode;
  cueBus: GainNode;
  cueAnalyser: AnalyserNode;
  recorderDest: MediaStreamAudioDestinationNode;
  recordTap: GainNode;
  micGain: GainNode;
  micDuck: GainNode;
}

export function getEngine(): EngineHandles {
  if (_ctx && _master && _limiter && _masterAnalyser && _cueBus && _cueAnalyser && _recorderDest && _recordTap && _micGain && _micDuck) {
    return {
      ctx: _ctx,
      master: _master,
      limiter: _limiter,
      masterAnalyser: _masterAnalyser,
      cueBus: _cueBus,
      cueAnalyser: _cueAnalyser,
      recorderDest: _recorderDest,
      recordTap: _recordTap,
      micGain: _micGain,
      micDuck: _micDuck,
    };
  }
  if (typeof window === "undefined") {
    // SSR guard: throw a typed error that callers can catch, or rely on
    // the mounted-gate in routes/index.tsx to skip rendering audio components.
    throw new Error("AudioEngine not available during SSR");
  }
  const Ctx =
    (window as unknown as { AudioContext: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  _ctx = new Ctx({ latencyHint: "interactive", sampleRate: 44100 });

  _master = _ctx.createGain();
  _master.gain.value = 0.85;

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

  _master.connect(_limiter);
  _limiter.connect(_masterAnalyser);
  _masterAnalyser.connect(_ctx.destination);
  _masterAnalyser.connect(_recorderDest);

  _cueBus = _ctx.createGain();
  _cueBus.gain.value = 0;
  _cueAnalyser = _ctx.createAnalyser();
  _cueAnalyser.fftSize = 512;
  _cueBus.connect(_cueAnalyser);
  // Cue bus is silent on speakers in this v1 (no headphone routing); analyser only for VU.

  return {
    ctx: _ctx,
    master: _master,
    limiter: _limiter,
    masterAnalyser: _masterAnalyser,
    cueBus: _cueBus,
    cueAnalyser: _cueAnalyser,
    recorderDest: _recorderDest,
  };
}

export async function ensureRunning() {
  const { ctx } = getEngine();
  if (ctx.state !== "running") {
    try {
      await ctx.resume();
    } catch {
      /* user gesture pending */
    }
  }
  return ctx;
}

export function setMasterVolume(v: number) {
  const { master, ctx } = getEngine();
  master.gain.setTargetAtTime(Math.max(0, Math.min(1.2, v)), ctx.currentTime, 0.01);
}

export function setLimiter(enabled: boolean) {
  const { ctx, master, limiter, masterAnalyser, recorderDest } = getEngine();
  try {
    master.disconnect();
    limiter.disconnect();
    masterAnalyser.disconnect();
  } catch {
    /* noop */
  }
  if (enabled) {
    master.connect(limiter);
    limiter.connect(masterAnalyser);
  } else {
    master.connect(masterAnalyser);
  }
  masterAnalyser.connect(ctx.destination);
  masterAnalyser.connect(recorderDest);
}