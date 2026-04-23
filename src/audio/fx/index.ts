// FX rack: master-bus insert FX with dry/wet. Each FX is a self-contained node graph.
import { getEngine } from "../engine";

export type FxKind =
  | "off"
  | "reverb"
  | "delay"
  | "filter"
  | "flanger"
  | "phaser"
  | "bitcrusher"
  | "echo"
  | "gate"
  | "tremolo"
  | "autopan"
  | "ringmod"
  | "chorus"
  | "wahwah"
  | "lofi";

export interface FxRackHandles {
  input: GainNode;
  output: GainNode;
  dry: GainNode;
  wet: GainNode;
  fx: AudioNode | null;
  kind: FxKind;
  param1?: AudioParam | { value: number };
  param2?: AudioParam | { value: number };
  destroy: () => void;
}

function buildReverb(ctx: AudioContext): { node: AudioNode; p1: AudioParam } {
  const conv = ctx.createConvolver();
  // Generate impulse response
  const len = ctx.sampleRate * 2.5;
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = ir.getChannelData(c);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8);
    }
  }
  conv.buffer = ir;
  const post = ctx.createGain();
  post.gain.value = 0.6;
  conv.connect(post);
  return { node: wrapInOut(ctx, conv, post), p1: post.gain };
}

function wrapInOut(ctx: AudioContext, head: AudioNode, tail: AudioNode): AudioNode {
  // Returns a node that has connect/disconnect at tail; head is exposed externally via .connect
  // For our usage we just connect input → head and tail → output manually.
  void ctx;
  // return head; tail handled by caller via closure pattern below
  (head as unknown as { __tail: AudioNode }).__tail = tail;
  return head;
}

function tail(node: AudioNode): AudioNode {
  return ((node as unknown as { __tail?: AudioNode }).__tail) ?? node;
}

function buildDelay(ctx: AudioContext): { node: AudioNode; p1: AudioParam; p2: AudioParam } {
  const d = ctx.createDelay(2);
  d.delayTime.value = 0.375;
  const fb = ctx.createGain();
  fb.gain.value = 0.4;
  d.connect(fb);
  fb.connect(d);
  return { node: wrapInOut(ctx, d, d), p1: d.delayTime, p2: fb.gain };
}

function buildFilter(ctx: AudioContext): { node: AudioNode; p1: AudioParam; p2: AudioParam } {
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 1200;
  f.Q.value = 6;
  return { node: wrapInOut(ctx, f, f), p1: f.frequency, p2: f.Q };
}

function buildFlanger(ctx: AudioContext): { node: AudioNode; p1: AudioParam; p2: AudioParam } {
  const d = ctx.createDelay(0.05);
  d.delayTime.value = 0.005;
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.4;
  lfoGain.gain.value = 0.003;
  lfo.connect(lfoGain).connect(d.delayTime);
  lfo.start();
  const fb = ctx.createGain();
  fb.gain.value = 0.5;
  d.connect(fb);
  fb.connect(d);
  return { node: wrapInOut(ctx, d, d), p1: lfo.frequency, p2: fb.gain };
}

function buildPhaser(ctx: AudioContext): { node: AudioNode; p1: AudioParam; p2: AudioParam } {
  const f1 = ctx.createBiquadFilter();
  f1.type = "allpass";
  f1.frequency.value = 800;
  const f2 = ctx.createBiquadFilter();
  f2.type = "allpass";
  f2.frequency.value = 1200;
  f1.connect(f2);
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.5;
  lfoGain.gain.value = 600;
  lfo.connect(lfoGain);
  lfoGain.connect(f1.frequency);
  lfoGain.connect(f2.frequency);
  lfo.start();
  return { node: wrapInOut(ctx, f1, f2), p1: lfo.frequency, p2: lfoGain.gain };
}

