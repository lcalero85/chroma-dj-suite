// MIDI action registry: maps action ids -> handlers + LED state readers.
// Used by the MIDI engine for both input dispatch and LED feedback output.
import {
  togglePlay, cueDeck, syncDeck, setDeckPitch, setDeckEQ, setDeckFilter,
  setDeckGain, setDeckFader, setDeckCue, addHotCue, jumpHotCue, setLoop,
  loopIn, loopOut, loopHalve, loopDouble, toggleLoop, nudgeDeck,
  setMasterVolume, setXfaderPosition, seekDeck,
} from "@/state/controller";
import { useApp, type DeckId } from "@/state/store";
import { triggerSlot, stopSlot, startSlotLoop, getSlots } from "@/audio/sampler";
import {
  SYNTH_PRESETS, SYNTH_DEMOS,
  setSynthPreset, setSynthFx, setSynthVolume, setSynthLayers, getSynthLayers,
  noteOn as synthNoteOn, noteOff as synthNoteOff, allNotesOff,
  playDemo, stopDemo, isDemoPlaying,
  type SynthPresetId, type SynthFx,
} from "@/audio/synth";

export type MidiActionKind =
  | "trigger"   // button: any nonzero value triggers
  | "toggle"    // button: alternates
  | "value"     // continuous 0..1 (knob/fader)
  | "bipolar"   // continuous -1..1 (pitch/xfader, center = 0.5 input)
  | "relative"  // jog: signed delta (-1..1 around center 0.5)
  ;

export interface MidiAction {
  id: string;
  label: string;
  kind: MidiActionKind;
  group: "deckA" | "deckB" | "deckC" | "deckD" | "mixer" | "global" | "sampler";
  /** Optional secondary group used by the UI; falls back to `group`. */
  // (kept implicit — no breaking change)
  /** Apply incoming MIDI value (0..1 for value/bipolar/relative; >0 = press for trigger/toggle). */
  apply: (v: number) => void;
  /** Returns LED state for output: 0..127 (button = 0/127 typically). null = no feedback. */
  ledState?: () => number | null;
}

const deckIds: DeckId[] = ["A", "B", "C", "D"];

function deckGroup(d: DeckId) {
  return ("deck" + d) as MidiAction["group"];
}

function bipolar(v: number) { return Math.max(-1, Math.min(1, v * 2 - 1)); }

const actions: MidiAction[] = [];

