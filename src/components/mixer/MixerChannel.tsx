import { useApp, type DeckId } from "@/state/store";
import { setDeckCue, setDeckEQ, setDeckFader, setDeckFilter, setDeckGain } from "@/state/controller";
import { Knob } from "../console/Knob";
import { Fader } from "../console/Fader";
import { VuMeter } from "../console/VuMeter";
import { getDeck } from "@/audio/deck";
import { Headphones } from "lucide-react";
import { useT } from "@/lib/i18n";

export function MixerChannel({ id }: { id: DeckId }) {
  const t = useT();
  const ds = useApp((s) => s.decks[id]);
  const handle = getDeck(id);
  return (
    <div
      className="vdj-panel-inset"
      style={{
        padding: 10,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        minWidth: 78,
      }}
    >
      <div
        style={{
          fontWeight: 800,
          fontSize: 12,
          color: "var(--accent)",
          letterSpacing: "0.1em",
        }}
      >
        {t("chLabel")} {id}
      </div>
      <Knob value={ds.gain} min={0} max={2} defaultValue={1} size={36} label={t("chGain")} onChange={(v) => setDeckGain(id, v)} />
      <Knob value={ds.hi} min={-1} max={1} defaultValue={0} size={36} label={t("chHi")} bipolar onChange={(v) => setDeckEQ(id, "hi", v)} />
      <Knob value={ds.mid} min={-1} max={1} defaultValue={0} size={36} label={t("chMid")} bipolar onChange={(v) => setDeckEQ(id, "mid", v)} />
      <Knob value={ds.lo} min={-1} max={1} defaultValue={0} size={36} label={t("chLo")} bipolar onChange={(v) => setDeckEQ(id, "lo", v)} />
      <Knob value={ds.filter} min={-1} max={1} defaultValue={0} size={36} label={t("chFilter")} bipolar onChange={(v) => setDeckFilter(id, v)} />
      <button
        className="vdj-btn"
        data-active={ds.pflCue}
        onClick={() => setDeckCue(id, !ds.pflCue)}
        title={t("cuePfl")}
        style={{ padding: "4px 8px" }}
      >
        <Headphones size={12} />
      </button>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
        <VuMeter analyser={handle.analyser} orientation="vertical" width={6} height={140} />
        <Fader value={ds.fader} defaultValue={0.85} height={140} onChange={(v) => setDeckFader(id, v)} />
      </div>
    </div>
  );
}