import { X, Keyboard } from "lucide-react";
import { useEffect } from "react";

const SECTIONS: { title: string; rows: { keys: string; desc: string }[] }[] = [
  {
    title: "Decks & playback",
    rows: [
      { keys: "Space", desc: "Play / Pause Deck A" },
      { keys: "Shift Right / J", desc: "Play / Pause Deck A (J) o Deck B (Shift)" },
      { keys: "L", desc: "Play / Pause Deck B" },
      { keys: "Q / W", desc: "Cue Deck A / Deck B" },
      { keys: "A / S", desc: "Sync Deck A / Deck B" },
      { keys: "O / U", desc: "Brake / Stop Deck A" },
      { keys: "B / V (+Shift)", desc: "Brake / Reverse — A o B" },
    ],
  },
  {
    title: "Mezcla",
    rows: [
      { keys: "M", desc: "Auto-mix (8s) entre decks" },
      { keys: "T", desc: "Tap tempo" },
      { keys: "R", desc: "Iniciar/parar grabación" },
      { keys: "N", desc: "Voice-over ON/OFF" },
      { keys: "Shift+L", desc: "Radio: siguiente pista" },
      { keys: "`", desc: "Alternar deck destino del numpad (A↔B)" },
    ],
  },
  {
    title: "Hot cues & loops",
    rows: [
      { keys: "1..8", desc: "Hot cues Deck A (Shift = Deck B)" },
      { keys: "[ / ]", desc: "Beat jump Deck A ±4" },
      { keys: "; / '", desc: "Beat jump Deck B ±4" },
    ],
  },
  {
    title: "Numpad (deck activo)",
    rows: [
      { keys: "Num 1..8", desc: "Hot cues (Shift = otro deck)" },
      { keys: "Num 9 / 0", desc: "Loop 4 beats / toggle loop" },
      { keys: "Num + / −", desc: "Sampler pad 1 / 2" },
      { keys: "Num * / /", desc: "FX 1 / FX 2 toggle" },
      { keys: "Num Enter", desc: "Rec start / stop" },
    ],
  },
  {
    title: "Interfaz",
    rows: [{ keys: "?", desc: "Mostrar / ocultar este panel" }],
  },
];

export function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999,
        background: "color-mix(in oklab, black 70%, transparent)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="vdj-panel"
        style={{
          width: "min(960px, 100%)",
          maxHeight: "85vh",
          overflow: "auto",
          padding: 20,
          borderRadius: 12,
          background: "var(--surface-1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            <Keyboard size={16} style={{ color: "var(--accent)" }} />
            Atajos de teclado
          </div>
          <button className="vdj-btn" onClick={onClose}>
            <X size={12} /> ESC
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {SECTIONS.map((s) => (
            <div key={s.title} className="vdj-panel-inset" style={{ padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                {s.title}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {s.rows.map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                    <kbd
                      style={{
                        padding: "2px 8px",
                        background: "var(--surface-3)",
                        borderRadius: 4,
                        border: "1px solid var(--line)",
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        minWidth: 100,
                        textAlign: "center",
                        color: "var(--text-1)",
                      }}
                    >
                      {r.keys}
                    </kbd>
                    <span style={{ color: "var(--text-2)" }}>{r.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 10, color: "var(--text-3)", textAlign: "center" }}>
          Pulsa <b>?</b> en cualquier momento para mostrar/ocultar este panel · ESC para cerrar
        </div>
      </div>
    </div>
  );
}