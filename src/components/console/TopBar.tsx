import { useApp } from "@/state/store";
import { Settings, Palette, HelpCircle, Disc3 } from "lucide-react";
import { useEffect } from "react";
import { useT } from "@/lib/i18n";

export function TopBar() {
  const drawer = useApp((s) => s.drawer);
  const setDrawer = useApp((s) => s.setDrawer);
  const skin = useApp((s) => s.skin);
  const appName = useApp((s) => s.settings.appName);
  const t = useT();
  useEffect(() => {
    if (appName) document.title = appName;
  }, [appName]);
  return (
    <div
      className="vdj-panel"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 14px",
        borderRadius: 0,
        borderLeft: 0,
        borderRight: 0,
        borderTop: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Disc3 size={20} style={{ color: "var(--accent)" }} />
        <div style={{ fontWeight: 800, letterSpacing: "0.18em", fontSize: 13, textTransform: "uppercase" }}>
          {appName || "VDJ PRO"}
        </div>
        <span className="vdj-chip" style={{ marginLeft: 8 }}>{t("skinLabel")} · {skin}</span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button className="vdj-btn" data-active={drawer === "skins"} onClick={() => setDrawer(drawer === "skins" ? null : "skins")}>
          <Palette size={12} /> {t("skins")}
        </button>
        <button className="vdj-btn" data-active={drawer === "settings"} onClick={() => setDrawer(drawer === "settings" ? null : "settings")}>
          <Settings size={12} /> {t("settings")}
        </button>
        <button className="vdj-btn" data-active={drawer === "help"} onClick={() => setDrawer(drawer === "help" ? null : "help")}>
          <HelpCircle size={12} /> {t("help")}
        </button>
      </div>
    </div>
  );
}