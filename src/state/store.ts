import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TrackRecord, PlaylistRecord, RecordingRecord, FolderRecord } from "@/lib/db";
import type { PhraseMarker } from "@/lib/db";
import type { XfaderCurve } from "@/audio/crossfader";
import type { CamelotKey } from "@/lib/camelot";
import type { FxKind } from "@/audio/fx";
import { defaultMidiSettings, type MidiSettings } from "@/midi/engine";
import { defaultShortcutMap } from "@/lib/shortcutDefs";
import { DEFAULT_MIX_PRESETS, type MixPreset } from "@/lib/mixPresets";

export type MidiState = MidiSettings & { _devicesVersion?: number };
void defaultMidiSettings;

export type DeckId = "A" | "B" | "C" | "D";
export type SkinId =
  | "pioneer"
  | "serato"
  | "neon"
  | "glass"
  | "minimal"
  | "retro"
  | "studio"
  | "cyber"
  | "vinyl"
  | "hacker"
  | "midnight"
  | "sunset"
  | "arctic"
  | "blood"
  | "gold"
  | "ocean"
  | "lava"
  | "forest"
  | "candy"
  | "matrix"
  | "royal"
  | "bigjogs"
  | "bigjogs-neon"
  | "bigjogs-gold"
  | "bigjogs-ocean"
  | "bigjogs-blood"
  | "bigjogs-forest"
  | "xl-bubblegum"
  | "xl-vaporwave"
  | "xl-tropical"
  | "xl-skater"
  | "xl-icecream"
  | "xl-galaxy";

export interface DeckState {
  trackId: string | null;
  title: string;
  artist: string;
  duration: number;
  position: number;
  isPlaying: boolean;
  bpm: number | null;
  key: CamelotKey | null;
  pitch: number; // -1..1
  pitchRange: 8 | 16 | 50;
  keyLock: boolean;
  cue: boolean;
  pflCue: boolean;
  gain: number; // 0..2
  hi: number;
  mid: number;
  lo: number;
  filter: number;
  fader: number;
  hotCues: { id: number; pos: number; color: string }[];
  cuePoint: number;
  loopStart: number | null;
  loopEnd: number | null;
  loopActive: boolean;
  /** Saved loops — 8 slots (id 0..7). Each stores start/end in seconds and a color. */
  savedLoops: { id: number; start: number; end: number; color: string; label?: string }[];
  peaks: number[];
  bands?: { lo: number[]; mid: number[]; hi: number[] } | null;
  reverse: boolean;
  slip: boolean;
  /** 0..1 — center-channel vocal cancellation amount */
  vocalCut: number;
  /** Beat grid offset (seconds) — where beat 0 of the bar lands.
   *  Used by the Waveform beatgrid, the Slicer anchor, and hot-cue quantize. */
  gridOffsetSec: number;
  /** Phrase markers (intro/verse/break/buildup/drop/outro). */
  phrases: PhraseMarker[];
  // Video support
  hasVideo?: boolean;
  videoUrl?: string | null;
  videoFx?: VideoFx;
}

export interface VideoFx {
  blur: number;       // 0..20 px
  brightness: number; // 0..2 (1 = normal)
  contrast: number;   // 0..2
  saturate: number;   // 0..2
  hueRotate: number;  // 0..360 deg
  invert: number;     // 0..1
  rgbShift: number;   // 0..20 px
  glitch: number;     // 0..1
  zoom: number;       // 0.5..2
}

export const defaultVideoFx = (): VideoFx => ({
  blur: 0, brightness: 1, contrast: 1, saturate: 1, hueRotate: 0,
  invert: 0, rgbShift: 0, glitch: 0, zoom: 1,
});

