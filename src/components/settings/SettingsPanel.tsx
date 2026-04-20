import { useApp } from "@/state/store";

export function SettingsPanel() {
  const settings = useApp((s) => s.settings);
  const update = useApp((s) => s.updateSettings);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Row label="Animaciones">
        <input type="checkbox" checked={settings.animations} onChange={(e) => update({ animations: e.target.checked })} />
      </Row>
      <Row label="Tooltips">
        <input type="checkbox" checked={settings.tooltips} onChange={(e) => update({ tooltips: e.target.checked })} />
      </Row>
      <Row label="Key Lock por defecto">
        <input type="checkbox" checked={settings.defaultKeyLock} onChange={(e) => update({ defaultKeyLock: e.target.checked })} />
      </Row>
      <Row label="Pitch range por defecto">
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
      <div className="vdj-label" style={{ marginTop: 12 }}>Atajos</div>
      <pre className="vdj-panel-inset" style={{ padding: 10, fontSize: 11, lineHeight: 1.6, color: "var(--text-2)" }}>
{`Space        Play / Pause Deck A
Shift Right  Play / Pause Deck B
Q / W        Cue Deck A / B
A / S        Sync Deck A / B
R            Iniciar / detener grabación
1..8         Hot cues Deck A
Shift 1..8   Hot cues Deck B`}
      </pre>
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