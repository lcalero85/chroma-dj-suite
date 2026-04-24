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
  /** Choke group id (0 = none). Pads sharing the same non-zero group cut each other off when one fires. */
  chokeGroup?: number;
  /** When true, the pad is muted (cannot be heard even if triggered). */
  mute?: boolean;
  /** When true, only soloed pads in the bank play; non-soloed pads are silenced. */
  solo?: boolean;
}

const slots: SamplerSlot[] = [];

/** Track active one-shot sources per slot so they can be stopped. */
const activeSources = new Map<number, Set<{ src: AudioBufferSourceNode; gain: GainNode }>>();
/** Track active loop stop-fns per slot for choke-group cancellation. */
const activeLoopStop = new Map<number, () => void>();

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
        chokeGroup: 0,
        mute: false,
        solo: false,
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

export function setSlotChokeGroup(slotId: number, group: number) {
  const slot = slots.find((s) => s.id === slotId);
  if (slot) slot.chokeGroup = Math.max(0, Math.min(8, Math.floor(group)));
}

export function setSlotMute(slotId: number, mute: boolean) {
  const slot = slots.find((s) => s.id === slotId);
  if (slot) slot.mute = mute;
  if (mute) stopSlot(slotId);
}

export function setSlotSolo(slotId: number, solo: boolean) {
  const slot = slots.find((s) => s.id === slotId);
  if (slot) slot.solo = solo;
}

/** Returns true when this slot is allowed to be heard given current bank mute/solo state. */
function isAudible(slot: SamplerSlot): boolean {
  if (slot.mute) return false;
  const anySolo = slots.some((s) => s.bank === slot.bank && s.solo);
  if (anySolo && !slot.solo) return false;
  return true;
}

/** Stop all sounds in the same non-zero choke group except the firing slot. */
function applyChoke(firing: SamplerSlot) {
  const grp = firing.chokeGroup ?? 0;
  if (!grp) return;
  for (const s of slots) {
    if (s.id === firing.id) continue;
    if ((s.chokeGroup ?? 0) !== grp) continue;
    stopSlot(s.id);
    const stop = activeLoopStop.get(s.id);
    if (stop) { stop(); activeLoopStop.delete(s.id); }
  }
}

export function triggerSlot(slotId: number, gain = 1) {
  const slot = slots.find((s) => s.id === slotId);
  if (!slot || !slot.buffer) return;
  if (!isAudible(slot)) return;
  applyChoke(slot);
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
  if (!isAudible(slot)) return null;
  applyChoke(slot);
  const { ctx, master } = getEngine();
  const src = ctx.createBufferSource();
  src.buffer = slot.buffer;
  src.loop = true;
  const g = ctx.createGain();
  g.gain.value = gain * slot.volume;
  src.connect(g);
  g.connect(master);
  src.start();
  const stop = () => {
    try {
      // Quick fade to avoid clicks
      const t = ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + 0.05);
      src.stop(t + 0.06);
    } catch { /* noop */ }
    if (activeLoopStop.get(slotId) === stop) activeLoopStop.delete(slotId);
  };
  activeLoopStop.set(slotId, stop);
  return stop;
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