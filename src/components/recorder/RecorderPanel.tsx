import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/state/store";
import { isRecording, recordingElapsed, startRecording, stopRecording } from "@/audio/recorder";
import { listRecordings, putRecording, deleteRecording, uid } from "@/lib/db";
import { ensureRunning } from "@/audio/engine";
import { formatTime } from "@/lib/format";
import { Circle, Square, Download, Trash2, Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { setMicOn, setMicLevel, setMicDuck } from "@/state/controller";

function fileExt(mime: string) {
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

function RecordingRow({ r, onDelete }: { r: Awaited<ReturnType<typeof listRecordings>>[number]; onDelete: () => Promise<void> }) {
  const url = useMemo(() => URL.createObjectURL(r.blob), [r.blob]);

  useEffect(() => {
    return () => URL.revokeObjectURL(url);
  }, [url]);

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
        <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
        <div className="vdj-label">{formatTime(r.duration)} · {(r.blob.size / 1024 / 1024).toFixed(1)} MB · {fileExt(r.mime).toUpperCase()}</div>
      </div>
      <audio src={url} controls preload="metadata" style={{ height: 28, width: 320, maxWidth: "40%" }} />
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
  const recordings = useApp((s) => s.recordings);
  const setRecordings = useApp((s) => s.setRecordings);
  const mixer = useApp((s) => s.mixer);
  const [, force] = useState(0);

  useEffect(() => {
    listRecordings().then(setRecordings);
  }, [setRecordings]);

  const rec = isRecording();

  useEffect(() => {
    if (!rec) return;
    const i = setInterval(() => force((x) => x + 1), 250);
    return () => clearInterval(i);
  }, [rec]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
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
                  toast.success("Grabación guardada", { description: `Archivo ${fileExt(r.mime).toUpperCase()} listo para reproducir.` });
                }
              } else {
                await startRecording();
                toast("Grabando…", { description: "Se capturará el master completo y el voice-over." });
              }
            } catch (error) {
              console.error(error);
              toast.error("No se pudo iniciar la grabación");
            }
            force((x) => x + 1);
          }}
          style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 122, justifyContent: "center", minHeight: 40 }}
        >
          {rec ? <Square size={12} /> : <Circle size={12} fill="currentColor" />}
          {rec ? "Detener" : "Grabar"}
        </button>
        <span className="vdj-readout" style={{ color: rec ? "var(--bad)" : "var(--text-3)" }}>
          {formatTime(recordingElapsed())}
        </span>
        <div
          className="vdj-panel-inset"
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: 8,
            flexWrap: "wrap",
            minHeight: 56,
          }}
        >
          <button
            className="vdj-btn"
            data-active={mixer.micOn}
            data-tone={mixer.micOn ? "live" : undefined}
            title="Voice-over (micrófono en vivo)"
            onClick={async () => {
              const ok = await setMicOn(!mixer.micOn);
              if (ok && !mixer.micOn) toast.success("Micrófono activo", { description: "Tu voz entra al master y a la grabación." });
              else if (mixer.micOn) toast("Micrófono apagado");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              minWidth: 138,
              minHeight: 40,
              justifyContent: "center",
              boxShadow: mixer.micOn ? "var(--beat-glow)" : "none",
            }}
          >
            {mixer.micOn ? <Mic size={14} /> : <MicOff size={14} />}
            VOICE OVER
          </button>
          <span className="vdj-loaded-badge" data-tone="live" style={{ animation: mixer.micOn ? undefined : "none", opacity: mixer.micOn ? 1 : 0.65 }}>
            {mixer.micOn ? "EN VIVO" : "MIC OFF"}
          </span>
          <label className="vdj-label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            LVL
            <input
              type="range"
              min={0}
              max={2}
              step={0.01}
              value={mixer.micLevel}
              onChange={(e) => setMicLevel(parseFloat(e.target.value))}
              style={{ width: 70 }}
            />
          </label>
          <label className="vdj-label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            DUCK
            <input
              type="range"
              min={0}
              max={0.9}
              step={0.01}
              value={mixer.micDuck}
              onChange={(e) => setMicDuck(parseFloat(e.target.value))}
              style={{ width: 70 }}
            />
          </label>
        </div>
      </div>
      <div className="vdj-panel-inset vdj-scroll" style={{ flex: 1, overflow: "auto", padding: 6 }}>
        {recordings.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-3)" }}>Sin grabaciones aún.</div>
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