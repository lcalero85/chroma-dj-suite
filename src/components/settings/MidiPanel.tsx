import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/state/store";
import { useT } from "@/lib/i18n";
import {
  MIDI_ACTIONS, MIDI_PROFILES,
  setMidiEnabled, setMidiProfile, setMidiInput, setMidiOutput, setLedFeedback,
  startLearn, cancelLearn, removeCustomBinding, clearCustomBindings,
  exportMidiMappings, importMidiMappings, listMidiDevices, isMidiSupported,
  initMidi, onMidiActivity, subscribeMidiActivity,
  type MidiBinding,
} from "@/midi/engine";
import { toast } from "sonner";

export function MidiPanel() {
  const t = useT();
  const midi = useApp((s) => s.midi);
  const [learnFor, setLearnFor] = useState<string | null>(null);
  const [actLed, setActLed] = useState<{ inAt: number; outAt: number }>({ inAt: 0, outAt: 0 });
  const [, force] = useState(0);

  // Refresh on hot-plug (state bumps _devicesVersion)
  useEffect(() => { force((n) => n + 1); }, [midi._devicesVersion]);

  useEffect(() => {
    const off = onMidiActivity((dir) => {
      setActLed((s) => ({ ...s, [dir + "At"]: Date.now() } as typeof s));
    });
    const off2 = subscribeMidiActivity(() => force((n) => n + 1));
    return () => { off(); off2(); };
  }, []);

  const supported = isMidiSupported();
  const devices = useMemo(() => (midi.enabled ? listMidiDevices() : { inputs: [], outputs: [] }), [midi.enabled, midi._devicesVersion]);

  const onLearn = async (actionId: string) => {
    if (!midi.enabled) {
      const ok = await initMidi();
      if (!ok) return;
      setMidiEnabled(true);
    }
    setLearnFor(actionId);
    const b = await startLearn(actionId);
    setLearnFor(null);
    if (b) toast.success(t("midiLearned"), { description: actionId });
    else toast(t("midiLearnTimeout"));
  };

  const onCancelLearn = () => { cancelLearn(); setLearnFor(null); };

  const onExport = () => {
    const data = exportMidiMappings();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "midi-mappings.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  const onImport = async () => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "application/json";
    inp.onchange = async () => {
      const f = inp.files?.[0]; if (!f) return;
      const text = await f.text();
      if (importMidiMappings(text)) toast.success(t("midiImported"));
      else toast.error(t("midiImportFailed"));
    };
    inp.click();
  };

  const flashIn = Date.now() - actLed.inAt < 120;
  const flashOut = Date.now() - actLed.outAt < 120;

  if (!supported) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="vdj-label">{t("midiTitle")}</div>
        <p style={{ fontSize: 12, color: "var(--text-3)" }}>{t("midiNotSupported")}</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="vdj-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {t("midiTitle")}
        <span style={{
          marginLeft: "auto", display: "inline-flex", gap: 6, alignItems: "center", fontSize: 10,
        }}>
          <Dot label="IN" on={flashIn} color="#19e1c3" />
          <Dot label="OUT" on={flashOut} color="#ffb000" />
        </span>
      </div>

      <Row label={t("midiEnable")}>
        <input type="checkbox" checked={midi.enabled} onChange={(e) => setMidiEnabled(e.target.checked)} />
      </Row>

      <Row label={t("midiController")}>
        <select className="vdj-btn" value={midi.profileId}
          onChange={(e) => setMidiProfile(e.target.value)} style={{ padding: "6px 8px" }}>
          {MIDI_PROFILES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Row>

      <Row label={t("midiInput")}>
        <select className="vdj-btn" value={midi.inputId ?? ""}
          onChange={(e) => setMidiInput(e.target.value || null)} style={{ padding: "6px 8px", minWidth: 180 }}
          disabled={!midi.enabled}>
          <option value="">{t("midiAuto")}</option>
          {devices.inputs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </Row>

      <Row label={t("midiOutput")}>
        <select className="vdj-btn" value={midi.outputId ?? ""}
          onChange={(e) => setMidiOutput(e.target.value || null)} style={{ padding: "6px 8px", minWidth: 180 }}
          disabled={!midi.enabled}>
          <option value="">{t("midiAuto")}</option>
          {devices.outputs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </Row>

      <Row label={t("midiLedFeedback")}>
        <input type="checkbox" checked={midi.ledFeedback} onChange={(e) => setLedFeedback(e.target.checked)} />
      </Row>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
        <button className="vdj-btn" onClick={onExport}>{t("midiExport")}</button>
        <button className="vdj-btn" onClick={onImport}>{t("midiImport")}</button>
        <button className="vdj-btn" onClick={() => clearCustomBindings()}>{t("midiClearAll")}</button>
      </div>

      <div className="vdj-label" style={{ marginTop: 8 }}>{t("midiLearn")}</div>
      {learnFor && (
        <div className="vdj-panel-inset" style={{ padding: 8, fontSize: 12, color: "var(--accent)" }}>
          {t("midiLearning")} → <strong>{learnFor}</strong>
          <button className="vdj-btn" style={{ marginLeft: 8 }} onClick={onCancelLearn}>{t("midiCancel")}</button>
        </div>
      )}

      <div className="vdj-panel-inset" style={{ padding: 6, maxHeight: 220, overflow: "auto" }}>
        <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
          <thead style={{ position: "sticky", top: 0, background: "var(--panel-2, #111)" }}>
            <tr>
              <th style={th}>{t("midiAction")}</th>
              <th style={th}>{t("midiSource")}</th>
              <th style={{ ...th, width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {MIDI_ACTIONS.map((a) => {
              const bound = midi.customBindings.find((b) => b.actionId === a.id);
              return (
                <tr key={a.id} style={{ borderTop: "1px solid var(--panel-3, #1a1a1a)" }}>
                  <td style={td}>{a.label}</td>
                  <td style={{ ...td, color: bound ? "var(--accent)" : "var(--text-3)" }}>
                    {bound ? formatBinding(bound) : "—"}
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="vdj-btn" style={btn} onClick={() => onLearn(a.id)} disabled={learnFor !== null}>
                        {t("midiLearnBtn")}
                      </button>
                      {bound && (
                        <button className="vdj-btn" style={btn} onClick={() => removeCustomBinding(bound)}>×</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatBinding(b: MidiBinding): string {
  const ch = b.channel + 1;
  if (b.type === "note") return `Note ch${ch} #${b.data1}`;
  if (b.type === "cc") return `CC ch${ch} #${b.data1}`;
  return `PB ch${ch}`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 12 }}>{label}</span>
      <div>{children}</div>
    </div>
  );
}

function Dot({ label, on, color }: { label: string; on: boolean; color: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      <span style={{
        width: 8, height: 8, borderRadius: "50%",
        background: on ? color : "transparent", border: `1px solid ${color}`,
        transition: "background 80ms",
      }} />
      <span style={{ color: "var(--text-3)" }}>{label}</span>
    </span>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: "4px 6px", fontWeight: 600, color: "var(--text-2)" };
const td: React.CSSProperties = { padding: "3px 6px", verticalAlign: "middle" };
const btn: React.CSSProperties = { padding: "2px 6px", fontSize: 10 };
