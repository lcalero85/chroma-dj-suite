import { useApp } from "@/state/store";
import { setLimiter, setMasterVolume, setXfaderPosition } from "@/state/controller";
import { MixerChannel } from "./MixerChannel";
import { Knob } from "../console/Knob";
import { VuMeter } from "../console/VuMeter";
import { MasterPro } from "./MasterPro";
import { getEngine } from "@/audio/engine";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

export function Mixer() {
  const mixer = useApp((s) => s.mixer);
  const t = useT();
  const [ana, setAna] = useState<AnalyserNode | null>(null);
  const [cueAna, setCueAna] = useState<AnalyserNode | null>(null);
  useEffect(() => {
    const e = getEngine();
    setAna(e.masterAnalyser);
    setCueAna(e.cueAnalyser);
  }, []);

  return (
    <div
      className="vdj-panel vdj-scroll"
      style={{
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        height: "100%",
        minHeight: 0,
        overflow: "hidden auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="vdj-label">{t("mixer")}</span>
        <span className="vdj-chip">{mixer.xfaderCurve.toUpperCase()}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8 }}>
        <MixerChannel id="A" />
        <MasterColumn />
        <MixerChannel id="B" />
      </div>

       <CrossfaderSection />

      <MasterPro />

      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
          <span className="vdj-label">{t("master")}</span>
          <VuMeter analyser={ana} orientation="horizontal" width={8} height={120} channels={1} />
        </div>
        <Knob
          value={mixer.master}
          max={1.2}
          defaultValue={0.85}
          onChange={setMasterVolume}
          label={t("vol")}
          size={48}
        />
        <Knob
          value={mixer.cueMix}
          onChange={(v) => useApp.getState().updateMixer({ cueMix: v })}
          label={t("cueMix")}
          size={36}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button
            className="vdj-btn"
            data-active={mixer.limiter}
            onClick={() => setLimiter(!mixer.limiter)}
            style={{ fontSize: 10 }}
          >
            {t("lim")}
          </button>
          <select
            value={mixer.xfaderCurve}
            onChange={(e) =>
              useApp.getState().updateMixer({ xfaderCurve: e.target.value as "linear" | "smooth" | "sharp" })
            }
            className="vdj-btn"
            style={{ fontSize: 10, padding: "4px" }}
          >
            <option value="linear">{t("linear")}</option>
            <option value="smooth">{t("smooth")}</option>
            <option value="sharp">{t("sharp")}</option>
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
          <span className="vdj-label">{t("cue").toUpperCase()}</span>
          <VuMeter analyser={cueAna} orientation="horizontal" width={6} height={80} />
        </div>
      </div>
    </div>
  );
}

function MasterColumn() {
  const t = useT();
  return (
    <div className="vdj-panel-inset" style={{ padding: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 60 }}>
      <span className="vdj-label">{t("booth")}</span>
      <Knob value={1} min={0} max={1.2} onChange={() => {}} size={32} label={t("vol")} />
      <span className="vdj-label" style={{ marginTop: 6 }}>{t("rec")}</span>
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
  const t = useT();
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
        <span className="vdj-label">{t("crossfader")}</span>
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