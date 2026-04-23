// MIDI engine: Web MIDI access, dispatch to actions, LED feedback subscription.
import { useApp } from "@/state/store";
import { MIDI_ACTIONS, getAction, type MidiAction } from "./actions";
import { getProfile, MIDI_PROFILES, type MidiBinding, type MidiProfile } from "./profiles";
import { toast } from "sonner";

export type MidiSettings = {
  enabled: boolean;
  profileId: string;
  /** Legacy single-input id (kept for back-compat). null = auto-match by profile.inputMatch */
  inputId: string | null;
  /** Legacy single-output id (kept for back-compat). null = auto-match by profile.outputMatch */
  outputId: string | null;
  /** Multiple active input device ids (multi-controller). If empty → fall back to inputId / auto-match. */
  enabledInputIds?: string[];
  /** Multiple active output device ids for LED feedback. If empty → fall back to outputId / auto-match. */
  enabledOutputIds?: string[];
  ledFeedback: boolean;
  /** Custom user bindings layered on top of profile bindings */
  customBindings: MidiBinding[];
};

export const defaultMidiSettings: MidiSettings = {
  enabled: false,
  profileId: "generic",
  inputId: null,
  outputId: null,
  enabledInputIds: [],
  enabledOutputIds: [],
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
/** All currently active inputs (multi-controller). */
let currentInputs: MidiInputLike[] = [];
/** All currently active outputs for LED feedback. */
let currentOutputs: MidiOutputLike[] = [];
let learning: { resolve: (b: MidiBinding | null) => void } | null = null;
let activityListeners: ((b: MidiBinding) => void)[] = [];
let unsubLed: (() => void) | null = null;
let activityFlashCb: ((dir: "in" | "out") => void) | null = null;
/** Track which device fired the most recent message so we can attach deviceId to bindings/learn. */
let lastMessageDeviceId: string | null = null;
let lastMessageDeviceName: string | null = null;

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
  // Detach all previous handlers first.
  for (const i of currentInputs) i.onmidimessage = null;
  currentInputs = [];
  currentOutputs = [];

  // Resolve inputs: prefer multi-select list; fall back to legacy single id; then auto-match.
  const inIds = settings.enabledInputIds && settings.enabledInputIds.length > 0
    ? settings.enabledInputIds
    : (settings.inputId ? [settings.inputId] : []);
  if (inIds.length > 0) {
    for (const id of inIds) {
      const dev = access.inputs.get(id);
      if (dev) currentInputs.push(dev);
    }
  } else {
    const auto = findDevice(access.inputs, null, profile.inputMatch);
    if (auto) currentInputs.push(auto);
  }

  // Resolve outputs (LED feedback) the same way.
  const outIds = settings.enabledOutputIds && settings.enabledOutputIds.length > 0
    ? settings.enabledOutputIds
    : (settings.outputId ? [settings.outputId] : []);
  if (outIds.length > 0) {
    for (const id of outIds) {
      const dev = access.outputs.get(id);
      if (dev) currentOutputs.push(dev);
    }
  } else {
    const auto = findDevice(access.outputs, null, profile.outputMatch);
    if (auto) currentOutputs.push(auto);
  }

  // Wrap so we know which device the message came from.
  for (const i of currentInputs) {
    const dev = i;
    i.onmidimessage = (e) => {
      lastMessageDeviceId = dev.id;
      lastMessageDeviceName = dev.name ?? null;
      onMessage(e);
    };
  }
}

function detachDevices() {
  for (const i of currentInputs) i.onmidimessage = null;
  currentInputs = [];
  currentOutputs = [];
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

/** Toggle a single input device on/off in the multi-controller list. */
export function toggleMidiInput(id: string, on: boolean) {
  useApp.setState((s) => {
    const cur = s.midi.enabledInputIds ?? [];
    const next = on ? Array.from(new Set([...cur, id])) : cur.filter((x) => x !== id);
    return { midi: { ...s.midi, enabledInputIds: next } };
  });
  if (getMidiSettings().enabled) attachDevices(getMidiSettings());
}

/** Toggle a single output device on/off in the multi-controller list. */
export function toggleMidiOutput(id: string, on: boolean) {
  useApp.setState((s) => {
    const cur = s.midi.enabledOutputIds ?? [];
    const next = on ? Array.from(new Set([...cur, id])) : cur.filter((x) => x !== id);
    return { midi: { ...s.midi, enabledOutputIds: next } };
  });
  if (getMidiSettings().enabled) {
    attachDevices(getMidiSettings());
    attachLedFeedback();
  }
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

function sendLed(outs: MidiOutputLike[], ledKey: string, status: number, data1: number, value: number) {
  const k = ledKey;
  const last = lastLedSent.get(k);
  if (last === value) return;
  lastLedSent.set(k, value);
  const v = Math.max(0, Math.min(127, value | 0));
  for (const o of outs) {
    try {
      o.send([status, data1, v]);
      activityFlashCb?.("out");
    } catch (e) {
      console.warn("MIDI send failed", e);
    }
  }
}

function pushLeds() {
  if (currentOutputs.length === 0) return;
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
    sendLed(currentOutputs, a.id, status, led.data1, v);
  }
}

function attachLedFeedback() {
  detachLedFeedback();
  if (currentOutputs.length === 0) return;
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
