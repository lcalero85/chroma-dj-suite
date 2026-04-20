import { getEngine } from "./engine";

export interface SamplerSlot {
  id: number;
  bank: number;
  name: string;
  buffer: AudioBuffer | null;
  color: string;
}

const slots: SamplerSlot[] = [];

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

export function triggerSlot(slotId: number, gain = 1) {
  const slot = slots.find((s) => s.id === slotId);
  if (!slot || !slot.buffer) return;
  const { ctx, master } = getEngine();
  const src = ctx.createBufferSource();
  src.buffer = slot.buffer;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g);
  g.connect(master);
  src.start();
}