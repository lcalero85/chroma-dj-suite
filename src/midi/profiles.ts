// Preconfigured MIDI mappings for popular controllers.
// Each binding maps a (status,data1) pair to an action id.
// LED feedback bindings echo state back to the same/another note.

export type MidiBinding = {
  /** MIDI status byte without channel: 0x90 note on, 0x80 note off, 0xB0 CC, 0xE0 pitchbend */
  type: "note" | "cc" | "pitchbend";
  /** MIDI channel 0..15 */
  channel: number;
  /** Note number / CC number (ignored for pitchbend) */
  data1: number;
  /** Action id from MIDI_ACTIONS */
  actionId: string;
  /** Optional value transform: "absolute" (default), "invert", "relative-2c" (jog) */
  transform?: "absolute" | "invert" | "relative-2c";
  /**
   * Optional MIDI input device id this binding is bound to.
   * When set, the binding only fires for messages coming from that device.
   * When undefined, any active input device may trigger it (used by built-in profiles).
   */
  deviceId?: string;
  /** Optional human-readable device name, shown in the UI. */
  deviceName?: string;
};

export interface MidiProfile {
  id: string;
  name: string;
  /** input device name pattern (case-insensitive substring). null = manual */
  inputMatch: string | null;
  /** output device name pattern for LED feedback */
  outputMatch: string | null;
  bindings: MidiBinding[];
  /** LED feedback: action id -> note to send */
  ledMap?: Record<string, { type: "note" | "cc"; channel: number; data1: number }>;
}

