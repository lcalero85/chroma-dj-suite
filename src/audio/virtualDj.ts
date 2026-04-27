/**
 * Virtual DJ — orquesta un set automático profesional sobre las pistas
 * marcadas por el usuario en la Library, opcionalmente filtradas por género.
 *
 * Características:
 *  - Reutiliza `loadTrackToDeck` para cargar A/B alternando.
 *  - Sincroniza BPM, aplica AutoGain, EQ blend y crossfade suave.
 *  - Inyecta hot-cue de entrada y pone una FX adecuada al género en cada
 *    transición (reverb, delay, filter, flanger, lofi, gate…).
 *  - Opcionalmente graba la sesión completa y la guarda como "Mezcla
 *    Virtual <nombre> — <fecha>" cuando termina la última pista.
 *
 * Es ADITIVO: no reemplaza AutoMix ni la grabadora manual. Se controla
 * desde Settings + LibraryPanel + un botón START en TopBar.
 */
import type { DeckId } from "@/state/store";
import { useApp } from "@/state/store";
import { loadTrackToDeck, addHotCue, jumpHotCue } from "@/state/controller";
import { getDeck, play, pause, seek, setEQ, setAutoGainDb } from "@/audio/deck";
import {
  setXfaderPosition,
  setDeckPitch,
  setDeckFilter,
  setLoop,
  clearLoop,
} from "@/state/controller";
import { setPlaybackRate } from "@/audio/deck";
import { analyzeLoudness } from "@/audio/analysis/loudness";
import { startRecording, stopRecording, isRecording } from "@/audio/recorder";
import { listRecordings, putRecording, uid, type TrackRecord } from "@/lib/db";
import { toast } from "sonner";
import type { FxKind } from "@/audio/fx";

export type VdjGenre =
  | "auto"
  | "house"
  | "techno"
  | "edm"
  | "trance"
  | "hiphop"
  | "reggaeton"
  | "pop"
  | "rock"
  | "latin"
  | "drumandbass"
  | "dubstep"
  | "lofi"
  | "ambient";

/** Sugerencias de FX/transición por género. */
const GENRE_FX: Record<VdjGenre, { kind: FxKind; wet: number; param1: number; param2: number; xfadeSec: number }> = {
  auto:        { kind: "filter",     wet: 0.6, param1: 0.55, param2: 0.5, xfadeSec: 8  },
  house:       { kind: "filter",     wet: 0.7, param1: 0.6,  param2: 0.5, xfadeSec: 12 },
  techno:      { kind: "delay",      wet: 0.45, param1: 0.5,  param2: 0.4, xfadeSec: 8  },
  edm:         { kind: "reverb",     wet: 0.55, param1: 0.65, param2: 0.5, xfadeSec: 6  },
  trance:      { kind: "reverb",     wet: 0.6,  param1: 0.7,  param2: 0.6, xfadeSec: 14 },
  hiphop:      { kind: "echo",       wet: 0.45, param1: 0.5,  param2: 0.4, xfadeSec: 4  },
  reggaeton:   { kind: "delay",      wet: 0.4,  param1: 0.5,  param2: 0.4, xfadeSec: 5  },
  pop:         { kind: "reverb",     wet: 0.4,  param1: 0.5,  param2: 0.5, xfadeSec: 6  },
  rock:        { kind: "phaser",     wet: 0.3,  param1: 0.4,  param2: 0.5, xfadeSec: 5  },
  latin:       { kind: "reverb",     wet: 0.4,  param1: 0.5,  param2: 0.5, xfadeSec: 6  },
  drumandbass: { kind: "gate",       wet: 0.5,  param1: 0.5,  param2: 0.5, xfadeSec: 4  },
  dubstep:     { kind: "bitcrusher", wet: 0.5,  param1: 0.5,  param2: 0.5, xfadeSec: 4  },
  lofi:        { kind: "lofi",       wet: 0.6,  param1: 0.5,  param2: 0.5, xfadeSec: 10 },
  ambient:     { kind: "reverb",     wet: 0.8,  param1: 0.85, param2: 0.7, xfadeSec: 18 },
};

