import { X, Keyboard } from "lucide-react";
import { useEffect } from "react";
import { useApp } from "@/state/store";
import { SHORTCUT_DEFS, formatKeyCode, resolveShortcuts } from "@/lib/shortcutDefs";
import { useT } from "@/lib/i18n";

export function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  const t = useT();
  const settings = useApp((s) => s.settings);
  const map = resolveShortcuts(settings.shortcuts);
  const groups = Array.from(new Set(SHORTCUT_DEFS.map((d) => d.group)));
  const SECTIONS = groups.map((g) => ({
    title: g,
    rows: SHORTCUT_DEFS.filter((d) => d.group === g).map((d) => ({
      keys: (d.shift ? "Shift+" : "") + (map[d.id] ? formatKeyCode(map[d.id]) : "—"),
      desc: d.label,
    })),
  }));

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
            {t("shortcutsTitle")}
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
          {t("shortcutsFooter")}
        </div>
      </div>
    </div>
  );
}