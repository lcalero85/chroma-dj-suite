import { useApp, type SkinId } from "@/state/store";
import { useT, type DictKey } from "@/lib/i18n";

// Skin IDs are stable; user-facing name/description come from the dictionary
// via keys `skin_<id>_name` and `skin_<id>_desc`. This keeps the SkinPicker
// fully translated when the user changes language.
const SKIN_IDS: SkinId[] = [
  "pioneer", "serato", "neon", "glass", "minimal", "retro", "studio", "cyber",
  "vinyl", "hacker", "midnight", "sunset", "arctic", "blood", "gold", "ocean",
  "lava", "forest", "candy", "matrix", "royal", "bigjogs",
  "bigjogs-neon", "bigjogs-gold", "bigjogs-ocean", "bigjogs-blood", "bigjogs-forest",
  "xl-bubblegum", "xl-vaporwave", "xl-tropical", "xl-skater", "xl-icecream", "xl-galaxy",
];

export function SkinPicker() {
  const skin = useApp((s) => s.skin);
  const setSkin = useApp((s) => s.setSkin);
  const t = useT();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
      {SKIN_IDS.map((id) => (
        <button
          key={id}
          className="vdj-panel-inset"
          onClick={() => setSkin(id)}
          style={{
            textAlign: "left",
            padding: 10,
            cursor: "pointer",
            borderColor: skin === id ? "var(--accent)" : "var(--line)",
            boxShadow: skin === id ? "var(--beat-glow)" : "none",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 13 }}>{t(`skin_${id}_name` as DictKey)}</div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{t(`skin_${id}_desc` as DictKey)}</div>
        </button>
      ))}
    </div>
  );
}