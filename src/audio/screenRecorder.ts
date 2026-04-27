// Screen + audio recorder for Virtual DJ sessions.
//
// Uses navigator.mediaDevices.getDisplayMedia() to capture the screen (or a
// browser tab / window the user picks) and combines it with the existing
// app audio tap (recorderDest). The combined stream is encoded with
// MediaRecorder and downloaded to the user when stopped.
//
// IMPORTANT: getDisplayMedia REQUIRES a user gesture. We call this from the
// same click that starts the Virtual DJ, so the browser's picker shows up.
// If the user cancels the picker, we fail gracefully — the VDJ continues
// running without screen recording.

import { ensureRunning, getEngine } from "./engine";

let mediaRec: MediaRecorder | null = null;
let chunks: Blob[] = [];
let active = false;
let startTs = 0;
let mimeType = "video/webm";
let displayStream: MediaStream | null = null;
let combinedStream: MediaStream | null = null;

function pickMime(): string {
  const candidates = [
    "video/mp4;codecs=avc1,mp4a.40.2",
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

export function isScreenRecording() { return active; }
export function screenRecordingElapsed() { return active ? (Date.now() - startTs) / 1000 : 0; }

/**
 * Prompt the user to pick a screen/window/tab and start recording it together
 * with the app's master+mic audio. Must be called from a user gesture.
 * Returns true if recording actually started.
 */
export async function startScreenRecording(): Promise<boolean> {
  if (active) return true;
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
    console.warn("[screenRec] getDisplayMedia not supported");
    return false;
  }
  await ensureRunning();
  const { recorderDest } = getEngine();

  try {
    displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: false,
    });
  } catch (e) {
    // User cancelled the picker, or permission denied.
    console.warn("[screenRec] picker cancelled", e);
    return false;
  }

  const audioTracks = recorderDest.stream.getAudioTracks();
  combinedStream = new MediaStream([
    ...displayStream.getVideoTracks(),
    ...audioTracks,
  ]);

  mimeType = pickMime();
  try {
    mediaRec = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: 4_000_000,
    });
  } catch (e) {
    console.error("[screenRec] MediaRecorder init failed", e);
    cleanup();
    return false;
  }

  chunks = [];
  mediaRec.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) chunks.push(ev.data);
  };

  // If the user clicks the browser's "Stop sharing" button, finalize cleanly.
  const stopOnEnd = () => {
    if (active) void stopScreenRecording().then((res) => {
      if (res) downloadBlob(res.blob, defaultFileName(res.ext));
    });
  };
  displayStream.getVideoTracks().forEach((t) => t.addEventListener("ended", stopOnEnd));

  mediaRec.start(1000);
  active = true;
  startTs = Date.now();
  return true;
}

/**
 * Stop the screen recording and return the resulting Blob.
 * Caller is responsible for downloading or persisting it.
 */
export function stopScreenRecording(): Promise<{ blob: Blob; mime: string; duration: number; ext: string } | null> {
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
    try { mediaRec.stop(); } catch { /* noop */ }
    active = false;
  });
}

function cleanup() {
  if (displayStream) {
    displayStream.getTracks().forEach((t) => { try { t.stop(); } catch { /* noop */ } });
    displayStream = null;
  }
  combinedStream = null;
  mediaRec = null;
  chunks = [];
}

function defaultFileName(ext: string) {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  return `VirtualDJ_${stamp}.${ext}`;
}

/** Trigger a browser download for the given Blob. */
export function downloadBlob(blob: Blob, filename: string) {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { try { URL.revokeObjectURL(url); a.remove(); } catch { /* noop */ } }, 1500);
  } catch (e) {
    console.warn("[screenRec] download failed", e);
  }
}