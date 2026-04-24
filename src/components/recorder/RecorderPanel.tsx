import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/state/store";
import { isRecording, recordingElapsed, startRecording, stopRecording } from "@/audio/recorder";
import { isVideoRecording, videoRecordingElapsed, startVideoRecording, stopVideoRecording } from "@/audio/videoRecorder";
import { videoStageRef } from "@/components/video/VideoStage";
import { listRecordings, putRecording, deleteRecording, uid } from "@/lib/db";
import { ensureRunning, VOICE_PRESETS } from "@/audio/engine";
import { formatTime } from "@/lib/format";
import { Circle, Square, Download, Trash2, Mic, MicOff, Wand2, Keyboard, Video } from "lucide-react";
import { toast } from "sonner";
import { setMicOn, setMicLevel, setMicDuck, setVoicePreset, setNumpadDeck } from "@/state/controller";
import { useT, useFormatNumber } from "@/lib/i18n";

function fileExt(mime: string) {
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("webm") && mime.includes("video")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

function RecordingRow({ r, onDelete }: { r: Awaited<ReturnType<typeof listRecordings>>[number]; onDelete: () => Promise<void> }) {
  const url = useMemo(() => URL.createObjectURL(r.blob), [r.blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const isVideo = r.mime.startsWith("video/");
  const fmt = useFormatNumber();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 8px",
        borderTop: "1px solid var(--line)",
        gap: 8,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 6 }}>
          {isVideo && <Video size={11} style={{ color: "var(--accent)" }} />}
          {r.name}
        </div>
        <div className="vdj-label">{formatTime(r.duration)} · {fmt(r.blob.size / 1024 / 1024, { maximumFractionDigits: 1 })} MB · {fileExt(r.mime).toUpperCase()}</div>
      </div>
      {isVideo ? (
        <video src={url} controls preload="metadata" style={{ height: 80, maxWidth: "40%", borderRadius: 4, background: "#000" }} />
      ) : (
        <audio src={url} controls preload="auto" style={{ height: 28, width: 320, maxWidth: "40%" }} />
      )}
      <a className="vdj-btn" style={{ padding: "4px 6px" }} href={url} download={`${r.name}.${fileExt(r.mime)}`}>
        <Download size={12} />
      </a>
      <button className="vdj-btn" style={{ padding: "4px 6px" }} onClick={() => void onDelete()}>
        <Trash2 size={12} />
      </button>
    </div>
  );
}

