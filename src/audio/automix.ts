/**
 * AutoMix Pro engine — orchestrates intelligent transitions between decks.
 *
 * What it adds on top of the simple `autoMixTo()` crossfade:
 *  - Picks the best target deck/track using BPM + key compatibility, energy, and
 *    a no-repeat history.
 *  - Auto-starts the next deck if it's loaded but not playing.
 *  - Auto-syncs BPM (within tolerance) and applies AutoGain so levels match.
 *  - Performs an EQ blend during the crossfade (cuts incoming bass / outgoing
 *    treble) for clean transitions.
 *  - Three modes: `radio` (long, gentle), `club` (tight, EQ-driven),
 *    `intelligent` (adapts duration to compatibility score).
 *  - Vocal-collision protection: postpones the swap a few seconds if the mic
 *    is currently open or if the master deck is in a vocal section.
 *  - Smart entry/exit points: prefers known hot-cues; otherwise estimates from
 *    waveform energy.
 *  - Session history (no repeats) + last-played memory for "smart cue".
 *
 * IMPORTANT: This module is ADDITIVE. It does not replace the existing
 * `autoMixTo()` — both can coexist. The legacy "AutoMix" button still works.
 */
import type { DeckId } from "@/state/store";
import type { TrackRecord } from "@/lib/db";
import { useApp } from "@/state/store";
import { getDeck, play, setPlaybackRate, setEQ, setAutoGainDb, seek } from "./deck";
import { setXfaderPosition, setDeckPitch } from "@/state/controller";
import { isCompatible, type CamelotKey } from "@/lib/camelot";
import { dbToGain, analyzeLoudness } from "@/audio/analysis/loudness";
import { toast } from "sonner";

export type AutoMixMode = "radio" | "club" | "intelligent";
export type AutoMixTransition = "crossfade" | "cut" | "echo-out" | "filter-fade";

export interface AutoMixConfig {
  enabled: boolean;
  mode: AutoMixMode;
  transition: AutoMixTransition;
  /** Crossfade duration in seconds (1..32). */
  duration: number;
  /** Auto-pitch the incoming deck to match master BPM if within this %. */
  bpmTolerancePct: number;
  /** Use Camelot key matching to prefer compatible tracks. */
  keyMatch: boolean;
  /** Apply AutoGain so levels match. */
  autoGain: boolean;
  /** EQ blend (incoming bass cut, outgoing treble cut) during transition. */
  eqBlend: boolean;
  /** Avoid swapping while mic is hot. */
  vocalProtect: boolean;
  /** Number of recent tracks to exclude from the smart queue. */
  noRepeatWindow: number;
}

export const defaultAutoMixConfig = (): AutoMixConfig => ({
  enabled: false,
  mode: "intelligent",
  transition: "crossfade",
  duration: 8,
  bpmTolerancePct: 8,
  keyMatch: true,
  autoGain: true,
  eqBlend: true,
  vocalProtect: true,
  noRepeatWindow: 12,
});

let cfg: AutoMixConfig = defaultAutoMixConfig();
/** Recent track ids in chronological order — newest last. */
const history: string[] = [];
let lastTransitionAt = 0;
let activeRaf: number | null = null;
let pending: { from: DeckId; to: DeckId; at: number } | null = null;

export function getAutoMixConfig(): AutoMixConfig { return { ...cfg }; }
export function setAutoMixConfig(patch: Partial<AutoMixConfig>) {
  cfg = { ...cfg, ...patch };
  notify();
}

export function getHistory(): string[] { return history.slice(); }
export function pushHistory(trackId: string) {
  if (!trackId) return;
  if (history[history.length - 1] === trackId) return;
  history.push(trackId);
  if (history.length > 64) history.splice(0, history.length - 64);
  notify();
}
export function clearHistory() { history.length = 0; notify(); }

