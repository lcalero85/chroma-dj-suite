import { useEffect, useState } from "react";
import { useApp } from "@/state/store";
import { isRecording, recordingElapsed, startRecording, stopRecording } from "@/audio/recorder";
import { listRecordings, putRecording, deleteRecording, uid } from "@/lib/db";
import { ensureRunning } from "@/audio/engine";
import { formatTime } from "@/lib/format";
import { Circle, Square, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function RecorderPanel() {
  const recordings = useApp((s) => s.recordings);
  const setRecordings = useApp((s) => s.setRecordings);
  const [, force] = useState(0);

  useEffect(() => {
    listRecordings().then(setRecordings);
    const i = setInterval(() => force((x) => x + 1), 500);
    return () => clearInterval(i);
  }, [setRecordings]);

  const rec = isRecording();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          className="vdj-btn"
          data-active={rec}
          data-tone="danger"
          onClick={async () => {
            await ensureRunning();
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
                toast("Grabación guardada");
              }
            } else {
              startRecording();
              toast("Grabando…");
            }
            force((x) => x + 1);
          }}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          {rec ? <Square size={12} /> : <Circle size={12} fill="currentColor" />}
          {rec ? "Detener" : "Grabar"}
        </button>
        <span className="vdj-readout" style={{ color: rec ? "var(--bad)" : "var(--text-3)" }}>
          {formatTime(recordingElapsed())}
        </span>
      </div>
      <div className="vdj-panel-inset vdj-scroll" style={{ flex: 1, overflow: "auto", padding: 6 }}>
        {recordings.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-3)" }}>Sin grabaciones aún.</div>
        )}
        {recordings.map((r) => (
          <div
            key={r.id}
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
              <div className="vdj-label">{formatTime(r.duration)} · {(r.blob.size / 1024 / 1024).toFixed(1)} MB</div>
            </div>
            <audio src={URL.createObjectURL(r.blob)} controls style={{ height: 24 }} />
            <a className="vdj-btn" style={{ padding: "4px 6px" }} href={URL.createObjectURL(r.blob)} download={r.name + ".webm"}>
              <Download size={12} />
            </a>
            <button
              className="vdj-btn"
              style={{ padding: "4px 6px" }}
              onClick={async () => {
                await deleteRecording(r.id);
                setRecordings(await listRecordings());
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}