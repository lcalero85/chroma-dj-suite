import { useEffect, useRef, useState } from "react";
import {
  getSlots,
  initSampler,
  loadSampleFromBlob,
  triggerSlot,
  setSlotVolume,
  setSlotColor,
  setSlotLoop,
  startSlotLoop,
  stopSlot,
  setSlotChokeGroup,
  setSlotMute,
  setSlotSolo,
} from "@/audio/sampler";
import { ensureRunning } from "@/audio/engine";
import { useT } from "@/lib/i18n";

export function SamplerPanel() {
  const t = useT();
  const [bank, setBank] = useState(0);
  const [, force] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<number | null>(null);
  const stopFns = useRef<Map<number, () => void>>(new Map());

  const PAD_PALETTE = ["#ff3b6b", "#ffb000", "#19e1c3", "#7c5cff", "#ff7a18", "#19a7ff", "#a3ff19", "#ff19c4"];

  useEffect(() => {
    initSampler();
    void ensureRunning();
  }, []);

  const slots = getSlots().filter((s) => s.bank === bank);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span className="vdj-label">{t("samplerBank")}</span>
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
      <div style={{ fontSize: 9, opacity: 0.6, marginTop: -4 }}>
        {t("samplerProTip")}
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gridAutoRows: "1fr", gap: 8 }}>
        {slots.map((s) => (
          <div
            key={s.id}
            className="vdj-pad"
            data-armed={!!s.buffer && !s.mute}
            style={{ color: s.color, height: "auto", flexDirection: "column", padding: 6, gap: 4, justifyContent: "space-between" }}
            role="group"
            aria-label={s.buffer ? `Sampler pad ${s.id - bank * 16 + 1}: ${s.name}` : `Empty sampler pad ${s.id - bank * 16 + 1}`}
          >
            <div
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", width: "100%" }}
              role="button"
              tabIndex={0}
              aria-label={
                s.buffer
                  ? t("samplerTipLoaded", { action: s.loop ? t("samplerActionLoop") : t("samplerActionTrigger"), name: s.name })
                  : t("samplerTipEmpty")
              }
              onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                if (!s.buffer) {
                  setTarget(s.id);
                  fileRef.current?.click();
                  return;
                }
                if (s.loop) {
                  const existing = stopFns.current.get(s.id);
                  if (existing) {
                    existing();
                    stopFns.current.delete(s.id);
                  } else {
                    const stop = startSlotLoop(s.id);
                    if (stop) stopFns.current.set(s.id, stop);
                  }
                  force((x) => x + 1);
                  return;
                }
                triggerSlot(s.id);
              }}
              onClick={() => {
                if (!s.buffer) {
                  setTarget(s.id);
                  fileRef.current?.click();
                  return;
                }
                if (s.loop) {
                  // toggle loop on/off
                  const existing = stopFns.current.get(s.id);
                  if (existing) {
                    existing();
                    stopFns.current.delete(s.id);
                  } else {
                    const stop = startSlotLoop(s.id);
                    if (stop) stopFns.current.set(s.id, stop);
                  }
                  force((x) => x + 1);
                  return;
                }
                triggerSlot(s.id);
              }}
              onPointerDown={() => {
                // Hold-to-play in loop mode
                if (s.buffer && s.loop) return; // handled in onClick toggle for clarity
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setTarget(s.id);
                fileRef.current?.click();
              }}
              title={s.buffer ? t("samplerTipLoaded", { action: s.loop ? t("samplerActionLoop") : t("samplerActionTrigger"), name: s.name }) : t("samplerTipEmpty")}
            >
              <div style={{ fontSize: 9, opacity: 0.7 }}>{s.id - bank * 16 + 1}</div>
              <div style={{ fontSize: 10, marginTop: 4, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                {s.buffer ? s.name : t("samplerLoad")}
              </div>
              {s.loop && stopFns.current.has(s.id) && <div style={{ fontSize: 8, opacity: 0.85 }}>{t("samplerLoopBadge")}</div>}
                {(s.chokeGroup ?? 0) > 0 && (
                  <div style={{ fontSize: 8, opacity: 0.75, fontFamily: "var(--font-mono)" }}>
                    CG{s.chokeGroup}
                  </div>
                )}
            </div>
            {s.buffer && (
              <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", gap: 2, width: "100%", paddingTop: 2, borderTop: "1px solid color-mix(in oklab, currentColor 18%, transparent)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 3 }} title={t("samplerVolumeTip")}>
                  <span style={{ fontSize: 8, opacity: 0.7, fontFamily: "var(--font-mono)" }}>VOL</span>
                  <input
                    type="range"
                    min={0}
                    max={1.5}
                    step={0.005}
                    defaultValue={s.volume}
                    onChange={(e) => { setSlotVolume(s.id, parseFloat(e.target.value)); force((x) => x + 1); }}
                    style={{ flex: 1, height: 12, accentColor: "currentColor" }}
                  />
                  <span style={{ fontSize: 8, opacity: 0.7, fontFamily: "var(--font-mono)", minWidth: 22, textAlign: "right" }}>{Math.round(s.volume * 100)}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <button
                    className="vdj-btn"
                    data-active={!!s.mute}
                    onClick={() => { setSlotMute(s.id, !s.mute); force((x) => x + 1); }}
                    style={{ padding: "1px 4px", fontSize: 8, flex: 1 }}
                    title={t("samplerMuteTip")}
                  >
                    M
                  </button>
                  <button
                    className="vdj-btn"
                    data-active={!!s.solo}
                    onClick={() => { setSlotSolo(s.id, !s.solo); force((x) => x + 1); }}
                    style={{ padding: "1px 4px", fontSize: 8, flex: 1 }}
                    title={t("samplerSoloTip")}
                  >
                    S
                  </button>
                  <select
                    value={s.chokeGroup ?? 0}
                    onChange={(e) => { setSlotChokeGroup(s.id, parseInt(e.target.value, 10)); force((x) => x + 1); }}
                    title={t("samplerChokeTip")}
                    style={{ flex: 1, fontSize: 8, padding: "1px 2px", background: "var(--panel-2)", color: "currentColor", border: "1px solid color-mix(in oklab, currentColor 25%, transparent)", borderRadius: 2 }}
                  >
                    <option value={0}>CG-</option>
                    {[1,2,3,4,5,6,7,8].map((n) => <option key={n} value={n}>CG{n}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <button
                    className="vdj-btn"
                    data-active={!!s.loop}
                    onClick={() => { setSlotLoop(s.id, !s.loop); if (!s.loop === false) { const fn = stopFns.current.get(s.id); fn?.(); stopFns.current.delete(s.id); } force((x) => x + 1); }}
                    style={{ padding: "1px 4px", fontSize: 8, flex: 1 }}
                    title={t("samplerLoopTip")}
                  >
                    LOOP
                  </button>
                  <button
                    className="vdj-btn"
                    onClick={() => {
                      const fn = stopFns.current.get(s.id);
                      if (fn) { fn(); stopFns.current.delete(s.id); }
                      stopSlot(s.id);
                      force((x) => x + 1);
                    }}
                    style={{ padding: "1px 4px", fontSize: 8, flex: 1 }}
                    title={t("samplerStopTip")}
                    aria-label={t("samplerStopTip")}
                  >
                    STOP
                  </button>
                  {PAD_PALETTE.map((c) => (
                    <button
                      key={c}
                      onClick={() => { setSlotColor(s.id, c); force((x) => x + 1); }}
                      title={t("samplerColorTip")}
                      style={{ width: 10, height: 10, padding: 0, borderRadius: 2, background: c, border: s.color === c ? "1px solid white" : "1px solid transparent" }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}