import { useApp } from "@/state/store";
import { autoMixTo, setSleepTimer, tap } from "@/audio/transport";
import { useState } from "react";
import { toast } from "sonner";

export function MasterPro() {
  const mixer = useApp((s) => s.mixer);
  const decks = useApp((s) => s.decks);
  const setMasterDeck = (d: "A" | "B") => useApp.getState().updateMixer({ masterDeck: d });
  const toggleQuantize = () => useApp.getState().updateMixer({ quantize: !mixer.quantize });
  const [tappedBpm, setTappedBpm] = useState<number | null>(null);

  const masterBpm = decks[mixer.masterDeck]?.bpm ?? null;

  const onTap = () => {
    const bpm = tap();
    if (bpm) setTappedBpm(Math.round(bpm * 10) / 10);
  };

  const onAutoMix = () => {
    const target = mixer.xfader >= 0 ? -1 : 1;
    const ok = autoMixTo(target, 8);
    if (ok) toast(`Auto-mix → Deck ${target === -1 ? "A" : "B"} (8s)`);
  };

  const sleepOptions = [0, 5, 15, 30, 60];

  return (
    <div className="vdj-panel-inset" style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="vdj-label">MASTER CLOCK</span>
        <span className="vdj-readout" style={{ fontSize: 12, color: "var(--accent)" }}>
          {masterBpm ? masterBpm.toFixed(1) : "--.--"} BPM
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
        <button className="vdj-btn" data-active={mixer.masterDeck === "A"} style={{ fontSize: 9 }} onClick={() => setMasterDeck("A")}>MST A</button>
        <button className="vdj-btn" data-active={mixer.masterDeck === "B"} style={{ fontSize: 9 }} onClick={() => setMasterDeck("B")}>MST B</button>
        <button className="vdj-btn" data-active={mixer.quantize} style={{ fontSize: 9 }} onClick={toggleQuantize} title="Snap cues/loops to beat">QNT</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, alignItems: "center" }}>
        <button className="vdj-btn" style={{ fontSize: 9 }} onClick={onTap} title="Tap tempo">TAP {tappedBpm ? tappedBpm.toFixed(1) : ""}</button>
        <button className="vdj-btn" style={{ fontSize: 9 }} onClick={onAutoMix} title="Auto crossfade to other deck">AUTO MIX</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span className="vdj-label">SLEEP TIMER</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 3 }}>
          {sleepOptions.map((m) => (
            <button
              key={m}
              className="vdj-btn"
              data-active={mixer.sleepMinutes === m}
              style={{ fontSize: 9, padding: "3px 0" }}
              onClick={() => {
                setSleepTimer(m);
                toast(m === 0 ? "Sleep timer off" : `Sleep en ${m} min`);
              }}
            >
              {m === 0 ? "OFF" : `${m}m`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}