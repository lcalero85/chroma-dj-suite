
# Virtual DJ Console — Pro Web App

A premium, modular, browser-based DJ console built on Web Audio API (with Tone.js as a thin helper for FX/sampler scheduling). Architecture supports 4 decks; UI launches with 2 active (A/B). Persistence via `localStorage` for prefs/skins and `IndexedDB` for tracks/cues/recordings.

## Layout (desktop-first, responsive down to tablet)

Single-screen pro console — no scrolling for the main mix view:

```
┌─────────────────────────── TOP BAR ──────────────────────────┐
│  Logo · Skin switcher · Master VU · BPM sync · Rec · Settings│
├─────────────┬───────────────────────────────┬────────────────┤
│   DECK A    │         MIXER (center)        │    DECK B      │
│  Waveform   │  Gain · EQ Hi/Mid/Lo · Filter │   Waveform     │
│  Jog wheel  │  VU L/R · Cue · Crossfader    │   Jog wheel    │
│  Transport  │                               │   Transport    │
│  Hot Cues   │                               │   Hot Cues     │
│  Loop ctrls │                               │   Loop ctrls   │
├─────────────┴───────────────────────────────┴────────────────┤
│  BOTTOM TABS: Library · FX · Sampler · Loops/Cues · Recorder │
├──────────────────────────────────────────────────────────────┤
│  Active panel content (Library by default)                   │
└──────────────────────────────────────────────────────────────┘
```

Side drawer: **Settings**, **Skins**, **Help/Shortcuts**.

## Modules & features

**Decks A/B (architecture for C/D)**
- Full transport: Play/Pause, Cue, Sync, Pitch fader (±8/16/50%), Key Lock toggle
- Interactive jog wheel: scratch (touch + mouse), nudge, bend; visual rotation locked to playback
- Per-deck waveform: full-track minimap + zoomed scrolling waveform with beatgrid overlay
- BPM detection (real, approximate): offline analysis via `OfflineAudioContext` + onset/autocorrelation
- Key Lock: `playbackRate` + pitch-preservation via `soundtouch-js` (or Tone.js GrainPlayer fallback)
- Musical key: editable via Camelot wheel (auto-detect simulated professionally)

**Mixer (center)**
- Per-channel: Gain trim, 3-band EQ (Hi/Mid/Lo with kill), Filter (single HP/LP knob, center = bypass), Channel fader, Cue/PFL toggle, VU meter
- Crossfader with curve selector (linear / sharp / smooth)
- Master volume, Master VU L/R, Booth out (UI-ready)
- Cue mix knob (cue/master blend on headphone bus)

**Hot Cues** — 8 pads per deck, color-coded, stored per track in IndexedDB
**Loops** — Auto loop (1/32 → 32 bars), Manual In/Out, Loop ×2/÷2, Reloop
**Sampler / Pads** — 4×4 pad bank, load short samples, 4 banks, volume, choke groups
**Sync** — Master clock with master-deck selection, beat-phase aligned

**FX panel** (3 FX racks, chainable per deck or master)
- Reverb, Delay (beat-synced 1/4–1/1), Filter sweep, Flanger, Phaser, Bitcrusher, Echo, Gate, Reverse — each with Dry/Wet + 1–2 params

**Library**
- Drag-drop or browse local files (multiple)
- Indexed in IndexedDB with metadata: title, artist, BPM, key, duration, color tag, last played
- Search (live filter), sort, playlists (create/rename/delete, drag tracks in)
- Right-click → "Load to Deck A/B", "Analyze BPM", "Set color"

**Recording**
- Capture master output via `MediaRecorder` from a `MediaStreamDestination`
- Saves WebM to IndexedDB; download as WAV (encoded client-side) or WebM
- Recordings list with playback, rename, delete

**Settings panel**
- Audio: master limiter on/off, crossfader curve, default pitch range, key lock default
- UI: animations on/off, VU response, waveform color mode, tooltips on/off
- Shortcuts: editable keymap (with sensible defaults)
- Reset to defaults / Export-Import config (JSON)

