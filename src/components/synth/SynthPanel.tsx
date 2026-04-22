import { useEffect, useRef, useState } from "react";
import {
  SYNTH_PRESETS,
  SYNTH_DEMOS,
  setSynthPreset,
  setSynthFx,
  setSynthVolume,
  noteOn,
  noteOff,
  allNotesOff,
  playDemo,
  stopDemo,
  isDemoPlaying,
  setSynthLayers,
  getSynthLayers,
  type SynthPresetId,
  type SynthFx,
} from "@/audio/synth";
import { useT } from "@/lib/i18n";
import { useApp } from "@/state/store";

// 64 keys starting from C2 (MIDI 36) up to D#7 (MIDI 99).
const FIRST_MIDI = 36;
const NUM_KEYS = 64;

const QWERTY_MAP: Record<string, number> = {
  "z": 0, "x": 2, "c": 4, "v": 5, "b": 7, "n": 9, "m": 11,
  ",": 12, ".": 14, "/": 16,
  "s": 1, "d": 3, "g": 6, "h": 8, "j": 10,
  "l": 13, ";": 15,
  "q": 12, "w": 14, "e": 16, "r": 17, "t": 19, "y": 21, "u": 23,
  "i": 24, "o": 26, "p": 28,
  "2": 13, "3": 15, "5": 18, "6": 20, "7": 22,
  "9": 25, "0": 27,
};

function isBlackKey(midi: number): boolean {
  const n = ((midi % 12) + 12) % 12;
  return [1, 3, 6, 8, 10].includes(n);
}

function noteName(midi: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const n = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  return `${names[n]}${oct}`;
}

const DEFAULT_FX: SynthFx = {
  reverb: 0.2, delay: 0, filter: 0, chorus: 0,
  drive: 0, bitcrush: 0, phaser: 0, flanger: 0,
  tremolo: 0, eqLow: 0.5, eqHi: 0.5, width: 0.5,
};

