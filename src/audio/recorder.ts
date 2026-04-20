import { ensureRunning, getEngine } from "./engine";

let processor: ScriptProcessorNode | null = null;
let monitor: GainNode | null = null;
let leftChunks: Float32Array[] = [];
let rightChunks: Float32Array[] = [];
let startTs = 0;
let sampleRate = 44100;
let active = false;

function mergeChunks(chunks: Float32Array[]) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function encodeWav(left: Float32Array, right: Float32Array, rate: number) {
  const frames = Math.min(left.length, right.length);
  const bytesPerSample = 2;
  const channels = 2;
  const blockAlign = channels * bytesPerSample;
  const dataLen = frames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataLen);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLen, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataLen, true);

  let offset = 44;
  for (let i = 0; i < frames; i++) {
    const l = Math.max(-1, Math.min(1, left[i] ?? 0));
    const r = Math.max(-1, Math.min(1, right[i] ?? 0));
    view.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7fff, true);
    view.setInt16(offset + 2, r < 0 ? r * 0x8000 : r * 0x7fff, true);
    offset += blockAlign;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function cleanup() {
  if (processor) {
    try { processor.disconnect(); } catch { /* noop */ }
  }
  if (monitor) {
    try { monitor.disconnect(); } catch { /* noop */ }
  }
  processor = null;
  monitor = null;
  active = false;
}

export async function startRecording(): Promise<void> {
  await ensureRunning();
  const { ctx, recordTap } = getEngine();
  if (active) return;

  leftChunks = [];
  rightChunks = [];
  sampleRate = ctx.sampleRate;

  // ScriptProcessor must be connected to destination to be alive,
  // but we route it through a silent gain so it doesn't double the audio.
  const node = ctx.createScriptProcessor(4096, 2, 2);
  const sink = ctx.createGain();
  sink.gain.value = 0;

  node.onaudioprocess = (event) => {
    if (!active) return;
    const input = event.inputBuffer;
    const left = new Float32Array(input.getChannelData(0));
    const right = input.numberOfChannels > 1 ? new Float32Array(input.getChannelData(1)) : new Float32Array(left);
    leftChunks.push(left);
    rightChunks.push(right);
  };

  // Real audio routing: recordTap (master+mic) -> ScriptProcessor -> silent sink -> destination
  recordTap.connect(node);
  node.connect(sink);
  sink.connect(ctx.destination);

  processor = node;
  monitor = sink;
  active = true;
  startTs = Date.now();
}

export function isRecording() {
  return active;
}

export function recordingElapsed() {
  return active ? (Date.now() - startTs) / 1000 : 0;
}

export async function stopRecording(): Promise<{ blob: Blob; mime: string; duration: number } | null> {
  if (!active) return null;
  const duration = (Date.now() - startTs) / 1000;
  active = false;

  // Disconnect tap from processor first so no more chunks come in
  try {
    const { recordTap } = getEngine();
    recordTap.disconnect(processor!);
  } catch { /* noop */ }

  const left = mergeChunks(leftChunks);
  const right = mergeChunks(rightChunks);
  cleanup();
  leftChunks = [];
  rightChunks = [];

  const blob = encodeWav(left, right, sampleRate);
  return { blob, mime: "audio/wav", duration };
}
