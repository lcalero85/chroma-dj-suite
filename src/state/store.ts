import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TrackRecord, PlaylistRecord, RecordingRecord } from "@/lib/db";
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
}

export interface MixerState {
  master: number;
  xfader: number; // -1..1
  xfaderCurve: XfaderCurve;
  cueMix: number;
  limiter: boolean;
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
  activeBottomTab: "library" | "fx" | "sampler" | "loops" | "recorder";
  drawer: null | "settings" | "skins" | "help";
  search: string;
  selectedPlaylistId: string | null;

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
    }),
    {
      name: "vdj-pro-state",
      partialize: (s) => ({
        skin: s.skin,
        settings: s.settings,
        mixer: s.mixer,
      }),
    },
  ),
);