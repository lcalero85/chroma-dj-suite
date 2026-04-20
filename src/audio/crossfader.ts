import { setXfaderGain } from "./deck";

export type XfaderCurve = "linear" | "smooth" | "sharp";

function curveValue(pos: number, curve: XfaderCurve): { left: number; right: number } {
  // pos: -1 (full A) .. 1 (full B)
  const t = (pos + 1) / 2; // 0..1
  let l = 1 - t;
  let r = t;
  if (curve === "smooth") {
    l = Math.cos((t * Math.PI) / 2);
    r = Math.sin((t * Math.PI) / 2);
  } else if (curve === "sharp") {
    l = t < 0.5 ? 1 : Math.max(0, 1 - (t - 0.5) * 4);
    r = t > 0.5 ? 1 : Math.max(0, t * 4);
  }
  return { left: l, right: r };
}

export function applyCrossfader(pos: number, curve: XfaderCurve) {
  const { left, right } = curveValue(pos, curve);
  setXfaderGain("A", left);
  setXfaderGain("B", right);
}