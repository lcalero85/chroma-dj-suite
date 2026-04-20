import { useEffect, useRef, useState } from "react";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const decks = useApp((s) => s.decks);
  const videoMix = useApp((s) => s.videoMix);
  const audioXf = useApp((s) => s.mixer.xfader);

  const hasA = !!decks.A.hasVideo;
  const hasB = !!decks.B.hasVideo;
  const visible = (hasA || hasB) && videoMix.showStage;

  // Position state — initial top-center, then user can drag
  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => {
    try {
      const saved = localStorage.getItem("vdj.videoStage.pos");
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });
  const [size, setSize] = useState<{ w: number; h: number }>(() => {
    try {
      const saved = localStorage.getItem("vdj.videoStage.size");
      if (saved) return JSON.parse(saved);
    } catch {}
    return { w: 420, h: 236 };
  });
  const dragRef = useRef<{ ox: number; oy: number; px: number; py: number } | null>(null);
  const resizeRef = useRef<{ ow: number; oh: number; px: number; py: number } | null>(null);

  useEffect(() => {
    if (pos) {
      try { localStorage.setItem("vdj.videoStage.pos", JSON.stringify(pos)); } catch {}
    }
  }, [pos]);
  useEffect(() => {
    try { localStorage.setItem("vdj.videoStage.size", JSON.stringify(size)); } catch {}
  }, [size]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (dragRef.current) {
        const { ox, oy, px, py } = dragRef.current;
        const nx = Math.max(0, Math.min(window.innerWidth - size.w, ox + (e.clientX - px)));
        const ny = Math.max(0, Math.min(window.innerHeight - size.h, oy + (e.clientY - py)));
        setPos({ x: nx, y: ny });
      } else if (resizeRef.current) {
        const { ow, oh, px, py } = resizeRef.current;
        const nw = Math.max(220, Math.min(window.innerWidth - 20, ow + (e.clientX - px)));
        const nh = Math.max(140, Math.min(window.innerHeight - 20, oh + (e.clientY - py)));
        setSize({ w: nw, h: nh });
      }
    };
    const onUp = () => {
      dragRef.current = null;
      resizeRef.current = null;
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [size.w, size.h]);

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

  const computedStyle: React.CSSProperties = pos
    ? {
        position: "fixed",
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        zIndex: 40,
        padding: 4,
        boxShadow: "0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px var(--accent)",
        background: "#000",
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
      }
    : {
        position: "fixed",
        left: "50%",
        top: 72,
        transform: "translateX(-50%)",
        width: size.w,
        height: size.h,
        zIndex: 40,
        padding: 4,
        boxShadow: "0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px var(--accent)",
        background: "#000",
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
      };

  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    const ox = rect?.left ?? pos?.x ?? 0;
    const oy = rect?.top ?? pos?.y ?? 0;
    dragRef.current = { ox, oy, px: e.clientX, py: e.clientY };
    document.body.style.userSelect = "none";
    if (!pos) setPos({ x: ox, y: oy });
  };

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { ow: size.w, oh: size.h, px: e.clientX, py: e.clientY };
    document.body.style.userSelect = "none";
  };

  return (
    <div
      ref={containerRef}
      className="vdj-panel-inset"
      style={computedStyle}
    >
      <div
        onPointerDown={startDrag}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "2px 6px",
          fontSize: 9,
          letterSpacing: "0.18em",
          color: "var(--accent)",
          fontWeight: 800,
          cursor: "move",
          userSelect: "none",
        }}
      >
        <span>⋮⋮ ● VIDEO MIX</span>
        <button
          className="vdj-btn"
          style={{ padding: "1px 6px", fontSize: 9 }}
          onPointerDown={(e) => e.stopPropagation()}
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
      <div
        onPointerDown={startResize}
        style={{
          position: "absolute",
          right: 0,
          bottom: 0,
          width: 16,
          height: 16,
          cursor: "nwse-resize",
          background:
            "linear-gradient(135deg, transparent 50%, var(--accent) 50%, var(--accent) 70%, transparent 70%)",
          borderBottomRightRadius: 8,
        }}
        title="Redimensionar"
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