import { useApp, type DeckId } from "@/state/store";
import { beatJump, brake, setReverse } from "@/audio/transport";
import { Rewind, FastForward, RotateCcw, Disc, Square } from "lucide-react";

interface Props { id: DeckId }

export function ProControls({ id }: Props) {
  const ds = useApp((s) => s.decks[id]);
  const toggleSlip = () => useApp.getState().updateDeck(id, { slip: !ds.slip });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div className="vdj-label">PRO</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 4 }}>
        <button className="vdj-btn" title="Beat jump -4" style={{ fontSize: 9, padding: "4px 0" }} onClick={() => beatJump(id, -4)}>
          <Rewind size={10} />4
        </button>
        <button className="vdj-btn" title="Beat jump -1" style={{ fontSize: 9, padding: "4px 0" }} onClick={() => beatJump(id, -1)}>
          ◀1
        </button>
        <button className="vdj-btn" title="Beat jump +1" style={{ fontSize: 9, padding: "4px 0" }} onClick={() => beatJump(id, 1)}>
          1▶
        </button>
        <button className="vdj-btn" title="Beat jump +4" style={{ fontSize: 9, padding: "4px 0" }} onClick={() => beatJump(id, 4)}>
          4<FastForward size={10} />
        </button>
        <button className="vdj-btn" data-active={ds.slip} title="Slip mode (return to original position after action)" style={{ fontSize: 9, padding: "4px 0" }} onClick={toggleSlip}>
          SLIP
        </button>
        <button className="vdj-btn" data-active={ds.reverse} data-tone="danger" title="Reverse playback" style={{ fontSize: 9, padding: "4px 0" }} onClick={() => setReverse(id, !ds.reverse)}>
          <RotateCcw size={10} /> REV
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 4 }}>
        <button className="vdj-btn" title="Brake / spin-down to stop" style={{ fontSize: 9, padding: "4px 0" }} onClick={() => brake(id, 1.4)}>
          <Disc size={10} /> BRAKE
        </button>
        <button className="vdj-btn" title="Quick stop" style={{ fontSize: 9, padding: "4px 0" }} onClick={() => brake(id, 0.35)}>
          <Square size={10} /> STOP
        </button>
      </div>
    </div>
  );
}