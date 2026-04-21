import { useApp } from "@/state/store";
import { Wifi, WifiOff, Radio } from "lucide-react";
import { startLiveStream, stopLiveStream } from "@/state/controller";
import { useT } from "@/lib/i18n";

export function StreamSettings() {
  const stream = useApp((s) => s.stream);
  const update = useApp((s) => s.updateStream);
  const t = useT();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="vdj-label" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <Radio size={12} /> {t("streamSectionTitle")}
      </div>

      <div className="vdj-panel-inset" style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        <Row label={t("streamEnable")}>
          <input
            type="checkbox"
            checked={stream.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
          />
        </Row>
        <Row label={t("streamAutoStart")}>
          <input
            type="checkbox"
            disabled={!stream.enabled}
            checked={stream.autoStartWithRadio}
            onChange={(e) => update({ autoStartWithRadio: e.target.checked })}
          />
        </Row>

        <Row label={t("streamServerUrl")}>
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
        <Row label={t("streamMount")}>
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
        <Row label={t("streamUser")}>
          <input
            type="text"
            disabled={!stream.enabled}
            value={stream.username}
            onChange={(e) => update({ username: e.target.value })}
            className="vdj-btn"
            style={{ width: 180, padding: "6px 8px", textAlign: "left" }}
          />
        </Row>
        <Row label={t("streamPassword")}>
          <input
            type="password"
            disabled={!stream.enabled}
            value={stream.password}
            onChange={(e) => update({ password: e.target.value })}
            className="vdj-btn"
            style={{ width: 180, padding: "6px 8px", textAlign: "left" }}
          />
        </Row>
        <Row label={t("streamBitrate")}>
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
        <Row label={t("streamFormat")}>
          <select
            className="vdj-btn"
            disabled={!stream.enabled}
            value={stream.format}
            onChange={(e) => update({ format: e.target.value as "webm-opus" | "ogg-opus" })}
          >
            <option value="webm-opus">{t("streamFormatWebm")}</option>
            <option value="ogg-opus">{t("streamFormatOgg")}</option>
          </select>
        </Row>

        <div style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />

        <Row label={t("streamStation")}>
          <input
            type="text"
            disabled={!stream.enabled}
            value={stream.stationName}
            onChange={(e) => update({ stationName: e.target.value })}
            className="vdj-btn"
            style={{ width: 220, padding: "6px 8px", textAlign: "left" }}
          />
        </Row>
        <Row label={t("streamGenre")}>
          <input
            type="text"
            disabled={!stream.enabled}
            value={stream.genre}
            onChange={(e) => update({ genre: e.target.value })}
            className="vdj-btn"
            style={{ width: 220, padding: "6px 8px", textAlign: "left" }}
          />
        </Row>
        <Row label={t("streamDescription")}>
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
              <WifiOff size={12} /> {t("streamStop")}
            </button>
          ) : (
            <button
              className="vdj-btn"
              disabled={!stream.enabled || stream.status === "connecting"}
              onClick={() => void startLiveStream()}
            >
              <Wifi size={12} /> {stream.status === "connecting" ? t("streamConnecting") : t("streamTest")}
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
          {t("streamHelp")}
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