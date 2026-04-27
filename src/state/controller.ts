// Bridges the React store with the audio engine. All UI changes go through here.
import { useApp, type DeckId } from "./store";
import {
  ensureRunning,
  setMasterVolume as engSetMaster,
  setLimiter as engSetLimiter,
  enableMic as engEnableMic,
  disableMic as engDisableMic,
  setMicLevel as engSetMicLevel,
  setMicDuck as engSetMicDuck,
  applyVoicePreset,
  VOICE_PRESETS,
  useAppMasterRef,
} from "@/audio/engine";
import {
  getDeck,
  loadBuffer,
  play,
  pause,
  seek,
  currentTime,
  setPlaybackRate,
  setEQ,
  setFilter,
  setGain,
  setFader,
  setCue,
  nudge,
  setVocalCut as engSetVocalCut,
  setAutoGainDb,
  getAutoGainDb,
} from "@/audio/deck";
import { applyCrossfader } from "@/audio/crossfader";
import { detectBPM, extractPeaks, extractBandPeaks } from "@/audio/analysis/bpm";
import { analyzeLoudness, dbToGain } from "@/audio/analysis/loudness";
import { detectFirstTransient } from "@/audio/analysis/autoCue";
import { getTrack, putTrack, type TrackRecord, listFolders, putFolder, deleteFolder as dbDeleteFolder, type FolderRecord, type PhraseMarker, type PhraseType } from "@/lib/db";
import { pseudoDetectKey } from "@/lib/camelot";
import { toast } from "sonner";
import { t as tI18n } from "@/lib/i18n";
import { setVideo, clearVideo, syncVideo, getVideo, isVideoBlob } from "@/audio/videoDeck";
import { startStream as engStartStream, stopStream as engStopStream, setStreamStatusListener, isStreaming, updateStreamMetadata, scheduleReconnect } from "@/audio/iceStreamer";
import type { RadioSegment } from "./store";

let pollStarted = false;

// ===== Session stats =====
const sessionStats = {
  startedAt: Date.now(),
  tracksPlayed: 0,
  totalSeconds: 0,
  topTracks: new Map<string, number>(),
  lastTickAt: Date.now(),
};

export function getSessionStats() {
  const top = [...sessionStats.topTracks.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([trackId, count]) => ({ trackId, count }));
  return {
    startedAt: sessionStats.startedAt,
    tracksPlayed: sessionStats.tracksPlayed,
    totalSeconds: sessionStats.totalSeconds,
    topTracks: top,
  };
}

export function resetSessionStats() {
  sessionStats.startedAt = Date.now();
  sessionStats.tracksPlayed = 0;
  sessionStats.totalSeconds = 0;
  sessionStats.topTracks.clear();
}

