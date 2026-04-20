import { useApp, type DeckId } from "@/state/store";
import {
  togglePlay,
  cueDeck,
  syncDeck,
  setDeckPitch,
  addHotCue,
  jumpHotCue,
  setLoop,
  loopIn,
  loopOut,
  loopHalve,
  loopDouble,
  clearLoop,
  seekDeck,
  nudgeDeck,
} from "@/state/controller";
import { Waveform } from "./Waveform";
import { JogWheel } from "./JogWheel";
import { Fader } from "../console/Fader";
import { VuMeter } from "../console/VuMeter";
import { ProControls } from "./ProControls";
import { getDeck } from "@/audio/deck";
import { formatTime } from "@/lib/format";
import { Play, Pause, RotateCcw, Headphones, Lock, ChevronUp, ChevronDown } from "lucide-react";
import { keyName } from "@/lib/camelot";

interface DeckProps {
  id: DeckId;
  side: "left" | "right";
}

export function Deck({ id, side }: DeckProps) {
  const ds = useApp((s) => s.decks[id]);
  const masterId: DeckId = id === "A" ? "B" : "A";

  const handle = getDeck(id);

  return (
    <div
      className="vdj-panel"
      style={{
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        height: "100%",
        minHeight: 0,
      }}
    >
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: "var(--accent)",
              color: "var(--surface-1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontFamily: "var(--font-mono)",
              boxShadow: ds.isPlaying ? "var(--beat-glow)" : "none",
            }}
          >
            {id}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 260,
              }}
              title={ds.title}
            >
              {ds.title}
            </div>
            <div className="vdj-label" style={{ marginTop: 2 }}>
              {ds.artist || "—"}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="vdj-chip" style={{ color: "var(--accent)", borderColor: "var(--accent)" }}>
            {ds.bpm ? ds.bpm.toFixed(1) : "--.--"} BPM
          </span>
          <span className="vdj-chip" title={ds.key ? keyName(ds.key) : ""}>
            {ds.key ?? "—"}
          </span>
        </div>
      </div>

      {/* mini overview + main waveform */}
      <Waveform
        peaks={ds.peaks}
        position={ds.position}
        bpm={ds.bpm}
        duration={ds.duration}
        hotCues={ds.hotCues}
        height={28}
        variant="mini"
        onSeek={(p) => seekDeck(id, p)}
      />
      <Waveform
        peaks={ds.peaks}
        position={ds.position}
        bpm={ds.bpm}
        duration={ds.duration}
        loopStart={ds.loopStart}
        loopEnd={ds.loopEnd}
        hotCues={ds.hotCues}
        height={84}
        variant="main"
      />

      {/* time + jog row */}
      <div style={{ display: "grid", gridTemplateColumns: side === "left" ? "1fr auto" : "auto 1fr", gap: 12, alignItems: "center" }}>
        {side === "left" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <TimeDisplay deck={ds} />
            <Transport id={id} masterId={masterId} />
            <PitchSection id={id} />
          </div>
        )}
        <JogWheel
          spinning={ds.isPlaying}
          bpm={ds.bpm}
          size={180}
          onScratch={(s) => nudgeDeck(id, s)}
          onNudge={(d) => setDeckPitch(id, Math.max(-1, Math.min(1, ds.pitch + d * 0.2)))}
        />
        {side === "right" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <TimeDisplay deck={ds} />
            <Transport id={id} masterId={masterId} />
            <PitchSection id={id} />
          </div>
        )}
      </div>

      {/* hot cues + loops */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <div className="vdj-label" style={{ marginBottom: 6 }}>Hot Cues</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4 }}>
            {Array.from({ length: 8 }).map((_, i) => {
              const cue = ds.hotCues.find((c) => c.id === i);
              return (
                <div
                  key={i}
                  className="vdj-pad"
                  data-armed={!!cue}
                  style={{ color: cue?.color, height: 34, fontSize: 10 }}
                  onClick={() => (cue ? jumpHotCue(id, i) : addHotCue(id, i))}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    addHotCue(id, i);
                  }}
                  title={cue ? `Jump to cue ${i + 1}` : `Set cue ${i + 1}`}
                >
                  {i + 1}
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <div className="vdj-label" style={{ marginBottom: 6 }}>Loops</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4 }}>
            {[1 / 8, 1 / 4, 1 / 2, 1, 2, 4, 8, 16].map((b) => (
              <button
                key={b}
                className="vdj-btn"
                style={{ padding: "4px 0", fontSize: 10 }}
                onClick={() => setLoop(id, b)}
              >
                {b < 1 ? `1/${1 / b}` : b}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 4, marginTop: 6 }}>
            <button className="vdj-btn" style={{ fontSize: 9, padding: "4px 0" }} onClick={() => loopIn(id)}>IN</button>
            <button className="vdj-btn" style={{ fontSize: 9, padding: "4px 0" }} onClick={() => loopOut(id)}>OUT</button>
            <button className="vdj-btn" style={{ fontSize: 9, padding: "4px 0" }} onClick={() => loopHalve(id)}>÷2</button>
            <button className="vdj-btn" style={{ fontSize: 9, padding: "4px 0" }} onClick={() => loopDouble(id)}>×2</button>
            <button className="vdj-btn" data-tone="danger" data-active={ds.loopActive} style={{ fontSize: 9, padding: "4px 0" }} onClick={() => clearLoop(id)}>X</button>
          </div>
        </div>
      </div>

      {/* pro controls: beat jump, slip, reverse, brake */}
      <ProControls id={id} />

      {/* deck VU */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="vdj-label">SIGNAL</span>
        <div style={{ flex: 1 }}>
          <VuMeter analyser={handle.analyser} orientation="horizontal" width={6} height={140} />
        </div>
      </div>
    </div>
  );
}

