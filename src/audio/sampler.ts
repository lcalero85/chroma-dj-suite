import { getEngine } from "./engine";

export interface SamplerSlot {
  id: number;
  bank: number;
  name: string;
  buffer: AudioBuffer | null;
  color: string;
  /** 0..1.5 — per-pad volume so samples can sit on top of the mix */
  volume: number;
  /** When true, hold-to-play loops the sample while the pad is held. */
  loop?: boolean;
}

const slots: SamplerSlot[] = [];

/** Track active one-shot sources per slot so they can be stopped. */
const activeSources = new Map<number, Set<{ src: AudioBufferSourceNode; gain: GainNode }>>();

export function initSampler(banks = 4, padsPerBank = 16) {
  if (slots.length > 0) return slots;
  const palette = ["#ff3b6b", "#ffb000", "#19e1c3", "#7c5cff", "#ff7a18", "#19a7ff", "#a3ff19", "#ff19c4"];
  for (let b = 0; b < banks; b++) {
    for (let i = 0; i < padsPerBank; i++) {
      slots.push({
        id: b * padsPerBank + i,
        bank: b,
        name: `Pad ${i + 1}`,
        buffer: null,
        color: palette[i % palette.length],
        volume: 0.85,
      });
    }
  }
  return slots;
}

export function getSlots() {
  return slots;
}

export async function loadSampleFromBlob(slotId: number, blob: Blob, name: string) {
  const { ctx } = getEngine();
  const arr = await blob.arrayBuffer();
  const buf = await ctx.decodeAudioData(arr.slice(0));
  const slot = slots.find((s) => s.id === slotId);
  if (slot) {
    slot.buffer = buf;
    slot.name = name;
  }
}

export function setSlotVolume(slotId: number, v: number) {
  const slot = slots.find((s) => s.id === slotId);
  if (slot) slot.volume = Math.max(0, Math.min(1.5, v));
}

export function setSlotColor(slotId: number, color: string) {
  const slot = slots.find((s) => s.id === slotId);
  if (slot) slot.color = color;
}

export function setSlotLoop(slotId: number, loop: boolean) {
  const slot = slots.find((s) => s.id === slotId);
  if (slot) slot.loop = loop;
}

export function triggerSlot(slotId: number, gain = 1) {
  const slot = slots.find((s) => s.id === slotId);
  if (!slot || !slot.buffer) return;
  const { ctx, master } = getEngine();
  const src = ctx.createBufferSource();
  src.buffer = slot.buffer;
  const g = ctx.createGain();
  g.gain.value = gain * slot.volume;
  src.connect(g);
  g.connect(master);
  src.start();
  let set = activeSources.get(slotId);
  if (!set) { set = new Set(); activeSources.set(slotId, set); }
  const entry = { src, gain: g };
  set.add(entry);
  src.onended = () => { set?.delete(entry); };
}

/** Start a looped playback. Returns a stop function. */
export function startSlotLoop(slotId: number, gain = 1): (() => void) | null {
  const slot = slots.find((s) => s.id === slotId);
  if (!slot || !slot.buffer) return null;
  const { ctx, master } = getEngine();
  const src = ctx.createBufferSource();
  src.buffer = slot.buffer;
  src.loop = true;
  const g = ctx.createGain();
  g.gain.value = gain * slot.volume;
  src.connect(g);
  g.connect(master);
  src.start();
  return () => {
    try {
      // Quick fade to avoid clicks
      const t = ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + 0.05);
      src.stop(t + 0.06);
    } catch { /* noop */ }
  };
}

/** Stop all currently-playing one-shot instances for a given slot. */
export function stopSlot(slotId: number) {
  const { ctx } = getEngine();
  const set = activeSources.get(slotId);
  if (!set) return;
  const t = ctx.currentTime;
  for (const { src, gain } of set) {
    try {
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.05);
      src.stop(t + 0.06);
    } catch { /* noop */ }
  }
  set.clear();
}