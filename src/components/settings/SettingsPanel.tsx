import { useApp } from "@/state/store";
import { useT, LANG_LABELS, type Lang } from "@/lib/i18n";
import { MidiPanel } from "./MidiPanel";
import { StreamSettings } from "./StreamSettings";
import { ShortcutsSettings } from "./ShortcutsSettings";
import { AudioDevicesPanel } from "./AudioDevicesPanel";
import { CloudSyncPanel } from "./CloudSyncPanel";
import { VDJ_GENRES } from "@/audio/virtualDj";
import { useVt } from "@/lib/i18n/vdj";
import type { SkinId } from "@/state/store";

const VDJ_SKIN_OPTIONS: SkinId[] = [
  "pioneer", "serato", "neon", "glass", "minimal", "retro", "studio", "cyber",
  "vinyl", "hacker", "midnight", "sunset", "arctic", "blood", "gold", "ocean",
  "lava", "forest", "candy", "matrix", "royal", "bigjogs",
  "bigjogs-neon", "bigjogs-gold", "bigjogs-ocean", "bigjogs-blood", "bigjogs-forest",
  "xl-bubblegum", "xl-vaporwave", "xl-tropical", "xl-skater", "xl-icecream", "xl-galaxy",
];

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
      <Row label={t("autoMixProPanel")}>
        <input
          type="checkbox"
          checked={settings.automixProEnabled === true}
          onChange={(e) => update({ automixProEnabled: e.target.checked })}
          title={t("autoMixProPanelTip")}
        />
      </Row>
      <Row label={t("smartFader")}>
        <input
          type="checkbox"
          checked={settings.smartFaderEnabled === true}
          onChange={(e) => update({ smartFaderEnabled: e.target.checked })}
          title={t("smartFaderTip")}
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
  const vt = useVt();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.85 }}>{vt("sectionTitle")}</div>
      <div style={{ fontSize: 11, opacity: 0.65 }}>
        {vt("sectionIntro")}
      </div>
      <Row label={vt("enableVdj")}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => update({ vdjEnabled: e.target.checked })}
        />
      </Row>
      <Row label={vt("mixGenre")}>
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
      <Row label={vt("recordSession")}>
        <input
          type="checkbox"
          checked={settings.vdjRecord !== false}
          onChange={(e) => update({ vdjRecord: e.target.checked })}
          disabled={!enabled}
        />
      </Row>
      <Row label={vt("screenRecord")}>
        <input
          type="checkbox"
          checked={settings.vdjScreenRecord === true}
          onChange={(e) => update({ vdjScreenRecord: e.target.checked })}
          disabled={!enabled}
          title={vt("screenRecordTip")}
        />
      </Row>
      <Row label={vt("sessionName")}>
        <input
          type="text"
          className="vdj-btn"
          style={{ width: 180, textAlign: "left", padding: "6px 8px" }}
          value={settings.vdjSessionName ?? ""}
          maxLength={48}
          placeholder={vt("sessionNamePh")}
          onChange={(e) => update({ vdjSessionName: e.target.value })}
          disabled={!enabled}
        />
      </Row>
      <div style={{ height: 1, background: "var(--panel-3, #1a1a1a)", margin: "6px 0" }} />
      <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 600 }}>
        {vt("behavior")}
      </div>
      <Row label={vt("intensity")}>
        <select
          className="vdj-btn"
          value={settings.vdjIntensity ?? "normal"}
          onChange={(e) => update({ vdjIntensity: e.target.value as "soft" | "normal" | "hard" })}
          style={{ padding: "6px 8px" }}
          disabled={!enabled}
          title={vt("intensityTip")}
        >
          <option value="soft">{vt("intensitySoft")}</option>
          <option value="normal">{vt("intensityNormal")}</option>
          <option value="hard">{vt("intensityHard")}</option>
        </select>
      </Row>
      <Row label={vt("shuffle")}>
        <input
          type="checkbox"
          checked={settings.vdjShuffle === true}
          onChange={(e) => update({ vdjShuffle: e.target.checked })}
          disabled={!enabled}
          title={vt("shuffleTip")}
        />
      </Row>
      <Row label={vt("cutAt")}>
        <input
          type="number"
          className="vdj-btn"
          style={{ width: 80, textAlign: "right", padding: "6px 8px" }}
          value={Math.round((settings.vdjCutAtPct ?? 0.75) * 100)}
          min={50}
          max={95}
          step={1}
          onChange={(e) => update({ vdjCutAtPct: Math.max(0.5, Math.min(0.95, Number(e.target.value) / 100)) })}
          disabled={!enabled}
          title={vt("cutAtTip")}
        />
      </Row>
      <Row label={vt("xfadeSec")}>
        <input
          type="number"
          className="vdj-btn"
          style={{ width: 80, textAlign: "right", padding: "6px 8px" }}
          value={settings.vdjXfadeSec ?? 0}
          min={0}
          max={30}
          step={1}
          onChange={(e) => update({ vdjXfadeSec: Math.max(0, Math.min(30, Number(e.target.value))) })}
          disabled={!enabled}
          title={vt("xfadeAuto")}
        />
      </Row>
      <Row label={vt("syncBpm")}>
        <input
          type="checkbox"
          checked={settings.vdjSyncBpm !== false}
          onChange={(e) => update({ vdjSyncBpm: e.target.checked })}
          disabled={!enabled}
        />
      </Row>
      <Row label={vt("autoGain")}>
        <input
          type="checkbox"
          checked={settings.vdjAutoGain !== false}
          onChange={(e) => update({ vdjAutoGain: e.target.checked })}
          disabled={!enabled}
        />
      </Row>
      <Row label={vt("useFx")}>
        <input
          type="checkbox"
          checked={settings.vdjUseFx !== false}
          onChange={(e) => update({ vdjUseFx: e.target.checked })}
          disabled={!enabled}
        />
      </Row>
      <Row label={vt("useLoops")}>
        <input
          type="checkbox"
          checked={settings.vdjUseLoops !== false}
          onChange={(e) => update({ vdjUseLoops: e.target.checked })}
          disabled={!enabled}
        />
      </Row>
      <Row label={vt("useHotCues")}>
        <input
          type="checkbox"
          checked={settings.vdjUseHotCues !== false}
          onChange={(e) => update({ vdjUseHotCues: e.target.checked })}
          disabled={!enabled}
        />
      </Row>
      <Row label={vt("useScratch")}>
        <input
          type="checkbox"
          checked={settings.vdjUseScratch !== false}
          onChange={(e) => update({ vdjUseScratch: e.target.checked })}
          disabled={!enabled}
        />
      </Row>
      <Row label={vt("usePitchBend")}>
        <input
          type="checkbox"
          checked={settings.vdjUsePitchBend !== false}
          onChange={(e) => update({ vdjUsePitchBend: e.target.checked })}
          disabled={!enabled}
        />
      </Row>
      <Row label={vt("useSpice")}>
        <input
          type="checkbox"
          checked={settings.vdjUseSpice !== false}
          onChange={(e) => update({ vdjUseSpice: e.target.checked })}
          disabled={!enabled}
          title={vt("useSpiceTip")}
        />
      </Row>
      <Row label={vt("announceDj")}>
        <input
          type="checkbox"
          checked={settings.vdjAnnounceDj !== false}
          onChange={(e) => update({ vdjAnnounceDj: e.target.checked })}
          disabled={!enabled}
          title={vt("announceDjTip")}
        />
      </Row>
      <Row label={vt("announceMode")}>
        <select
          className="vdj-btn"
          value={settings.vdjAnnounceMode ?? "mid"}
          onChange={(e) => update({ vdjAnnounceMode: e.target.value as "start" | "every" | "mid" })}
          style={{ padding: "6px 8px" }}
          disabled={!enabled || settings.vdjAnnounceDj === false}
        >
          <option value="start">{vt("announceStart")}</option>
          <option value="mid">{vt("announceMid")}</option>
          <option value="every">{vt("announceEvery")}</option>
        </select>
      </Row>
      <Row label={vt("announceVol")}>
        <input
          type="range"
          min={0}
          max={0.6}
          step={0.02}
          value={settings.vdjAnnounceVolume ?? 0.18}
          onChange={(e) => update({ vdjAnnounceVolume: Number(e.target.value) })}
          disabled={!enabled || settings.vdjAnnounceDj === false}
          style={{ width: 120 }}
        />
      </Row>
      <Row label={vt("outroPro")}>
        <input
          type="checkbox"
          checked={settings.vdjUseOutro !== false}
          onChange={(e) => update({ vdjUseOutro: e.target.checked })}
          disabled={!enabled}
        />
      </Row>
      <Row label={vt("brakeSec")}>
        <input
          type="number"
          className="vdj-btn"
          style={{ width: 80, textAlign: "right", padding: "6px 8px" }}
          value={settings.vdjBrakeSec ?? 3.5}
          min={1}
          max={8}
          step={0.5}
          onChange={(e) => update({ vdjBrakeSec: Math.max(1, Math.min(8, Number(e.target.value))) })}
          disabled={!enabled || settings.vdjUseOutro === false}
        />
      </Row>
      <div style={{ height: 1, background: "var(--panel-3, #1a1a1a)", margin: "6px 0" }} />
      <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 600 }}>
        {vt("advanced173")}
      </div>
      <Row label={vt("energyCurve")}>
        <input
          type="checkbox"
          checked={settings.vdjEnergyCurve === true}
          onChange={(e) => update({ vdjEnergyCurve: e.target.checked })}
          disabled={!enabled}
          title={vt("energyCurveTip")}
        />
      </Row>
      <Row label={vt("energyShape")}>
        <select
          className="vdj-btn"
          value={settings.vdjEnergyShape ?? "arc"}
          onChange={(e) => update({ vdjEnergyShape: e.target.value as "arc" | "ascending" | "descending" | "wave" })}
          style={{ padding: "6px 8px" }}
          disabled={!enabled || settings.vdjEnergyCurve !== true}
        >
          <option value="arc">{vt("shapeArc")}</option>
          <option value="ascending">{vt("shapeAsc")}</option>
          <option value="descending">{vt("shapeDesc")}</option>
          <option value="wave">{vt("shapeWave")}</option>
        </select>
      </Row>
      <Row label={vt("echoFreeze")}>
        <input
          type="checkbox"
          checked={settings.vdjEchoFreeze === true}
          onChange={(e) => update({ vdjEchoFreeze: e.target.checked })}
          disabled={!enabled}
          title={vt("echoFreezeTip")}
        />
      </Row>
      <Row label={vt("echoFreezeProb")}>
        <input
          type="number"
          className="vdj-btn"
          style={{ width: 80, textAlign: "right", padding: "6px 8px" }}
          value={Math.round((settings.vdjEchoFreezeProb ?? 0.35) * 100)}
          min={0}
          max={100}
          step={5}
          onChange={(e) => update({ vdjEchoFreezeProb: Math.max(0, Math.min(1, Number(e.target.value) / 100)) })}
          disabled={!enabled || settings.vdjEchoFreeze !== true}
          title={vt("echoFreezeProbTip")}
        />
      </Row>
      <Row label={vt("phraseAlign")}>
        <input
          type="checkbox"
          checked={settings.vdjPhraseAlign === true}
          onChange={(e) => update({ vdjPhraseAlign: e.target.checked })}
          disabled={!enabled}
          title={vt("phraseAlignTip")}
        />
      </Row>
      <Row label={vt("phraseWindow")}>
        <input
          type="number"
          className="vdj-btn"
          style={{ width: 80, textAlign: "right", padding: "6px 8px" }}
          value={settings.vdjPhraseAlignWindowSec ?? 4}
          min={0.5}
          max={16}
          step={0.5}
          onChange={(e) => update({ vdjPhraseAlignWindowSec: Math.max(0.5, Math.min(16, Number(e.target.value))) })}
          disabled={!enabled || settings.vdjPhraseAlign !== true}
          title={vt("phraseWindowTip")}
        />
      </Row>
      <div style={{ height: 1, background: "var(--panel-3, #1a1a1a)", margin: "6px 0" }} />
      <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 600 }}>
        {vt("advanced174")}
      </div>
      <Row label={vt("mashup")}>
        <input
          type="checkbox"
          checked={settings.vdjMashup === true}
          onChange={(e) => update({ vdjMashup: e.target.checked })}
          disabled={!enabled}
          title={vt("mashupTip")}
        />
      </Row>
      <Row label={vt("mashupProb")}>
        <input
          type="number"
          className="vdj-btn"
          style={{ width: 80, textAlign: "right", padding: "6px 8px" }}
          value={Math.round((settings.vdjMashupProb ?? 0.25) * 100)}
          min={0}
          max={100}
          step={5}
          onChange={(e) => update({ vdjMashupProb: Math.max(0, Math.min(1, Number(e.target.value) / 100)) })}
          disabled={!enabled || settings.vdjMashup !== true}
        />
      </Row>
      <Row label={vt("mashupBars")}>
        <input
          type="number"
          className="vdj-btn"
          style={{ width: 80, textAlign: "right", padding: "6px 8px" }}
          value={settings.vdjMashupBars ?? 8}
          min={2}
          max={16}
          step={2}
          onChange={(e) => update({ vdjMashupBars: Math.max(2, Math.min(16, Number(e.target.value))) })}
          disabled={!enabled || settings.vdjMashup !== true}
        />
      </Row>
      <Row label={vt("stemAware")}>
        <input
          type="checkbox"
          checked={settings.vdjStemAware === true}
          onChange={(e) => update({ vdjStemAware: e.target.checked })}
          disabled={!enabled}
          title={vt("stemAwareTip")}
        />
      </Row>
      <Row label={vt("stemAmt")}>
        <input
          type="number"
          className="vdj-btn"
          style={{ width: 80, textAlign: "right", padding: "6px 8px" }}
          value={Math.round((settings.vdjStemVocalCutAmt ?? 0.85) * 100)}
          min={0}
          max={100}
          step={5}
          onChange={(e) => update({ vdjStemVocalCutAmt: Math.max(0, Math.min(1, Number(e.target.value) / 100)) })}
          disabled={!enabled || settings.vdjStemAware !== true}
        />
      </Row>
      <Row label={vt("battle")}>
        <input
          type="checkbox"
          checked={settings.vdjBattleMode === true}
          onChange={(e) => update({ vdjBattleMode: e.target.checked })}
          disabled={!enabled}
          title={vt("battleTip")}
        />
      </Row>
      <Row label={vt("battleProb")}>
        <input
          type="number"
          className="vdj-btn"
          style={{ width: 80, textAlign: "right", padding: "6px 8px" }}
          value={Math.round((settings.vdjBattleProb ?? 0.2) * 100)}
          min={0}
          max={100}
          step={5}
          onChange={(e) => update({ vdjBattleProb: Math.max(0, Math.min(1, Number(e.target.value) / 100)) })}
          disabled={!enabled || settings.vdjBattleMode !== true}
        />
      </Row>
      <Row label={vt("battleBars")}>
        <select
          className="vdj-btn"
          value={String(settings.vdjBattleBars ?? 4)}
          onChange={(e) => update({ vdjBattleBars: Number(e.target.value) as 4 | 8 | 16 })}
          style={{ padding: "6px 8px" }}
          disabled={!enabled || settings.vdjBattleMode !== true}
        >
          <option value="4">{vt("bars", { n: 4 })}</option>
          <option value="8">{vt("bars", { n: 8 })}</option>
          <option value="16">{vt("bars", { n: 16 })}</option>
        </select>
      </Row>
      <Row label={vt("battleRounds")}>
        <input
          type="number"
          className="vdj-btn"
          style={{ width: 80, textAlign: "right", padding: "6px 8px" }}
          value={settings.vdjBattleRounds ?? 4}
          min={2}
          max={8}
          step={1}
          onChange={(e) => update({ vdjBattleRounds: Math.max(2, Math.min(8, Number(e.target.value))) })}
          disabled={!enabled || settings.vdjBattleMode !== true}
        />
      </Row>
      <div style={{ height: 1, background: "var(--panel-3, #1a1a1a)", margin: "6px 0" }} />
      <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 600 }}>
        {vt("advanced175")}
      </div>

      {/* #6 Mic shoutouts */}
      <Row label={vt("micShoutout")}>
        <input
          type="checkbox"
          checked={settings.vdjMicShoutout === true}
          onChange={(e) => update({ vdjMicShoutout: e.target.checked })}
          disabled={!enabled}
          title={vt("micShoutoutTip")}
        />
      </Row>
      <Row label={vt("micThresh")}>
        <input
          type="number"
          className="vdj-btn"
          style={{ width: 80, textAlign: "right", padding: "6px 8px" }}
          value={Math.round((settings.vdjMicShoutoutThreshold ?? 0.12) * 100)}
          min={2} max={60} step={2}
          onChange={(e) => update({ vdjMicShoutoutThreshold: Math.max(0.02, Math.min(0.6, Number(e.target.value) / 100)) })}
          disabled={!enabled || settings.vdjMicShoutout !== true}
        />
      </Row>
      <Row label={vt("duckDepth")}>
        <input
          type="number"
          className="vdj-btn"
          style={{ width: 80, textAlign: "right", padding: "6px 8px" }}
          value={Math.round((settings.vdjMicShoutoutDuck ?? 0.55) * 100)}
          min={0} max={90} step={5}
          onChange={(e) => update({ vdjMicShoutoutDuck: Math.max(0, Math.min(0.9, Number(e.target.value) / 100)) })}
          disabled={!enabled || settings.vdjMicShoutout !== true}
        />
      </Row>

      {/* #8 Mood adaptive */}
      <Row label={vt("moodAdaptive")}>
        <input
          type="checkbox"
          checked={settings.vdjMoodAdaptive === true}
          onChange={(e) => update({ vdjMoodAdaptive: e.target.checked })}
          disabled={!enabled}
          title={vt("moodAdaptiveTip")}
        />
      </Row>
      <Row label={vt("moodEvery")}>
        <input
          type="number"
          className="vdj-btn"
          style={{ width: 80, textAlign: "right", padding: "6px 8px" }}
          value={settings.vdjMoodEveryN ?? 3}
          min={1} max={10} step={1}
          onChange={(e) => update({ vdjMoodEveryN: Math.max(1, Math.min(10, Number(e.target.value))) })}
          disabled={!enabled || settings.vdjMoodAdaptive !== true}
        />
      </Row>
      <Row label={vt("moodShape")}>
        <select
          className="vdj-btn"
          value={settings.vdjMoodShape ?? "arc"}
          onChange={(e) => update({ vdjMoodShape: e.target.value as "arc" | "ascending" | "descending" | "wave" })}
          style={{ padding: "6px 8px" }}
          disabled={!enabled || settings.vdjMoodAdaptive !== true}
        >
          <option value="arc">{vt("moodArc")}</option>
          <option value="ascending">{vt("shapeAsc")}</option>
          <option value="descending">{vt("shapeDesc")}</option>
          <option value="wave">{vt("moodWave")}</option>
        </select>
      </Row>

      {/* #9 Cue export */}
      <Row label={vt("exportCue")}>
        <input
          type="checkbox"
          checked={settings.vdjExportCue !== false}
          onChange={(e) => update({ vdjExportCue: e.target.checked })}
          disabled={!enabled}
          title={vt("exportCueTip")}
        />
      </Row>

      {/* #10 Auto stream */}
      <Row label={vt("autoStream")}>
        <input
          type="checkbox"
          checked={settings.vdjAutoStream === true}
          onChange={(e) => update({ vdjAutoStream: e.target.checked })}
          disabled={!enabled}
          title={vt("autoStreamTip")}
        />
      </Row>

      {/* #11 Beatjuggle */}
      <Row label={vt("beatjuggleLbl")}>
        <input
          type="checkbox"
          checked={settings.vdjBeatjuggle === true}
          onChange={(e) => update({ vdjBeatjuggle: e.target.checked })}
          disabled={!enabled}
          title={vt("beatjuggleTip")}
        />
      </Row>
      <Row label={vt("beatjuggleMaxBpm")}>
        <input
          type="number"
          className="vdj-btn"
          style={{ width: 80, textAlign: "right", padding: "6px 8px" }}
          value={settings.vdjBeatjuggleMaxBpm ?? 100}
          min={70} max={140} step={5}
          onChange={(e) => update({ vdjBeatjuggleMaxBpm: Math.max(70, Math.min(140, Number(e.target.value))) })}
          disabled={!enabled || settings.vdjBeatjuggle !== true}
        />
      </Row>
      <Row label={vt("beatjuggleProb")}>
        <input
          type="number"
          className="vdj-btn"
          style={{ width: 80, textAlign: "right", padding: "6px 8px" }}
          value={Math.round((settings.vdjBeatjuggleProb ?? 0.4) * 100)}
          min={0} max={100} step={5}
          onChange={(e) => update({ vdjBeatjuggleProb: Math.max(0, Math.min(1, Number(e.target.value) / 100)) })}
          disabled={!enabled || settings.vdjBeatjuggle !== true}
        />
      </Row>

      {/* #12 Radio show */}
      <Row label={vt("radioShow")}>
        <input
          type="checkbox"
          checked={settings.vdjRadioShow === true}
          onChange={(e) => update({ vdjRadioShow: e.target.checked })}
          disabled={!enabled}
          title={vt("radioShowTip")}
        />
      </Row>
      <Row label={vt("radioJingleEvery")}>
        <input
          type="number"
          className="vdj-btn"
          style={{ width: 80, textAlign: "right", padding: "6px 8px" }}
          value={settings.vdjRadioJingleEvery ?? 4}
          min={2} max={20} step={1}
          onChange={(e) => update({ vdjRadioJingleEvery: Math.max(2, Math.min(20, Number(e.target.value))) })}
          disabled={!enabled || settings.vdjRadioShow !== true}
        />
      </Row>
      <Row label={vt("radioJingleTrack")}>
        <select
          className="vdj-btn"
          value={settings.vdjRadioJingleTrackId ?? ""}
          onChange={(e) => update({ vdjRadioJingleTrackId: e.target.value || null })}
          style={{ padding: "6px 8px", maxWidth: 220 }}
          disabled={!enabled || settings.vdjRadioShow !== true}
        >
          <option value="">{vt("none")}</option>
          {tracks.map((t) => (
            <option key={t.id} value={t.id}>
              {(t.title || "{vt("untitled")}").slice(0, 40)}
              {t.artist ? ` · ${t.artist.slice(0, 20)}` : ""}
            </option>
          ))}
        </select>
      </Row>

      <div style={{ fontSize: 11, opacity: 0.7, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{vt("selectedCount")}: <b>{selected.length}</b> / {tracks.length}</span>
        {selected.length > 0 && (
          <button
            className="vdj-btn"
            style={{ fontSize: 10, padding: "4px 8px" }}
            onClick={() => update({ vdjSelectedTrackIds: [] })}
          >
            {vt("clearSelection")}
          </button>
        )}
      </div>
      <div style={{ height: 1, background: "var(--panel-3, #1a1a1a)", margin: "6px 0" }} />
      <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 600 }}>
        {vt("advancedPro")}
      </div>
      <Row label={vt("harmonic")}>
        <input type="checkbox" checked={settings.vdjHarmonicMixing === true}
          onChange={(e) => update({ vdjHarmonicMixing: e.target.checked })}
          disabled={!enabled} title={vt("harmonicTip")} />
      </Row>
      <Row label={vt("acapellaLayerLbl")}>
        <input type="checkbox" checked={settings.vdjAcapellaLayer === true}
          onChange={(e) => update({ vdjAcapellaLayer: e.target.checked })} disabled={!enabled} />
      </Row>
      <Row label={vt("acapellaProb")}>
        <input type="number" className="vdj-btn" style={{ width: 80, textAlign: "right", padding: "6px 8px" }}
          value={Math.round((settings.vdjAcapellaProb ?? 0.2) * 100)} min={0} max={100} step={5}
          onChange={(e) => update({ vdjAcapellaProb: Math.max(0, Math.min(1, Number(e.target.value) / 100)) })}
          disabled={!enabled || settings.vdjAcapellaLayer !== true} />
      </Row>
      <Row label={vt("acapellaBars")}>
        <input type="number" className="vdj-btn" style={{ width: 80, textAlign: "right", padding: "6px 8px" }}
          value={settings.vdjAcapellaBars ?? 4} min={1} max={8} step={1}
          onChange={(e) => update({ vdjAcapellaBars: Math.max(1, Math.min(8, Number(e.target.value))) })}
          disabled={!enabled || settings.vdjAcapellaLayer !== true} />
      </Row>
      <Row label={vt("loopRoll")}>
        <input type="checkbox" checked={settings.vdjLoopRoll === true}
          onChange={(e) => update({ vdjLoopRoll: e.target.checked })} disabled={!enabled} />
      </Row>
      <Row label={vt("loopRollProb")}>
        <input type="number" className="vdj-btn" style={{ width: 80, textAlign: "right", padding: "6px 8px" }}
          value={Math.round((settings.vdjLoopRollProb ?? 0.25) * 100)} min={0} max={100} step={5}
          onChange={(e) => update({ vdjLoopRollProb: Math.max(0, Math.min(1, Number(e.target.value) / 100)) })}
          disabled={!enabled || settings.vdjLoopRoll !== true} />
      </Row>
      <Row label={vt("energyMeter")}>
        <input type="checkbox" checked={settings.vdjEnergyMeter === true}
          onChange={(e) => update({ vdjEnergyMeter: e.target.checked })} disabled={!enabled} />
      </Row>
      <Row label={vt("reverseFx")}>
        <input type="checkbox" checked={settings.vdjReverseFx === true}
          onChange={(e) => update({ vdjReverseFx: e.target.checked })} disabled={!enabled} />
      </Row>
      <Row label={vt("reverseProb")}>
        <input type="number" className="vdj-btn" style={{ width: 80, textAlign: "right", padding: "6px 8px" }}
          value={Math.round((settings.vdjReverseFxProb ?? 0.15) * 100)} min={0} max={100} step={5}
          onChange={(e) => update({ vdjReverseFxProb: Math.max(0, Math.min(1, Number(e.target.value) / 100)) })}
          disabled={!enabled || settings.vdjReverseFx !== true} />
      </Row>
      <Row label={vt("reverseBars")}>
        <input type="number" className="vdj-btn" style={{ width: 80, textAlign: "right", padding: "6px 8px" }}
          value={settings.vdjReverseBars ?? 1} min={0.5} max={4} step={0.5}
          onChange={(e) => update({ vdjReverseBars: Math.max(0.5, Math.min(4, Number(e.target.value))) })}
          disabled={!enabled || settings.vdjReverseFx !== true} />
      </Row>
      <Row label={vt("dropBuilder")}>
        <input type="checkbox" checked={settings.vdjDropBuilder === true}
          onChange={(e) => update({ vdjDropBuilder: e.target.checked })} disabled={!enabled} />
      </Row>
      <Row label={vt("dropBuilderProb")}>
        <input type="number" className="vdj-btn" style={{ width: 80, textAlign: "right", padding: "6px 8px" }}
          value={Math.round((settings.vdjDropBuilderProb ?? 0.2) * 100)} min={0} max={100} step={5}
          onChange={(e) => update({ vdjDropBuilderProb: Math.max(0, Math.min(1, Number(e.target.value) / 100)) })}
          disabled={!enabled || settings.vdjDropBuilder !== true} />
      </Row>
      <Row label={vt("dropBuilderSec")}>
        <input type="number" className="vdj-btn" style={{ width: 80, textAlign: "right", padding: "6px 8px" }}
          value={settings.vdjDropBuilderSec ?? 4} min={2} max={8} step={0.5}
          onChange={(e) => update({ vdjDropBuilderSec: Math.max(2, Math.min(8, Number(e.target.value))) })}
          disabled={!enabled || settings.vdjDropBuilder !== true} />
      </Row>
      <Row label={vt("voiceCmd")}>
        <input type="checkbox" checked={settings.vdjVoiceCommands === true}
          onChange={(e) => update({ vdjVoiceCommands: e.target.checked })} disabled={!enabled}
          title={vt("voiceCmdTip")} />
      </Row>
      <Row label={vt("autoMashup")}>
        <input type="checkbox" checked={settings.vdjAutoMashup === true}
          onChange={(e) => update({ vdjAutoMashup: e.target.checked })} disabled={!enabled} />
      </Row>
      <Row label={vt("autoMashupEvery")}>
        <input type="number" className="vdj-btn" style={{ width: 80, textAlign: "right", padding: "6px 8px" }}
          value={settings.vdjAutoMashupEveryN ?? 6} min={2} max={20} step={1}
          onChange={(e) => update({ vdjAutoMashupEveryN: Math.max(2, Math.min(20, Number(e.target.value))) })}
          disabled={!enabled || settings.vdjAutoMashup !== true} />
      </Row>
      <Row label={vt("mixReportPdf")}>
        <input type="checkbox" checked={settings.vdjMixReport === true}
          onChange={(e) => update({ vdjMixReport: e.target.checked })} disabled={!enabled} />
      </Row>
      <SmartAutonomyRows />
    </div>
  );
}

