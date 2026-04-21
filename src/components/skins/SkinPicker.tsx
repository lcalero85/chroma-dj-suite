import { useApp, type SkinId } from "@/state/store";

const SKINS: { id: SkinId; name: string; desc: string }[] = [
  { id: "pioneer", name: "Pioneer Club", desc: "Negro + naranja, club-ready" },
  { id: "serato", name: "Serato Night", desc: "Oscuro neutro + cian" },
  { id: "neon", name: "Neon Miami", desc: "Retrowave magenta/cian" },
  { id: "glass", name: "Glassmorphism", desc: "Vidrio esmerilado" },
  { id: "minimal", name: "Minimal Mono", desc: "Greyscale puro" },
  { id: "retro", name: "Retro 80s", desc: "Madera + LEDs ámbar" },
  { id: "studio", name: "Studio White", desc: "Modo claro estudio" },
  { id: "cyber", name: "Cyberpunk", desc: "Magenta + lima" },
  { id: "vinyl", name: "Vinyl Warm", desc: "Sepia, papel cálido" },
  { id: "hacker", name: "Hacker Green", desc: "Terminal verde" },
  { id: "midnight", name: "Midnight Blue", desc: "Azul profundo nocturno" },
  { id: "sunset", name: "Sunset Vibes", desc: "Naranja + púrpura cálido" },
  { id: "arctic", name: "Arctic Ice", desc: "Blanco + azul hielo" },
  { id: "blood", name: "Blood Moon", desc: "Rojo intenso sobre negro" },
  { id: "gold", name: "Gold Master", desc: "Negro + dorado lujo" },
  { id: "ocean", name: "Deep Ocean", desc: "Turquesa abismal" },
  { id: "lava", name: "Lava Flow", desc: "Naranja incandescente" },
  { id: "forest", name: "Forest Deep", desc: "Verde bosque oscuro" },
  { id: "candy", name: "Candy Pop", desc: "Rosa y menta dulce" },
  { id: "matrix", name: "Matrix Rain", desc: "Verde digital sobre negro" },
  { id: "royal", name: "Royal Purple", desc: "Púrpura real elegante" },
];

export function SkinPicker() {
  const skin = useApp((s) => s.skin);
  const setSkin = useApp((s) => s.setSkin);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
      {SKINS.map((s) => (
        <button
          key={s.id}
          className="vdj-panel-inset"
          onClick={() => setSkin(s.id)}
          style={{
            textAlign: "left",
            padding: 10,
            cursor: "pointer",
            borderColor: skin === s.id ? "var(--accent)" : "var(--line)",
            boxShadow: skin === s.id ? "var(--beat-glow)" : "none",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 13 }}>{s.name}</div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{s.desc}</div>
        </button>
      ))}
    </div>
  );
}