export function RecorderPanel() {
  const t = useT();
  const recordings = useApp((s) => s.recordings);
  const setRecordings = useApp((s) => s.setRecordings);
  const hasVideo = useApp((s) => !!(s.decks.A.hasVideo || s.decks.B.hasVideo));
  const mixerRaw = useApp((s) => s.mixer);
  const mixer = {
    micOn: mixerRaw.micOn ?? false,
    micLevel: mixerRaw.micLevel ?? 1,
    micDuck: mixerRaw.micDuck ?? 0.4,
    micPreset: mixerRaw.micPreset ?? "off",
    numpadDeck: mixerRaw.numpadDeck ?? "A",
  };
  const micOwner = mixerRaw.micOwner ?? null;
  const micBusy = mixer.micOn && micOwner !== null && micOwner !== "recorder";
  const [, force] = useState(0);

  useEffect(() => {
    listRecordings().then(setRecordings);
  }, [setRecordings]);

  const rec = isRecording();
  const vrec = isVideoRecording();

  useEffect(() => {
    if (!rec && !vrec) return;
    const i = setInterval(() => force((x) => x + 1), 250);
    return () => clearInterval(i);
  }, [rec, vrec]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      {/* TOP ROW: record + voice over banner */}
      <div style={{ display: "flex", alignItems: "stretch", gap: 10, flexWrap: "wrap" }}>
        <button
          className="vdj-btn"
          data-active={rec}
          data-tone="danger"
          onClick={async () => {
            await ensureRunning();
            try {
              if (rec) {
                const r = await stopRecording();
                if (r) {
                  await putRecording({
                    id: uid(),
                    name: `Set ${new Date().toLocaleString()}`,
                    blob: r.blob,
                    mime: r.mime,
                    duration: r.duration,
                    createdAt: Date.now(),
                  });
                  setRecordings(await listRecordings());
                    toast.success(t("recSavedTitle"), { description: t("recSavedDesc", { ext: fileExt(r.mime).toUpperCase() }) });
                }
              } else {
                await startRecording();
                  toast(t("recRecordingNow"), { description: t("recRecordingDesc") });
              }
            } catch (error) {
              console.error(error);
                toast.error(t("recCouldNotStart"));
            }
            force((x) => x + 1);
          }}
          style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 122, justifyContent: "center", minHeight: 40 }}
        >
          {rec ? <Square size={12} /> : <Circle size={12} fill="currentColor" />}
            {rec ? t("recBtnStop") : t("recBtnStart")}
        </button>
        <span className="vdj-readout" style={{ color: rec ? "var(--bad)" : "var(--text-3)", display: "flex", alignItems: "center" }}>
          {formatTime(recordingElapsed())}
        </span>

        {/* Video record button (only when there's a video loaded on a deck) */}
        {hasVideo && (
          <>
            <button
              className="vdj-btn"
              data-active={vrec}
              data-tone="danger"
              onClick={async () => {
                await ensureRunning();
                try {
                  if (vrec) {
                    const r = await stopVideoRecording();
                    if (r) {
                      await putRecording({
                        id: uid(),
                        name: `Video set ${new Date().toLocaleString()}`,
                        blob: r.blob,
                        mime: r.mime,
                        duration: r.duration,
                        createdAt: Date.now(),
                      });
                      setRecordings(await listRecordings());
                      toast.success(t("recVideoSaved"), { description: t("recVideoSavedDesc", { ext: r.ext.toUpperCase() }) });
                    }
                  } else {
                    const canvas = videoStageRef.current;
                    if (!canvas) {
                      toast.error(t("recVideoNeedsStage"));
                      return;
                    }
                    const ok = await startVideoRecording(canvas, 30);
                    if (ok) toast(t("recRecordingNow"), { description: t("recVideoStartedDesc") });
                    else toast.error(t("recVideoFailed"));
                  }
                } catch (error) {
                  console.error(error);
                  toast.error(t("recVideoError"));
                }
                force((x) => x + 1);
              }}
              style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 132, justifyContent: "center", minHeight: 40 }}
              title={t("recVideoTip")}
            >
              {vrec ? <Square size={12} /> : <Video size={14} />}
              {vrec ? t("recVideoStopBtn") : t("recVideoBtn")}
            </button>
            <span className="vdj-readout" style={{ color: vrec ? "var(--bad)" : "var(--text-3)", display: "flex", alignItems: "center" }}>
              {formatTime(videoRecordingElapsed())}
            </span>
          </>
        )}

        {/* Numpad target indicator */}
        <div className="vdj-panel-inset" style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px" }}>
          <Keyboard size={12} />
          <span className="vdj-label">{t("numpadArrow")}</span>
          <button className="vdj-btn" data-active={mixer.numpadDeck === "A"} style={{ padding: "2px 8px" }} onClick={() => setNumpadDeck("A")}>A</button>
          <button className="vdj-btn" data-active={mixer.numpadDeck === "B"} style={{ padding: "2px 8px" }} onClick={() => setNumpadDeck("B")}>B</button>
          <span className="vdj-label" style={{ opacity: 0.7 }}>{t("recNumpadToggleHint")}</span>
        </div>
      </div>

      {/* VOICE OVER ROW */}
      <div
        className="vdj-panel-inset"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: 10,
          flexWrap: "wrap",
          minHeight: 64,
          border: mixer.micOn ? "1px solid var(--bad)" : undefined,
          boxShadow: mixer.micOn ? "var(--beat-glow)" : "none",
          background: mixer.micOn ? "color-mix(in oklab, var(--bad) 8%, var(--surface-2))" : undefined,
        }}
      >
        <button
          className="vdj-btn"
          data-active={mixer.micOn && !micBusy}
          data-tone={mixer.micOn && !micBusy ? "live" : undefined}
          disabled={micBusy}
          title={micBusy ? t("micBusyOther") : t("recVoiceOverTitle")}
          onClick={async () => {
            if (micBusy) { toast(t("micBusyOther")); return; }
            const ok = await setMicOn(!mixer.micOn, "recorder");
            if (ok && !mixer.micOn) toast.success(t("recVoiceOverActive"), { description: t("recVoiceOverActiveDesc") });
            else if (mixer.micOn) toast(t("recVoiceOverOff"));
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 150,
            minHeight: 44,
            justifyContent: "center",
            fontWeight: 800,
            letterSpacing: "0.08em",
          }}
        >
          {mixer.micOn ? <Mic size={16} /> : <MicOff size={16} />}
          {t("recVoiceOverLabel")}
        </button>

        {mixer.micOn && (
          <span
            className="vdj-loaded-badge"
            data-tone="live"
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.18em",
              padding: "4px 10px",
              animation: "vdj-pulse 1s infinite",
            }}
          >
            {t("recOnAirDot")}
          </span>
        )}

        <label className="vdj-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {t("recLvl")}
          <input
            type="range"
            min={0}
            max={2}
            step={0.01}
            value={mixer.micLevel}
            onChange={(e) => setMicLevel(parseFloat(e.target.value))}
            style={{ width: 80 }}
          />
          <span className="vdj-readout" style={{ fontSize: 10, minWidth: 30 }}>{mixer.micLevel.toFixed(2)}</span>
        </label>
        <label className="vdj-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {t("recDuck")}
          <input
            type="range"
            min={0}
            max={0.9}
            step={0.01}
            value={mixer.micDuck}
            onChange={(e) => setMicDuck(parseFloat(e.target.value))}
            style={{ width: 80 }}
          />
          <span className="vdj-readout" style={{ fontSize: 10, minWidth: 30 }}>{Math.round(mixer.micDuck * 100)}%</span>
        </label>

        {/* Voice presets */}
        <div className="vdj-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Wand2 size={12} /> {t("recVoiceFx")}
          <select
            value={mixer.micPreset}
            onChange={(e) => {
              setVoicePreset(e.target.value);
              const p = VOICE_PRESETS.find((x) => x.id === e.target.value);
              if (p && p.id !== "off") toast(t("recVoicePresetToast", { label: p.label }));
            }}
            className="vdj-btn"
            style={{ padding: "4px 8px", fontFamily: "var(--font-mono)" }}
          >
            {VOICE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="vdj-panel-inset vdj-scroll" style={{ flex: 1, overflow: "auto", padding: 6 }}>
        {recordings.length === 0 && (
          <div
            style={{
              padding: "36px 16px",
              textAlign: "center",
              color: "var(--text-3)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "color-mix(in oklab, var(--bad) 14%, transparent)",
                color: "var(--bad)",
              }}
            >
              <Circle size={22} fill="currentColor" />
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>{t("recNoRecordings")}</div>
            <div style={{ fontSize: 11, maxWidth: 360, lineHeight: 1.5 }}>{t("recEmptyHint")}</div>
          </div>
        )}
        {recordings.map((r) => (
          <RecordingRow
            key={r.id}
            r={r}
            onDelete={async () => {
              await deleteRecording(r.id);
              setRecordings(await listRecordings());
            }}
          />
        ))}
      </div>
    </div>
  );
}
