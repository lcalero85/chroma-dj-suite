// Live broadcast: capture master output and forward to a remote Icecast/SHOUTcast
// ingest endpoint via a server-side proxy route (/api/stream/ingest).
// The browser cannot speak Icecast's PUT/SOURCE protocol directly because it
// requires connection-keepalive with custom auth headers and arbitrary
// hostnames (CORS), so we relay raw media chunks through our own server.

import { ensureRunning, getEngine } from "./engine";
import type { StreamConfig } from "@/state/store";

let mediaRecorder: MediaRecorder | null = null;
let activeSessionId: string | null = null;
let bytesSent = 0;
let onStatus: ((s: { status: "connecting" | "live" | "error" | "idle"; bytesSent: number; error?: string }) => void) | null = null;
let lastConfig: StreamConfig | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;

export function setStreamStatusListener(fn: typeof onStatus) {
  onStatus = fn;
}

function pickMime(format: StreamConfig["format"]): string {
  // We only enforce browser-side container; the proxy advertises a matching
  // Content-Type to Icecast.
  if (format === "ogg-opus") {
    if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) return "audio/ogg;codecs=opus";
  }
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  return "";
}

export function isStreaming() {
  return mediaRecorder !== null && mediaRecorder.state === "recording";
}

export function getActiveSessionId(): string | null {
  return activeSessionId;
}

/** Send title/artist to the upstream Icecast server as stream metadata. */
export async function updateStreamMetadata(title: string, artist: string): Promise<void> {
  if (!activeSessionId) return;
  try {
    await fetch(`/api/stream/ingest?sessionId=${encodeURIComponent(activeSessionId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, artist }),
    });
  } catch {
    /* noop — metadata is best-effort */
  }
}

export async function startStream(cfg: StreamConfig): Promise<void> {
  if (isStreaming()) return;
  lastConfig = cfg;
  reconnectAttempts = 0;
  if (!cfg.serverUrl || !cfg.password) {
    throw new Error("Falta URL del servidor o contraseña");
  }
  await ensureRunning();
  const eng = getEngine();
  const mime = pickMime(cfg.format);
  if (!mime) throw new Error("Este navegador no soporta MediaRecorder con Opus");

  // Open a session on the server
  const sessRes = await fetch("/api/stream/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "start",
      serverUrl: cfg.serverUrl,
      mount: cfg.mount,
      username: cfg.username,
      password: cfg.password,
      contentType: mime,
      stationName: cfg.stationName,
      genre: cfg.genre,
      description: cfg.description,
      bitrate: cfg.bitrate,
    }),
  });
  if (!sessRes.ok) {
    const t = await sessRes.text().catch(() => "");
    throw new Error(`Servidor rechazó la conexión: ${sessRes.status} ${t}`);
  }
  const { sessionId } = (await sessRes.json()) as { sessionId: string };
  activeSessionId = sessionId;
  bytesSent = 0;
  onStatus?.({ status: "connecting", bytesSent: 0 });

  const stream = eng.recorderDest.stream;
  mediaRecorder = new MediaRecorder(stream, {
    mimeType: mime,
    audioBitsPerSecond: cfg.bitrate * 1000,
  });

  mediaRecorder.ondataavailable = async (ev) => {
    if (!ev.data || ev.data.size === 0 || !activeSessionId) return;
    try {
      const buf = await ev.data.arrayBuffer();
      bytesSent += buf.byteLength;
      onStatus?.({ status: "live", bytesSent });
      await fetch(`/api/stream/ingest?sessionId=${encodeURIComponent(activeSessionId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: buf,
      }).catch((err) => {
        onStatus?.({ status: "error", bytesSent, error: String(err) });
      });
    } catch (err) {
      onStatus?.({ status: "error", bytesSent, error: String(err) });
    }
  };

  mediaRecorder.onerror = (e) => {
    onStatus?.({ status: "error", bytesSent, error: String((e as ErrorEvent).message ?? "MediaRecorder error") });
  };

  // Push a chunk every 500ms — short enough to keep latency manageable.
  mediaRecorder.start(500);
  onStatus?.({ status: "live", bytesSent: 0 });
}

export async function stopStream(): Promise<void> {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  reconnectAttempts = 0;
  lastConfig = null;
  try {
    if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
  } catch { /* noop */ }
  mediaRecorder = null;
  const sid = activeSessionId;
  activeSessionId = null;
  if (sid) {
    try {
      await fetch(`/api/stream/ingest?sessionId=${encodeURIComponent(sid)}`, { method: "DELETE" });
    } catch { /* noop */ }
  }
  onStatus?.({ status: "idle", bytesSent });
}

/** Tries to re-establish a broken stream using the last config, with backoff. */
export function scheduleReconnect(): void {
  if (!lastConfig || reconnectTimer || isStreaming()) return;
  reconnectAttempts += 1;
  const delayMs = Math.min(30_000, 1000 * 2 ** reconnectAttempts);
  onStatus?.({ status: "connecting", bytesSent, error: `Reintentando (${reconnectAttempts}) en ${Math.round(delayMs / 1000)}s` });
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (!lastConfig) return;
    try {
      await startStream(lastConfig);
    } catch (err) {
      onStatus?.({ status: "error", bytesSent, error: err instanceof Error ? err.message : String(err) });
      scheduleReconnect();
    }
  }, delayMs);
}