// ---------------- Pioneer DDJ-400 ----------------
const ddj400: MidiProfile = {
  id: "pioneer-ddj-400",
  name: "Pioneer DDJ-400",
  inputMatch: "DDJ-400",
  outputMatch: "DDJ-400",
  bindings: [
    // Deck A (channel 0)
    { type: "note", channel: 0, data1: 0x0B, actionId: "deck.A.play" },
    { type: "note", channel: 0, data1: 0x0C, actionId: "deck.A.cue" },
    { type: "note", channel: 0, data1: 0x58, actionId: "deck.A.sync" },
    { type: "cc", channel: 0, data1: 0x00, actionId: "deck.A.pitch", transform: "invert" },
    { type: "cc", channel: 0, data1: 0x33, actionId: "deck.A.fader" },
    { type: "cc", channel: 0, data1: 0x16, actionId: "deck.A.gain" },
    { type: "cc", channel: 0, data1: 0x07, actionId: "deck.A.eq.hi" },
    { type: "cc", channel: 0, data1: 0x0B, actionId: "deck.A.eq.mid" },
    { type: "cc", channel: 0, data1: 0x0F, actionId: "deck.A.eq.lo" },
    { type: "cc", channel: 0, data1: 0x17, actionId: "deck.A.filter" },
    { type: "note", channel: 0, data1: 0x54, actionId: "deck.A.pfl" },
    { type: "cc", channel: 0, data1: 0x22, actionId: "deck.A.jog", transform: "relative-2c" },
    // Hot cues A (Performance Pads bank Hot Cue, channel 7)
    { type: "note", channel: 7, data1: 0x00, actionId: "deck.A.hotcue.0" },
    { type: "note", channel: 7, data1: 0x01, actionId: "deck.A.hotcue.1" },
    { type: "note", channel: 7, data1: 0x02, actionId: "deck.A.hotcue.2" },
    { type: "note", channel: 7, data1: 0x03, actionId: "deck.A.hotcue.3" },
    { type: "note", channel: 7, data1: 0x04, actionId: "deck.A.hotcue.4" },
    { type: "note", channel: 7, data1: 0x05, actionId: "deck.A.hotcue.5" },
    { type: "note", channel: 7, data1: 0x06, actionId: "deck.A.hotcue.6" },
    { type: "note", channel: 7, data1: 0x07, actionId: "deck.A.hotcue.7" },
    // Loop A
    { type: "note", channel: 0, data1: 0x10, actionId: "deck.A.loop.in" },
    { type: "note", channel: 0, data1: 0x11, actionId: "deck.A.loop.out" },
    { type: "note", channel: 0, data1: 0x12, actionId: "deck.A.loop.halve" },
    { type: "note", channel: 0, data1: 0x13, actionId: "deck.A.loop.double" },

    // Deck B (channel 1)
    { type: "note", channel: 1, data1: 0x0B, actionId: "deck.B.play" },
    { type: "note", channel: 1, data1: 0x0C, actionId: "deck.B.cue" },
    { type: "note", channel: 1, data1: 0x58, actionId: "deck.B.sync" },
    { type: "cc", channel: 1, data1: 0x00, actionId: "deck.B.pitch", transform: "invert" },
    { type: "cc", channel: 1, data1: 0x33, actionId: "deck.B.fader" },
    { type: "cc", channel: 1, data1: 0x16, actionId: "deck.B.gain" },
    { type: "cc", channel: 1, data1: 0x07, actionId: "deck.B.eq.hi" },
    { type: "cc", channel: 1, data1: 0x0B, actionId: "deck.B.eq.mid" },
    { type: "cc", channel: 1, data1: 0x0F, actionId: "deck.B.eq.lo" },
    { type: "cc", channel: 1, data1: 0x17, actionId: "deck.B.filter" },
    { type: "note", channel: 1, data1: 0x54, actionId: "deck.B.pfl" },
    { type: "cc", channel: 1, data1: 0x22, actionId: "deck.B.jog", transform: "relative-2c" },
    { type: "note", channel: 9, data1: 0x00, actionId: "deck.B.hotcue.0" },
    { type: "note", channel: 9, data1: 0x01, actionId: "deck.B.hotcue.1" },
    { type: "note", channel: 9, data1: 0x02, actionId: "deck.B.hotcue.2" },
    { type: "note", channel: 9, data1: 0x03, actionId: "deck.B.hotcue.3" },
    { type: "note", channel: 9, data1: 0x04, actionId: "deck.B.hotcue.4" },
    { type: "note", channel: 9, data1: 0x05, actionId: "deck.B.hotcue.5" },
    { type: "note", channel: 9, data1: 0x06, actionId: "deck.B.hotcue.6" },
    { type: "note", channel: 9, data1: 0x07, actionId: "deck.B.hotcue.7" },
    { type: "note", channel: 1, data1: 0x10, actionId: "deck.B.loop.in" },
    { type: "note", channel: 1, data1: 0x11, actionId: "deck.B.loop.out" },
    { type: "note", channel: 1, data1: 0x12, actionId: "deck.B.loop.halve" },
    { type: "note", channel: 1, data1: 0x13, actionId: "deck.B.loop.double" },

    // Mixer
    { type: "cc", channel: 6, data1: 0x1F, actionId: "mixer.xfader" },
    { type: "cc", channel: 6, data1: 0x08, actionId: "mixer.master" },
  ],
  ledMap: {
    "deck.A.play": { type: "note", channel: 0, data1: 0x0B },
    "deck.A.cue": { type: "note", channel: 0, data1: 0x0C },
    "deck.A.pfl": { type: "note", channel: 0, data1: 0x54 },
    "deck.A.loop.toggle": { type: "note", channel: 0, data1: 0x14 },
    "deck.A.hotcue.0": { type: "note", channel: 7, data1: 0x00 },
    "deck.A.hotcue.1": { type: "note", channel: 7, data1: 0x01 },
    "deck.A.hotcue.2": { type: "note", channel: 7, data1: 0x02 },
    "deck.A.hotcue.3": { type: "note", channel: 7, data1: 0x03 },
    "deck.A.hotcue.4": { type: "note", channel: 7, data1: 0x04 },
    "deck.A.hotcue.5": { type: "note", channel: 7, data1: 0x05 },
    "deck.A.hotcue.6": { type: "note", channel: 7, data1: 0x06 },
    "deck.A.hotcue.7": { type: "note", channel: 7, data1: 0x07 },
    "deck.B.play": { type: "note", channel: 1, data1: 0x0B },
    "deck.B.cue": { type: "note", channel: 1, data1: 0x0C },
    "deck.B.pfl": { type: "note", channel: 1, data1: 0x54 },
    "deck.B.loop.toggle": { type: "note", channel: 1, data1: 0x14 },
    "deck.B.hotcue.0": { type: "note", channel: 9, data1: 0x00 },
    "deck.B.hotcue.1": { type: "note", channel: 9, data1: 0x01 },
    "deck.B.hotcue.2": { type: "note", channel: 9, data1: 0x02 },
    "deck.B.hotcue.3": { type: "note", channel: 9, data1: 0x03 },
    "deck.B.hotcue.4": { type: "note", channel: 9, data1: 0x04 },
    "deck.B.hotcue.5": { type: "note", channel: 9, data1: 0x05 },
    "deck.B.hotcue.6": { type: "note", channel: 9, data1: 0x06 },
    "deck.B.hotcue.7": { type: "note", channel: 9, data1: 0x07 },
  },
};

