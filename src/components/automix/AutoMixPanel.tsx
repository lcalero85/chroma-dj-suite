import { useEffect, useState } from "react";
import {
  cancelAutoMix,
  clearHistory,
  defaultAutoMixConfig,
  getAutoMixConfig,
  getAutoMixStatus,
  setAutoMixConfig,
  smartCrossfade,
  subscribeAutoMix,
  type AutoMixConfig,
  type AutoMixMode,
} from "@/audio/automix";
import { useApp } from "@/state/store";
import { Sparkles, Activity, History, Mic2, Lock, RotateCcw, Play, X, Zap } from "lucide-react";

/**
 * Visual control + status panel for AutoMix Pro.
 * Designed to live inside the Mixer column (compact) or the bottom drawer.
 * Self-contained — no global side-effects beyond calls into audio/automix.ts.
 */
export function AutoMixPanel({ compact = false, smartFaderActive = false }: { compact?: boolean; smartFaderActive?: boolean }) {
  const [, force] = useState(0);
  const [cfg, setCfg] = useState<AutoMixConfig>(getAutoMixConfig());
  const tracks = useApp((s) => s.tracks);
  const updateSettings = useApp((s) => s.updateSettings);

  useEffect(() => {
    const unsub = subscribeAutoMix(() => {
      setCfg(getAutoMixConfig());
      force((v) => v + 1);
    });
    return unsub;
  }, []);

  const status = getAutoMixStatus();
  const trackName = (id: string) => {
    const t = tracks.find((x) => x.id === id);
    return t ? `${t.artist ? t.artist + " — " : ""}${t.title}` : id.slice(0, 6);
  };

  const update = (patch: Partial<AutoMixConfig>) => {
    setAutoMixConfig(patch);
  };

  return (
    <div
      className="vdj-panel-inset"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: compact ? 8 : 12,
        minHeight: 0,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <Sparkles size={14} style={{ color: "var(--accent)" }} />
        <span className="vdj-label">AutoMix Pro</span>
        {smartFaderActive && (
          <span
            className="vdj-chip"
            data-active
            title="Smart Fader is auto-riding the crossfader"
            style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9 }}
          >
            <Zap size={9} /> SMART
          </span>
        )}
        <span className="vdj-chip" data-active={status.isRunning} style={{ marginLeft: "auto" }}>
          {status.isRunning ? "MIXING" : status.pendingSwap ? "WAIT-VOX" : "IDLE"}
        </span>
      </header>

      {/* Mode selector */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4 }}>
        {(["radio", "club", "intelligent"] as AutoMixMode[]).map((m) => (
          <button
            key={m}
            className="vdj-btn"
            data-active={cfg.mode === m}
            style={{ fontSize: 9, padding: "5px 0", textTransform: "uppercase" }}
            onClick={() => update({ mode: m })}
            title={
              m === "radio"   ? "Long, smooth crossfades for broadcast"
            : m === "club"    ? "Tight, EQ-driven cuts for live sets"
                              : "Adaptive duration based on compatibility"
            }
          >
            {m}
          </button>
        ))}
      </div>

      {/* Compatibility readout */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10 }}>
        <span className="vdj-label">Compat → Deck {status.nextTargetDeck}</span>
        <span
          className="vdj-chip"
          style={{
            color:
              status.compatibility > 0.75 ? "var(--good)"
            : status.compatibility > 0.5  ? "var(--warn)"
                                          : "var(--bad)",
          }}
        >
          {(status.compatibility * 100).toFixed(0)}%
        </span>
      </div>

      {/* Duration */}
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10 }}>
        <span style={{ minWidth: 56 }} className="vdj-label">DURATION</span>
        <input
          type="range"
          min={1}
          max={32}
          step={1}
          value={cfg.duration}
          onChange={(e) => update({ duration: parseInt(e.target.value, 10) })}
          style={{ flex: 1, accentColor: "var(--accent)" }}
        />
        <span style={{ minWidth: 28, textAlign: "right", fontFamily: "var(--font-mono)" }}>{cfg.duration}s</span>
      </label>

      {/* BPM tolerance */}
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10 }}>
        <span style={{ minWidth: 56 }} className="vdj-label">BPM TOL</span>
        <input
          type="range"
          min={0}
          max={20}
          step={1}
          value={cfg.bpmTolerancePct}
          onChange={(e) => update({ bpmTolerancePct: parseInt(e.target.value, 10) })}
          style={{ flex: 1, accentColor: "var(--accent)" }}
        />
        <span style={{ minWidth: 28, textAlign: "right", fontFamily: "var(--font-mono)" }}>±{cfg.bpmTolerancePct}%</span>
      </label>

      {/* Toggles */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
        <Toggle on={cfg.keyMatch}    onClick={() => update({ keyMatch: !cfg.keyMatch })}    icon={<Activity size={11} />} label="Key match" />
        <Toggle on={cfg.autoGain}    onClick={() => update({ autoGain: !cfg.autoGain })}    icon={<Activity size={11} />} label="AutoGain" />
        <Toggle on={cfg.eqBlend}     onClick={() => update({ eqBlend: !cfg.eqBlend })}     icon={<Activity size={11} />} label="EQ blend" />
        <Toggle on={cfg.vocalProtect} onClick={() => update({ vocalProtect: !cfg.vocalProtect })} icon={<Mic2 size={11} />} label="Vox guard" />
      </div>

      {/* Smart Fader toggle (mirrors the global setting) */}
      <button
        className="vdj-btn"
        data-active={smartFaderActive}
        onClick={() => updateSettings({ smartFaderEnabled: !smartFaderActive })}
        style={{ fontSize: 10, padding: "5px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        title="When on, the crossfader auto-rides as the master deck nears its smart-exit"
      >
        <Zap size={11} /> Smart Fader · {smartFaderActive ? "ON" : "OFF"}
      </button>

      {/* Trigger row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
        <button
          className="vdj-btn"
          style={{ fontSize: 10, fontWeight: 700, padding: "6px 0", color: "var(--accent)" }}
          onClick={() => smartCrossfade()}
          title="Trigger an intelligent transition now"
        >
          <Play size={10} style={{ display: "inline", marginRight: 4 }} /> SMART MIX
        </button>
        <button
          className="vdj-btn"
          style={{ fontSize: 10, padding: "6px 0" }}
          onClick={() => cancelAutoMix()}
          title="Cancel any running or pending mix"
        >
          <X size={10} style={{ display: "inline", marginRight: 4 }} /> CANCEL
        </button>
      </div>

      {/* History */}
      <details>
        <summary style={{ fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, opacity: 0.85 }}>
          <History size={11} /> History ({status.history.length})
        </summary>
        <div style={{ maxHeight: 100, overflow: "auto", marginTop: 4, fontSize: 10, fontFamily: "var(--font-mono)" }}>
          {status.history.length === 0
            ? <div style={{ opacity: 0.5, padding: "4px 0" }}>No tracks yet</div>
            : status.history.slice().reverse().map((id, i) => (
                <div key={i} style={{ padding: "2px 0", borderBottom: "1px dashed var(--line)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {trackName(id)}
                </div>
              ))}
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
          <button className="vdj-btn" style={{ fontSize: 9, flex: 1 }} onClick={() => clearHistory()}>
            <RotateCcw size={9} style={{ display: "inline", marginRight: 3 }} /> Clear
          </button>
          <button className="vdj-btn" style={{ fontSize: 9, flex: 1 }} onClick={() => setAutoMixConfig(defaultAutoMixConfig())}>
            <Lock size={9} style={{ display: "inline", marginRight: 3 }} /> Defaults
          </button>
        </div>
      </details>
    </div>
  );
}

function Toggle({ on, onClick, icon, label }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      className="vdj-btn"
      data-active={on}
      onClick={onClick}
      style={{ fontSize: 9, padding: "4px 6px", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}