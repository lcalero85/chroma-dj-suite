import { useEffect, useRef } from "react";
import { useApp } from "@/state/store";
import { Knob } from "../console/Knob";
import { createFxRack, setFxKind, setFxMix, setFxParam, type FxKind, type FxRackHandles } from "@/audio/fx";
import { getEngine } from "@/audio/engine";
import { useT, type DictKey } from "@/lib/i18n";
import { useState } from "react";
import { Save, Trash2, Activity } from "lucide-react";
import { toast } from "sonner";
import {
  loadFxChainPresets,
  saveUserFxChainPresets,
  fxPresetUid,
  type FxChainPreset,
} from "@/lib/fxPresets";

const KINDS: FxKind[] = [
  "off", "reverb", "delay", "echo", "filter", "flanger", "phaser",
  "chorus", "tremolo", "autopan", "wahwah", "ringmod", "bitcrusher", "lofi", "gate",
];

/** FX kinds whose param1 represents a time/rate that can be locked to the
 *  master deck's BPM. */
const BEAT_SYNCABLE: FxKind[] = [
  "delay", "echo", "flanger", "phaser", "gate", "tremolo",
  "autopan", "wahwah", "chorus", "ringmod",
];

const BEAT_DIVS: { v: number; key: DictKey }[] = [
  { v: 0.125, key: "fxBeats_1_8" },
  { v: 0.25,  key: "fxBeats_1_4" },
  { v: 0.5,   key: "fxBeats_1_2" },
  { v: 1,     key: "fxBeats_1" },
  { v: 2,     key: "fxBeats_2" },
  { v: 4,     key: "fxBeats_4" },
];

/** Convert a beat division at a given BPM into the natural param1 value
 *  expected by mapParam(). Returns the *normalized* (0..1) value the knob
 *  would have produced — so we feed it through mapParam below. */
