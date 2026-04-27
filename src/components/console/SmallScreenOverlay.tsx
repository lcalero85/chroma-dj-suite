import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useT } from "@/lib/i18n";

const MIN_W = 1100;
const MIN_H = 600;
const STORAGE_KEY = "vdj-pro-small-screen-dismissed";

/**
 * Full-screen warning shown when the viewport is too small to fit VDJ PRO's
 * dual-deck layout. Users can dismiss the warning per-session — the choice is
 * persisted in sessionStorage so it doesn't pop up again until the next visit
 * (or until the device is rotated back below the threshold and then up again).
 *
 * The threshold (1100×600) is intentionally just below the layout's natural
 * "comfortable" minimum, so most laptops, tablets in landscape, and large
 * monitors never see it.
 */
export function SmallScreenOverlay() {
  const t = useT();
  const [size, setSize] = useState(() =>
    typeof window === "undefined"
      ? { w: 1920, h: 1080 }
      : { w: window.innerWidth, h: window.innerHeight },
  );
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  const tooSmall = size.w < MIN_W || size.h < MIN_H;
  if (!tooSmall || dismissed) return null;

  const handleContinue = () => {
    try { window.sessionStorage.setItem(STORAGE_KEY, "1"); } catch { /* noop */ }
    setDismissed(true);
  };

  return (
    <div
      role="alertdialog"
      aria-labelledby="small-screen-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "color-mix(in oklab, var(--surface-1) 92%, black 8% / 0.96)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        className="vdj-panel"
        style={{
          maxWidth: 480,
          width: "100%",
          padding: 22,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          textAlign: "center",
          borderColor: "var(--accent)",
          boxShadow: "var(--beat-glow)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", color: "var(--accent)" }}>
          <AlertTriangle size={42} />
        </div>
        <div
          id="small-screen-title"
          style={{
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-1)",
          }}
        >
          {t("smallScreenTitle")}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>
          {t("smallScreenBody", { w: MIN_W, h: MIN_H })}
        </div>
        <div
          className="vdj-chip"
          style={{
            alignSelf: "center",
            fontVariantNumeric: "tabular-nums",
            fontFamily: "var(--font-mono)",
          }}
        >
          {t("smallScreenCurrent", { w: size.w, h: size.h })}
        </div>
        <button
          className="vdj-btn"
          onClick={handleContinue}
          style={{ alignSelf: "center", padding: "6px 14px", fontWeight: 700 }}
        >
          {t("smallScreenContinue")}
        </button>
      </div>
    </div>
  );
}