import { useEffect, useRef } from "react";
import { t as tGlobal } from "@/lib/i18n";

interface WaveformProps {
  peaks: number[];
  bands?: { lo: number[]; mid: number[]; hi: number[] } | null;
  position: number; // 0..1
  bpm: number | null;
  duration: number;
  loopStart?: number | null;
  loopEnd?: number | null;
  hotCues?: { id: number; pos: number; color: string }[];
  height?: number;
  variant?: "main" | "mini";
  onSeek?: (pos: number) => void;
  isPlaying?: boolean;
  /** Visual style: classic = solid bars, bars = thicker spaced bars, dual = top/bottom mirror (Serato-like). */
  styleVariant?: "classic" | "bars" | "dual";
  /** Beat grid downbeat offset (seconds) — shifts the grid lines without retiming. */
  gridOffsetSec?: number;
}

export function Waveform({
  peaks,
  bands,
  position,
  bpm,
  duration,
  loopStart,
  loopEnd,
  hotCues,
  height = 90,
  variant = "main",
  onSeek,
  isPlaying,
  styleVariant = "classic",
  gridOffsetSec = 0,
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = wrap.clientWidth || wrap.parentElement?.clientWidth || 0;
      const h = height;
      if (w <= 0) return;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const root = getComputedStyle(document.documentElement);
      const accent = root.getPropertyValue("--accent").trim() || "#ff8800";
      const surf3 = root.getPropertyValue("--surface-3").trim() || "#333";
      const surf4 = root.getPropertyValue("--surface-4").trim() || "#444";
      const text3 = root.getPropertyValue("--text-3").trim() || "#777";

      if (peaks.length === 0) {
        ctx.fillStyle = surf3;
        ctx.fillRect(0, h / 2 - 1, w, 2);
        ctx.fillStyle = text3;
        ctx.font = "10px system-ui";
        ctx.fillText(variant === "main" ? tGlobal("loadTrackHint") : "—", 8, h / 2 - 6);
        return;
      }

      // Animated phase used for subtle live shimmer when playing
      if (isPlaying) phaseRef.current += 0.06;
      const phase = phaseRef.current;

      const sampleBand = (arr: number[] | undefined, frac: number): number => {
        if (!arr || arr.length === 0) return 0;
        const idx = Math.max(0, Math.min(arr.length - 1, Math.floor(frac * arr.length)));
        return arr[idx];
      };

      if (variant === "main") {
        // Zoomed scrolling waveform: window of ~10s centered on position
        const windowSec = 10;
        const center = position * duration;
        const startSec = Math.max(0, center - windowSec / 2);
        const endSec = Math.min(duration, center + windowSec / 2);
        const startIdx = Math.floor((startSec / duration) * peaks.length);
        const endIdx = Math.ceil((endSec / duration) * peaks.length);
        const slice = peaks.slice(startIdx, endIdx);
        const baseBarW = w / Math.max(1, slice.length);
        // "bars" style: spacing between vertical bars, "classic" / "dual" use full width
        const barW = styleVariant === "bars" ? baseBarW : baseBarW;
        const barFillW = styleVariant === "bars"
          ? Math.max(1, baseBarW * 0.55)
          : Math.max(1, baseBarW - 0.5);

        for (let i = 0; i < slice.length; i++) {
          const v = slice[i];
          const globalIdx = startIdx + i;
          const tFrac = globalIdx / peaks.length;
          const tSec = (startSec + (i / slice.length) * (endSec - startSec));
          const isPlayed = tSec / duration < position;

          let fill: string | CanvasGradient;
          if (bands) {
            const lo = sampleBand(bands.lo, tFrac);
            const mid = sampleBand(bands.mid, tFrac);
            const hi = sampleBand(bands.hi, tFrac);
            const total = lo + mid + hi || 1;
            const r = Math.round((hi / total) * 255);
            const g = Math.round((mid / total) * 220 + 30);
            const b = Math.round((lo / total) * 255);
            const alpha = isPlayed ? 1 : 0.55;
            fill = `rgba(${r},${g},${b},${alpha})`;
          } else {
            fill = isPlayed ? accent : surf4;
          }

          // Live shimmer: small symmetric height modulation near playhead
          let mod = 1;
          if (isPlaying && styleVariant !== "bars") {
            const distFromHead = Math.abs(i - slice.length / 2) / (slice.length / 2);
            const breathe = 1 - distFromHead * 0.7;
            mod = 1 + Math.sin(phase + i * 0.35) * 0.08 * breathe;
          }

          const barH = Math.max(1, v * h * 0.9 * mod);
          ctx.fillStyle = fill;
          if (styleVariant === "dual") {
            // Serato-style: top half rendered upward, bottom half mirrored downward,
            // colored slightly differently for hi/lo emphasis.
            const halfH = barH / 2;
            ctx.fillRect(i * barW, h / 2 - halfH, barFillW, halfH);
            ctx.globalAlpha = 0.65;
            ctx.fillRect(i * barW, h / 2, barFillW, halfH);
            ctx.globalAlpha = 1;
          } else {
            ctx.fillRect(i * barW, h / 2 - barH / 2, barFillW, barH);
          }
        }

        // beatgrid
        if (bpm && bpm > 0) {
          const beatSec = 60 / bpm;
          const off = (gridOffsetSec ?? 0);
          // Beats are spaced every (60/bpm) seconds starting at the grid offset.
          const firstBeatIdx = Math.ceil((startSec - off) / beatSec);
          const firstBeat = firstBeatIdx * beatSec + off;
          let beatIdx = firstBeatIdx;
          for (let t = firstBeat; t < endSec; t += beatSec, beatIdx++) {
            const x = ((t - startSec) / (endSec - startSec)) * w;
            const isDownbeat = beatIdx % 4 === 0;
            ctx.fillStyle = isDownbeat
              ? "rgba(255,255,255,0.42)"
              : "rgba(255,255,255,0.16)";
            ctx.fillRect(x, 0, isDownbeat ? 1.6 : 1, h);
          }
        }
        // loop region with clearer borders
        if (loopStart !== null && loopStart !== undefined && loopEnd !== null && loopEnd !== undefined) {
          const ls = (loopStart - startSec) / (endSec - startSec);
          const le = (loopEnd - startSec) / (endSec - startSec);
          if (le > 0 && ls < 1) {
            const x1 = Math.max(0, ls * w);
            const x2 = Math.min(w, le * w);
            ctx.fillStyle = "rgba(120,200,255,0.22)";
            ctx.fillRect(x1, 0, x2 - x1, h);
            // border edges
            ctx.fillStyle = "rgba(120,200,255,0.85)";
            ctx.fillRect(x1, 0, 2, h);
            ctx.fillRect(x2 - 2, 0, 2, h);
          }
        }
        // playhead with pulsing glow
        const glow = isPlaying ? 8 + Math.sin(phase * 2) * 4 : 8;
        ctx.shadowColor = accent;
        ctx.shadowBlur = glow;
        ctx.fillStyle = accent;
        ctx.fillRect(w / 2 - 1, 0, 2, h);
        ctx.shadowBlur = 0;

        // hot cues
        hotCues?.forEach((c) => {
          const x = ((c.pos - startSec) / (endSec - startSec)) * w;
          if (x < 0 || x > w) return;
          // Bar + small triangle marker for visibility
          ctx.fillStyle = c.color;
          ctx.fillRect(x, 0, 2, h);
          ctx.beginPath();
          ctx.moveTo(x - 4, 0);
          ctx.lineTo(x + 4, 0);
          ctx.lineTo(x, 6);
          ctx.closePath();
          ctx.fill();
        });
      } else {
        // mini overview
        const barW = w / peaks.length;
        for (let i = 0; i < peaks.length; i++) {
          const t = i / peaks.length;
          let fill: string;
          if (bands) {
            const lo = sampleBand(bands.lo, t);
            const mid = sampleBand(bands.mid, t);
            const hi = sampleBand(bands.hi, t);
            const total = lo + mid + hi || 1;
            const r = Math.round((hi / total) * 255);
            const g = Math.round((mid / total) * 220 + 30);
            const b = Math.round((lo / total) * 255);
            const alpha = t < position ? 1 : 0.45;
            fill = `rgba(${r},${g},${b},${alpha})`;
          } else {
            fill = t < position ? accent : surf4;
          }
          ctx.fillStyle = fill;
          const barH = Math.max(1, peaks[i] * h * 0.85);
          ctx.fillRect(i * barW, h / 2 - barH / 2, Math.max(0.5, barW), barH);
        }
        ctx.fillStyle = accent;
        ctx.fillRect(position * w - 1, 0, 2, h);
        hotCues?.forEach((c) => {
          const x = (c.pos / duration) * w;
          ctx.fillStyle = c.color;
          ctx.fillRect(x, 0, 1, h);
        });
      }
    };

    const loop = () => {
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };

    // Re-draw on container resize (handles late layout when canvas mounts at 0 width)
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);

    // Animate continuously only when playing
    if (isPlaying) {
      rafRef.current = requestAnimationFrame(loop);
    } else {
      draw();
      // also redraw on next frame to catch first-paint width
      rafRef.current = requestAnimationFrame(() => {
        draw();
        rafRef.current = null;
      });
    }
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      ro.disconnect();
    };
  }, [peaks, bands, position, bpm, duration, loopStart, loopEnd, hotCues, height, variant, isPlaying, gridOffsetSec, styleVariant]);

  const handleClick = (e: React.MouseEvent) => {
    if (!onSeek || variant !== "mini") return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    onSeek(x);
  };

  return (
    <div
      ref={wrapRef}
      className="vdj-panel-inset"
      style={{ width: "100%", height, overflow: "hidden", cursor: variant === "mini" ? "pointer" : "default" }}
      onClick={handleClick}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}