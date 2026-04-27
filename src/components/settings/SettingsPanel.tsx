import { useApp } from "@/state/store";
import { useT, LANG_LABELS, type Lang } from "@/lib/i18n";
import { MidiPanel } from "./MidiPanel";
import { StreamSettings } from "./StreamSettings";
import { ShortcutsSettings } from "./ShortcutsSettings";
import { AudioDevicesPanel } from "./AudioDevicesPanel";
import { CloudSyncPanel } from "./CloudSyncPanel";
import { VDJ_GENRES } from "@/audio/virtualDj";

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
      <Row label={t("djNameLabel")}>
        <input
          type="text"
          className="vdj-btn"
          style={{ width: 180, textAlign: "left", padding: "6px 8px" }}
          value={settings.djName ?? ""}
          maxLength={32}
          placeholder={t("djNamePlaceholder")}
          onChange={(e) => update({ djName: e.target.value })}
        />
      </Row>
      <Row label={t("showControllerLabel")}>
        <input
          type="checkbox"
          checked={settings.showControllerInTopbar !== false}
          onChange={(e) => update({ showControllerInTopbar: e.target.checked })}
        />
      </Row>
      <Row label={t("language")}>
        <select
          className="vdj-btn"
          value={settings.lang}
          onChange={(e) => update({ lang: e.target.value as Lang })}
          style={{ padding: "6px 8px" }}
        >
          {(["en", "es", "pt", "fr", "it"] as Lang[]).map((code) => (
            <option key={code} value={code}>{LANG_LABELS[code]}</option>
          ))}
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
      <Row label={t("autoGainLabel")}>
        <input
          type="checkbox"
          checked={settings.autoGainOnImport ?? true}
          onChange={(e) => update({ autoGainOnImport: e.target.checked })}
        />
      </Row>
      <Row label={t("autoCueLabel")}>
        <input
          type="checkbox"
          checked={settings.autoCueOnLoad ?? true}
          onChange={(e) => update({ autoCueOnLoad: e.target.checked })}
        />
      </Row>
      <Row label={t("visibleDecks")}>
        <select
          className="vdj-btn"
          value={settings.enabledDecks ?? 2}
          onChange={(e) => update({ enabledDecks: Number(e.target.value) as 2 | 4 })}
          style={{ padding: "6px 8px" }}
        >
          <option value={2}>{t("visibleDecks2")}</option>
          <option value={4}>{t("visibleDecks4")}</option>
        </select>
      </Row>
      <Row label={t("waveformStyle")}>
        <select
          className="vdj-btn"
          value={settings.waveformStyle ?? "classic"}
          onChange={(e) => update({ waveformStyle: e.target.value as "classic" | "bars" | "dual" })}
          style={{ padding: "6px 8px" }}
        >
          <option value="classic">{t("wfClassic")}</option>
          <option value="bars">{t("wfBars")}</option>
          <option value="dual">{t("wfDual")}</option>
        </select>
      </Row>
      <Row label={t("synthEnableLabel")}>
        <input
          type="checkbox"
          checked={settings.synthEnabled ?? false}
          onChange={(e) => update({ synthEnabled: e.target.checked })}
          title={t("synthEnableTip")}
        />
      </Row>
      <Row label={t("liveVocalEnableLabel")}>
        <input
          type="checkbox"
          checked={settings.liveVocalEnabled ?? false}
          onChange={(e) => update({ liveVocalEnabled: e.target.checked })}
          title={t("liveVocalEnableTip")}
        />
      </Row>
      <Row label={t("viewMode")}>
        <select
          className="vdj-btn"
          value={settings.viewMode ?? "studio"}
          onChange={(e) => update({ viewMode: e.target.value as "studio" | "booth" })}
          style={{ padding: "6px 8px" }}
          title={t("viewModeTip")}
        >
          <option value="studio">{t("viewModeStudio")}</option>
          <option value="booth">{t("viewModeBooth")}</option>
        </select>
      </Row>
      <Row label="AutoMix Pro panel">
        <input
          type="checkbox"
          checked={settings.automixProEnabled === true}
          onChange={(e) => update({ automixProEnabled: e.target.checked })}
          title="Show the AutoMix Pro engine + visual panel inside the Mixer"
        />
      </Row>
      <Row label="Smart Fader">
        <input
          type="checkbox"
          checked={settings.smartFaderEnabled === true}
          onChange={(e) => update({ smartFaderEnabled: e.target.checked })}
          title="Auto-rides the crossfader as the master deck nears its smart-exit point"
        />
      </Row>
      <div style={{ height: 1, background: "var(--panel-3, #1a1a1a)", margin: "8px 0" }} />
      <VirtualDjSettings />
      <div style={{ height: 1, background: "var(--panel-3, #1a1a1a)", margin: "8px 0" }} />
      <PanelVisibilityRows />
      <div style={{ height: 1, background: "var(--panel-3, #1a1a1a)", margin: "8px 0" }} />
      <CloudSyncPanel />
      <div style={{ height: 1, background: "var(--panel-3, #1a1a1a)", margin: "8px 0" }} />
      <ShortcutsSettings />
      <div style={{ height: 1, background: "var(--panel-3, #1a1a1a)", margin: "8px 0" }} />
      <AudioDevicesPanel />
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