// ---------------- Numark Mixtrack Pro 3 / Platinum (generic) ----------------
const mixtrack: MidiProfile = {
  id: "numark-mixtrack",
  name: "Numark Mixtrack Pro / Platinum",
  inputMatch: "Mixtrack",
  outputMatch: "Mixtrack",
  bindings: [
    { type: "note", channel: 0, data1: 0x00, actionId: "deck.A.play" },
    { type: "note", channel: 0, data1: 0x01, actionId: "deck.A.cue" },
    { type: "note", channel: 0, data1: 0x02, actionId: "deck.A.sync" },
    { type: "cc", channel: 0, data1: 0x09, actionId: "deck.A.pitch", transform: "invert" },
    { type: "cc", channel: 0, data1: 0x1C, actionId: "deck.A.fader" },
    { type: "cc", channel: 0, data1: 0x16, actionId: "deck.A.gain" },
    { type: "cc", channel: 0, data1: 0x17, actionId: "deck.A.eq.hi" },
    { type: "cc", channel: 0, data1: 0x18, actionId: "deck.A.eq.mid" },
    { type: "cc", channel: 0, data1: 0x19, actionId: "deck.A.eq.lo" },
    { type: "cc", channel: 0, data1: 0x1A, actionId: "deck.A.filter" },
    { type: "note", channel: 0, data1: 0x1B, actionId: "deck.A.pfl" },
    { type: "cc", channel: 0, data1: 0x06, actionId: "deck.A.jog", transform: "relative-2c" },
    { type: "note", channel: 0, data1: 0x18, actionId: "deck.A.hotcue.0" },
    { type: "note", channel: 0, data1: 0x19, actionId: "deck.A.hotcue.1" },
    { type: "note", channel: 0, data1: 0x1A, actionId: "deck.A.hotcue.2" },
    { type: "note", channel: 0, data1: 0x1B, actionId: "deck.A.hotcue.3" },

    { type: "note", channel: 1, data1: 0x00, actionId: "deck.B.play" },
    { type: "note", channel: 1, data1: 0x01, actionId: "deck.B.cue" },
    { type: "note", channel: 1, data1: 0x02, actionId: "deck.B.sync" },
    { type: "cc", channel: 1, data1: 0x09, actionId: "deck.B.pitch", transform: "invert" },
    { type: "cc", channel: 1, data1: 0x1C, actionId: "deck.B.fader" },
    { type: "cc", channel: 1, data1: 0x16, actionId: "deck.B.gain" },
    { type: "cc", channel: 1, data1: 0x17, actionId: "deck.B.eq.hi" },
    { type: "cc", channel: 1, data1: 0x18, actionId: "deck.B.eq.mid" },
    { type: "cc", channel: 1, data1: 0x19, actionId: "deck.B.eq.lo" },
    { type: "cc", channel: 1, data1: 0x1A, actionId: "deck.B.filter" },
    { type: "note", channel: 1, data1: 0x1B, actionId: "deck.B.pfl" },
    { type: "cc", channel: 1, data1: 0x06, actionId: "deck.B.jog", transform: "relative-2c" },
    { type: "note", channel: 1, data1: 0x18, actionId: "deck.B.hotcue.0" },
    { type: "note", channel: 1, data1: 0x19, actionId: "deck.B.hotcue.1" },
    { type: "note", channel: 1, data1: 0x1A, actionId: "deck.B.hotcue.2" },
    { type: "note", channel: 1, data1: 0x1B, actionId: "deck.B.hotcue.3" },

    { type: "cc", channel: 0, data1: 0x08, actionId: "mixer.xfader" },
    { type: "cc", channel: 0, data1: 0x07, actionId: "mixer.master" },
  ],
  ledMap: {
    "deck.A.play": { type: "note", channel: 0, data1: 0x00 },
    "deck.A.cue": { type: "note", channel: 0, data1: 0x01 },
    "deck.A.pfl": { type: "note", channel: 0, data1: 0x1B },
    "deck.B.play": { type: "note", channel: 1, data1: 0x00 },
    "deck.B.cue": { type: "note", channel: 1, data1: 0x01 },
    "deck.B.pfl": { type: "note", channel: 1, data1: 0x1B },
  },
};

