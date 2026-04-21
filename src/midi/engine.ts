// MIDI engine: Web MIDI access, dispatch to actions, LED feedback subscription.
import { useApp } from "@/state/store";
import { MIDI_ACTIONS, getAction, type MidiAction } from "./actions";
import { getProfile, MIDI_PROFILES, type MidiBinding, type MidiProfile } from "./profiles";
import { toast } from "sonner";

export type MidiSettings = {
  enabled: boolean;
  profileId: string;
  /** id of selected MIDIInput; null = auto-match by profile.inputMatch */
  inputId: string | null;
  /** id of selected MIDIOutput; null = auto-match by profile.outputMatch */
  outputId: string | null;
  ledFeedback: boolean;
  /** Custom user bindings layered on top of profile bindings */
  customBindings: MidiBinding[];
};

export const defaultMidiSettings: MidiSettings = {
  enabled: false,
  profileId: "generic",
  inputId: null,
  outputId: null,
  ledFeedback: true,
  customBindings: [],
};

type MidiInputLike = { id: string; name: string | null; onmidimessage: ((e: { data: Uint8Array }) => void) | null };
type MidiOutputLike = { id: string; name: string | null; send: (data: number[] | Uint8Array) => void };
type MapLike<T> = { get: (id: string) => T | undefined; values: () => Iterable<T>; forEach: (cb: (v: T) => void) => void };
type MidiAccessLike = {
  inputs: MapLike<MidiInputLike>;
  outputs: MapLike<MidiOutputLike>;
  onstatechange: ((e: unknown) => void) | null;
};

interface DeviceInfo { id: string; name: string; }

let access: MidiAccessLike | null = null;
let currentInput: MidiInputLike | null = null;
let currentOutput: MidiOutputLike | null = null;
let learning: { resolve: (b: MidiBinding | null) => void } | null = null;
let activityListeners: ((b: MidiBinding) => void)[] = [];
let unsubLed: (() => void) | null = null;
let activityFlashCb: ((dir: "in" | "out") => void) | null = null;

export function onMidiActivity(cb: (dir: "in" | "out") => void) {
  activityFlashCb = cb;
  return () => { activityFlashCb = null; };
}

export function listMidiDevices(): { inputs: DeviceInfo[]; outputs: DeviceInfo[] } {
  if (!access) return { inputs: [], outputs: [] };
  const inputs: DeviceInfo[] = [];
  const outputs: DeviceInfo[] = [];
  access.inputs.forEach((i) => inputs.push({ id: i.id, name: i.name ?? "Unknown" }));
  access.outputs.forEach((o) => outputs.push({ id: o.id, name: o.name ?? "Unknown" }));
  return { inputs, outputs };
}

export function isMidiSupported(): boolean {
  return typeof navigator !== "undefined" && typeof (navigator as Navigator & { requestMIDIAccess?: unknown }).requestMIDIAccess === "function";
}

export async function initMidi(): Promise<boolean> {
  if (!isMidiSupported()) return false;
  if (access) return true;
  try {
    const nav = navigator as Navigator & { requestMIDIAccess: (opts?: { sysex?: boolean }) => Promise<unknown> };
    const a = (await nav.requestMIDIAccess({ sysex: false })) as MidiAccessLike;
    access = a;
    a.onstatechange = () => {
      // Re-attempt selection on hot-plug
      const settings = getMidiSettings();
      if (settings.enabled) attachDevices(settings);
      // Force UI refresh
      useApp.setState((s) => ({ midi: { ...s.midi, _devicesVersion: (s.midi._devicesVersion ?? 0) + 1 } }));
    };
    return true;
  } catch (e) {
    console.warn("MIDI access denied", e);
    toast.error("MIDI access denied");
    return false;
  }
}

function findDevice<T extends { id: string; name: string | null }>(
  map: MapLike<T>,
  idOrMatch: string | null,
  fallbackMatch: string | null,
): T | null {
  if (idOrMatch) {
    const direct = map.get(idOrMatch);
    if (direct) return direct;
  }
  if (fallbackMatch) {
    const lower = fallbackMatch.toLowerCase();
    for (const v of map.values()) {
      if ((v.name ?? "").toLowerCase().includes(lower)) return v;
    }
  }
  return null;
}