export function startPositionPolling() {
  if (pollStarted) return;
  pollStarted = true;
  const tick = () => {
    const state = useApp.getState();
    const now = Date.now();
    const dt = (now - sessionStats.lastTickAt) / 1000;
    sessionStats.lastTickAt = now;
    // ===== Master Tempo Lock =====
    // Continuously match every non-master deck's effective BPM to the master's
    // effective BPM, like Rekordbox / Serato BEAT SYNC MASTER. Only acts when
    // both decks have a known BPM and the delta exceeds a small threshold to
    // avoid pitch jitter every animation frame.
    if (state.mixer.tempoLock) {
      const masterId = state.mixer.masterDeck;
      const m = state.decks[masterId];
      if (m && m.bpm) {
        const masterRange = m.pitchRange / 100;
        const masterEff = m.bpm * (1 + m.pitch * masterRange);
        state.activeDecks.forEach((id) => {
          if (id === masterId) return;
          const s = state.decks[id];
          if (!s.bpm) return;
          const sRange = s.pitchRange / 100;
          const targetPitch = (masterEff / s.bpm - 1) / sRange;
          const clamped = Math.max(-1, Math.min(1, targetPitch));
          // Only update when meaningfully different (≈0.05% pitch ≈ 0.06 BPM @ 120).
          if (Math.abs(clamped - s.pitch) > 0.0005) {
            setDeckPitch(id, clamped);
          }
        });
      }
    }
    state.activeDecks.forEach((id) => {
      const d = getDeck(id);
      if (!d.buffer) return;
      const t = currentTime(id);
      const dur = d.buffer.duration;
      const ds = state.decks[id];
      if (d.isPlaying && dt > 0 && dt < 1) sessionStats.totalSeconds += dt;
      // Sync video element if any
      if (ds.hasVideo) {
        syncVideo(id, t, d.isPlaying, d.playbackRate);
      }
      // loop
      if (
        ds.loopActive &&
        ds.loopStart !== null &&
        ds.loopEnd !== null &&
        ds.loopEnd > ds.loopStart &&
        (t >= ds.loopEnd || t < ds.loopStart - 0.05)
      ) {
        seek(id, ds.loopStart);
      }
      const pos = dur > 0 ? Math.min(1, t / dur) : 0;
      // Radio auto-advance: when Deck A is the radio engine and track ended
      if (id === "A" && state.radio.enabled && dur > 0 && ds.isPlaying && t >= dur - 0.25) {
        // schedule next track
        void radioNext();
      }
      if (Math.abs((ds.position ?? 0) - pos) > 0.0005 || ds.isPlaying !== d.isPlaying) {
        useApp.getState().updateDeck(id, { position: pos, isPlaying: d.isPlaying });
      }
    });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export async function loadTrackToDeck(deckId: DeckId, trackId: string) {
  await ensureRunning();
  const t = await getTrack(trackId);
  if (!t) return;
  const ctx = (await ensureRunning());
  const arr = await t.blob.arrayBuffer();
  const buffer = await ctx.decodeAudioData(arr.slice(0));
  loadBuffer(deckId, buffer);

  // Video handling
  const isVideo = (t.kind === "video") || isVideoBlob(t.blob);
  if (isVideo) {
    try {
      await setVideo(deckId, t.blob);
    } catch (e) {
      console.warn("Video load failed", e);
    }
  } else {
    clearVideo(deckId);
  }

  let peaks = t.peaks;
  if (!peaks || peaks.length === 0) {
    peaks = await extractPeaks(buffer, 1024);
  }
  let bands = t.bands;
  if (!bands || !bands.lo || bands.lo.length === 0) {
    try {
      bands = await extractBandPeaks(buffer, 1024);
    } catch {
      bands = undefined;
    }
  }
  let bpm = t.bpm;
  if (!bpm) {
    toast("Analizando BPM…");
    try {
      bpm = await detectBPM(buffer);
    } catch {
      bpm = 120;
    }
  }
  const key = t.key ?? pseudoDetectKey(t.id);
  // Auto-gain: compute once per track and cache.
  let gainOffsetDb = t.gainOffsetDb;
  if (gainOffsetDb === undefined) {
    try {
      gainOffsetDb = analyzeLoudness(buffer).gainOffsetDb;
    } catch {
      gainOffsetDb = 0;
    }
  }
  const updated: TrackRecord = { ...t, bpm, key, peaks, bands, gainOffsetDb, lastPlayed: Date.now() };
  // Auto-Cue: detect first transient (cached on the track record).
  const autoCueEnabled = useApp.getState().settings.autoCueOnLoad ?? true;
  let autoCueSec = t.autoCueSec;
  if (autoCueSec === undefined) {
    try {
      autoCueSec = detectFirstTransient(buffer);
    } catch {
      autoCueSec = 0;
    }
    updated.autoCueSec = autoCueSec;
  } else {
    updated.autoCueSec = autoCueSec;
  }
  const initialCue = autoCueEnabled ? (autoCueSec ?? 0) : 0;
  await putTrack(updated);

  // Apply auto-gain to this deck's channel-gain (multiplies the user knob).
  const autoGainEnabled = useApp.getState().settings.autoGainOnImport ?? true;
  setAutoGainDb(deckId, autoGainEnabled ? (gainOffsetDb ?? 0) : 0);
  const userGain = useApp.getState().decks[deckId].gain;
  setGain(deckId, userGain * dbToGain(autoGainEnabled ? (gainOffsetDb ?? 0) : 0));

  useApp.getState().updateDeck(deckId, {
    trackId: t.id,
    title: t.title,
    artist: t.artist,
    duration: buffer.duration,
    position: buffer.duration > 0 ? initialCue / buffer.duration : 0,
    isPlaying: false,
    bpm,
    key,
    peaks,
    bands: bands ?? null,
    hotCues: t.hotCues ?? [],
    cuePoint: initialCue,
    loopStart: null,
    loopEnd: null,
    loopActive: false,
    savedLoops: t.savedLoops ?? [],
    gridOffsetSec: t.gridOffsetSec ?? 0,
    phrases: t.phrases ?? [],
    hasVideo: isVideo,
  });
  // Position the playhead at the auto-cue so first PLAY drops on the beat.
  if (initialCue > 0) {
    try { seek(deckId, initialCue); } catch { /* noop */ }
  }
  toast(`${tI18n("loadedToast")} ${deckId}`, { description: t.title });
  markActiveDeck(deckId);

  // Track stats + play count
  sessionStats.tracksPlayed += 1;
  sessionStats.topTracks.set(t.id, (sessionStats.topTracks.get(t.id) ?? 0) + 1);
  void putTrack({ ...updated, playCount: (t.playCount ?? 0) + 1 });

  // Push now-playing metadata to live stream if running
  if (deckId === "A" || deckId === "B") {
    try {
      void updateStreamMetadata(t.title, t.artist);
    } catch { /* noop */ }
  }
}

export async function togglePlay(id: DeckId) {
  await ensureRunning();
  const d = getDeck(id);
  if (!d.buffer) return;
  if (d.isPlaying) pause(id);
  else play(id);
  useApp.getState().updateDeck(id, { isPlaying: d.isPlaying });
  markActiveDeck(id);
}

export function cueDeck(id: DeckId) {
  const d = getDeck(id);
  const ds = useApp.getState().decks[id];
  if (!d.buffer) return;
  markActiveDeck(id);
  if (d.isPlaying) {
    pause(id);
    seek(id, ds.cuePoint);
    useApp.getState().updateDeck(id, { isPlaying: false, position: ds.cuePoint / d.buffer.duration });
  } else {
    // Set cue point at current position
    const t = currentTime(id);
    if (Math.abs(t - ds.cuePoint) > 0.05) {
      useApp.getState().updateDeck(id, { cuePoint: t });
    } else {
      seek(id, ds.cuePoint);
      play(id, ds.cuePoint);
      useApp.getState().updateDeck(id, { isPlaying: true });
    }
  }
}

export function syncDeck(id: DeckId, masterId: DeckId) {
  const m = useApp.getState().decks[masterId];
  const s = useApp.getState().decks[id];
  if (!m.bpm || !s.bpm) return;
  const ratio = m.bpm / s.bpm;
  const range = s.pitchRange / 100;
  const pitch = Math.max(-1, Math.min(1, (ratio - 1) / range));
  setDeckPitch(id, pitch);
}

export function setDeckPitch(id: DeckId, pitch: number) {
  const ds = useApp.getState().decks[id];
  const range = ds.pitchRange / 100;
  const rate = 1 + pitch * range;
  setPlaybackRate(id, rate);
  useApp.getState().updateDeck(id, { pitch });
}

/** ===== Beat Grid editor ===== */

function persistGrid(id: DeckId, patch: { gridOffsetSec?: number; bpm?: number | null }) {
  const ds = useApp.getState().decks[id];
  if (!ds.trackId) return;
  void getTrack(ds.trackId).then((tr) => {
    if (!tr) return;
    const next = { ...tr } as TrackRecord;
    if (patch.gridOffsetSec !== undefined) next.gridOffsetSec = patch.gridOffsetSec;
    if (patch.bpm !== undefined) next.bpm = patch.bpm;
    putTrack(next);
  });
}

/** Shift the beat-grid downbeat by deltaSec (negative = earlier). */
export function nudgeGridOffset(id: DeckId, deltaSec: number) {
  const ds = useApp.getState().decks[id];
  if (!ds.bpm) return;
  const beat = 60 / ds.bpm;
  // Keep the offset within one beat — adding multiples of beat is a no-op for the grid.
  let next = ((ds.gridOffsetSec ?? 0) + deltaSec) % beat;
  if (next < 0) next += beat;
  useApp.getState().updateDeck(id, { gridOffsetSec: next });
  persistGrid(id, { gridOffsetSec: next });
}

/** Snap the grid downbeat (beat 0) to the current playhead position. */
export function snapGridToPlayhead(id: DeckId) {
  const ds = useApp.getState().decks[id];
  if (!ds.bpm) return;
  const beat = 60 / ds.bpm;
  const t = currentTime(id);
  let next = t % beat;
  if (next < 0) next += beat;
  useApp.getState().updateDeck(id, { gridOffsetSec: next });
  persistGrid(id, { gridOffsetSec: next });
  toast.success(tI18n("gridSet"));
}

/** Halve / double the track BPM (doesn't affect playback rate, only the grid + sync math). */
export function scaleBpm(id: DeckId, factor: 0.5 | 2) {
  const ds = useApp.getState().decks[id];
  if (!ds.bpm) return;
  const newBpm = Math.max(40, Math.min(300, ds.bpm * factor));
  useApp.getState().updateDeck(id, { bpm: newBpm });
  persistGrid(id, { bpm: newBpm });
}

/** Manually set the BPM to an exact value. */
export function setTrackBpm(id: DeckId, bpm: number) {
  const clamped = Math.max(40, Math.min(300, bpm));
  useApp.getState().updateDeck(id, { bpm: clamped });
  persistGrid(id, { bpm: clamped });
}

/** ===== Phrase markers (intro / verse / break / buildup / drop / outro) ===== */

export const PHRASE_TYPES: PhraseType[] = ["intro", "verse", "break", "buildup", "drop", "outro"];
export const PHRASE_COLORS: Record<PhraseType, string> = {
  intro:   "#7dd3fc",
  verse:   "#a78bfa",
  break:   "#fbbf24",
  buildup: "#f97316",
  drop:    "#ef4444",
  outro:   "#94a3b8",
};

function persistPhrases(id: DeckId, phrases: PhraseMarker[]) {
  const ds = useApp.getState().decks[id];
  if (!ds.trackId) return;
  void getTrack(ds.trackId).then((tr) => {
    if (!tr) return;
    putTrack({ ...tr, phrases });
  });
}

function nextPhraseType(after?: PhraseType): PhraseType {
  if (!after) return "intro";
  const idx = PHRASE_TYPES.indexOf(after);
  return PHRASE_TYPES[(idx + 1) % PHRASE_TYPES.length];
}

/** Add a phrase marker at the current playhead, cycling type if one already exists at the same position. */
export function addPhraseAtPlayhead(id: DeckId, type?: PhraseType) {
  const ds = useApp.getState().decks[id];
  if (!ds.duration) return;
  const pos = currentTime(id);
  const existingNearby = ds.phrases.find((p) => Math.abs(p.pos - pos) < 0.5);
  const nextType: PhraseType = type ?? nextPhraseType(existingNearby?.type);
  let phrases: PhraseMarker[];
  if (existingNearby) {
    phrases = ds.phrases.map((p) =>
      p.id === existingNearby.id
        ? { ...p, type: nextType, color: PHRASE_COLORS[nextType] }
        : p,
    );
  } else {
    const marker: PhraseMarker = {
      id: `ph_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      type: nextType,
      pos,
      color: PHRASE_COLORS[nextType],
    };
    phrases = [...ds.phrases, marker].sort((a, b) => a.pos - b.pos);
  }
  useApp.getState().updateDeck(id, { phrases });
  persistPhrases(id, phrases);
  toast.success(`${tI18n("phraseAdded")}: ${nextType.toUpperCase()}`);
}

/** Jump the playhead to a phrase marker. */
export function jumpPhrase(id: DeckId, phraseId: string) {
  const ds = useApp.getState().decks[id];
  const ph = ds.phrases.find((p) => p.id === phraseId);
  if (!ph || !ds.duration) return;
  seek(id, ph.pos);
  useApp.getState().updateDeck(id, { position: ph.pos / ds.duration });
}

/** Remove a single phrase marker. */
export function removePhrase(id: DeckId, phraseId: string) {
  const ds = useApp.getState().decks[id];
  const phrases = ds.phrases.filter((p) => p.id !== phraseId);
  useApp.getState().updateDeck(id, { phrases });
  persistPhrases(id, phrases);
}

/** Clear all phrase markers from this deck's track. */
export function clearPhrases(id: DeckId) {
  useApp.getState().updateDeck(id, { phrases: [] });
  persistPhrases(id, []);
}

export function setDeckEQ(id: DeckId, band: "hi" | "mid" | "lo", v: number) {
  setEQ(id, band, v);
  useApp.getState().updateDeck(id, { [band]: v });
}
export function setDeckFilter(id: DeckId, v: number) {
  setFilter(id, v);
  useApp.getState().updateDeck(id, { filter: v });
}
export function setDeckGain(id: DeckId, v: number) {
  // Multiply by auto-gain compensation so quiet tracks become as loud as hot ones.
  setGain(id, v * dbToGain(getAutoGainDb(id)));
  useApp.getState().updateDeck(id, { gain: v });
}
export function setDeckFader(id: DeckId, v: number) {
  setFader(id, v);
  useApp.getState().updateDeck(id, { fader: v });
}
export function setDeckCue(id: DeckId, on: boolean) {
  setCue(id, on);
  useApp.getState().updateDeck(id, { pflCue: on });
}

/** Smooth vocal-cut (karaoke) per deck. amount: 0..1. */
export function setDeckVocalCut(id: DeckId, amount: number) {
  engSetVocalCut(id, amount);
  useApp.getState().updateDeck(id, { vocalCut: amount });
}

export function seekDeck(id: DeckId, normPos: number) {
  const d = getDeck(id);
  if (!d.buffer) return;
  seek(id, normPos * d.buffer.duration);
  useApp.getState().updateDeck(id, { position: normPos });
}

export function nudgeDeck(id: DeckId, deltaSec: number) {
  nudge(id, deltaSec);
}

// ===== Scratch (vinyl-style) =====
import { beginScratch as engBeginScratch, scratchMove as engScratchMove, endScratch as engEndScratch } from "@/audio/scratch";

export async function beginScratchDeck(id: DeckId) {
  await ensureRunning();
  engBeginScratch(id);
}
export function scratchDeck(id: DeckId, deltaSec: number) {
  engScratchMove(id, deltaSec);
}
export function endScratchDeck(id: DeckId) {
  engEndScratch(id);
  // Sync UI playing state with audio (engine may have resumed).
  const d = getDeck(id);
  useApp.getState().updateDeck(id, { isPlaying: d.isPlaying });
}

export function setMasterVolume(v: number) {
  engSetMaster(v);
  useAppMasterRef.current = v;
  useApp.getState().updateMixer({ master: v });
}

export type MicOwner = "recorder" | "livevocal";

export async function setMicOn(on: boolean, owner: MicOwner = "recorder"): Promise<boolean> {
  await ensureRunning();
  const cur = useApp.getState().mixer;
  // If another panel already owns the mic, refuse so we don't stack two
  // voice paths on the same input (which would double the vocals).
  if (on && cur.micOn && cur.micOwner && cur.micOwner !== owner) {
    toast(tI18n("micBusyOther"));
    return false;
  }
  // Only the owning panel can turn the mic off.
  if (!on && cur.micOn && cur.micOwner && cur.micOwner !== owner) {
    return false;
  }
  if (on) {
    const s = useApp.getState().settings;
    const ok = await engEnableMic({
      deviceId: s.audioInputDeviceId || undefined,
      noiseSuppression: s.micNoiseSuppression ?? true,
      echoCancellation: s.micEchoCancellation ?? true,
      autoGainControl: s.micAutoGainControl ?? false,
    });
    if (!ok) {
      toast("No se pudo activar el micrófono");
      return false;
    }
    const lvl = useApp.getState().mixer.micLevel;
    const duck = useApp.getState().mixer.micDuck;
    if (useAppMasterRef.current === null) useAppMasterRef.current = useApp.getState().mixer.master;
    engSetMicLevel(lvl);
    engSetMicDuck(duck);
    useApp.getState().updateMixer({ micOn: true, micOwner: owner });
    return true;
  } else {
    engDisableMic();
    engSetMicDuck(0);
    useApp.getState().updateMixer({ micOn: false, micOwner: null });
    return true;
  }
}

export function setMicLevel(v: number) {
  engSetMicLevel(v);
  useApp.getState().updateMixer({ micLevel: v });
}

export function setMicDuck(v: number) {
  if (useApp.getState().mixer.micOn) engSetMicDuck(v);
  useApp.getState().updateMixer({ micDuck: v });
}

export function setLimiter(on: boolean) {
  engSetLimiter(on);
  useApp.getState().updateMixer({ limiter: on });
}

export function setXfaderPosition(pos: number) {
  const curve = useApp.getState().mixer.xfaderCurve;
  applyCrossfader(pos, curve);
  useApp.getState().updateMixer({ xfader: pos });
}

/**
 * Beat-Jump Quantize Global. When the master quantize toggle is on, snaps a
 * time (seconds) to the nearest beat in the deck's grid (uses the deck's BPM
 * + gridOffsetSec). When off, returns the input unchanged.
 */
export function quantizeIfEnabled(id: DeckId, sec: number): number {
  const quantize = useApp.getState().mixer.quantize;
  if (!quantize) return sec;
  const ds = useApp.getState().decks[id];
  if (!ds.bpm) return sec;
  const beat = 60 / ds.bpm;
  const off = ds.gridOffsetSec ?? 0;
  const snapped = Math.round((sec - off) / beat) * beat + off;
  return Math.max(0, snapped);
}

export function addHotCue(id: DeckId, slot: number) {
  const t = quantizeIfEnabled(id, currentTime(id));
  const palette = ["#ff3b6b", "#ffb000", "#19e1c3", "#7c5cff", "#ff7a18", "#19a7ff", "#a3ff19", "#ff19c4"];
  const ds = useApp.getState().decks[id];
  const cues = [...ds.hotCues.filter((c) => c.id !== slot), { id: slot, pos: t, color: palette[slot % 8] }];
  useApp.getState().updateDeck(id, { hotCues: cues });
  if (ds.trackId) {
    void getTrack(ds.trackId).then((tr) => {
      if (tr) putTrack({ ...tr, hotCues: cues });
    });
  }
}

export function jumpHotCue(id: DeckId, slot: number) {
  const ds = useApp.getState().decks[id];
  const cue = ds.hotCues.find((c) => c.id === slot);
  if (!cue) return;
  const target = quantizeIfEnabled(id, cue.pos);
  seek(id, target);
  const d = getDeck(id);
  if (d.buffer) {
    useApp.getState().updateDeck(id, { position: target / d.buffer.duration });
  }
}

export function deleteHotCue(id: DeckId, slot: number) {
  const ds = useApp.getState().decks[id];
  const cues = ds.hotCues.filter((c) => c.id !== slot);
  useApp.getState().updateDeck(id, { hotCues: cues });
}

/** Clear all hot cues on a deck. Also persists the change in the track record. */
export function clearHotCues(id: DeckId) {
  const ds = useApp.getState().decks[id];
  useApp.getState().updateDeck(id, { hotCues: [] });
  if (ds.trackId) {
    void getTrack(ds.trackId).then((tr) => {
      if (tr) putTrack({ ...tr, hotCues: [] });
    });
  }
}

/** Clear hot cues on every deck. */
export function clearAllHotCues() {
  (["A", "B", "C", "D"] as DeckId[]).forEach((id) => clearHotCues(id));
}

export function setLoop(id: DeckId, beats: number) {
  const ds = useApp.getState().decks[id];
  if (!ds.bpm) return;
  const start = currentTime(id);
  const end = start + (60 / ds.bpm) * beats;
  useApp.getState().updateDeck(id, { loopStart: start, loopEnd: end, loopActive: true });
}
export function clearLoop(id: DeckId) {
  useApp.getState().updateDeck(id, { loopStart: null, loopEnd: null, loopActive: false });
}
export function loopIn(id: DeckId) {
  useApp.getState().updateDeck(id, { loopStart: currentTime(id) });
}
export function loopOut(id: DeckId) {
  const ds = useApp.getState().decks[id];
  if (ds.loopStart === null) return;
  let end = currentTime(id);
  if (end <= ds.loopStart + 0.05) end = ds.loopStart + 0.25;
  useApp.getState().updateDeck(id, { loopEnd: end, loopActive: true });
}
export function loopHalve(id: DeckId) {
  const ds = useApp.getState().decks[id];
  if (ds.loopStart === null || ds.loopEnd === null) return;
  const len = (ds.loopEnd - ds.loopStart) / 2;
  if (len < 0.02) return;
  useApp.getState().updateDeck(id, { loopEnd: ds.loopStart + len });
}
export function loopDouble(id: DeckId) {
  const ds = useApp.getState().decks[id];
  if (ds.loopStart === null || ds.loopEnd === null) return;
  const len = (ds.loopEnd - ds.loopStart) * 2;
  useApp.getState().updateDeck(id, { loopEnd: ds.loopStart + len });
}

export function toggleLoop(id: DeckId) {
  const ds = useApp.getState().decks[id];
  if (ds.loopStart !== null && ds.loopEnd !== null) {
    useApp.getState().updateDeck(id, { loopActive: !ds.loopActive });
  }
}

/**
 * Saved Loops — Serato/Rekordbox-style: 8 slots per deck (id 0..7).
 * Each slot persists with the track via the library DB.
 */
const SAVED_LOOP_COLORS = [
  "#ff5b6a", "#ffb33a", "#ffe66b", "#67e8a3",
  "#5ad6ff", "#7c8cff", "#c39bff", "#ff8be0",
];

export function saveLoopSlot(id: DeckId, slot: number) {
  const ds = useApp.getState().decks[id];
  if (ds.loopStart === null || ds.loopEnd === null) return false;
  const next = ds.savedLoops.filter((l) => l.id !== slot);
  next.push({
    id: slot,
    start: ds.loopStart,
    end: ds.loopEnd,
    color: SAVED_LOOP_COLORS[slot % SAVED_LOOP_COLORS.length],
  });
  next.sort((a, b) => a.id - b.id);
  useApp.getState().updateDeck(id, { savedLoops: next });
  if (ds.trackId) {
    void getTrack(ds.trackId).then((tr) => { if (tr) putTrack({ ...tr, savedLoops: next }); });
  }
  return true;
}

export function recallLoopSlot(id: DeckId, slot: number) {
  const ds = useApp.getState().decks[id];
  const loop = ds.savedLoops.find((l) => l.id === slot);
  if (!loop) return false;
  useApp.getState().updateDeck(id, {
    loopStart: loop.start,
    loopEnd: loop.end,
    loopActive: true,
  });
  // Jump play position to loop start for instant entry.
  seek(id, loop.start);
  useApp.getState().updateDeck(id, { position: loop.start / Math.max(0.001, ds.duration) });
  return true;
}

export function clearLoopSlot(id: DeckId, slot: number) {
  const ds = useApp.getState().decks[id];
  const next = ds.savedLoops.filter((l) => l.id !== slot);
  if (next.length === ds.savedLoops.length) return false;
  useApp.getState().updateDeck(id, { savedLoops: next });
  if (ds.trackId) {
    void getTrack(ds.trackId).then((tr) => { if (tr) putTrack({ ...tr, savedLoops: next }); });
  }
  return true;
}

/**
 * Loop Roll — Serato/Rekordbox style "press & hold" stutter loop.
 * While held, the deck repeats `beats` of audio (e.g. 1/8, 1/4, 1/2, 1).
 * On release, playback returns to the "ghost playhead": the position the
 * track would have reached if it had kept playing forward through the roll.
 */
const rollState = new Map<DeckId, {
  startedAt: number;       // performance.now() when roll began
  ghostStart: number;      // currentTime(deck) when roll began (in seconds)
  prevLoopStart: number | null;
  prevLoopEnd: number | null;
  prevLoopActive: boolean;
  wasPlaying: boolean;
}>();

export function beginLoopRoll(id: DeckId, beats: number) {
  const ds = useApp.getState().decks[id];
  if (!ds.bpm) return;
  const d = getDeck(id);
  if (!d.buffer) return;
  // Don't stack rolls
  if (rollState.has(id)) return;
  const start = currentTime(id);
  const end = start + (60 / ds.bpm) * beats;
  rollState.set(id, {
    startedAt: performance.now(),
    ghostStart: start,
    prevLoopStart: ds.loopStart,
    prevLoopEnd: ds.loopEnd,
    prevLoopActive: ds.loopActive,
    wasPlaying: d.isPlaying,
  });
  useApp.getState().updateDeck(id, { loopStart: start, loopEnd: end, loopActive: true });
  if (!d.isPlaying) play(id, start);
}

export function endLoopRoll(id: DeckId) {
  const st = rollState.get(id);
  if (!st) return;
  rollState.delete(id);
  const d = getDeck(id);
  if (!d.buffer) {
    useApp.getState().updateDeck(id, {
      loopStart: st.prevLoopStart,
      loopEnd: st.prevLoopEnd,
      loopActive: st.prevLoopActive,
    });
    return;
  }
  const elapsed = (performance.now() - st.startedAt) / 1000;
  // Account for current playback rate so the ghost matches what would have played.
  const ghost = Math.min(d.buffer.duration - 0.05, st.ghostStart + elapsed * d.playbackRate);
  // Restore previous loop config (usually none) and jump to ghost playhead.
  useApp.getState().updateDeck(id, {
    loopStart: st.prevLoopStart,
    loopEnd: st.prevLoopEnd,
    loopActive: st.prevLoopActive,
  });
  seek(id, ghost);
  useApp.getState().updateDeck(id, { position: ghost / d.buffer.duration });
  if (st.wasPlaying && !d.isPlaying) play(id, ghost);
}

/**
 * Censor — momentary reverse. While held, audio plays backwards.
 * On release, returns to forward playback at the "ghost playhead" (where the
 * track would have been if it had kept playing forward).
 */
import { setReverse as engSetReverse } from "@/audio/transport";
const censorState = new Map<DeckId, { startedAt: number; ghostStart: number; wasPlaying: boolean }>();

export function beginCensor(id: DeckId) {
  const d = getDeck(id);
  if (!d.buffer) return;
  if (censorState.has(id)) return;
  const ds = useApp.getState().decks[id];
  censorState.set(id, {
    startedAt: performance.now(),
    ghostStart: currentTime(id),
    wasPlaying: d.isPlaying,
  });
  if (!ds.reverse) engSetReverse(id, true);
  if (!d.isPlaying) play(id, currentTime(id));
}

export function endCensor(id: DeckId) {
  const st = censorState.get(id);
  if (!st) return;
  censorState.delete(id);
  const d = getDeck(id);
  const ds = useApp.getState().decks[id];
  if (ds.reverse) engSetReverse(id, false);
  if (!d.buffer) return;
  const elapsed = (performance.now() - st.startedAt) / 1000;
  const ghost = Math.min(d.buffer.duration - 0.05, Math.max(0, st.ghostStart + elapsed * d.playbackRate));
  seek(id, ghost);
  useApp.getState().updateDeck(id, { position: ghost / d.buffer.duration });
  if (st.wasPlaying && !d.isPlaying) play(id, ghost);
}

/**
 * Slicer — Pioneer/Serato style. The active bar (8 slices) is anchored to the
 * playhead the moment the user presses a slice pad. Each pad jumps to the
 * corresponding slice and loops it for as long as it's held. On release we
 * return to the "ghost playhead" (where the track would have been if it had
 * kept playing forward). This keeps the mix in time with the master deck.
 */
const sliceState = new Map<DeckId, {
  startedAt: number;
  ghostStart: number;
  prevLoopStart: number | null;
  prevLoopEnd: number | null;
  prevLoopActive: boolean;
  wasPlaying: boolean;
  /** Anchor point of slice 0 (in seconds) for the current bar. */
  anchor: number;
  beatsPerSlice: number;
}>();

/** Begin holding slice `index` (0..7). `beatsPerSlice` defaults to 1. */
export function beginSlice(id: DeckId, index: number, beatsPerSlice = 1) {
  const ds = useApp.getState().decks[id];
  if (!ds.bpm) return;
  const d = getDeck(id);
  if (!d.buffer) return;
  if (sliceState.has(id)) return; // don't stack
  const beat = 60 / ds.bpm;
  const sliceLen = beat * beatsPerSlice;
  const barLen = sliceLen * 8;
  const now = currentTime(id);
  // Anchor the bar to the start of the bar containing the current playhead,
  // respecting the track's beat-grid offset (downbeat) when set.
  const off = ds.gridOffsetSec ?? 0;
  const anchor = Math.max(0, Math.floor((now - off) / barLen) * barLen + off);
  const start = Math.min(d.buffer.duration - 0.05, anchor + index * sliceLen);
  const end = Math.min(d.buffer.duration - 0.01, start + sliceLen);
  sliceState.set(id, {
    startedAt: performance.now(),
    ghostStart: now,
    prevLoopStart: ds.loopStart,
    prevLoopEnd: ds.loopEnd,
    prevLoopActive: ds.loopActive,
    wasPlaying: d.isPlaying,
    anchor,
    beatsPerSlice,
  });
  useApp.getState().updateDeck(id, { loopStart: start, loopEnd: end, loopActive: true });
  seek(id, start);
  if (!d.isPlaying) play(id, start);
}

/** Release the slice — restore previous loop and jump to ghost playhead. */
export function endSlice(id: DeckId) {
  const st = sliceState.get(id);
  if (!st) return;
  sliceState.delete(id);
  const d = getDeck(id);
  if (!d.buffer) {
    useApp.getState().updateDeck(id, {
      loopStart: st.prevLoopStart,
      loopEnd: st.prevLoopEnd,
      loopActive: st.prevLoopActive,
    });
    return;
  }
  const elapsed = (performance.now() - st.startedAt) / 1000;
  const ghost = Math.min(d.buffer.duration - 0.05, st.ghostStart + elapsed * d.playbackRate);
  useApp.getState().updateDeck(id, {
    loopStart: st.prevLoopStart,
    loopEnd: st.prevLoopEnd,
    loopActive: st.prevLoopActive,
  });
  seek(id, ghost);
  useApp.getState().updateDeck(id, { position: ghost / d.buffer.duration });
  if (st.wasPlaying && !d.isPlaying) play(id, ghost);
}

/**
 * Pitch Play — Pioneer/Serato style. Plays a hot cue with a temporary
 * pitch shift (semitones) by adjusting the playback rate. Each press
 * jumps to the cue and applies the shift; release restores the deck's
 * original pitch (from the user's pitch fader). Without keyLock the song
 * also changes tempo — same trade-off Serato makes when keyLock is off.
 */
const pitchPlayState = new Map<DeckId, { prevRate: number; prevOffset: number; wasPlaying: boolean }>();

export function beginPitchPlay(id: DeckId, slot: number, semitones: number) {
  const ds = useApp.getState().decks[id];
  const cue = ds.hotCues.find((c) => c.id === slot);
  if (!cue) return;
  const d = getDeck(id);
  if (!d.buffer) return;
  // Save previous state if not already in a press (allow re-trigger across pads).
  const prev = pitchPlayState.get(id);
  if (!prev) {
    pitchPlayState.set(id, {
      prevRate: d.playbackRate,
      prevOffset: currentTime(id),
      wasPlaying: d.isPlaying,
    });
  }
  const baseRate = (prev?.prevRate ?? d.playbackRate);
  const shift = Math.pow(2, semitones / 12);
  setPlaybackRate(id, baseRate * shift);
  seek(id, cue.pos);
  if (!d.isPlaying) play(id, cue.pos);
}

export function endPitchPlay(id: DeckId) {
  const st = pitchPlayState.get(id);
  if (!st) return;
  pitchPlayState.delete(id);
  setPlaybackRate(id, st.prevRate);
  // Stop the cue if the deck wasn't playing before pitch-play started.
  if (!st.wasPlaying) {
    const d = getDeck(id);
    if (d.isPlaying) pause(id);
    useApp.getState().updateDeck(id, { isPlaying: false });
  }
}

// ===== Voice-over presets =====
export function setVoicePreset(presetId: string) {
  const p = VOICE_PRESETS.find((x) => x.id === presetId) ?? VOICE_PRESETS[0];
  applyVoicePreset(p);
  useApp.getState().updateMixer({ micPreset: p.id });
}

// ===== Mix Presets (DJ recipes) =====
import type { MixPreset } from "@/lib/mixPresets";
import { DEFAULT_MIX_PRESETS, genPresetId } from "@/lib/mixPresets";

/** Apply a mix preset to a target deck. EQ/Filter/VocalCut + optional FX slot. */
export function applyMixPreset(presetId: string, deckId: DeckId) {
  const p = useApp.getState().mixPresets.find((x) => x.id === presetId);
  if (!p) return;
  if (typeof p.hi === "number") setDeckEQ(deckId, "hi", p.hi);
  if (typeof p.mid === "number") setDeckEQ(deckId, "mid", p.mid);
  if (typeof p.lo === "number") setDeckEQ(deckId, "lo", p.lo);
  if (typeof p.filter === "number") setDeckFilter(deckId, p.filter);
  if (typeof p.vocalCut === "number") setDeckVocalCut(deckId, p.vocalCut);
  if (p.fx) {
    useApp.getState().updateFx(p.fx.slot, {
      kind: p.fx.kind,
      wet: p.fx.wet,
      param1: p.fx.param1,
      param2: p.fx.param2,
    });
  }
  toast.success(`${p.emoji} ${p.name} → Deck ${deckId}`);
}

/** Capture current deck state into a new user preset. */
export function captureMixPreset(deckId: DeckId, name: string): MixPreset {
  const ds = useApp.getState().decks[deckId];
  const fx1 = useApp.getState().fx[0];
  const preset: MixPreset = {
    id: genPresetId(),
    name: name.trim() || "Mi preset",
    description: `Capturado desde Deck ${deckId}`,
    emoji: "🎚️",
    hi: ds.hi,
    mid: ds.mid,
    lo: ds.lo,
    filter: ds.filter,
    vocalCut: ds.vocalCut,
    fx: fx1.kind === "off" ? undefined : { slot: 1, kind: fx1.kind, wet: fx1.wet, param1: fx1.param1, param2: fx1.param2 },
  };
  useApp.getState().upsertMixPreset(preset);
  toast.success("Preset guardado", { description: preset.name });
  return preset;
}

export function deleteMixPreset(id: string) {
  const p = useApp.getState().mixPresets.find((x) => x.id === id);
  if (!p) return;
  if (p.builtin) {
    toast("Los presets por defecto no pueden eliminarse");
    return;
  }
  useApp.getState().removeMixPreset(id);
  toast("Preset eliminado");
}

/** Restore the 5 default presets (keeps user-created ones). */
export function resetDefaultMixPresets() {
  const cur = useApp.getState().mixPresets;
  const userOnly = cur.filter((p) => !p.builtin);
  useApp.getState().setMixPresets([...DEFAULT_MIX_PRESETS, ...userOnly]);
  toast.success("Presets por defecto restaurados");
}

// ===== Numpad target deck =====
let manualNumpadOverrideAt = 0;
const MANUAL_OVERRIDE_MS = 6000;

/** Mark deck as the "currently in use" target. Respects manual override window. */
export function markActiveDeck(id: DeckId) {
  const m = useApp.getState().mixer;
  if (!m.autoActiveDeck) return;
  if (Date.now() - manualNumpadOverrideAt < MANUAL_OVERRIDE_MS) return;
  if (m.numpadDeck === id) return;
  useApp.getState().updateMixer({ numpadDeck: id });
}

export function setNumpadDeck(id: DeckId) {
  manualNumpadOverrideAt = Date.now();
  useApp.getState().updateMixer({ numpadDeck: id });
  toast(`Numpad → Deck ${id}`);
}

// ===== Radio mode =====
export function radioEnable(on: boolean) {
  useApp.getState().updateRadio({ enabled: on });
  if (on) toast.success("Modo Radio activado", { description: "Las pistas en cola sonarán una tras otra en Deck A." });
  else toast("Modo Radio apagado");
  const stream = useApp.getState().stream;
  if (stream.enabled && stream.autoStartWithRadio) {
    if (on && stream.status === "idle") void startLiveStream();
    else if (!on && stream.status === "live") void stopLiveStream();
  }
}

export function radioAdd(trackId: string) {
  const r = useApp.getState().radio;
  if (r.queue.includes(trackId)) return;
  useApp.getState().updateRadio({ queue: [...r.queue, trackId] });
  toast("Añadida a la cola de Radio");
}

export function radioRemove(idx: number) {
  const r = useApp.getState().radio;
  const next = r.queue.filter((_, i) => i !== idx);
  let cur = r.currentIndex;
  if (idx < cur) cur -= 1;
  else if (idx === cur) cur = -1;
  useApp.getState().updateRadio({ queue: next, currentIndex: cur });
}

export function radioMove(idx: number, dir: -1 | 1) {
  const r = useApp.getState().radio;
  const ni = idx + dir;
  if (ni < 0 || ni >= r.queue.length) return;
  const next = [...r.queue];
  [next[idx], next[ni]] = [next[ni], next[idx]];
  useApp.getState().updateRadio({ queue: next });
}

export function radioClear() {
  useApp.getState().updateRadio({ queue: [], currentIndex: -1 });
}

let radioBusy = false;
export async function radioNext(): Promise<void> {
  if (radioBusy) return;
  radioBusy = true;
  try {
    const r = useApp.getState().radio;
    if (r.queue.length === 0) {
      useApp.getState().updateRadio({ currentIndex: -1 });
      return;
    }
    let next: number;
    if (r.shuffle) {
      next = Math.floor(Math.random() * r.queue.length);
      if (r.queue.length > 1 && next === r.currentIndex) next = (next + 1) % r.queue.length;
    } else {
      next = (r.currentIndex + 1) % r.queue.length;
    }
    const trackId = r.queue[next];
    useApp.getState().updateRadio({ currentIndex: next });
    await loadTrackToDeck("A", trackId);
    await togglePlay("A");
  } finally {
    setTimeout(() => { radioBusy = false; }, 600);
  }
}

export async function radioPlayIndex(idx: number): Promise<void> {
  const r = useApp.getState().radio;
  if (idx < 0 || idx >= r.queue.length) return;
  useApp.getState().updateRadio({ currentIndex: idx - 1 });
  await radioNext();
}

// ===== Radio segments =====
function genId() {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

const SEGMENT_PALETTE = ["#ff3b6b", "#ffb000", "#19e1c3", "#7c5cff", "#ff7a18", "#19a7ff", "#a3ff19", "#ff19c4"];

export function createSegment(name: string): RadioSegment {
  const segs = useApp.getState().segments;
  const seg: RadioSegment = {
    id: genId(),
    name: name.trim() || "Nuevo segmento",
    color: SEGMENT_PALETTE[segs.length % SEGMENT_PALETTE.length],
    trackIds: [],
    scheduledAt: null,
    recurring: true,
    createdAt: Date.now(),
  };
  useApp.getState().upsertSegment(seg);
  toast.success("Segmento creado", { description: seg.name });
  return seg;
}

export function renameSegment(id: string, name: string) {
  const s = useApp.getState().segments.find((x) => x.id === id);
  if (!s) return;
  useApp.getState().upsertSegment({ ...s, name: name.trim() || s.name });
}

export function deleteSegment(id: string) {
  useApp.getState().removeSegment(id);
  toast("Segmento eliminado");
}

export function addTrackToSegment(segmentId: string, trackId: string) {
  const s = useApp.getState().segments.find((x) => x.id === segmentId);
  if (!s) return;
  if (s.trackIds.includes(trackId)) return;
  useApp.getState().upsertSegment({ ...s, trackIds: [...s.trackIds, trackId] });
}

export function removeTrackFromSegment(segmentId: string, trackId: string) {
  const s = useApp.getState().segments.find((x) => x.id === segmentId);
  if (!s) return;
  useApp.getState().upsertSegment({ ...s, trackIds: s.trackIds.filter((t) => t !== trackId) });
}

export function setSegmentSchedule(segmentId: string, time: string | null, recurring: boolean) {
  const s = useApp.getState().segments.find((x) => x.id === segmentId);
  if (!s) return;
  useApp.getState().upsertSegment({ ...s, scheduledAt: time, recurring });
}

/** Set the days of week (0=Sun..6=Sat) when the segment schedule applies. Empty array = every day. */
export function setSegmentDays(segmentId: string, days: number[]) {
  const s = useApp.getState().segments.find((x) => x.id === segmentId);
  if (!s) return;
  useApp.getState().upsertSegment({ ...s, scheduledDays: days.slice().sort() });
}

/** Configure a jingle that plays every N tracks while this segment is the current queue source. */
export function setSegmentJingle(segmentId: string, jingleTrackId: string | null, every: number) {
  const s = useApp.getState().segments.find((x) => x.id === segmentId);
  if (!s) return;
  useApp.getState().upsertSegment({ ...s, jingleTrackId, jingleEvery: Math.max(1, every) });
}

/** Duplicate a segment (deep copy) and append "(copia)" to the name. */
export function duplicateSegment(segmentId: string): RadioSegment | null {
  const s = useApp.getState().segments.find((x) => x.id === segmentId);
  if (!s) return null;
  const copy: RadioSegment = {
    ...s,
    id: genId(),
    name: `${s.name} (copia)`,
    trackIds: [...s.trackIds],
    scheduledAt: null,
    scheduledDays: s.scheduledDays ? [...s.scheduledDays] : undefined,
    createdAt: Date.now(),
  };
  useApp.getState().upsertSegment(copy);
  toast.success("Segmento duplicado", { description: copy.name });
  return copy;
}

/** Returns the next scheduled segment + minutes until it fires, or null if none. */
export function getNextScheduledSegment(): { segment: RadioSegment; minutesUntil: number } | null {
  const segs = useApp.getState().segments.filter((s) => !!s.scheduledAt);
  if (segs.length === 0) return null;
  const now = new Date();
  const dayNow = now.getDay();
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  let best: { segment: RadioSegment; minutesUntil: number } | null = null;
  for (const s of segs) {
    const [hh, mm] = (s.scheduledAt ?? "").split(":").map((x) => parseInt(x, 10));
    if (Number.isNaN(hh) || Number.isNaN(mm)) continue;
    const target = hh * 60 + mm;
    const days = s.scheduledDays && s.scheduledDays.length > 0 ? s.scheduledDays : [0, 1, 2, 3, 4, 5, 6];
    let minWait = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 7; i++) {
      const day = (dayNow + i) % 7;
      if (!days.includes(day)) continue;
      const wait = i === 0 ? (target - minutesNow + (target <= minutesNow ? 24 * 60 : 0)) : (i * 24 * 60 - minutesNow + target);
      if (wait < minWait) minWait = wait;
    }
    if (!best || minWait < best.minutesUntil) best = { segment: s, minutesUntil: minWait };
  }
  return best;
}

/** Replace radio queue with segment tracks (or append). */
export async function loadSegmentToRadio(segmentId: string, mode: "replace" | "append" = "replace") {
  const s = useApp.getState().segments.find((x) => x.id === segmentId);
  if (!s) return;
  if (s.trackIds.length === 0) {
    toast("El segmento está vacío");
    return;
  }
  const r = useApp.getState().radio;
  const queue = mode === "replace" ? [...s.trackIds] : [...r.queue, ...s.trackIds];
  useApp.getState().updateRadio({ queue, currentIndex: mode === "replace" ? -1 : r.currentIndex });
  toast(`Segmento "${s.name}" → cola (${s.trackIds.length} pistas)`);
  if (mode === "replace" && useApp.getState().radio.enabled) {
    await radioNext();
  }
}

// ===== Segment scheduler — checks every minute =====
let schedulerStarted = false;
let lastFiredKey: string | null = null;
export function startSegmentScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;
  setInterval(() => {
    const radio = useApp.getState().radio;
    if (!radio.enabled) return;
    const segs = useApp.getState().segments.filter((s) => !!s.scheduledAt);
    if (segs.length === 0) return;
    const now = new Date();
    const dow = now.getDay();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const dayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${hhmm}`;
    for (const s of segs) {
      if (s.scheduledAt !== hhmm) continue;
      // Respect day-of-week filter if set.
      if (s.scheduledDays && s.scheduledDays.length > 0 && !s.scheduledDays.includes(dow)) continue;
      const key = `${s.id}-${dayKey}`;
      if (lastFiredKey === key) continue;
      lastFiredKey = key;
      void loadSegmentToRadio(s.id, "replace");
      toast.success(`📻 Segmento programado: ${s.name}`);
    }
  }, 30_000);
}

// ===== Live streaming =====
export function initStreamStatus() {
  setStreamStatusListener((info) => {
    const cur = useApp.getState().stream;
    useApp.getState().updateStream({
      status: info.status,
      bytesSent: info.bytesSent,
      lastError: info.error ?? null,
      startedAt: info.status === "live" && cur.startedAt === null ? Date.now() : cur.startedAt,
    });
    // Auto-reconnect on error if user opted in.
    const settings = useApp.getState().settings;
    if (info.status === "error" && settings.streamAutoReconnect) {
      try { scheduleReconnect(); } catch { /* noop */ }
    }
  });
}

export async function startLiveStream() {
  const cfg = useApp.getState().stream;
  if (!cfg.enabled) {
    toast("Activa la transmisión en Ajustes primero");
    return;
  }
  try {
    useApp.getState().updateStream({ status: "connecting", lastError: null, bytesSent: 0, startedAt: null });
    await engStartStream(cfg);
    toast.success("🔴 Transmisión en vivo iniciada");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    useApp.getState().updateStream({ status: "error", lastError: msg });
    toast.error("No se pudo iniciar la transmisión", { description: msg });
  }
}

export async function stopLiveStream() {
  await engStopStream();
  useApp.getState().updateStream({ status: "idle", startedAt: null });
  toast("Transmisión detenida");
}

export function isLiveStreaming() {
  return isStreaming();
}

// ===== Folders =====
export async function refreshFolders() {
  const f = await listFolders();
  useApp.getState().setFolders(f);
}

export async function createFolder(name: string, parentId: string | null = null): Promise<FolderRecord> {
  const f: FolderRecord = {
    id: Math.random().toString(36).slice(2, 11) + Date.now().toString(36),
    name: name.trim() || "Nueva carpeta",
    parentId,
    createdAt: Date.now(),
  };
  await putFolder(f);
  await refreshFolders();
  return f;
}

export async function renameFolder(id: string, name: string) {
  const all = await listFolders();
  const f = all.find((x) => x.id === id);
  if (!f) return;
  await putFolder({ ...f, name });
  await refreshFolders();
}

export async function removeFolder(id: string) {
  // Recursively delete children + unset folderId on tracks
  const all = await listFolders();
  const toDelete = new Set<string>();
  const collect = (parent: string) => {
    toDelete.add(parent);
    all.filter((x) => x.parentId === parent).forEach((c) => collect(c.id));
  };
  collect(id);
  for (const fid of toDelete) {
    await dbDeleteFolder(fid);
  }
  // Move tracks in deleted folders to root
  const tracks = useApp.getState().tracks;
  for (const t of tracks) {
    if (t.folderId && toDelete.has(t.folderId)) {
      await putTrack({ ...t, folderId: null });
    }
  }
  await refreshFolders();
}

export async function moveTrackToFolder(trackId: string, folderId: string | null) {
  const t = await getTrack(trackId);
  if (!t) return;
  await putTrack({ ...t, folderId });
}

// Re-exports for convenience
export { getVideo };

// ===== Backup: export/import full config =====
export interface BackupBundle {
  version: 1;
  exportedAt: number;
  skin: string;
  settings: ReturnType<typeof useApp.getState>["settings"];
  mixer: ReturnType<typeof useApp.getState>["mixer"];
  radio: ReturnType<typeof useApp.getState>["radio"];
  videoMix: ReturnType<typeof useApp.getState>["videoMix"];
  midi: ReturnType<typeof useApp.getState>["midi"];
  segments: RadioSegment[];
  stream: ReturnType<typeof useApp.getState>["stream"];
}

export function exportBackup(): BackupBundle {
  const s = useApp.getState();
  return {
    version: 1,
    exportedAt: Date.now(),
    skin: s.skin,
    settings: s.settings,
    mixer: s.mixer,
    radio: s.radio,
    videoMix: s.videoMix,
    midi: s.midi,
    segments: s.segments,
    stream: { ...s.stream, password: "" }, // never export the password
  };
}

export function downloadBackup(): void {
  const data = exportBackup();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vdj-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast.success("Backup descargado");
}

export function importBackup(bundle: unknown): boolean {
  try {
    const b = bundle as Partial<BackupBundle>;
    if (!b || typeof b !== "object") throw new Error("Bundle inválido");
    const s = useApp.getState();
    if (b.skin) s.setSkin(b.skin as never);
    if (b.settings) s.updateSettings(b.settings);
    if (b.mixer) s.updateMixer(b.mixer);
    if (b.radio) s.updateRadio(b.radio);
    if (b.videoMix) s.updateVideoMix(b.videoMix);
    if (b.segments) s.setSegments(b.segments);
    if (b.stream) s.updateStream({ ...b.stream, password: s.stream.password }); // keep current password
    toast.success("Backup importado");
    return true;
  } catch (err) {
    toast.error("No se pudo importar el backup", { description: err instanceof Error ? err.message : String(err) });
    return false;
  }
}