import { useState } from "react";
import { useApp, type DeckId } from "@/state/store";
import { setDeckEQ } from "@/state/controller";
import { useT } from "@/lib/i18n";
import { Music2, RotateCcw } from "lucide-react";

/**
 * Lightweight "stems" panel — uses each deck's existing 3-band EQ as
 * Bass / Mids / High band cuts with mute/solo logic. This is a phase-1 stems
 * implementation that relies on real-time EQ rather than ML separation, so it
 * works on any device and never blocks the audio thread.
 */
export function StemsPanel() {
  const t = useT();
  const enabledDecks = useApp((s) => s.settings.enabledDecks ?? 2);
  const [activeDeck, setActiveDeck] = useState<DeckId>("A");
  const decks: DeckId[] = enabledDecks === 4 ? ["A", "B", "C", "D"] : ["A", "B"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Music2 size={14} style={{ color: "var(--accent)" }} />
        <span className="vdj-label">{t("stemsLabel")}</span>
        <span className="vdj-label" style={{ opacity: 0.6 }}>{t("stemsHint")}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {decks.map((d) => (
            <button
              key={d}
              className="vdj-btn"
              data-active={activeDeck === d}
              onClick={() => setActiveDeck(d)}
              style={{ padding: "4px 10px", minWidth: 32 }}
            >
              {t("stemsDeck")} {d}
            </button>
          ))}
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
          flex: 1,
          minHeight: 0,
        }}
      >
        <StemColumn deckId={activeDeck} band="lo" label={t("stemsBass")} color="#ff3b6b" />
        <StemColumn deckId={activeDeck} band="mid" label={t("stemsMids")} color="#ffb000" />
        <StemColumn deckId={activeDeck} band="hi" label={t("stemsHigh")} color="#19e1c3" />
      </div>
    </div>
  );
}

type Band = "lo" | "mid" | "hi";

function StemColumn({ deckId, band, label, color }: { deckId: DeckId; band: Band; label: string; color: string }) {
  const t = useT();
  const value = useApp((s) => s.decks[deckId][band]);
  const otherA = useApp((s) => (band === "lo" ? s.decks[deckId].mid : s.decks[deckId].lo));
  const otherB = useApp((s) => (band === "hi" ? s.decks[deckId].mid : s.decks[deckId].hi));
  const muted = value <= -0.99;
  // "Solo" = this stem at unity, the other two muted
  const isSolo = !muted && otherA <= -0.99 && otherB <= -0.99;

  const toggleMute = () => {
    setDeckEQ(deckId, band, muted ? 0 : -1);
  };
  const toggleSolo = () => {
    if (isSolo) {
      setDeckEQ(deckId, "lo", 0);
      setDeckEQ(deckId, "mid", 0);
      setDeckEQ(deckId, "hi", 0);
    } else {
      setDeckEQ(deckId, "lo", band === "lo" ? 0 : -1);
      setDeckEQ(deckId, "mid", band === "mid" ? 0 : -1);
      setDeckEQ(deckId, "hi", band === "hi" ? 0 : -1);
    }
  };
  const reset = () => setDeckEQ(deckId, band, 0);

  return (
    <div
      className="vdj-panel-inset"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: 12,
        borderTop: `2px solid ${color}`,
      }}
    >
      <div style={{ fontWeight: 800, color, letterSpacing: "0.1em", fontSize: 12 }}>{label}</div>
      <input
        type="range"
        min={-1}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => setDeckEQ(deckId, band, parseFloat(e.target.value))}
        style={{
          writingMode: "vertical-lr",
          WebkitAppearance: "slider-vertical" as unknown as undefined,
          width: 24,
          height: 140,
          accentColor: color,
        }}
        // @ts-expect-error legacy attr
        orient="vertical"
      />
      <div style={{ fontSize: 10, opacity: 0.7, fontFamily: "var(--font-mono)" }}>
        {(value * 12).toFixed(1)} dB
      </div>
      <div style={{ display: "flex", gap: 4, width: "100%" }}>
        <button
          className="vdj-btn"
          data-active={muted}
          onClick={toggleMute}
          style={{ flex: 1, padding: "4px 6px", fontSize: 10 }}
          title={t("stemsMute")}
        >
          M
        </button>
        <button
          className="vdj-btn"
          data-active={isSolo}
          onClick={toggleSolo}
          style={{ flex: 1, padding: "4px 6px", fontSize: 10 }}
          title={t("stemsSolo")}
        >
          S
        </button>
        <button
          className="vdj-btn"
          onClick={reset}
          style={{ flex: 1, padding: "4px 6px", fontSize: 10 }}
          title={t("stemsReset")}
        >
          <RotateCcw size={10} />
        </button>
      </div>
    </div>
  );
}