function buildBitcrusher(ctx: AudioContext): { node: AudioNode; p1: { value: number }; p2: { value: number } } {
  const ws = ctx.createWaveShaper();
  const bits = { value: 8 };
  const drive = { value: 1.5 };
  const update = () => {
    const steps = Math.pow(2, bits.value);
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1024) * 2 - 1;
      const y = Math.tanh(x * drive.value);
      curve[i] = Math.round(y * steps) / steps;
    }
    ws.curve = curve;
  };
  update();
  // expose params with setter via Proxy-ish object
  const p1 = new Proxy(bits, {
    set(t, k, v) {
      if (k === "value") (t as { value: number }).value = v as number;
      update();
      return true;
    },
  });
  const p2 = new Proxy(drive, {
    set(t, k, v) {
      if (k === "value") (t as { value: number }).value = v as number;
      update();
      return true;
    },
  });
  return { node: wrapInOut(ctx, ws, ws), p1, p2 };
}

function buildEcho(ctx: AudioContext): { node: AudioNode; p1: AudioParam; p2: AudioParam } {
  return buildDelay(ctx);
}

function buildGate(ctx: AudioContext): { node: AudioNode; p1: AudioParam; p2: AudioParam } {
  const g = ctx.createGain();
  g.gain.value = 1;
  const lfo = ctx.createOscillator();
  const sh = ctx.createWaveShaper();
  // square-ish curve
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) curve[i] = i < 128 ? 0 : 1;
  sh.curve = curve;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.5;
  lfo.frequency.value = 4;
  lfo.connect(sh);
  sh.connect(lfoGain);
  lfoGain.connect(g.gain);
  lfo.start();
  return { node: wrapInOut(ctx, g, g), p1: lfo.frequency, p2: lfoGain.gain };
}

function buildTremolo(ctx: AudioContext): { node: AudioNode; p1: AudioParam; p2: AudioParam } {
  // Sine LFO modulating gain — classic tremolo (volume wobble).
  const g = ctx.createGain();
  g.gain.value = 1;
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 6;
  const depth = ctx.createGain();
  depth.gain.value = 0.5;
  lfo.connect(depth).connect(g.gain);
  lfo.start();
  return { node: wrapInOut(ctx, g, g), p1: lfo.frequency, p2: depth.gain };
}

function buildAutoPan(ctx: AudioContext): { node: AudioNode; p1: AudioParam; p2: AudioParam } {
  // Stereo auto-pan via a StereoPanner driven by a sine LFO.
  const pan = ctx.createStereoPanner();
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 1.5;
  const depth = ctx.createGain();
  depth.gain.value = 0.9;
  lfo.connect(depth).connect(pan.pan);
  lfo.start();
  return { node: wrapInOut(ctx, pan, pan), p1: lfo.frequency, p2: depth.gain };
}

function buildRingMod(ctx: AudioContext): { node: AudioNode; p1: AudioParam; p2: AudioParam } {
  // Multiply incoming signal by a sine carrier — metallic / bell-like sound.
  const g = ctx.createGain();
  g.gain.value = 0; // start silent; LFO sets it
  const car = ctx.createOscillator();
  car.type = "sine";
  car.frequency.value = 220;
  const depth = ctx.createGain();
  depth.gain.value = 1;
  car.connect(depth).connect(g.gain);
  car.start();
  return { node: wrapInOut(ctx, g, g), p1: car.frequency, p2: depth.gain };
}

function buildChorus(ctx: AudioContext): { node: AudioNode; p1: AudioParam; p2: AudioParam } {
  // Two short delays modulated by a slow LFO — gentle stereo widening.
  const splitter = ctx.createGain();
  const left = ctx.createDelay(0.05);
  left.delayTime.value = 0.022;
  const right = ctx.createDelay(0.05);
  right.delayTime.value = 0.027;
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.6;
  const depth = ctx.createGain();
  depth.gain.value = 0.004;
  lfo.connect(depth);
  depth.connect(left.delayTime);
  depth.connect(right.delayTime);
  lfo.start();
  const merger = ctx.createGain();
  splitter.connect(left).connect(merger);
  splitter.connect(right).connect(merger);
  return { node: wrapInOut(ctx, splitter, merger), p1: lfo.frequency, p2: depth.gain };
}

