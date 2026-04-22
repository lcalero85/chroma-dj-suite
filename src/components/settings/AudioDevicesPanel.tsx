import { useEffect, useState, useCallback } from "react";
import { useApp } from "@/state/store";
import { useT } from "@/lib/i18n";
import {
  listAudioDevices,
  setAudioOutputDevice,
  setWebMonitoring,
  enableMic,
  disableMic,
} from "@/audio/engine";

export function AudioDevicesPanel() {
  const settings = useApp((s) => s.settings);
  const update = useApp((s) => s.updateSettings);
  const micOn = useApp((s) => s.mixer.micOn);
  const t = useT();

  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [setSinkSupported, setSetSinkSupported] = useState(true);
  const [permGranted, setPermGranted] = useState(false);

  const refresh = useCallback(async () => {
    const { inputs, outputs } = await listAudioDevices();
    setInputs(inputs);
    setOutputs(outputs);
    // Detect setSinkId support
    if (typeof window !== "undefined") {
      const audio = document.createElement("audio") as HTMLAudioElement & { setSinkId?: unknown };
      setSetSinkSupported(typeof audio.setSinkId === "function");
    }
    // If labels are non-empty, permission was granted
    setPermGranted(inputs.some((d) => !!d.label) || outputs.some((d) => !!d.label));
  }, []);

  useEffect(() => {
    refresh();
    if (typeof navigator !== "undefined" && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener?.("devicechange", refresh);
      return () => navigator.mediaDevices.removeEventListener?.("devicechange", refresh);
    }
  }, [refresh]);

  const requestPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((tr) => tr.stop());
      await refresh();
    } catch (e) {
      console.warn(e);
    }
  };

  const handleInputChange = async (deviceId: string) => {
    update({ audioInputDeviceId: deviceId });
    if (micOn) {
      // Restart mic on new device
      disableMic();
      await enableMic({
        deviceId: deviceId || undefined,
        noiseSuppression: settings.micNoiseSuppression ?? true,
        echoCancellation: settings.micEchoCancellation ?? true,
        autoGainControl: settings.micAutoGainControl ?? false,
      });
    }
  };

  const handleOutputChange = async (deviceId: string) => {
    update({ audioOutputDeviceId: deviceId });
    await setAudioOutputDevice(deviceId);
  };

  const handleWebMonitoring = (on: boolean) => {
    update({ webMonitoring: on });
    setWebMonitoring(on);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: 1 }}>
        {t("audioInterface")}
      </div>

      {!permGranted && (
        <div
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            gap: 12, padding: "6px 8px",
            background: "var(--panel-2, #141414)", borderRadius: 6,
          }}
        >
          <span style={{ fontSize: 11, opacity: 0.85 }}>{t("audioGrantPerm")}</span>
          <button className="vdj-btn" style={{ padding: "4px 10px" }} onClick={requestPermission}>
            {t("audioGrantBtn")}
          </button>
        </div>
      )}

      <Row label={t("audioInput")}>
        <select
          className="vdj-btn"
          style={{ padding: "6px 8px", minWidth: 220 }}
          value={settings.audioInputDeviceId ?? ""}
          onChange={(e) => handleInputChange(e.target.value)}
        >
          <option value="">{t("audioDeviceDefault")}</option>
          {inputs.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Input ${d.deviceId.slice(0, 6)}`}
            </option>
          ))}
        </select>
      </Row>

      <Row label={t("audioOutput")}>
        <select
          className="vdj-btn"
          style={{ padding: "6px 8px", minWidth: 220 }}
          value={settings.audioOutputDeviceId ?? ""}
          onChange={(e) => handleOutputChange(e.target.value)}
          disabled={!setSinkSupported}
          title={!setSinkSupported ? t("audioSinkUnsupported") : undefined}
        >
          <option value="">{t("audioDeviceDefault")}</option>
          {outputs.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Output ${d.deviceId.slice(0, 6)}`}
            </option>
          ))}
        </select>
      </Row>
      {!setSinkSupported && (
        <div style={{ fontSize: 10, opacity: 0.6, marginTop: -6 }}>
          {t("audioSinkUnsupported")}
        </div>
      )}

      <Row label={t("audioWebMonitoring")}>
        <input
          type="checkbox"
          checked={settings.webMonitoring ?? true}
          onChange={(e) => handleWebMonitoring(e.target.checked)}
          title={t("audioWebMonitoringTip")}
        />
      </Row>

      <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: 1, marginTop: 4 }}>
        {t("audioMicProcessing")}
      </div>

      <Row label={t("audioNoiseSuppression")}>
        <input
          type="checkbox"
          checked={settings.micNoiseSuppression ?? true}
          onChange={(e) => update({ micNoiseSuppression: e.target.checked })}
          title={t("audioNoiseSuppressionTip")}
        />
      </Row>
      <Row label={t("audioEchoCancellation")}>
        <input
          type="checkbox"
          checked={settings.micEchoCancellation ?? true}
          onChange={(e) => update({ micEchoCancellation: e.target.checked })}
        />
      </Row>
      <Row label={t("audioAutoGainControl")}>
        <input
          type="checkbox"
          checked={settings.micAutoGainControl ?? false}
          onChange={(e) => update({ micAutoGainControl: e.target.checked })}
        />
      </Row>
      {micOn && (
        <div style={{ fontSize: 10, opacity: 0.6 }}>{t("audioMicRestartHint")}</div>
      )}
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