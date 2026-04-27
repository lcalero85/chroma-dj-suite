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
  setDeckGain,
  beginScratchDeck,
  scratchDeck,
  endScratchDeck,
  setDeckVocalCut,
} from "@/state/controller";
import { setPlaybackRate } from "@/audio/deck";
import { analyzeLoudness } from "@/audio/analysis/loudness";
import { startRecording, stopRecording, isRecording } from "@/audio/recorder";
import { listRecordings, putRecording, uid, type TrackRecord } from "@/lib/db";
import { toast } from "sonner";
import type { FxKind } from "@/audio/fx";
import { getEngine } from "@/audio/engine";
import { isCompatible, type CamelotKey } from "@/lib/camelot";
import { enableMic } from "@/audio/engine";
import { startStream, stopStream, updateStreamMetadata, isStreaming } from "@/audio/iceStreamer";
import { detectCamelotKey } from "@/audio/analysis/keyDetect";
import { generateMixReport, trackToReportEntry, type MixReportEntry } from "@/audio/mixReport";
import { setReverse } from "@/audio/transport";

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

export type VdjIntensity = "soft" | "normal" | "hard";

/** Multiplicadores y comportamientos derivados de la intensidad.
 *  Se aplican encima de la configuración del usuario sin reemplazarla. */
interface IntensityProfile {
  xfadeMul: number;       // multiplica xfadeSec del género
  fxWetMul: number;       // multiplica wet del FX de género
  filterDepth: number;    // 0..1 — profundidad máxima de los sweeps
  scratchCount: number;   // scratches por flourish
  scratchExtra: boolean;  // scratch adicional al inicio del incoming
  loopBeatsMul: number;   // multiplica beats del loop spice
  pitchBendAmt: number;   // ±pitch durante spice
  cutPctBoost: number;    // restado al cutPct (ej. 0.04 = corta 4% antes)
  duckTo: number;         // gain duck del outgoing en el crossfade
  eqKillLo: number;       // profundidad del kill de lows en spice (0..1)
  fxBeatSync: boolean;    // sincronizar FX al BPM
  acidEdge: boolean;      // FX extra "ácidos" (bitcrusher / phaser layer)
  spiceProb: number;      // probabilidad de hacer spice (0..1)
}

const INTENSITY_PROFILES: Record<VdjIntensity, IntensityProfile> = {
  soft: {
    xfadeMul: 1.4, fxWetMul: 0.7, filterDepth: 0.5, scratchCount: 1,
    scratchExtra: false, loopBeatsMul: 1.5, pitchBendAmt: 0.012,
    cutPctBoost: -0.04, duckTo: 0.7, eqKillLo: 0.5,
    fxBeatSync: true, acidEdge: false, spiceProb: 0.7,
  },
  normal: {
    xfadeMul: 1.0, fxWetMul: 1.0, filterDepth: 0.7, scratchCount: 2,
    scratchExtra: false, loopBeatsMul: 1.0, pitchBendAmt: 0.025,
    cutPctBoost: 0, duckTo: 0.55, eqKillLo: 0.9,
    fxBeatSync: true, acidEdge: false, spiceProb: 1.0,
  },
  hard: {
    xfadeMul: 0.6, fxWetMul: 1.25, filterDepth: 1.0, scratchCount: 5,
    scratchExtra: true, loopBeatsMul: 0.5, pitchBendAmt: 0.05,
    cutPctBoost: 0.06, duckTo: 0.35, eqKillLo: 1.0,
    fxBeatSync: true, acidEdge: true, spiceProb: 1.0,
  },
};

function getIntensity(): IntensityProfile {
  const lvl = (useApp.getState().settings.vdjIntensity ?? "normal") as VdjIntensity;
  return INTENSITY_PROFILES[lvl] ?? INTENSITY_PROFILES.normal;
}

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

/** ============ (v1.7.5) Cue points capture ============ */
interface CuePoint { trackIndex: number; timeSec: number; title: string; artist: string }
let cuePoints: CuePoint[] = [];
let recordingStartMs = 0;
function pushCue(idx: number, t: TrackRecord) {
  if (recordingStartMs === 0) return;
  const elapsed = (Date.now() - recordingStartMs) / 1000;
  cuePoints.push({ trackIndex: idx, timeSec: elapsed, title: t.title || "Track", artist: t.artist || "" });
}

/** ============ (v1.7.6 #4) Crowd Energy history ============ */
const ENERGY_HISTORY_MAX = 240; // ~4 min @ 1 Hz
let energyHistory: number[] = [];
let energyMonRaf: number | null = null;
let energyMonInterval: number | null = null;
let lastInstantEnergy = 0;

/** Returns the rolling crowd-energy curve (0..1 samples). */
export function getEnergyHistory(): number[] { return energyHistory.slice(); }
export function getInstantEnergy(): number { return lastInstantEnergy; }

function startEnergyMonitor() {
  stopEnergyMonitor();
  let buf: Uint8Array<ArrayBuffer> | null = null;
  const sampleTick = () => {
    try {
      const { masterAnalyser } = getEngine();
      if (!buf || buf.length !== masterAnalyser.fftSize) {
        buf = new Uint8Array(new ArrayBuffer(masterAnalyser.fftSize));
      }
      masterAnalyser.getByteTimeDomainData(buf);
      let s = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        s += v * v;
      }
      const rms = Math.sqrt(s / buf.length);
      lastInstantEnergy = Math.min(1, rms * 2.4);
    } catch { /* engine not ready */ }
    energyMonRaf = requestAnimationFrame(sampleTick);
  };
  energyMonRaf = requestAnimationFrame(sampleTick);
  energyMonInterval = window.setInterval(() => {
    energyHistory.push(lastInstantEnergy);
    if (energyHistory.length > ENERGY_HISTORY_MAX) energyHistory.shift();
  }, 1000);
}
function stopEnergyMonitor() {
  if (energyMonRaf !== null) cancelAnimationFrame(energyMonRaf);
  if (energyMonInterval !== null) clearInterval(energyMonInterval);
  energyMonRaf = null;
  energyMonInterval = null;
}

/** ============ (v1.7.6 #10) Mix report state ============ */
let reportEntries: MixReportEntry[] = [];
let reportFx: Record<string, number> = {};
function logFx(name: string) { reportFx[name] = (reportFx[name] ?? 0) + 1; }
function pushReportEntry(idx: number, t: TrackRecord, transitionInto?: string) {
  if (recordingStartMs === 0) return;
  const elapsed = (Date.now() - recordingStartMs) / 1000;
  reportEntries.push(trackToReportEntry(t, idx, elapsed, transitionInto, lastInstantEnergy));
}

/** ============ (v1.7.6 #1) Harmonic Mixing AI ============
 *  Reordena la cola de modo que cada salto sea Camelot-compatible.
 *  Pre-llena `t.key` para tracks que no la tengan, usando detectCamelotKey
 *  contra `getEngine().ctx.decodeAudioData(blob)` cuando sea posible. Si la
 *  pista no tiene blob accesible, usa el pseudoDetect (determinístico). */
async function ensureKeysForTracks(tracks: TrackRecord[]): Promise<void> {
  // Lazy import to avoid a hard dep cycle.
  const { getTrack } = await import("@/lib/db");
  const { ctx } = getEngine();
  for (const t of tracks) {
    if (t.key) continue;
    try {
      const full = await getTrack(t.id);
      if (!full || !full.blob) continue;
      const arr = await full.blob.arrayBuffer();
      const buf = await ctx.decodeAudioData(arr.slice(0));
      const key = await detectCamelotKey(buf, t.id);
      // Mutate the in-memory track object only (not persisted DB write — too heavy here).
      (t as TrackRecord & { key?: CamelotKey }).key = key;
    } catch { /* keep null */ }
  }
}

