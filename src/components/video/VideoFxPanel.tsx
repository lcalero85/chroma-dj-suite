import { useApp, defaultVideoFx, type DeckId } from "@/state/store";

const SLIDERS: { key: keyof ReturnType<typeof defaultVideoFx>; label: string; min: number; max: number; step: number; suffix?: string }[] = [
  { key: "blur",       label: "BLUR",     min: 0,   max: 20,  step: 0.5, suffix: "px" },
  { key: "brightness", label: "BRIGHT",   min: 0,   max: 2,   step: 0.05 },
  { key: "contrast",   label: "CONTRAST", min: 0,   max: 2,   step: 0.05 },
  { key: "saturate",   label: "SATURATE", min: 0,   max: 2,   step: 0.05 },
  { key: "hueRotate",  label: "HUE",      min: 0,   max: 360, step: 1, suffix: "°" },
  { key: "invert",     label: "INVERT",   min: 0,   max: 1,   step: 0.05 },
  { key: "rgbShift",   label: "RGB",      min: 0,   max: 20,  step: 0.5, suffix: "px" },
  { key: "glitch",     label: "GLITCH",   min: 0,   max: 1,   step: 0.02 },
  { key: "zoom",       label: "ZOOM",     min: 0.5, max: 2,   step: 0.02, suffix: "x" },
];

export function VideoFxPanel({ id }: { id: DeckId }) {
  const ds = useApp((s) => s.decks[id]);
  const fx = ds.videoFx ?? defaultVideoFx();
  if (!ds.hasVideo) return null;

  return (
    <div
      className="vdj-panel-inset"
      style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.18em",
          color: "var(--accent)",
        }}
      >
        <span>● VIDEO FX · DECK {id}</span>
        <button
          className="vdj-btn"
          style={{ padding: "2px 8px", fontSize: 9 }}
          onClick={() => useApp.getState().updateVideoFx(id, defaultVideoFx())}
        >
          RESET
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
        {SLIDERS.map((s) => (
          <label
            key={s.key}
            className="vdj-label"
            style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 9 }}
          >
            <span style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{s.label}</span>
              <span className="vdj-readout" style={{ fontSize: 9 }}>
                {(fx[s.key] as number).toFixed(s.step < 1 ? 2 : 0)}{s.suffix ?? ""}
              </span>
            </span>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={fx[s.key] as number}
              onChange={(e) =>
                useApp.getState().updateVideoFx(id, { [s.key]: parseFloat(e.target.value) })
              }
              style={{ width: "100%" }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}