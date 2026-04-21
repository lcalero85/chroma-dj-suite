import { useState } from "react";
import { useApp, type DeckId } from "@/state/store";
import { applyMixPreset, captureMixPreset, deleteMixPreset, resetDefaultMixPresets } from "@/state/controller";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_ORDER, type PresetCategory } from "@/lib/mixPresets";

/**
 * Mix Presets — quick DJ recipes.
 * The user picks a target deck (A/B/C/D) and clicks a preset card to apply it.
 * They can capture the current deck state as a new preset, delete custom ones,
 * and reset the 5 built-in defaults at any time.
 */
export function MixPresetsPanel() {
  const presets = useApp((s) => s.mixPresets);
  const activeDecks = useApp((s) => s.activeDecks);
  const [target, setTarget] = useState<DeckId>(activeDecks[0] ?? "A");
  const [newName, setNewName] = useState("");
  const [filter, setFilter] = useState<PresetCategory | "all" | "user">("all");

  // Group presets by category, preserving CATEGORY_ORDER. Unknown categories
  // (e.g. user-created without one) fall back into "general".
  const grouped = new Map<PresetCategory, typeof presets>();
  for (const cat of CATEGORY_ORDER) grouped.set(cat, []);
  const userCreated: typeof presets = [];
  for (const p of presets) {
    if (!p.builtin) {
      userCreated.push(p);
      continue;
    }
    const cat: PresetCategory = (p.category as PresetCategory) ?? "general";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(p);
  }

  return (
    <div className="vdj-scroll" style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", overflowY: "auto", padding: 4 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        <span className="vdj-label">Aplicar a Deck</span>
        <div style={{ display: "flex", gap: 4 }}>
          {(["A", "B", "C", "D"] as DeckId[]).map((d) => (
            <button
              key={d}
              className="vdj-btn"
              data-active={target === d}
              onClick={() => setTarget(d)}
              disabled={!activeDecks.includes(d)}
              style={{ minWidth: 36 }}
            >
              {d}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <input
          type="text"
          placeholder="Nombre del nuevo preset"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="vdj-btn"
          style={{ width: 200, textAlign: "left", padding: "6px 8px" }}
        />
        <button
          className="vdj-btn"
          onClick={() => {
            captureMixPreset(target, newName);
            setNewName("");
          }}
          title="Captura el EQ/Filter/FX actual del deck como preset"
        >
          <Plus size={12} /> Capturar Deck {target}
        </button>
        <button className="vdj-btn" onClick={resetDefaultMixPresets} title="Restaurar los 5 presets por defecto">
          <RotateCcw size={12} /> Reset
        </button>
      </div>

      {/* Category filter chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        <button className="vdj-btn" data-active={filter === "all"} onClick={() => setFilter("all")}>
          Todos
        </button>
        {CATEGORY_ORDER.map((cat) => {
          const count = grouped.get(cat)?.length ?? 0;
          if (count === 0) return null;
          return (
            <button key={cat} className="vdj-btn" data-active={filter === cat} onClick={() => setFilter(cat)}>
              {CATEGORY_LABELS[cat]} <span style={{ opacity: 0.6 }}>({count})</span>
            </button>
          );
        })}
        {userCreated.length > 0 && (
          <button className="vdj-btn" data-active={filter === "user"} onClick={() => setFilter("user")}>
            Mis Presets <span style={{ opacity: 0.6 }}>({userCreated.length})</span>
          </button>
        )}
      </div>

      {/* Grouped sections */}
      {(() => {
        const sections: { key: string; label: string; items: typeof presets }[] = [];
        if (filter === "all" || filter === "user") {
          if (filter === "all") {
            for (const cat of CATEGORY_ORDER) {
              const items = grouped.get(cat) ?? [];
              if (items.length) sections.push({ key: cat, label: CATEGORY_LABELS[cat], items });
            }
          }
          if (userCreated.length && (filter === "all" || filter === "user")) {
            sections.push({ key: "user", label: "Mis Presets", items: userCreated });
          }
        } else {
          const items = grouped.get(filter) ?? [];
          sections.push({ key: filter, label: CATEGORY_LABELS[filter], items });
        }
        return sections.map((sec) => (
          <div key={sec.key} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
              <span className="vdj-label" style={{ fontWeight: 700, letterSpacing: 1 }}>
                {sec.label.toUpperCase()}
              </span>
              <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
              {sec.items.map((p) => (
                <div key={p.id} className="vdj-panel-inset" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: 22 }}>{p.emoji}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                      <div style={{ fontSize: 10, color: "var(--text-3)" }}>{p.builtin ? "DEFAULT" : "USER"}</div>
                    </div>
                    {!p.builtin && (
                      <button
                        className="vdj-btn"
                        data-tone="danger"
                        onClick={() => deleteMixPreset(p.id)}
                        title="Eliminar preset"
                        style={{ padding: "4px 6px" }}
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-2)", minHeight: 30, lineHeight: 1.35 }}>
                    {p.description}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, fontSize: 10 }}>
                    {typeof p.hi === "number" && <span className="vdj-chip">HI {fmt(p.hi)}</span>}
                    {typeof p.mid === "number" && <span className="vdj-chip">MID {fmt(p.mid)}</span>}
                    {typeof p.lo === "number" && <span className="vdj-chip">LO {fmt(p.lo)}</span>}
                    {typeof p.filter === "number" && Math.abs(p.filter) > 0.02 && <span className="vdj-chip">FILT {fmt(p.filter)}</span>}
                    {typeof p.vocalCut === "number" && p.vocalCut > 0.02 && <span className="vdj-chip">VOX {Math.round(p.vocalCut * 100)}%</span>}
                    {p.fx && p.fx.kind !== "off" && <span className="vdj-chip">FX {p.fx.kind}</span>}
                  </div>
                  <button
                    className="vdj-btn"
                    data-active
                    onClick={() => applyMixPreset(p.id, target)}
                    style={{ marginTop: 4 }}
                  >
                    Aplicar a Deck {target}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ));
      })()}
    </div>
  );
}

function fmt(v: number) {
  const sign = v > 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(0)}`;
}