function attachDevices(settings: MidiSettings) {
  if (!access) return;
  const profile = getProfile(settings.profileId);
  if (currentInput) currentInput.onmidimessage = null;
  currentInput = findDevice(access.inputs, settings.inputId, profile.inputMatch);
  currentOutput = findDevice(access.outputs, settings.outputId, profile.outputMatch);
  if (currentInput) currentInput.onmidimessage = onMessage;
}

function detachDevices() {
  if (currentInput) currentInput.onmidimessage = null;
  currentInput = null;
  currentOutput = null;
}

function getMidiSettings(): MidiSettings {
  return useApp.getState().midi;
}

export function setMidiEnabled(on: boolean) {
  useApp.setState((s) => ({ midi: { ...s.midi, enabled: on } }));
  if (on) {
    void (async () => {
      const ok = await initMidi();
      if (!ok) {
        useApp.setState((s) => ({ midi: { ...s.midi, enabled: false } }));
        return;
      }
      attachDevices(getMidiSettings());
      attachLedFeedback();
      toast.success("MIDI enabled");
    })();
  } else {
    detachDevices();
    detachLedFeedback();
    toast("MIDI disabled");
  }
}

export function setMidiProfile(id: string) {
  useApp.setState((s) => ({ midi: { ...s.midi, profileId: id, inputId: null, outputId: null } }));
  if (getMidiSettings().enabled) {
    attachDevices(getMidiSettings());
    attachLedFeedback();
  }
}

export function setMidiInput(id: string | null) {
  useApp.setState((s) => ({ midi: { ...s.midi, inputId: id } }));
  if (getMidiSettings().enabled) attachDevices(getMidiSettings());
}

export function setMidiOutput(id: string | null) {
  useApp.setState((s) => ({ midi: { ...s.midi, outputId: id } }));
  if (getMidiSettings().enabled) attachLedFeedback();
}

export function setLedFeedback(on: boolean) {
  useApp.setState((s) => ({ midi: { ...s.midi, ledFeedback: on } }));
  if (on) attachLedFeedback();
  else detachLedFeedback();
}

export function addCustomBinding(b: MidiBinding) {
  // Replace existing binding for the same MIDI source
  useApp.setState((s) => {
    const filtered = s.midi.customBindings.filter(
      (x) => !(x.type === b.type && x.channel === b.channel && x.data1 === b.data1),
    );
    return { midi: { ...s.midi, customBindings: [...filtered, b] } };
  });
}

export function removeCustomBinding(b: MidiBinding) {
  useApp.setState((s) => ({
    midi: {
      ...s.midi,
      customBindings: s.midi.customBindings.filter(
        (x) => !(x.type === b.type && x.channel === b.channel && x.data1 === b.data1 && x.actionId === b.actionId),
      ),
    },
  }));
}

export function clearCustomBindings() {
  useApp.setState((s) => ({ midi: { ...s.midi, customBindings: [] } }));
}

export function exportMidiMappings(): string {
  const m = getMidiSettings();
  return JSON.stringify({ profileId: m.profileId, customBindings: m.customBindings }, null, 2);
}

export function importMidiMappings(json: string): boolean {
  try {
    const parsed = JSON.parse(json);
    if (!parsed || !Array.isArray(parsed.customBindings)) return false;
    useApp.setState((s) => ({
      midi: {
        ...s.midi,
        profileId: typeof parsed.profileId === "string" ? parsed.profileId : s.midi.profileId,
        customBindings: parsed.customBindings as MidiBinding[],
      },
    }));
    return true;
  } catch {
    return false;
  }
}

/** Start MIDI Learn: next incoming control becomes a binding for the given action. */
export function startLearn(actionId: string): Promise<MidiBinding | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      learning = null;
      resolve(null);
    }, 12000);
    learning = {
      resolve: (b) => {
        clearTimeout(timeout);
        learning = null;
        if (b) {
          const bound: MidiBinding = { ...b, actionId };
          addCustomBinding(bound);
          resolve(bound);
        } else resolve(null);
      },
    };
  });
}

export function cancelLearn() {
  if (learning) {
    learning.resolve(null);
  }
}

export function isLearning(): boolean {
  return learning !== null;
}

