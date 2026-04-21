import { useEffect, useState } from "react";
import { useApp } from "@/state/store";
import { SHORTCUT_DEFS, defaultShortcutMap, formatKeyCode, resolveShortcuts } from "@/lib/shortcutDefs";
import { RotateCcw, Keyboard, X } from "lucide-react";
import { toast } from "sonner";

/** Captures the next KeyboardEvent.code globally and calls onCapture. */
function useKeyCapture(active: boolean, onCapture: (code: string) => void) {
  useEffect(() => {
    if (!active) return;
    (window as unknown as { __vdjShortcutCapturing?: boolean }).__vdjShortcutCapturing = true;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        onCapture("");
        return;
      }
      // Ignore pure modifier presses
      if (e.code === "ShiftLeft" || e.code === "ControlLeft" || e.code === "ControlRight" ||
          e.code === "AltLeft" || e.code === "AltRight" || e.code === "MetaLeft" || e.code === "MetaRight") {
        return;
      }
      onCapture(e.code);
    };
    window.addEventListener("keydown", handler, true);
    return () => {
      window.removeEventListener("keydown", handler, true);
      (window as unknown as { __vdjShortcutCapturing?: boolean }).__vdjShortcutCapturing = false;
    };
  }, [active, onCapture]);
}

export function ShortcutsSettings() {
  const settings = useApp((s) => s.settings);
  const update = useApp((s) => s.updateSettings);
  const map = resolveShortcuts(settings.shortcuts);
  const [capturing, setCapturing] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const setCode = (id: string, code: string) => {
    const next = { ...map, [id]: code };
    update({ shortcuts: next });
  };

  useKeyCapture(capturing !== null, (code) => {
    if (!capturing) return;
    if (code === "") { setCapturing(null); return; }
    // Detect duplicate assignment (excluding self)
    const conflict = Object.entries(map).find(([k, v]) => k !== capturing && v === code);
    if (conflict) {
      const def = SHORTCUT_DEFS.find((d) => d.id === conflict[0]);
      toast.warning(`Tecla en uso por: ${def?.label ?? conflict[0]}. Reasignada.`);
      // Clear the conflicting binding so the new one wins.
      const next = { ...map, [conflict[0]]: "", [capturing]: code };
      update({ shortcuts: next });
    } else {
      setCode(capturing, code);
    }
    setCapturing(null);
  });

  const resetAll = () => {
    update({ shortcuts: defaultShortcutMap() });
    toast.success("Atajos restablecidos");
  };

  const resetOne = (id: string) => {
    const def = SHORTCUT_DEFS.find((d) => d.id === id);
    if (!def) return;
    setCode(id, def.default);
  };

  const groups = Array.from(new Set(SHORTCUT_DEFS.map((d) => d.group)));
  const visible = (id: string, label: string) =>
    !filter || id.toLowerCase().includes(filter.toLowerCase()) || label.toLowerCase().includes(filter.toLowerCase());

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          <Keyboard size={14} style={{ color: "var(--accent)" }} /> Atajos configurables
        </div>
        <button className="vdj-btn" onClick={resetAll} title="Restablecer todos">
          <RotateCcw size={11} /> Reset
        </button>
      </div>
      <input
        type="text"
        placeholder="Filtrar acciones…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="vdj-btn"
        style={{ padding: "6px 8px", textAlign: "left" }}
      />
      {capturing && (
        <div className="vdj-panel-inset" style={{ padding: 8, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span>Pulsa una tecla para asignar a <b>{SHORTCUT_DEFS.find((d) => d.id === capturing)?.label}</b>… (Esc para cancelar)</span>
          <button className="vdj-btn" onClick={() => setCapturing(null)}><X size={11} /></button>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 360, overflow: "auto" }}>
        {groups.map((g) => {
          const rows = SHORTCUT_DEFS.filter((d) => d.group === g && visible(d.id, d.label));
          if (!rows.length) return null;
          return (
            <div key={g}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
                {g}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {rows.map((d) => {
                  const code = map[d.id] ?? "";
                  const isCap = capturing === d.id;
                  return (
                    <div key={d.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 11 }}>
                      <span style={{ color: "var(--text-2)", flex: 1 }}>{d.label}{d.shift ? " (Shift)" : ""}</span>
                      <button
                        className="vdj-btn"
                        data-active={isCap}
                        onClick={() => setCapturing(isCap ? null : d.id)}
                        style={{ minWidth: 110, fontFamily: "var(--font-mono)" }}
                        title={`Click para reasignar (actual: ${code || "ninguna"})`}
                      >
                        {isCap ? "Pulsa tecla…" : code ? formatKeyCode(code) : "—"}
                      </button>
                      <button className="vdj-btn" onClick={() => resetOne(d.id)} title="Restablecer al valor por defecto">
                        <RotateCcw size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}