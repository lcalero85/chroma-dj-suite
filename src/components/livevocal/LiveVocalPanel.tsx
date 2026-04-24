import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Sparkles, Music2, Volume2, RotateCcw, Play, Square, Disc, Download } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/state/store";
import { setMicOn, setMicLevel, setMicDuck } from "@/state/controller";
import { ensureRunning } from "@/audio/engine";
import { enableVocalChain, disableVocalChain, isVocalChainEnabled } from "@/audio/engine";
import {
  DEFAULT_VOCAL_FX,
  VOCAL_FX_PRESETS,
  NOTE_NAMES,
  SCALE_INTERVALS,
  setVocalParams,
  getVocalParams,
  applyVocalPreset,
  getDetectedVocalNote,
  type VocalFxParams,
  type ScaleId,
} from "@/audio/vocalFx";
import { useT, type DictKey } from "@/lib/i18n";
import {
  INSTRUMENTALS,
  playInstrumental,
  stopInstrumental,
  stopAllInstrumentals,
  isInstrumentalPlaying,
  setInstrumentalVolume,
} from "@/audio/vocalInstrumentals";
import {
  startMicRecording,
  stopMicRecording,
  isMicRecording,
  type MicRecordingResult,
} from "@/audio/micRecorder";

const SCALES: ScaleId[] = Object.keys(SCALE_INTERVALS) as ScaleId[];

