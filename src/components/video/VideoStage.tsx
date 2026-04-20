import { useEffect, useRef } from "react";
import { useApp, defaultVideoFx } from "@/state/store";
import { getVideo } from "@/audio/videoDeck";

// Singleton ref so the recorder (or other modules) can grab the canvas without
// prop-drilling. Updated whenever the VideoStage mounts/unmounts.
export const videoStageRef: { current: HTMLCanvasElement | null } = { current: null };

/**
 * VideoStage renders the central video preview by drawing both decks' video
 * elements onto a single canvas every animation frame, mixed by the video
 * crossfader (linked to the audio crossfader by default). Visual FX (blur,
 * brightness, hueRotate, etc.) are applied per-deck via canvas filter; RGB
 * shift and glitch are extra effects done by drawing offset color channels.
 */
export function VideoStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const decks = useApp((s) => s.decks);
  const videoMix = useApp((s) => s.videoMix);
  const audioXf = useApp((s) => s.mixer.xfader);

  const hasA = !!decks.A.hasVideo;
  const hasB = !!decks.B.hasVideo;
  const visible = (hasA || hasB) && videoMix.showStage;

  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    videoStageRef.current = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      const xf = videoMix.linkAudioXfader ? audioXf : videoMix.videoXfader;
      // -1 = full A, +1 = full B; smooth power curve
      const aGain = Math.max(0, Math.min(1, (1 - xf) / 2 + 0.5));
      const bGain = Math.max(0, Math.min(1, (1 + xf) / 2 + 0.5));
      const aOpacity = Math.min(1, aGain);
      const bOpacity = Math.min(1, bGain);

      const drawDeck = (deckId: "A" | "B", opacity: number) => {
        if (opacity <= 0.01) return;
        const v = getVideo(deckId);
        if (!v || !v.ready) return;
        const el = v.el;
        if (el.readyState < 2 || el.videoWidth === 0) return;
        const fx = useApp.getState().decks[deckId].videoFx ?? defaultVideoFx();
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.filter = [
          `blur(${fx.blur}px)`,
          `brightness(${fx.brightness})`,
          `contrast(${fx.contrast})`,
          `saturate(${fx.saturate})`,
          `hue-rotate(${fx.hueRotate}deg)`,
          `invert(${fx.invert})`,
        ].join(" ");

        // Glitch jitter
        const jx = fx.glitch > 0 ? (Math.random() - 0.5) * fx.glitch * 30 : 0;
        const jy = fx.glitch > 0 ? (Math.random() - 0.5) * fx.glitch * 8 : 0;

        // Cover-fit
        const vw = el.videoWidth;
        const vh = el.videoHeight;
        const scaleBase = Math.max(W / vw, H / vh) * fx.zoom;
        const dw = vw * scaleBase;
        const dh = vh * scaleBase;
        const dx = (W - dw) / 2 + jx;
        const dy = (H - dh) / 2 + jy;

        if (fx.rgbShift > 0) {
          // R, G, B shifted draws using composite operations
          ctx.globalCompositeOperation = "screen";
          const s = fx.rgbShift;
          // Red
          ctx.save();
          ctx.fillStyle = "rgba(255,0,0,1)";
          ctx.globalCompositeOperation = "source-over";
          ctx.drawImage(el, dx + s, dy, dw, dh);
          ctx.restore();
          // Blue
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.drawImage(el, dx - s, dy, dw, dh);
          ctx.restore();
          ctx.globalCompositeOperation = "source-over";
        } else {
          ctx.drawImage(el, dx, dy, dw, dh);
        }
        ctx.restore();
      };

      // Draw B first, then A on top with its opacity (blend)
      drawDeck("B", bOpacity);
      drawDeck("A", aOpacity);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      if (videoStageRef.current === canvas) videoStageRef.current = null;
    };
  }, [visible, videoMix.linkAudioXfader, videoMix.videoXfader, audioXf]);

  if (!visible) return null;

  return (
    <div
      className="vdj-panel-inset"
      style={{
        position: "fixed",
        left: "50%",
        top: 72,
        transform: "translateX(-50%)",
        width: 420,
        height: 236,
        zIndex: 40,
        padding: 4,
        boxShadow: "0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px var(--accent)",
        background: "#000",
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "2px 6px",
          fontSize: 9,
          letterSpacing: "0.18em",
          color: "var(--accent)",
          fontWeight: 800,
        }}
      >
        <span>● VIDEO MIX</span>
        <button
          className="vdj-btn"
          style={{ padding: "1px 6px", fontSize: 9 }}
          onClick={() =>
            useApp.getState().updateVideoMix({ showStage: false })
          }
          title="Ocultar pantalla"
        >
          ✕
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={640}
        height={360}
        style={{ width: "100%", flex: 1, borderRadius: 4, background: "#000" }}
      />
    </div>
  );
}

export function VideoStageToggle() {
  const videoMix = useApp((s) => s.videoMix);
  const hasVideo = useApp((s) => s.decks.A.hasVideo || s.decks.B.hasVideo);
  if (!hasVideo) return null;
  if (videoMix.showStage) return null;
  return (
    <button
      className="vdj-btn"
      data-active
      style={{
        position: "fixed",
        left: "50%",
        top: 72,
        transform: "translateX(-50%)",
        zIndex: 40,
        padding: "8px 14px",
        fontWeight: 800,
        letterSpacing: "0.12em",
      }}
      onClick={() => useApp.getState().updateVideoMix({ showStage: true })}
    >
      ▶ MOSTRAR VIDEO
    </button>
  );
}