function SmartAutonomyRows() {
  const settings = useApp((s) => s.settings);
  const update = useApp((s) => s.updateSettings);
  const enabled = settings.vdjEnabled === true;
  const vt = useVt();
  return (
    <>
      <div style={{ height: 1, background: "var(--panel-3, #1a1a1a)", margin: "6px 0" }} />
      <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 600 }}>{vt("smart")}</div>
      <Row label={vt("defaultSkin")}>
        <select
          className="vdj-btn"
          value={(settings.vdjDefaultSkin ?? "") as string}
          onChange={(e) => update({ vdjDefaultSkin: (e.target.value || "") as SkinId | "" })}
          style={{ padding: "6px 8px", maxWidth: 200 }}
          disabled={!enabled}
          title={vt("defaultSkinTip")}
        >
          <option value="">{vt("defaultSkinKeep")}</option>
          {VDJ_SKIN_OPTIONS.map((s) => (
            <option key={s} value={s} style={{ textTransform: "capitalize" }}>{s}</option>
          ))}
        </select>
      </Row>
      <Row label={vt("smartAutopilot")}>
        <input type="checkbox" checked={settings.vdjSmartAutopilot === true}
          onChange={(e) => update({ vdjSmartAutopilot: e.target.checked })}
          disabled={!enabled} title={vt("smartAutopilotTip")} />
      </Row>
      <Row label={vt("autoRecover")}>
        <input type="checkbox" checked={settings.vdjAutoRecover !== false}
          onChange={(e) => update({ vdjAutoRecover: e.target.checked })}
          disabled={!enabled} title={vt("autoRecoverTip")} />
      </Row>
      <Row label={vt("smartTighten")}>
        <input type="checkbox" checked={settings.vdjTightTransitions !== false}
          onChange={(e) => update({ vdjTightTransitions: e.target.checked })}
          disabled={!enabled} title={vt("smartTightenTip")} />
      </Row>
      <Row label={vt("showStatusOverlay")}>
        <input type="checkbox" checked={settings.vdjShowStatusOverlay !== false}
          onChange={(e) => update({ vdjShowStatusOverlay: e.target.checked })}
          disabled={!enabled} title={vt("showStatusOverlayTip")} />
      </Row>
      <div style={{ height: 1, background: "var(--panel-3, #1a1a1a)", margin: "6px 0" }} />
      <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 600 }}>{vt("aiSection")}</div>
      <Row label={vt("aiSetlist")}>
        <input
          type="checkbox"
          checked={settings.vdjAiSetlist === true}
          onChange={(e) => update({ vdjAiSetlist: e.target.checked })}
          disabled={!enabled}
          title={vt("aiSetlistTip")}
        />
      </Row>
      <Row label={vt("aiCoach")}>
        <input
          type="checkbox"
          checked={settings.vdjAiCoach === true}
          onChange={(e) => update({ vdjAiCoach: e.target.checked })}
          disabled={!enabled}
          title={vt("aiCoachTip")}
        />
      </Row>
    </>
  );
}