function PanelVisibilityRows() {
  const settings = useApp((s) => s.settings);
  const update = useApp((s) => s.updateSettings);
  const t = useT();
  const vis = settings.panelVisibility ?? {};
  const setVis = (patch: Partial<NonNullable<typeof settings.panelVisibility>>) =>
    update({ panelVisibility: { ...vis, ...patch } });
  const items: { key: keyof NonNullable<typeof settings.panelVisibility>; label: string }[] = [
    { key: "online",    label: t("panelOnline") },
    { key: "radio",     label: t("panelRadio") },
    { key: "fx",        label: t("panelFx") },
    { key: "sampler",   label: t("panelSampler") },
    { key: "stems",     label: t("stemsLabel") },
    { key: "recorder",  label: t("panelRecorder") },
    { key: "presets",   label: t("panelPresets") },
    { key: "synth",     label: t("panelSynth") },
    { key: "livevocal", label: t("panelLiveVocal") },
    { key: "beatmaker", label: t("panelBeatMaker") },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.85 }}>{t("panelVisibility")}</div>
      <div style={{ fontSize: 11, opacity: 0.65 }}>{t("panelVisibilityHint")}</div>
      {items.map((it) => (
        <Row key={it.key} label={it.label}>
          <input
            type="checkbox"
            checked={vis[it.key] !== false}
            onChange={(e) => setVis({ [it.key]: e.target.checked })}
          />
        </Row>
      ))}
    </div>
  );
}

function VirtualDjSettings() {
  const settings = useApp((s) => s.settings);
  const update = useApp((s) => s.updateSettings);
  const tracks = useApp((s) => s.tracks);
  const enabled = settings.vdjEnabled === true;
  const selected = settings.vdjSelectedTrackIds ?? [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.85 }}>🎧 Virtual DJ</div>
      <div style={{ fontSize: 11, opacity: 0.65 }}>
        Marca canciones en la Library (columna VDJ) y deja que el Virtual DJ las mezcle profesionalmente.
      </div>
      <Row label="Habilitar Virtual DJ">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => update({ vdjEnabled: e.target.checked })}
        />
      </Row>
      <Row label="Género de la mezcla">
        <select
          className="vdj-btn"
          value={settings.vdjGenre ?? "auto"}
          onChange={(e) => update({ vdjGenre: e.target.value })}
          style={{ padding: "6px 8px", textTransform: "capitalize" }}
          disabled={!enabled}
        >
          {VDJ_GENRES.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </Row>
      <Row label="Grabar la sesión">
        <input
          type="checkbox"
          checked={settings.vdjRecord !== false}
          onChange={(e) => update({ vdjRecord: e.target.checked })}
          disabled={!enabled}
        />
      </Row>
      <Row label="Nombre de la sesión">
        <input
          type="text"
          className="vdj-btn"
          style={{ width: 180, textAlign: "left", padding: "6px 8px" }}
          value={settings.vdjSessionName ?? ""}
          maxLength={48}
          placeholder="(opcional — se usará la fecha)"
          onChange={(e) => update({ vdjSessionName: e.target.value })}
          disabled={!enabled}
        />
      </Row>
      <div style={{ fontSize: 11, opacity: 0.7, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Pistas seleccionadas: <b>{selected.length}</b> / {tracks.length}</span>
        {selected.length > 0 && (
          <button
            className="vdj-btn"
            style={{ fontSize: 10, padding: "4px 8px" }}
            onClick={() => update({ vdjSelectedTrackIds: [] })}
          >
            Vaciar selección
          </button>
        )}
      </div>
    </div>
  );
}