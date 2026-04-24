# Chroma DJ Suite

A modern, browser-based DJ console built with TanStack Start, React 19 and the Web Audio API. It provides a full mixing environment — multi-deck playback, EQ/filters, FX, sampler, hot cues, loops, scratch, recording, microphone path, live vocal, video deck, internet radio, MIDI controllers, skins and more — all running entirely in the browser.

- **Preview**: https://id-preview--a307459c-f3af-4711-a1ba-7022e7514bf5.lovable.app
- **Published**: https://chroma-dj-suite.lovable.app
- **Current version**: shown as `v1.1.0` chip in the top bar.

## Purpose

Provide a serious, performance-grade DJ tool that runs in any modern browser without installs, while remaining easy to learn for hobbyists. The app targets:

- Mobile DJs and home DJs who want a full console without proprietary software.
- Streamers who need an integrated mic / live-vocal / radio / recording chain.
- Educators and learners exploring mixing, EQ, FX, looping and beatmatching.

## Technologies

- **TanStack Start v1** + **React 19** — file-based routing under `src/routes/`.
- **Vite 7** + Cloudflare Vite plugin — bundling and edge-ready builds.
- **Tailwind CSS v4** + custom skins via `src/styles.css` and `src/styles/skins.css`.
- **Zustand** — global state (`src/state/store.ts`) with controller helpers.
- **Web Audio API** — engine, decks, EQ, filters, FX, recorder, analyzers.
- **@soundtouchjs/audio-worklet** — high-quality time-stretch / key-lock.
- **MediaRecorder + custom WAV encoder** — mix and microphone capture.
- **Radix UI + shadcn-style components** — accessible primitives in `src/components/ui/`.
- **lucide-react** — iconography.
- **TanStack Query** — async data layer.
- **IndexedDB (`src/lib/db.ts`)** — local library, recordings, samples, presets.

## Architecture

```
src/
  audio/         Web Audio engine, decks, FX, recorder, mic, video, sampler, scratch
  components/   UI panels grouped by feature (deck, mixer, fx, sampler, …)
  hooks/        React hooks
  lib/          Utilities, i18n, shortcuts, presets, formatting
  midi/         Web MIDI engine, profiles, action mapping
  routes/       TanStack Start file-based routes (incl. `api/` server functions)
  state/        Zustand store and high-level controller actions
  styles.css    Design tokens (oklch) + base styles
  styles/skins.css  Themeable skin variants
```

The engine is a single `AudioContext` with per-deck graphs, a master bus with limiter and analyzer, an FX bus, mic path, and a recorder tap. Controller actions in `src/state/controller.ts` are the single source of truth that updates both the store and the audio nodes.

## Main modules

- **Audio engine** (`src/audio/engine.ts`) — context, master bus, limiter, monitoring, output device routing.
- **Decks** (`src/audio/deck.ts`, `src/components/deck/Deck.tsx`) — load, play, pause, seek, pitch, key-lock, gain, EQ, filter, fader, analyser per deck. Up to 4 decks (A/B/C/D).
- **Transport** (`src/audio/transport.ts`) — beat-jump, brake, reverse, sleep timer, auto-mix, tap tempo, beat quantize.
- **Crossfader** (`src/audio/crossfader.ts`) — linear / smooth / sharp curves; C↔A and D↔B mirroring.
- **Mixer / Channels** (`src/components/mixer/*`) — channel strips with gain, 3-band EQ, filter, PFL cue, fader, VU meter; master section with limiter, sleep, and master pro tools.
- **FX** (`src/audio/fx`, `src/components/fx/FxPanel.tsx`) — multi-rack effects with wet/dry, beat-synced where applicable.
- **Sampler** (`src/audio/sampler.ts`, `src/components/sampler/SamplerPanel.tsx`) — performance pads with slot triggers.
- **Scratch / Jog** (`src/audio/scratch.ts`, `src/components/deck/JogWheel.tsx`) — scratch, pitch-bend nudge.
- **Hot cues + Loops** (controller + deck UI) — 8 hot cues per deck, manual and beat-aligned loops.
- **Sync / BPM / Key** (`src/audio/analysis/*`, `src/components/deck/BpmControls.tsx`) — BPM detection, sync, Camelot helper (`src/lib/camelot.ts`).
- **Waveform** (`src/components/deck/Waveform.tsx`) — overview + zoomed track visualization.
- **Recorder** (`src/audio/recorder.ts`, `src/components/recorder/RecorderPanel.tsx`) — full mix recording with download/library.
- **Microphone path** (`src/audio/micRecorder.ts`) — independent mic capture with WAV export.
- **Live Vocal** (`src/audio/vocalFx.ts`, `src/components/livevocal/LiveVocalPanel.tsx`) — vocal FX chain decoupled from the recorder mic ownership.
- **Video deck** (`src/audio/videoDeck.ts`, `src/components/video/*`) — video playback + visual FX, optional video recording.
- **Beatmaker / Synth** (`src/audio/beatmaker.ts`, `src/audio/synth.ts`) — built-in pattern programmer and synth.
- **Library** (`src/lib/db.ts`, `src/components/library/LibraryPanel.tsx`) — IndexedDB-backed track list, recordings, samples, presets.
- **Mix presets** (`src/lib/mixPresets.ts`, `src/components/presets/MixPresetsPanel.tsx`) — save/recall mixer & FX state.
- **Online / Radio** (`src/audio/iceStreamer.ts`, `src/components/{online,radio}/*`) — Icecast streaming + scheduled radio segments.
- **MIDI** (`src/midi/*`) — Web MIDI input mapping with profiles and action bindings.
- **Shortcuts** (`src/lib/shortcuts.ts`, `src/lib/shortcutDefs.ts`) — fully remappable keyboard shortcuts incl. numpad routing.
- **Skins / Theme** (`src/components/skins/SkinPicker.tsx`, `styles/skins.css`) — multiple themes, persisted in store.
- **i18n** (`src/lib/i18n/*`) — EN / FR / IT / PT translations.