// ---------- Per-deck actions ----------
for (const d of deckIds) {
  const g = deckGroup(d);
  actions.push(
    { id: `deck.${d}.play`, label: `Deck ${d} · Play/Pause`, kind: "trigger", group: g,
      apply: (v) => { if (v > 0) togglePlay(d); },
      ledState: () => useApp.getState().decks[d].isPlaying ? 127 : 0 },
    { id: `deck.${d}.cue`, label: `Deck ${d} · Cue`, kind: "trigger", group: g,
      apply: (v) => { if (v > 0) cueDeck(d); },
      ledState: () => {
        const ds = useApp.getState().decks[d];
        return (!ds.isPlaying && ds.cuePoint > 0) ? 127 : 0;
      } },
    { id: `deck.${d}.sync`, label: `Deck ${d} · Sync`, kind: "trigger", group: g,
      apply: (v) => { if (v > 0) syncDeck(d, useApp.getState().mixer.masterDeck); } },
    { id: `deck.${d}.pitch`, label: `Deck ${d} · Pitch fader`, kind: "bipolar", group: g,
      apply: (v) => setDeckPitch(d, bipolar(v)) },
    { id: `deck.${d}.gain`, label: `Deck ${d} · Gain`, kind: "value", group: g,
      apply: (v) => setDeckGain(d, v * 2) },
    { id: `deck.${d}.eq.hi`, label: `Deck ${d} · EQ Hi`, kind: "bipolar", group: g,
      apply: (v) => setDeckEQ(d, "hi", bipolar(v)) },
    { id: `deck.${d}.eq.mid`, label: `Deck ${d} · EQ Mid`, kind: "bipolar", group: g,
      apply: (v) => setDeckEQ(d, "mid", bipolar(v)) },
    { id: `deck.${d}.eq.lo`, label: `Deck ${d} · EQ Lo`, kind: "bipolar", group: g,
      apply: (v) => setDeckEQ(d, "lo", bipolar(v)) },
    { id: `deck.${d}.filter`, label: `Deck ${d} · Filter`, kind: "bipolar", group: g,
      apply: (v) => setDeckFilter(d, bipolar(v)) },
    { id: `deck.${d}.fader`, label: `Deck ${d} · Channel fader`, kind: "value", group: g,
      apply: (v) => setDeckFader(d, v) },
    { id: `deck.${d}.pfl`, label: `Deck ${d} · PFL / Cue`, kind: "trigger", group: g,
      apply: (v) => { if (v > 0) setDeckCue(d, !useApp.getState().decks[d].pflCue); },
      ledState: () => useApp.getState().decks[d].pflCue ? 127 : 0 },
    { id: `deck.${d}.jog`, label: `Deck ${d} · Jog (bend)`, kind: "relative", group: g,
      apply: (v) => nudgeDeck(d, (v - 0.5) * 0.1) },
    { id: `deck.${d}.seek`, label: `Deck ${d} · Seek`, kind: "value", group: g,
      apply: (v) => seekDeck(d, v) },
    { id: `deck.${d}.loop.in`, label: `Deck ${d} · Loop In`, kind: "trigger", group: g,
      apply: (v) => { if (v > 0) loopIn(d); } },
    { id: `deck.${d}.loop.out`, label: `Deck ${d} · Loop Out`, kind: "trigger", group: g,
      apply: (v) => { if (v > 0) loopOut(d); } },
    { id: `deck.${d}.loop.toggle`, label: `Deck ${d} · Loop on/off`, kind: "trigger", group: g,
      apply: (v) => { if (v > 0) toggleLoop(d); },
      ledState: () => useApp.getState().decks[d].loopActive ? 127 : 0 },
    { id: `deck.${d}.loop.halve`, label: `Deck ${d} · Loop ÷2`, kind: "trigger", group: g,
      apply: (v) => { if (v > 0) loopHalve(d); } },
    { id: `deck.${d}.loop.double`, label: `Deck ${d} · Loop ×2`, kind: "trigger", group: g,
      apply: (v) => { if (v > 0) loopDouble(d); } },
  );
  for (let i = 0; i < 8; i++) {
    const slot = i;
    actions.push(
      { id: `deck.${d}.hotcue.${slot}`, label: `Deck ${d} · Hot Cue ${slot + 1}`, kind: "trigger", group: g,
        apply: (v) => {
          if (v <= 0) return;
          const ds = useApp.getState().decks[d];
          if (ds.hotCues.find((c) => c.id === slot)) jumpHotCue(d, slot);
          else addHotCue(d, slot);
        },
        ledState: () => {
          const ds = useApp.getState().decks[d];
          return ds.hotCues.find((c) => c.id === slot) ? 127 : 0;
        } },
      { id: `deck.${d}.autoloop.${slot}`, label: `Deck ${d} · Auto-loop ${[1,2,4,8,16,32,64,128][slot] / 8} beat`, kind: "trigger", group: g,
        apply: (v) => { if (v > 0) setLoop(d, [1/8,1/4,1/2,1,2,4,8,16][slot]); } },
    );
  }
}

// ---------- Mixer / global ----------
actions.push(
  { id: "mixer.xfader", label: "Crossfader", kind: "bipolar", group: "mixer",
    apply: (v) => setXfaderPosition(bipolar(v)) },
  { id: "mixer.master", label: "Master volume", kind: "value", group: "mixer",
    apply: (v) => setMasterVolume(v) },
);

