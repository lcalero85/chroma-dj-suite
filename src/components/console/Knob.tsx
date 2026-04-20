import { useCallback, useRef } from "react";
import { clamp } from "@/lib/format";

interface KnobProps {
  value: number; // -1..1 or 0..1 depending on bipolar
  min?: number;
  max?: number;
  defaultValue?: number;
  onChange: (v: number) => void;
  label?: string;
  size?: number;
  bipolar?: boolean;
  format?: (v: number) => string;
  tooltip?: string;
}

export function Knob({
  value,
  min = 0,
  max = 1,
  defaultValue,
  onChange,
  label,
  size = 44,
  bipolar = false,
  format,
  tooltip,
}: KnobProps) {
  const ref = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const startVal = useRef(0);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      startY.current = e.clientY;
      startVal.current = value;
    },
    [value],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.buttons === 0) return;
      const dy = startY.current - e.clientY;
      const range = max - min;
      const sensitivity = e.shiftKey ? 0.0005 : 0.003;
      const nv = clamp(startVal.current + dy * sensitivity * range, min, max);
      onChange(nv);
    },
    [min, max, onChange],
  );

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const range = max - min;
      const step = e.shiftKey ? 0.001 : 0.01;
      onChange(clamp(value + (-Math.sign(e.deltaY) * step * range), min, max));
    },
    [value, min, max, onChange],
  );

  const onDoubleClick = useCallback(() => {
    if (defaultValue !== undefined) onChange(defaultValue);
  }, [defaultValue, onChange]);

  const norm = (value - min) / (max - min); // 0..1
  const angle = -135 + norm * 270;

  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
      title={tooltip}
    >
      <div
        ref={ref}
        className="vdj-knob"
        style={{ width: size, height: size }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onWheel={onWheel}
        onDoubleClick={onDoubleClick}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
      >
        <div className="ind" style={{ transform: `translateX(-50%) rotate(${angle}deg)`, transformOrigin: `50% ${size / 2 - 4}px` }} />
      </div>
      {label && <div className="vdj-label">{label}</div>}
      {format && <div className="vdj-readout" style={{ fontSize: 10 }}>{format(value)}</div>}
      {bipolar && <span style={{ display: "none" }} />}
    </div>
  );
}