function planHarmonic(tracks: TrackRecord[]): TrackRecord[] {
  if (tracks.length < 3) return tracks;
  const remaining = [...tracks];
  const out: TrackRecord[] = [];
  // Start with the lowest-BPM compatible seed.
  remaining.sort((a, b) => (a.bpm ?? 200) - (b.bpm ?? 200));
  out.push(remaining.shift()!);
  while (remaining.length > 0) {
    const last = out[out.length - 1];
    const lastKey = last.key as CamelotKey | undefined;
    let bestIdx = 0;
    let bestScore = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const cand = remaining[i];
      let score = 0;
      const candKey = cand.key as CamelotKey | undefined;
      if (lastKey && candKey) {
        score += isCompatible(lastKey, candKey) ? 0 : 50;
      }
      // BPM jump penalty
      if (typeof last.bpm === "number" && typeof cand.bpm === "number") {
        const jump = Math.abs(cand.bpm - last.bpm) / last.bpm;
        score += jump * 80;
      }
      if (score < bestScore) { bestScore = score; bestIdx = i; }
    }
    out.push(remaining.splice(bestIdx, 1)[0]);
  }
  return out;
}

/** ============ (v1.7.6 #3) Loop Roll automático ============ */
async function loopRollBuildup(id: DeckId): Promise<void> {
  const ds = useApp.getState().decks[id];
  if (!ds.bpm || ds.bpm < 60) return;
  const beatSec = 60 / ds.bpm;
  const beatsSeq: number[] = [2, 1, 0.5, 0.25];
  for (const beats of beatsSeq) {
    if (cancelRequested) break;
    try { setLoop(id, Math.max(0.25, beats)); } catch { /* noop */ }
    await sleep(beatSec * Math.max(0.5, beats) * 1000);
    try { clearLoop(id); } catch { /* noop */ }
  }
  logFx("Loop Roll");
}

/** ============ (v1.7.6 #6) Reverse + Brake FX ============ */
async function reverseCensor(id: DeckId, bars: number): Promise<void> {
  const ds = useApp.getState().decks[id];
  const beatSec = ds.bpm && ds.bpm > 40 ? 60 / ds.bpm : 0.5;
  const dur = beatSec * 4 * Math.max(0.5, Math.min(4, bars));
  try {
    setReverse(id, true);
    await sleep(dur * 1000);
  } finally {
    try { setReverse(id, false); } catch { /* noop */ }
  }
  logFx("Reverse FX");
}

/** ============ (v1.7.6 #7) Auto Drop Builder ============
 *  Riser sintético + snare roll antes del drop. Routed to master so the
 *  recorder captures it. */
async function autoDropBuilder(seconds: number): Promise<void> {
  try {
    const { ctx, master } = getEngine();
    const t0 = ctx.currentTime;
    const dur = Math.max(2, Math.min(8, seconds));

    // Riser: sawtooth sweeping 200 → 4000 Hz with a lowpass closing.
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(master);
    out.gain.setValueAtTime(0, t0);
    out.gain.linearRampToValueAtTime(0.22, t0 + dur * 0.85);
    out.gain.linearRampToValueAtTime(0, t0 + dur);

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, t0);
    osc.frequency.exponentialRampToValueAtTime(4000, t0 + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(700, t0);
    lp.frequency.exponentialRampToValueAtTime(8000, t0 + dur);
    osc.connect(lp); lp.connect(out);
    osc.start(t0); osc.stop(t0 + dur + 0.05);

    // Snare roll: noise bursts, 1/4 → 1/16 acceleration.
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const totalHits = Math.max(8, Math.round(dur * 8));
    let acc = 0;
    for (let i = 0; i < totalHits; i++) {
      const k = i / totalHits;
      const stepSec = (1 - k) * 0.25 + k * 0.06; // 1/4 → 1/16
      acc += stepSec;
      if (acc > dur) break;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0 + acc);
      g.gain.linearRampToValueAtTime(0.18 * (0.4 + k * 0.6), t0 + acc + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + acc + 0.05);
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass"; hp.frequency.value = 1200;
      src.connect(hp); hp.connect(g); g.connect(master);
      src.start(t0 + acc); src.stop(t0 + acc + 0.06);
    }

    setTimeout(() => { try { out.disconnect(); } catch { /* noop */ } }, (dur + 0.4) * 1000);
    await sleep(dur * 1000);
    logFx("Drop Builder");
  } catch (e) { console.warn("[vdj] dropBuilder error", e); }
}

/** ============ (v1.7.6 #2) Acapella & Instrumental Layering ============
 *  Aplica vocalCut a la pista entrante (deja instrumental) y reduce el
 *  vocalCut del outgoing (deja la voz) para crear un "mashup vocal". */
async function acapellaLayer(fromId: DeckId, toId: DeckId, bars: number): Promise<void> {
  const ds = useApp.getState().decks[fromId];
  const beatSec = ds.bpm && ds.bpm > 40 ? 60 / ds.bpm : 0.5;
  const dur = beatSec * 4 * Math.max(1, Math.min(8, bars));
  // outgoing → keep vocals (vocalCut = 0); incoming → instrumental (vocalCut = 1).
  const startTo = useApp.getState().decks[toId].vocalCut ?? 0;
  await ramp((v) => setDeckVocalCut(toId, v), startTo, 0.95, 1.2);
  setXfaderPosition(0); // both audible
  await sleep(dur * 1000);
  await ramp((v) => setDeckVocalCut(toId, v), 0.95, 0, 1.0);
  logFx("Acapella Layer");
}

/** ============ (v1.7.6 #8) Voice Command Mode ============ */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((ev: { results: { 0: { transcript: string } }[] & { length: number } }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onend: (() => void) | null;
}
let voiceRec: SpeechRecognitionLike | null = null;
function startVoiceCommands() {
  try {
    const SR = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!SR) { toast("Comando por voz no soportado en este navegador"); return; }
    const settings = useApp.getState().settings;
    const rec = new SR();
    rec.lang = settings.vdjVoiceLang || (
      settings.lang === "es" ? "es-ES" : settings.lang === "pt" ? "pt-BR" :
      settings.lang === "fr" ? "fr-FR" : settings.lang === "it" ? "it-IT" : "en-US"
    );
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (ev) => {
      try {
        const last = ev.results.length - 1;
        const txt = (ev.results[last][0].transcript || "").toLowerCase().trim();
        handleVoiceCommand(txt);
      } catch { /* noop */ }
    };
    rec.onerror = () => { /* ignore */ };
    rec.onend = () => {
      // Auto-restart while VDJ is running.
      if (running && useApp.getState().settings.vdjVoiceCommands === true) {
        try { rec.start(); } catch { /* noop */ }
      }
    };
    rec.start();
    voiceRec = rec;
    toast.success("🎤 Comandos por voz activos");
  } catch (e) { console.warn("[vdj] voice cmd error", e); }
}
function stopVoiceCommands() {
  if (voiceRec) {
    try { voiceRec.stop(); } catch { /* noop */ }
    voiceRec = null;
  }
}
function handleVoiceCommand(txt: string) {
  if (!txt) return;
  // Spanish + English keywords
  if (/(siguiente|next|skip)/.test(txt)) {
    setMessage("🎤 Comando: siguiente"); cancelRequested = false;
    // Force-cut by jumping outgoing position to 99% to trigger transition.
    const ds = useApp.getState().decks[currentDeck];
    if (ds.duration > 0) seek(currentDeck, ds.duration * 0.99);
    toast("⏭ Siguiente pista");
  } else if (/(pausa|pause|stop|para)/.test(txt)) {
    pause(currentDeck); toast("⏸ Pausado");
  } else if (/(play|reanuda|resume|continua)/.test(txt)) {
    play(currentDeck, useApp.getState().decks[currentDeck].position * (useApp.getState().decks[currentDeck].duration || 0));
    toast("▶ Continúa");
  } else if (/(reverse|reversa|atras|reverso)/.test(txt)) {
    void reverseCensor(currentDeck, 1);
  } else if (/(drop|builder)/.test(txt)) {
    void autoDropBuilder(4);
  } else if (/(scratch|raya)/.test(txt)) {
    void performScratch(currentDeck, 4);
  } else if (/(reporte|report|pdf)/.test(txt)) {
    toast("📄 El reporte se generará al finalizar");
  }
}

/** ============ (v1.7.6 #9) Auto Mashup Generator ============
 *  Reproduce 2 pistas simultáneamente con stems split + acapella layering
 *  durante un período largo (16 compases). Llama a mashupDoubleDrop como
 *  base, pero precedido por acapellaLayer y suceedido por loopRoll. */
