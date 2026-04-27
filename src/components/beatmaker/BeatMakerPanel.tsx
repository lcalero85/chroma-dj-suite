import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import {
  makeDefaultPattern,
  startLive,
  stopLive,
  isLive,
  updateLivePattern,
  previewVoice,
  renderPatternToBuffer,
  audioBufferToWav,
  downloadBlob,
  FACTORY_PATTERNS,
  type BeatPattern,
  type BeatTrackId,
} from "@/audio/beatmaker";
import { toast } from "sonner";

/**
 * Professional Beat Maker UI:
 *  - 16-step grid (configurable to 8/32) per drum track
 *  - Per-track mute / solo / volume / pan
 *  - Master gain, BPM, swing
 *  - Factory patterns (House, Hip-Hop, Trap, Reggae, Techno)
 *  - Live playback feeds the master bus (recordable & streamable)
 *  - Export to WAV via OfflineAudioContext
 */
export function BeatMakerPanel() {
  const t = useT();
  const [pattern, setPattern] = useState<BeatPattern>(() => makeDefaultPattern(16));
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [bars, setBars] = useState(1);
  const [exporting, setExporting] = useState(false);
  const patternRef = useRef(pattern);
  patternRef.current = pattern;

  // Keep the live engine in sync whenever the pattern changes.
  useEffect(() => {
    if (isLive()) updateLivePattern(pattern);
  }, [pattern]);

  // Stop on unmount so beats don't keep running when the user switches panels.
  useEffect(() => {
    return () => {
      stopLive();
    };
  }, []);

  const togglePlay = () => {
    if (playing) {
      stopLive();
      setPlaying(false);
      setStep(-1);
    } else {
      startLive(patternRef.current, (s) => setStep(s));
      setPlaying(true);
    }
  };

  const setSteps = (steps: 8 | 16 | 32) => {
    setPattern((p) => ({
      ...p,
      steps,
      tracks: p.tracks.map((tr) => {
        const grow = (arr: boolean[]) => {
          if (arr.length === steps) return arr;
          if (arr.length > steps) return arr.slice(0, steps);
          return [...arr, ...new Array(steps - arr.length).fill(false)] as boolean[];
        };
        return { ...tr, steps: grow(tr.steps), accent: grow(tr.accent) };
      }),
    }));
  };

  const toggleStep = (trackIdx: number, stepIdx: number, accent: boolean) => {
    setPattern((p) => {
      const tracks = p.tracks.slice();
      const tr = { ...tracks[trackIdx] };
      if (accent) {
        // Shift+click toggles accent on an already-active step, or activates+accents.
        const newAccent = tr.accent.slice();
        const newSteps = tr.steps.slice();
        if (newSteps[stepIdx] && newAccent[stepIdx]) {
          newAccent[stepIdx] = false;
          newSteps[stepIdx] = false;
        } else {
          newSteps[stepIdx] = true;
          newAccent[stepIdx] = true;
        }
        tr.steps = newSteps;
        tr.accent = newAccent;
      } else {
        const newSteps = tr.steps.slice();
        const newAccent = tr.accent.slice();
        newSteps[stepIdx] = !newSteps[stepIdx];
        if (!newSteps[stepIdx]) newAccent[stepIdx] = false;
        tr.steps = newSteps;
        tr.accent = newAccent;
      }
      tracks[trackIdx] = tr;
      return { ...p, tracks };
    });
  };

  const clearTrack = (trackIdx: number) => {
    setPattern((p) => {
      const tracks = p.tracks.slice();
      tracks[trackIdx] = {
        ...tracks[trackIdx],
        steps: new Array(p.steps).fill(false),
        accent: new Array(p.steps).fill(false),
      };
      return { ...p, tracks };
    });
  };

  const updateTrack = (trackIdx: number, patch: Partial<BeatPattern["tracks"][number]>) => {
    setPattern((p) => {
      const tracks = p.tracks.slice();
      tracks[trackIdx] = { ...tracks[trackIdx], ...patch };
      return { ...p, tracks };
    });
  };

  const clearAll = () => {
    setPattern((p) => ({
      ...p,
      tracks: p.tracks.map((tr) => ({
        ...tr,
        steps: new Array(p.steps).fill(false),
        accent: new Array(p.steps).fill(false),
      })),
    }));
  };

  const randomize = () => {
    setPattern((p) => ({
      ...p,
      tracks: p.tracks.map((tr) => ({
        ...tr,
        steps: tr.steps.map(() => Math.random() < 0.18),
        accent: tr.accent.map(() => false),
      })),
    }));
  };

  const loadFactory = (id: string) => {
    const f = FACTORY_PATTERNS.find((x) => x.id === id);
    if (!f) return;
    const np = f.build();
    // Keep currently selected step count if compatible; otherwise adopt the factory's.
    setPattern(np);
    if (isLive()) updateLivePattern(np);
  };

  const exportWav = async () => {
    setExporting(true);
    try {
      const buf = await renderPatternToBuffer(patternRef.current, bars);
      const blob = audioBufferToWav(buf);
      downloadBlob(blob, `beatmaker-${Date.now()}.wav`);
      toast.success(t("bmExported"));
    } catch {
      toast.error(t("bmExportFailed"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="vdj-scroll"
      style={{ height: "100%", overflowY: "auto", overflowX: "hidden", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}
    >
      {/* Toolbar */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <button className="vdj-btn" data-active={playing} onClick={togglePlay} style={{ minWidth: 70 }}>
          {playing ? t("bmStop") : t("bmPlay")}
        </button>
        <Stat label="BPM">
          <input
            type="number"
            min={40}
            max={220}
            step={1}
            value={pattern.bpm}
            onChange={(e) => setPattern((p) => ({ ...p, bpm: Math.max(40, Math.min(220, Number(e.target.value) || p.bpm)) }))}
            className="vdj-btn"
            style={{ width: 70, textAlign: "center" }}
          />
        </Stat>
        <Stat label={t("bmSteps")}>
          <select
            className="vdj-btn"
            value={pattern.steps}
            onChange={(e) => setSteps(Number(e.target.value) as 8 | 16 | 32)}
          >
            <option value={8}>8</option>
            <option value={16}>16</option>
            <option value={32}>32</option>
          </select>
        </Stat>
        <Stat label={t("bmSwing")}>
          <input
            type="range" min={0} max={0.6} step={0.01}
            value={pattern.swing}
            onChange={(e) => setPattern((p) => ({ ...p, swing: Number(e.target.value) }))}
            style={{ width: 90, accentColor: "var(--accent)" }}
          />
          <span className="vdj-readout" style={{ fontSize: 10, marginLeft: 4 }}>
            {Math.round(pattern.swing * 100)}%
          </span>
        </Stat>
        <Stat label={t("bmMaster")}>
          <input
            type="range" min={0} max={1.5} step={0.01}
            value={pattern.master}
            onChange={(e) => setPattern((p) => ({ ...p, master: Number(e.target.value) }))}
            style={{ width: 90, accentColor: "var(--accent)" }}
          />
        </Stat>
        <Stat label={t("bmFactory")}>
          <select
            className="vdj-btn"
            defaultValue=""
            onChange={(e) => { if (e.target.value) { loadFactory(e.target.value); e.target.value = ""; } }}
          >
            <option value="">— {t("bmPattern")} —</option>
            {FACTORY_PATTERNS.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        </Stat>
        <button className="vdj-btn" onClick={randomize}>{t("bmRandom")}</button>
        <button className="vdj-btn" data-tone="danger" onClick={clearAll}>{t("bmClear")}</button>
        <div style={{ flex: 1 }} />
        <Stat label={t("bmBars")}>
          <select className="vdj-btn" value={bars} onChange={(e) => setBars(Number(e.target.value))}>
            {[1, 2, 4, 8].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Stat>
        <button className="vdj-btn" data-tone="primary" onClick={() => void exportWav()} disabled={exporting}>
          {exporting ? t("bmExporting") : t("bmExport")}
        </button>
      </div>

      <div className="vdj-label" style={{ fontSize: 10, opacity: 0.7 }}>{t("bmTip")}</div>

      {/* Sequencer grid */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {pattern.tracks.map((tr, trackIdx) => (
          <TrackRow
            key={tr.id}
            track={tr}
            currentStep={step}
            stepsCount={pattern.steps}
            onToggle={(s, accent) => toggleStep(trackIdx, s, accent)}
            onClear={() => clearTrack(trackIdx)}
            onChange={(patch) => updateTrack(trackIdx, patch)}
            onPreview={() => previewVoice(tr.id as BeatTrackId, tr.volume * pattern.master)}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
      <span className="vdj-label" style={{ fontSize: 9 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>{children}</div>
    </div>
  );
}

function TrackRow({
  track, currentStep, stepsCount, onToggle, onClear, onChange, onPreview, t,
}: {
  track: BeatPattern["tracks"][number];
  currentStep: number;
  stepsCount: number;
  onToggle: (step: number, accent: boolean) => void;
  onClear: () => void;
  onChange: (patch: Partial<BeatPattern["tracks"][number]>) => void;
  onPreview: () => void;
  t: (key: import("@/lib/i18n").DictKey, params?: Record<string, string | number>) => string;
}) {
  return (
    <div
      className="vdj-panel-inset"
      style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 8, padding: 6, alignItems: "center" }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            className="vdj-btn"
            style={{ flex: 1, fontSize: 11, padding: "3px 6px", textAlign: "left" }}
            onClick={onPreview}
            title={track.label}
          >
            {track.label}
          </button>
          <button
            className="vdj-btn"
            data-active={track.mute}
            data-tone="danger"
            style={{ fontSize: 9, padding: "2px 6px" }}
            onClick={() => onChange({ mute: !track.mute })}
            title={t("bmMuteTip")}
          >M</button>
          <button
            className="vdj-btn"
            data-active={track.solo}
            style={{ fontSize: 9, padding: "2px 6px" }}
            onClick={() => onChange({ solo: !track.solo })}
            title={t("bmSoloTip")}
          >S</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="range" min={0} max={1.5} step={0.01}
            value={track.volume}
            onChange={(e) => onChange({ volume: Number(e.target.value) })}
            style={{ flex: 1, accentColor: "var(--accent)" }}
            title={t("bmVolumeTip")}
          />
          <input
            type="range" min={-1} max={1} step={0.01}
            value={track.pan}
            onChange={(e) => onChange({ pan: Number(e.target.value) })}
            style={{ flex: 1, accentColor: "var(--accent)" }}
            title={t("bmPanTip")}
          />
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${stepsCount}, 1fr)`,
          gap: 3,
        }}
        onContextMenu={(e) => { e.preventDefault(); onClear(); }}
      >
        {track.steps.map((on, i) => {
          const beat = Math.floor(i / 4);
          const isPlayhead = i === currentStep;
          return (
            <button
              key={i}
              onClick={(e) => onToggle(i, e.shiftKey)}
              className="vdj-btn"
              data-active={on}
              style={{
                height: 26,
                padding: 0,
                fontSize: 8,
                background: on
                  ? track.accent[i] ? "var(--accent)" : undefined
                  : beat % 2 === 0 ? "var(--surface-2)" : "var(--surface-1)",
                outline: isPlayhead ? "2px solid var(--accent)" : undefined,
                outlineOffset: isPlayhead ? -1 : undefined,
                opacity: track.mute ? 0.4 : 1,
              }}
              title={track.accent[i] ? `Step ${i + 1} (accent)` : `Step ${i + 1}`}
            >
              {track.accent[i] ? "▲" : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}