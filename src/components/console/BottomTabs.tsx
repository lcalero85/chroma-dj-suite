import { useApp } from "@/state/store";
import { LibraryPanel } from "../library/LibraryPanel";
import { FxPanel } from "../fx/FxPanel";
import { SamplerPanel } from "../sampler/SamplerPanel";
import { RecorderPanel } from "../recorder/RecorderPanel";
import { RadioPanel } from "../radio/RadioPanel";
import { OnlinePanel } from "../online/OnlinePanel";
import { MixPresetsPanel } from "../presets/MixPresetsPanel";
import { useT, type DictKey } from "@/lib/i18n";
import { useEffect } from "react";

type TabId = "library" | "online" | "radio" | "fx" | "sampler" | "recorder" | "presets";

const ALL_TABS: { id: TabId; key: DictKey; advanced: boolean }[] = [
  { id: "library",  key: "library",  advanced: false },
  { id: "recorder", key: "recorder", advanced: false },
  { id: "online",   key: "online",   advanced: true },
  { id: "radio",    key: "radio",    advanced: true },
  { id: "fx",       key: "fx",       advanced: true },
  { id: "sampler",  key: "sampler",  advanced: true },
  { id: "presets",  key: "mixPresets", advanced: false },
];

export function BottomTabs() {
  const tab = useApp((s) => s.activeBottomTab);
  const setTab = useApp((s) => s.setActiveBottomTab);
  const mode = useApp((s) => s.settings.appMode);
  const t = useT();
  const tabs = ALL_TABS.filter((tb) => mode === "advanced" || !tb.advanced);

  // If we're in basic mode and the active tab is hidden, fall back to library.
  useEffect(() => {
    if (!tabs.some((tb) => tb.id === tab)) setTab("library");
  }, [mode, tab, tabs, setTab]);

  return (
    <div className="vdj-panel" style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12, height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", gap: 4 }}>
        {tabs.map((tb) => (
          <button key={tb.id} className="vdj-btn" data-active={tab === tb.id} onClick={() => setTab(tb.id)}>
            {t(tb.key)}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {tab === "library" && <LibraryPanel />}
        {mode === "advanced" && tab === "online" && <OnlinePanel />}
        {mode === "advanced" && tab === "radio" && <RadioPanel />}
        {mode === "advanced" && tab === "fx" && <FxPanel />}
        {mode === "advanced" && tab === "sampler" && <SamplerPanel />}
        {tab === "recorder" && <RecorderPanel />}
        {tab === "presets" && <MixPresetsPanel />}
      </div>
    </div>
  );
}