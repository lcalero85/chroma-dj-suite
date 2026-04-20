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
} from "@/audio/deck";
import { applyCrossfader } from "@/audio/crossfader";
import { detectBPM, extractPeaks, extractBandPeaks } from "@/audio/analysis/bpm";
import { getTrack, putTrack, type TrackRecord, listFolders, putFolder, deleteFolder as dbDeleteFolder, type FolderRecord } from "@/lib/db";
import { pseudoDetectKey } from "@/lib/camelot";
import { toast } from "sonner";
import { setVideo, clearVideo, syncVideo, getVideo, isVideoBlob } from "@/audio/videoDeck";

let pollStarted = false;

export function startPositionPolling() {
  if (pollStarted) return;
  pollStarted = true;
  const tick = () => {
    const state = useApp.getState();
    state.activeDecks.forEach((id) => {
      const d = getDeck(id);
      if (!d.buffer) return;
      const t = currentTime(id);
      const dur = d.buffer.duration;
      const ds = state.decks[id];
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
  const updated: TrackRecord = { ...t, bpm, key, peaks, bands, lastPlayed: Date.now() };
  await putTrack(updated);

  useApp.getState().updateDeck(deckId, {
    trackId: t.id,
    title: t.title,
    artist: t.artist,
    duration: buffer.duration,
    position: 0,
    isPlaying: false,
    bpm,
    key,
    peaks,
    bands: bands ?? null,
    hotCues: t.hotCues ?? [],
    cuePoint: 0,
    loopStart: null,
    loopEnd: null,
    loopActive: false,
    hasVideo: isVideo,
  });
  toast(`Cargada en Deck ${deckId}`, { description: t.title });
}

export async function togglePlay(id: DeckId) {
  await ensureRunning();
  const d = getDeck(id);
  if (!d.buffer) return;
  if (d.isPlaying) pause(id);
  else play(id);
  useApp.getState().updateDeck(id, { isPlaying: d.isPlaying });
}

export function cueDeck(id: DeckId) {
  const d = getDeck(id);
  const ds = useApp.getState().decks[id];
  if (!d.buffer) return;
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

export function setDeckEQ(id: DeckId, band: "hi" | "mid" | "lo", v: number) {
  setEQ(id, band, v);
  useApp.getState().updateDeck(id, { [band]: v });
}
export function setDeckFilter(id: DeckId, v: number) {
  setFilter(id, v);
  useApp.getState().updateDeck(id, { filter: v });
}
export function setDeckGain(id: DeckId, v: number) {
  setGain(id, v);
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

export function seekDeck(id: DeckId, normPos: number) {
  const d = getDeck(id);
  if (!d.buffer) return;
  seek(id, normPos * d.buffer.duration);
  useApp.getState().updateDeck(id, { position: normPos });
}

export function nudgeDeck(id: DeckId, deltaSec: number) {
  nudge(id, deltaSec);
}

export function setMasterVolume(v: number) {
  engSetMaster(v);
  useAppMasterRef.current = v;
  useApp.getState().updateMixer({ master: v });
}

export async function setMicOn(on: boolean): Promise<boolean> {
  await ensureRunning();
  if (on) {
    const ok = await engEnableMic();
    if (!ok) {
      toast("No se pudo activar el micrófono");
      return false;
    }
    const lvl = useApp.getState().mixer.micLevel;
    engSetMicLevel(lvl);
    const duck = useApp.getState().mixer.micDuck;
    if (useAppMasterRef.current === null) useAppMasterRef.current = useApp.getState().mixer.master;
    engSetMicDuck(duck);
    useApp.getState().updateMixer({ micOn: true });
    return true;
  } else {
    engDisableMic();
    engSetMicDuck(0);
    useApp.getState().updateMixer({ micOn: false });
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

export function addHotCue(id: DeckId, slot: number) {
  const quantize = useApp.getState().mixer.quantize;
  let t = currentTime(id);
  if (quantize) {
    const ds = useApp.getState().decks[id];
    if (ds.bpm) {
      const beat = 60 / ds.bpm;
      t = Math.round(t / beat) * beat;
    }
  }
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
  seek(id, cue.pos);
  const d = getDeck(id);
  if (d.buffer) {
    useApp.getState().updateDeck(id, { position: cue.pos / d.buffer.duration });
  }
}

export function deleteHotCue(id: DeckId, slot: number) {
  const ds = useApp.getState().decks[id];
  const cues = ds.hotCues.filter((c) => c.id !== slot);
  useApp.getState().updateDeck(id, { hotCues: cues });
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

// ===== Voice-over presets =====
export function setVoicePreset(presetId: string) {
  const p = VOICE_PRESETS.find((x) => x.id === presetId) ?? VOICE_PRESETS[0];
  applyVoicePreset(p);
  useApp.getState().updateMixer({ micPreset: p.id });
}

// ===== Numpad target deck =====
export function setNumpadDeck(id: DeckId) {
  useApp.getState().updateMixer({ numpadDeck: id });
  toast(`Numpad → Deck ${id}`);
}

// ===== Radio mode =====
export function radioEnable(on: boolean) {
  useApp.getState().updateRadio({ enabled: on });
  if (on) toast.success("Modo Radio activado", { description: "Las pistas en cola sonarán una tras otra en Deck A." });
  else toast("Modo Radio apagado");
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