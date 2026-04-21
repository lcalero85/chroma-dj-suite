import { useApp } from "@/state/store";
import { useT } from "@/lib/i18n";
import { MidiPanel } from "./MidiPanel";
import { StreamSettings } from "./StreamSettings";
import { ShortcutsSettings } from "./ShortcutsSettings";

export function SettingsPanel() {
  const settings = useApp((s) => s.settings);
  const update = useApp((s) => s.updateSettings);
  const t = useT();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Row label={t("appName")}>
        <input
          type="text"
          className="vdj-btn"
          style={{ width: 180, textAlign: "left", padding: "6px 8px" }}
          value={settings.appName}
          maxLength={32}
          placeholder="VDJ PRO"
          onChange={(e) => update({ appName: e.target.value })}
        />
      </Row>
      <Row label={t("language")}>
        <select
          className="vdj-btn"
          value={settings.lang}
          onChange={(e) => update({ lang: e.target.value as "en" | "es" })}
          style={{ padding: "6px 8px" }}
        >
          <option value="en">{t("english")}</option>
          <option value="es">{t("spanish")}</option>
        </select>
      </Row>
      <Row label={t("appMode")}>
        <select
          className="vdj-btn"
          value={settings.appMode}
          onChange={(e) => update({ appMode: e.target.value as "basic" | "advanced" })}
          style={{ padding: "6px 8px" }}
        >
          <option value="basic">{t("basic")}</option>
          <option value="advanced">{t("advanced")}</option>
        </select>
      </Row>
      <Row label={t("animations")}>
        <input type="checkbox" checked={settings.animations} onChange={(e) => update({ animations: e.target.checked })} />
      </Row>
      <Row label={t("tooltips")}>
        <input type="checkbox" checked={settings.tooltips} onChange={(e) => update({ tooltips: e.target.checked })} />
      </Row>
      <Row label={t("defaultKeyLock")}>
        <input type="checkbox" checked={settings.defaultKeyLock} onChange={(e) => update({ defaultKeyLock: e.target.checked })} />
      </Row>
      <Row label={t("defaultPitchRange")}>
        <select
          className="vdj-btn"
          value={settings.defaultPitchRange}
          onChange={(e) => update({ defaultPitchRange: Number(e.target.value) as 8 | 16 | 50 })}
        >
          <option value={8}>±8%</option>
          <option value={16}>±16%</option>
          <option value={50}>±50%</option>
        </select>
      </Row>
      <div style={{ height: 1, background: "var(--panel-3, #1a1a1a)", margin: "8px 0" }} />
      <ShortcutsSettings />
      <div style={{ height: 1, background: "var(--panel-3, #1a1a1a)", margin: "8px 0" }} />
      <MidiPanel />
      <div style={{ height: 1, background: "var(--panel-3, #1a1a1a)", margin: "8px 0" }} />
      <StreamSettings />
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