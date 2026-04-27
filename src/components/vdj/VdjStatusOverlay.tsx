import { useEffect, useState } from "react";
import { Bot, Disc3 } from "lucide-react";
import { useApp } from "@/state/store";
import { subscribeVdj, getVdjStatus } from "@/audio/virtualDj";
import { useVt } from "@/lib/i18n/vdj";

/**
 * Floating "MIXING" overlay shown while the Virtual DJ is running.
 * Uses `pointer-events: none` so it never intercepts clicks on decks,
 * mixer, faders or any control underneath.
 */
export function VdjStatusOverlay() {
  const show = useApp((s) => s.settings.vdjShowStatusOverlay !== false);
  const enabled = useApp((s) => s.settings.vdjEnabled === true);
  const vt = useVt();
  const [status, setStatus] = useState(() => getVdjStatus());
  useEffect(() => subscribeVdj(() => setStatus(getVdjStatus())), []);
  if (!show || !enabled || !status.running) return null;
  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 60,
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        borderRadius: 14,
        background: "linear-gradient(135deg, rgba(0,0,0,0.78), rgba(20,20,30,0.78))",
        border: "1px solid color-mix(in oklab, var(--accent) 60%, transparent)",
        boxShadow: "0 10px 30px -8px color-mix(in oklab, var(--accent) 50%, transparent)",
        backdropFilter: "blur(10px)",
        color: "var(--text-1, #fff)",
        maxWidth: 340,
        animation: "vdj-overlay-in 320ms ease-out",
      }}
    >
      <div style={{ position: "relative", width: 36, height: 36, flex: "0 0 auto" }}>
        <Disc3 size={36} style={{ color: "var(--accent)", animation: "vdj-spin 2.4s linear infinite" }} />
        <Bot size={14} style={{
          position: "absolute", right: -2, bottom: -2, color: "#0b0b0b",
          background: "var(--accent)", borderRadius: 4, padding: 1,
        }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 800, letterSpacing: "0.18em",
            color: "var(--accent)",
          }}>{vt("overlayMixing")}</span>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.15em",
            background: "#e11d48", color: "#fff", padding: "2px 6px", borderRadius: 4,
            animation: "vdj-pulse 1.2s infinite",
          }}>{vt("overlayLive")}</span>
        </div>
        <div style={{
          fontSize: 12, marginTop: 2, opacity: 0.95,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          maxWidth: 280,
        }}>{status.message}</div>
        {status.total > 0 && (
          <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>
            {vt("overlayTrack", { i: status.index + 1, n: status.total })}
          </div>
        )}
      </div>
      <style>{`
        @keyframes vdj-spin { to { transform: rotate(360deg); } }
        @keyframes vdj-overlay-in {
          from { opacity: 0; transform: translateY(8px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
