/**
 * FX Chain Presets — load 3 master FX slots at once with curated combinations
 * for different genres / use-cases. Built-in presets ship with the app; users
 * can save their own from the current FX panel state.
 */
import type { FxKind } from "@/audio/fx";

export interface FxSlotPreset {
  kind: FxKind;
  wet: number;     // 0..1
  param1: number;  // 0..1
  param2: number;  // 0..1
}

export interface FxChainPreset {
  id: string;
  name: string;
  description: string;
  emoji: string;
  builtin?: boolean;
  category: "general" | "voice" | "deck" | "electronica" | "rap" | "rock" | "pop";
  slots: [FxSlotPreset, FxSlotPreset, FxSlotPreset];
}

const off = (): FxSlotPreset => ({ kind: "off", wet: 0, param1: 0.5, param2: 0.5 });

export const DEFAULT_FX_CHAIN_PRESETS: FxChainPreset[] = [
  {
    id: "fx-clean",
    name: "Clean",
    description: "Sin FX. Reset rápido del rack.",
    emoji: "✨", builtin: true, category: "general",
    slots: [off(), off(), off()],
  },
  {
    id: "fx-club",
    name: "Club Atmosphere",
    description: "Reverb amplio + delay sutil. Sensación de sala grande.",
    emoji: "🏟️", builtin: true, category: "general",
    slots: [
      { kind: "reverb", wet: 0.35, param1: 0.7, param2: 0.5 },
      { kind: "delay",  wet: 0.2,  param1: 0.4, param2: 0.35 },
      off(),
    ],
  },
  {
    id: "fx-edm-build",
    name: "EDM Build-Up",
    description: "Filter sweep + flanger para tensión antes del drop.",
    emoji: "🚀", builtin: true, category: "electronica",
    slots: [
      { kind: "filter",  wet: 0.7, param1: 0.6, param2: 0.4 },
      { kind: "flanger", wet: 0.5, param1: 0.4, param2: 0.6 },
      off(),
    ],
  },
  {
    id: "fx-trap-vibe",
    name: "Trap Vibe",
    description: "Echo corto + lo-fi. Adlibs y hi-hats al estilo trap.",
    emoji: "⚡", builtin: true, category: "rap",
    slots: [
      { kind: "echo", wet: 0.45, param1: 0.35, param2: 0.55 },
      { kind: "lofi", wet: 0.3,  param1: 0.4,  param2: 0.4 },
      off(),
    ],
  },
  {
    id: "fx-rock-stadium",
    name: "Rock Stadium",
    description: "Reverb estadio + chorus. Solos épicos.",
    emoji: "🎸", builtin: true, category: "rock",
    slots: [
      { kind: "reverb", wet: 0.6, param1: 0.85, param2: 0.5 },
      { kind: "chorus", wet: 0.3, param1: 0.5,  param2: 0.5 },
      off(),
    ],
  },
  {
    id: "fx-pop-shine",
    name: "Pop Shine",
    description: "Chorus suave + reverb corta. Voz pop brillante.",
    emoji: "🌟", builtin: true, category: "pop",
    slots: [
      { kind: "chorus", wet: 0.35, param1: 0.4, param2: 0.4 },
      { kind: "reverb", wet: 0.25, param1: 0.4, param2: 0.5 },
      off(),
    ],
  },
  {
    id: "fx-vocal-radio",
    name: "Voz Radio FM",
    description: "Filter HP + tremolo. Locutor de radio AM/FM.",
    emoji: "📻", builtin: true, category: "voice",
    slots: [
      { kind: "filter",  wet: 0.6, param1: 0.65, param2: 0.4 },
      { kind: "tremolo", wet: 0.2, param1: 0.3,  param2: 0.4 },
      off(),
    ],
  },
  {
    id: "fx-vocal-hall",
    name: "Voz Hall",
    description: "Reverb amplio para coros y backings vocales.",
    emoji: "🎙️", builtin: true, category: "voice",
    slots: [
      { kind: "reverb", wet: 0.55, param1: 0.75, param2: 0.5 },
      { kind: "delay",  wet: 0.15, param1: 0.3,  param2: 0.3 },
      off(),
    ],
  },
  {
    id: "fx-deck-tape",
    name: "Tape Vintage",
    description: "Lo-fi + flanger. Sonido cinta vieja.",
    emoji: "📼", builtin: true, category: "deck",
    slots: [
      { kind: "lofi",    wet: 0.5, param1: 0.5, param2: 0.4 },
      { kind: "flanger", wet: 0.3, param1: 0.3, param2: 0.5 },
      off(),
    ],
  },
  {
    id: "fx-deck-space",
    name: "Space Echo",
    description: "Echo + phaser. Transiciones ambientales.",
    emoji: "🌌", builtin: true, category: "deck",
    slots: [
      { kind: "echo",   wet: 0.55, param1: 0.55, param2: 0.6 },
      { kind: "phaser", wet: 0.35, param1: 0.4,  param2: 0.5 },
      off(),
    ],
  },
];

export function fxPresetUid(): string {
  return "fx-user-" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

const STORAGE_KEY = "vdj-pro-fx-chain-presets";

export function loadFxChainPresets(): FxChainPreset[] {
  if (typeof localStorage === "undefined") return DEFAULT_FX_CHAIN_PRESETS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FX_CHAIN_PRESETS;
    const userOnly = JSON.parse(raw) as FxChainPreset[];
    return [...DEFAULT_FX_CHAIN_PRESETS, ...userOnly];
  } catch {
    return DEFAULT_FX_CHAIN_PRESETS;
  }
}

export function saveUserFxChainPresets(all: FxChainPreset[]): void {
  if (typeof localStorage === "undefined") return;
  const userOnly = all.filter((p) => !p.builtin);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userOnly));
}
