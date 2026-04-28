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
  /** Grouping category for the UI ("general" or a music genre). */
  category?: PresetCategory;
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

export type PresetCategory =
  | "general"
  | "reggaeton"
  | "pop"
  | "electronica"
  | "rap"
  | "rock"
  | "salsa"
  | "bachata"
  | "cumbia"
  | "merengue"
  | "dancehall"
  | "kpop"
  | "rnb"
  | "jazz"
  | "country"
  | "indie"
  | "afrobeat"
  | "funk"
  | "reggae";

export const CATEGORY_LABELS: Record<PresetCategory, string> = {
  general: "General",
  reggaeton: "Reggaetón",
  pop: "Pop",
  electronica: "Electrónica",
  rap: "Rap / Hip-Hop",
  rock: "Rock",
  salsa: "Salsa",
  bachata: "Bachata",
  cumbia: "Cumbia",
  merengue: "Merengue",
  dancehall: "Dancehall",
  kpop: "K-Pop",
  rnb: "R&B / Soul",
  jazz: "Jazz",
  country: "Country",
  indie: "Indie / Alternativo",
  afrobeat: "Afrobeat",
  funk: "Funk / Disco",
  reggae: "Reggae",
};

export const CATEGORY_ORDER: PresetCategory[] = [
  "general",
  "reggaeton",
  "pop",
  "electronica",
  "rap",
  "rock",
  "salsa",
  "bachata",
  "cumbia",
  "merengue",
  "dancehall",
  "kpop",
  "rnb",
  "jazz",
  "country",
  "indie",
  "afrobeat",
  "funk",
  "reggae",
];