export interface MixerState {
  master: number;
  xfader: number; // -1..1
  xfaderCurve: XfaderCurve;
  cueMix: number;
  limiter: boolean;
  masterDeck: DeckId;
  quantize: boolean;
  autoMix: boolean;
  /** Master Tempo Lock — continuously matches every non-master deck's
   *  effective BPM to the master deck's effective BPM. */
  tempoLock: boolean;
  sleepMinutes: number; // 0 = off
  micOn: boolean;
  micLevel: number; // 0..2
  micDuck: number;  // 0..0.9
  micPreset: string; // voice preset id
  /** Which UI panel owns the mic. Prevents both Recorder + LiveVocal from
   * activating the mic at once and stacking voices. null = no owner. */
  micOwner: null | "recorder" | "livevocal";
  numpadDeck: DeckId; // which deck the numpad targets (A or B)
  /** When true, numpadDeck auto-follows the most recently used deck. User can still pick manually (auto pauses for ~6s after manual override). */
  autoActiveDeck: boolean;
}
export interface RadioState {
  enabled: boolean;
  queue: string[]; // track ids
  currentIndex: number;
  autoCrossfade: boolean;
  shuffle: boolean;
}

export interface RadioSegment {
  id: string;
  name: string;
  color: string;
  trackIds: string[];
  /** Optional schedule: HH:MM 24h. If set, segment auto-loads at this time when radio is enabled. */
  scheduledAt?: string | null;
  /** If true, run the schedule once per day. */
  recurring?: boolean;
  /** Days of the week the schedule applies to. 0=Sunday..6=Saturday. If empty/undefined → every day. */
  scheduledDays?: number[];
  /** Optional jingle track id played every N tracks while this segment is active in the queue. */
  jingleTrackId?: string | null;
  jingleEvery?: number;
  createdAt: number;
}

export type StreamStatus = "idle" | "connecting" | "live" | "error";

export interface StreamConfig {
  enabled: boolean;
  serverUrl: string;     // e.g. https://my-icecast.example.com
  mount: string;         // e.g. /stream
  username: string;      // typically "source"
  password: string;
  bitrate: 64 | 96 | 128 | 192 | 256;
  format: "webm-opus" | "ogg-opus";
  stationName: string;
  genre: string;
  description: string;
  autoStartWithRadio: boolean;
  status: StreamStatus;
  lastError: string | null;
  bytesSent: number;
  startedAt: number | null;
}

export interface VideoMixState {
  videoXfader: number; // -1..1, follows audio xfader by default
  linkAudioXfader: boolean;
  showStage: boolean;
}


export interface FxState {
  id: 1 | 2 | 3;
  kind: FxKind;
  wet: number;
  param1: number;
  param2: number;
  /** When true, time-based FX (delay/echo/gate/tremolo/autopan/wahwah/chorus)
   *  derive their rate from the master deck's BPM × `beatDiv`, instead of
   *  the raw param1 knob. Param1 is then re-purposed as a fine-tune offset.
   *  Mimics Pioneer Beat FX / Serato BeatGrid sync. */
  beatSync?: boolean;
  /** Beat division when beatSync is on. 0.125 = 1/8, 0.25 = 1/4, 0.5 = 1/2,
   *  1 = 1 beat, 2 = 2 beats, 4 = 4 beats. */
  beatDiv?: number;
}

