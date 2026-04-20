import { useEffect, useRef, useState } from "react";
import { getSlots, initSampler, loadSampleFromBlob, triggerSlot } from "@/audio/sampler";
import { ensureRunning } from "@/audio/engine";

export function SamplerPanel() {
  const [bank, setBank] = useState(0);
  const [, force] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<number | null>(null);

  useEffect(() => {
    initSampler();
    void ensureRunning();
  }, []);

  const slots = getSlots().filter((s) => s.bank === bank);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span className="vdj-label">SAMPLER · BANK</span>
        {[0, 1, 2, 3].map((b) => (
          <button key={b} className="vdj-btn" data-active={bank === b} onClick={() => setBank(b)}>
            {b + 1}
          </button>
        ))}
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f || target === null) return;
            await loadSampleFromBlob(target, f, f.name);
            force((x) => x + 1);
          }}
        />
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gridAutoRows: "1fr", gap: 8 }}>
        {slots.map((s) => (
          <div
            key={s.id}
            className="vdj-pad"
            data-armed={!!s.buffer}
            style={{ color: s.color, height: "auto", flexDirection: "column", padding: 6 }}
            onClick={() => (s.buffer ? triggerSlot(s.id) : (setTarget(s.id), fileRef.current?.click()))}
            onContextMenu={(e) => {
              e.preventDefault();
              setTarget(s.id);
              fileRef.current?.click();
            }}
          >
            <div style={{ fontSize: 9, opacity: 0.7 }}>{s.id - bank * 16 + 1}</div>
            <div style={{ fontSize: 10, marginTop: 4, textAlign: "center" }}>{s.buffer ? s.name : "Cargar"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}