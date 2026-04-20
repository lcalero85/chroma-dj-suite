// Video+audio recorder. Captures the VideoStage canvas (via captureStream)
// and combines it with the existing record audio tap via MediaStreamDestination,
// then encodes through MediaRecorder. Falls back to WebM when MP4 isn't
// supported (most desktop Chromium supports H.264 mp4; Firefox usually emits
// WebM/VP9). The file extension reflects the actual mime.

import { ensureRunning, getEngine } from "./engine";

let mediaRec: MediaRecorder | null = null;
let chunks: Blob[] = [];
let active = false;
let startTs = 0;
let mimeType = "video/webm";
let combinedStream: MediaStream | null = null;
let canvasStream: MediaStream | null = null;

function pickMime(): string {
  const candidates = [
    "video/mp4;codecs=avc1,mp4a.40.2",
    "video/mp4;codecs=h264,aac",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const m of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
  }
  return "video/webm";
}

export function isVideoRecording() {
  return active;
}

export function videoRecordingElapsed() {
  return active ? (Date.now() - startTs) / 1000 : 0;
}

export async function startVideoRecording(canvas: HTMLCanvasElement, fps = 30): Promise<boolean> {
  if (active) return true;
  await ensureRunning();
  const { recorderDest } = getEngine();
  if (!canvas.captureStream) {
    console.warn("Canvas captureStream not supported");
    return false;
  }
  canvasStream = canvas.captureStream(fps);
  const audioStream = recorderDest.stream;
  combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioStream.getAudioTracks(),
  ]);
  mimeType = pickMime();
  try {
    mediaRec = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 4_000_000 });
  } catch (e) {
    console.error("MediaRecorder init failed", e);
    return false;
  }
  chunks = [];
  mediaRec.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) chunks.push(ev.data);
  };
  mediaRec.start(1000);
  active = true;
  startTs = Date.now();
  return true;
}

export function stopVideoRecording(): Promise<{ blob: Blob; mime: string; duration: number; ext: string } | null> {
  return new Promise((resolve) => {
    if (!active || !mediaRec) {
      resolve(null);
      return;
    }
    const duration = (Date.now() - startTs) / 1000;
    mediaRec.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      cleanup();
      resolve({ blob, mime: mimeType, duration, ext });
    };
    mediaRec.stop();
    active = false;
  });
}

function cleanup() {
  if (canvasStream) {
    canvasStream.getTracks().forEach((t) => t.stop());
    canvasStream = null;
  }
  combinedStream = null;
  mediaRec = null;
  chunks = [];
}