export interface SettingsState {
  animations: boolean;
  tooltips: boolean;
  vuResponse: number; // 0..1 smoothing
  defaultPitchRange: 8 | 16 | 50;
  defaultKeyLock: boolean;
  shortcuts: Record<string, string>;
  appName: string;
  lang: "en" | "es" | "pt" | "fr" | "it";
  appMode: "basic" | "advanced";
  /** Session stats opt-in (default true). */
  trackStats?: boolean;
  /** Auto-reconnect live stream on error. */
  streamAutoReconnect?: boolean;
  /** Lower-third overlay on video stage. */
  videoLowerThird?: boolean;
  /** Auto-gain on import. */
  autoGainOnImport?: boolean;
  /** Auto-Cue on load: jump cue point to first transient when a track is
   * loaded onto a deck. Like Serato/Rekordbox "Auto Cue". Default true. */
  autoCueOnLoad?: boolean;
  /** How many decks are visible/active in the layout. Default 2 (A+B). */
  enabledDecks?: 2 | 4;
  /** Visual style for the deck waveforms. */
  waveformStyle?: "classic" | "bars" | "dual";
  /** Enable the live synthesizer panel (64-key keyboard + FX). Default false. */
  synthEnabled?: boolean;
  /** Enable the live vocal panel (autotune + harmonizer + FX). Default false. */
  liveVocalEnabled?: boolean;
  /** Selected microphone input device id (V8, USB mic, etc.). Empty = system default. */
  audioInputDeviceId?: string;
  /** Selected audio output device id. Empty = system default. */
  audioOutputDeviceId?: string;
  /** Web monitoring (route master to default browser output). When false, only the selected output (e.g. V8) plays. Default true. */
  webMonitoring?: boolean;
  /** Microphone noise suppression. */
  micNoiseSuppression?: boolean;
  /** Microphone echo cancellation. */
  micEchoCancellation?: boolean;
  /** Microphone auto-gain control. */
  micAutoGainControl?: boolean;
  /** Live synthesizer layered presets — IDs added on top of the main preset. */
  synthLayers?: string[];
  /** Per-panel visibility (Library is always shown). */
  panelVisibility?: {
    online?: boolean;
    radio?: boolean;
    fx?: boolean;
    sampler?: boolean;
    recorder?: boolean;
    presets?: boolean;
    synth?: boolean;
    livevocal?: boolean;
    beatmaker?: boolean;
    stems?: boolean;
  };
  /** UI view mode: 'studio' = full layout, 'booth' = compact for live performance. */
  viewMode?: "studio" | "booth";
  /** DJ display name shown in the top bar with a subtle animation. Empty = hidden. */
  djName?: string;
  /** Show the connected MIDI controller name in the top bar. Default true. */
  showControllerInTopbar?: boolean;
  /** Enable the AutoMix Pro engine + visual panel. Default false. */
  automixProEnabled?: boolean;
  /** Enable Smart Fader — auto-rides the crossfader as the master deck nears its
   * smart-exit point. Triggers a `smartCrossfade()` once. Default false. */
  smartFaderEnabled?: boolean;
  /** Virtual DJ — IDs de pistas marcadas para mezclar automáticamente. */
  vdjSelectedTrackIds?: string[];
  /** Virtual DJ — género objetivo (filtra por tag). 'auto' = sin filtro. */
  vdjGenre?: string;
  /** Virtual DJ — grabar la sesión completa (default true). */
  vdjRecord?: boolean;
  /** Virtual DJ — nombre de la sesión (opcional). */
  vdjSessionName?: string;
  /** Virtual DJ — habilitar el panel/botón en TopBar. Default false. */
  vdjEnabled?: boolean;
  /** ============ Virtual DJ — comportamientos configurables ============ */
  /** Duración base del crossfade entre pistas (segundos). 0 = usar el default por género. */
  vdjXfadeSec?: number;
  /** % del track al que se corta para entrar a la siguiente (0.5–0.95). */
  vdjCutAtPct?: number;
  /** Activar el "spice" (loops + sweeps + scratch + bend) a mitad de pista. */
  vdjUseSpice?: boolean;
  /** Aplicar FX de género en cada transición. */
  vdjUseFx?: boolean;
  /** Hacer scratch flourish antes de cada transición. */
  vdjUseScratch?: boolean;
  /** Hacer pequeños pitch-bends durante el spice. */
  vdjUsePitchBend?: boolean;
  /** Aplicar loops automáticos durante el spice. */
  vdjUseLoops?: boolean;
  /** Marcar hot-cues automáticamente al cargar cada pista. */
  vdjUseHotCues?: boolean;
  /** Sincronizar BPM (sync) al precargar la siguiente pista. */
  vdjSyncBpm?: boolean;
  /** Aplicar AutoGain a cada pista cargada. */
  vdjAutoGain?: boolean;
  /** Anunciar el nombre del DJ (voz robótica + stinger en master). */
  vdjAnnounceDj?: boolean;
  /** Frecuencia de anuncio del nombre del DJ: 'start' = sólo al iniciar,
   *  'every' = en cada transición, 'mid' = sólo a mitad de pista (default). */
  vdjAnnounceMode?: "start" | "every" | "mid";
  /** Volumen del stinger robótico (0..1). */
  vdjAnnounceVolume?: number;
  /** Outro profesional al finalizar la última pista (brake + echo + reverb). */
  vdjUseOutro?: boolean;
  /** Duración del brake (frenada de plato) al cierre, en segundos. */
  vdjBrakeSec?: number;
  /** Reproducir en orden aleatorio las pistas seleccionadas. */
  vdjShuffle?: boolean;
  /** Intensidad de la mezcla del Virtual DJ:
   *  - 'soft' = transiciones largas, FX sutiles, pocos scratches, pitch bends mínimos.
   *  - 'normal' = balanceado (default).
   *  - 'hard' = transiciones más cortas y agresivas, FX más mojados, scratches más
   *     frecuentes, EQ kills más profundos, loops más cortos, "ácido". */
  vdjIntensity?: "soft" | "normal" | "hard";
  /** ============ Funcionalidades avanzadas (v1.7.3) ============ */
  /** Energy Curve / Set planner — reordena la cola por BPM + compatibilidad
   *  Camelot formando un arco profesional warmup → peak → cooldown. */
  vdjEnergyCurve?: boolean;
  /** Forma de la curva de energía. */
  vdjEnergyShape?: "arc" | "ascending" | "descending" | "wave";
  /** Echo-Freeze + Cut transition — congela el último beat del outgoing
   *  con un echo infinito mientras entra el drop del incoming. Activable
   *  ocasionalmente además del crossfade clásico. */
  vdjEchoFreeze?: boolean;
  /** Probabilidad (0..1) de usar Echo-Freeze en lugar del crossfade clásico. */
  vdjEchoFreezeProb?: number;
  /** Drop / phrase alignment — alinea el corte al downbeat o al próximo
   *  marker de drop/buildup de la pista entrante. */
  vdjPhraseAlign?: boolean;
  /** Tolerancia de espera (segundos) para encontrar el siguiente downbeat
   *  o phrase marker. Si no aparece dentro de la ventana, corta igual. */
  vdjPhraseAlignWindowSec?: number;
  /** ============ Funcionalidades avanzadas (v1.7.4) ============ */
  /** Mash-up "Double Drop" — deja ambas pistas sonando varios compases
   *  con EQ split (lows del outgoing, highs del incoming) antes del corte. */
  vdjMashup?: boolean;
  /** Probabilidad (0..1) de usar Mash-up double drop por transición. */
  vdjMashupProb?: number;
  /** Compases del double drop (2..16). */
  vdjMashupBars?: number;
  /** Stem-aware mixing — durante la transición, atenúa la voz central
   *  del outgoing (vocalCut) para evitar choques vocales con el incoming. */
  vdjStemAware?: boolean;
  /** Cantidad de cancelación vocal aplicada al outgoing (0..1). */
  vdjStemVocalCutAmt?: number;
  /** Battle Mode — alterna decks cada N compases con cortes rápidos
   *  y scratches estilo turntablism. */
  vdjBattleMode?: boolean;
  /** Probabilidad (0..1) de invocar Battle Mode por transición. */
  vdjBattleProb?: number;
  /** Compases por "ronda" en Battle Mode. */
  vdjBattleBars?: 4 | 8 | 16;
  /** Número de rondas de battle antes de quedarse en el incoming (2..8). */
  vdjBattleRounds?: number;
  /** ============ Funcionalidades avanzadas (v1.7.5) ============ */
  /** #6 Live mic shoutouts — cuando el usuario hable por el mic durante
   *  un set Virtual DJ, atenuar el master automáticamente (sidechain). */
  vdjMicShoutout?: boolean;
  /** Umbral de RMS del mic para activar el duck (0..1). */
  vdjMicShoutoutThreshold?: number;
  /** Profundidad del duck del master cuando habla el mic (0..0.9). */
  vdjMicShoutoutDuck?: number;
  /** #8 Mood adaptativo — cambia automáticamente el género objetivo cada N
   *  pistas siguiendo un arco (chill → peak → cooldown). Solo afecta los
   *  FX de género en cada transición; no reordena la cola. */
  vdjMoodAdaptive?: boolean;
  /** Cada cuántas pistas avanzar al siguiente "mood". Default 3. */
  vdjMoodEveryN?: number;
  /** Forma del arco de mood. */
  vdjMoodShape?: "arc" | "ascending" | "descending" | "wave";
  /** #9 Cue points exportables — incluir un archivo .cue con timestamps de
   *  cada transición junto con la grabación. */
  vdjExportCue?: boolean;
  /** #10 Streaming en vivo — iniciar/parar el broadcast con el set y
   *  actualizar metadata en cada pista. */
  vdjAutoStream?: boolean;
  /** #11 Beatjuggling — juggles A/B cortos en pistas con BPM bajo. */
  vdjBeatjuggle?: boolean;
  /** BPM máximo para activar beatjuggling (default 100). */
  vdjBeatjuggleMaxBpm?: number;
  /** Probabilidad de beatjuggling por pista lenta (0..1). */
  vdjBeatjuggleProb?: number;
  /** #12 Radio Show — insertar jingles + shoutouts cada N pistas. */
  vdjRadioShow?: boolean;
  /** Cada cuántas pistas insertar un jingle. Default 4. */
  vdjRadioJingleEvery?: number;
  /** ID del track marcado como jingle (debe estar en la library). */
  vdjRadioJingleTrackId?: string | null;
  /** ============ Funcionalidades pro (v1.7.6) ============ */
  /** #1 Harmonic Mixing AI — reordena la cola para que cada salto sea
   *  Camelot-compatible (+1, -1, relativo). Usa detectCamelotKey real. */
  vdjHarmonicMixing?: boolean;
  /** Tolerancia: si no hay match perfecto, permitir ±2 semitonos por
   *  pitch shift (0 = estricto, 1 = relajado). */
  vdjHarmonicTolerance?: number;
  /** #2 Acapella & Instrumental Layering — al cargar la siguiente pista,
   *  isolar instrumentos del incoming y voz del outgoing por unos compases. */
  vdjAcapellaLayer?: boolean;
  /** Probabilidad de aplicar layering por transición (0..1). */
  vdjAcapellaProb?: number;
  /** Compases de layering (1..8). */
  vdjAcapellaBars?: number;
  /** #3 Loop Roll automático — antes del corte, ejecuta loops 1/2 → 1/4 →
   *  1/8 → 1/16 estilo "stutter buildup". */
  vdjLoopRoll?: boolean;
  /** Probabilidad (0..1). */
  vdjLoopRollProb?: number;
  /** #4 Crowd Energy Meter — mostrar overlay con curva de energía y
   *  nivel actual durante el set. */
  vdjEnergyMeter?: boolean;
  /** #5 Smart Queue Builder — reordenar cola por curva combinada
   *  energía + key + bpm (más estricto que Energy Curve). */
  vdjSmartQueue?: boolean;
  /** #6 Reverse Play & Brake FX — censura inversa breve antes de cortar. */
  vdjReverseFx?: boolean;
  vdjReverseFxProb?: number;
  /** Compases de reverse (0.5..4). */
  vdjReverseBars?: number;
  /** #7 Auto Drop Builder — riser sintético + snare roll antes del drop. */
  vdjDropBuilder?: boolean;
  vdjDropBuilderProb?: number;
  /** Duración del riser (s). */
  vdjDropBuilderSec?: number;
  /** #8 Voice Command Mode — escuchar comandos por mic (Web Speech API). */
  vdjVoiceCommands?: boolean;
  /** Idioma reconocimiento (default = lang del app). */
  vdjVoiceLang?: string;
  /** #9 Auto Mashup Generator — combinar 2-3 tracks de la cola con stems. */
  vdjAutoMashup?: boolean;
  vdjAutoMashupEveryN?: number;
  /** #10 Mix Report PDF — generar reporte al terminar la sesión. */
  vdjMixReport?: boolean;
  /** ============ Funcionalidades autónomas (v1.7.7) ============ */
  /** Skin que se aplica automáticamente al iniciar el Virtual DJ; el skin
   *  previo se restaura al detener. Vacío = no cambiar el skin. */
  vdjDefaultSkin?: SkinId | "";
  /** Autopiloto inteligente — ajusta solo intensidad por hora del día. */
  vdjSmartAutopilot?: boolean;
  /** Recuperación automática: si una pista falla al cargar, salta a la
   *  siguiente sin romper la mezcla. Default true. */
  vdjAutoRecover?: boolean;
  /** Transiciones ajustadas — pre-carga la siguiente pista antes y muestrea
   *  los waits cada 100ms para crossfade sin huecos. Default true. */
  vdjTightTransitions?: boolean;
  /** Mostrar overlay flotante "MEZCLANDO" durante el set. Default true. */
  vdjShowStatusOverlay?: boolean;
}

