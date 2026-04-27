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
      <div style={{ height: 1, background: "var(--panel-3, #1a1a1a)", margin: "6px 0" }} />
      <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 600 }}>
        Comportamiento del Virtual DJ
      </div>
      <Row label="Nivel de mezcla">
        <select
          className="vdj-btn"
          value={settings.vdjIntensity ?? "normal"}
          onChange={(e) => update({ vdjIntensity: e.target.value as "soft" | "normal" | "hard" })}
          style={{ padding: "6px 8px" }}
          disabled={!enabled}
          title="Soft = transiciones largas y suaves · Normal = balanceado · Hard = ácido y agresivo"
        >
          <option value="soft">🌊 Suave (Soft)</option>
          <option value="normal">⚖️ Normal</option>
          <option value="hard">🔥 Duro (Hard / ácido)</option>
        </select>
      </Row>
      <Row label="Orden aleatorio (shuffle)">
        <input
          type="checkbox"
          checked={settings.vdjShuffle === true}
          onChange={(e) => update({ vdjShuffle: e.target.checked })}
          disabled={!enabled}
          title="Mezcla las pistas seleccionadas en orden aleatorio (sin repetir)"
        />
      </Row>
      <Row label="Cortar pista al (%)">
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
          title="Porcentaje del track al que se inicia la transición (50–95%)"
        />
      </Row>
      <Row label="Duración crossfade (s)">
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
          title="0 = automático según el género"
        />
      </Row>
      <Row label="Sincronizar BPM (Sync)">
        <input
          type="checkbox"
          checked={settings.vdjSyncBpm !== false}
          onChange={(e) => update({ vdjSyncBpm: e.target.checked })}
          disabled={!enabled}
        />
      </Row>
      <Row label="AutoGain por pista">
        <input
          type="checkbox"
          checked={settings.vdjAutoGain !== false}
          onChange={(e) => update({ vdjAutoGain: e.target.checked })}
          disabled={!enabled}
        />
      </Row>
      <Row label="Aplicar efectos (FX) en transición">
        <input
          type="checkbox"
          checked={settings.vdjUseFx !== false}
          onChange={(e) => update({ vdjUseFx: e.target.checked })}
          disabled={!enabled}
        />
      </Row>
      <Row label="Loops automáticos">
        <input
          type="checkbox"
          checked={settings.vdjUseLoops !== false}
          onChange={(e) => update({ vdjUseLoops: e.target.checked })}
          disabled={!enabled}
        />
      </Row>
      <Row label="Hot cues automáticos">
        <input
          type="checkbox"
          checked={settings.vdjUseHotCues !== false}
          onChange={(e) => update({ vdjUseHotCues: e.target.checked })}
          disabled={!enabled}
        />
      </Row>
      <Row label="Scratch flourish">
        <input
          type="checkbox"
          checked={settings.vdjUseScratch !== false}
          onChange={(e) => update({ vdjUseScratch: e.target.checked })}
          disabled={!enabled}
        />
      </Row>
      <Row label="Pitch bend (micro-ajustes)">
        <input
          type="checkbox"
          checked={settings.vdjUsePitchBend !== false}
          onChange={(e) => update({ vdjUsePitchBend: e.target.checked })}
          disabled={!enabled}
        />
      </Row>
      <Row label="Spice (sweeps + loop a mitad)">
        <input
          type="checkbox"
          checked={settings.vdjUseSpice !== false}
          onChange={(e) => update({ vdjUseSpice: e.target.checked })}
          disabled={!enabled}
          title="Filtros, loops, scratch y bends a mitad de cada pista"
        />
      </Row>
      <Row label="Anunciar nombre del DJ">
        <input
          type="checkbox"
          checked={settings.vdjAnnounceDj !== false}
          onChange={(e) => update({ vdjAnnounceDj: e.target.checked })}
          disabled={!enabled}
          title="Voz robótica con el nombre configurado en 'Nombre del DJ'"
        />
      </Row>
      <Row label="Frecuencia del anuncio">
        <select
          className="vdj-btn"
          value={settings.vdjAnnounceMode ?? "mid"}
          onChange={(e) => update({ vdjAnnounceMode: e.target.value as "start" | "every" | "mid" })}
          style={{ padding: "6px 8px" }}
          disabled={!enabled || settings.vdjAnnounceDj === false}
        >
          <option value="start">Solo al iniciar</option>
          <option value="mid">A mitad de pista</option>
          <option value="every">En cada transición</option>
        </select>
      </Row>
      <Row label="Volumen del anuncio">
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
      <Row label="Outro profesional (brake + reverb)">
        <input
          type="checkbox"
          checked={settings.vdjUseOutro !== false}
          onChange={(e) => update({ vdjUseOutro: e.target.checked })}
          disabled={!enabled}
        />
      </Row>
      <Row label="Duración del brake final (s)">
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
        ✨ Avanzado (v1.7.3)
      </div>
      <Row label="Energy Curve (planificador de set)">
        <input
          type="checkbox"
          checked={settings.vdjEnergyCurve === true}
          onChange={(e) => update({ vdjEnergyCurve: e.target.checked })}
          disabled={!enabled}
          title="Reordena las pistas seleccionadas siguiendo una curva profesional warmup → peak → cooldown (BPM + Camelot)"
        />
      </Row>
      <Row label="Forma de la curva">
        <select
          className="vdj-btn"
          value={settings.vdjEnergyShape ?? "arc"}
          onChange={(e) => update({ vdjEnergyShape: e.target.value as "arc" | "ascending" | "descending" | "wave" })}
          style={{ padding: "6px 8px" }}
          disabled={!enabled || settings.vdjEnergyCurve !== true}
        >
          <option value="arc">🏔 Arco (warmup → peak → cooldown)</option>
          <option value="ascending">📈 Ascendente</option>
          <option value="descending">📉 Descendente</option>
          <option value="wave">🌊 Olas (sube y baja)</option>
        </select>
      </Row>
      <Row label="Echo-Freeze + Cut (transición Pioneer)">
        <input
          type="checkbox"
          checked={settings.vdjEchoFreeze === true}
          onChange={(e) => update({ vdjEchoFreeze: e.target.checked })}
          disabled={!enabled}
          title="Congela el último compás del outgoing con echo y corta seco al downbeat del incoming"
        />
      </Row>
      <Row label="Probabilidad Echo-Freeze (%)">
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
          title="% de transiciones que usarán Echo-Freeze en lugar del crossfade clásico"
        />
      </Row>
      <Row label="Alinear corte al downbeat / drop">
        <input
          type="checkbox"
          checked={settings.vdjPhraseAlign === true}
          onChange={(e) => update({ vdjPhraseAlign: e.target.checked })}
          disabled={!enabled}
          title="Espera al próximo downbeat o phrase marker (drop/buildup) antes de cortar — transiciones perfectamente cuadradas"
        />
      </Row>
      <Row label="Ventana de espera al downbeat (s)">
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
          title="Si no aparece downbeat/drop dentro de la ventana, corta igual para no bloquear la mezcla"
        />
      </Row>
      <div style={{ height: 1, background: "var(--panel-3, #1a1a1a)", margin: "6px 0" }} />
      <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 600 }}>
        💥 Avanzado (v1.7.4)
      </div>
      <Row label="Mash-up Double Drop">
        <input
          type="checkbox"
          checked={settings.vdjMashup === true}
          onChange={(e) => update({ vdjMashup: e.target.checked })}
          disabled={!enabled}
          title="Ambas pistas suenan N compases con EQ split (lows del A, highs del B) antes del corte"
        />
      </Row>
      <Row label="Probabilidad Mash-up (%)">
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
      <Row label="Compases del Double Drop">
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
      <Row label="Stem-aware (vocal duck en outgoing)">
        <input
          type="checkbox"
          checked={settings.vdjStemAware === true}
          onChange={(e) => update({ vdjStemAware: e.target.checked })}
          disabled={!enabled}
          title="Cancela la voz central del outgoing durante la transición para evitar choques vocales"
        />
      </Row>
      <Row label="Cantidad de cancelación vocal (%)">
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
      <Row label="⚔ Battle Mode (turntablism)">
        <input
          type="checkbox"
          checked={settings.vdjBattleMode === true}
          onChange={(e) => update({ vdjBattleMode: e.target.checked })}
          disabled={!enabled}
          title="Alterna decks cada N compases con scratches y cortes secos estilo turntablism"
        />
      </Row>
      <Row label="Probabilidad Battle (%)">
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
      <Row label="Compases por ronda Battle">
        <select
          className="vdj-btn"
          value={String(settings.vdjBattleBars ?? 4)}
          onChange={(e) => update({ vdjBattleBars: Number(e.target.value) as 4 | 8 | 16 })}
          style={{ padding: "6px 8px" }}
          disabled={!enabled || settings.vdjBattleMode !== true}
        >
          <option value="4">4 compases</option>
          <option value="8">8 compases</option>
          <option value="16">16 compases</option>
        </select>
      </Row>
      <Row label="Rondas de Battle">
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
        🎙 Avanzado (v1.7.5)
      </div>

      {/* #6 Mic shoutouts */}
      <Row label="Sidechain mic shoutouts">
        <input
          type="checkbox"
          checked={settings.vdjMicShoutout === true}
          onChange={(e) => update({ vdjMicShoutout: e.target.checked })}
          disabled={!enabled}
          title="Detecta cuando hablas por el micrófono y atenúa el master automáticamente"
        />
      </Row>
      <Row label="Umbral del mic (%)">
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
      <Row label="Profundidad del duck (%)">
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
      <Row label="Mood adaptativo (arco de género)">
        <input
          type="checkbox"
          checked={settings.vdjMoodAdaptive === true}
          onChange={(e) => update({ vdjMoodAdaptive: e.target.checked })}
          disabled={!enabled}
          title="Cambia automáticamente el género objetivo cada N pistas (chill → peak → cooldown)"
        />
      </Row>
      <Row label="Cambiar mood cada N pistas">
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
      <Row label="Forma del mood">
        <select
          className="vdj-btn"
          value={settings.vdjMoodShape ?? "arc"}
          onChange={(e) => update({ vdjMoodShape: e.target.value as "arc" | "ascending" | "descending" | "wave" })}
          style={{ padding: "6px 8px" }}
          disabled={!enabled || settings.vdjMoodAdaptive !== true}
        >
          <option value="arc">🏔 Arco (chill → peak → cooldown)</option>
          <option value="ascending">📈 Ascendente</option>
          <option value="descending">📉 Descendente</option>
          <option value="wave">🌊 Olas</option>
        </select>
      </Row>

      {/* #9 Cue export */}
      <Row label="Exportar cue sheet (.cue) al terminar">
        <input
          type="checkbox"
          checked={settings.vdjExportCue !== false}
          onChange={(e) => update({ vdjExportCue: e.target.checked })}
          disabled={!enabled}
          title="Descarga un archivo .cue con los timestamps de cada transición junto con la grabación"
        />
      </Row>

      {/* #10 Auto stream */}
      <Row label="Streaming en vivo (auto)">
        <input
          type="checkbox"
          checked={settings.vdjAutoStream === true}
          onChange={(e) => update({ vdjAutoStream: e.target.checked })}
          disabled={!enabled}
          title="Inicia el broadcast Icecast automáticamente al arrancar el set y actualiza la metadata por pista"
        />
      </Row>

      {/* #11 Beatjuggle */}
      <Row label="Beatjuggling (en pistas lentas)">
        <input
          type="checkbox"
          checked={settings.vdjBeatjuggle === true}
          onChange={(e) => update({ vdjBeatjuggle: e.target.checked })}
          disabled={!enabled}
          title="Pequeños cortes A↔B sobre el mismo beat en tracks de BPM bajo"
        />
      </Row>
      <Row label="BPM máximo para beatjuggle">
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
      <Row label="Probabilidad beatjuggle (%)">
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
      <Row label="📻 Modo Radio Show">
        <input
          type="checkbox"
          checked={settings.vdjRadioShow === true}
          onChange={(e) => update({ vdjRadioShow: e.target.checked })}
          disabled={!enabled}
          title="Inserta jingles + voz del DJ entre pistas, estilo radio show"
        />
      </Row>
      <Row label="Jingle cada N pistas">
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
      <Row label="Pista jingle (Library)">
        <select
          className="vdj-btn"
          value={settings.vdjRadioJingleTrackId ?? ""}
          onChange={(e) => update({ vdjRadioJingleTrackId: e.target.value || null })}
          style={{ padding: "6px 8px", maxWidth: 220 }}
          disabled={!enabled || settings.vdjRadioShow !== true}
        >
          <option value="">— ninguna —</option>
          {tracks.map((t) => (
            <option key={t.id} value={t.id}>
              {(t.title || "Sin título").slice(0, 40)}
              {t.artist ? ` · ${t.artist.slice(0, 20)}` : ""}
            </option>
          ))}
        </select>
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