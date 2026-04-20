import { useEffect, useState } from "react";
import { useApp } from "@/state/store";
import { isRecording, recordingElapsed, startRecording, stopRecording } from "@/audio/recorder";
import { listRecordings, putRecording, deleteRecording, uid } from "@/lib/db";
import { ensureRunning } from "@/audio/engine";
import { formatTime } from "@/lib/format";
import { Circle, Square, Download, Trash2, Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { setMicOn, setMicLevel, setMicDuck } from "@/state/controller";

export function RecorderPanel() {
  const recordings = useApp((s) => s.recordings);
  const setRecordings = useApp((s) => s.setRecordings);
  const mixer = useApp((s) => s.mixer);
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
              await startRecording();
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
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <button
            className="vdj-btn"
            data-active={mixer.micOn}
            data-tone={mixer.micOn ? "live" : undefined}
            title="Voice-over (micrófono en vivo)"
            onClick={async () => {
              const ok = await setMicOn(!mixer.micOn);
              if (ok && !mixer.micOn) toast("Micrófono activo");
              else if (mixer.micOn) toast("Micrófono apagado");
            }}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            {mixer.micOn ? <Mic size={12} /> : <MicOff size={12} />}
            VOICE
          </button>
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