// Centralized definitions of all configurable keyboard shortcuts.
// Each action has a stable id, a human label, and a default KeyboardEvent.code.
// User overrides are stored in settings.shortcuts (Record<actionId, code>).

export interface ShortcutDef {
  id: string;
  label: string;
  group: string;
  default: string; // KeyboardEvent.code (e.g. "Space", "KeyA", "Numpad1")
  /** If true, this binding fires only when Shift is held. */
  shift?: boolean;
}

export const SHORTCUT_DEFS: ShortcutDef[] = [
  // Decks & playback
  { id: "playA",   label: "Play / Pause Deck A", group: "Decks", default: "Space" },
  { id: "playB",   label: "Play / Pause Deck B", group: "Decks", default: "ShiftRight" },
  { id: "playA2",  label: "Play / Pause Deck A (alt)", group: "Decks", default: "KeyJ" },
  { id: "playB2",  label: "Play / Pause Deck B (alt)", group: "Decks", default: "KeyL" },
  { id: "cueA",    label: "Cue Deck A", group: "Decks", default: "KeyQ" },
  { id: "cueB",    label: "Cue Deck B", group: "Decks", default: "KeyW" },
  { id: "syncA",   label: "Sync Deck A", group: "Decks", default: "KeyA" },
  { id: "syncB",   label: "Sync Deck B", group: "Decks", default: "KeyS" },
  { id: "brakeA",  label: "Brake Deck A", group: "Decks", default: "KeyO" },
  { id: "stopA",   label: "Stop Deck A", group: "Decks", default: "KeyU" },
  { id: "brakeAB", label: "Brake (B if Shift, else A)", group: "Decks", default: "KeyB" },
  { id: "reverseAB", label: "Reverse (B if Shift, else A)", group: "Decks", default: "KeyV" },
  // Decks C & D (only active when 4 decks are enabled)
  { id: "playC",   label: "Play / Pause Deck C", group: "Decks C/D", default: "KeyG" },
  { id: "playD",   label: "Play / Pause Deck D", group: "Decks C/D", default: "KeyH" },
  { id: "cueC",    label: "Cue Deck C", group: "Decks C/D", default: "KeyE" },
  { id: "cueD",    label: "Cue Deck D", group: "Decks C/D", default: "KeyR" },
  { id: "syncC",   label: "Sync Deck C", group: "Decks C/D", default: "KeyD" },
  { id: "syncD",   label: "Sync Deck D", group: "Decks C/D", default: "KeyF" },
  { id: "brakeC",  label: "Brake Deck C", group: "Decks C/D", default: "KeyI" },
  { id: "brakeD",  label: "Brake Deck D", group: "Decks C/D", default: "KeyP" },
  { id: "reverseC", label: "Reverse Deck C", group: "Decks C/D", default: "KeyN" },
  { id: "reverseD", label: "Reverse Deck D", group: "Decks C/D", default: "KeyM" },
  { id: "jumpCback", label: "Beat jump Deck C −4", group: "Decks C/D", default: "Comma" },
  { id: "jumpCfwd",  label: "Beat jump Deck C +4", group: "Decks C/D", default: "Period" },
  { id: "jumpDback", label: "Beat jump Deck D −4", group: "Decks C/D", default: "Minus" },
  { id: "jumpDfwd",  label: "Beat jump Deck D +4", group: "Decks C/D", default: "Equal" },
  // Mix
  { id: "automix", label: "Auto-mix between decks", group: "Mix", default: "KeyM" },
  { id: "tap",     label: "Tap tempo", group: "Mix", default: "KeyT" },
  { id: "record",  label: "Start / stop recording", group: "Mix", default: "KeyR" },
  { id: "micToggle", label: "Voice-over ON/OFF", group: "Mix", default: "KeyN" },
  { id: "radioNext", label: "Radio: next track (Shift+L)", group: "Mix", default: "KeyL", shift: true },
  { id: "numpadToggle", label: "Toggle numpad target deck", group: "Mix", default: "Backquote" },
  { id: "smartFaderToggle", label: "Smart Fader ON/OFF", group: "Mix", default: "KeyK", shift: true },
  { id: "automixProToggle", label: "AutoMix Pro panel ON/OFF", group: "Mix", default: "KeyP", shift: true },
  // Beat jump
  { id: "jumpAback",  label: "Beat jump Deck A −4", group: "Loops", default: "BracketLeft" },
  { id: "jumpAfwd",   label: "Beat jump Deck A +4", group: "Loops", default: "BracketRight" },
  { id: "jumpBback",  label: "Beat jump Deck B −4", group: "Loops", default: "Semicolon" },
  { id: "jumpBfwd",   label: "Beat jump Deck B +4", group: "Loops", default: "Quote" },
  // Numpad
  { id: "npLoop4",    label: "Numpad: 4-beat loop", group: "Numpad", default: "Numpad9" },
  { id: "npLoopToggle", label: "Numpad: toggle loop", group: "Numpad", default: "Numpad0" },
  { id: "npLoopClear",  label: "Numpad: clear loop", group: "Numpad", default: "NumpadDecimal" },
  { id: "npSampler1", label: "Numpad: sampler pad 1", group: "Numpad", default: "NumpadAdd" },
  { id: "npSampler2", label: "Numpad: sampler pad 2", group: "Numpad", default: "NumpadSubtract" },
  { id: "npFx1",      label: "Numpad: toggle FX 1", group: "Numpad", default: "NumpadMultiply" },
  { id: "npFx2",      label: "Numpad: toggle FX 2", group: "Numpad", default: "NumpadDivide" },
  { id: "npRecord",   label: "Numpad: rec start/stop", group: "Numpad", default: "NumpadEnter" },
  // UI / Panels
  { id: "showShortcuts", label: "Show / hide shortcuts panel", group: "UI", default: "Slash", shift: true },
  { id: "panelLibrary",   label: "Open panel: Library",   group: "Panels", default: "F1" },
  { id: "panelRecorder",  label: "Open panel: Recorder",  group: "Panels", default: "F2" },
  { id: "panelFx",        label: "Open panel: FX",        group: "Panels", default: "F3" },
  { id: "panelSampler",   label: "Open panel: Sampler",   group: "Panels", default: "F4" },
  { id: "panelStems",     label: "Open panel: Stems",     group: "Panels", default: "F5" },
  { id: "panelPresets",   label: "Open panel: Presets",   group: "Panels", default: "F6" },
  { id: "panelRadio",     label: "Open panel: Radio",     group: "Panels", default: "F7" },
  { id: "panelOnline",    label: "Open panel: Online",    group: "Panels", default: "F8" },
  { id: "panelSynth",     label: "Open panel: Synth",     group: "Panels", default: "F9" },
  { id: "panelLiveVocal", label: "Open panel: Live Vocal", group: "Panels", default: "F10" },
  { id: "panelBeatMaker", label: "Open panel: Beat Maker", group: "Panels", default: "F11" },
];

