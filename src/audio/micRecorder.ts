// High-quality microphone recorder. Taps the processed mic output (post-FX,
// post-vocal-chain) so the saved file matches what the audience hears.
import { getEngine, ensureRunning } from "./engine";

let _dest: MediaStreamAudioDestinationNode | null = null;
let _recorder: MediaRecorder | null = null;
let _chunks: BlobPart[] = [];
let _mime = "";
let _startedAt = 0;

function pickMime(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const m of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

function ensureDest(): MediaStreamAudioDestinationNode {
  const eng = getEngine();
  if (!_dest) {
    _dest = eng.ctx.createMediaStreamDestination();
    // Tap the mic post-FX/vocal-chain (micDuck is the final mic node going to master).
    eng.micDuck.connect(_dest);
  }
  return _dest;
}

export async function startMicRecording(): Promise<boolean> {
  if (_recorder && _recorder.state === "recording") return true;
  await ensureRunning();
  const dest = ensureDest();
  _mime = pickMime();
  _chunks = [];
  try {
    _recorder = _mime
      ? new MediaRecorder(dest.stream, { mimeType: _mime, audioBitsPerSecond: 256000 })
      : new MediaRecorder(dest.stream, { audioBitsPerSecond: 256000 });
  } catch {
    try { _recorder = new MediaRecorder(dest.stream); } catch { return false; }
  }
  _recorder.ondataavailable = (e) => { if (e.data && e.data.size) _chunks.push(e.data); };
  _recorder.start(250);
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
  const rec = _recorder;
  if (!rec || rec.state === "inactive") return null;
  return new Promise((resolve) => {
    rec.onstop = () => {
      const mime = rec.mimeType || _mime || "audio/webm";
      const blob = new Blob(_chunks, { type: mime });
      _chunks = [];
      const ext = mime.includes("ogg") ? "ogg" : mime.includes("mp4") ? "m4a" : "webm";
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const filename = `mic-recording-${stamp}.${ext}`;
      const url = URL.createObjectURL(blob);
      resolve({ blob, url, filename, durationMs: Date.now() - _startedAt, mime });
    };
    rec.stop();
  });
}

export function isMicRecording(): boolean {
  return !!_recorder && _recorder.state === "recording";
}