export interface VdjStatus {
  running: boolean;
  paused: boolean;
  index: number;
  total: number;
  currentTrackId: string | null;
  currentDeck: DeckId;
  recording: boolean;
  message: string;
}

let running = false;
let cancelRequested = false;
let currentDeck: DeckId = "A";
let currentIndex = 0;
let currentTrackId: string | null = null;
let recordingActive = false;
let lastMessage = "Idle";

type Listener = () => void;
const listeners = new Set<Listener>();
export function subscribeVdj(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
function notify() { for (const l of listeners) l(); }

export function getVdjStatus(): VdjStatus {
  return {
    running,
    paused: false,
    index: currentIndex,
    total: getQueue().length,
    currentTrackId,
    currentDeck,
    recording: recordingActive,
    message: lastMessage,
  };
}

function setMessage(msg: string) {
  lastMessage = msg;
  notify();
}

/** Pistas que el usuario marcó para mezclar (vdjSelected en settings). */
function getQueue(): TrackRecord[] {
  const s = useApp.getState();
  const selected = new Set(s.settings.vdjSelectedTrackIds ?? []);
  const genre = (s.settings.vdjGenre ?? "auto").toLowerCase();
  const allSelected = s.tracks.filter((t) => selected.has(t.id));
  if (genre === "auto") return allSelected;
  const filtered = allSelected.filter((t) => {
    const tags = (t.tags ?? []).map((x) => x.toLowerCase());
    return tags.some((tag) => tag.includes(genre));
  });
  // Fallback: if the genre filter eliminates every selected track, fall back
  // to the full selection rather than returning an empty queue. This keeps
  // the user's explicit selection respected even when tracks lack tags.
  return filtered.length > 0 ? filtered : allSelected;
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

/** Sync incoming deck pitch to master BPM (within ±8%). */
function syncBpm(masterId: DeckId, incomingId: DeckId) {
  const a = useApp.getState().decks[masterId];
  const b = useApp.getState().decks[incomingId];
  if (!a.bpm || !b.bpm) return;
  const ratio = a.bpm / b.bpm;
  const diffPct = Math.abs(ratio - 1) * 100;
  if (diffPct > 8) return;
  const range = b.pitchRange / 100;
  const pitch = (ratio - 1) / range;
  setDeckPitch(incomingId, Math.max(-1, Math.min(1, pitch)));
  setPlaybackRate(incomingId, ratio);
}

function applyAutoGain(id: DeckId) {
  const d = getDeck(id);
  if (!d.buffer) return;
  try {
    const { gainOffsetDb } = analyzeLoudness(d.buffer);
    setAutoGainDb(id, gainOffsetDb);
  } catch { /* ignore */ }
}

/** Apply genre FX to slot 1, ramping wet up then down across the crossfade. */
function applyGenreFx(genre: VdjGenre) {
  const cfg = GENRE_FX[genre] ?? GENRE_FX.auto;
  useApp.getState().updateFx(1, {
    kind: cfg.kind,
    wet: cfg.wet,
    param1: cfg.param1,
    param2: cfg.param2,
  });
}

function clearGenreFx() {
  useApp.getState().updateFx(1, { kind: "off", wet: 0 });
}

/** Smooth filter sweep on a deck over `seconds`. start/end in -1..1. */
async function filterSweep(id: DeckId, from: number, to: number, seconds: number) {
  const t0 = performance.now();
  return new Promise<void>((resolve) => {
    const step = () => {
      if (cancelRequested) { setDeckFilter(id, 0); resolve(); return; }
      const t = (performance.now() - t0) / (seconds * 1000);
      const k = Math.min(1, t);
      setDeckFilter(id, from + (to - from) * k);
      if (k < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

/** Smooth FX wet ramp on slot `slot` from -> to over `seconds`. */
async function fxWetRamp(slot: 1 | 2 | 3, from: number, to: number, seconds: number) {
  const t0 = performance.now();
  return new Promise<void>((resolve) => {
    const step = () => {
      if (cancelRequested) { resolve(); return; }
      const t = (performance.now() - t0) / (seconds * 1000);
      const k = Math.min(1, t);
      useApp.getState().updateFx(slot, { wet: from + (to - from) * k });
      if (k < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

/** Smoothly ramp playback rate (brake / spin-down effect). */
async function brakeStop(id: DeckId, seconds: number) {
  const startRate = useApp.getState().decks[id].pitch !== undefined
    ? 1 + (useApp.getState().decks[id].pitch * (useApp.getState().decks[id].pitchRange / 100))
    : 1;
  const t0 = performance.now();
  return new Promise<void>((resolve) => {
    const step = () => {
      const t = (performance.now() - t0) / (seconds * 1000);
      const k = Math.min(1, t);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - k, 3);
      const rate = startRate * (1 - eased);
      try { setPlaybackRate(id, Math.max(0.02, rate)); } catch { /* ignore */ }
      if (k < 1) requestAnimationFrame(step);
      else { try { pause(id); } catch { /* ignore */ } resolve(); }
    };
    requestAnimationFrame(step);
  });
}

/** Quick echo-out tail: high feedback echo that fades out. */
async function echoOut(seconds: number) {
  useApp.getState().updateFx(2, {
    kind: "echo",
    wet: 0.9,
    param1: 0.45,
    param2: 0.7,
  });
  await fxWetRamp(2, 0.9, 0, seconds);
  useApp.getState().updateFx(2, { kind: "off", wet: 0 });
}

/** Smooth crossfade between decks with EQ blend. */
async function crossfadeBetween(fromId: DeckId, toId: DeckId, seconds: number) {
  const start = useApp.getState().mixer.xfader;
  const target: -1 | 1 = toId === "A" ? -1 : 1;
  const t0 = performance.now();
  return new Promise<void>((resolve) => {
    const step = () => {
      if (cancelRequested) { resolve(); return; }
      const t = (performance.now() - t0) / (seconds * 1000);
      const k = Math.min(1, t);
      const v = start + (target - start) * k;
      setXfaderPosition(v);
      // EQ blend: outgoing hi cut, incoming lo cut
      setEQ(fromId, "hi", -k * 0.6);
      setEQ(toId,   "lo", -(1 - k) * 0.6);
      if (k < 1) {
        requestAnimationFrame(step);
      } else {
        setEQ(fromId, "hi", 0);
        setEQ(toId,   "lo", 0);
        useApp.getState().updateMixer({ masterDeck: toId });
        resolve();
      }
    };
    requestAnimationFrame(step);
  });
}

function otherDeck(id: DeckId): DeckId { return id === "A" ? "B" : "A"; }

/** Build a mid-track "spice" routine: hot cue jumps, loops, filter sweeps. */
async function spiceCurrent(id: DeckId, genre: VdjGenre) {
  const ds = useApp.getState().decks[id];
  const dur = ds.duration || 0;
  if (dur <= 0) return;
  // Roll a tasteful improv based on genre
  const fast = genre === "drumandbass" || genre === "dubstep" || genre === "techno";
  const dreamy = genre === "ambient" || genre === "lofi" || genre === "trance";

  // 1) Filter sweep up
  await filterSweep(id, 0, fast ? 0.5 : 0.7, dreamy ? 4 : 2.5);
  if (cancelRequested) { setDeckFilter(id, 0); return; }

  // 2) Beat loop (if BPM known) — 4 beats for fast, 8 for slow
  if (ds.bpm) {
    const beats = fast ? 4 : 8;
    try { setLoop(id, beats); } catch { /* ignore */ }
    // Add an FX layer during loop
    useApp.getState().updateFx(2, {
      kind: dreamy ? "reverb" : "delay",
      wet: 0.55,
      param1: 0.55,
      param2: 0.5,
    });
    await sleep((60 / ds.bpm) * beats * 1000 * 1.0);
    try { clearLoop(id); } catch { /* ignore */ }
    await fxWetRamp(2, 0.55, 0, 1.5);
    useApp.getState().updateFx(2, { kind: "off", wet: 0 });
  }

  // 3) Filter sweep back to neutral
  await filterSweep(id, 0.7, 0, 2);
  setDeckFilter(id, 0);
}

/** Wait until the current deck is near its end (or cancel). */
async function waitUntilExitPoint(id: DeckId, leadSec: number) {
  while (!cancelRequested) {
    const ds = useApp.getState().decks[id];
    const dur = ds.duration || 0;
    const pos = (ds.position ?? 0) * dur;
    if (dur > 0 && pos >= dur - leadSec) return;
    if (!ds.isPlaying) return;
    await sleep(250);
  }
}

/** Sanitize a string for filename use. */
function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, "_").trim().slice(0, 64) || "session";
}

export async function startVirtualDj(): Promise<void> {
  if (running) { toast.error("Virtual DJ ya está corriendo"); return; }
  const queue = getQueue();
  if (queue.length === 0) {
    const s = useApp.getState();
    const selectedCount = (s.settings.vdjSelectedTrackIds ?? []).length;
    if (selectedCount === 0) {
      toast.error("Marca pistas con la casilla VDJ en la Library");
    } else {
      toast.error("No hay pistas válidas en la cola");
    }
    return;
  }
  const settings = useApp.getState().settings;
  const genre = (settings.vdjGenre ?? "auto") as VdjGenre;
  const shouldRecord = settings.vdjRecord !== false;

  running = true;
  cancelRequested = false;
  currentIndex = 0;
  currentDeck = "A";
  recordingActive = false;
  setMessage(`Iniciando Virtual DJ (${queue.length} pistas)`);

  // Start recording if requested
  if (shouldRecord && !isRecording()) {
    try {
      await startRecording();
      recordingActive = true;
      toast.success("Grabando sesión Virtual DJ");
    } catch (err) {
      console.warn("[vdj] no se pudo iniciar grabación", err);
    }
  }

  try {
    // Load + start first track on Deck A
    setXfaderPosition(-1);
    await loadTrackToDeck("A", queue[0].id);
    currentTrackId = queue[0].id;
    applyAutoGain("A");
    addHotCue("A", 0); // mark intro for reference
    // Drop a second hot-cue mid-track for later use
    {
      const dA = useApp.getState().decks["A"];
      if (dA.duration > 30) addHotCue("A", dA.duration * 0.45);
    }
    play("A", 0);
    useApp.getState().updateMixer({ masterDeck: "A" });
    setMessage(`▶ ${queue[0].title} (1/${queue.length})`);

    for (let i = 1; i < queue.length; i++) {
      if (cancelRequested) break;
      const fromId = currentDeck;
      const toId = otherDeck(fromId);
      const next = queue[i];

      const fxCfg = GENRE_FX[genre] ?? GENRE_FX.auto;

      // Mid-track flair: spice up the playing deck once it's well underway,
      // before we head to the exit point.
      const dsCur = useApp.getState().decks[fromId];
      const durCur = dsCur.duration || 0;
      if (durCur > 0) {
        // Wait until ~55% of the track to spice
        while (!cancelRequested) {
          const ds2 = useApp.getState().decks[fromId];
          const pos = (ds2.position ?? 0) * (ds2.duration || 0);
          if (pos >= (ds2.duration || 0) * 0.55) break;
          if (!ds2.isPlaying) break;
          await sleep(400);
        }
        if (!cancelRequested) {
          setMessage(`Live FX en ${fromId}`);
          await spiceCurrent(fromId, genre);
        }
      }

      // Wait until the current deck is near its end before transitioning
      await waitUntilExitPoint(fromId, fxCfg.xfadeSec + 2);
      if (cancelRequested) break;

      // Preload next on the other deck
      setMessage(`Preparando ${next.title} (${i + 1}/${queue.length})`);
      await loadTrackToDeck(toId, next.id);
      currentTrackId = next.id;
      applyAutoGain(toId);
      syncBpm(fromId, toId);
      addHotCue(toId, 0);
      {
        const dT = useApp.getState().decks[toId];
        if (dT.duration > 30) addHotCue(toId, dT.duration * 0.45);
      }
      // Jump to first hot-cue if exists, then play
      const tdState = useApp.getState().decks[toId];
      if (tdState.hotCues.length > 0) jumpHotCue(toId, 0);
      else seek(toId, 0);
      play(toId, useApp.getState().decks[toId].cuePoint || 0);

      // Pre-transition: filter sweep down on outgoing for smoother handoff
      void filterSweep(fromId, 0, -0.6, Math.min(3, fxCfg.xfadeSec / 2));
      // Apply genre FX during transition with a wet ramp
      applyGenreFx(genre);
      setMessage(`Mezclando → ${next.title}`);
      await crossfadeBetween(fromId, toId, fxCfg.xfadeSec);
      // Reset outgoing filter
      setDeckFilter(fromId, 0);
      // Stop the outgoing deck cleanly
      pause(fromId);
      // Ramp down FX
      await fxWetRamp(1, fxCfg.wet, 0, 1.5);
      clearGenreFx();

      currentDeck = toId;
      currentIndex = i;
    }

    // Wait for last track to finish
    if (!cancelRequested) {
      // Mid-track flair on the final song too
      const dsLast = useApp.getState().decks[currentDeck];
      if ((dsLast.duration || 0) > 0) {
        while (!cancelRequested) {
          const d2 = useApp.getState().decks[currentDeck];
          const pos = (d2.position ?? 0) * (d2.duration || 0);
          if (pos >= (d2.duration || 0) * 0.55) break;
          if (!d2.isPlaying) break;
          await sleep(400);
        }
        if (!cancelRequested) {
          setMessage(`Live FX en ${currentDeck}`);
          await spiceCurrent(currentDeck, genre);
        }
      }
      setMessage(`Esperando final de la última pista`);
      // Wait until ~5s before end so we can do a brake outro
      while (!cancelRequested) {
        const ds = useApp.getState().decks[currentDeck];
        const dur = ds.duration || 0;
        const pos = (ds.position ?? 0) * dur;
        if (dur > 0 && pos >= dur - 5) break;
        if (!ds.isPlaying) break;
        await sleep(400);
      }
      // Pro outro: filter sweep down + echo tail + brake stop
      if (!cancelRequested) {
        setMessage(`Outro profesional…`);
        void filterSweep(currentDeck, 0, -0.85, 3);
        void echoOut(3.5);
        await brakeStop(currentDeck, 2.2);
        setDeckFilter(currentDeck, 0);
      } else {
        pause(currentDeck);
      }
    }
  } catch (err) {
    console.error("[vdj] error", err);
    toast.error("Virtual DJ: error " + ((err as Error)?.message ?? ""));
  } finally {
    // Stop recording and save
    if (recordingActive && isRecording()) {
      try {
        const r = await stopRecording();
        if (r) {
          const sname = safeName(settings.vdjSessionName ?? "");
          const stamp = new Date().toLocaleString();
          const recName = sname
            ? `Mezcla Virtual ${sname}`
            : `Mezcla Virtual ${stamp}`;
          await putRecording({
            id: uid(),
            name: recName,
            blob: r.blob,
            mime: r.mime,
            duration: r.duration,
            createdAt: Date.now(),
          });
          useApp.getState().setRecordings(await listRecordings());
          toast.success(`Sesión guardada: ${recName}`);
        }
      } catch (err) {
        console.warn("[vdj] error guardando grabación", err);
      }
    }
    recordingActive = false;
    running = false;
    cancelRequested = false;
    currentTrackId = null;
    setMessage("Idle");
    notify();
  }
}

export function stopVirtualDj() {
  if (!running) return;
  cancelRequested = true;
  setMessage("Deteniendo Virtual DJ…");
}

export function isVirtualDjRunning(): boolean { return running; }

/** Toggle a track in the VDJ selection. */
export function toggleVdjTrack(trackId: string) {
  const s = useApp.getState();
  const cur = new Set(s.settings.vdjSelectedTrackIds ?? []);
  if (cur.has(trackId)) cur.delete(trackId);
  else cur.add(trackId);
  s.updateSettings({ vdjSelectedTrackIds: Array.from(cur) });
}

export function clearVdjSelection() {
  useApp.getState().updateSettings({ vdjSelectedTrackIds: [] });
}

export const VDJ_GENRES: VdjGenre[] = [
  "auto", "house", "techno", "edm", "trance", "hiphop", "reggaeton",
  "pop", "rock", "latin", "drumandbass", "dubstep", "lofi", "ambient",
];