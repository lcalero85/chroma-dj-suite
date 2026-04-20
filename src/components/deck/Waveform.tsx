import { useEffect, useRef } from "react";

interface WaveformProps {
  peaks: number[];
  position: number; // 0..1
  bpm: number | null;
  duration: number;
  loopStart?: number | null;
  loopEnd?: number | null;
  hotCues?: { id: number; pos: number; color: string }[];
  height?: number;
  variant?: "main" | "mini";
  onSeek?: (pos: number) => void;
}

export function Waveform({
  peaks,
  position,
  bpm,
  duration,
  loopStart,
  loopEnd,
  hotCues,
  height = 90,
  variant = "main",
  onSeek,
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = wrap.clientWidth;
    const h = height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);
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
      ctx.fillText(variant === "main" ? "Carga una pista" : "—", 8, h / 2 - 6);
      return;
    }

    if (variant === "main") {
      // Zoomed scrolling waveform: window of ~10s centered on position
      const windowSec = 10;
      const center = position * duration;
      const startSec = Math.max(0, center - windowSec / 2);
      const endSec = Math.min(duration, center + windowSec / 2);
      const startIdx = Math.floor((startSec / duration) * peaks.length);
      const endIdx = Math.ceil((endSec / duration) * peaks.length);
      const slice = peaks.slice(startIdx, endIdx);
      const barW = w / slice.length;
      for (let i = 0; i < slice.length; i++) {
        const v = slice[i];
        const t = (startSec + (i / slice.length) * (endSec - startSec)) / duration;
        const isPlayed = t < position;
        ctx.fillStyle = isPlayed ? accent : surf4;
        const barH = Math.max(1, v * h * 0.9);
        ctx.fillRect(i * barW, h / 2 - barH / 2, Math.max(1, barW - 0.5), barH);
      }
      // beatgrid
      if (bpm && bpm > 0) {
        const beatSec = 60 / bpm;
        const firstBeat = Math.ceil(startSec / beatSec) * beatSec;
        for (let t = firstBeat; t < endSec; t += beatSec) {
          const x = ((t - startSec) / (endSec - startSec)) * w;
          ctx.fillStyle = "rgba(255,255,255,0.18)";
          ctx.fillRect(x, 0, 1, h);
        }
      }
      // playhead
      ctx.fillStyle = accent;
      ctx.fillRect(w / 2 - 1, 0, 2, h);
      ctx.shadowColor = accent;
      ctx.shadowBlur = 8;
      ctx.fillRect(w / 2 - 1, 0, 2, h);
      ctx.shadowBlur = 0;

      // loop region
      if (loopStart !== null && loopStart !== undefined && loopEnd !== null && loopEnd !== undefined) {
        const ls = (loopStart - startSec) / (endSec - startSec);
        const le = (loopEnd - startSec) / (endSec - startSec);
        if (le > 0 && ls < 1) {
          const x1 = Math.max(0, ls * w);
          const x2 = Math.min(w, le * w);
          ctx.fillStyle = "rgba(120,200,255,0.18)";
          ctx.fillRect(x1, 0, x2 - x1, h);
        }
      }
      // hot cues
      hotCues?.forEach((c) => {
        const x = ((c.pos - startSec) / (endSec - startSec)) * w;
        if (x < 0 || x > w) return;
        ctx.fillStyle = c.color;
        ctx.fillRect(x, 0, 2, h);
      });
    } else {
      // mini overview
      const barW = w / peaks.length;
      for (let i = 0; i < peaks.length; i++) {
        const t = i / peaks.length;
        ctx.fillStyle = t < position ? accent : surf4;
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
  }, [peaks, position, bpm, duration, loopStart, loopEnd, hotCues, height, variant]);

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