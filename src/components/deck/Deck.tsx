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
  loadTrackToDeck,
} from "@/state/controller";
import { Waveform } from "./Waveform";
import { JogWheel } from "./JogWheel";
import { Fader } from "../console/Fader";
import { VuMeter } from "../console/VuMeter";
import { ProControls } from "./ProControls";
import { BpmControls } from "./BpmControls";
import { getDeck } from "@/audio/deck";
import { formatTime } from "@/lib/format";
import { Play, Pause, RotateCcw, Headphones, Lock, ChevronUp, ChevronDown } from "lucide-react";
import { keyName } from "@/lib/camelot";
import { VideoFxPanel } from "../video/VideoFxPanel";
import { useState } from "react";
import { toast } from "sonner";
import { useT, t as tGlobal } from "@/lib/i18n";
import { setDeckVocalCut } from "@/state/controller";

interface DeckProps {
  id: DeckId;
  side: "left" | "right";
}

export function Deck({ id, side }: DeckProps) {
  const ds = useApp((s) => s.decks[id]);
  const waveformStyle = useApp((s) => s.settings.waveformStyle ?? "classic");
  const masterId: DeckId = id === "A" ? "B" : "A";

  const handle = getDeck(id);
  const [dragOver, setDragOver] = useState(false);
  const t = useT();

  return (
    <div
      className="vdj-panel"
      data-loaded={!!ds.duration && !ds.isPlaying}
      data-playing={ds.isPlaying}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("text/track-id")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          if (!dragOver) setDragOver(true);
        }
      }}
      onDragLeave={(e) => {
        // Only clear when leaving the deck container
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={(e) => {
        const tid = e.dataTransfer.getData("text/track-id");
        setDragOver(false);
        if (!tid) return;
        e.preventDefault();
        e.stopPropagation();
        void loadTrackToDeck(id, tid).then(() => toast(`${tGlobal("loadedToast")} ${id}`));
      }}
      style={{
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
        position: "relative",
        outline: dragOver ? "2px dashed var(--accent)" : undefined,
        outlineOffset: dragOver ? -4 : undefined,
        boxShadow: dragOver ? "inset 0 0 0 9999px color-mix(in oklab, var(--accent) 8%, transparent)" : undefined,
        transition: "outline-color 120ms",
      }}
    >
      {dragOver && (
        <div
          style={{
            position: "absolute",
            inset: 8,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--accent)",
            fontWeight: 800,
            fontSize: 14,
            letterSpacing: 1,
            pointerEvents: "none",
            zIndex: 5,
            background: "color-mix(in oklab, var(--accent) 6%, transparent)",
          }}
        >
          {t("dropToLoad")} {id}
        </div>
      )}
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
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 200,
              }}
              title={ds.title}
              >
                {ds.title}
              </div>
              {ds.duration > 0 && (
                <span
                  className="vdj-loaded-badge"
                  data-tone={ds.isPlaying ? "live" : undefined}
                  title={ds.isPlaying ? t("playing") : t("trackLoaded")}
                >
                  <span className="dot" />
                  {ds.isPlaying ? t("live") : t("loaded")}
                </span>
              )}
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

      {/* Waveforms: always visible right under the header (outside the scroll) */}
      <Waveform
        peaks={ds.peaks}
        bands={ds.bands}
        position={ds.position}
        bpm={ds.bpm}
        duration={ds.duration}
        hotCues={ds.hotCues}
        height={32}
        variant="mini"
        isPlaying={ds.isPlaying}
        onSeek={(p) => seekDeck(id, p)}
      />
      <Waveform
        peaks={ds.peaks}
        bands={ds.bands}
        position={ds.position}
        bpm={ds.bpm}
        duration={ds.duration}
        loopStart={ds.loopStart}
        loopEnd={ds.loopEnd}
        hotCues={ds.hotCues}
        height={96}
        variant="main"
        isPlaying={ds.isPlaying}
        styleVariant={waveformStyle}
      />

      <div
        className="vdj-scroll"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          paddingRight: 4,
        }}
      >
      {/* time + jog row */}
      <div style={{ display: "grid", gridTemplateColumns: side === "left" ? "1fr auto" : "auto 1fr", gap: 12, alignItems: "center" }}>
        {side === "left" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <TimeDisplay deck={ds} />
            <Transport id={id} masterId={masterId} />
            <PitchSection id={id} />
            <BpmControls id={id} />
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
            <BpmControls id={id} />
          </div>
        )}
      </div>

      {/* hot cues + loops */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <div className="vdj-label" style={{ marginBottom: 6 }}>{t("hotCues")}</div>
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
          <div className="vdj-label" style={{ marginBottom: 6 }}>{t("loops")}</div>
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

      <AdvancedDeckExtras id={id} />

      <VocalCutBar id={id} />

      {/* deck VU */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="vdj-label">{t("signal")}</span>
        <div style={{ flex: 1 }}>
          <VuMeter analyser={handle.analyser} orientation="horizontal" width={6} height={140} />
        </div>
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
  const t = useT();
  return (
    <div style={{ display: "flex", gap: 4 }}>
      <button
        className="vdj-btn"
        data-active={ds.isPlaying}
        onClick={() => togglePlay(id)}
        title={`${t("play")} / ${t("pause")}`}
        style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
      >
        {ds.isPlaying ? <Pause size={12} /> : <Play size={12} />} {ds.isPlaying ? t("pause") : t("play")}
      </button>
      <button className="vdj-btn" onClick={() => cueDeck(id)} title={t("cue")}>
        <RotateCcw size={12} /> {t("cue")}
      </button>
      <button className="vdj-btn" onClick={() => syncDeck(id, masterId)} title={`${t("sync")} → ${masterId}`}>
        {t("sync")}
      </button>
    </div>
  );
}

function PitchSection({ id }: { id: DeckId }) {
  const ds = useApp((s) => s.decks[id]);
  const t = useT();
  const cycleRange = () => {
    const next: 8 | 16 | 50 = ds.pitchRange === 8 ? 16 : ds.pitchRange === 16 ? 50 : 8;
    useApp.getState().updateDeck(id, { pitchRange: next });
  };
  const toggleKeyLock = () => useApp.getState().updateDeck(id, { keyLock: !ds.keyLock });
  // Vertical pitch fader: top = -pitch (slower), bottom = +pitch (faster) — DJ convention.
  // We invert so dragging up actually slows the track (matches CDJ/Pioneer).
  const fader = (
    <div
      className="vdj-panel-inset"
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "6px 4px" }}
      title={t("pitchFader")}
    >
      <Fader
        value={-ds.pitch}
        min={-1}
        max={1}
        defaultValue={0}
        height={120}
        onChange={(v) => setDeckPitch(id, -v)}
      />
    </div>
  );
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
      {fader}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        <div style={{ display: "flex", gap: 4 }}>
          <button className="vdj-btn" data-active={ds.keyLock} onClick={toggleKeyLock} title={t("keyLock")} style={{ flex: 1, fontSize: 10 }}>
            <Lock size={10} /> {t("keyLock")}
          </button>
          <button className="vdj-btn" onClick={cycleRange} title={t("pitchRange")} style={{ flex: 1, fontSize: 10 }}>
            ±{ds.pitchRange}%
          </button>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <button className="vdj-btn" style={{ padding: "2px 6px" }} onClick={() => setDeckPitch(id, Math.min(1, ds.pitch + 0.02))} title="Pitch +">
              <ChevronUp size={10} />
            </button>
            <button className="vdj-btn" style={{ padding: "2px 6px" }} onClick={() => setDeckPitch(id, Math.max(-1, ds.pitch - 0.02))} title="Pitch -">
              <ChevronDown size={10} />
            </button>
          </div>
          <button
            className="vdj-btn"
            onClick={() => setDeckPitch(id, 0)}
            title={t("resetPitch")}
            style={{ fontSize: 9, padding: "2px 6px" }}
          >
            0%
          </button>
          <div className="vdj-readout" style={{ fontSize: 12, color: ds.pitch === 0 ? "var(--text-2)" : "var(--accent)", flex: 1, textAlign: "right" }}>
            {ds.pitch > 0 ? "+" : ""}{(ds.pitch * ds.pitchRange).toFixed(2)}%
          </div>
        </div>
        <button className="vdj-btn" data-active={ds.pflCue} onClick={() => useApp.getState().updateDeck(id, { pflCue: !ds.pflCue })} title={t("cuePfl")} style={{ fontSize: 10 }}>
          <Headphones size={10} /> {t("cue")}
        </button>
      </div>
    </div>
  );
}

