import { useState } from "react";
import { useApp, type DeckId } from "@/state/store";
import { applyMixPreset, captureMixPreset, deleteMixPreset, resetDefaultMixPresets } from "@/state/controller";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { CATEGORY_ORDER, type PresetCategory } from "@/lib/mixPresets";
import { useT } from "@/lib/i18n";
import type { DictKey } from "@/lib/i18n/dict";

/** Map a builtin preset id to its base i18n key (e.g. "builtin-lp-intro" → "preset_lp_intro"). */
function presetI18nBase(id: string): string {
  return "preset_" + id.replace(/^builtin-/, "").replace(/-/g, "_");
}

const CATEGORY_KEY: Record<PresetCategory, DictKey> = {
  general: "catGeneral",
  reggaeton: "catReggaeton",
  pop: "catPop",
  electronica: "catElectronica",
  rap: "catRap",
  rock: "catRock",
};

/**
 * Mix Presets — quick DJ recipes.
 * The user picks a target deck (A/B/C/D) and clicks a preset card to apply it.
 * They can capture the current deck state as a new preset, delete custom ones,
 * and reset the 5 built-in defaults at any time.
 */
export function MixPresetsPanel() {
  const t = useT();
  const labelFor = (cat: PresetCategory) => t(CATEGORY_KEY[cat]);
  // Resolve a built-in preset's name/description via the dictionary; fall back
  // to the stored Spanish copy for user presets or unknown ids.
  const resolveName = (p: { id: string; name: string; builtin?: boolean }) => {
    if (!p.builtin) return p.name;
    const k = `${presetI18nBase(p.id)}_name` as DictKey;
    const v = t(k);
    return v === k ? p.name : v;
  };
  const resolveDesc = (p: { id: string; description: string; builtin?: boolean }) => {
    if (!p.builtin) return p.description;
    const k = `${presetI18nBase(p.id)}_desc` as DictKey;
    const v = t(k);
    return v === k ? p.description : v;
  };
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
        <span className="vdj-label">{t("presetsApplyTo")}</span>
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
          placeholder={t("presetsNewName")}
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
          title={t("presetsCaptureTip")}
        >
          <Plus size={12} /> {t("presetsCaptureBtn", { deck: target })}
        </button>
        <button className="vdj-btn" onClick={resetDefaultMixPresets} title={t("presetsResetTip")}>
          <RotateCcw size={12} /> {t("presetsResetBtn")}
        </button>
      </div>

      {/* Category filter chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        <button className="vdj-btn" data-active={filter === "all"} onClick={() => setFilter("all")}>
          {t("presetsAll")}
        </button>
        {CATEGORY_ORDER.map((cat) => {
          const count = grouped.get(cat)?.length ?? 0;
          if (count === 0) return null;
          return (
            <button key={cat} className="vdj-btn" data-active={filter === cat} onClick={() => setFilter(cat)}>
              {labelFor(cat)} <span style={{ opacity: 0.6 }}>({count})</span>
            </button>
          );
        })}
        {userCreated.length > 0 && (
          <button className="vdj-btn" data-active={filter === "user"} onClick={() => setFilter("user")}>
            {t("presetsMine")} <span style={{ opacity: 0.6 }}>({userCreated.length})</span>
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
              if (items.length) sections.push({ key: cat, label: labelFor(cat), items });
            }
          }
          if (userCreated.length && (filter === "all" || filter === "user")) {
            sections.push({ key: "user", label: t("presetsMine"), items: userCreated });
          }
        } else {
          const items = grouped.get(filter) ?? [];
          sections.push({ key: filter, label: labelFor(filter), items });
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
                      <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{resolveName(p)}</div>
                      <div style={{ fontSize: 10, color: "var(--text-3)" }}>{p.builtin ? t("presetsDefaultBadge") : t("presetsUserBadge")}</div>
                    </div>
                    {!p.builtin && (
                      <button
                        className="vdj-btn"
                        data-tone="danger"
                        onClick={() => deleteMixPreset(p.id)}
                        title={t("presetsDeleteTip")}
                        style={{ padding: "4px 6px" }}
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-2)", minHeight: 30, lineHeight: 1.35 }}>
                    {resolveDesc(p)}
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
                    {t("presetsApplyBtn", { deck: target })}
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