export function LiveVocalPanel() {
  const t = useT();
  const mixerRaw = useApp((s) => s.mixer);
  const mic = {
    on: mixerRaw.micOn ?? false,
    level: mixerRaw.micLevel ?? 1,
    duck: mixerRaw.micDuck ?? 0.4,
  };
  const micOwner = mixerRaw.micOwner ?? null;
  const micBusy = mic.on && micOwner !== null && micOwner !== "livevocal";

  const [params, setParams] = useState<VocalFxParams>({ ...DEFAULT_VOCAL_FX });
  const [presetId, setPresetId] = useState<string>("off");
  const [detected, setDetected] = useState<{ midi: number; cents: number } | null>(null);
  const [activeInst, setActiveInst] = useState<string | null>(null);
  const [instVol, setInstVol] = useState(0.7);
  const [recording, setRecording] = useState(false);
  const [lastRec, setLastRec] = useState<MicRecordingResult | null>(null);
  const [recElapsed, setRecElapsed] = useState(0);
  const mounted = useRef(false);

  // Attach the chain on mount; detach on unmount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureRunning();
      if (cancelled) return;
      if (!isVocalChainEnabled()) enableVocalChain();
      // Sync existing params to chain
      setVocalParams(getVocalParams());
      mounted.current = true;
    })();
    return () => {
      cancelled = true;
      // We keep the chain alive as long as panel is open. When user navigates
      // away we detach to free pitch-detection CPU.
      disableVocalChain();
      mounted.current = false;
    };
  }, []);

  // Push param updates to engine
  useEffect(() => {
    if (!mounted.current) return;
    setVocalParams(params);
  }, [params]);

  // Poll detected note for the on-screen tuner indicator.
  useEffect(() => {
    const id = window.setInterval(() => {
      setDetected(getDetectedVocalNote());
    }, 80);
    return () => window.clearInterval(id);
  }, []);

  // Instrumental volume sync
  useEffect(() => { setInstrumentalVolume(instVol); }, [instVol]);

  // Recording elapsed timer
  useEffect(() => {
    if (!recording) { setRecElapsed(0); return; }
    const startedAt = Date.now();
    const id = window.setInterval(() => setRecElapsed(Date.now() - startedAt), 250);
    return () => window.clearInterval(id);
  }, [recording]);

  // Stop instrumentals when leaving panel
  useEffect(() => {
    return () => {
      stopAllInstrumentals();
      // Don't auto-stop recording on unmount — user may want to keep it,
      // but clear local UI state.
    };
  }, []);

  const update = (patch: Partial<VocalFxParams>) => setParams((p) => ({ ...p, ...patch }));

  const onPreset = (id: string) => {
    setPresetId(id);
    applyVocalPreset(id);
    setParams(getVocalParams());
    const p = VOCAL_FX_PRESETS.find((x) => x.id === id);
    if (p && id !== "off") toast(`🎤 ${p.label}`);
  };

  const resetAll = () => {
    setParams({ ...DEFAULT_VOCAL_FX });
    setPresetId("off");
    applyVocalPreset("off");
  };

  const detectedName = detected
    ? `${NOTE_NAMES[((detected.midi % 12) + 12) % 12]}${Math.floor(detected.midi / 12) - 1}`
    : "—";

  const onInstClick = async (id: string) => {
    if (activeInst === id) {
      stopInstrumental(id);
      setActiveInst(null);
    } else {
      stopAllInstrumentals();
      const ok = await playInstrumental(id, instVol);
      if (ok) setActiveInst(id);
      else toast.error("Audio unavailable");
    }
  };

  const onRecToggle = async () => {
    if (recording || isMicRecording()) {
      const result = await stopMicRecording();
      setRecording(false);
      if (result) {
        setLastRec(result);
        toast.success(t("liveVocalRecSaved"));
      }
    } else {
      // Auto-enable mic if needed
      if (!mic.on) {
        const ok = await setMicOn(true, "livevocal");
        if (!ok) { toast.error(t("liveVocalRecFailed")); return; }
      }
      const ok = await startMicRecording();
      if (ok) setRecording(true);
      else toast.error(t("liveVocalRecFailed"));
    }
  };

  const onDownload = () => {
    if (!lastRec) return;
    const a = document.createElement("a");
    a.href = lastRec.url;
    a.download = lastRec.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 12, height: "100%", overflow: "auto" }} className="vdj-scroll">
      {/* Header: mic on/off + level + duck */}
      <div className="vdj-panel-inset" style={{ padding: 10, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button
          className="vdj-btn"
          data-active={mic.on}
          data-tone={mic.on ? "live" : undefined}
          disabled={micBusy}
          title={micBusy ? t("micBusyOther") : undefined}
          onClick={async () => {
            if (micBusy) { toast(t("micBusyOther")); return; }
            const ok = await setMicOn(!mic.on, "livevocal");
            if (ok && !mic.on) toast.success(t("liveVocalMicOn"));
            else if (mic.on) toast(t("liveVocalMicOff"));
          }}
          style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 40, fontWeight: 800, letterSpacing: "0.05em" }}
        >
          {mic.on && !micBusy ? <Mic size={16} /> : <MicOff size={16} />}
          {t("liveVocalMicLabel")}
        </button>

        <label className="vdj-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Volume2 size={12} /> {t("liveVocalLevel")}
          <input type="range" min={0} max={2} step={0.01} value={mic.level} onChange={(e) => setMicLevel(parseFloat(e.target.value))} style={{ width: 100 }} />
          <span className="vdj-readout" style={{ fontSize: 10, minWidth: 30 }}>{mic.level.toFixed(2)}</span>
        </label>
        <label className="vdj-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {t("liveVocalDuck")}
          <input type="range" min={0} max={0.9} step={0.01} value={mic.duck} onChange={(e) => setMicDuck(parseFloat(e.target.value))} style={{ width: 100 }} />
          <span className="vdj-readout" style={{ fontSize: 10, minWidth: 30 }}>{Math.round(mic.duck * 100)}%</span>
        </label>

        <div style={{ flex: 1 }} />

        <div className="vdj-panel-inset" style={{ padding: "6px 10px", display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)" }}>
          <Music2 size={14} style={{ color: "var(--accent)" }} />
          <span className="vdj-label">{t("liveVocalDetected")}</span>
          <span className="vdj-readout" style={{ fontSize: 16, minWidth: 40, fontWeight: 700 }}>{detectedName}</span>
          {detected && (
            <span style={{ fontSize: 10, color: Math.abs(detected.cents) < 10 ? "var(--good)" : "var(--warn)" }}>
              {detected.cents > 0 ? "+" : ""}{detected.cents}¢
            </span>
          )}
        </div>

        <button className="vdj-btn" onClick={resetAll} title={t("liveVocalReset")} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <RotateCcw size={12} /> {t("liveVocalReset")}
        </button>
      </div>

      {/* Presets */}
      <div className="vdj-panel-inset" style={{ padding: 10 }}>
        <div className="vdj-label" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Sparkles size={12} /> {t("liveVocalPresets")}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 6 }}>
          {VOCAL_FX_PRESETS.map((p) => (
            <button
              key={p.id}
              className="vdj-btn"
              data-active={presetId === p.id}
              onClick={() => onPreset(p.id)}
              style={{ padding: "8px 6px", fontSize: 11, fontWeight: 600, textAlign: "center" }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Autotune controls */}
      <div className="vdj-panel-inset" style={{ padding: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
          <label className="vdj-btn" data-active={params.autotune} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", cursor: "pointer" }}>
            <input type="checkbox" checked={params.autotune} onChange={(e) => update({ autotune: e.target.checked })} style={{ display: "none" }} />
            🎯 {t("liveVocalAutotune")}
          </label>
          <label className="vdj-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {t("liveVocalKey")}
            <select className="vdj-btn" value={params.rootPc} onChange={(e) => update({ rootPc: Number(e.target.value) })} style={{ padding: "4px 6px" }}>
              {NOTE_NAMES.map((n, i) => (<option key={i} value={i}>{n}</option>))}
            </select>
          </label>
          <label className="vdj-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {t("liveVocalScale")}
            <select className="vdj-btn" value={params.scale} onChange={(e) => update({ scale: e.target.value as ScaleId })} style={{ padding: "4px 6px" }}>
              {SCALES.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
          <Slider label={t("liveVocalRetune")} value={params.retune} min={0} max={1} step={0.01} onChange={(v) => update({ retune: v })} display={(v) => `${Math.round(v * 100)}%`} />
          <Slider label={t("liveVocalFormant")} value={params.formant} min={-12} max={12} step={0.5} onChange={(v) => update({ formant: v })} display={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)} st`} />
        </div>
      </div>

      {/* Harmony / Octaver / Doubler */}
      <div className="vdj-panel-inset" style={{ padding: 10 }}>
        <div className="vdj-label" style={{ marginBottom: 8 }}>{t("liveVocalHarmony")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
          <Slider label={t("liveVocalHarmonyMix")} value={params.harmonyMix} min={0} max={1} step={0.01} onChange={(v) => update({ harmonyMix: v })} display={(v) => `${Math.round(v * 100)}%`} />
          <Slider label={t("liveVocalHarmony3rd")} value={params.harmony3rd} min={-12} max={12} step={1} onChange={(v) => update({ harmony3rd: v })} display={(v) => `${v > 0 ? "+" : ""}${v} st`} />
          <Slider label={t("liveVocalHarmony5th")} value={params.harmony5th} min={-12} max={12} step={1} onChange={(v) => update({ harmony5th: v })} display={(v) => `${v > 0 ? "+" : ""}${v} st`} />
          <Slider label={t("liveVocalOctaveDown")} value={params.octaveDown} min={0} max={1} step={0.01} onChange={(v) => update({ octaveDown: v })} display={(v) => `${Math.round(v * 100)}%`} />
          <Slider label={t("liveVocalOctaveUp")} value={params.octaveUp} min={0} max={1} step={0.01} onChange={(v) => update({ octaveUp: v })} display={(v) => `${Math.round(v * 100)}%`} />
          <Slider label={t("liveVocalDoubler")} value={params.doubler} min={0} max={1} step={0.01} onChange={(v) => update({ doubler: v })} display={(v) => `${Math.round(v * 100)}%`} />
        </div>
      </div>

      {/* Tone / dynamics */}
      <div className="vdj-panel-inset" style={{ padding: 10 }}>
        <div className="vdj-label" style={{ marginBottom: 8 }}>{t("liveVocalTone")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
          <Slider label={t("liveVocalEqLow")} value={params.eqLow} min={-12} max={12} step={0.5} onChange={(v) => update({ eqLow: v })} display={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)} dB`} />
          <Slider label={t("liveVocalEqMid")} value={params.eqMid} min={-12} max={12} step={0.5} onChange={(v) => update({ eqMid: v })} display={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)} dB`} />
          <Slider label={t("liveVocalEqHi")} value={params.eqHi} min={-12} max={12} step={0.5} onChange={(v) => update({ eqHi: v })} display={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)} dB`} />
          <Slider label={t("liveVocalPresence")} value={params.presence} min={0} max={1} step={0.01} onChange={(v) => update({ presence: v })} display={(v) => `${Math.round(v * 100)}%`} />
          <Slider label={t("liveVocalDeEsser")} value={params.deEsser} min={0} max={1} step={0.01} onChange={(v) => update({ deEsser: v })} display={(v) => `${Math.round(v * 100)}%`} />
          <Slider label={t("liveVocalCompress")} value={params.compress} min={0} max={1} step={0.01} onChange={(v) => update({ compress: v })} display={(v) => `${Math.round(v * 100)}%`} />
        </div>
      </div>

      {/* Spatial */}
      <div className="vdj-panel-inset" style={{ padding: 10 }}>
        <div className="vdj-label" style={{ marginBottom: 8 }}>{t("liveVocalSpatial")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
          <Slider label={t("liveVocalReverbMix")} value={params.reverbMix} min={0} max={1} step={0.01} onChange={(v) => update({ reverbMix: v })} display={(v) => `${Math.round(v * 100)}%`} />
          <Slider label={t("liveVocalReverbSize")} value={params.reverbSize} min={0} max={1} step={0.01} onChange={(v) => update({ reverbSize: v })} display={(v) => `${Math.round(v * 100)}%`} />
          <Slider label={t("liveVocalDelayMix")} value={params.delayMix} min={0} max={1} step={0.01} onChange={(v) => update({ delayMix: v })} display={(v) => `${Math.round(v * 100)}%`} />
          <Slider label={t("liveVocalDelayTime")} value={params.delayTime} min={0} max={1} step={0.01} onChange={(v) => update({ delayTime: v })} display={(v) => `${(0.05 + v * 0.75).toFixed(2)}s`} />
          <Slider label={t("liveVocalDelayFb")} value={params.delayFb} min={0} max={0.85} step={0.01} onChange={(v) => update({ delayFb: v })} display={(v) => `${Math.round(v * 100)}%`} />
        </div>
      </div>

      {/* Instrumentals */}
      <div className="vdj-panel-inset" style={{ padding: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
          <div className="vdj-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Music2 size={12} /> {t("liveVocalInstrumentals")}
          </div>
          <label className="vdj-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Volume2 size={12} />
            <input type="range" min={0} max={1.2} step={0.01} value={instVol} onChange={(e) => setInstVol(parseFloat(e.target.value))} style={{ width: 100 }} />
            <span className="vdj-readout" style={{ fontSize: 10, minWidth: 30 }}>{Math.round(instVol * 100)}%</span>
          </label>
        </div>
        <div style={{ fontSize: 10, opacity: 0.65, marginBottom: 6 }}>{t("liveVocalInstrumentalsHint")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 6 }}>
          {INSTRUMENTALS.map((inst) => {
            const playing = activeInst === inst.id || isInstrumentalPlaying(inst.id);
            return (
              <button
                key={inst.id}
                className="vdj-btn"
                data-active={playing}
                onClick={() => onInstClick(inst.id)}
                style={{ padding: "8px 6px", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}
              >
                <span>{playing ? <Square size={11} /> : <Play size={11} />}</span>
                <span style={{ flex: 1, textAlign: "left" }}>{t(inst.labelKey as DictKey)}</span>
                <span style={{ fontSize: 9, opacity: 0.6 }}>{inst.bpm}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mic recorder */}
      <div className="vdj-panel-inset" style={{ padding: 10 }}>
        <div className="vdj-label" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Disc size={12} /> {t("liveVocalRecorder")}
        </div>
        <div style={{ fontSize: 10, opacity: 0.65, marginBottom: 8 }}>{t("liveVocalRecHint")}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button
            className="vdj-btn"
            data-active={recording}
            data-tone={recording ? "danger" : undefined}
            onClick={() => void onRecToggle()}
            style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, minHeight: 36 }}
          >
            {recording ? <Square size={12} /> : <Disc size={12} />}
            {recording ? t("liveVocalRecStop") : t("liveVocalRecStart")}
          </button>
          {recording && (
            <span className="vdj-readout" style={{ fontSize: 12, color: "var(--live, #ff5050)", fontWeight: 700 }}>
              ● {t("liveVocalRecActive")} {formatElapsed(recElapsed)}
            </span>
          )}
          {lastRec && !recording && (
            <>
              <audio src={lastRec.url} controls style={{ height: 32, maxWidth: 240 }} />
              <button className="vdj-btn" onClick={onDownload} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Download size={12} /> {t("liveVocalRecDownload")}
              </button>
              <span style={{ fontSize: 10, opacity: 0.7 }}>{lastRec.filename}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

function Slider({
  label, value, min, max, step, onChange, display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display: (v: number) => string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="vdj-label" style={{ fontSize: 10 }}>{label}</span>
        <span className="vdj-readout" style={{ fontSize: 10 }}>{display(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%" }}
      />
    </div>
  );
}