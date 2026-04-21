/**
 * Mix Presets — quick "DJ recipes" applied to a deck.
 *
 * Each preset is a snapshot of EQ, filter, vocal-cut and FX settings used by
 * common DJ techniques (low-pass intro, high-pass build, instrumental break,
 * etc.). Users can add/remove/edit presets; the 5 defaults below ship out of
 * the box and can be reset at any time.
 */
import type { FxKind } from "@/audio/fx";

export interface MixPreset {
  id: string;
  name: string;
  description: string;
  emoji: string;
  /** Built-in presets cannot be deleted (only duplicated). */
  builtin?: boolean;
  /** EQ in -1..1 range. Undefined → leave as-is. */
  hi?: number;
  mid?: number;
  lo?: number;
  /** Filter in -1..1 (negative = LP, positive = HP). */
  filter?: number;
  /** 0..1 vocal cancellation amount. */
  vocalCut?: number;
  /** Optional FX slot to enable on the master rack. */
  fx?: { slot: 1 | 2 | 3; kind: FxKind; wet: number; param1: number; param2: number };
}

export const DEFAULT_MIX_PRESETS: MixPreset[] = [
  {
    id: "builtin-clean",
    name: "Clean Cut",
    description: "EQ plano, sin FX. Pista limpia para empezar la mezcla.",
    emoji: "✨",
    builtin: true,
    hi: 0, mid: 0, lo: 0, filter: 0, vocalCut: 0,
    fx: { slot: 1, kind: "off", wet: 0, param1: 0.5, param2: 0.5 },
  },
  {
    id: "builtin-lp-intro",
    name: "Low-Pass Intro",
    description: "Filtro pasa-bajos suave + bajos al máximo. Entrada de pista.",
    emoji: "🌊",
    builtin: true,
    hi: -0.4, mid: -0.2, lo: 0.2, filter: -0.45, vocalCut: 0,
  },
  {
    id: "builtin-hp-build",
    name: "High-Pass Build",
    description: "Filtro pasa-altos para tensión antes del drop.",
    emoji: "🚀",
    builtin: true,
    hi: 0.2, mid: 0, lo: -1, filter: 0.55, vocalCut: 0,
  },
  {
    id: "builtin-instrumental",
    name: "Instrumental Mix",
    description: "Quita la voz para mezclar dos pistas vocales sin pelear.",
    emoji: "🎤",
    builtin: true,
    hi: 0, mid: -0.3, lo: 0, filter: 0, vocalCut: 0.85,
  },
  {
    id: "builtin-echo-out",
    name: "Echo Out",
    description: "Echo + cola larga para terminar la pista en el aire.",
    emoji: "🔁",
    builtin: true,
    hi: 0.1, mid: -0.2, lo: -0.5, filter: 0.2, vocalCut: 0,
    fx: { slot: 1, kind: "echo", wet: 0.55, param1: 0.5, param2: 0.5 },
  },
];

export function genPresetId(): string {
  return "user-" + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}