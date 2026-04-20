import { useEffect, useRef } from "react";
import { useApp } from "@/state/store";
import { Knob } from "../console/Knob";
import { createFxRack, setFxKind, setFxMix, setFxParam, type FxKind, type FxRackHandles } from "@/audio/fx";
import { getEngine } from "@/audio/engine";

const KINDS: FxKind[] = ["off", "reverb", "delay", "filter", "flanger", "phaser", "bitcrusher", "echo", "gate"];

export function FxPanel() {
  const fxs = useApp((s) => s.fx);
  const racks = useRef<Record<number, FxRackHandles>>({});

  useEffect(() => {
    const { masterDuck, limiter } = getEngine();
    // Build 3 racks chained on master send
    if (Object.keys(racks.current).length === 0) {
      [1, 2, 3].forEach((id) => {
        const r = createFxRack();
        racks.current[id] = r;
        // Parallel send: tap post-duck master, return wet into limiter input
        // (avoids feedback loop while still going through recorder tap downstream)
        masterDuck.connect(r.input);
        r.output.connect(limiter);
      });
      // Expose for keyboard shortcuts
      window.__vdjFxRacks = racks.current;
    }
    return () => {
      // keep alive across renders
    };
  }, []);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, height: "100%" }}>
      {fxs.map((fx) => (
        <div key={fx.id} className="vdj-panel-inset" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="vdj-label">FX {fx.id}</span>
            <select
              className="vdj-btn"
              style={{ fontSize: 11, padding: "4px 6px" }}
              value={fx.kind}
              onChange={(e) => {
                const k = e.target.value as FxKind;
                useApp.getState().updateFx(fx.id, { kind: k });
                if (racks.current[fx.id]) setFxKind(racks.current[fx.id], k);
              }}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", justifyContent: "space-around", paddingTop: 6 }}>
            <Knob
              value={fx.param1}
              onChange={(v) => {
                useApp.getState().updateFx(fx.id, { param1: v });
                if (racks.current[fx.id]) setFxParam(racks.current[fx.id], 1, mapParam(fx.kind, 1, v));
              }}
              label="P1"
              size={48}
            />
            <Knob
              value={fx.param2}
              onChange={(v) => {
                useApp.getState().updateFx(fx.id, { param2: v });
                if (racks.current[fx.id]) setFxParam(racks.current[fx.id], 2, mapParam(fx.kind, 2, v));
              }}
              label="P2"
              size={48}
            />
            <Knob
              value={fx.wet}
              onChange={(v) => {
                useApp.getState().updateFx(fx.id, { wet: v });
                if (racks.current[fx.id]) setFxMix(racks.current[fx.id], v);
              }}
              label="MIX"
              size={48}
            />
          </div>
          <button
            className="vdj-btn"
            data-active={fx.wet > 0.05 && fx.kind !== "off"}
            onClick={() => {
              const next = fx.wet > 0.05 ? 0 : 0.5;
              useApp.getState().updateFx(fx.id, { wet: next });
              if (racks.current[fx.id]) setFxMix(racks.current[fx.id], next);
            }}
          >
            ON / OFF
          </button>
        </div>
      ))}
    </div>
  );
}

function mapParam(kind: FxKind, which: 1 | 2, v: number): number {
  switch (kind) {
    case "delay":
    case "echo":
      return which === 1 ? 0.05 + v * 1.5 : v * 0.85;
    case "filter":
      return which === 1 ? 80 + v * v * 8000 : 0.5 + v * 14;
    case "flanger":
      return which === 1 ? 0.05 + v * 4 : v * 0.9;
    case "phaser":
      return which === 1 ? 0.1 + v * 4 : 200 + v * 1500;
    case "bitcrusher":
      return which === 1 ? Math.max(2, Math.round(2 + v * 14)) : 0.5 + v * 4;
    case "gate":
      return which === 1 ? 1 + v * 16 : v;
    case "reverb":
    default:
      return v;
  }
}