export function SynthPanel() {
  const t = useT();
  const persistedLayers = useApp((s) => s.settings.synthLayers ?? []);
  const updateSettings = useApp((s) => s.updateSettings);
  const [preset, setPreset] = useState<SynthPresetId>("piano");
  const [fx, setFx] = useState<SynthFx>(DEFAULT_FX);
  const [volume, setVolumeState] = useState(0.8);
  const [octaveShift, setOctaveShift] = useState(0);
  const [qwertyOn, setQwertyOn] = useState(true);
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [activeDemo, setActiveDemo] = useState<string | null>(null);
  const [layers, setLayersState] = useState<SynthPresetId[]>(
    () => (persistedLayers.filter((id) => SYNTH_PRESETS.some((p) => p.id === id)) as SynthPresetId[]),
  );
  const heldKeys = useRef<Set<string>>(new Set());

  useEffect(() => { setSynthPreset(preset); }, [preset]);
  useEffect(() => { setSynthFx(fx); }, [fx]);
  useEffect(() => { setSynthVolume(volume); }, [volume]);
  useEffect(() => {
    setSynthLayers(layers);
    updateSettings({ synthLayers: layers });
  }, [layers, updateSettings]);
  // On mount, sync engine to persisted layers.
  useEffect(() => { setSynthLayers(getSynthLayers().length ? getSynthLayers() : layers); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const toggleLayer = (id: SynthPresetId) => {
    setLayersState((prev) => {
      const idx = prev.indexOf(id);
      if (idx >= 0) { const n = [...prev]; n.splice(idx, 1); return n; }
      return [...prev, id];
    });
  };

  // Poll demo state so the UI stays in sync if external code stops it.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!isDemoPlaying() && activeDemo) setActiveDemo(null);
    }, 250);
    return () => window.clearInterval(id);
  }, [activeDemo]);

  // QWERTY → notes
  useEffect(() => {
    if (!qwertyOn) return;
    const isTypingTarget = (el: EventTarget | null) => {
      const t = el as HTMLElement | null;
      if (!t) return false;
      const tag = t.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || (t as HTMLElement).isContentEditable;
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === "-" || k === "_") { setOctaveShift((v) => Math.max(-2, v - 1)); return; }
      if (k === "=" || k === "+") { setOctaveShift((v) => Math.min(2, v + 1)); return; }
      const off = QWERTY_MAP[k];
      if (off === undefined) return;
      e.preventDefault();
      if (heldKeys.current.has(k)) return;
      heldKeys.current.add(k);
      const midi = FIRST_MIDI + 24 + (octaveShift * 12) + off;
      void noteOn(midi);
      setActiveNotes((prev) => { const n = new Set(prev); n.add(midi); return n; });
    };
    const onUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const off = QWERTY_MAP[k];
      if (off === undefined) return;
      heldKeys.current.delete(k);
      const midi = FIRST_MIDI + 24 + (octaveShift * 12) + off;
      noteOff(midi);
      setActiveNotes((prev) => { const n = new Set(prev); n.delete(midi); return n; });
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [qwertyOn, octaveShift]);

  // MIDI input — listen to all connected MIDI ports for note on/off
  useEffect(() => {
    let access: MIDIAccess | null = null;
    let cleanups: Array<() => void> = [];
    const setup = async () => {
      try {
        if (!navigator.requestMIDIAccess) return;
        access = await navigator.requestMIDIAccess({ sysex: false });
        const wire = (input: MIDIInput) => {
          const handler = (ev: MIDIMessageEvent) => {
            const data = ev.data;
            if (!data || data.length < 2) return;
            const status = data[0] & 0xf0;
            const note = data[1];
            const vel = data[2] ?? 0;
            if (status === 0x90 && vel > 0) {
              void noteOn(note, vel / 127);
              setActiveNotes((prev) => { const n = new Set(prev); n.add(note); return n; });
            } else if (status === 0x80 || (status === 0x90 && vel === 0)) {
              noteOff(note);
              setActiveNotes((prev) => { const n = new Set(prev); n.delete(note); return n; });
            }
          };
          input.addEventListener("midimessage", handler);
          cleanups.push(() => input.removeEventListener("midimessage", handler));
        };
        access.inputs.forEach(wire);
        const onState = (ev: MIDIConnectionEvent) => {
          if (ev.port?.type === "input" && ev.port.state === "connected") {
            wire(ev.port as MIDIInput);
          }
        };
        access.addEventListener("statechange", onState);
        cleanups.push(() => access?.removeEventListener("statechange", onState));
      } catch { /* MIDI unavailable */ }
    };
    void setup();
    return () => { cleanups.forEach((fn) => fn()); cleanups = []; };
  }, []);

  useEffect(() => { return () => { stopDemo(); allNotesOff(); }; }, []);

  const handlePointerDown = (midi: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    void noteOn(midi);
    setActiveNotes((prev) => { const n = new Set(prev); n.add(midi); return n; });
  };
  const handlePointerUp = (midi: number) => () => {
    noteOff(midi);
    setActiveNotes((prev) => { const n = new Set(prev); n.delete(midi); return n; });
  };

  const onDemoClick = (id: string) => {
    if (activeDemo === id) {
      stopDemo();
      setActiveDemo(null);
    } else {
      // Sync UI preset with the demo's preset so it shows what's playing
      const demo = SYNTH_DEMOS.find((d) => d.id === id);
      if (demo) setPreset(demo.preset);
      void playDemo(id);
      setActiveDemo(id);
    }
  };

  const keys = Array.from({ length: NUM_KEYS }, (_, i) => FIRST_MIDI + i);
  const whiteKeys = keys.filter((m) => !isBlackKey(m));
  const blackKeys = keys.filter((m) => isBlackKey(m));

  return (
    <div className="vdj-scroll" style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", overflowY: "auto", padding: 4 }}>
      {/* Top controls */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="vdj-label">{t("synthPresetLabel")}</span>
          <select
            className="vdj-btn"
            value={preset}
            onChange={(e) => setPreset(e.target.value as SynthPresetId)}
            style={{ padding: "6px 8px", minWidth: 160 }}
          >
            {SYNTH_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="vdj-label">{t("synthOctave")}</span>
          <button className="vdj-btn" onClick={() => setOctaveShift((v) => Math.max(-2, v - 1))}>−</button>
          <span style={{ minWidth: 24, textAlign: "center", fontWeight: 700 }}>{octaveShift > 0 ? `+${octaveShift}` : octaveShift}</span>
          <button className="vdj-btn" onClick={() => setOctaveShift((v) => Math.min(2, v + 1))}>+</button>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }} title={t("synthQwertyTip")}>
          <input type="checkbox" checked={qwertyOn} onChange={(e) => setQwertyOn(e.target.checked)} />
          QWERTY
        </label>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="vdj-label">{t("synthVolume")}</span>
          <input type="range" min={0} max={1.5} step={0.01} value={volume} onChange={(e) => setVolumeState(Number(e.target.value))} />
        </div>

        <div style={{ flex: 1 }} />

        <button
          className="vdj-btn"
          onClick={() => { setFx(DEFAULT_FX); }}
          title={t("synthFxReset")}
        >
          {t("synthFxReset")}
        </button>

        <button
          className="vdj-btn"
          data-tone="danger"
          onClick={() => { stopDemo(); setActiveDemo(null); allNotesOff(); setActiveNotes(new Set()); }}
          title={t("synthPanic")}
        >
          {t("synthPanic")}
        </button>
      </div>

      {/* Demos */}
      <div>
        <div className="vdj-label" style={{ marginBottom: 6 }}>{t("synthDemos")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
          {SYNTH_DEMOS.map((d) => (
            <button
              key={d.id}
              className="vdj-btn"
              data-active={activeDemo === d.id}
              onClick={() => onDemoClick(d.id)}
              style={{ padding: "8px 6px", textAlign: "left", display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-start" }}
              title={`${d.label} · ${d.bpm} BPM`}
            >
              <span style={{ fontSize: 11, fontWeight: 700 }}>
                {activeDemo === d.id ? "■ " : "▶ "}{d.label}
              </span>
              <span style={{ fontSize: 9, opacity: 0.7 }}>{d.bpm} BPM</span>
            </button>
          ))}
        </div>
      </div>

      {/* FX knobs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
        <FxKnob label={t("synthFxReverb")}   value={fx.reverb}   onChange={(v) => setFx((f) => ({ ...f, reverb: v }))} />
        <FxKnob label={t("synthFxDelay")}    value={fx.delay}    onChange={(v) => setFx((f) => ({ ...f, delay: v }))} />
        <FxKnob label={t("synthFxFilter")}   value={fx.filter}   onChange={(v) => setFx((f) => ({ ...f, filter: v }))} />
        <FxKnob label={t("synthFxChorus")}   value={fx.chorus}   onChange={(v) => setFx((f) => ({ ...f, chorus: v }))} />
        <FxKnob label={t("synthFxDrive")}    value={fx.drive}    onChange={(v) => setFx((f) => ({ ...f, drive: v }))} />
        <FxKnob label={t("synthFxBitcrush")} value={fx.bitcrush} onChange={(v) => setFx((f) => ({ ...f, bitcrush: v }))} />
        <FxKnob label={t("synthFxPhaser")}   value={fx.phaser}   onChange={(v) => setFx((f) => ({ ...f, phaser: v }))} />
        <FxKnob label={t("synthFxFlanger")}  value={fx.flanger}  onChange={(v) => setFx((f) => ({ ...f, flanger: v }))} />
        <FxKnob label={t("synthFxTremolo")}  value={fx.tremolo}  onChange={(v) => setFx((f) => ({ ...f, tremolo: v }))} />
        <FxKnob label={t("synthFxEqLow")}    value={fx.eqLow}    onChange={(v) => setFx((f) => ({ ...f, eqLow: v }))} bipolar />
        <FxKnob label={t("synthFxEqHi")}     value={fx.eqHi}     onChange={(v) => setFx((f) => ({ ...f, eqHi: v }))} bipolar />
        <FxKnob label={t("synthFxWidth")}    value={fx.width}    onChange={(v) => setFx((f) => ({ ...f, width: v }))} />
      </div>

      <div style={{ fontSize: 11, color: "var(--text-3)", textAlign: "center" }}>{t("synthHelp")}</div>

      {/* Keyboard */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: 180,
          background: "var(--panel-2, #0c0c0c)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          overflow: "hidden",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", height: "100%" }}>
          {whiteKeys.map((midi) => {
            const active = activeNotes.has(midi);
            const isC = midi % 12 === 0;
            return (
              <div
                key={midi}
                onPointerDown={handlePointerDown(midi)}
                onPointerUp={handlePointerUp(midi)}
                onPointerLeave={handlePointerUp(midi)}
                onPointerCancel={handlePointerUp(midi)}
                style={{
                  flex: 1,
                  borderRight: "1px solid #222",
                  background: active
                    ? "linear-gradient(180deg, var(--accent), color-mix(in oklab, var(--accent) 50%, #fff))"
                    : "linear-gradient(180deg, #f4f4f4, #d8d8d8)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  paddingBottom: 6,
                  fontSize: 9,
                  color: active ? "#fff" : "#444",
                  fontWeight: isC ? 700 : 400,
                  transition: "background 50ms",
                }}
                title={noteName(midi)}
              >
                {isC ? noteName(midi) : ""}
              </div>
            );
          })}
        </div>

        {blackKeys.map((midi) => {
          const active = activeNotes.has(midi);
          const whiteBefore = whiteKeys.filter((w) => w < midi).length;
          const widthPct = 100 / whiteKeys.length;
          const left = whiteBefore * widthPct - widthPct * 0.3;
          return (
            <div
              key={midi}
              onPointerDown={handlePointerDown(midi)}
              onPointerUp={handlePointerUp(midi)}
              onPointerLeave={handlePointerUp(midi)}
              onPointerCancel={handlePointerUp(midi)}
              style={{
                position: "absolute",
                top: 0,
                left: `${left}%`,
                width: `${widthPct * 0.6}%`,
                height: "62%",
                background: active
                  ? "linear-gradient(180deg, var(--accent), color-mix(in oklab, var(--accent) 60%, #000))"
                  : "linear-gradient(180deg, #1a1a1a, #050505)",
                border: "1px solid #000",
                borderRadius: "0 0 3px 3px",
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0,0,0,0.5)",
                zIndex: 2,
                transition: "background 50ms",
              }}
              title={noteName(midi)}
            />
          );
        })}
      </div>
    </div>
  );
}

function FxKnob({ label, value, onChange, bipolar }: { label: string; value: number; onChange: (v: number) => void; bipolar?: boolean }) {
  const display = bipolar ? `${Math.round((value - 0.5) * 200)}` : `${Math.round(value * 100)}%`;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: 6, background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 6 }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: "var(--text-2)" }}>{label.toUpperCase()}</div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%" }}
      />
      <div style={{ fontSize: 9, color: "var(--text-3)" }}>{display}</div>
    </div>
  );
}