// ---------------- Hercules DJControl Inpulse 200/300 ----------------
const inpulse: MidiProfile = {
  id: "hercules-inpulse",
  name: "Hercules DJControl Inpulse 200/300",
  inputMatch: "Inpulse",
  outputMatch: "Inpulse",
  bindings: [
    { type: "note", channel: 0, data1: 0x07, actionId: "deck.A.play" },
    { type: "note", channel: 0, data1: 0x06, actionId: "deck.A.cue" },
    { type: "note", channel: 0, data1: 0x05, actionId: "deck.A.sync" },
    { type: "cc", channel: 0, data1: 0x08, actionId: "deck.A.pitch", transform: "invert" },
    { type: "cc", channel: 0, data1: 0x39, actionId: "deck.A.fader" },
    { type: "cc", channel: 0, data1: 0x37, actionId: "deck.A.gain" },
    { type: "cc", channel: 0, data1: 0x35, actionId: "deck.A.eq.hi" },
    { type: "cc", channel: 0, data1: 0x36, actionId: "deck.A.eq.mid" },
    { type: "cc", channel: 0, data1: 0x33, actionId: "deck.A.eq.lo" },
    { type: "cc", channel: 0, data1: 0x21, actionId: "deck.A.filter" },
    { type: "note", channel: 0, data1: 0x0C, actionId: "deck.A.pfl" },
    { type: "note", channel: 0, data1: 0x14, actionId: "deck.A.hotcue.0" },
    { type: "note", channel: 0, data1: 0x15, actionId: "deck.A.hotcue.1" },
    { type: "note", channel: 0, data1: 0x16, actionId: "deck.A.hotcue.2" },
    { type: "note", channel: 0, data1: 0x17, actionId: "deck.A.hotcue.3" },

    { type: "note", channel: 1, data1: 0x07, actionId: "deck.B.play" },
    { type: "note", channel: 1, data1: 0x06, actionId: "deck.B.cue" },
    { type: "note", channel: 1, data1: 0x05, actionId: "deck.B.sync" },
    { type: "cc", channel: 1, data1: 0x08, actionId: "deck.B.pitch", transform: "invert" },
    { type: "cc", channel: 1, data1: 0x39, actionId: "deck.B.fader" },
    { type: "cc", channel: 1, data1: 0x37, actionId: "deck.B.gain" },
    { type: "cc", channel: 1, data1: 0x35, actionId: "deck.B.eq.hi" },
    { type: "cc", channel: 1, data1: 0x36, actionId: "deck.B.eq.mid" },
    { type: "cc", channel: 1, data1: 0x33, actionId: "deck.B.eq.lo" },
    { type: "cc", channel: 1, data1: 0x21, actionId: "deck.B.filter" },
    { type: "note", channel: 1, data1: 0x0C, actionId: "deck.B.pfl" },
    { type: "note", channel: 1, data1: 0x14, actionId: "deck.B.hotcue.0" },
    { type: "note", channel: 1, data1: 0x15, actionId: "deck.B.hotcue.1" },
    { type: "note", channel: 1, data1: 0x16, actionId: "deck.B.hotcue.2" },
    { type: "note", channel: 1, data1: 0x17, actionId: "deck.B.hotcue.3" },

    { type: "cc", channel: 0, data1: 0x40, actionId: "mixer.xfader" },
    { type: "cc", channel: 0, data1: 0x38, actionId: "mixer.master" },
  ],
  ledMap: {
    "deck.A.play": { type: "note", channel: 0, data1: 0x07 },
    "deck.A.cue": { type: "note", channel: 0, data1: 0x06 },
    "deck.A.pfl": { type: "note", channel: 0, data1: 0x0C },
    "deck.B.play": { type: "note", channel: 1, data1: 0x07 },
    "deck.B.cue": { type: "note", channel: 1, data1: 0x06 },
    "deck.B.pfl": { type: "note", channel: 1, data1: 0x0C },
  },
};

// Empty / generic
const generic: MidiProfile = {
  id: "generic",
  name: "Generic / Custom",
  inputMatch: null,
  outputMatch: null,
  bindings: [],
  ledMap: {},
};