function beatsToParam1(kind: FxKind, bpm: number, beats: number): number {
  const sec = (60 / bpm) * beats;       // beat duration in seconds
  const hz  = 1 / sec;                  // rate in Hz
  switch (kind) {
    case "delay":
    case "echo": {
      // mapParam: 0.05 + v * 1.5 → solve for v
      const v = (Math.min(1.55, sec) - 0.05) / 1.5;
      return Math.max(0, Math.min(1, v));
    }
    case "flanger": {
      // 0.05 + v * 4
      return Math.max(0, Math.min(1, (hz - 0.05) / 4));
    }
    case "phaser": {
      // 0.1 + v * 4
      return Math.max(0, Math.min(1, (hz - 0.1) / 4));
    }
    case "gate": {
      // 1 + v * 16
      return Math.max(0, Math.min(1, (hz - 1) / 16));
    }
    case "tremolo": {
      // 0.5 + v * 12
      return Math.max(0, Math.min(1, (hz - 0.5) / 12));
    }
    case "autopan": {
      // 0.1 + v * 6
      return Math.max(0, Math.min(1, (hz - 0.1) / 6));
    }
    case "wahwah": {
      // 0.2 + v * 6
      return Math.max(0, Math.min(1, (hz - 0.2) / 6));
    }
    case "chorus": {
      // 0.1 + v * 3
      return Math.max(0, Math.min(1, (hz - 0.1) / 3));
    }
    case "ringmod": {
      // 30 + v² * 1500 — use hz*32 carrier as a musical-ish offset
      const target = Math.min(1500, hz * 32);
      return Math.max(0, Math.min(1, Math.sqrt(target / 1500)));
    }
    default:
      return 0.5;
  }
}
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
  // Master deck BPM drives beat-sync rates.
  const masterBpm = useApp((s) => s.decks[s.mixer.masterDeck].bpm) ?? 120;
  const racks = useRef<Record<number, FxRackHandles>>({});
  const [presets, setPresets] = useState<FxChainPreset[]>(() => loadFxChainPresets());
  const [filter, setFilter] = useState<FxChainPreset["category"] | "all">("all");

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

  // Whenever masterBpm or per-FX beatSync settings change, re-derive each
  // synced FX's param1 so the rate stays locked to the grid.
  useEffect(() => {
    fxs.forEach((fx) => {
      const rack = racks.current[fx.id];
      if (!rack || !fx.beatSync || !BEAT_SYNCABLE.includes(fx.kind)) return;
      const v = beatsToParam1(fx.kind, masterBpm, fx.beatDiv ?? 1);
      setFxParam(rack, 1, mapParam(fx.kind, 1, v));
    });
  }, [masterBpm, fxs]);

  const applyPreset = (p: FxChainPreset) => {
    [0, 1, 2].forEach((i) => {
      const slot = p.slots[i];
      const fxId = (i + 1) as 1 | 2 | 3;
      useApp.getState().updateFx(fxId, { kind: slot.kind, wet: slot.wet, param1: slot.param1, param2: slot.param2 });
      const rack = racks.current[fxId];
      if (rack) {
        setFxKind(rack, slot.kind);
        setFxMix(rack, slot.wet);
        setFxParam(rack, 1, mapParam(slot.kind, 1, slot.param1));
        setFxParam(rack, 2, mapParam(slot.kind, 2, slot.param2));
      }
    });
    toast.success(`FX preset: ${p.name}`);
  };

  const saveCurrentAsPreset = () => {
    const name = window.prompt("Nombre del preset FX:");
    if (!name?.trim()) return;
    const slots = [0, 1, 2].map((i) => ({
      kind: fxs[i].kind,
      wet: fxs[i].wet,
      param1: fxs[i].param1,
      param2: fxs[i].param2,
    })) as FxChainPreset["slots"];
    const next: FxChainPreset = {
      id: fxPresetUid(),
      name: name.trim(),
      description: "Preset personalizado",
      emoji: "⭐",
      category: "general",
      slots,
    };
    const all = [...presets, next];
    setPresets(all);
    saveUserFxChainPresets(all);
    toast.success(`Preset "${name}" guardado`);
  };

  const deletePreset = (id: string) => {
    if (!confirm("¿Borrar este preset FX?")) return;
    const all = presets.filter((p) => p.id !== id);
    setPresets(all);
    saveUserFxChainPresets(all);
  };

  const visiblePresets = presets.filter((p) => filter === "all" || p.category === filter);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      {/* FX Chain Presets toolbar */}
      <div className="vdj-panel-inset" style={{ padding: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="vdj-label" style={{ fontSize: 11 }}>FX PRESETS</span>
        <select
          className="vdj-btn"
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          style={{ padding: "3px 6px", fontSize: 11 }}
        >
          <option value="all">Todos</option>
          <option value="general">General</option>
          <option value="voice">Voz</option>
          <option value="deck">Deck</option>
          <option value="electronica">Electrónica</option>
          <option value="rap">Rap</option>
          <option value="rock">Rock</option>
          <option value="pop">Pop</option>
        </select>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
          {visiblePresets.map((p) => (
            <div key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
              <button
                className="vdj-btn"
                style={{ padding: "3px 8px", fontSize: 10 }}
                onClick={() => applyPreset(p)}
                title={p.description}
              >
                <span style={{ marginRight: 4 }}>{p.emoji}</span>{p.name}
              </button>
              {!p.builtin && (
                <button
                  className="vdj-btn"
                  style={{ padding: "3px 4px", fontSize: 9 }}
                  onClick={() => deletePreset(p.id)}
                  title={t("fxDeletePresetTip")}
                >
                  <Trash2 size={9} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          className="vdj-btn"
          style={{ padding: "3px 8px", fontSize: 10 }}
          onClick={saveCurrentAsPreset}
          title={t("fxSavePresetTip")}
        >
          <Save size={11} /> {t("fxSavePresetBtn")}
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, flex: 1, minHeight: 0 }}>
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
          {/* Beat-sync row: only meaningful for time-based FX */}
          {BEAT_SYNCABLE.includes(fx.kind) && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <button
                className="vdj-btn"
                data-active={!!fx.beatSync}
                style={{ padding: "3px 8px", fontSize: 10, display: "inline-flex", alignItems: "center", gap: 4 }}
                onClick={() => {
                  const next = !fx.beatSync;
                  useApp.getState().updateFx(fx.id, { beatSync: next });
                  if (next) {
                    const v = beatsToParam1(fx.kind, masterBpm, fx.beatDiv ?? 1);
                    useApp.getState().updateFx(fx.id, { param1: v });
                    if (racks.current[fx.id]) setFxParam(racks.current[fx.id], 1, mapParam(fx.kind, 1, v));
                  }
                }}
                title={t("fxBeatSyncTip")}
              >
                <Activity size={11} /> {t("fxBeatSync")}
              </button>
              {fx.beatSync && (
                <div style={{ display: "inline-flex", gap: 2 }}>
                  {BEAT_DIVS.map((b) => (
                    <button
                      key={b.v}
                      className="vdj-btn"
                      data-active={(fx.beatDiv ?? 1) === b.v}
                      style={{ padding: "2px 6px", fontSize: 10, minWidth: 28 }}
                      onClick={() => {
                        useApp.getState().updateFx(fx.id, { beatDiv: b.v });
                        const v = beatsToParam1(fx.kind, masterBpm, b.v);
                        useApp.getState().updateFx(fx.id, { param1: v });
                        if (racks.current[fx.id]) setFxParam(racks.current[fx.id], 1, mapParam(fx.kind, 1, v));
                      }}
                    >
                      {t(b.key)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-around", paddingTop: 6 }}>
            <Knob
              value={fx.param1}
              onChange={(v) => {
                useApp.getState().updateFx(fx.id, { param1: v });
                if (racks.current[fx.id]) setFxParam(racks.current[fx.id], 1, mapParam(fx.kind, 1, v));
              }}
              label={fx.beatSync && BEAT_SYNCABLE.includes(fx.kind) ? `${t("fxParam1")} · ♪` : t("fxParam1")}
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