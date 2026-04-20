import { useApp } from "@/state/store";
import { radioEnable, radioRemove, radioMove, radioClear, radioPlayIndex, radioNext } from "@/state/controller";
import { Radio, Play, SkipForward, Trash2, ChevronUp, ChevronDown, Shuffle, Power } from "lucide-react";
import { formatTime } from "@/lib/format";
import { toast } from "sonner";

export function RadioPanel() {
  const radio = useApp((s) => s.radio);
  const tracks = useApp((s) => s.tracks);
  const updateRadio = useApp((s) => s.updateRadio);
  const trackById = (id: string) => tracks.find((t) => t.id === id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      {/* Controls */}
      <div className="vdj-panel-inset" style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, flexWrap: "wrap" }}>
        <button
          className="vdj-btn"
          data-active={radio.enabled}
          data-tone={radio.enabled ? "live" : undefined}
          onClick={() => radioEnable(!radio.enabled)}
          style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 130, minHeight: 38, justifyContent: "center", fontWeight: 800, letterSpacing: "0.08em" }}
        >
          <Radio size={14} />
          {radio.enabled ? "RADIO ON" : "RADIO OFF"}
        </button>

        {radio.enabled && (
          <span className="vdj-loaded-badge" data-tone="live" style={{ animation: "vdj-pulse 1.2s infinite" }}>● TRANSMITIENDO</span>
        )}

        <button
          className="vdj-btn"
          onClick={() => void radioNext()}
          disabled={radio.queue.length === 0}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
          title="Siguiente pista (L)"
        >
          <SkipForward size={12} /> Siguiente
        </button>

        <button
          className="vdj-btn"
          data-active={radio.shuffle}
          onClick={() => updateRadio({ shuffle: !radio.shuffle })}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <Shuffle size={12} /> Aleatorio
        </button>

        <button
          className="vdj-btn"
          data-active={radio.autoCrossfade}
          onClick={() => updateRadio({ autoCrossfade: !radio.autoCrossfade })}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
          title="Encadenar pistas automáticamente"
        >
          <Power size={12} /> Auto-Mix
        </button>

        <span className="vdj-chip" style={{ marginLeft: "auto" }}>
          {radio.queue.length} en cola · Deck A
        </span>

        {radio.queue.length > 0 && (
          <button
            className="vdj-btn"
            onClick={() => {
              radioClear();
              toast("Cola vaciada");
            }}
            style={{ display: "flex", alignItems: "center", gap: 4 }}
          >
            <Trash2 size={12} /> Vaciar
          </button>
        )}
      </div>

      {/* Queue */}
      <div className="vdj-panel-inset vdj-scroll" style={{ flex: 1, overflow: "auto", padding: 6 }}>
        {radio.queue.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>
            Cola vacía. Añade pistas desde Library con el botón <b>📻</b>.
          </div>
        )}
        {radio.queue.map((tid, idx) => {
          const t = trackById(tid);
          const playing = idx === radio.currentIndex;
          return (
            <div
              key={tid + idx}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                borderTop: "1px solid var(--line)",
                background: playing ? "color-mix(in oklab, var(--accent) 12%, transparent)" : undefined,
              }}
            >
              <span className="vdj-readout" style={{ minWidth: 28, textAlign: "right", color: playing ? "var(--accent)" : "var(--text-3)" }}>
                {playing ? "▶" : String(idx + 1).padStart(2, "0")}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {t?.title ?? "(pista eliminada)"}
                </div>
                <div className="vdj-label">
                  {t?.artist || "—"} · {t ? formatTime(t.duration) : "0:00"} {t?.bpm ? `· ${t.bpm.toFixed(0)} BPM` : ""}
                </div>
              </div>
              <button className="vdj-btn" style={{ padding: "2px 6px" }} onClick={() => void radioPlayIndex(idx)} title="Reproducir esta">
                <Play size={10} />
              </button>
              <button className="vdj-btn" style={{ padding: "2px 6px" }} onClick={() => radioMove(idx, -1)} disabled={idx === 0}>
                <ChevronUp size={10} />
              </button>
              <button className="vdj-btn" style={{ padding: "2px 6px" }} onClick={() => radioMove(idx, 1)} disabled={idx === radio.queue.length - 1}>
                <ChevronDown size={10} />
              </button>
              <button className="vdj-btn" style={{ padding: "2px 6px" }} onClick={() => radioRemove(idx)}>
                <Trash2 size={10} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