// ---------------- M-Vave SMC-PAD (and similar 16-pad MPC-style controllers) ----------------
// The SMC-PAD sends Note On/Off on channel 0 with notes 36..51 (standard MPC layout).
// Layout (bottom-left = pad 1):
//   13 14 15 16   -> notes 48 49 50 51   -> Sampler 1..4 (top row)
//    9 10 11 12   -> notes 44 45 46 47   -> Loop / FX (Deck A loop in/out/halve/double)
//    5  6  7  8   -> notes 40 41 42 43   -> Deck B Hot Cues 1..4
//    1  2  3  4   -> notes 36 37 38 39   -> Deck A Hot Cues 1..4
// LED feedback uses Note On with velocity (0 = off, 127 = on). Most M-Vave / Akai-style
// pad controllers light the pad when they receive a Note On echoed back on the same note.
const smcPad: MidiProfile = {
  id: "mvave-smc-pad",
  name: "M-Vave SMC-PAD (16 pads)",
  inputMatch: "SMC-PAD",
  outputMatch: "SMC-PAD",
  bindings: [
    // Row 1 (bottom): Deck A Hot Cues 1..4
    { type: "note", channel: 0, data1: 36, actionId: "deck.A.hotcue.0" },
    { type: "note", channel: 0, data1: 37, actionId: "deck.A.hotcue.1" },
    { type: "note", channel: 0, data1: 38, actionId: "deck.A.hotcue.2" },
    { type: "note", channel: 0, data1: 39, actionId: "deck.A.hotcue.3" },
    // Row 2: Deck B Hot Cues 1..4
    { type: "note", channel: 0, data1: 40, actionId: "deck.B.hotcue.0" },
    { type: "note", channel: 0, data1: 41, actionId: "deck.B.hotcue.1" },
    { type: "note", channel: 0, data1: 42, actionId: "deck.B.hotcue.2" },
    { type: "note", channel: 0, data1: 43, actionId: "deck.B.hotcue.3" },
    // Row 3: Transport / Loop A
    { type: "note", channel: 0, data1: 44, actionId: "deck.A.play" },
    { type: "note", channel: 0, data1: 45, actionId: "deck.A.cue" },
    { type: "note", channel: 0, data1: 46, actionId: "deck.A.sync" },
    { type: "note", channel: 0, data1: 47, actionId: "deck.A.loop.toggle" },
    // Row 4 (top): Transport B + Loop ops
    { type: "note", channel: 0, data1: 48, actionId: "deck.B.play" },
    { type: "note", channel: 0, data1: 49, actionId: "deck.B.cue" },
    { type: "note", channel: 0, data1: 50, actionId: "deck.B.sync" },
    { type: "note", channel: 0, data1: 51, actionId: "deck.B.loop.toggle" },
  ],
  ledMap: {
    "deck.A.hotcue.0": { type: "note", channel: 0, data1: 36 },
    "deck.A.hotcue.1": { type: "note", channel: 0, data1: 37 },
    "deck.A.hotcue.2": { type: "note", channel: 0, data1: 38 },
    "deck.A.hotcue.3": { type: "note", channel: 0, data1: 39 },
    "deck.B.hotcue.0": { type: "note", channel: 0, data1: 40 },
    "deck.B.hotcue.1": { type: "note", channel: 0, data1: 41 },
    "deck.B.hotcue.2": { type: "note", channel: 0, data1: 42 },
    "deck.B.hotcue.3": { type: "note", channel: 0, data1: 43 },
    "deck.A.play": { type: "note", channel: 0, data1: 44 },
    "deck.A.cue": { type: "note", channel: 0, data1: 45 },
    "deck.A.loop.toggle": { type: "note", channel: 0, data1: 47 },
    "deck.B.play": { type: "note", channel: 0, data1: 48 },
    "deck.B.cue": { type: "note", channel: 0, data1: 49 },
    "deck.B.loop.toggle": { type: "note", channel: 0, data1: 51 },
  },
};

// ---------------- Generic 16-Pad Controller (MPC layout, notes 36..51 on ch 0) ----------------
// Works with: Akai MPD218 (default preset A), Worlde Easypad.12/16, Midiplus PadStation,
// Donner DMK-25 pad section, generic USB MIDI pad grids using GM drum mapping.
// Same mapping as SMC-PAD; auto-match on common names.
const generic16Pads: MidiProfile = {
  id: "generic-16-pads",
  name: "Generic 16 Pads (MPC layout)",
  inputMatch: "pad",
  outputMatch: "pad",
  bindings: [...smcPad.bindings],
  ledMap: { ...smcPad.ledMap },
};

// ---------------- Akai LPD8 (8 pads on channel 0, notes 36..43) ----------------
const lpd8: MidiProfile = {
  id: "akai-lpd8",
  name: "Akai LPD8 (8 pads + 8 knobs)",
  inputMatch: "LPD8",
  outputMatch: "LPD8",
  bindings: [
    // Pads: row 1 = Deck A hot cues, row 2 = Deck B hot cues (default Program 1)
    { type: "note", channel: 0, data1: 36, actionId: "deck.A.hotcue.0" },
    { type: "note", channel: 0, data1: 37, actionId: "deck.A.hotcue.1" },
    { type: "note", channel: 0, data1: 38, actionId: "deck.A.hotcue.2" },
    { type: "note", channel: 0, data1: 39, actionId: "deck.A.hotcue.3" },
    { type: "note", channel: 0, data1: 40, actionId: "deck.B.hotcue.0" },
    { type: "note", channel: 0, data1: 41, actionId: "deck.B.hotcue.1" },
    { type: "note", channel: 0, data1: 42, actionId: "deck.B.hotcue.2" },
    { type: "note", channel: 0, data1: 43, actionId: "deck.B.hotcue.3" },
    // Knobs (CC 1..8 default): EQ + filters
    { type: "cc", channel: 0, data1: 1, actionId: "deck.A.eq.hi" },
    { type: "cc", channel: 0, data1: 2, actionId: "deck.A.eq.mid" },
    { type: "cc", channel: 0, data1: 3, actionId: "deck.A.eq.lo" },
    { type: "cc", channel: 0, data1: 4, actionId: "deck.A.filter" },
    { type: "cc", channel: 0, data1: 5, actionId: "deck.B.eq.hi" },
    { type: "cc", channel: 0, data1: 6, actionId: "deck.B.eq.mid" },
    { type: "cc", channel: 0, data1: 7, actionId: "deck.B.eq.lo" },
    { type: "cc", channel: 0, data1: 8, actionId: "deck.B.filter" },
  ],
  ledMap: {
    "deck.A.hotcue.0": { type: "note", channel: 0, data1: 36 },
    "deck.A.hotcue.1": { type: "note", channel: 0, data1: 37 },
    "deck.A.hotcue.2": { type: "note", channel: 0, data1: 38 },
    "deck.A.hotcue.3": { type: "note", channel: 0, data1: 39 },
    "deck.B.hotcue.0": { type: "note", channel: 0, data1: 40 },
    "deck.B.hotcue.1": { type: "note", channel: 0, data1: 41 },
    "deck.B.hotcue.2": { type: "note", channel: 0, data1: 42 },
    "deck.B.hotcue.3": { type: "note", channel: 0, data1: 43 },
  },
};

