import { useEffect, useRef } from "react";

interface VuMeterProps {
  analyser: AnalyserNode | null;
  orientation?: "vertical" | "horizontal";
  width?: number;
  height?: number;
  channels?: 1 | 2;
}

export function VuMeter({ analyser, orientation = "vertical", width = 8, height = 120, channels = 1 }: VuMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peakRef = useRef<number[]>([0, 0]);
  const peakTsRef = useRef<number[]>([0, 0]);
  const clipTsRef = useRef<number>(0);

  useEffect(() => {
    if (!analyser) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const totalW = (orientation === "vertical" ? width : height) * (channels === 2 ? 2 : 1);
    const totalH = orientation === "vertical" ? height : width * (channels === 2 ? 2 : 1);
    canvas.width = (orientation === "vertical" ? totalW : totalH) * dpr;
    canvas.height = (orientation === "vertical" ? totalH : totalW) * dpr;
    canvas.style.width = `${orientation === "vertical" ? totalW : totalH}px`;
    canvas.style.height = `${orientation === "vertical" ? totalH : totalW}px`;
    ctx.scale(dpr, dpr);

    const data = new Float32Array(analyser.fftSize);
    let raf = 0;

    const draw = () => {
      analyser.getFloatTimeDomainData(data);
      let rms = 0;
      let absPeak = 0;
      for (let i = 0; i < data.length; i++) {
        const s = data[i];
        rms += s * s;
        const a = Math.abs(s);
        if (a > absPeak) absPeak = a;
      }
      rms = Math.sqrt(rms / data.length);
      const level = Math.min(1, rms * 4);

      const now = performance.now();
      // Clipping flash: triggers when sample exceeds 0 dBFS (~0.99 amplitude),
      // visible for 600ms after the last detected clip.
      if (absPeak >= 0.99) clipTsRef.current = now;
      const clipping = now - clipTsRef.current < 600;
      if (level > peakRef.current[0]) {
        peakRef.current[0] = level;
        peakTsRef.current[0] = now;
      } else if (now - peakTsRef.current[0] > 1200) {
        // Slow falloff for peak-hold indicator
        peakRef.current[0] = Math.max(0, peakRef.current[0] - 0.008);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const segs = 24;
      const lit = Math.round(level * segs);
      const peakSeg = Math.round(peakRef.current[0] * segs);
      const segH = (orientation === "vertical" ? height : width) / segs - 1;
      const segW = orientation === "vertical" ? width - 2 : height;
      for (let i = 0; i < segs; i++) {
        const t = i / segs;
        let color = "var(--vu-low)";
        if (t > 0.85) color = "var(--vu-hi)";
        else if (t > 0.65) color = "var(--vu-mid)";
        const root = getComputedStyle(document.documentElement);
        const c = root.getPropertyValue(color.replace("var(", "").replace(")", "")).trim() || "#2ecc71";
        const isPeak = i === peakSeg && peakSeg > 0;
        ctx.globalAlpha = i < lit ? 1 : isPeak ? 0.9 : 0.12;
        // Peak-hold marker: brighter color (white tint) for visibility.
        ctx.fillStyle = isPeak && !(i < lit) ? "#ffffff" : c;
        if (orientation === "vertical") {
          const y = height - (i + 1) * (segH + 1);
          ctx.fillRect(1, y, segW, segH);
        } else {
          const x = i * (segH + 1);
          ctx.fillRect(x, 1, segH, segW);
        }
      }
      // Clipping flash: red overlay across the whole meter for 600ms after clip.
      if (clipping) {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = "#ff2a2a";
        if (orientation === "vertical") {
          ctx.fillRect(0, 0, segW + 2, height);
        } else {
          ctx.fillRect(0, 0, height, segW + 2);
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analyser, orientation, width, height, channels]);

  return <canvas ref={canvasRef} style={{ display: "block" }} />;
}