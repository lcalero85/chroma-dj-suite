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

export const MIDI_PROFILES: MidiProfile[] = [generic, ddj400, mixtrack, inpulse];

export function getProfile(id: string): MidiProfile {
  return MIDI_PROFILES.find((p) => p.id === id) ?? generic;
}
