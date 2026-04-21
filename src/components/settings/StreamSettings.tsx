import { useApp } from "@/state/store";
import { Wifi, WifiOff, Radio } from "lucide-react";
import { startLiveStream, stopLiveStream } from "@/state/controller";

export function StreamSettings() {
  const stream = useApp((s) => s.stream);
  const update = useApp((s) => s.updateStream);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="vdj-label" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <Radio size={12} /> Radio en vivo (transmisión por Internet)
      </div>

      <div className="vdj-panel-inset" style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        <Row label="Activar transmisión">
          <input
            type="checkbox"
            checked={stream.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
          />
        </Row>
        <Row label="Auto-iniciar con Radio ON">
          <input
            type="checkbox"
            disabled={!stream.enabled}
            checked={stream.autoStartWithRadio}
            onChange={(e) => update({ autoStartWithRadio: e.target.checked })}
          />
        </Row>

        <Row label="URL del servidor">
          <input
            type="url"
            disabled={!stream.enabled}
            placeholder="https://mi-icecast.example.com:8000"
            value={stream.serverUrl}
            onChange={(e) => update({ serverUrl: e.target.value })}
            className="vdj-btn"
            style={{ width: 280, padding: "6px 8px", textAlign: "left" }}
          />
        </Row>
        <Row label="Mount point">
          <input
            type="text"
            disabled={!stream.enabled}
            placeholder="/stream"
            value={stream.mount}
            onChange={(e) => update({ mount: e.target.value })}
            className="vdj-btn"
            style={{ width: 180, padding: "6px 8px", textAlign: "left" }}
          />
        </Row>
        <Row label="Usuario (source)">
          <input
            type="text"
            disabled={!stream.enabled}
            value={stream.username}
            onChange={(e) => update({ username: e.target.value })}
            className="vdj-btn"
            style={{ width: 180, padding: "6px 8px", textAlign: "left" }}
          />
        </Row>
        <Row label="Contraseña">
          <input
            type="password"
            disabled={!stream.enabled}
            value={stream.password}
            onChange={(e) => update({ password: e.target.value })}
            className="vdj-btn"
            style={{ width: 180, padding: "6px 8px", textAlign: "left" }}
          />
        </Row>
        <Row label="Bitrate (kbps)">
          <select
            className="vdj-btn"
            disabled={!stream.enabled}
            value={stream.bitrate}
            onChange={(e) => update({ bitrate: Number(e.target.value) as 64 | 96 | 128 | 192 | 256 })}
          >
            {[64, 96, 128, 192, 256].map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </Row>
        <Row label="Formato">
          <select
            className="vdj-btn"
            disabled={!stream.enabled}
            value={stream.format}
            onChange={(e) => update({ format: e.target.value as "webm-opus" | "ogg-opus" })}
          >
            <option value="webm-opus">WebM / Opus (recomendado)</option>
            <option value="ogg-opus">Ogg / Opus</option>
          </select>
        </Row>

        <div style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />

        <Row label="Nombre de la estación">
          <input
            type="text"
            disabled={!stream.enabled}
            value={stream.stationName}
            onChange={(e) => update({ stationName: e.target.value })}
            className="vdj-btn"
            style={{ width: 220, padding: "6px 8px", textAlign: "left" }}
          />
        </Row>
        <Row label="Género">
          <input
            type="text"
            disabled={!stream.enabled}
            value={stream.genre}
            onChange={(e) => update({ genre: e.target.value })}
            className="vdj-btn"
            style={{ width: 220, padding: "6px 8px", textAlign: "left" }}
          />
        </Row>
        <Row label="Descripción">
          <input
            type="text"
            disabled={!stream.enabled}
            value={stream.description}
            onChange={(e) => update({ description: e.target.value })}
            className="vdj-btn"
            style={{ width: 280, padding: "6px 8px", textAlign: "left" }}
          />
        </Row>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          {stream.status === "live" ? (
            <button className="vdj-btn" data-tone="live" onClick={() => void stopLiveStream()}>
              <WifiOff size={12} /> Detener transmisión
            </button>
          ) : (
            <button
              className="vdj-btn"
              disabled={!stream.enabled || stream.status === "connecting"}
              onClick={() => void startLiveStream()}
            >
              <Wifi size={12} /> {stream.status === "connecting" ? "Conectando…" : "Probar transmisión"}
            </button>
          )}
          <span className="vdj-chip" data-tone={stream.status === "live" ? "live" : undefined}>
            {stream.status.toUpperCase()}
          </span>
          {stream.lastError && (
            <span style={{ fontSize: 10, color: "var(--danger, #ff3b6b)" }}>{stream.lastError}</span>
          )}
        </div>

        <div style={{ fontSize: 10, color: "var(--text-3)", lineHeight: 1.5, marginTop: 4 }}>
          Compatible con Icecast 2.4+ (PUT). El audio enviado es el del MASTER (incluye micrófono).
          Tu navegador no puede conectarse directamente a Icecast por restricciones del estándar, así que la app
          relaya el audio a través de tu servidor de Lovable Cloud antes de reenviarlo al servidor de transmisión.
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 12 }}>{label}</span>
      <div>{children}</div>
    </div>
  );
}