// ---------------- M-Vave Chocolate (8 transport-style buttons + knobs) ----------------
// Common factory mapping: transport buttons send CC 91..118 on ch 0, knobs CC 14..21.
// We map only the most useful controls; users can MIDI-Learn the rest.
const chocolate: MidiProfile = {
  id: "mvave-chocolate",
  name: "M-Vave Chocolate",
  inputMatch: "Chocolate",
  outputMatch: "Chocolate",
  bindings: [
    { type: "cc", channel: 0, data1: 91, actionId: "deck.A.play" },
    { type: "cc", channel: 0, data1: 92, actionId: "deck.B.play" },
    { type: "cc", channel: 0, data1: 93, actionId: "deck.A.cue" },
    { type: "cc", channel: 0, data1: 94, actionId: "deck.B.cue" },
    { type: "cc", channel: 0, data1: 95, actionId: "deck.A.sync" },
    { type: "cc", channel: 0, data1: 96, actionId: "deck.B.sync" },
    // Knobs row
    { type: "cc", channel: 0, data1: 14, actionId: "deck.A.gain" },
    { type: "cc", channel: 0, data1: 15, actionId: "deck.A.eq.hi" },
    { type: "cc", channel: 0, data1: 16, actionId: "deck.A.eq.mid" },
    { type: "cc", channel: 0, data1: 17, actionId: "deck.A.eq.lo" },
    { type: "cc", channel: 0, data1: 18, actionId: "deck.B.gain" },
    { type: "cc", channel: 0, data1: 19, actionId: "deck.B.eq.hi" },
    { type: "cc", channel: 0, data1: 20, actionId: "deck.B.eq.mid" },
    { type: "cc", channel: 0, data1: 21, actionId: "deck.B.eq.lo" },
  ],
  ledMap: {},
};

