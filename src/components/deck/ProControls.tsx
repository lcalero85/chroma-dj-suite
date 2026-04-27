import { useApp, type DeckId } from "@/state/store";
import { beatJump, brake, setReverse } from "@/audio/transport";
import { beginLoopRoll, endLoopRoll, beginCensor, endCensor, beginSlice, endSlice, beginPitchPlay, endPitchPlay } from "@/state/controller";
import { Rewind, FastForward, RotateCcw, Disc, Square, Music2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useState } from "react";

interface Props { id: DeckId }

export function ProControls({ id }: Props) {
  const ds = useApp((s) => s.decks[id]);
  const t = useT();
  const toggleSlip = () => useApp.getState().updateDeck(id, { slip: !ds.slip });
  // Beats per slice for the Slicer row. 1 beat → 8 pads = 1 bar.
  const [sliceBeats, setSliceBeats] = useState<number>(1);
  // Pitch Play — root hot-cue + 8 semitone offsets played as notes.
  const [pitchRoot, setPitchRoot] = useState<number>(0);
  // Default offsets: -4..+3 semitones around the root cue.
  const PITCH_OFFSETS = [-4, -3, -2, -1, 0, 1, 2, 3];

  // Press-and-hold helpers — keep the action active while the user holds the
  // pad (mouse, touch, keyboard). Pointer events handle all input devices.
  const holdProps = (begin: () => void, end: () => void) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      begin();
    },
    onPointerUp: (e: React.PointerEvent) => {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      end();
    },
    onPointerCancel: () => end(),
    onPointerLeave: (e: React.PointerEvent) => {
      // Only end if pointer button is no longer pressed (avoids double-end).
      if (e.buttons === 0) end();
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); begin(); }
    },
    onKeyUp: (e: React.KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); end(); }
    },
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div className="vdj-label">{t("pro")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 4 }}>
        <button className="vdj-btn" title={t("beatJumpMinus4")} style={{ fontSize: 9, padding: "4px 0" }} onClick={() => beatJump(id, -4)}>
          <Rewind size={10} />4
        </button>
        <button className="vdj-btn" title={t("beatJumpMinus1")} style={{ fontSize: 9, padding: "4px 0" }} onClick={() => beatJump(id, -1)}>
          ◀1
        </button>
        <button className="vdj-btn" title={t("beatJumpPlus1")} style={{ fontSize: 9, padding: "4px 0" }} onClick={() => beatJump(id, 1)}>
          1▶
        </button>
        <button className="vdj-btn" title={t("beatJumpPlus4")} style={{ fontSize: 9, padding: "4px 0" }} onClick={() => beatJump(id, 4)}>
          4<FastForward size={10} />
        </button>
        <button className="vdj-btn" data-active={ds.slip} title={t("slipMode")} style={{ fontSize: 9, padding: "4px 0" }} onClick={toggleSlip}>
          SLIP
        </button>
        <button className="vdj-btn" data-active={ds.reverse} data-tone="danger" title={t("reversePlayback")} style={{ fontSize: 9, padding: "4px 0" }} onClick={() => setReverse(id, !ds.reverse)}>
          <RotateCcw size={10} /> REV
        </button>
      </div>
      {/* Loop Roll pads (press & hold) */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span className="vdj-label" style={{ minWidth: 44, fontSize: 9 }}>{t("loopRoll")}</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4, flex: 1 }}>
          {[1 / 8, 1 / 4, 1 / 2, 1].map((b) => (
            <button
              key={b}
              className="vdj-btn"
              title={t("loopRollHold", { beats: b < 1 ? `1/${1 / b}` : String(b) })}
              style={{ fontSize: 9, padding: "4px 0", touchAction: "none" }}
              {...holdProps(() => beginLoopRoll(id, b), () => endLoopRoll(id))}
            >
              {b < 1 ? `1/${1 / b}` : b}
            </button>
          ))}
        </div>
        <button
          className="vdj-btn"
          data-tone="danger"
          title={t("censorHold")}
          style={{ fontSize: 9, padding: "4px 8px", touchAction: "none" }}
          {...holdProps(() => beginCensor(id), () => endCensor(id))}
        >
          {t("censor")}
        </button>
      </div>
      {/* Slicer — 8 pads, press & hold to retrigger each slice of the current bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span className="vdj-label" style={{ minWidth: 44, fontSize: 9 }}>{t("slicer")}</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 3, flex: 1 }}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <button
              key={i}
              className="vdj-btn"
              title={t("slicerHold", { n: i + 1 })}
              disabled={!ds.bpm}
              style={{ fontSize: 9, padding: "4px 0", touchAction: "none" }}
              {...holdProps(() => beginSlice(id, i, sliceBeats), () => endSlice(id))}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <select
          value={sliceBeats}
          onChange={(e) => setSliceBeats(Number(e.target.value))}
          title={t("slicerSize")}
          className="vdj-btn"
          style={{ fontSize: 9, padding: "3px 4px" }}
        >
          <option value={0.25}>1/4</option>
          <option value={0.5}>1/2</option>
          <option value={1}>1</option>
          <option value={2}>2</option>
        </select>
      </div>
      {/* Pitch Play — play a hot cue at different semitones, like a sampler. */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span className="vdj-label" style={{ minWidth: 44, fontSize: 9, display: "flex", alignItems: "center", gap: 2 }}>
          <Music2 size={10} /> {t("pitchPlay")}
        </span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 3, flex: 1 }}>
          {PITCH_OFFSETS.map((semi) => (
            <button
              key={semi}
              className="vdj-btn"
              title={t("pitchPlayHold", { n: semi >= 0 ? `+${semi}` : String(semi) })}
              disabled={!ds.hotCues.find((c) => c.id === pitchRoot)}
              style={{
                fontSize: 9,
                padding: "4px 0",
                touchAction: "none",
                fontWeight: semi === 0 ? 700 : 500,
              }}
              {...holdProps(
                () => beginPitchPlay(id, pitchRoot, semi),
                () => endPitchPlay(id),
              )}
            >
              {semi >= 0 ? `+${semi}` : semi}
            </button>
          ))}
        </div>
        <select
          value={pitchRoot}
          onChange={(e) => setPitchRoot(Number(e.target.value))}
          title={t("pitchPlayRoot")}
          className="vdj-btn"
          style={{ fontSize: 9, padding: "3px 4px" }}
        >
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <option key={i} value={i}>
              C{i + 1}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 4 }}>
        <button className="vdj-btn" title={t("brakeStop")} style={{ fontSize: 9, padding: "4px 0" }} onClick={() => brake(id, 1.4)}>
          <Disc size={10} /> BRAKE
        </button>
        <button className="vdj-btn" title={t("quickStop")} style={{ fontSize: 9, padding: "4px 0" }} onClick={() => brake(id, 0.35)}>
          <Square size={10} /> STOP
        </button>
      </div>
    </div>
  );
}