import { useApp } from "@/state/store";
import { LibraryPanel } from "../library/LibraryPanel";
import { FxPanel } from "../fx/FxPanel";
import { SamplerPanel } from "../sampler/SamplerPanel";
import { RecorderPanel } from "../recorder/RecorderPanel";
import { RadioPanel } from "../radio/RadioPanel";

const TABS = [
  { id: "library", label: "Library" },
  { id: "radio", label: "Radio" },
  { id: "fx", label: "FX" },
  { id: "sampler", label: "Sampler" },
  { id: "recorder", label: "Recorder" },
] as const;

export function BottomTabs() {
  const tab = useApp((s) => s.activeBottomTab);
  const setTab = useApp((s) => s.setActiveBottomTab);
  return (
    <div className="vdj-panel" style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12, height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", gap: 4 }}>
        {TABS.map((t) => (
          <button key={t.id} className="vdj-btn" data-active={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {tab === "library" && <LibraryPanel />}
        {tab === "radio" && <RadioPanel />}
        {tab === "fx" && <FxPanel />}
        {tab === "sampler" && <SamplerPanel />}
        {tab === "recorder" && <RecorderPanel />}
      </div>
    </div>
  );
}