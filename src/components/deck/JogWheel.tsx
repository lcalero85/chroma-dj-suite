import { useCallback, useEffect, useRef } from "react";

interface JogWheelProps {
  spinning: boolean;
  bpm: number | null;
  size?: number;
  onScratch?: (deltaSec: number) => void;
  onNudge?: (delta: number) => void;
}

export function JogWheel({ spinning, bpm, size = 220, onScratch, onNudge }: JogWheelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const angle = useRef(0);
  const last = useRef(performance.now());
  const dragLast = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const now = performance.now();
      const dt = (now - last.current) / 1000;
      last.current = now;
      if (spinning) {
        // 33⅓ rpm visual baseline modulated by bpm vs 120
        const rpm = 33 + (bpm ? (bpm - 120) * 0.1 : 0);
        angle.current += dt * rpm * 6; // 6 deg per rpm-second
      }
      if (ref.current) ref.current.style.transform = `rotate(${angle.current}deg)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [spinning, bpm]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragLast.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragLast.current) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const a1 = Math.atan2(dragLast.current.y - cy, dragLast.current.x - cx);
      const a2 = Math.atan2(e.clientY - cy, e.clientX - cx);
      let da = a2 - a1;
      if (da > Math.PI) da -= Math.PI * 2;
      if (da < -Math.PI) da += Math.PI * 2;
      const deg = (da * 180) / Math.PI;
      angle.current += deg;
      // Inner area = scratch (seek), outer ring = nudge (pitch bend)
      const r = Math.hypot(e.clientX - cx, e.clientY - cy);
      const outer = r > rect.width * 0.38;
      if (outer) {
        onNudge?.(deg / 360);
      } else {
        // 1 full revolution ≈ 1.8 seconds of audio scrub
        onScratch?.((deg / 360) * 1.8);
      }
      dragLast.current = { x: e.clientX, y: e.clientY };
    },
    [onScratch, onNudge],
  );

  const onPointerUp = useCallback(() => {
    dragLast.current = null;
  }, []);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "radial-gradient(circle at 50% 50%, var(--surface-4) 0%, var(--surface-2) 65%, var(--surface-1) 100%)",
        border: "1px solid var(--line-strong)",
        boxShadow: "var(--shadow-1), inset 0 2px 0 rgba(255,255,255,0.05)",
        position: "relative",
        userSelect: "none",
        touchAction: "none",
        cursor: "grab",
        margin: "0 auto",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* outer ring marks */}
      <div
        ref={ref}
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
        }}
      >
        {/* index marker */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 6,
            width: 4,
            height: 22,
            background: "var(--accent)",
            borderRadius: 2,
            transform: "translateX(-50%)",
            boxShadow: "0 0 8px var(--accent)",
          }}
        />
        {/* spokes */}
        {Array.from({ length: 16 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 1,
              height: size / 2 - 16,
              background: "rgba(255,255,255,0.05)",
              transformOrigin: "0 0",
              transform: `rotate(${(i * 360) / 16}deg)`,
            }}
          />
        ))}
      </div>
      {/* inner platter label */}
      <div
        style={{
          position: "absolute",
          inset: "22%",
          borderRadius: "50%",
          background: "linear-gradient(160deg, var(--surface-3), var(--surface-1))",
          border: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          color: "var(--text-2)",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          pointerEvents: "none",
        }}
      >
        <div style={{ fontSize: 22, color: "var(--text-1)" }}>{bpm ? bpm.toFixed(1) : "—"}</div>
        <div>BPM</div>
      </div>
    </div>
  );
}