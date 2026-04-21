import { useApp } from "@/state/store";
import { Settings, Palette, HelpCircle, Disc3, Wifi, Clock, Keyboard } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { getNextScheduledSegment } from "@/state/controller";
import { ShortcutsOverlay } from "@/components/help/ShortcutsOverlay";

export function TopBar() {
  const drawer = useApp((s) => s.drawer);
  const setDrawer = useApp((s) => s.setDrawer);
  const skin = useApp((s) => s.skin);
  const appName = useApp((s) => s.settings.appName);
  const stream = useApp((s) => s.stream);
  // Subscribe to segments so the next-segment chip refreshes on change.
  const segments = useApp((s) => s.segments);
  const radio = useApp((s) => s.radio);
  const [, tick] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const t = useT();

  useEffect(() => {
    if (appName) document.title = appName;
  }, [appName]);

  // Refresh "next segment" chip every minute.
  useEffect(() => {
    const i = setInterval(() => tick((x) => x + 1), 60_000);
    return () => clearInterval(i);
  }, []);

  // Global "?" shortcut to open the overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.key === "?") { e.preventDefault(); setShowShortcuts((v) => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const next = radio.enabled ? getNextScheduledSegment() : null;
  void segments;

  const liveBytes = stream.bytesSent;
  const liveKb = liveBytes > 1024 * 1024 ? `${(liveBytes / 1024 / 1024).toFixed(1)}MB` : `${(liveBytes / 1024).toFixed(0)}KB`;

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
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Disc3 size={20} style={{ color: "var(--accent)" }} />
        <div style={{ fontWeight: 800, letterSpacing: "0.18em", fontSize: 13, textTransform: "uppercase" }}>
          {appName || "VDJ PRO"}
        </div>
        <span className="vdj-chip" style={{ marginLeft: 8 }}>{t("skinLabel")} · {skin}</span>
        {stream.status === "live" && (
          <span
            className="vdj-loaded-badge"
            data-tone="live"
            style={{ display: "inline-flex", alignItems: "center", gap: 4, animation: "vdj-pulse 1.2s infinite" }}
            title={`Transmitiendo · ${liveKb} enviados`}
          >
            <Wifi size={11} /> ON AIR · {liveKb}
          </span>
        )}
        {stream.status === "connecting" && (
          <span className="vdj-chip" style={{ display: "inline-flex", alignItems: "center", gap: 4 }} title={stream.lastError ?? "Conectando…"}>
            <Wifi size={11} /> Conectando…
          </span>
        )}
        {next && (
          <span
            className="vdj-chip"
            title={`Próximo segmento programado: ${next.segment.name}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <Clock size={11} />
            <span style={{ width: 8, height: 8, borderRadius: 2, background: next.segment.color }} />
            {next.segment.name} · {formatMinutes(next.minutesUntil)}
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button className="vdj-btn" onClick={() => setShowShortcuts(true)} title="Atajos (?)">
          <Keyboard size={12} /> ?
        </button>
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
      {showShortcuts && <ShortcutsOverlay onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}

function formatMinutes(min: number): string {
  if (min < 1) return "ahora";
  if (min < 60) return `${Math.round(min)}m`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}