export interface SessionStats {
  startedAt: number;
  tracksPlayed: number;
  totalSeconds: number;
  topTracks: { trackId: string; count: number }[];
}

const defaultDeck = (): DeckState => ({
  trackId: null,
  title: "—",
  artist: "",
  duration: 0,
  position: 0,
  isPlaying: false,
  bpm: null,
  key: null,
  pitch: 0,
  pitchRange: 8,
  keyLock: true,
  cue: false,
  pflCue: false,
  gain: 1,
  hi: 0,
  mid: 0,
  lo: 0,
  filter: 0,
  fader: 0.85,
  hotCues: [],
  cuePoint: 0,
  loopStart: null,
  loopEnd: null,
  loopActive: false,
  savedLoops: [],
  peaks: [],
  bands: null,
  reverse: false,
  slip: false,
  vocalCut: 0,
  gridOffsetSec: 0,
  phrases: [],
  hasVideo: false,
  videoUrl: null,
  videoFx: defaultVideoFx(),
});

interface AppState {
  decks: Record<DeckId, DeckState>;
  mixer: MixerState;
  fx: FxState[];
  skin: SkinId;
  settings: SettingsState;
  tracks: TrackRecord[];
  playlists: PlaylistRecord[];
  recordings: RecordingRecord[];
  activeDecks: DeckId[];
  activeBottomTab: "library" | "fx" | "sampler" | "loops" | "recorder" | "radio" | "online" | "presets" | "synth" | "livevocal" | "beatmaker" | "stems";
  drawer: null | "settings" | "skins" | "help" | "about";
  search: string;
  selectedPlaylistId: string | null;
  radio: RadioState;
  videoMix: VideoMixState;
  selectedFolderId: string | null;
  folders: FolderRecord[];
  midi: MidiState;
  segments: RadioSegment[];
  stream: StreamConfig;
  mixPresets: MixPreset[];