// ---------------- M-Vave SMK-25 II (25-key MIDI keyboard + 8 pads + 8 knobs) ----------------
// The SMK-25 II is a portable wireless/USB MIDI keyboard. Keyboard sends Note On/Off on
// channel 0 (standard MIDI note numbers). Pads send notes 36..43 on channel 9 (drum-style).
// Knobs (CC 21..28 on ch 0 by default) and transport buttons (CC 115..118) round out the controls.
// We map pads/knobs/transport to DJ functions; the keyboard notes pass through to the Synth panel
// when it is enabled (handled by the synth engine itself, not by a binding here).
const smk25ii: MidiProfile = {
  id: "mvave-smk-25ii",
  name: "M-Vave SMK-25 II",
  inputMatch: "SMK-25",
  outputMatch: "SMK-25",
  bindings: [
    // Pads (ch 9, notes 36..43): Hot cues A (row 1) + Hot cues B (row 2)
    { type: "note", channel: 9, data1: 36, actionId: "deck.A.hotcue.0" },
    { type: "note", channel: 9, data1: 37, actionId: "deck.A.hotcue.1" },
    { type: "note", channel: 9, data1: 38, actionId: "deck.A.hotcue.2" },
    { type: "note", channel: 9, data1: 39, actionId: "deck.A.hotcue.3" },
    { type: "note", channel: 9, data1: 40, actionId: "deck.B.hotcue.0" },
    { type: "note", channel: 9, data1: 41, actionId: "deck.B.hotcue.1" },
    { type: "note", channel: 9, data1: 42, actionId: "deck.B.hotcue.2" },
    { type: "note", channel: 9, data1: 43, actionId: "deck.B.hotcue.3" },
    // Knobs (ch 0, CC 21..28): EQ + filter for both decks
    { type: "cc", channel: 0, data1: 21, actionId: "deck.A.eq.hi" },
    { type: "cc", channel: 0, data1: 22, actionId: "deck.A.eq.mid" },
    { type: "cc", channel: 0, data1: 23, actionId: "deck.A.eq.lo" },
    { type: "cc", channel: 0, data1: 24, actionId: "deck.A.filter" },
    { type: "cc", channel: 0, data1: 25, actionId: "deck.B.eq.hi" },
    { type: "cc", channel: 0, data1: 26, actionId: "deck.B.eq.mid" },
    { type: "cc", channel: 0, data1: 27, actionId: "deck.B.eq.lo" },
    { type: "cc", channel: 0, data1: 28, actionId: "deck.B.filter" },
    // Transport buttons (ch 0, CC 115..118): Play A/B + Sync A/B
    { type: "cc", channel: 0, data1: 115, actionId: "deck.A.play" },
    { type: "cc", channel: 0, data1: 116, actionId: "deck.B.play" },
    { type: "cc", channel: 0, data1: 117, actionId: "deck.A.sync" },
    { type: "cc", channel: 0, data1: 118, actionId: "deck.B.sync" },
    // Mod wheel (CC 1) → master volume; Pitch bend → crossfader
    { type: "cc", channel: 0, data1: 1, actionId: "mixer.master" },
    { type: "pitchbend", channel: 0, data1: 0, actionId: "mixer.xfader" },
  ],
  ledMap: {
    "deck.A.hotcue.0": { type: "note", channel: 9, data1: 36 },
    "deck.A.hotcue.1": { type: "note", channel: 9, data1: 37 },
    "deck.A.hotcue.2": { type: "note", channel: 9, data1: 38 },
    "deck.A.hotcue.3": { type: "note", channel: 9, data1: 39 },
    "deck.B.hotcue.0": { type: "note", channel: 9, data1: 40 },
    "deck.B.hotcue.1": { type: "note", channel: 9, data1: 41 },
    "deck.B.hotcue.2": { type: "note", channel: 9, data1: 42 },
    "deck.B.hotcue.3": { type: "note", channel: 9, data1: 43 },
  },
};