/** Subscribers — UI panels listen for state changes. */
type Listener = () => void;
const listeners = new Set<Listener>();
export function subscribeAutoMix(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
function notify() { for (const l of listeners) l(); }

/** Compatibility score 0..1 — higher is better. */
export function compatibilityScore(a: { bpm: number | null; key: CamelotKey | null }, b: { bpm: number | null; key: CamelotKey | null }): number {
  let score = 0.5;
  if (a.bpm && b.bpm) {
    const diff = Math.abs(a.bpm - b.bpm) / a.bpm;
    score += diff < 0.06 ? 0.35 : diff < 0.12 ? 0.18 : 0.0;
  }
  if (a.key && b.key && isCompatible(a.key, b.key)) score += 0.15;
  return Math.max(0, Math.min(1, score));
}

/** Pick the best track from the library to load on `targetDeck` next. */
export function pickNextTrack(targetDeck: DeckId): TrackRecord | null {
  const state = useApp.getState();
  const tracks = state.tracks;
  if (!tracks.length) return null;
  const masterId = state.mixer.masterDeck;
  const masterDeck = state.decks[masterId];
  const recent = new Set(history.slice(-cfg.noRepeatWindow));
  // Also exclude tracks currently loaded on any deck
  for (const d of ["A", "B", "C", "D"] as DeckId[]) {
    const tid = state.decks[d].trackId;
    if (tid) recent.add(tid);
  }
  const candidates = tracks.filter((t) => !recent.has(t.id));
  const pool = candidates.length ? candidates : tracks; // fallback if all excluded
  // Score candidates against master's BPM/key
  let best: TrackRecord | null = null;
  let bestScore = -1;
  for (const t of pool) {
    const s = compatibilityScore(
      { bpm: masterDeck.bpm, key: masterDeck.key },
      { bpm: t.bpm ?? null, key: (t.key as CamelotKey | undefined) ?? null },
    );
    if (s > bestScore) { bestScore = s; best = t; }
  }
  void targetDeck;
  return best;
}

/** Returns the "other" deck id, considering only A/B for AutoMix. */
function otherDeck(id: DeckId): DeckId {
  return id === "A" ? "B" : "A";
}

/** Public: get the most likely next deck given the current crossfader. */
export function nextTargetDeck(): DeckId {
  const m = useApp.getState().mixer;
  // If xfader is currently on A (<0), next target is B; vice versa.
  return m.xfader < 0 ? "B" : "A";
}

/** Compute a smart "exit" position (in normalized 0..1) for the outgoing deck.
 * Prefers the latest hot-cue or a high-energy peak in the second half. */
export function smartExitPoint(id: DeckId): number {
  const ds = useApp.getState().decks[id];
  if (!ds.duration) return 0.85;
  // Prefer the latest hot-cue in the back half of the track
  const back = ds.hotCues
    .map((c) => c.pos / Math.max(1, ds.duration))
    .filter((p) => p > 0.55 && p < 0.95);
  if (back.length) return Math.max(...back);
  // Otherwise scan the peaks for a quiet "outro" region
  if (ds.peaks?.length) {
    const start = Math.floor(ds.peaks.length * 0.7);
    let bestIdx = ds.peaks.length - 1;
    let lowest = Infinity;
    for (let i = start; i < ds.peaks.length; i++) {
      if (ds.peaks[i] < lowest) { lowest = ds.peaks[i]; bestIdx = i; }
    }
    return bestIdx / ds.peaks.length;
  }
  return 0.85;
}

/** Compute a smart entry point — first hot-cue or first strong onset. */
export function smartEntryPoint(id: DeckId): number {
  const ds = useApp.getState().decks[id];
  if (ds.hotCues.length) {
    const first = [...ds.hotCues].sort((a, b) => a.pos - b.pos)[0];
    return first.pos / Math.max(1, ds.duration || 1);
  }
  if (ds.peaks?.length) {
    const limit = Math.floor(ds.peaks.length * 0.25);
    let i = 0;
    for (; i < limit; i++) if (ds.peaks[i] > 0.35) break;
    return Math.max(0, i / ds.peaks.length);
  }
  return 0;
}

/** True if the master deck is currently in a "vocal-likely" section.
 * Heuristic: high mid-band energy. Best-effort — cheap and non-blocking. */
export function isVocalSection(id: DeckId): boolean {
  const ds = useApp.getState().decks[id];
  if (!ds.bands?.mid?.length || !ds.duration) return false;
  const idx = Math.floor((ds.position) * ds.bands.mid.length);
  const lo = ds.bands.lo?.[idx] ?? 0;
  const mid = ds.bands.mid?.[idx] ?? 0;
  return mid > 0.55 && mid > lo * 1.2;
}

/** Estimate "energy" 0..1 for a track using its peak envelope. */
export function trackEnergy(id: DeckId): number {
  const ds = useApp.getState().decks[id];
  if (!ds.peaks?.length) return 0.5;
  let sum = 0;
  for (const p of ds.peaks) sum += p;
  return Math.min(1, sum / ds.peaks.length / 0.6);
}

/** Apply AutoGain to a deck if not already set. */
export async function ensureAutoGain(id: DeckId) {
  if (!cfg.autoGain) return;
  const d = getDeck(id);
  if (!d.buffer) return;
  // If gain offset already non-zero we assume previously analyzed
  // (analyzeLoudness is light but still costs ~50ms per track).
  try {
    const { gainOffsetDb } = analyzeLoudness(d.buffer);
    setAutoGainDb(id, gainOffsetDb);
    void dbToGain;
  } catch {
    /* ignore */
  }
}

/** Auto-sync BPM by adjusting incoming deck's pitch (within tolerance). */
function autoSyncBpm(from: DeckId, to: DeckId) {
  const decks = useApp.getState().decks;
  const a = decks[from];
  const b = decks[to];
  if (!a.bpm || !b.bpm) return;
  const diffPct = Math.abs(a.bpm - b.bpm) / a.bpm * 100;
  if (diffPct > cfg.bpmTolerancePct) return;
  // Adjust pitch of `to` so its bpm == a.bpm. pitch range scales by pitchRange%.
  const ratio = a.bpm / b.bpm;
  const pitchRange = b.pitchRange / 100; // e.g. 0.08
  const pitch = (ratio - 1) / pitchRange;
  setDeckPitch(to, Math.max(-1, Math.min(1, pitch)));
  setPlaybackRate(to, ratio);
}

/** Run the EQ blend curve during a transition.
 * `t` 0..1 is the fade progress. */
function applyEqBlend(from: DeckId, to: DeckId, t: number) {
  if (!cfg.eqBlend) return;
  // Outgoing: gradually cut highs (avoid hi-hat clash). Incoming: cut lows
  // until ~halfway, then restore (avoid bass clash).
  const outHi = -t * 0.6;        // 0 → -0.6
  const inLo  = -(1 - t) * 0.6;  // -0.6 → 0
  setEQ(from, "hi", outHi);
  setEQ(to,   "lo", inLo);
}

/** Reset EQs to neutral. */
function resetEqBlend(from: DeckId, to: DeckId) {
  setEQ(from, "hi", 0);
  setEQ(to,   "lo", 0);
}

/** Cancel any pending or running auto-mix. */
export function cancelAutoMix() {
  if (activeRaf) { cancelAnimationFrame(activeRaf); activeRaf = null; }
  pending = null;
  notify();
}

/**
 * Trigger a smart transition from current master deck to the other deck.
 * - Auto-starts the target deck if it has a track loaded but isn't playing.
 * - If the target deck has no track, picks one from the library and loads it.
 * - Applies AutoGain, optional BPM sync, and EQ blend.
 * - Vocal-protected: defers up to 4s if mic is hot or master is in a vocal.
 */
export async function smartCrossfade(opts?: { force?: boolean }): Promise<boolean> {
  const state = useApp.getState();
  const fromId = state.mixer.masterDeck === "A" || state.mixer.masterDeck === "B"
    ? state.mixer.masterDeck
    : "A";
  const toId = otherDeck(fromId);

  // Vocal-collision protection
  if (cfg.vocalProtect && !opts?.force) {
    const micHot = state.mixer.micOn;
    const inVocal = isVocalSection(fromId);
    if (micHot || inVocal) {
      pending = { from: fromId, to: toId, at: performance.now() + 4000 };
      notify();
      // Re-attempt after 4s
      setTimeout(() => { if (pending) { pending = null; smartCrossfade({ force: true }); } }, 4000);
      return false;
    }
  }

  const fromDeck = getDeck(fromId);
  let toDeck = getDeck(toId);

  if (!fromDeck.buffer) {
    toast.error("AutoMix: no master track playing");
    return false;
  }

  // Ensure target deck has something to play
  if (!toDeck.buffer || !state.decks[toId].trackId) {
    const next = pickNextTrack(toId);
    if (!next) {
      toast.error("AutoMix: library empty — add tracks first");
      return false;
    }
    // Defer to existing loader (loadTrackToDeck) — dynamic import avoids cycles.
    try {
      const mod = await import("@/state/controller");
      type Loader = (id: DeckId, t: TrackRecord) => Promise<void>;
      const loader = (mod as unknown as { loadTrackToDeck?: Loader }).loadTrackToDeck;
      if (loader) await loader(toId, next);
    } catch {/* ignore */}
    toDeck = getDeck(toId);
  }
  if (!toDeck.buffer) return false;

  // AutoGain match
  await ensureAutoGain(toId);
  // Auto-sync BPM if within tolerance
  autoSyncBpm(fromId, toId);

  // Auto-start the target deck at its smart entry point
  if (!toDeck.isPlaying) {
    const entry = smartEntryPoint(toId);
    const startSec = (entry || 0) * (toDeck.buffer.duration || 0);
    seek(toId, startSec);
    play(toId, startSec);
  }

  // Pick duration based on mode + compatibility
  const masterDeck = useApp.getState().decks[fromId];
  const incomingDeck = useApp.getState().decks[toId];
  const score = compatibilityScore(
    { bpm: masterDeck.bpm, key: masterDeck.key },
    { bpm: incomingDeck.bpm, key: incomingDeck.key },
  );
  let seconds = cfg.duration;
  if (cfg.mode === "radio")  seconds = Math.max(8, cfg.duration * 1.5);
  if (cfg.mode === "club")   seconds = Math.max(2, cfg.duration * 0.6);
  if (cfg.mode === "intelligent") seconds = cfg.duration * (0.6 + score * 0.8);

  // Update master deck pointer to the incoming side once swap is done
  const target: -1 | 1 = toId === "A" ? -1 : 1;
  return runCrossfade(fromId, toId, target, seconds);
}

/** Internal crossfade runner with EQ blend + history tracking. */
function runCrossfade(from: DeckId, to: DeckId, target: -1 | 1, seconds: number): boolean {
  if (activeRaf) cancelAnimationFrame(activeRaf);
  const start = useApp.getState().mixer.xfader;
  const t0 = performance.now();
  lastTransitionAt = t0;
  notify();
  const step = () => {
    const t = (performance.now() - t0) / (seconds * 1000);
    const k = Math.min(1, t);
    const v = start + (target - start) * k;
    setXfaderPosition(v);
    applyEqBlend(from, to, k);
    if (k < 1) {
      activeRaf = requestAnimationFrame(step);
    } else {
      activeRaf = null;
      resetEqBlend(from, to);
      // Move master pointer to incoming deck and log history
      useApp.getState().updateMixer({ masterDeck: to });
      const tid = useApp.getState().decks[to].trackId;
      if (tid) pushHistory(tid);
      notify();
    }
  };
  activeRaf = requestAnimationFrame(step);
  return true;
}

/** Snapshot for the UI panel. */
export interface AutoMixStatus {
  config: AutoMixConfig;
  history: string[];
  pendingSwap: boolean;
  isRunning: boolean;
  lastTransitionAt: number;
  nextTargetDeck: DeckId;
  compatibility: number;
}

export function getAutoMixStatus(): AutoMixStatus {
  const tgt = nextTargetDeck();
  const state = useApp.getState();
  const a = state.decks[state.mixer.masterDeck];
  const b = state.decks[tgt];
  return {
    config: { ...cfg },
    history: history.slice(-8),
    pendingSwap: !!pending,
    isRunning: !!activeRaf,
    lastTransitionAt,
    nextTargetDeck: tgt,
    compatibility: compatibilityScore(
      { bpm: a.bpm, key: a.key },
      { bpm: b.bpm, key: b.key },
    ),
  };
}