**Skins (10 included)**
1. **Pioneer Club** — black + orange, technical pro
2. **Serato Night** — neutral dark + cyan accents
3. **Neon Miami** — pink/cyan glow, retrowave
4. **Glassmorphism** — frosted blur, soft gradients
5. **Minimal Mono** — pure greyscale, ultra clean
6. **Retro 80s** — wood + amber LEDs
7. **Studio White** — bright daylight studio
8. **Cyberpunk** — magenta/lime hard edges
9. **Vinyl Warm** — sepia, paper textures
10. **Hacker Green** — terminal green on black

Skins = full CSS theme tokens swap (not just colors): radii, shadows, fonts, knob style. Selection persists in `localStorage` until changed.

**Help** — overlay with keyboard shortcuts cheatsheet, quick-start, feature tour

## UX/UI premium touches
- Custom rotary knobs (drag vertical, double-click to reset, scroll fine-tune)
- Smooth GPU-accelerated VU meters, peak-hold indicators, clipping flash
- Tooltips on every control (toggle in Settings)
- Subtle press/hover/active states, beat-pulse on play indicators
- Toast feedback (track loaded, BPM detected, recording started)
- Loading skeletons during analysis
- Full keyboard shortcuts (space=play, Q/W=cue, 1-8=hot cues, etc.)

## Code architecture

```
src/
├── routes/
│   ├── __root.tsx          (providers, theme application)
│   └── index.tsx           (console layout)
├── components/
│   ├── deck/               (Deck, JogWheel, Waveform, Transport, HotCues, LoopControls, PitchFader)
│   ├── mixer/              (MixerChannel, Crossfader, VuMeter, Knob, EqStrip, FilterKnob)
│   ├── library/            (LibraryPanel, TrackList, Playlists, SearchBar, FileImporter)
│   ├── fx/                 (FxPanel, FxRack, fx units)
│   ├── sampler/            (SamplerGrid, Pad, BankSelector)
│   ├── recorder/           (RecorderPanel, RecordingsList)
│   ├── settings/           (SettingsPanel, ShortcutsEditor)
│   ├── skins/              (SkinPicker, skin tokens)
│   ├── help/               (HelpOverlay)
│   └── ui/                 (Knob, Fader, Pad, Tooltip primitives)
├── audio/
│   ├── engine.ts           (AudioContext singleton, master bus, limiter, recorder tap)
│   ├── deck.ts             (per-deck audio graph: source → EQ → filter → gain → channel)
│   ├── eq.ts, filter.ts, gain.ts
│   ├── crossfader.ts
│   ├── fx/                 (reverb, delay, flanger, etc.)
│   ├── sampler.ts
│   ├── analysis/
│   │   ├── bpm.ts          (offline BPM via onset detection + autocorrelation)
│   │   └── waveform.ts     (peaks extraction)
│   ├── pitch.ts            (key-lock via soundtouch)
│   └── recorder.ts         (MediaRecorder + WAV encoder)
├── state/
│   ├── store.ts            (Zustand for app state)
│   ├── decks.ts, mixer.ts, library.ts, settings.ts, skin.ts
│   └── persistence.ts      (localStorage + IndexedDB sync)
├── lib/
│   ├── db.ts               (IndexedDB via idb)
│   ├── shortcuts.ts        (keymap engine)
│   ├── camelot.ts          (key wheel logic)
│   └── format.ts
├── styles/
│   ├── skins/              (10 skin token files: pioneer.css, neon.css, …)
│   └── tokens.css          (base design tokens)
└── styles.css
```

Dependencies: `zustand`, `idb`, `tone`, `soundtouchjs` (pitch), `lucide-react`, `wavesurfer.js` (waveform rendering helper).

## Persistence
- `localStorage`: selected skin, settings, shortcuts, last deck/mixer state
- `IndexedDB`: track files (Blob), metadata, playlists, hot cues, recordings, samples

## Out-of-scope simulations (clearly marked, architecture-ready)
- Booth out / split cue routing (UI present, single output bus)
- MIDI controller input (hooks ready, not wired)
- Streaming services (architecture allows providers; only local files in v1)

Build target: production-ready foundation, not a demo. Every module functional or professionally simulated with real audio passing through the graph.
