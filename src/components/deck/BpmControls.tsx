import { useApp, type DeckId } from "@/state/store";
import { setDeckPitch } from "@/state/controller";
import { tap } from "@/audio/transport";
import { useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { useT } from "@/lib/i18n";

interface Props { id: DeckId }

/**
 * Per-deck BPM controls: nudge the effective BPM up/down in 0.1 increments,
 * tap-tempo override, and reset to original. Effective BPM = originalBpm * (1 + pitch * range).
 * Adjusting BPM here recomputes pitch so the deck matches the desired tempo without touching the source BPM.
 */
export function BpmControls({ id }: Props) {
  const ds = useApp((s) => s.decks[id]);
  const [taps, setTaps] = useState<number | null>(null);
  const t = useT();

  if (!ds.bpm) {
    return (
      <div className="vdj-panel-inset" style={{ padding: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <span className="vdj-label">{t("bpm")}</span>
        <span className="vdj-readout" style={{ fontSize: 11, color: "var(--text-3)" }}>{t("bpmNoTrack")}</span>
      </div>
    );
  }

  const range = ds.pitchRange / 100;
  const effective = ds.bpm * (1 + ds.pitch * range);

  const setEffective = (target: number) => {
    if (!ds.bpm) return;
    const desiredPitch = (target / ds.bpm - 1) / range;
    const clamped = Math.max(-1, Math.min(1, desiredPitch));
    setDeckPitch(id, clamped);
  };

  const onTap = () => {
    const bpm = tap();
    if (bpm) {
      const r = Math.round(bpm * 10) / 10;
      setTaps(r);
      setEffective(r);
    }
  };

  const reset = () => setDeckPitch(id, 0);

  return (
    <div className="vdj-panel-inset" style={{ padding: 6, display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="vdj-label">{t("bpm")}</span>
        <span className="vdj-readout" style={{ fontSize: 13, color: "var(--accent)" }}>
          {effective.toFixed(1)}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 3 }}>
        <button className="vdj-btn" title="-1.0 BPM" style={{ fontSize: 9, padding: "3px 0" }} onClick={() => setEffective(effective - 1)}>
          −1
        </button>
        <button className="vdj-btn" title="-0.1 BPM" style={{ fontSize: 9, padding: "3px 0" }} onClick={() => setEffective(effective - 0.1)}>
          <Minus size={9} />
        </button>
        <button className="vdj-btn" title={t("bpmReset")} style={{ fontSize: 9, padding: "3px 0" }} onClick={reset}>
          <RotateCcw size={9} />
        </button>
        <button className="vdj-btn" title="+0.1 BPM" style={{ fontSize: 9, padding: "3px 0" }} onClick={() => setEffective(effective + 0.1)}>
          <Plus size={9} />
        </button>
        <button className="vdj-btn" title="+1.0 BPM" style={{ fontSize: 9, padding: "3px 0" }} onClick={() => setEffective(effective + 1)}>
          +1
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button className="vdj-btn" onClick={onTap} title={t("bpmTap")} style={{ fontSize: 9, padding: "3px 6px", flex: 1 }}>
          TAP {taps ? taps.toFixed(1) : ""}
        </button>
        <span className="vdj-readout" style={{ fontSize: 9, color: "var(--text-3)", whiteSpace: "nowrap" }}>
          {t("bpmOriginal")} {ds.bpm.toFixed(1)}
        </span>
      </div>
    </div>
  );
}