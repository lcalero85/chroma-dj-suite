import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TrackRecord, PlaylistRecord, RecordingRecord, FolderRecord } from "@/lib/db";
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
  | "royal";

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
  peaks: number[];
  bands?: { lo: number[]; mid: number[]; hi: number[] } | null;
  reverse: boolean;
  slip: boolean;
  /** 0..1 — center-channel vocal cancellation amount */
  vocalCut: number;
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
  sleepMinutes: number; // 0 = off
  micOn: boolean;
  micLevel: number; // 0..2
  micDuck: number;  // 0..0.9
  micPreset: string; // voice preset id
  numpadDeck: DeckId; // which deck the numpad targets (A or B)
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
  };
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
  peaks: [],
  bands: null,
  reverse: false,
  slip: false,
  vocalCut: 0,
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
  activeBottomTab: "library" | "fx" | "sampler" | "loops" | "recorder" | "radio" | "online" | "presets" | "synth" | "livevocal" | "beatmaker";
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
  },
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
        sleepMinutes: 0,
        micOn: false,
        micLevel: 1,
        micDuck: 0.4,
        micPreset: "off",
        numpadDeck: "A",
      },
      fx: [
        { id: 1, kind: "off", wet: 0, param1: 0.5, param2: 0.5 },
        { id: 2, kind: "off", wet: 0, param1: 0.5, param2: 0.5 },
        { id: 3, kind: "off", wet: 0, param1: 0.5, param2: 0.5 },
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