function AdvancedDeckExtras({ id }: { id: DeckId }) {
  const mode = useApp((s) => s.settings.appMode);
  if (mode !== "advanced") return null;
  return (
    <>
      {/* pro controls: beat jump, slip, reverse, brake */}
      <ProControls id={id} />
      {/* video FX (only when a video clip is loaded) */}
      <VideoFxPanel id={id} />
    </>
  );
}

function VocalCutBar({ id }: { id: DeckId }) {
  const ds = useApp((s) => s.decks[id]);
  const t = useT();
  const v = ds.vocalCut ?? 0;
  return (
    <div
      className="vdj-panel-inset"
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px" }}
      title={t("vocalCutTitle")}
    >
      <span className="vdj-label" style={{ minWidth: 44, color: v > 0.05 ? "var(--accent)" : undefined }}>{t("vocalCut")}</span>
      <button
        className="vdj-btn"
        data-active={v < 0.05}
        style={{ fontSize: 9, padding: "2px 6px" }}
        onClick={() => setDeckVocalCut(id, 0)}
      >
        {t("vocalOff")}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={v}
        onChange={(e) => setDeckVocalCut(id, parseFloat(e.target.value))}
        style={{ flex: 1, accentColor: "var(--accent)" }}
      />
      <button
        className="vdj-btn"
        data-active={v > 0.95}
        style={{ fontSize: 9, padding: "2px 6px" }}
        onClick={() => setDeckVocalCut(id, 1)}
      >
        {t("vocalKaraoke")}
      </button>
      <span className="vdj-readout" style={{ fontSize: 10, minWidth: 32, textAlign: "right" }}>{Math.round(v * 100)}%</span>
    </div>
  );
}