async function autoMashupSequence(fromId: DeckId, toId: DeckId): Promise<void> {
  await acapellaLayer(fromId, toId, 4);
  await mashupDoubleDrop(fromId, toId, 8);
  await loopRollBuildup(toId);
  logFx("Auto Mashup");
}

/** Build a CDJ-style .cue sheet referencing the given audio file. */
function buildCueSheet(audioFileName: string, perfTitle: string, perfArtist: string): string {
  const lines: string[] = [];
  lines.push(`PERFORMER "${perfArtist.replace(/"/g, "'")}"`);
  lines.push(`TITLE "${perfTitle.replace(/"/g, "'")}"`);
  lines.push(`FILE "${audioFileName}" WAVE`);
  cuePoints.forEach((c, i) => {
    const trackNo = String(i + 1).padStart(2, "0");
    lines.push(`  TRACK ${trackNo} AUDIO`);
    lines.push(`    TITLE "${c.title.replace(/"/g, "'")}"`);
    lines.push(`    PERFORMER "${c.artist.replace(/"/g, "'")}"`);
    const total = Math.max(0, c.timeSec);
    const mm = Math.floor(total / 60);
    const ss = Math.floor(total % 60);
    const ff = Math.floor((total - Math.floor(total)) * 75); // 75 frames per second
    lines.push(`    INDEX 01 ${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}:${String(ff).padStart(2, "0")}`);
  });
  return lines.join("\n") + "\n";
}

/** ============ (v1.7.5) Mic shoutout sidechain ============ */
let micShoutoutRaf: number | null = null;
let micShoutoutDuckActive = false;
function startMicShoutoutMonitor() {
  const settings = useApp.getState().settings;
  if (settings.vdjMicShoutout !== true) return;
  // Try to enable the mic if it's not already on (don't disturb user's other usage).
  void enableMic({ deviceId: settings.audioInputDeviceId || undefined,
    noiseSuppression: settings.micNoiseSuppression !== false,
    echoCancellation: settings.micEchoCancellation !== false,
    autoGainControl: settings.micAutoGainControl === true });
  const { ctx, micAnalyser, masterDuck } = getEngine();
  const buf = new Uint8Array(micAnalyser.fftSize);
  const threshold = Math.max(0.02, Math.min(0.6, settings.vdjMicShoutoutThreshold ?? 0.12));
  const duckAmt = Math.max(0, Math.min(0.9, settings.vdjMicShoutoutDuck ?? 0.55));
  const baseGain = 1;
  const duckGain = 1 - duckAmt;
  let lastAbove = 0;
  const HOLD_MS = 350;
  const tick = () => {
    if (!running || cancelRequested) {
      micShoutoutRaf = null;
      try { masterDuck.gain.setTargetAtTime(baseGain, ctx.currentTime, 0.08); } catch { /* noop */ }
      micShoutoutDuckActive = false;
      return;
    }
    micAnalyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / buf.length);
    const now = performance.now();
    if (rms > threshold) lastAbove = now;
    const speaking = (now - lastAbove) < HOLD_MS;
    if (speaking && !micShoutoutDuckActive) {
      micShoutoutDuckActive = true;
      try { masterDuck.gain.setTargetAtTime(duckGain, ctx.currentTime, 0.06); } catch { /* noop */ }
    } else if (!speaking && micShoutoutDuckActive) {
      micShoutoutDuckActive = false;
      try { masterDuck.gain.setTargetAtTime(baseGain, ctx.currentTime, 0.18); } catch { /* noop */ }
    }
    micShoutoutRaf = requestAnimationFrame(tick);
  };
  micShoutoutRaf = requestAnimationFrame(tick);
}
function stopMicShoutoutMonitor() {
  if (micShoutoutRaf !== null) cancelAnimationFrame(micShoutoutRaf);
  micShoutoutRaf = null;
  try {
    const { ctx, masterDuck } = getEngine();
    masterDuck.gain.setTargetAtTime(1, ctx.currentTime, 0.1);
  } catch { /* noop */ }
  micShoutoutDuckActive = false;
  // Note: we DO NOT auto-disable the mic — the user may have it on for other
  // reasons. They control that via the mic toggle.
}

/** ============ (v1.7.5) Mood-adaptive genre arc ============ */
const MOOD_ARC: VdjGenre[] = ["lofi", "house", "techno", "edm", "drumandbass", "edm", "house", "lofi", "ambient"];
function moodGenreAt(i: number, n: number, shape: "arc" | "ascending" | "descending" | "wave"): VdjGenre {
  if (n <= 1) return "house";
  const t = i / (n - 1);
  let k: number;
  switch (shape) {
    case "ascending":  k = t; break;
    case "descending": k = 1 - t; break;
    case "wave":       k = 0.5 - 0.5 * Math.cos(t * Math.PI * 2); break;
    case "arc":
    default:           k = Math.sin(t * Math.PI); break;
  }
  const idx = Math.min(MOOD_ARC.length - 1, Math.floor(k * (MOOD_ARC.length - 1)));
  return MOOD_ARC[idx];
}

/** ============ (v1.7.5) Beatjuggling ============
 *  Pequeños cortes A↔B sobre el mismo beat, perfecto para tracks lentos. */
async function beatjuggle(activeId: DeckId, sittingId: DeckId, bars = 2) {
  const dsA = useApp.getState().decks[activeId];
  const beatSec = dsA.bpm && dsA.bpm > 40 ? 60 / dsA.bpm : 0.5;
  const totalBeats = bars * 4;
  const startX = useApp.getState().mixer.xfader;
  const tA: -1 | 1 = activeId === "A" ? -1 : 1;
  const tB: -1 | 1 = sittingId === "A" ? -1 : 1;
  for (let i = 0; i < totalBeats; i++) {
    if (cancelRequested) break;
    setXfaderPosition(i % 2 === 0 ? tA : tB);
    if (i % 4 === 3) { try { void performScratch(i % 2 === 0 ? activeId : sittingId, 1); } catch { /* noop */ } }
    await sleep(beatSec * 1000);
  }
  setXfaderPosition(startX);
}

/** ============ (v1.7.5) Radio show jingle insert ============
 *  Reproduce un jingle elegido por el usuario en el deck "B" rapido entre
 *  pistas, con un shoutout antes y después. */
