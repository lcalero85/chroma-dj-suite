// Per-deck video element manager. Each deck (A/B) can hold a <video> element
// that we drive externally. Audio is decoded into the existing audio buffer
// graph as usual; the video element is muted and sync'd to deck position
// every animation frame. The element is owned here (not in the DOM tree
// directly) and is rendered into the VideoStage canvas.

import type { DeckId } from "@/state/store";

interface VideoHandle {
  el: HTMLVideoElement;
  url: string;
  ready: boolean;
}

const videos: Partial<Record<DeckId, VideoHandle>> = {};

export function getVideo(id: DeckId): VideoHandle | null {
  return videos[id] ?? null;
}

export function setVideo(id: DeckId, blob: Blob): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    // Cleanup previous
    clearVideo(id);
    const url = URL.createObjectURL(blob);
    const el = document.createElement("video");
    el.src = url;
    el.muted = true; // audio comes from AudioBuffer pipeline
    el.playsInline = true;
    el.crossOrigin = "anonymous";
    el.preload = "auto";
    el.loop = false;
    const handle: VideoHandle = { el, url, ready: false };
    videos[id] = handle;
    el.onloadedmetadata = () => {
      handle.ready = true;
      resolve(el);
    };
    el.onerror = () => reject(new Error("Video load failed"));
    el.load();
  });
}

export function clearVideo(id: DeckId) {
  const v = videos[id];
  if (!v) return;
  try { v.el.pause(); } catch { /* noop */ }
  try { URL.revokeObjectURL(v.url); } catch { /* noop */ }
  v.el.removeAttribute("src");
  try { v.el.load(); } catch { /* noop */ }
  delete videos[id];
}

export function syncVideo(id: DeckId, audioPosSec: number, audioPlaying: boolean, rate: number) {
  const v = videos[id];
  if (!v || !v.ready) return;
  const el = v.el;
  // Keep playbackRate aligned with audio
  if (Math.abs(el.playbackRate - rate) > 0.005) {
    try { el.playbackRate = rate; } catch { /* noop */ }
  }
  if (audioPlaying) {
    if (el.paused) {
      el.currentTime = Math.max(0, audioPosSec);
      void el.play().catch(() => {});
    } else {
      // Drift correction
      const drift = audioPosSec - el.currentTime;
      if (Math.abs(drift) > 0.25) {
        el.currentTime = Math.max(0, audioPosSec);
      }
    }
  } else {
    if (!el.paused) el.pause();
    if (Math.abs(el.currentTime - audioPosSec) > 0.05) {
      try { el.currentTime = Math.max(0, audioPosSec); } catch { /* noop */ }
    }
  }
}

export function isVideoBlob(blob: Blob): boolean {
  return blob.type.startsWith("video/");
}

export function hasAnyVideo(): boolean {
  return Object.keys(videos).length > 0;
}