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
  // Decks C and D mirror the same crossfader sides as A and B respectively.
  // (Some users assign C as a second left-side deck and D as a second right-side deck.)
  setXfaderGain("C", left);
  setXfaderGain("D", right);
}