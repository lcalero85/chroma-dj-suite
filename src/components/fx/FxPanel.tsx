import { useEffect, useRef } from "react";
import { useApp } from "@/state/store";
import { Knob } from "../console/Knob";
import { createFxRack, setFxKind, setFxMix, setFxParam, type FxKind, type FxRackHandles } from "@/audio/fx";
import { getEngine } from "@/audio/engine";
import { useT, type DictKey } from "@/lib/i18n";

const KINDS: FxKind[] = [
  "off", "reverb", "delay", "echo", "filter", "flanger", "phaser",
  "chorus", "tremolo", "autopan", "wahwah", "ringmod", "bitcrusher", "lofi", "gate",
];
const KIND_KEY: Record<FxKind, DictKey> = {
  off: "fxKindOff",
  reverb: "fxKindReverb",
  delay: "fxKindDelay",
  filter: "fxKindFilter",
  flanger: "fxKindFlanger",
  phaser: "fxKindPhaser",
  bitcrusher: "fxKindBitcrusher",
  echo: "fxKindEcho",
  gate: "fxKindGate",
  tremolo: "fxKindTremolo",
  autopan: "fxKindAutoPan",
  ringmod: "fxKindRingMod",
  chorus: "fxKindChorus",
  wahwah: "fxKindWahWah",
  lofi: "fxKindLoFi",
};

export function FxPanel() {
  const t = useT();
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
                  {t(KIND_KEY[k])}
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
              label={t("fxParam1")}
              size={48}
            />
            <Knob
              value={fx.param2}
              onChange={(v) => {
                useApp.getState().updateFx(fx.id, { param2: v });
                if (racks.current[fx.id]) setFxParam(racks.current[fx.id], 2, mapParam(fx.kind, 2, v));
              }}
              label={t("fxParam2")}
              size={48}
            />
            <Knob
              value={fx.wet}
              onChange={(v) => {
                useApp.getState().updateFx(fx.id, { wet: v });
                if (racks.current[fx.id]) setFxMix(racks.current[fx.id], v);
              }}
              label={t("fxMix")}
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
            {t("fxOnOff")}
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
    case "tremolo":
      return which === 1 ? 0.5 + v * 12 : v;          // p1 = rate Hz, p2 = depth 0..1
    case "autopan":
      return which === 1 ? 0.1 + v * 6 : v;           // p1 = rate Hz, p2 = depth 0..1
    case "ringmod":
      return which === 1 ? 30 + v * v * 1500 : v;     // p1 = carrier Hz, p2 = depth
    case "chorus":
      return which === 1 ? 0.1 + v * 3 : 0.001 + v * 0.012; // p1 = LFO Hz, p2 = depth s
    case "wahwah":
      return which === 1 ? 0.2 + v * 6 : 100 + v * 1500;    // p1 = sweep Hz, p2 = depth Hz
    case "lofi":
      return which === 1 ? 1500 + (1 - v) * 5500 : 80 + v * 600; // p1 = LP Hz (more = darker), p2 = HP Hz
    case "reverb":
    default:
      return v;
  }
}