function TimeDisplay({ deck }: { deck: ReturnType<typeof useApp.getState>["decks"]["A"] }) {
  const remain = Math.max(0, deck.duration - deck.duration * deck.position);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <div className="vdj-readout" style={{ fontSize: 18, color: "var(--accent)" }}>
        {formatTime(deck.duration * deck.position)}
      </div>
      <div className="vdj-readout" style={{ fontSize: 12, color: "var(--text-3)" }}>
        -{formatTime(remain)}
      </div>
    </div>
  );
}

function Transport({ id, masterId }: { id: DeckId; masterId: DeckId }) {
  const ds = useApp((s) => s.decks[id]);
  return (
    <div style={{ display: "flex", gap: 4 }}>
      <button
        className="vdj-btn"
        data-active={ds.isPlaying}
        onClick={() => togglePlay(id)}
        title="Play / Pause"
        style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
      >
        {ds.isPlaying ? <Pause size={12} /> : <Play size={12} />} {ds.isPlaying ? "Pause" : "Play"}
      </button>
      <button className="vdj-btn" onClick={() => cueDeck(id)} title="Cue">
        <RotateCcw size={12} /> Cue
      </button>
      <button className="vdj-btn" onClick={() => syncDeck(id, masterId)} title={`Sync to deck ${masterId}`}>
        Sync
      </button>
    </div>
  );
}

function PitchSection({ id }: { id: DeckId }) {
  const ds = useApp((s) => s.decks[id]);
  const cycleRange = () => {
    const next: 8 | 16 | 50 = ds.pitchRange === 8 ? 16 : ds.pitchRange === 16 ? 50 : 8;
    useApp.getState().updateDeck(id, { pitchRange: next });
  };
  const toggleKeyLock = () => useApp.getState().updateDeck(id, { keyLock: !ds.keyLock });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <button className="vdj-btn" data-active={ds.keyLock} onClick={toggleKeyLock} title="Key lock">
        <Lock size={12} /> Key
      </button>
      <button className="vdj-btn" onClick={cycleRange} title="Pitch range">
        ±{ds.pitchRange}%
      </button>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <button className="vdj-btn" style={{ padding: "2px 6px" }} onClick={() => setDeckPitch(id, Math.min(1, ds.pitch + 0.02))}>
          <ChevronUp size={10} />
        </button>
        <button className="vdj-btn" style={{ padding: "2px 6px" }} onClick={() => setDeckPitch(id, Math.max(-1, ds.pitch - 0.02))}>
          <ChevronDown size={10} />
        </button>
      </div>
      <div className="vdj-readout" style={{ fontSize: 11, color: ds.pitch === 0 ? "var(--text-2)" : "var(--accent)" }}>
        {(ds.pitch * ds.pitchRange).toFixed(2)}%
      </div>
      <button className="vdj-btn" data-active={ds.pflCue} onClick={() => useApp.getState().updateDeck(id, { pflCue: !ds.pflCue })} title="Cue / PFL">
        <Headphones size={12} />
      </button>
    </div>
  );
}