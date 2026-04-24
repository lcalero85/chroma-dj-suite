import { Mp3Encoder } from "@breezystack/lamejs";

export type Mp3Quality = "low" | "medium" | "high";

const KBPS: Record<Mp3Quality, number> = {
  low: 128,
  medium: 192,
  high: 320,
};

/**
 * Decode any audio Blob (e.g. WAV from the recorder) and re-encode as MP3.
 * Returns a new Blob with mime "audio/mpeg".
 */
export async function encodeBlobToMp3(
  src: Blob,
  quality: Mp3Quality = "medium",
  onProgress?: (ratio: number) => void,
): Promise<Blob> {
  const arrayBuf = await src.arrayBuffer();
  // Web Audio decoding works on a copy of the buffer.
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  let audioBuf: AudioBuffer;
  try {
    audioBuf = await ctx.decodeAudioData(arrayBuf.slice(0));
  } finally {
    try { await ctx.close(); } catch { /* noop */ }
  }

  const channels = Math.min(2, audioBuf.numberOfChannels);
  const sampleRate = audioBuf.sampleRate;
  const kbps = KBPS[quality];
  const encoder = new Mp3Encoder(channels, sampleRate, kbps);

  const left = floatTo16(audioBuf.getChannelData(0));
  const right = channels > 1 ? floatTo16(audioBuf.getChannelData(1)) : null;

  const blockSize = 1152;
  const total = left.length;
  const parts: Uint8Array[] = [];

  for (let i = 0; i < total; i += blockSize) {
    const l = left.subarray(i, i + blockSize);
    const r = right ? right.subarray(i, i + blockSize) : null;
    const chunk = r ? encoder.encodeBuffer(l, r) : encoder.encodeBuffer(l);
    if (chunk.length > 0) parts.push(chunk);
    if (onProgress && (i & 0xffff) === 0) onProgress(Math.min(1, i / total));
    // Yield occasionally to keep UI responsive on long recordings.
    if (i % (blockSize * 256) === 0) await new Promise((r) => setTimeout(r, 0));
  }
  const tail = encoder.flush();
  if (tail.length > 0) parts.push(tail);
  if (onProgress) onProgress(1);

  return new Blob(parts as BlobPart[], { type: "audio/mpeg" });
}

function floatTo16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i] ?? 0));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export function mp3Bitrate(quality: Mp3Quality): number {
  return KBPS[quality];
}