## UI sections

- **TopBar** — app name, skin chip, **version chip (v1.1.0)**, DJ name, MIDI/stream/radio status, drawer toggles, shortcuts/help, settings.
- **Decks A/B (and optional C/D)** — waveform, jog, transport (play/cue/sync), pitch fader, key-lock, BPM, hot cues, loops, pro controls.
- **Mixer center** — channel strips, master, crossfader, limiter, curve selector, master/cue meters, sleep timer.
- **Bottom tabs** — Library, FX, Sampler, Beatmaker, Synth, Recorder, Live Vocal, Online, Radio, Presets, Settings, Help, About.
- **Drawer** — collapsible side panel for browser/library and tools.
- **Video stage** — optional overlay with VJ visuals.
- **Toaster** — inline notifications (sonner).

## Implemented features (audited and confirmed present)

- Multi-deck playback (2 or 4 decks), play/cue/pause/seek
- Sync, manual pitch, key-lock (SoundTouch worklet)
- 8 hot cues per deck with shortcut + numpad routing
- Manual loops + beat-aligned auto loops; loop toggle / clear
- Jog wheel scratch and pitch bend
- Channel strip: gain, 3-band EQ, bipolar filter, PFL cue, fader, VU meter
- Crossfader with linear / smooth / sharp curves; C↔A, D↔B mirroring
- Master VU + cue VU, limiter, master volume, cue mix
- Multi-rack FX (per-channel + master) with wet/dry
- Sampler / performance pads with shortcut triggers
- Waveform overview + scroll, BPM display, Camelot key
- Mix recorder with library/download
- Independent microphone recording (WAV) — does not interfere with mix
- Live Vocal chain decoupled from Recorder mic ownership
- Video deck + video FX (optional)
- Internet radio scheduling + Icecast streaming
- MIDI controller support with mappable profiles
- Auto-mix (gradual crossfader slide with safety check)
- Tap tempo, brake, reverse, sleep timer, beat-jump
- Mix presets (save/recall)
- Library backed by IndexedDB
- Theming via skins (persisted)
- Multi-language UI (EN / FR / IT / PT)
- Fully remappable keyboard shortcuts + on-screen overlay

## Newly added or improved features in v1.1.0

- **Version chip is now visually highlighted** (gradient background, bold) in the TopBar so the active build is unmistakable.
- **Bumped version label to `v1.1.0`** to reflect the audit + documentation pass.
- **README.md added** — full architecture, module map, run/build/deploy notes.

No audio, recorder, live-vocal, mixer, FX, deck or layout logic was modified during this version bump — the v1.0.0 stable behavior is preserved 1:1.

## Pending / future work

- Stems separation per deck.
- Cloud library sync.
- Per-deck independent FX rack UI surfacing (engine already supports it).
- Recording in formats other than WAV/WebM (e.g. MP3 via WASM encoder).
- Touch-first layout for tablets.
- Smart auto-mix using key + energy matching.

## Folder structure

```
src/
  audio/                 Web Audio engine and processors
    analysis/            BPM / loudness analysis
    fx/                  FX rack implementation
  components/
    about/  beatmaker/  console/  deck/  fx/  help/  library/
    livevocal/  mixer/  online/  presets/  radio/  recorder/
    sampler/  settings/  skins/  synth/  ui/  video/
  hooks/                 use-mobile, etc.
  lib/                   db, i18n, format, helpPdf, shortcuts, presets, camelot, utils
  midi/                  Web MIDI engine + action mapping + profiles
  routes/                TanStack Start routes (incl. server `api/`)
  state/                 Zustand store + controller actions
  styles.css             Design tokens (oklch) and base
  styles/skins.css       Skin variants
```

## Run locally

```bash
bun install
bun run dev
```

The dev server runs Vite with the TanStack Start + Cloudflare plugins.

## Build

```bash
bun run build
```

Outputs the production bundle (Cloudflare-Worker compatible). To preview the production build:

```bash
bun run preview
```

## Deploy

The project is deployed via the Lovable platform (Lovable Cloud / Cloudflare). The published URL above always serves the latest published build. No additional configuration is required from the user — `wrangler.jsonc` and `vercel.json` are checked in for compatibility but should not be edited as part of routine development.

## Notes about audio, mic, recording and export

- The `AudioContext` boots on the first user gesture (pointer or key) — required by browser autoplay policies.
- The **mix recorder** taps the master bus after limiter; the **microphone recorder** taps the raw mic input. Both are independent: enabling/disabling one does NOT affect the other (this was specifically fixed and is preserved here).
- Live Vocal owns the mic only when explicitly activated from its panel; the Recorder panel owns the mic only when its own toggle is on. The UI reflects ownership per-panel.
- Microphone recordings are exported as WAV. Mix recordings use the browser's `MediaRecorder` (typically WebM/Opus) and are stored in IndexedDB and downloadable from the library.
- Audio output device can be re-routed when the browser supports `setSinkId`.
- Web Monitoring toggle in Settings controls whether the master bus is audible locally during streaming.

## Version notes

| Version | Notes |
|---------|-------|
| v1.1.0  | Audit + documentation pass. Highlighted version chip. README added. No behavior changes. |
| v1.0.0  | Stable release candidate. Independent mic ownership for Recorder vs Live Vocal. Full DJ console feature set. |
