// High-quality microphone recorder. Taps the processed mic output (post-FX,
// post-vocal-chain) using a ScriptProcessor + WAV encoder for glitch-free
// audio. The previous MediaRecorder/Opus path produced choppy results when
// the live vocal granular pitch shifters were active; raw PCM avoids that.
import { getEngine, ensureRunning } from "./engine";

let _processor: ScriptProcessorNode | null = null;
let _silentSink: GainNode | null = null;
let _tap: GainNode | null = null;
let _leftChunks: Float32Array[] = [];
let _rightChunks: Float32Array[] = [];
let _sampleRate = 44100;
let _active = false;
let _startedAt = 0;

function mergeChunks(chunks: Float32Array[]) {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) { merged.set(c, offset); offset += c.length; }
  return merged;
}

function encodeWav(left: Float32Array, right: Float32Array, rate: number): Blob {
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
  if (_processor) { try { _processor.disconnect(); } catch { /* noop */ } }
  if (_silentSink) { try { _silentSink.disconnect(); } catch { /* noop */ } }
  if (_tap) { try { _tap.disconnect(); } catch { /* noop */ } }
  _processor = null;
  _silentSink = null;
  _tap = null;
  _active = false;
}

export async function startMicRecording(): Promise<boolean> {
  if (_active) return true;
  await ensureRunning();
  const { ctx, micDuck } = getEngine();
  _sampleRate = ctx.sampleRate;
  _leftChunks = [];
  _rightChunks = [];

  // Dedicated tap so we can disconnect cleanly without affecting other graph
  // connections from micDuck (e.g. master, recordTap, sink).
  const tap = ctx.createGain();
  tap.gain.value = 1;
  micDuck.connect(tap);

  // ScriptProcessor must reach destination to stay alive; route through a
  // silent gain so we don't double the mic in the speakers.
  const node = ctx.createScriptProcessor(4096, 2, 2);
  const sink = ctx.createGain();
  sink.gain.value = 0;

  node.onaudioprocess = (event) => {
    if (!_active) return;
    const input = event.inputBuffer;
    const left = new Float32Array(input.getChannelData(0));
    const right = input.numberOfChannels > 1
      ? new Float32Array(input.getChannelData(1))
      : new Float32Array(left);
    _leftChunks.push(left);
    _rightChunks.push(right);
  };

  tap.connect(node);
  node.connect(sink);
  sink.connect(ctx.destination);

  _tap = tap;
  _processor = node;
  _silentSink = sink;
  _active = true;
  _startedAt = Date.now();
  return true;
}

export interface MicRecordingResult {
  blob: Blob;
  url: string;
  filename: string;
  durationMs: number;
  mime: string;
}

export async function stopMicRecording(): Promise<MicRecordingResult | null> {
  if (!_active) return null;
  const durationMs = Date.now() - _startedAt;
  _active = false;

  // Stop feeding chunks before encoding.
  if (_tap && _processor) { try { _tap.disconnect(_processor); } catch { /* noop */ } }

  const left = mergeChunks(_leftChunks);
  const right = mergeChunks(_rightChunks);
  cleanup();
  _leftChunks = [];
  _rightChunks = [];

  const blob = encodeWav(left, right, _sampleRate);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `mic-recording-${stamp}.wav`;
  const url = URL.createObjectURL(blob);
  return { blob, url, filename, durationMs, mime: "audio/wav" };
}

export function isMicRecording(): boolean {
  return _active;
}