  // setters
  updateDeck: (id: DeckId, patch: Partial<DeckState>) => void;
  updateMixer: (patch: Partial<MixerState>) => void;
  updateFx: (id: 1 | 2 | 3, patch: Partial<FxState>) => void;
  setSkin: (s: SkinId) => void;
  updateSettings: (patch: Partial<SettingsState>) => void;
  setTracks: (t: TrackRecord[]) => void;
  setPlaylists: (p: PlaylistRecord[]) => void;
  setRecordings: (r: RecordingRecord[]) => void;
  setActiveBottomTab: (t: AppState["activeBottomTab"]) => void;
  setDrawer: (d: AppState["drawer"]) => void;
  setSearch: (s: string) => void;
  setSelectedPlaylist: (id: string | null) => void;
  updateRadio: (patch: Partial<RadioState>) => void;
  updateVideoMix: (patch: Partial<VideoMixState>) => void;
  setSelectedFolder: (id: string | null) => void;
  setFolders: (f: FolderRecord[]) => void;
  updateVideoFx: (id: DeckId, patch: Partial<VideoFx>) => void;
  setSegments: (s: RadioSegment[]) => void;
  upsertSegment: (s: RadioSegment) => void;
  removeSegment: (id: string) => void;
  updateStream: (patch: Partial<StreamConfig>) => void;
  setMixPresets: (p: MixPreset[]) => void;
  upsertMixPreset: (p: MixPreset) => void;
  removeMixPreset: (id: string) => void;
}