// ---------------- Pioneer DDJ-FLX2 (entry-level 2-deck controller) ----------------
// 2 decks, 8 performance pads per deck, jog wheels, EQ + filter knobs, crossfader.
// Mapping is based on the official MIDI spec for the FLX2 / FLX4 family. Notes use
// channel 0 for Deck A controls, channel 1 for Deck B. Performance pads sit on
// channels 7 (Deck A) / 9 (Deck B), matching the DDJ-400 layout.
const ddjFlx2: MidiProfile = {
  id: "pioneer-ddj-flx2",
  name: "Pioneer DDJ-FLX2",
  inputMatch: "DDJ-FLX2",
  outputMatch: "DDJ-FLX2",
  bindings: [
    // Deck A transport
    { type: "note", channel: 0, data1: 0x0B, actionId: "deck.A.play" },
    { type: "note", channel: 0, data1: 0x0C, actionId: "deck.A.cue" },
    { type: "note", channel: 0, data1: 0x58, actionId: "deck.A.sync" },
    { type: "cc", channel: 0, data1: 0x00, actionId: "deck.A.pitch", transform: "invert" },
    { type: "cc", channel: 0, data1: 0x33, actionId: "deck.A.fader" },
    { type: "cc", channel: 0, data1: 0x16, actionId: "deck.A.gain" },
    { type: "cc", channel: 0, data1: 0x07, actionId: "deck.A.eq.hi" },
    { type: "cc", channel: 0, data1: 0x0B, actionId: "deck.A.eq.mid" },
    { type: "cc", channel: 0, data1: 0x0F, actionId: "deck.A.eq.lo" },
    { type: "cc", channel: 0, data1: 0x17, actionId: "deck.A.filter" },
    { type: "note", channel: 0, data1: 0x54, actionId: "deck.A.pfl" },
    { type: "cc", channel: 0, data1: 0x22, actionId: "deck.A.jog", transform: "relative-2c" },
    // Deck A pads (Hot Cues, ch 7)
    { type: "note", channel: 7, data1: 0x00, actionId: "deck.A.hotcue.0" },
    { type: "note", channel: 7, data1: 0x01, actionId: "deck.A.hotcue.1" },
    { type: "note", channel: 7, data1: 0x02, actionId: "deck.A.hotcue.2" },
    { type: "note", channel: 7, data1: 0x03, actionId: "deck.A.hotcue.3" },
    { type: "note", channel: 7, data1: 0x04, actionId: "deck.A.hotcue.4" },
    { type: "note", channel: 7, data1: 0x05, actionId: "deck.A.hotcue.5" },
    { type: "note", channel: 7, data1: 0x06, actionId: "deck.A.hotcue.6" },
    { type: "note", channel: 7, data1: 0x07, actionId: "deck.A.hotcue.7" },
    { type: "note", channel: 0, data1: 0x10, actionId: "deck.A.loop.in" },
    { type: "note", channel: 0, data1: 0x11, actionId: "deck.A.loop.out" },
    { type: "note", channel: 0, data1: 0x12, actionId: "deck.A.loop.halve" },
    { type: "note", channel: 0, data1: 0x13, actionId: "deck.A.loop.double" },
    { type: "note", channel: 0, data1: 0x14, actionId: "deck.A.loop.toggle" },
    // Deck B
    { type: "note", channel: 1, data1: 0x0B, actionId: "deck.B.play" },
    { type: "note", channel: 1, data1: 0x0C, actionId: "deck.B.cue" },
    { type: "note", channel: 1, data1: 0x58, actionId: "deck.B.sync" },
    { type: "cc", channel: 1, data1: 0x00, actionId: "deck.B.pitch", transform: "invert" },
    { type: "cc", channel: 1, data1: 0x33, actionId: "deck.B.fader" },
    { type: "cc", channel: 1, data1: 0x16, actionId: "deck.B.gain" },
    { type: "cc", channel: 1, data1: 0x07, actionId: "deck.B.eq.hi" },
    { type: "cc", channel: 1, data1: 0x0B, actionId: "deck.B.eq.mid" },
    { type: "cc", channel: 1, data1: 0x0F, actionId: "deck.B.eq.lo" },
    { type: "cc", channel: 1, data1: 0x17, actionId: "deck.B.filter" },
    { type: "note", channel: 1, data1: 0x54, actionId: "deck.B.pfl" },
    { type: "cc", channel: 1, data1: 0x22, actionId: "deck.B.jog", transform: "relative-2c" },
    { type: "note", channel: 9, data1: 0x00, actionId: "deck.B.hotcue.0" },
    { type: "note", channel: 9, data1: 0x01, actionId: "deck.B.hotcue.1" },
    { type: "note", channel: 9, data1: 0x02, actionId: "deck.B.hotcue.2" },
    { type: "note", channel: 9, data1: 0x03, actionId: "deck.B.hotcue.3" },
    { type: "note", channel: 9, data1: 0x04, actionId: "deck.B.hotcue.4" },
    { type: "note", channel: 9, data1: 0x05, actionId: "deck.B.hotcue.5" },
    { type: "note", channel: 9, data1: 0x06, actionId: "deck.B.hotcue.6" },
    { type: "note", channel: 9, data1: 0x07, actionId: "deck.B.hotcue.7" },
    { type: "note", channel: 1, data1: 0x10, actionId: "deck.B.loop.in" },
    { type: "note", channel: 1, data1: 0x11, actionId: "deck.B.loop.out" },
    { type: "note", channel: 1, data1: 0x12, actionId: "deck.B.loop.halve" },
    { type: "note", channel: 1, data1: 0x13, actionId: "deck.B.loop.double" },
    { type: "note", channel: 1, data1: 0x14, actionId: "deck.B.loop.toggle" },
    // Mixer
    { type: "cc", channel: 6, data1: 0x1F, actionId: "mixer.xfader" },
    { type: "cc", channel: 6, data1: 0x08, actionId: "mixer.master" },
  ],
  ledMap: {
    "deck.A.play": { type: "note", channel: 0, data1: 0x0B },
    "deck.A.cue": { type: "note", channel: 0, data1: 0x0C },
    "deck.A.pfl": { type: "note", channel: 0, data1: 0x54 },
    "deck.A.loop.toggle": { type: "note", channel: 0, data1: 0x14 },
    "deck.B.play": { type: "note", channel: 1, data1: 0x0B },
    "deck.B.cue": { type: "note", channel: 1, data1: 0x0C },
    "deck.B.pfl": { type: "note", channel: 1, data1: 0x54 },
    "deck.B.loop.toggle": { type: "note", channel: 1, data1: 0x14 },
  },
};

// ---------------- Simulated controller (no hardware required) ----------------
// Default fallback so the app always reports a "controller" in the UI even when
// no MIDI device is plugged in. Bindings are empty — keyboard/mouse drive the app.
const simulated: MidiProfile = {
  id: "simulated",
  name: "Simulated controller (keyboard + mouse)",
  inputMatch: null,
  outputMatch: null,
  bindings: [],
  ledMap: {},
};