// ---------- Sampler pads (4 banks × 16 pads = 64) ----------
// Active loops kept here so the same MIDI trigger can stop a held loop.
const samplerActiveLoops = new Map<number, () => void>();
for (let bank = 0; bank < 4; bank++) {
  for (let pad = 0; pad < 16; pad++) {
    const slotId = bank * 16 + pad;
    actions.push({
      id: `sampler.bank${bank + 1}.pad${pad + 1}`,
      label: `Sampler · Bank ${bank + 1} Pad ${pad + 1}`,
      kind: "trigger",
      group: "sampler",
      apply: (v) => {
        if (v <= 0) return;
        const slot = getSlots().find((s) => s.id === slotId);
        if (!slot || !slot.buffer) return;
        if (slot.loop) {
          const existing = samplerActiveLoops.get(slotId);
          if (existing) { existing(); samplerActiveLoops.delete(slotId); }
          else {
            const stop = startSlotLoop(slotId);
            if (stop) samplerActiveLoops.set(slotId, stop);
          }
        } else {
          triggerSlot(slotId);
        }
      },
      ledState: () => {
        const slot = getSlots().find((s) => s.id === slotId);
        return slot?.buffer ? 127 : 0;
      },
    });
    actions.push({
      id: `sampler.bank${bank + 1}.pad${pad + 1}.stop`,
      label: `Sampler · Bank ${bank + 1} Pad ${pad + 1} Stop`,
      kind: "trigger",
      group: "sampler",
      apply: (v) => {
        if (v <= 0) return;
        const fn = samplerActiveLoops.get(slotId);
        if (fn) { fn(); samplerActiveLoops.delete(slotId); }
        stopSlot(slotId);
      },
    });
  }
}

export const MIDI_ACTIONS = actions;

// =====================================================================
// Synth MIDI bindings — preset selection, layer toggles, FX, demos, panic
// =====================================================================

for (const p of SYNTH_PRESETS) {
  actions.push({
    id: `synth.preset.${p.id}`,
    label: `Synth · Preset ${p.label}`,
    kind: "trigger",
    group: "global",
    apply: (v) => { if (v > 0) setSynthPreset(p.id); },
  });
  actions.push({
    id: `synth.layer.${p.id}`,
    label: `Synth · Toggle Layer ${p.label}`,
    kind: "trigger",
    group: "global",
    apply: (v) => {
      if (v <= 0) return;
      const cur = getSynthLayers();
      const idx = cur.indexOf(p.id);
      if (idx >= 0) cur.splice(idx, 1); else cur.push(p.id);
      setSynthLayers(cur);
    },
    ledState: () => (getSynthLayers().includes(p.id) ? 127 : 0),
  });
}

const SYNTH_FX_PARAMS: Array<keyof SynthFx> = [
  "reverb", "delay", "filter", "chorus", "drive", "bitcrush",
  "phaser", "flanger", "tremolo", "eqLow", "eqHi", "width",
];
for (const fxId of SYNTH_FX_PARAMS) {
  actions.push({
    id: `synth.fx.${fxId}`,
    label: `Synth · FX ${fxId}`,
    kind: "value",
    group: "global",
    apply: (v) => setSynthFx({ [fxId]: Math.max(0, Math.min(1, v)) } as Partial<SynthFx>),
  });
}

actions.push(
  { id: "synth.volume", label: "Synth · Volume", kind: "value", group: "global",
    apply: (v) => setSynthVolume(v * 1.5) },
  { id: "synth.panic", label: "Synth · Panic (all notes off)", kind: "trigger", group: "global",
    apply: (v) => { if (v > 0) { stopDemo(); allNotesOff(); } } },
  { id: "synth.layers.clear", label: "Synth · Clear layers", kind: "trigger", group: "global",
    apply: (v) => { if (v > 0) setSynthLayers([]); } },
);

for (const d of SYNTH_DEMOS) {
  actions.push({
    id: `synth.demo.${d.id}`,
    label: `Synth · Demo ${d.label}`,
    kind: "trigger",
    group: "global",
    apply: (v) => {
      if (v <= 0) return;
      if (isDemoPlaying()) stopDemo(); else void playDemo(d.id);
    },
    ledState: () => (isDemoPlaying() ? 127 : 0),
  });
}

// Map a contiguous MIDI note range (C2 → D#7) to play synth notes via MIDI triggers.
// One action per MIDI note so the user can map any pad/key.
for (let n = 36; n <= 99; n++) {
  const note = n;
  actions.push({
    id: `synth.note.${note}`,
    label: `Synth · Note ${note}`,
    kind: "trigger",
    group: "global",
    apply: (v) => {
      if (v > 0) void synthNoteOn(note, v);
      else synthNoteOff(note);
    },
  });
}

const byId = new Map<string, MidiAction>();
for (const a of actions) byId.set(a.id, a);

export function getAction(id: string): MidiAction | undefined {
  return byId.get(id);
}
