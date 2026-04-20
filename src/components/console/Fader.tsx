import { useCallback, useRef } from "react";
import { clamp } from "@/lib/format";

interface FaderProps {
  value: number;
  min?: number;
  max?: number;
  defaultValue?: number;
  onChange: (v: number) => void;
  height?: number;
  label?: string;
  bipolar?: boolean;
}

export function Fader({ value, min = 0, max = 1, defaultValue, onChange, height = 160, label, bipolar }: FaderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ y: number; val: number } | null>(null);

  const norm = (value - min) / (max - min); // 0..1
  const capTop = (1 - norm) * (height - 22);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      (e.target as Element).setPointerCapture?.(e.pointerId);
      dragStart.current = { y: e.clientY, val: value };
    },
    [value],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragStart.current) return;
      const dy = e.clientY - dragStart.current.y;
      const range = max - min;
      const v = dragStart.current.val - (dy / (height - 22)) * range;
      onChange(clamp(v, min, max));
    },
    [min, max, height, onChange],
  );

  const onPointerUp = useCallback(() => {
    dragStart.current = null;
  }, []);

  const onDoubleClick = useCallback(() => {
    if (defaultValue !== undefined) onChange(defaultValue);
  }, [defaultValue, onChange]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div
        ref={trackRef}
        className="vdj-fader-track"
        style={{ height }}
        onDoubleClick={onDoubleClick}
      >
        {bipolar && (
          <div
            style={{
              position: "absolute",
              left: -6,
              right: -6,
              top: "50%",
              height: 1,
              background: "var(--line-strong)",
            }}
          />
        )}
        <div
          className="vdj-fader-cap"
          style={{ top: capTop }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
      </div>
      {label && <div className="vdj-label">{label}</div>}
    </div>
  );
}