import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TrackRecord, PlaylistRecord, RecordingRecord, FolderRecord } from "@/lib/db";
import type { XfaderCurve } from "@/audio/crossfader";
import type { CamelotKey } from "@/lib/camelot";
import type { FxKind } from "@/audio/fx";

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
  | "ocean";

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
  activeBottomTab: "library" | "fx" | "sampler" | "loops" | "recorder" | "radio" | "online";
  drawer: null | "settings" | "skins" | "help";
  search: string;
  selectedPlaylistId: string | null;
  radio: RadioState;
  videoMix: VideoMixState;
  selectedFolderId: string | null;
  folders: FolderRecord[];

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
}

const defaultSettings: SettingsState = {
  animations: true,
  tooltips: true,
  vuResponse: 0.6,
  defaultPitchRange: 8,
  defaultKeyLock: true,
  shortcuts: {
    playA: "Space",
    playB: "ShiftRight",
    cueA: "KeyQ",
    cueB: "KeyW",
    syncA: "KeyA",
    syncB: "KeyS",
    record: "KeyR",
  },
  appName: "VDJ PRO",
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
    }),
    {
      name: "vdj-pro-state",
      partialize: (s) => ({
        skin: s.skin,
        settings: s.settings,
        mixer: s.mixer,
        radio: s.radio,
        videoMix: s.videoMix,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        return {
          ...current,
          ...p,
          mixer: { ...current.mixer, ...(p.mixer ?? {}) },
          settings: { ...current.settings, ...(p.settings ?? {}) },
          radio: { ...current.radio, ...(p.radio ?? {}) },
          videoMix: { ...current.videoMix, ...(p.videoMix ?? {}) },
        };
      },
    },
  ),
);