function buildWahWah(ctx: AudioContext): { node: AudioNode; p1: AudioParam; p2: AudioParam } {
  // Bandpass filter swept by an LFO — auto-wah.
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 800;
  f.Q.value = 8;
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 1.2;
  const depth = ctx.createGain();
  depth.gain.value = 600;
  lfo.connect(depth).connect(f.frequency);
  lfo.start();
  return { node: wrapInOut(ctx, f, f), p1: lfo.frequency, p2: depth.gain };
}

function buildLoFi(ctx: AudioContext): { node: AudioNode; p1: AudioParam; p2: AudioParam } {
  // Gentle low-pass + high-pass to mimic a vintage radio / lo-fi tape.
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 4500;
  lp.Q.value = 0.7;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 250;
  hp.Q.value = 0.7;
  lp.connect(hp);
  return { node: wrapInOut(ctx, lp, hp), p1: lp.frequency, p2: hp.frequency };
}

export function createFxRack(): FxRackHandles {
  const { ctx } = getEngine();
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  dry.gain.value = 1;
  wet.gain.value = 0;
  input.connect(dry).connect(output);

  const handles: FxRackHandles = {
    input,
    output,
    dry,
    wet,
    fx: null,
    kind: "off",
    destroy() {
      try { input.disconnect(); } catch { /* noop */ }
      try { output.disconnect(); } catch { /* noop */ }
      try { dry.disconnect(); } catch { /* noop */ }
      try { wet.disconnect(); } catch { /* noop */ }
      if (handles.fx) try { handles.fx.disconnect(); } catch { /* noop */ }
    },
  };
  return handles;
}

export function setFxKind(rack: FxRackHandles, kind: FxKind) {
  const { ctx } = getEngine();
  // disconnect previous FX path
  if (rack.fx) {
    try { rack.fx.disconnect(); } catch { /* noop */ }
    try { tail(rack.fx).disconnect(); } catch { /* noop */ }
    rack.fx = null;
  }
  try { rack.input.disconnect(rack.wet); } catch { /* noop */ }
  try { rack.wet.disconnect(); } catch { /* noop */ }

  rack.kind = kind;
  if (kind === "off") {
    return;
  }
  let built: { node: AudioNode; p1?: AudioParam | { value: number }; p2?: AudioParam | { value: number } };
  switch (kind) {
    case "reverb": built = buildReverb(ctx); break;
    case "delay":  built = buildDelay(ctx); break;
    case "filter": built = buildFilter(ctx); break;
    case "flanger": built = buildFlanger(ctx); break;
    case "phaser":  built = buildPhaser(ctx); break;
    case "bitcrusher": built = buildBitcrusher(ctx); break;
    case "echo":    built = buildEcho(ctx); break;
    case "gate":    built = buildGate(ctx); break;
    case "tremolo": built = buildTremolo(ctx); break;
    case "autopan": built = buildAutoPan(ctx); break;
    case "ringmod": built = buildRingMod(ctx); break;
    case "chorus":  built = buildChorus(ctx); break;
    case "wahwah":  built = buildWahWah(ctx); break;
    case "lofi":    built = buildLoFi(ctx); break;
    default: built = buildDelay(ctx);
  }
  rack.fx = built.node;
  rack.param1 = built.p1;
  rack.param2 = built.p2;
  rack.input.connect(built.node);
  tail(built.node).connect(rack.wet);
  rack.wet.connect(rack.output);
}

export function setFxMix(rack: FxRackHandles, wet: number) {
  const { ctx } = getEngine();
  const w = Math.max(0, Math.min(1, wet));
  rack.wet.gain.setTargetAtTime(w, ctx.currentTime, 0.01);
  rack.dry.gain.setTargetAtTime(rack.kind === "off" ? 1 : 1 - w * 0.4, ctx.currentTime, 0.01);
}

export function setFxParam(rack: FxRackHandles, which: 1 | 2, value: number) {
  const p = which === 1 ? rack.param1 : rack.param2;
  if (!p) return;
  if ("setTargetAtTime" in p) {
    const { ctx } = getEngine();
    (p as AudioParam).setTargetAtTime(value, ctx.currentTime, 0.01);
  } else {
    (p as { value: number }).value = value;
  }
}