export const DEFAULT_MIX_PRESETS: MixPreset[] = [
  {
    id: "builtin-clean",
    name: "Clean Cut",
    description: "EQ plano, sin FX. Pista limpia para empezar la mezcla.",
    emoji: "✨",
    builtin: true,
    category: "general",
    hi: 0, mid: 0, lo: 0, filter: 0, vocalCut: 0,
    fx: { slot: 1, kind: "off", wet: 0, param1: 0.5, param2: 0.5 },
  },
  {
    id: "builtin-lp-intro",
    name: "Low-Pass Intro",
    description: "Filtro pasa-bajos suave + bajos al máximo. Entrada de pista.",
    emoji: "🌊",
    builtin: true,
    category: "general",
    hi: -0.4, mid: -0.2, lo: 0.2, filter: -0.45, vocalCut: 0,
  },
  {
    id: "builtin-hp-build",
    name: "High-Pass Build",
    description: "Filtro pasa-altos para tensión antes del drop.",
    emoji: "🚀",
    builtin: true,
    category: "general",
    hi: 0.2, mid: 0, lo: -1, filter: 0.55, vocalCut: 0,
  },
  {
    id: "builtin-instrumental",
    name: "Instrumental Mix",
    description: "Quita la voz para mezclar dos pistas vocales sin pelear.",
    emoji: "🎤",
    builtin: true,
    category: "general",
    hi: 0, mid: -0.3, lo: 0, filter: 0, vocalCut: 0.85,
  },
  {
    id: "builtin-echo-out",
    name: "Echo Out",
    description: "Echo + cola larga para terminar la pista en el aire.",
    emoji: "🔁",
    builtin: true,
    category: "general",
    hi: 0.1, mid: -0.2, lo: -0.5, filter: 0.2, vocalCut: 0,
    fx: { slot: 1, kind: "echo", wet: 0.55, param1: 0.5, param2: 0.5 },
  },
  {
    id: "builtin-bass-boost",
    name: "Bass Boost",
    description: "Bajos en máximo, agudos suaves. Ideal para clímax con kick fuerte.",
    emoji: "🔊",
    builtin: true,
    category: "general",
    hi: -0.15, mid: 0, lo: 0.6, filter: 0, vocalCut: 0,
  },
  {
    id: "builtin-radio-tele",
    name: "Radio FM",
    description: "Suena como una radio AM/FM (sin graves ni agudos extremos).",
    emoji: "📻",
    builtin: true,
    category: "general",
    hi: -0.5, mid: 0.3, lo: -0.7, filter: 0.25, vocalCut: 0,
  },
  {
    id: "builtin-reverb-wash",
    name: "Reverb Wash",
    description: "Reverb amplio + medios reducidos. Transiciones etéreas.",
    emoji: "🌫️",
    builtin: true,
    category: "general",
    hi: 0, mid: -0.4, lo: -0.2, filter: 0,  vocalCut: 0,
    fx: { slot: 1, kind: "reverb", wet: 0.6, param1: 0.7, param2: 0.5 },
  },
  {
    id: "builtin-drum-only",
    name: "Drums Only",
    description: "Mata medios y agudos. Quedan kicks/percusión para mezclar.",
    emoji: "🥁",
    builtin: true,
    category: "general",
    hi: -1, mid: -0.7, lo: 0.2, filter: -0.2, vocalCut: 0,
  },
  {
    id: "builtin-flanger-fx",
    name: "Flanger Sweep",
    description: "Flanger animado para giros y tensión rítmica.",
    emoji: "🌀",
    builtin: true,
    category: "general",
    hi: 0.1, mid: 0, lo: -0.1, filter: 0, vocalCut: 0,
    fx: { slot: 2, kind: "flanger", wet: 0.55, param1: 0.4, param2: 0.6 },
  },

  // ===== REGGAETÓN =====
  {
    id: "builtin-reggae-perreo",
    name: "Perreo Boost",
    description: "Sub graves potentes para el dembow. Kick y bajo al frente.",
    emoji: "🍑", builtin: true, category: "reggaeton",
    hi: -0.1, mid: -0.15, lo: 0.7, filter: 0, vocalCut: 0,
  },
  {
    id: "builtin-reggae-acapella",
    name: "Acapella Drop",
    description: "Quita instrumental, deja la voz para el cambio de pista.",
    emoji: "🎙️", builtin: true, category: "reggaeton",
    hi: 0.2, mid: 0.1, lo: -1, filter: 0.5, vocalCut: 0,
  },
  {
    id: "builtin-reggae-dembow-cut",
    name: "Dembow Cut",
    description: "Pasa-altos fuerte para soltar el beat de dembow limpio.",
    emoji: "🔥", builtin: true, category: "reggaeton",
    hi: 0.3, mid: 0, lo: -0.9, filter: 0.65, vocalCut: 0,
  },
  {
    id: "builtin-reggae-reverb-vox",
    name: "Voz Reverb",
    description: "Reverb sobre la voz para coros y adlibs estilo Bad Bunny.",
    emoji: "🌴", builtin: true, category: "reggaeton",
    hi: 0.1, mid: -0.1, lo: 0, filter: 0, vocalCut: 0,
    fx: { slot: 1, kind: "reverb", wet: 0.45, param1: 0.55, param2: 0.5 },
  },
  {
    id: "builtin-reggae-instrumental",
    name: "Beat Reggaetón",
    description: "Quita la voz para mezclar dos temas vocales sin chocar.",
    emoji: "🎚️", builtin: true, category: "reggaeton",
    hi: -0.05, mid: -0.25, lo: 0.15, filter: 0, vocalCut: 0.85,
  },

  // ===== POP =====
  {
    id: "builtin-pop-radio",
    name: "Pop Radio",
    description: "Brillo en agudos + presencia vocal. Sonido de radio comercial.",
    emoji: "📻", builtin: true, category: "pop",
    hi: 0.35, mid: 0.2, lo: 0.1, filter: 0, vocalCut: 0,
  },
  {
    id: "builtin-pop-vocal-shine",
    name: "Vocal Shine",
    description: "Realza la voz con un toque de reverb pop.",
    emoji: "✨", builtin: true, category: "pop",
    hi: 0.25, mid: 0.3, lo: -0.15, filter: 0, vocalCut: 0,
    fx: { slot: 1, kind: "reverb", wet: 0.3, param1: 0.5, param2: 0.5 },
  },
  {
    id: "builtin-pop-build-up",
    name: "Pop Build-Up",
    description: "Filtro pasa-altos progresivo para preparar el coro.",
    emoji: "📈", builtin: true, category: "pop",
    hi: 0.15, mid: 0.05, lo: -0.85, filter: 0.5, vocalCut: 0,
  },
  {
    id: "builtin-pop-acoustic",
    name: "Acústico Soft",
    description: "Medios cálidos, agudos suaves. Ideal para baladas pop.",
    emoji: "🎸", builtin: true, category: "pop",
    hi: -0.1, mid: 0.25, lo: 0.05, filter: 0, vocalCut: 0,
  },
  {
    id: "builtin-pop-karaoke",
    name: "Karaoke Pop",
    description: "Quita la voz principal para cantar encima de la pista.",
    emoji: "🎤", builtin: true, category: "pop",
    hi: 0.05, mid: -0.2, lo: 0.05, filter: 0, vocalCut: 0.95,
  },

  // ===== ELECTRÓNICA =====
  {
    id: "builtin-edm-drop",
    name: "EDM Drop",
    description: "Bajos a tope + agudos crispy. Para el momento del drop.",
    emoji: "💥", builtin: true, category: "electronica",
    hi: 0.4, mid: -0.1, lo: 0.55, filter: 0, vocalCut: 0,
  },
  {
    id: "builtin-edm-filter-sweep",
    name: "Filter Sweep",
    description: "Pasa-altos largo para tensión antes del beat.",
    emoji: "🎛️", builtin: true, category: "electronica",
    hi: 0.2, mid: 0, lo: -1, filter: 0.7, vocalCut: 0,
  },
  {
    id: "builtin-edm-techno",
    name: "Techno Dark",
    description: "Medios oscuros + kick seco. Estilo techno underground.",
    emoji: "🖤", builtin: true, category: "electronica",
    hi: -0.25, mid: -0.4, lo: 0.3, filter: -0.1, vocalCut: 0,
  },
  {
    id: "builtin-edm-trance",
    name: "Trance Lift",
    description: "Reverb amplio + agudos brillantes. Atmósfera trance.",
    emoji: "🌀", builtin: true, category: "electronica",
    hi: 0.3, mid: 0.1, lo: -0.1, filter: 0, vocalCut: 0,
    fx: { slot: 1, kind: "reverb", wet: 0.5, param1: 0.75, param2: 0.5 },
  },
  {
    id: "builtin-edm-house-loop",
    name: "House Echo",
    description: "Echo rítmico para loops y transiciones house.",
    emoji: "🏠", builtin: true, category: "electronica",
    hi: 0.1, mid: 0, lo: 0.1, filter: 0, vocalCut: 0,
    fx: { slot: 1, kind: "echo", wet: 0.45, param1: 0.5, param2: 0.6 },
  },

  // ===== RAP / HIP-HOP =====
  {
    id: "builtin-rap-808",
    name: "808 Heavy",
    description: "Sub bajo monstruoso. Realza los 808 del trap moderno.",
    emoji: "💯", builtin: true, category: "rap",
    hi: -0.05, mid: -0.2, lo: 0.75, filter: 0, vocalCut: 0,
  },
  {
    id: "builtin-rap-vocal-front",
    name: "Voz al Frente",
    description: "Medios y presencia vocal arriba. Para battles y freestyle.",
    emoji: "🎤", builtin: true, category: "rap",
    hi: 0.2, mid: 0.4, lo: -0.1, filter: 0, vocalCut: 0,
  },
  {
    id: "builtin-rap-instrumental",
    name: "Beat Sólo",
    description: "Quita la voz, deja el beat para freestyle o cypher.",
    emoji: "🎧", builtin: true, category: "rap",
    hi: 0, mid: -0.15, lo: 0.1, filter: 0, vocalCut: 0.9,
  },
  {
    id: "builtin-rap-boom-bap",
    name: "Boom Bap",
    description: "Sonido vintage 90s. Medios cálidos, agudos vintage.",
    emoji: "🧢", builtin: true, category: "rap",
    hi: -0.4, mid: 0.2, lo: 0.25, filter: 0, vocalCut: 0,
  },
  {
    id: "builtin-rap-trap-fx",
    name: "Trap FX",
    description: "Echo corto sobre adlibs y hi-hats. Estilo trap moderno.",
    emoji: "⚡", builtin: true, category: "rap",
    hi: 0.25, mid: -0.1, lo: 0.4, filter: 0, vocalCut: 0,
    fx: { slot: 1, kind: "echo", wet: 0.4, param1: 0.35, param2: 0.55 },
  },

  // ===== ROCK =====
  {
    id: "builtin-rock-power",
    name: "Power Rock",
    description: "Medios potentes + agudos crujientes. Guitarras al frente.",
    emoji: "🎸", builtin: true, category: "rock",
    hi: 0.3, mid: 0.4, lo: 0.15, filter: 0, vocalCut: 0,
  },
  {
    id: "builtin-rock-classic",
    name: "Classic Rock",
    description: "Tono cálido vintage estilo años 70. Suave y redondo.",
    emoji: "🤘", builtin: true, category: "rock",
    hi: -0.2, mid: 0.3, lo: 0.2, filter: 0, vocalCut: 0,
  },
  {
    id: "builtin-rock-metal",
    name: "Metal Crunch",
    description: "Bajos cerrados, medios fuertes. Distorsión percibida más densa.",
    emoji: "🔥", builtin: true, category: "rock",
    hi: 0.45, mid: 0.5, lo: -0.2, filter: 0, vocalCut: 0,
  },
  {
    id: "builtin-rock-acoustic",
    name: "Rock Acústico",
    description: "Suave, sin sub graves. Para sets unplugged y baladas.",
    emoji: "🪕", builtin: true, category: "rock",
    hi: 0.1, mid: 0.2, lo: -0.4, filter: 0.15, vocalCut: 0,
  },
  {
    id: "builtin-rock-stadium",
    name: "Stadium Reverb",
    description: "Reverb estadio enorme. Solos de guitarra épicos.",
    emoji: "🏟️", builtin: true, category: "rock",
    hi: 0.2, mid: 0.25, lo: 0.05, filter: 0, vocalCut: 0,
    fx: { slot: 1, kind: "reverb", wet: 0.55, param1: 0.8, param2: 0.5 },
  },

  // ===== SALSA =====
  {
    id: "builtin-salsa-clave",
    name: "Clave Brillante",
    description: "Agudos y medios al frente para realzar clave, timbal y trompetas.",
    emoji: "🎺", builtin: true, category: "salsa",
    hi: 0.35, mid: 0.3, lo: 0, filter: 0, vocalCut: 0,
  },
  {
    id: "builtin-salsa-mambo",
    name: "Mambo Drop",
    description: "Pasa-altos para soltar el mambo limpio en el coro.",
    emoji: "💃", builtin: true, category: "salsa",
    hi: 0.25, mid: 0.1, lo: -0.85, filter: 0.55, vocalCut: 0,
  },
  {
    id: "builtin-salsa-montuno",
    name: "Montuno Echo",
    description: "Echo corto sobre piano y coros para el montuno.",
    emoji: "🎹", builtin: true, category: "salsa",
    hi: 0.15, mid: 0.2, lo: -0.05, filter: 0, vocalCut: 0,
    fx: { slot: 1, kind: "echo", wet: 0.4, param1: 0.4, param2: 0.55 },
  },

  // ===== BACHATA =====
  {
    id: "builtin-bachata-romance",
    name: "Bachata Romance",
    description: "Medios cálidos y reverb suave. Guitarras al frente.",
    emoji: "🌹", builtin: true, category: "bachata",
    hi: 0.1, mid: 0.3, lo: -0.1, filter: 0, vocalCut: 0,
    fx: { slot: 1, kind: "reverb", wet: 0.35, param1: 0.55, param2: 0.5 },
  },
  {
    id: "builtin-bachata-urbana",
    name: "Bachata Urbana",
    description: "Sub graves marcados y voz brillante estilo moderno.",
    emoji: "🎶", builtin: true, category: "bachata",
    hi: 0.25, mid: 0.15, lo: 0.45, filter: 0, vocalCut: 0,
  },
  {
    id: "builtin-bachata-instrumental",
    name: "Bachata Sin Voz",
    description: "Quita la voz para mezclar con otra pista vocal.",
    emoji: "🎸", builtin: true, category: "bachata",
    hi: 0, mid: -0.1, lo: 0, filter: 0, vocalCut: 0.9,
  },

  // ===== CUMBIA =====
  {
    id: "builtin-cumbia-fiesta",
    name: "Cumbia Fiesta",
    description: "Bajos redondos y medios cálidos. Acordeón y güira al frente.",
    emoji: "🪗", builtin: true, category: "cumbia",
    hi: 0.15, mid: 0.3, lo: 0.35, filter: 0, vocalCut: 0,
  },
  {
    id: "builtin-cumbia-sonidera",
    name: "Sonidera Echo",
    description: "Echo largo estilo sonidero mexicano.",
    emoji: "📢", builtin: true, category: "cumbia",
    hi: 0.1, mid: 0.1, lo: 0.1, filter: 0, vocalCut: 0,
    fx: { slot: 1, kind: "echo", wet: 0.55, param1: 0.6, param2: 0.6 },
  },
  {
    id: "builtin-cumbia-villera",
    name: "Cumbia Villera",
    description: "Bajos secos y agudos brillantes. Beat callejero.",
    emoji: "🔥", builtin: true, category: "cumbia",
    hi: 0.3, mid: 0, lo: 0.4, filter: 0, vocalCut: 0,
  },

  // ===== MERENGUE =====
  {
    id: "builtin-merengue-perico",
    name: "Perico Ripiao",
    description: "Agudos brillantes para güira y acordeón merenguero.",
    emoji: "🎉", builtin: true, category: "merengue",
    hi: 0.4, mid: 0.25, lo: 0.05, filter: 0, vocalCut: 0,
  },
  {
    id: "builtin-merengue-pista",
    name: "Pista Caliente",
    description: "Bajos firmes y medios potentes para la pista.",
    emoji: "🕺", builtin: true, category: "merengue",
    hi: 0.2, mid: 0.35, lo: 0.4, filter: 0, vocalCut: 0,
  },

  // ===== DANCEHALL =====
  {
    id: "builtin-dancehall-riddim",
    name: "Riddim Pesado",
    description: "Sub graves enormes para el riddim jamaicano.",
    emoji: "🇯🇲", builtin: true, category: "dancehall",
    hi: 0, mid: -0.15, lo: 0.7, filter: 0, vocalCut: 0,
  },
  {
    id: "builtin-dancehall-dub",
    name: "Dub Echo",
    description: "Echo largo y reverb dub clásico.",
    emoji: "🔊", builtin: true, category: "dancehall",
    hi: 0.1, mid: -0.1, lo: 0.3, filter: 0, vocalCut: 0,
    fx: { slot: 1, kind: "echo", wet: 0.6, param1: 0.6, param2: 0.7 },
  },
  {
    id: "builtin-dancehall-sirena",
    name: "Air Horn FX",
    description: "Filtro pasa-altos para tensión antes del drop dancehall.",
    emoji: "📣", builtin: true, category: "dancehall",
    hi: 0.3, mid: 0.1, lo: -0.9, filter: 0.6, vocalCut: 0,
  },

  // ===== K-POP =====
  {
    id: "builtin-kpop-shine",
    name: "K-Pop Shine",
    description: "Agudos cristalinos y voz al frente. Sonido idol.",
    emoji: "💖", builtin: true, category: "kpop",
    hi: 0.4, mid: 0.3, lo: 0.05, filter: 0, vocalCut: 0,
  },
  {
    id: "builtin-kpop-drop",
    name: "K-Pop Drop",
    description: "Bajos potentes para el drop estilo hyperpop coreano.",
    emoji: "⚡", builtin: true, category: "kpop",
    hi: 0.25, mid: 0, lo: 0.55, filter: 0, vocalCut: 0,
  },
  {
    id: "builtin-kpop-build",
    name: "K-Pop Build",
    description: "Pasa-altos progresivo antes del coro.",
    emoji: "🚀", builtin: true, category: "kpop",
    hi: 0.2, mid: 0.05, lo: -0.85, filter: 0.55, vocalCut: 0,
  },

  // ===== R&B / SOUL =====
  {
    id: "builtin-rnb-smooth",
    name: "Smooth R&B",
    description: "Cálido y suave. Voz aterciopelada al frente.",
    emoji: "🍷", builtin: true, category: "rnb",
    hi: 0.15, mid: 0.35, lo: 0.1, filter: 0, vocalCut: 0,
  },
  {
    id: "builtin-rnb-soul-reverb",
    name: "Soul Reverb",
    description: "Reverb amplio sobre voz y arreglos cálidos.",
    emoji: "🎙️", builtin: true, category: "rnb",
    hi: 0.1, mid: 0.25, lo: 0, filter: 0, vocalCut: 0,
    fx: { slot: 1, kind: "reverb", wet: 0.45, param1: 0.65, param2: 0.5 },
  },
  {
    id: "builtin-rnb-bedroom",
    name: "Bedroom Vibes",
    description: "Lo-fi suave, sin agudos crispy. Atmósfera íntima.",
    emoji: "🌙", builtin: true, category: "rnb",
    hi: -0.35, mid: 0.15, lo: 0.2, filter: -0.1, vocalCut: 0,
  },

  // ===== JAZZ =====
  {
    id: "builtin-jazz-club",
    name: "Jazz Club",
    description: "Cálido y vintage. Atmósfera de club nocturno.",
    emoji: "🎷", builtin: true, category: "jazz",
    hi: -0.15, mid: 0.3, lo: 0.15, filter: 0, vocalCut: 0,
  },
  {
    id: "builtin-jazz-vinyl",
    name: "Vinyl Vintage",
    description: "Sin agudos extremos. Sonido a disco antiguo.",
    emoji: "💿", builtin: true, category: "jazz",
    hi: -0.5, mid: 0.2, lo: -0.1, filter: 0.2, vocalCut: 0,
  },
  {
    id: "builtin-jazz-trio",
    name: "Trio Acústico",
    description: "Medios al frente para piano, contrabajo y batería.",
    emoji: "🎹", builtin: true, category: "jazz",
    hi: 0.05, mid: 0.4, lo: 0.05, filter: 0, vocalCut: 0,
  },

  // ===== COUNTRY =====
  {
    id: "builtin-country-road",
    name: "Country Road",
    description: "Cálido y natural. Guitarras acústicas brillantes.",
    emoji: "🤠", builtin: true, category: "country",
    hi: 0.2, mid: 0.3, lo: 0, filter: 0, vocalCut: 0,
  },
  {
    id: "builtin-country-honky",
    name: "Honky Tonk",
    description: "Vintage rock-country. Medios fuertes.",
    emoji: "🎻", builtin: true, category: "country",
    hi: -0.1, mid: 0.4, lo: 0.15, filter: 0, vocalCut: 0,
  },

  // ===== INDIE / ALTERNATIVE =====
  {
    id: "builtin-indie-dream",
    name: "Dream Pop",
    description: "Reverb amplio + medios suaves. Atmósfera shoegaze.",
    emoji: "☁️", builtin: true, category: "indie",
    hi: 0.15, mid: -0.2, lo: -0.05, filter: 0, vocalCut: 0,
    fx: { slot: 1, kind: "reverb", wet: 0.55, param1: 0.75, param2: 0.5 },
  },
  {
    id: "builtin-indie-garage",
    name: "Garage Rock",
    description: "Sucio y crudo. Medios y agudos al frente.",
    emoji: "🎸", builtin: true, category: "indie",
    hi: 0.35, mid: 0.4, lo: -0.1, filter: 0, vocalCut: 0,
  },
  {
    id: "builtin-indie-lofi",
    name: "Lo-Fi Chill",
    description: "Sin agudos extremos. Tono cálido para chillout.",
    emoji: "🍵", builtin: true, category: "indie",
    hi: -0.4, mid: 0.1, lo: 0.1, filter: -0.1, vocalCut: 0,
  },

  // ===== AFROBEAT =====
  {
    id: "builtin-afro-rhythm",
    name: "Afro Rhythm",
    description: "Bajos potentes y percusión brillante. Groove afro.",
    emoji: "🥁", builtin: true, category: "afrobeat",
    hi: 0.25, mid: 0.15, lo: 0.5, filter: 0, vocalCut: 0,
  },
  {
    id: "builtin-afro-amapiano",
    name: "Amapiano Log",
    description: "Sub bajo profundo estilo log drum sudafricano.",
    emoji: "🌍", builtin: true, category: "afrobeat",
    hi: 0.1, mid: -0.1, lo: 0.65, filter: 0, vocalCut: 0,
  },
  {
    id: "builtin-afro-dance",
    name: "Afro Dance",
    description: "Pasa-altos para tensión antes del drop afrohouse.",
    emoji: "💥", builtin: true, category: "afrobeat",
    hi: 0.3, mid: 0.05, lo: -0.85, filter: 0.55, vocalCut: 0,
  },

  // ===== FUNK / DISCO =====
  {
    id: "builtin-funk-groove",
    name: "Funk Groove",
    description: "Bajos al frente y medios cálidos. Bass slap brillante.",
    emoji: "🕺", builtin: true, category: "funk",
    hi: 0.2, mid: 0.3, lo: 0.45, filter: 0, vocalCut: 0,
  },
  {
    id: "builtin-funk-disco",
    name: "Disco Shine",
    description: "Agudos cristalinos para hi-hats y strings disco.",
    emoji: "🪩", builtin: true, category: "funk",
    hi: 0.45, mid: 0.2, lo: 0.15, filter: 0, vocalCut: 0,
  },
  {
    id: "builtin-funk-filter",
    name: "Funk Filter",
    description: "Filtro animado estilo French Touch / Daft Punk.",
    emoji: "🤖", builtin: true, category: "funk",
    hi: 0.15, mid: 0.1, lo: 0.1, filter: -0.3, vocalCut: 0,
    fx: { slot: 2, kind: "flanger", wet: 0.4, param1: 0.4, param2: 0.55 },
  },

  // ===== REGGAE =====
  {
    id: "builtin-reggae-roots",
    name: "Roots Reggae",
    description: "Bajos cálidos, agudos suaves. Skank de guitarra al frente.",
    emoji: "🟢", builtin: true, category: "reggae",
    hi: -0.15, mid: 0.25, lo: 0.45, filter: 0, vocalCut: 0,
  },
  {
    id: "builtin-reggae-dub-echo",
    name: "Dub Echo",
    description: "Echo largo y reverb amplio estilo dub jamaicano.",
    emoji: "🌬️", builtin: true, category: "reggae",
    hi: 0.1, mid: -0.1, lo: 0.3, filter: 0, vocalCut: 0,
    fx: { slot: 1, kind: "echo", wet: 0.6, param1: 0.65, param2: 0.7 },
  },
  {
    id: "builtin-reggae-skank",
    name: "Skank Cut",
    description: "Pasa-altos para resaltar el skank y sacar el bajo.",
    emoji: "🎸", builtin: true, category: "reggae",
    hi: 0.25, mid: 0.15, lo: -0.85, filter: 0.5, vocalCut: 0,
  },
  {
    id: "builtin-reggae-instrumental",
    name: "Riddim Sin Voz",
    description: "Quita la voz para mezclar dos riddims sin chocar.",
    emoji: "🎚️", builtin: true, category: "reggae",
    hi: 0, mid: -0.15, lo: 0.2, filter: 0, vocalCut: 0.9,
  },
];

export function genPresetId(): string {
  return "user-" + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}