async function playRadioJingle(targetDeck: DeckId, jingleTrackId: string): Promise<void> {
  try {
    setMessage("📻 Jingle de radio…");
    announceDjName();
    await sleep(800);
    await loadTrackToDeck(targetDeck, jingleTrackId);
    applyAutoGain(targetDeck);
    seek(targetDeck, 0);
    setXfaderPosition(targetDeck === "A" ? -1 : 1);
    play(targetDeck, 0);
    // Wait for the jingle to play out (cap at 25s — jingles are short).
    const t0 = performance.now();
    while (!cancelRequested) {
      const ds = useApp.getState().decks[targetDeck];
      const dur = ds.duration || 0;
      const pos = (ds.position ?? 0) * dur;
      if (dur > 0 && pos >= dur - 0.3) break;
      if (!ds.isPlaying) break;
      if ((performance.now() - t0) / 1000 > 25) break;
      await sleep(200);
    }
    pause(targetDeck);
  } catch (e) {
    console.warn("[vdj] jingle error", e);
  }
}

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
  // Preserve order of first appearance; ensure NO duplicates.
  const seen = new Set<string>();
  const allSelected = s.tracks.filter((t) => {
    if (!selected.has(t.id)) return false;
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
  let pool = allSelected;
  if (genre !== "auto") {
    const filtered = allSelected.filter((t) => {
      const tags = (t.tags ?? []).map((x) => x.toLowerCase());
      return tags.some((tag) => tag.includes(genre));
    });
    pool = filtered.length > 0 ? filtered : allSelected;
  }
  // Optional shuffle (Fisher–Yates) — never repeats a track because the input
  // already has duplicates removed above.
  if (s.settings.vdjShuffle) {
    const arr = [...pool];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    pool = arr;
  }
  // Energy Curve / Set planner — reorder by BPM + key compatibility.
  // Runs AFTER shuffle so the shape always wins. Skipped if the user
  // disabled it (default off — opt-in advanced feature).
  if (s.settings.vdjEnergyCurve === true && pool.length >= 3) {
    pool = planEnergyCurve(pool, s.settings.vdjEnergyShape ?? "arc");
  }
  return pool;
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
  if (useApp.getState().settings.vdjAutoGain === false) return;
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
  const lvl = getIntensity();
  const wet = Math.max(0, Math.min(1, cfg.wet * lvl.fxWetMul));
  useApp.getState().updateFx(1, {
    kind: cfg.kind,
    wet,
    param1: cfg.param1,
    param2: cfg.param2,
    beatSync: lvl.fxBeatSync,
    beatDiv: 1,
  });
  // Acid edge (hard mode): add a layered phaser/bitcrusher on slot 2 for grit.
  if (lvl.acidEdge) {
    useApp.getState().updateFx(2, {
      kind: genre === "techno" || genre === "dubstep" || genre === "drumandbass"
        ? "bitcrusher"
        : "phaser",
      wet: 0.35,
      param1: 0.55,
      param2: 0.5,
      beatSync: true,
      beatDiv: 0.5,
    });
  }
}

function clearGenreFx() {
  useApp.getState().updateFx(1, { kind: "off", wet: 0 });
  // Clear the acid layer too (no-op if it wasn't set).
  const fx2 = useApp.getState().fx.find((f) => f.id === 2);
  if (fx2 && (fx2.kind === "bitcrusher" || fx2.kind === "phaser") && fx2.wet > 0 && fx2.wet <= 0.5) {
    useApp.getState().updateFx(2, { kind: "off", wet: 0 });
  }
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
  const ds = useApp.getState().decks[id];
  const startRate = 1 + (ds.pitch * (ds.pitchRange / 100));
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
      // Equal-power S-curve (smoother and more "pro" than linear) — minimizes
      // perceived dip at the midpoint.
      const sCurve = 0.5 - 0.5 * Math.cos(Math.PI * k);
      const v = start + (target - start) * sCurve;
      setXfaderPosition(v);
      // EQ blend: outgoing hi+lo cut progressively, incoming lo cut early then released.
      // Cleaner handoff — kills the bass clash entirely between 35%-65%.
      const hiCut = sCurve * 0.7;
      const loCutFrom = k < 0.5 ? sCurve * 0.5 : sCurve * 1.0;
      const loCutTo = k < 0.5 ? (1 - sCurve) * 1.0 : (1 - sCurve) * 0.4;
      setEQ(fromId, "hi", -hiCut);
      setEQ(fromId, "lo", -loCutFrom);
      setEQ(toId,   "lo", -loCutTo);
      if (k < 1) {
        requestAnimationFrame(step);
      } else {
        setEQ(fromId, "hi", 0);
        setEQ(fromId, "lo", 0);
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
  const cfg = useApp.getState().settings;
  if (cfg.vdjUseSpice === false) return;
  const lvl = getIntensity();
  // Probabilistic spice: in soft mode we sometimes skip spice entirely.
  if (Math.random() > lvl.spiceProb) return;
  const ds = useApp.getState().decks[id];
  const dur = ds.duration || 0;
  if (dur <= 0) return;
  // Roll a tasteful improv based on genre
  const fast = genre === "drumandbass" || genre === "dubstep" || genre === "techno";
  const dreamy = genre === "ambient" || genre === "lofi" || genre === "trance";

  // 0) DJ-name announcement on the master bus (and out loud) — only in 'mid'/'every' modes.
  const mode = cfg.vdjAnnounceMode ?? "mid";
  if (mode === "mid" || mode === "every") announceDjName();

  // 1) Filter sweep up
  const swUp = (fast ? 0.5 : 0.7) * lvl.filterDepth;
  await filterSweep(id, 0, swUp, dreamy ? 4 : 2.5);
  if (cancelRequested) { setDeckFilter(id, 0); return; }

  // 1.5) EQ kill on the lows briefly for a "filter drop" feel
  const ds2 = useApp.getState().decks[id];
  const startLo = ds2.lo;
  await ramp((v) => setEQ(id, "lo", v), startLo, -lvl.eqKillLo, 0.6);

  // 2) Beat loop (if BPM known) — 4 beats for fast, 8 for slow
  if (ds.bpm && cfg.vdjUseLoops !== false) {
    const beatsBase = fast ? 4 : 8;
    const beats = Math.max(1, Math.round(beatsBase * lvl.loopBeatsMul));
    try { setLoop(id, beats); } catch { /* ignore */ }
    // Add an FX layer during loop
    if (cfg.vdjUseFx !== false) {
      useApp.getState().updateFx(2, {
        kind: dreamy ? "reverb" : "delay",
        wet: 0.55,
        param1: 0.55,
        param2: 0.5,
      });
    }
    // Add a hot cue at the loop entry for future reference
    if (cfg.vdjUseHotCues !== false) { try { addHotCue(id, 1); } catch { /* noop */ } }
    // Mid-loop gain pump (down + back up) to feel like a "ducker"
    void ramp((v) => setDeckGain(id, v), 1, lvl.duckTo, (60 / ds.bpm) * (beats / 2));
    await sleep((60 / ds.bpm) * beats * 1000 * 1.0);
    // Restore gain
    setDeckGain(id, 1);
    try { clearLoop(id); } catch { /* ignore */ }
    if (cfg.vdjUseFx !== false) {
      await fxWetRamp(2, 0.55, 0, 1.5);
      useApp.getState().updateFx(2, { kind: "off", wet: 0 });
    }
  }

  // 2.5) Restore lows
  await ramp((v) => setEQ(id, "lo", v), -lvl.eqKillLo, 0, 0.8);

  // 2.6) A short scratch flourish (genre-aware)
  if (!dreamy && cfg.vdjUseScratch !== false) {
    await performScratch(id, Math.max(1, Math.round((fast ? 4 : 2) * (lvl.scratchCount / 2))));
  }

  // 2.7) Tiny pitch bend (±2%) — micro-beatmatch feel
  if (cfg.vdjUsePitchBend !== false) {
    const dsP = useApp.getState().decks[id];
    const startPitch = dsP.pitch;
    const bend = lvl.pitchBendAmt;
    await ramp((v) => setDeckPitch(id, v), startPitch, Math.min(1, startPitch + bend), 0.6);
    await ramp((v) => setDeckPitch(id, v), Math.min(1, startPitch + bend), startPitch, 0.6);
  }

  // 3) Filter sweep back to neutral
  await filterSweep(id, swUp, 0, 2);
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

/** ============ Robotic DJ-name announcement ============
 * Plays the DJ name through:
 *  1) Web Speech API (live, audible in the room)
 *  2) A short FM-modulated robotic stinger routed through the master bus,
 *     so the recording captures it even though Web Speech can't be tapped.
 */
function speakRobotic(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.85;
    u.pitch = 0.2;     // very low → robotic
    u.volume = 1;
    const lang = useApp.getState().settings.lang;
    u.lang = lang === "es" ? "es-ES"
      : lang === "pt" ? "pt-BR"
      : lang === "fr" ? "fr-FR"
      : lang === "it" ? "it-IT"
      : "en-US";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch { /* noop */ }
}

/** Robotic stinger: ring-modulated formant burst routed to the master bus
 * so it's captured by the recorder. Length depends on text length. */
function playRoboticStinger(text: string) {
  try {
    const { ctx, master } = getEngine();
    const now = ctx.currentTime;
    const syllables = Math.max(2, Math.min(10, Math.round(text.length / 2)));
    const totalDur = Math.min(2.4, 0.18 * syllables + 0.3);

    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(master);

    // User-controlled stinger volume (default 0.18 — same as before).
    const userVol = useApp.getState().settings.vdjAnnounceVolume;
    const peak = Math.max(0.02, Math.min(0.6, userVol ?? 0.18));

    // Master envelope (overall volume)
    out.gain.setValueAtTime(0, now);
    out.gain.linearRampToValueAtTime(peak, now + 0.04);
    out.gain.linearRampToValueAtTime(peak, now + totalDur - 0.15);
    out.gain.linearRampToValueAtTime(0, now + totalDur);

    // Carrier (sawtooth) — vocal-like
    const carrier = ctx.createOscillator();
    carrier.type = "sawtooth";
    carrier.frequency.value = 110;

    // Modulator (sine LFO around 30Hz → ring-mod buzz = robotic timbre)
    const mod = ctx.createOscillator();
    mod.type = "sine";
    mod.frequency.value = 32;
    const modGain = ctx.createGain();
    modGain.gain.value = 80;
    mod.connect(modGain);
    modGain.connect(carrier.frequency);

    // Bandpass formant
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1100;
    bp.Q.value = 8;

    // Subtle high-shelf for "tinny" robot edge
    const hs = ctx.createBiquadFilter();
    hs.type = "highshelf";
    hs.frequency.value = 3000;
    hs.gain.value = 4;

    carrier.connect(bp);
    bp.connect(hs);
    hs.connect(out);

    // Syllable gate — chops the carrier into syllable-like bursts
    const gate = ctx.createGain();
    gate.gain.value = 0;
    hs.disconnect();
    hs.connect(gate);
    gate.connect(out);
    const sylDur = totalDur / syllables;
    for (let i = 0; i < syllables; i++) {
      const t0 = now + i * sylDur;
      gate.gain.setValueAtTime(0, t0);
      gate.gain.linearRampToValueAtTime(1, t0 + sylDur * 0.15);
      gate.gain.linearRampToValueAtTime(1, t0 + sylDur * 0.7);
      gate.gain.linearRampToValueAtTime(0, t0 + sylDur * 0.95);
      // Vary pitch per syllable for "speech" feel
      const f = 95 + (i % 4) * 18;
      carrier.frequency.setValueAtTime(f, t0);
    }

    carrier.start(now);
    mod.start(now);
    carrier.stop(now + totalDur + 0.05);
    mod.stop(now + totalDur + 0.05);
    setTimeout(() => { try { out.disconnect(); } catch { /* noop */ } }, (totalDur + 0.2) * 1000);
  } catch (err) {
    console.warn("[vdj] stinger error", err);
  }
}

function announceDjName() {
  if (useApp.getState().settings.vdjAnnounceDj === false) return;
  const name = (useApp.getState().settings.djName || "").trim();
  if (!name) return;
  // Live spoken voice + recorded robotic stinger
  playRoboticStinger(name);
  speakRobotic(name);
}

/** Quick simulated scratch on the given deck — back-and-forth nudges. */
async function performScratch(id: DeckId, scratches = 3) {
  try {
    await beginScratchDeck(id);
    for (let i = 0; i < scratches; i++) {
      scratchDeck(id, -0.12);
      await sleep(80);
      scratchDeck(id, 0.18);
      await sleep(80);
    }
    endScratchDeck(id);
  } catch { /* noop */ }
}

/** Smoothly ramp a numeric setter from `from` to `to` over `seconds`. */
async function ramp(
  setter: (v: number) => void,
  from: number,
  to: number,
  seconds: number,
) {
  const t0 = performance.now();
  return new Promise<void>((resolve) => {
    const step = () => {
      if (cancelRequested) { setter(to); resolve(); return; }
      const t = (performance.now() - t0) / (seconds * 1000);
      const k = Math.min(1, t);
      setter(from + (to - from) * k);
      if (k < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

/** ============ (v1.7.3) Energy Curve / Set planner ============
 * Reordena la cola siguiendo un arco profesional warmup → peak → cooldown.
 * Greedy: empieza por la pista de menor BPM y va eligiendo la siguiente
 * que mejor encaje según (a) cercanía de BPM al objetivo de la curva y
 * (b) compatibilidad de key (Camelot). Pistas sin BPM/key igual entran;
 * el algoritmo nunca descarta tracks (no se pierden seleccionadas).
 */
type EnergyShape = "arc" | "ascending" | "descending" | "wave";

function targetBpmAt(i: number, n: number, lo: number, hi: number, shape: EnergyShape): number {
  if (n <= 1) return (lo + hi) / 2;
  const t = i / (n - 1); // 0..1
  let k: number;
  switch (shape) {
    case "ascending":  k = t; break;
    case "descending": k = 1 - t; break;
    case "wave":       k = 0.5 - 0.5 * Math.cos(t * Math.PI * 2); break;
    case "arc":
    default:           k = Math.sin(t * Math.PI); break; // 0 → 1 → 0
  }
  return lo + (hi - lo) * k;
}

function planEnergyCurve(tracks: TrackRecord[], shape: EnergyShape): TrackRecord[] {
  if (tracks.length < 3) return tracks;
  const withBpm = tracks.filter((t) => typeof t.bpm === "number" && (t.bpm as number) > 40);
  const noBpm = tracks.filter((t) => !(typeof t.bpm === "number" && (t.bpm as number) > 40));
  if (withBpm.length < 3) return tracks; // not enough info to plan
  const bpms = withBpm.map((t) => t.bpm as number);
  const lo = Math.min(...bpms);
  const hi = Math.max(...bpms);

  const remaining = [...withBpm];
  const ordered: TrackRecord[] = [];
  for (let i = 0; i < withBpm.length; i++) {
    const target = targetBpmAt(i, withBpm.length, lo, hi, shape);
    const prev = ordered[ordered.length - 1] ?? null;
    let bestIdx = 0;
    let bestScore = Infinity;
    for (let j = 0; j < remaining.length; j++) {
      const cand = remaining[j];
      const bpmDiff = Math.abs((cand.bpm as number) - target);
      // Bonus if key is compatible with previous (Camelot).
      let keyBonus = 0;
      if (prev && prev.key && cand.key) {
        keyBonus = isCompatible(prev.key as CamelotKey, cand.key as CamelotKey) ? -8 : 4;
      }
      // Penalty for huge BPM jumps from previous track (>10% feels rough).
      let jumpPenalty = 0;
      if (prev && typeof prev.bpm === "number") {
        const jump = Math.abs((cand.bpm as number) - prev.bpm) / prev.bpm;
        if (jump > 0.10) jumpPenalty = (jump - 0.10) * 100;
      }
      const score = bpmDiff + keyBonus + jumpPenalty;
      if (score < bestScore) { bestScore = score; bestIdx = j; }
    }
    ordered.push(remaining.splice(bestIdx, 1)[0]);
  }
  // Append tracks without BPM at the end (won't disrupt the curve).
  return [...ordered, ...noBpm];
}

/** ============ (v1.7.3) Drop / Phrase / Downbeat alignment ============
 * Espera hasta que la posición actual coincida con un downbeat de la
 * grilla (gridOffsetSec + N * (60/bpm)) o, si la pista tiene phrase
 * markers de tipo 'drop' / 'buildup' / 'outro', con el más cercano dentro
 * de la ventana. Si no encuentra nada en `windowSec`, retorna sin esperar
 * para no bloquear la mezcla.
 */
async function waitForPhraseAlign(id: DeckId, windowSec: number): Promise<void> {
  const cfg = useApp.getState().settings;
  if (cfg.vdjPhraseAlign === false) return;
  const winMax = Math.max(0.5, Math.min(16, windowSec));
  const t0 = performance.now();
  while (!cancelRequested) {
    const ds = useApp.getState().decks[id];
    const dur = ds.duration || 0;
    const pos = (ds.position ?? 0) * dur;
    if (dur <= 0 || !ds.isPlaying) return;
    // 1) Phrase marker (drop/buildup/outro) within window?
    const phrases = ds.phrases ?? [];
    const upcoming = phrases
      .filter((p) => (p.type === "drop" || p.type === "buildup" || p.type === "outro") && p.pos >= pos)
      .sort((a, b) => a.pos - b.pos)[0];
    if (upcoming && upcoming.pos - pos <= winMax) {
      const wait = (upcoming.pos - pos) * 1000;
      await sleep(Math.max(0, wait - 30));
      return;
    }
    // 2) Otherwise align to the next downbeat (every 4 beats).
    if (ds.bpm && ds.bpm > 40) {
      const beatSec = 60 / ds.bpm;
      const barSec = beatSec * 4;
      const offset = ds.gridOffsetSec ?? 0;
      const sinceGrid = pos - offset;
      const next = Math.ceil(sinceGrid / barSec) * barSec + offset;
      const wait = next - pos;
      if (wait >= 0 && wait <= winMax) {
        await sleep(Math.max(0, wait * 1000 - 30));
        return;
      }
    }
    // Window expired — give up so the mix keeps moving.
    if ((performance.now() - t0) / 1000 >= winMax) return;
    await sleep(120);
  }
}

/** ============ (v1.7.3) Echo-Freeze + Cut transition ============
 * Pioneer-style: congela el último compás del outgoing con echo de feedback
 * alto y duck del gain, mientras el incoming entra en seco al downbeat.
 * Devuelve cuando el corte está completado.
 */
async function echoFreezeTransition(fromId: DeckId, toId: DeckId): Promise<void> {
  const dsFrom = useApp.getState().decks[fromId];
  const beatSec = dsFrom.bpm && dsFrom.bpm > 40 ? 60 / dsFrom.bpm : 0.5;
  const freezeSec = Math.max(0.6, Math.min(2.4, beatSec * 4));

  // 1) Slam echo on slot 2 with HUGE feedback for the freeze.
  useApp.getState().updateFx(2, {
    kind: "echo",
    wet: 0.9,
    param1: 0.5,    // shorter echo time → tighter freeze
    param2: 0.85,   // high feedback
    beatSync: true,
    beatDiv: 0.5,
  });
  // 2) Quick filter sweep up + EQ kill on outgoing for the "freeze" feel.
  void filterSweep(fromId, 0, 0.85, freezeSec * 0.6);
  void ramp((v) => setEQ(fromId, "lo", v), dsFrom.lo, -1, freezeSec * 0.4);
  // 3) Duck outgoing gain to ~30% as the echo takes over.
  void ramp((v) => setDeckGain(fromId, v), 1, 0.3, freezeSec * 0.5);
  await sleep(freezeSec * 0.45 * 1000);

  // 4) HARD CUT crossfader to the incoming side at downbeat — no fade.
  const target: -1 | 1 = toId === "A" ? -1 : 1;
  setXfaderPosition(target);
  useApp.getState().updateMixer({ masterDeck: toId });

  // 5) Pause outgoing immediately, kill its EQ.
  pause(fromId);
  setEQ(fromId, "lo", 0);
  setDeckFilter(fromId, 0);
  setDeckGain(fromId, 1);

  // 6) Let the echo tail breathe over the new track for a moment, then ramp out.
  await sleep(Math.min(900, freezeSec * 600));
  await fxWetRamp(2, 0.9, 0, 1.4);
  useApp.getState().updateFx(2, { kind: "off", wet: 0 });

  // 7) Light low-end boost on incoming for the drop entry.
  void ramp((v) => setEQ(toId, "lo", v), 0, 0.4, 0.6);
  setTimeout(() => { try { setEQ(toId, "lo", 0); } catch { /* noop */ } }, 3500);
}

/** ============ (v1.7.4) Mash-up Double Drop ============
 * Ambas pistas suenan simultáneamente N compases con EQ split:
 *   outgoing → mantiene LOWS, pierde HIGHS
 *   incoming → mantiene HIGHS, pierde LOWS
 * Termina con un corte limpio al downbeat siguiente.
 */
async function mashupDoubleDrop(fromId: DeckId, toId: DeckId, bars: number): Promise<void> {
  const dsFrom = useApp.getState().decks[fromId];
  const dsTo = useApp.getState().decks[toId];
  const beatSec = dsFrom.bpm && dsFrom.bpm > 40 ? 60 / dsFrom.bpm : 0.5;
  const totalSec = beatSec * 4 * Math.max(2, Math.min(16, bars));
  // Center the xfader so both decks audible.
  const startX = useApp.getState().mixer.xfader;
  void ramp((v) => setXfaderPosition(v), startX, 0, 1.2);
  // EQ split — gradual to avoid clicks.
  const fromLoStart = dsFrom.lo, fromHiStart = dsFrom.hi;
  const toLoStart = dsTo.lo, toHiStart = dsTo.hi;
  void ramp((v) => setEQ(fromId, "hi", v), fromHiStart, -1.0, 1.5);
  void ramp((v) => setEQ(toId,   "lo", v), toLoStart,   -1.0, 1.5);
  // Slight gain duck on both so combined level stays controlled.
  void ramp((v) => setDeckGain(fromId, v), 1, 0.85, 1.2);
  void ramp((v) => setDeckGain(toId,   v), 1, 0.95, 1.2);
  // Hold the double drop.
  await sleep(totalSec * 1000);
  if (cancelRequested) {
    setEQ(fromId, "hi", fromHiStart); setEQ(toId, "lo", toLoStart);
    setDeckGain(fromId, 1); setDeckGain(toId, 1);
    return;
  }
  // Quick clean cut to incoming on the downbeat.
  const target: -1 | 1 = toId === "A" ? -1 : 1;
  await ramp((v) => setXfaderPosition(v), 0, target, beatSec * 2);
  setEQ(fromId, "hi", 0); setEQ(fromId, "lo", fromLoStart);
  setEQ(toId, "lo", 0);   setEQ(toId, "hi", toHiStart);
  setDeckGain(fromId, 1); setDeckGain(toId, 1);
  pause(fromId);
  useApp.getState().updateMixer({ masterDeck: toId });
}

/** ============ (v1.7.4) Stem-aware vocal duck ============
 * Sube el vocalCut del outgoing durante la transición y lo restaura
 * cuando el incoming ya suena. Evita choques de voces.
 */
async function applyStemAwareDuck(fromId: DeckId, amount: number, seconds: number) {
  const start = useApp.getState().decks[fromId].vocalCut ?? 0;
  await ramp((v) => setDeckVocalCut(fromId, v), start, Math.max(0, Math.min(1, amount)), seconds);
}
function releaseStemAwareDuck(fromId: DeckId) {
  try { setDeckVocalCut(fromId, 0); } catch { /* noop */ }
}

/** ============ (v1.7.4) Battle Mode ============
 * Alterna decks cada N compases con scratches y cortes secos estilo
 * turntablism. Termina dejando el incoming como master.
 */
async function battleMode(fromId: DeckId, toId: DeckId, bars: number, rounds: number): Promise<void> {
  const dsFrom = useApp.getState().decks[fromId];
  const beatSec = dsFrom.bpm && dsFrom.bpm > 40 ? 60 / dsFrom.bpm : 0.5;
  const roundSec = beatSec * 4 * Math.max(4, Math.min(16, bars));
  const totalRounds = Math.max(2, Math.min(8, rounds));
  // Start centered, then slam to fromId.
  setXfaderPosition(fromId === "A" ? -1 : 1);
  for (let r = 0; r < totalRounds; r++) {
    if (cancelRequested) break;
    const onIncoming = r % 2 === 1;
    const activeDeck: DeckId = onIncoming ? toId : fromId;
    const otherD: DeckId = onIncoming ? fromId : toId;
    // Hard cut crossfader to active deck.
    setXfaderPosition(activeDeck === "A" ? -1 : 1);
    useApp.getState().updateMixer({ masterDeck: activeDeck });
    // Quick scratch flourish on the active deck halfway through.
    setTimeout(() => { if (!cancelRequested) void performScratch(activeDeck, 2); }, roundSec * 500);
    // EQ accent: kill lows briefly on the silent deck so its bass doesn't bleed.
    setEQ(otherD, "lo", -1);
    await sleep(roundSec * 1000);
    setEQ(otherD, "lo", 0);
  }
  // End on incoming.
  if (!cancelRequested) {
    setXfaderPosition(toId === "A" ? -1 : 1);
    useApp.getState().updateMixer({ masterDeck: toId });
    pause(fromId);
  }
}

export async function startVirtualDj(): Promise<void> {
  if (running) { toast.error("Virtual DJ ya está corriendo"); return; }
  const queue = getQueue();
  // mutable working copy for harmonic re-ordering
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
  cuePoints = [];
  recordingStartMs = 0;
  reportEntries = [];
  reportFx = {};
  energyHistory = [];
  setMessage(`Iniciando Virtual DJ (${queue.length} pistas)`);

  // Start recording if requested
  if (shouldRecord && !isRecording()) {
    try {
      await startRecording();
      recordingActive = true;
      recordingStartMs = Date.now();
      toast.success("Grabando sesión Virtual DJ");
    } catch (err) {
      console.warn("[vdj] no se pudo iniciar grabación", err);
    }
  }

  // (v1.7.5 #6) Mic shoutout sidechain — duck master when user speaks.
  if (settings.vdjMicShoutout === true) {
    try { startMicShoutoutMonitor(); } catch (err) { console.warn("[vdj] mic shoutout error", err); }
  }
  // (v1.7.6 #4) Crowd Energy monitor.
  if (settings.vdjEnergyMeter === true || settings.vdjMixReport === true) {
    try { startEnergyMonitor(); } catch (err) { console.warn("[vdj] energy mon error", err); }
  }
  // (v1.7.6 #8) Voice commands.
  if (settings.vdjVoiceCommands === true) {
    try { startVoiceCommands(); } catch (err) { console.warn("[vdj] voice err", err); }
  }
  // (v1.7.6 #1) Harmonic Mixing AI: detect missing keys + reorder.
  if (settings.vdjHarmonicMixing === true) {
    setMessage("🎼 Analizando tonalidades…");
    try { await ensureKeysForTracks(queue); } catch (e) { console.warn("[vdj] key detect error", e); }
    const planned = planHarmonic(queue);
    queue.length = 0;
    queue.push(...planned);
    setMessage(`🎼 Cola armónica lista (${queue.length} pistas)`);
  }
  // (v1.7.5 #10) Auto-start live stream of this set, if user enabled it.
  if (settings.vdjAutoStream === true) {
    const cfg = useApp.getState().stream;
    if (cfg.serverUrl && cfg.password && !isStreaming()) {
      try {
        await startStream(cfg);
        toast.success("📡 Streaming en vivo iniciado");
      } catch (err) {
        console.warn("[vdj] stream start failed", err);
      }
    }
  }

  try {
    // Load + start first track on Deck A
    setXfaderPosition(-1);
    await loadTrackToDeck("A", queue[0].id);
    currentTrackId = queue[0].id;
    applyAutoGain("A");
    if (settings.vdjUseHotCues !== false) {
      addHotCue("A", 0); // mark intro for reference
      // Drop a second hot-cue mid-track for later use
      const dA = useApp.getState().decks["A"];
      if (dA.duration > 30) addHotCue("A", dA.duration * 0.45);
    }
    play("A", 0);
    useApp.getState().updateMixer({ masterDeck: "A" });
    setMessage(`▶ ${queue[0].title} (1/${queue.length})`);
    // (v1.7.5 #9) capture cue point for first track
    pushCue(0, queue[0]);
    // (v1.7.5 #10) Push current track metadata to the live stream.
    if (settings.vdjAutoStream === true && isStreaming()) {
      void updateStreamMetadata(queue[0].title || "Track 1", queue[0].artist || "");
    }
    // Opening DJ-name shoutout (any mode except 'mid'-only mode)
    const annMode = settings.vdjAnnounceMode ?? "mid";
    if (annMode !== "mid") {
      setTimeout(() => { if (running && !cancelRequested) announceDjName(); }, 1500);
    }

    for (let i = 1; i < queue.length; i++) {
      if (cancelRequested) break;
      const fromId = currentDeck;
      const toId = otherDeck(fromId);
      const next = queue[i];

      // (v1.7.5 #8) Mood-adaptive: override genre per-position following an arc.
      const moodGenre: VdjGenre =
        settings.vdjMoodAdaptive === true
          ? moodGenreAt(
              Math.floor((i - 1) / Math.max(1, settings.vdjMoodEveryN ?? 3)),
              Math.max(1, Math.ceil(queue.length / Math.max(1, settings.vdjMoodEveryN ?? 3))),
              settings.vdjMoodShape ?? "arc",
            )
          : genre;
      const fxCfgBase = GENRE_FX[moodGenre] ?? GENRE_FX.auto;
      const lvl = getIntensity();
      // Allow user override of crossfade duration
      const xfadeOverride = settings.vdjXfadeSec;
      const baseXfade = (xfadeOverride && xfadeOverride > 0)
        ? xfadeOverride
        : fxCfgBase.xfadeSec;
      // Intensity scales the crossfade — hard = shorter/aggressive, soft = longer/smooth.
      const xfadeSec = Math.max(2, Math.min(30, baseXfade * lvl.xfadeMul));
      const fxCfg = { ...fxCfgBase, xfadeSec };

      // Mid-track flair: spice up the playing deck around ~50% through.
      // We DO NOT wait for the track to finish — we cut into the next song
      // earlier (~70-78%) so the mix stays energetic.
      const dsCur = useApp.getState().decks[fromId];
      const durCur = dsCur.duration || 0;
      if (durCur > 0) {
        while (!cancelRequested) {
          const ds2 = useApp.getState().decks[fromId];
          const pos = (ds2.position ?? 0) * (ds2.duration || 0);
          if (pos >= (ds2.duration || 0) * 0.50) break;
          if (!ds2.isPlaying) break;
          await sleep(400);
        }
        if (!cancelRequested) {
          setMessage(`Live FX en ${fromId}`);
          await spiceCurrent(fromId, moodGenre);
          // (v1.7.5 #11) Beatjuggling on slow tracks
          if (settings.vdjBeatjuggle === true) {
            const dsB = useApp.getState().decks[fromId];
            const maxBpm = settings.vdjBeatjuggleMaxBpm ?? 100;
            const prob = Math.max(0, Math.min(1, settings.vdjBeatjuggleProb ?? 0.4));
            if (dsB.bpm && dsB.bpm > 40 && dsB.bpm <= maxBpm && Math.random() < prob) {
              setMessage(`🤹 Beatjuggle ${fromId}`);
              await beatjuggle(fromId, otherDeck(fromId), 2);
            }
          }
        }
      }

      // Cut early — user-configurable; defaults to 72% (long) or 78% (short).
      const userCut = settings.vdjCutAtPct;
      const baseCut = (userCut && userCut >= 0.5 && userCut <= 0.95)
        ? userCut
        : (durCur > 240 ? 0.72 : 0.78);
      // Hard mode cuts earlier (more aggressive); soft slightly later.
      const cutPct = Math.max(0.5, Math.min(0.95, baseCut - lvl.cutPctBoost));
      while (!cancelRequested) {
        const ds2 = useApp.getState().decks[fromId];
        const pos = (ds2.position ?? 0) * (ds2.duration || 0);
        if (pos >= (ds2.duration || 0) * cutPct) break;
        if (!ds2.isPlaying) break;
        await sleep(300);
      }
      if (cancelRequested) break;

      // Preload next on the other deck
      setMessage(`Preparando ${next.title} (${i + 1}/${queue.length})`);
      await loadTrackToDeck(toId, next.id);
      currentTrackId = next.id;
      applyAutoGain(toId);
      if (settings.vdjSyncBpm !== false) syncBpm(fromId, toId);
      if (settings.vdjUseHotCues !== false) {
        addHotCue(toId, 0);
        const dT = useApp.getState().decks[toId];
        if (dT.duration > 30) addHotCue(toId, dT.duration * 0.45);
      }
      // Jump to first hot-cue if exists, then play
      const tdState = useApp.getState().decks[toId];
      if (tdState.hotCues.length > 0) jumpHotCue(toId, 0);
      else seek(toId, 0);
      play(toId, useApp.getState().decks[toId].cuePoint || 0);

      // (v1.7.3) Phrase / downbeat alignment — wait for next drop/buildup
      // or downbeat (within window) before starting the actual transition.
      if (settings.vdjPhraseAlign === true) {
        const win = Math.max(0.5, Math.min(16, settings.vdjPhraseAlignWindowSec ?? 4));
        await waitForPhraseAlign(fromId, win);
        if (cancelRequested) break;
      }

      // Per-transition DJ-name shoutout (only in 'every' mode)
      if (annMode === "every") announceDjName();

      // (v1.7.3) Decide transition style: classic crossfade vs Echo-Freeze + Cut.
      const useFreeze =
        settings.vdjEchoFreeze === true &&
        Math.random() < Math.max(0, Math.min(1, settings.vdjEchoFreezeProb ?? 0.35));
      // (v1.7.4) Optional Battle Mode and Mash-up — checked in priority order.
      const useBattle =
        !useFreeze &&
        settings.vdjBattleMode === true &&
        Math.random() < Math.max(0, Math.min(1, settings.vdjBattleProb ?? 0.2));
      const useMashup =
        !useFreeze && !useBattle &&
        settings.vdjMashup === true &&
        Math.random() < Math.max(0, Math.min(1, settings.vdjMashupProb ?? 0.25));

      // (v1.7.4) Stem-aware vocal duck on outgoing — applies to ALL transition
      // styles to avoid vocal clashes.
      const stemAware = settings.vdjStemAware === true;
      const stemAmt = Math.max(0, Math.min(1, settings.vdjStemVocalCutAmt ?? 0.85));
      if (stemAware) void applyStemAwareDuck(fromId, stemAmt, 1.5);

      if (useFreeze) {
        setMessage(`❄ Echo-Freeze → ${next.title}`);
        if (settings.vdjUseScratch !== false) void performScratch(fromId, lvl.scratchCount);
        await echoFreezeTransition(fromId, toId);
      } else if (useBattle) {
        setMessage(`⚔ Battle Mode → ${next.title}`);
        if (settings.vdjUseFx !== false) applyGenreFx(moodGenre);
        const bbars = (settings.vdjBattleBars ?? 4) as 4 | 8 | 16;
        const brounds = settings.vdjBattleRounds ?? 4;
        await battleMode(fromId, toId, bbars, brounds);
        if (settings.vdjUseFx !== false) {
          await fxWetRamp(1, fxCfg.wet * lvl.fxWetMul, 0, 1.2);
          clearGenreFx();
        }
      } else if (useMashup) {
        setMessage(`💥 Double Drop → ${next.title}`);
        if (settings.vdjUseScratch !== false) void performScratch(fromId, lvl.scratchCount);
        const mbars = settings.vdjMashupBars ?? 8;
        await mashupDoubleDrop(fromId, toId, mbars);
      } else {
        // Pre-transition: scratch flourish on outgoing as a "DJ mark"
        if (settings.vdjUseScratch !== false) void performScratch(fromId, lvl.scratchCount);
        // Hard mode: extra scratch burst on the incoming deck right after start
        if (lvl.scratchExtra && settings.vdjUseScratch !== false) {
          setTimeout(() => { try { void performScratch(toId, 2); } catch { /* noop */ } }, 350);
        }
        // Filter sweep down on outgoing for smoother handoff (cleaner cut feel)
        void filterSweep(fromId, 0, -lvl.filterDepth, Math.min(3.5, fxCfg.xfadeSec / 2));
        // Gain duck on outgoing during the crossfade — deeper duck for cleaner blend
        void ramp((v) => setDeckGain(fromId, v), 1, lvl.duckTo, fxCfg.xfadeSec * 0.6);
        // Apply genre FX during transition with a wet ramp
        if (settings.vdjUseFx !== false) applyGenreFx(moodGenre);
        setMessage(`Mezclando → ${next.title}`);
        await crossfadeBetween(fromId, toId, fxCfg.xfadeSec);
        // Reset outgoing filter + gain
        setDeckFilter(fromId, 0);
        setDeckGain(fromId, 1);
        // Stop the outgoing deck cleanly
        pause(fromId);
        // Ramp down FX
        if (settings.vdjUseFx !== false) {
          await fxWetRamp(1, fxCfg.wet * lvl.fxWetMul, 0, 1.5);
          clearGenreFx();
        }
      }

      // (v1.7.4) Release stem-aware duck on outgoing (now silent/paused).
      if (stemAware) releaseStemAwareDuck(fromId);

      // Light boost on the new track's lows for a fresh-energy feel
      setEQ(toId, "lo", 0);
      void ramp((v) => setEQ(toId, "lo", v), 0, lvl.acidEdge ? 0.45 : 0.3, 0.8);
      setTimeout(() => { try { setEQ(toId, "lo", 0); } catch { /* noop */ } }, 4000);

      currentDeck = toId;
      currentIndex = i;

      // (v1.7.5 #9) Capture cue point for the new track.
      pushCue(i, next);
      // (v1.7.5 #10) Update live stream metadata.
      if (settings.vdjAutoStream === true && isStreaming()) {
        void updateStreamMetadata(next.title || `Track ${i + 1}`, next.artist || "");
      }
      // (v1.7.5 #12) Radio Show: every N tracks, insert a jingle.
      if (
        settings.vdjRadioShow === true &&
        settings.vdjRadioJingleTrackId &&
        ((i + 1) % Math.max(2, settings.vdjRadioJingleEvery ?? 4) === 0) &&
        i + 1 < queue.length
      ) {
        // Use the OTHER deck so the just-loaded track keeps its place visually.
        const jdeck = otherDeck(currentDeck);
        const dsCurNow = useApp.getState().decks[currentDeck];
        const fadeOutSec = 1.5;
        // Quick fade out of current
        await ramp((v) => setDeckGain(currentDeck, v), 1, 0, fadeOutSec);
        pause(currentDeck);
        await playRadioJingle(jdeck, settings.vdjRadioJingleTrackId);
        // Bring back current track from where it paused
        setDeckGain(currentDeck, 1);
        play(currentDeck, dsCurNow.position * (dsCurNow.duration || 0));
      }
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
          await spiceCurrent(currentDeck, settings.vdjMoodAdaptive === true ? "ambient" : genre);
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
      // Pro outro: filter sweep down + echo tail + sustained brake + reverb tail
      if (!cancelRequested && settings.vdjUseOutro !== false) {
        setMessage(`Outro profesional…`);
        const lvlOut = getIntensity();
        // Hard = brake más corto y seco; soft = brake más largo y dramático.
        const brakeBase = settings.vdjBrakeSec ?? 3.5;
        const brakeSec = Math.max(1, Math.min(8, brakeBase * (1 / lvlOut.xfadeMul)));
        // Final goodbye announce
        if (annMode === "every" || annMode === "start") announceDjName();
        // Sweep + echo simultaneously
        void filterSweep(currentDeck, 0, -lvlOut.filterDepth, brakeSec * 0.8);
        void echoOut(brakeSec * 1.2);
        // Sustained brake (longer = more dramatic spin-down)
        await brakeStop(currentDeck, brakeSec);
        // Final reverb tail wash on master after the brake
        const tailWet = Math.max(0.3, Math.min(0.95, 0.85 * lvlOut.fxWetMul));
        useApp.getState().updateFx(3, {
          kind: "reverb",
          wet: tailWet,
          param1: 0.9,
          param2: 0.8,
        });
        await fxWetRamp(3, tailWet, 0, 3.5);
        useApp.getState().updateFx(3, { kind: "off", wet: 0 });
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
          // (v1.7.5 #9) Export .cue sheet alongside the recording.
          if (settings.vdjExportCue !== false && cuePoints.length > 0) {
            try {
              const audioFile = `${recName}.wav`;
              const cueText = buildCueSheet(audioFile, recName, settings.djName || "Virtual DJ");
              const blob = new Blob([cueText], { type: "application/x-cue" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${recName}.cue`;
              document.body.appendChild(a);
              a.click();
              setTimeout(() => { try { URL.revokeObjectURL(url); a.remove(); } catch { /* noop */ } }, 1500);
              toast.success(`📋 Cue sheet exportado (${cuePoints.length} pistas)`);
            } catch (e) { console.warn("[vdj] cue export error", e); }
          }
        }
      } catch (err) {
        console.warn("[vdj] error guardando grabación", err);
      }
    }
    // (v1.7.5 #6) Stop mic shoutout monitor.
    try { stopMicShoutoutMonitor(); } catch { /* noop */ }
    // (v1.7.5 #10) Stop live stream if WE started it for this set.
    if (settings.vdjAutoStream === true && isStreaming()) {
      try { await stopStream(); } catch { /* noop */ }
    }
    cuePoints = [];
    recordingStartMs = 0;
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