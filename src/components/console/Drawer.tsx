import { useApp } from "@/state/store";
import { SkinPicker } from "../skins/SkinPicker";
import { SettingsPanel } from "../settings/SettingsPanel";
import { HelpPanel } from "../help/HelpPanel";
import { AboutPanel } from "../about/AboutPanel";
import { X } from "lucide-react";
import { useT } from "@/lib/i18n";

export function Drawer() {
  const drawer = useApp((s) => s.drawer);
  const setDrawer = useApp((s) => s.setDrawer);
  const t = useT();
  if (!drawer) return null;
  const titles = { settings: t("settings"), skins: t("skins"), help: t("help"), about: t("about") } as const;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 50,
        display: "flex",
        justifyContent: "flex-end",
      }}
      onClick={() => setDrawer(null)}
    >
      <div
        className="vdj-panel"
        style={{ width: 420, maxWidth: "100vw", height: "100%", padding: 16, overflowY: "auto", borderRadius: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>{titles[drawer]}</h2>
          <button className="vdj-btn" onClick={() => setDrawer(null)}><X size={12} /></button>
        </div>
        {drawer === "skins" && <SkinPicker />}
        {drawer === "settings" && <SettingsPanel />}
        {drawer === "help" && <HelpPanel />}
        {drawer === "about" && <AboutPanel />}
      </div>
    </div>
  );
}