const defaultSettings: SettingsState = {
  animations: true,
  tooltips: true,
  vuResponse: 0.6,
  defaultPitchRange: 8,
  defaultKeyLock: true,
  shortcuts: defaultShortcutMap(),
  appName: "VDJ PRO",
  lang: "en",
  appMode: "advanced",
  enabledDecks: 2,
  waveformStyle: "classic",
  synthEnabled: false,
  liveVocalEnabled: false,
  audioInputDeviceId: "",
  audioOutputDeviceId: "",
  webMonitoring: true,
  micNoiseSuppression: true,
  micEchoCancellation: true,
  micAutoGainControl: false,
  synthLayers: [],
  panelVisibility: {
    online: true,
    radio: true,
    fx: true,
    sampler: true,
    recorder: true,
    presets: true,
    synth: false,
    livevocal: false,
    beatmaker: false,
    stems: true,
  },
  djName: "",
  showControllerInTopbar: true,
};

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      decks: {
        A: defaultDeck(),
        B: defaultDeck(),
        C: defaultDeck(),
        D: defaultDeck(),
      },
      mixer: {
        master: 0.85,
        xfader: 0,
        xfaderCurve: "smooth",
        cueMix: 0.5,
        limiter: true,
        masterDeck: "A",
        quantize: false,
        autoMix: false,
        tempoLock: false,
        sleepMinutes: 0,
        micOn: false,
        micLevel: 1,
        micDuck: 0.4,
        micPreset: "off",
        micOwner: null,
        numpadDeck: "A",
        autoActiveDeck: true,
      },
      fx: [
        { id: 1, kind: "off", wet: 0, param1: 0.5, param2: 0.5, beatSync: false, beatDiv: 1 },
        { id: 2, kind: "off", wet: 0, param1: 0.5, param2: 0.5, beatSync: false, beatDiv: 1 },
        { id: 3, kind: "off", wet: 0, param1: 0.5, param2: 0.5, beatSync: false, beatDiv: 1 },
      ],
      skin: "pioneer",
      settings: defaultSettings,
      tracks: [],
      playlists: [],
      recordings: [],
      activeDecks: ["A", "B"],
      activeBottomTab: "library",
      drawer: null,
      search: "",
      selectedPlaylistId: null,
      radio: { enabled: false, queue: [], currentIndex: -1, autoCrossfade: true, shuffle: false },
      videoMix: { videoXfader: 0, linkAudioXfader: true, showStage: true },
      selectedFolderId: null,
      folders: [],
      midi: defaultMidiSettings,
      segments: [],
      stream: {
        enabled: false,
        serverUrl: "",
        mount: "/stream",
        username: "source",
        password: "",
        bitrate: 128,
        format: "webm-opus",
        stationName: "VDJ PRO Radio",
        genre: "Mixed",
        description: "Live DJ set",
        autoStartWithRadio: false,
        status: "idle",
        lastError: null,
        bytesSent: 0,
        startedAt: null,
      },
      mixPresets: DEFAULT_MIX_PRESETS,

      updateDeck: (id, patch) =>
        set((s) => ({ decks: { ...s.decks, [id]: { ...s.decks[id], ...patch } } })),
      updateMixer: (patch) => set((s) => ({ mixer: { ...s.mixer, ...patch } })),
      updateFx: (id, patch) =>
        set((s) => ({ fx: s.fx.map((f) => (f.id === id ? { ...f, ...patch } : f)) })),
      setSkin: (skin) => set({ skin }),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setTracks: (tracks) => set({ tracks }),
      setPlaylists: (playlists) => set({ playlists }),
      setRecordings: (recordings) => set({ recordings }),
      setActiveBottomTab: (activeBottomTab) => set({ activeBottomTab }),
      setDrawer: (drawer) => set({ drawer }),
      setSearch: (search) => set({ search }),
      setSelectedPlaylist: (selectedPlaylistId) => set({ selectedPlaylistId }),
      updateRadio: (patch) => set((s) => ({ radio: { ...s.radio, ...patch } })),
      updateVideoMix: (patch) => set((s) => ({ videoMix: { ...s.videoMix, ...patch } })),
      setSelectedFolder: (selectedFolderId) => set({ selectedFolderId }),
      setFolders: (folders) => set({ folders }),
      updateVideoFx: (id, patch) =>
        set((s) => ({
          decks: {
            ...s.decks,
            [id]: {
              ...s.decks[id],
              videoFx: { ...(s.decks[id].videoFx ?? defaultVideoFx()), ...patch },
            },
          },
        })),
      setSegments: (segments) => set({ segments }),
      upsertSegment: (seg) =>
        set((s) => {
          const idx = s.segments.findIndex((x) => x.id === seg.id);
          if (idx === -1) return { segments: [...s.segments, seg] };
          const next = [...s.segments];
          next[idx] = seg;
          return { segments: next };
        }),
      removeSegment: (id) => set((s) => ({ segments: s.segments.filter((x) => x.id !== id) })),
      updateStream: (patch) => set((s) => ({ stream: { ...s.stream, ...patch } })),
      setMixPresets: (mixPresets) => set({ mixPresets }),
      upsertMixPreset: (p) =>
        set((s) => {
          const idx = s.mixPresets.findIndex((x) => x.id === p.id);
          if (idx === -1) return { mixPresets: [...s.mixPresets, p] };
          const next = [...s.mixPresets];
          next[idx] = p;
          return { mixPresets: next };
        }),
      removeMixPreset: (id) =>
        set((s) => ({ mixPresets: s.mixPresets.filter((x) => x.id !== id) })),
    }),
    {
      name: "vdj-pro-state",
      partialize: (s) => ({
        skin: s.skin,
        settings: s.settings,
        mixer: s.mixer,
        radio: s.radio,
        videoMix: s.videoMix,
        midi: s.midi,
        segments: s.segments,
        mixPresets: s.mixPresets,
        // Persist deck mixer/fx settings (NOT transient playback state).
        decks: Object.fromEntries(
          (Object.keys(s.decks) as DeckId[]).map((id) => {
            const d = s.decks[id];
            return [
              id,
              {
                gain: d.gain,
                hi: d.hi,
                mid: d.mid,
                lo: d.lo,
                filter: d.filter,
                fader: d.fader,
                pitch: d.pitch,
                pitchRange: d.pitchRange,
                keyLock: d.keyLock,
                vocalCut: d.vocalCut,
                reverse: d.reverse,
                slip: d.slip,
                videoFx: d.videoFx,
              },
            ];
          }),
        ) as Record<DeckId, Partial<DeckState>>,
        fx: s.fx,
        activeDecks: s.activeDecks,
        activeBottomTab: s.activeBottomTab,
        selectedFolderId: s.selectedFolderId,
        selectedPlaylistId: s.selectedPlaylistId,
        stream: {
          ...s.stream,
          // do not persist transient runtime fields
          status: "idle" as StreamStatus,
          lastError: null,
          bytesSent: 0,
          startedAt: null,
        },
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        // Always re-merge built-in presets (so updates ship to existing users)
        // while preserving any user-created presets.
        const builtinIds = new Set(DEFAULT_MIX_PRESETS.map((x) => x.id));
        const userPresets = (p.mixPresets ?? []).filter((x) => !builtinIds.has(x.id));
        const mergedPresets = [...DEFAULT_MIX_PRESETS, ...userPresets];
        // Re-merge persisted deck mixer/fx settings on top of fresh defaults
        // so transient playback fields (position, isPlaying, peaks, trackId…)
        // always start clean.
        const mergedDecks = { ...current.decks };
        if (p.decks) {
          (Object.keys(mergedDecks) as DeckId[]).forEach((id) => {
            const persistedDeck = (p.decks as Record<DeckId, Partial<DeckState>>)[id];
            if (persistedDeck) {
              mergedDecks[id] = { ...mergedDecks[id], ...persistedDeck };
            }
          });
        }
        return {
          ...current,
          ...p,
          decks: mergedDecks,
          fx: p.fx ?? current.fx,
          activeDecks: p.activeDecks ?? current.activeDecks,
          activeBottomTab: p.activeBottomTab ?? current.activeBottomTab,
          selectedFolderId: p.selectedFolderId ?? current.selectedFolderId,
          selectedPlaylistId: p.selectedPlaylistId ?? current.selectedPlaylistId,
          mixer: { ...current.mixer, ...(p.mixer ?? {}) },
          settings: { ...current.settings, ...(p.settings ?? {}) },
          radio: { ...current.radio, ...(p.radio ?? {}) },
          videoMix: { ...current.videoMix, ...(p.videoMix ?? {}) },
          midi: { ...current.midi, ...(p.midi ?? {}) },
          segments: p.segments ?? current.segments,
          mixPresets: mergedPresets,
          stream: { ...current.stream, ...(p.stream ?? {}) },
        };
      },
    },
  ),
);