/** Build the full default map (id -> code). */
export function defaultShortcutMap(): Record<string, string> {
  const m: Record<string, string> = {};
  for (const d of SHORTCUT_DEFS) m[d.id] = d.default;
  return m;
}

/** Merge user-saved overrides on top of defaults, ensuring all keys exist. */
export function resolveShortcuts(user: Record<string, string> | undefined): Record<string, string> {
  const base = defaultShortcutMap();
  if (!user) return base;
  for (const def of SHORTCUT_DEFS) {
    const v = user[def.id];
    if (typeof v === "string" && v.length > 0) base[def.id] = v;
  }
  return base;
}

/** Pretty-print a KeyboardEvent.code for display. */
export function formatKeyCode(code: string): string {
  if (!code) return "—";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return "Num " + code.slice(6);
  const map: Record<string, string> = {
    Space: "Space",
    ShiftLeft: "Shift L",
    ShiftRight: "Shift R",
    BracketLeft: "[",
    BracketRight: "]",
    Semicolon: ";",
    Quote: "'",
    Backquote: "`",
    Slash: "/",
    Backslash: "\\",
    Comma: ",",
    Period: ".",
    Minus: "-",
    Equal: "=",
    Enter: "Enter",
    Tab: "Tab",
    Escape: "Esc",
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
  };
  return map[code] ?? code;
}