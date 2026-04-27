/**
 * Crowd Energy Meter — flotante en pantalla cuando Virtual DJ está activo
 * y el usuario habilitó `vdjEnergyMeter`. Muestra:
 *   - Nivel actual (RMS del master) animado.
 *   - Curva histórica de energía (últimos ~3 min).
 */
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/state/store";
import { getEngine } from "@/audio/engine";
import { isVirtualDjRunning, subscribeVdj, getEnergyHistory } from "@/audio/virtualDj";

export function CrowdEnergyMeter() {
  const enabled = useApp((s) => s.settings.vdjEnergyMeter === true);
  const [running, setRunning] = useState<boolean>(() => isVirtualDjRunning());
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [level, setLevel] = useState(0);

  useEffect(() => {
    const unsub = subscribeVdj(() => setRunning(isVirtualDjRunning()));
    return unsub;
  }, []);

  useEffect(() => {
    if (!enabled || !running) return;
    let raf = 0;
    let buf: Uint8Array<ArrayBuffer> | null = null;
    const tick = () => {
      try {
        const { masterAnalyser } = getEngine();
        if (!buf || buf.length !== masterAnalyser.fftSize) {
          buf = new Uint8Array(new ArrayBuffer(masterAnalyser.fftSize));
        }
        masterAnalyser.getByteTimeDomainData(buf);
        let s = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          s += v * v;
        }
        const rms = Math.sqrt(s / buf.length);
        const lvl = Math.min(1, rms * 2.4);
        setLevel(lvl);
        // Draw history graph
        const c = canvasRef.current;
        if (c) {
          const ctx = c.getContext("2d");
          const hist = getEnergyHistory();
          if (ctx) {
            const W = c.width, H = c.height;
            ctx.clearRect(0, 0, W, H);
            // Backdrop
            ctx.fillStyle = "rgba(0,0,0,0.35)";
            ctx.fillRect(0, 0, W, H);
            // Grid
            ctx.strokeStyle = "rgba(255,255,255,0.08)";
            for (let g = 1; g < 4; g++) {
              const yy = (H * g) / 4;
              ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke();
            }
            // Curve
            if (hist.length > 1) {
              const grad = ctx.createLinearGradient(0, 0, 0, H);
              grad.addColorStop(0, "rgba(255, 80, 80, 0.95)");
              grad.addColorStop(0.5, "rgba(255, 200, 60, 0.95)");
              grad.addColorStop(1, "rgba(80, 200, 255, 0.95)");
              ctx.strokeStyle = grad;
              ctx.lineWidth = 2;
              ctx.beginPath();
              const stepX = W / (hist.length - 1);
              for (let i = 0; i < hist.length; i++) {
                const x = i * stepX;
                const y = H - hist[i] * H;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
              }
              ctx.stroke();
              // Fill under curve
              ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
              ctx.fillStyle = "rgba(80, 200, 255, 0.10)";
              ctx.fill();
            }
          }
        }
      } catch { /* engine not ready */ }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, running]);

  if (!enabled || !running) return null;

  // Energy label
  const label =
    level < 0.2 ? "🧊 Chill" :
    level < 0.4 ? "🌊 Warming" :
    level < 0.6 ? "🔥 Energy" :
    level < 0.8 ? "🚀 Peak" : "💥 PEAK!!";

  return (
    <div
      className="vdj-panel"
      style={{
        position: "fixed",
        right: 12,
        bottom: 64,
        width: 240,
        padding: 10,
        zIndex: 50,
        boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
        backdropFilter: "blur(6px)",
        userSelect: "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.8 }}>
          Crowd Energy
        </span>
        <span style={{ fontSize: 11, fontWeight: 800 }}>{label}</span>
      </div>
      {/* Level bar */}
      <div style={{ height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
        <div
          style={{
            height: "100%",
            width: `${Math.round(level * 100)}%`,
            background: "linear-gradient(90deg, #50c8ff, #ffc83c, #ff5050)",
            transition: "width 80ms linear",
          }}
        />
      </div>
      <canvas ref={canvasRef} width={220} height={60} style={{ width: "100%", height: 60, borderRadius: 4 }} />
    </div>
  );
}
