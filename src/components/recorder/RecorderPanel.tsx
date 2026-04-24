import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/state/store";
import { isRecording, recordingElapsed, startRecording, stopRecording } from "@/audio/recorder";
import { isVideoRecording, videoRecordingElapsed, startVideoRecording, stopVideoRecording } from "@/audio/videoRecorder";
import { videoStageRef } from "@/components/video/VideoStage";
import { listRecordings, putRecording, deleteRecording, uid } from "@/lib/db";
import { ensureRunning, VOICE_PRESETS } from "@/audio/engine";
import { formatTime } from "@/lib/format";
import { Circle, Square, Download, Trash2, Mic, MicOff, Wand2, Keyboard, Video, Search, FileAudio, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setMicOn, setMicLevel, setMicDuck, setVoicePreset, setNumpadDeck } from "@/state/controller";
import { useT, useFormatNumber } from "@/lib/i18n";
import { encodeBlobToMp3, mp3Bitrate, type Mp3Quality } from "@/audio/mp3Encode";

function fileExt(mime: string) {
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("webm") && mime.includes("video")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

function autoFilename(prefix: string, ext: string) {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `${prefix}_${stamp}.${ext}`;
}

function RecordingRow({
  r,
  onDelete,
}: {
  r: Awaited<ReturnType<typeof listRecordings>>[number];
  onDelete: () => Promise<void>;
}) {
  const url = useMemo(() => URL.createObjectURL(r.blob), [r.blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const isVideo = r.mime.startsWith("video/");
  const fmt = useFormatNumber();
  const t = useT();
  const [exporting, setExporting] = useState<null | Mp3Quality>(null);

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
        <div className="vdj-label">
          {new Date(r.createdAt).toLocaleString()} · {formatTime(r.duration)} ·{" "}
          {fmt(r.blob.size / 1024 / 1024, { maximumFractionDigits: 1 })} MB ·{" "}
          {fileExt(r.mime).toUpperCase()}
        </div>
      </div>
      {isVideo ? (
        <video src={url} controls preload="metadata" style={{ height: 80, maxWidth: "36%", borderRadius: 4, background: "#000" }} />
      ) : (
        <audio src={url} controls preload="auto" style={{ height: 32, width: 280, maxWidth: "36%" }} />
      )}
      <a
        className="vdj-btn"
        style={{ padding: "8px 10px", minHeight: 36 }}
        href={url}
        download={`${r.name}.${fileExt(r.mime)}`}
        title={t("recDownloadOriginalTip")}
      >
        <Download size={14} />
      </a>
      {!isVideo && fileExt(r.mime) !== "mp3" && (
        <select
          className="vdj-btn"
          disabled={!!exporting}
          value=""
          title={t("recExportMp3Tip")}
          onChange={async (e) => {
            const q = e.target.value as Mp3Quality;
            e.target.value = "";
            if (!q) return;
            try {
              setExporting(q);
              toast(t("recMp3Encoding", { kbps: String(mp3Bitrate(q)) }));
              const mp3 = await encodeBlobToMp3(r.blob, q);
              const a = document.createElement("a");
              const objUrl = URL.createObjectURL(mp3);
              a.href = objUrl;
              a.download = autoFilename(r.name.replace(/\s+/g, "_"), "mp3");
              document.body.appendChild(a);
              a.click();
              a.remove();
              setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
              toast.success(t("recMp3Ready", { kbps: String(mp3Bitrate(q)) }));
            } catch (err) {
              console.error(err);
              toast.error(t("recMp3Failed"));
            } finally {
              setExporting(null);
            }
          }}
          style={{ padding: "8px 10px", minHeight: 36, fontFamily: "var(--font-mono)" }}
        >
          <option value="">
            {exporting ? `MP3 ${mp3Bitrate(exporting)}…` : t("recExportMp3")}
          </option>
          <option value="low">MP3 · 128 kbps</option>
          <option value="medium">MP3 · 192 kbps</option>
          <option value="high">MP3 · 320 kbps</option>
        </select>
      )}
      <button
        className="vdj-btn"
        data-tone="danger"
        style={{ padding: "8px 10px", minHeight: 36 }}
        title={t("recDeleteTip")}
        onClick={() => {
          if (!window.confirm(t("recConfirmDelete", { name: r.name }))) return;
          void onDelete();
        }}
      >
        <Trash2 size={14} />
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
  const micActive = mixer.micOn && micOwner === "recorder";
  const micBusy = mixer.micOn && micOwner !== null && micOwner !== "recorder";
  const [, force] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "audio" | "video">("all");

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

  const filteredRecordings = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...recordings]
      .sort((a, b) => b.createdAt - a.createdAt)
      .filter((r) => {
        const isVideo = r.mime.startsWith("video/");
        if (filter === "audio" && isVideo) return false;
        if (filter === "video" && !isVideo) return false;
        if (!q) return true;
        return r.name.toLowerCase().includes(q);
      });
  }, [recordings, query, filter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      {/* TOP ROW: record + voice over banner */}
      <div style={{ display: "flex", alignItems: "stretch", gap: 10, flexWrap: "wrap" }}>
        <button
          className="vdj-btn"
          data-active={rec}
          data-tone="danger"
          title={rec ? t("recBtnStop") : t("recBtnStart")}
          onClick={async () => {
            await ensureRunning();
            try {
              if (rec) {
                const r = await stopRecording();
                if (r) {
                  await putRecording({
                    id: uid(),
                    name: autoFilename("Set", "wav").replace(/\.wav$/, ""),
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
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 140,
            justifyContent: "center",
            minHeight: 48,
            fontWeight: 800,
            letterSpacing: "0.06em",
            boxShadow: rec ? "0 0 0 2px var(--bad), var(--beat-glow)" : undefined,
            animation: rec ? "vdj-pulse 1.2s infinite" : undefined,
          }}
        >
          {rec ? <Square size={14} /> : <Circle size={14} fill="currentColor" />}
            {rec ? t("recBtnStop") : t("recBtnStart")}
        </button>
        <span
          className="vdj-readout"
          title={t("recElapsedTip")}
          style={{
            color: rec ? "var(--bad)" : "var(--text-3)",
            display: "flex",
            alignItems: "center",
            fontWeight: 700,
            minWidth: 86,
            justifyContent: "center",
          }}
        >
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
                        name: autoFilename("Video_set", r.ext).replace(new RegExp(`\\.${r.ext}$`), ""),
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
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                minWidth: 140,
                justifyContent: "center",
                minHeight: 48,
                fontWeight: 700,
                boxShadow: vrec ? "0 0 0 2px var(--bad), var(--beat-glow)" : undefined,
                animation: vrec ? "vdj-pulse 1.2s infinite" : undefined,
              }}
              title={t("recVideoTip")}
            >
              {vrec ? <Square size={14} /> : <Video size={16} />}
              {vrec ? t("recVideoStopBtn") : t("recVideoBtn")}
            </button>
            <span
              className="vdj-readout"
              style={{
                color: vrec ? "var(--bad)" : "var(--text-3)",
                display: "flex",
                alignItems: "center",
                fontWeight: 700,
                minWidth: 86,
                justifyContent: "center",
              }}
            >
              {formatTime(videoRecordingElapsed())}
            </span>
          </>
        )}

        {/* Numpad target indicator */}
        <div className="vdj-panel-inset" style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px" }}>
          <Keyboard size={12} />
          <span className="vdj-label">{t("numpadArrow")}</span>
          <button
            className="vdj-btn"
            data-active={mixer.numpadDeck === "A"}
            style={{ padding: "6px 12px", minWidth: 36, minHeight: 32 }}
            title={t("numpadTip")}
            onClick={() => setNumpadDeck("A")}
          >
            A
          </button>
          <button
            className="vdj-btn"
            data-active={mixer.numpadDeck === "B"}
            style={{ padding: "6px 12px", minWidth: 36, minHeight: 32 }}
            title={t("numpadTip")}
            onClick={() => setNumpadDeck("B")}
          >
            B
          </button>
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
          border: micActive ? "1px solid var(--bad)" : undefined,
          boxShadow: micActive ? "var(--beat-glow)" : "none",
          background: micActive ? "color-mix(in oklab, var(--bad) 8%, var(--surface-2))" : undefined,
        }}
      >
        <button
          className="vdj-btn"
          data-active={micActive}
          data-tone={micActive ? "live" : undefined}
          disabled={micBusy}
          title={micBusy ? t("micBusyOther") : t("recVoiceOverTitle")}
          onClick={async () => {
            if (micBusy) { toast(t("micBusyOther")); return; }
            const ok = await setMicOn(!micActive, "recorder");
            if (ok && !micActive) toast.success(t("recVoiceOverActive"), { description: t("recVoiceOverActiveDesc") });
            else if (micActive) toast(t("recVoiceOverOff"));
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
          {micActive ? <Mic size={16} /> : <MicOff size={16} />}
          {t("recVoiceOverLabel")}
        </button>

        {micActive && (
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

      {/* HISTORY TOOLBAR */}
      <div
        className="vdj-panel-inset"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          flexWrap: "wrap",
        }}
      >
        <FileAudio size={14} style={{ color: "var(--accent)" }} />
        <span className="vdj-label" style={{ fontWeight: 700 }}>
          {t("recHistoryTitle")} · {filteredRecordings.length}/{recordings.length}
        </span>
        <div style={{ flex: 1 }} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "var(--surface-2)",
            border: "1px solid var(--line)",
            borderRadius: 6,
            padding: "4px 8px",
            minHeight: 32,
          }}
        >
          <Search size={12} style={{ opacity: 0.7 }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("recSearchPlaceholder")}
            style={{
              background: "transparent",
              border: 0,
              outline: 0,
              color: "var(--text-1)",
              fontSize: 12,
              width: 180,
            }}
          />
        </div>
        <button
          className="vdj-btn"
          data-active={filter === "all"}
          style={{ padding: "6px 12px", minHeight: 32 }}
          onClick={() => setFilter("all")}
        >
          {t("recFilterAll")}
        </button>
        <button
          className="vdj-btn"
          data-active={filter === "audio"}
          style={{ padding: "6px 12px", minHeight: 32 }}
          onClick={() => setFilter("audio")}
        >
          {t("recFilterAudio")}
        </button>
        <button
          className="vdj-btn"
          data-active={filter === "video"}
          style={{ padding: "6px 12px", minHeight: 32 }}
          onClick={() => setFilter("video")}
        >
          {t("recFilterVideo")}
        </button>
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
        {recordings.length > 0 && filteredRecordings.length === 0 && (
          <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>
            <Loader2 size={16} style={{ opacity: 0 }} />
            <div>{t("recNoMatch")}</div>
          </div>
        )}
        {filteredRecordings.map((r) => (
          <RecordingRow
            key={r.id}
            r={r}
            onDelete={async () => {
              await deleteRecording(r.id);
              setRecordings(await listRecordings());
              toast.success(t("recDeleted"));
            }}
          />
        ))}
      </div>
    </div>
  );
}