export function subscribeMidiActivity(cb: (b: MidiBinding) => void): () => void {
  activityListeners.push(cb);
  return () => { activityListeners = activityListeners.filter((x) => x !== cb); };
}

function bindingMatches(a: { type: string; channel: number; data1: number }, b: { type: string; channel: number; data1: number }) {
  return a.type === b.type && a.channel === b.channel && a.data1 === b.data1;
}

function onMessage(e: { data: Uint8Array }) {
  const [status, data1Raw, data2Raw = 0] = e.data;
  const channel = status & 0x0F;
  const cmd = status & 0xF0;
  let type: MidiBinding["type"];
  let data1 = data1Raw;
  let value01: number;

  if (cmd === 0x90 || cmd === 0x80) {
    type = "note";
    // Note off or note on with velocity 0 = release
    value01 = cmd === 0x80 ? 0 : data2Raw / 127;
  } else if (cmd === 0xB0) {
    type = "cc";
    value01 = data2Raw / 127;
  } else if (cmd === 0xE0) {
    type = "pitchbend";
    data1 = 0;
    const v = ((data2Raw << 7) | data1Raw) / 16383;
    value01 = v;
  } else {
    return; // ignore aftertouch/program/system
  }

  const detected: MidiBinding = { type, channel, data1, actionId: "" };
  activityFlashCb?.("in");

  if (learning) {
    learning.resolve(detected);
    return;
  }

  const settings = getMidiSettings();
  const profile = getProfile(settings.profileId);
  // Custom bindings override profile bindings on the same source
  const allBindings: MidiBinding[] = [
    ...profile.bindings.filter((pb) => !settings.customBindings.some((cb) => bindingMatches(cb, pb))),
    ...settings.customBindings,
  ];

  for (const b of allBindings) {
    if (bindingMatches(b, detected)) {
      const action = getAction(b.actionId);
      if (!action) continue;
      let v = value01;
      if (b.transform === "invert") v = 1 - v;
      if (b.transform === "relative-2c") {
        // 64 = no change; 0..63 = neg; 65..127 = pos
        const signed = data2Raw < 64 ? data2Raw / 127 : (data2Raw - 128) / 127;
        v = 0.5 + signed; // map to 0..1 around 0.5
      }
      activityListeners.forEach((cb) => cb(b));
      try { action.apply(v); } catch (err) { console.warn("MIDI action error", b.actionId, err); }
    }
  }
}

// ---------- LED feedback ----------
const lastLedSent = new Map<string, number>();

function sendLed(o: MidiOutputLike, ledKey: string, status: number, data1: number, value: number) {
  const k = `${ledKey}`;
  const last = lastLedSent.get(k);
  if (last === value) return;
  lastLedSent.set(k, value);
  try {
    o.send([status, data1, Math.max(0, Math.min(127, value | 0))]);
    activityFlashCb?.("out");
  } catch (e) {
    console.warn("MIDI send failed", e);
  }
}

function pushLeds() {
  if (!currentOutput) return;
  const settings = getMidiSettings();
  if (!settings.ledFeedback) return;
  const profile = getProfile(settings.profileId);
  const map = profile.ledMap ?? {};
  for (const a of MIDI_ACTIONS) {
    const led = map[a.id];
    if (!led || !a.ledState) continue;
    const v = a.ledState();
    if (v === null) continue;
    const status = led.type === "note" ? (0x90 | (led.channel & 0x0F)) : (0xB0 | (led.channel & 0x0F));
    sendLed(currentOutput, a.id, status, led.data1, v);
  }
}

function attachLedFeedback() {
  detachLedFeedback();
  if (!currentOutput) return;
  // Push initial state, then subscribe to store changes (light polling)
  pushLeds();
  const id = window.setInterval(pushLeds, 80);
  unsubLed = () => window.clearInterval(id);
}

function detachLedFeedback() {
  if (unsubLed) unsubLed();
  unsubLed = null;
  lastLedSent.clear();
}

/** Boot from app: call once after store hydration */
export async function bootMidi() {
  const s = getMidiSettings();
  if (s.enabled && isMidiSupported()) {
    const ok = await initMidi();
    if (ok) {
      attachDevices(s);
      attachLedFeedback();
    }
  }
}

export { MIDI_PROFILES, MIDI_ACTIONS };
export type { MidiBinding, MidiProfile, MidiAction };
