import { useApp } from "@/state/store";

/**
 * "Cloud sync" — phase-1 implementation: serializes user-tunable state into a
 * portable JSON blob the user can save anywhere (Drive, iCloud, USB) and
 * import on another machine. Real cloud backend is out of scope for v1.4.
 */

const SYNC_VERSION = 1;

export interface CloudSyncPayload {
  version: number;
  exportedAt: string;
  app: string;
  data: {
    settings: unknown;
    skin: unknown;
    mixer: unknown;
    fx: unknown;
    mixPresets: unknown;
    midi: unknown;
    radio: unknown;
    videoMix: unknown;
    segments: unknown;
    stream: unknown;
  };
}

export function buildSyncPayload(): CloudSyncPayload {
  const s = useApp.getState();
  return {
    version: SYNC_VERSION,
    exportedAt: new Date().toISOString(),
    app: s.settings.appName || "VDJ PRO",
    data: {
      settings: s.settings,
      skin: s.skin,
      mixer: s.mixer,
      fx: s.fx,
      mixPresets: s.mixPresets,
      midi: s.midi,
      radio: s.radio,
      videoMix: s.videoMix,
      segments: s.segments,
      stream: { ...s.stream, status: "idle", lastError: null, bytesSent: 0, startedAt: null },
    },
  };
}

export function downloadSyncBackup() {
  const payload = buildSyncPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  a.download = `vdj-pro-backup-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}

export async function importSyncBackup(file: File): Promise<boolean> {
  try {
    const txt = await file.text();
    const parsed = JSON.parse(txt) as CloudSyncPayload;
    if (!parsed || typeof parsed !== "object" || !parsed.data) return false;
    const d = parsed.data;
    useApp.setState((s) => ({
      settings: { ...s.settings, ...((d.settings as object) || {}) },
      skin: (d.skin as typeof s.skin) ?? s.skin,
      mixer: { ...s.mixer, ...((d.mixer as object) || {}) },
      fx: Array.isArray(d.fx) ? (d.fx as typeof s.fx) : s.fx,
      mixPresets: Array.isArray(d.mixPresets) ? (d.mixPresets as typeof s.mixPresets) : s.mixPresets,
      midi: { ...s.midi, ...((d.midi as object) || {}) },
      radio: { ...s.radio, ...((d.radio as object) || {}) },
      videoMix: { ...s.videoMix, ...((d.videoMix as object) || {}) },
      segments: Array.isArray(d.segments) ? (d.segments as typeof s.segments) : s.segments,
      stream: { ...s.stream, ...((d.stream as object) || {}), status: "idle" as const, lastError: null, bytesSent: 0, startedAt: null },
    }));
    return true;
  } catch {
    return false;
  }
}