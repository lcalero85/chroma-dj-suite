import { useApp } from "@/state/store";
import { setLimiter, setMasterVolume, setXfaderPosition } from "@/state/controller";
import { MixerChannel } from "./MixerChannel";
import { Knob } from "../console/Knob";
import { VuMeter } from "../console/VuMeter";
import { getEngine } from "@/audio/engine";
import { useEffect, useRef, useState } from "react";

export function Mixer() {
  const mixer = useApp((s) => s.mixer);
  const [ana, setAna] = useState<AnalyserNode | null>(null);
  const [cueAna, setCueAna] = useState<AnalyserNode | null>(null);
  useEffect(() => {
    const e = getEngine();
    setAna(e.masterAnalyser);
    setCueAna(e.cueAnalyser);
  }, []);

  return (
    <div className="vdj-panel" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="vdj-label">MIXER</span>
        <span className="vdj-chip">{mixer.xfaderCurve.toUpperCase()}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8 }}>
        <MixerChannel id="A" />
        <MasterColumn />
        <MixerChannel id="B" />
      </div>

      <CrossfaderSection />

      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
          <span className="vdj-label">MASTER</span>
          <VuMeter analyser={ana} orientation="horizontal" width={8} height={120} channels={1} />
        </div>
        <Knob
          value={mixer.master}
          max={1.2}
          defaultValue={0.85}
          onChange={setMasterVolume}
          label="VOL"
          size={48}
        />
        <Knob
          value={mixer.cueMix}
          onChange={(v) => useApp.getState().updateMixer({ cueMix: v })}
          label="CUE MIX"
          size={36}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button
            className="vdj-btn"
            data-active={mixer.limiter}
            onClick={() => setLimiter(!mixer.limiter)}
            style={{ fontSize: 10 }}
          >
            LIM
          </button>
          <select
            value={mixer.xfaderCurve}
            onChange={(e) =>
              useApp.getState().updateMixer({ xfaderCurve: e.target.value as "linear" | "smooth" | "sharp" })
            }
            className="vdj-btn"
            style={{ fontSize: 10, padding: "4px" }}
          >
            <option value="linear">Linear</option>
            <option value="smooth">Smooth</option>
            <option value="sharp">Sharp</option>
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
          <span className="vdj-label">CUE</span>
          <VuMeter analyser={cueAna} orientation="horizontal" width={6} height={80} />
        </div>
      </div>
    </div>
  );
}

function MasterColumn() {
  return (
    <div className="vdj-panel-inset" style={{ padding: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 60 }}>
      <span className="vdj-label">BOOTH</span>
      <Knob value={1} min={0} max={1.2} onChange={() => {}} size={32} label="VOL" />
      <span className="vdj-label" style={{ marginTop: 6 }}>REC</span>
      <RecordingPulse />
    </div>
  );
}

function RecordingPulse() {
  const recording = useApp((s) => s.recordings.length > 0);
  void recording;
  return <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--bad)", opacity: 0.4 }} />;
}

function CrossfaderSection() {
  const mixer = useApp((s) => s.mixer);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragging.current = true;
    updateFromEvent(e);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    updateFromEvent(e);
  };
  const onPointerUp = () => (dragging.current = false);
  const updateFromEvent = (e: React.PointerEvent) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r) return;
    const t = (e.clientX - r.left) / r.width;
    setXfaderPosition(Math.max(-1, Math.min(1, t * 2 - 1)));
  };

  const norm = (mixer.xfader + 1) / 2;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span className="vdj-label">A</span>
        <span className="vdj-label">CROSSFADER</span>
        <span className="vdj-label">B</span>
      </div>
      <div
        ref={trackRef}
        className="vdj-xf-track"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={() => setXfaderPosition(0)}
      >
        <div className="vdj-xf-cap" style={{ left: `calc(${norm * 100}% - 12px)` }} />
      </div>
    </div>
  );
}