import { useApp, type DeckId } from "@/state/store";
import {
  addHotCue,
  cueDeck,
  jumpHotCue,
  syncDeck,
  togglePlay,
  setLoop,
  clearLoop,
  toggleLoop,
  setMicOn,
  setNumpadDeck,
  radioNext,
} from "@/state/controller";
import { isRecording, startRecording, stopRecording } from "@/audio/recorder";
import { ensureRunning } from "@/audio/engine";
import { beatJump, brake, setReverse, autoMixTo, tap } from "@/audio/transport";
import { triggerSlot } from "@/audio/sampler";
import { setFxMix, type FxRackHandles } from "@/audio/fx";
import { listRecordings, putRecording, uid } from "./db";
import { toast } from "sonner";

// FX racks reference (populated by FxPanel mount via window). Keep simple bridge.
declare global {
  interface Window {
    __vdjFxRacks?: Record<number, FxRackHandles>;
  }
}

export function installShortcuts() {
  window.addEventListener("keydown", async (e) => {
    const target = e.target as HTMLElement;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;

    if (e.code === "Space") { e.preventDefault(); await togglePlay("A"); return; }
    if (e.code === "ShiftRight") { e.preventDefault(); await togglePlay("B"); return; }
    if (e.code === "KeyQ") { cueDeck("A"); return; }
    if (e.code === "KeyW") { cueDeck("B"); return; }
    if (e.code === "KeyA") { syncDeck("A", "B"); return; }
    if (e.code === "KeyS") { syncDeck("B", "A"); return; }
    if (e.code === "KeyR") {
      await ensureRunning();
      if (isRecording()) {
        const r = await stopRecording();
        if (r) {
          await putRecording({ id: uid(), name: `Set ${new Date().toLocaleString()}`, blob: r.blob, mime: r.mime, duration: r.duration, createdAt: Date.now() });
          useApp.getState().setRecordings(await listRecordings());
          toast("Grabación detenida");
        }
      } else {
        await startRecording();
        toast("Grabando…");
      }
      return;
    }
    // Voice-over toggle (Shift+M reserved? use KeyN for "narrate")
    if (e.code === "KeyN") {
      const cur = useApp.getState().mixer.micOn;
      await setMicOn(!cur);
      return;
    }
    // Backquote: toggle numpad target deck (A <-> B)
    if (e.code === "Backquote") {
      const cur = useApp.getState().mixer.numpadDeck;
      setNumpadDeck(cur === "A" ? "B" : "A");
      return;
    }
    // KeyL: radio next
    if (e.code === "KeyL" && !e.shiftKey) {
      void radioNext();
      return;
    }
    // Beat jump: [/] for deck A, ;/' for deck B
    if (e.code === "BracketLeft") { beatJump("A", -4); return; }
    if (e.code === "BracketRight") { beatJump("A", 4); return; }
    if (e.code === "Semicolon") { beatJump("B", -4); return; }
    if (e.code === "Quote") { beatJump("B", 4); return; }
    // Brake / Reverse
    if (e.code === "KeyB") { brake(e.shiftKey ? "B" : "A", 1.4); return; }
    if (e.code === "KeyV") {
      const id: DeckId = e.shiftKey ? "B" : "A";
      const cur = useApp.getState().decks[id].reverse;
      setReverse(id, !cur); return;
    }
    // Auto-mix
    if (e.code === "KeyM") {
      const x = useApp.getState().mixer.xfader;
      autoMixTo(x >= 0 ? -1 : 1, 8);
      toast("Auto-mix iniciado");
      return;
    }
    // Tap tempo
    if (e.code === "KeyT") {
      const bpm = tap();
      if (bpm) toast(`Tap: ${bpm.toFixed(1)} BPM`);
      return;
    }

    // ===== NUMPAD =====
    // Numpad 1-8: hot cues on the selected numpadDeck (Shift overrides to the OTHER deck)
    const numpadDeck = useApp.getState().mixer.numpadDeck;
    const otherDeck: DeckId = numpadDeck === "A" ? "B" : "A";
    const np = e.code.match(/^Numpad([1-8])$/);
    if (np) {
      const slot = parseInt(np[1]) - 1;
      const deck: DeckId = e.shiftKey ? otherDeck : numpadDeck;
      const cue = useApp.getState().decks[deck].hotCues.find((c) => c.id === slot);
      if (cue) jumpHotCue(deck, slot); else addHotCue(deck, slot);
      return;
    }
    // Numpad 0: toggle loop on/off (Shift => other deck)
    if (e.code === "Numpad0") {
      toggleLoop(e.shiftKey ? otherDeck : numpadDeck);
      return;
    }
    // Numpad 9: 4-beat loop (Shift => other deck)
    if (e.code === "Numpad9") {
      const deck: DeckId = e.shiftKey ? otherDeck : numpadDeck;
      setLoop(deck, 4);
      toast(`Loop 4 beats deck ${deck}`);
      return;
    }
    // NumpadDecimal: clear loop
    if (e.code === "NumpadDecimal") {
      clearLoop(e.shiftKey ? otherDeck : numpadDeck);
      return;
    }
    // NumpadAdd / NumpadSubtract: trigger sampler pads 0 / 1
    if (e.code === "NumpadAdd") { triggerSlot(0); return; }
    if (e.code === "NumpadSubtract") { triggerSlot(1); return; }
    // NumpadMultiply / NumpadDivide: toggle FX 1 and FX 2 quickly
    if (e.code === "NumpadMultiply") {
      const fx = useApp.getState().fx[0];
      const next = fx.wet > 0.05 ? 0 : 0.5;
      useApp.getState().updateFx(1, { wet: next });
      const r = window.__vdjFxRacks?.[1];
      if (r) setFxMix(r, next);
      return;
    }
    if (e.code === "NumpadDivide") {
      const fx = useApp.getState().fx[1];
      const next = fx.wet > 0.05 ? 0 : 0.5;
      useApp.getState().updateFx(2, { wet: next });
      const r = window.__vdjFxRacks?.[2];
      if (r) setFxMix(r, next);
      return;
    }
    // NumpadEnter: rec start/stop
    if (e.code === "NumpadEnter") {
      await ensureRunning();
      if (isRecording()) {
        const r = await stopRecording();
        if (r) {
          await putRecording({ id: uid(), name: `Set ${new Date().toLocaleString()}`, blob: r.blob, mime: r.mime, duration: r.duration, createdAt: Date.now() });
          useApp.getState().setRecordings(await listRecordings());
          toast("Grabación detenida");
        }
      } else {
        await startRecording();
        toast("Grabando…");
      }
      return;
    }

    // Hot cues 1..8 with optional Shift for deck B
    const m = e.code.match(/^Digit([1-8])$/);
    if (m) {
      const slot = parseInt(m[1]) - 1;
      const deck: DeckId = e.shiftKey ? "B" : "A";
      const cue = useApp.getState().decks[deck].hotCues.find((c) => c.id === slot);
      if (cue) jumpHotCue(deck, slot); else addHotCue(deck, slot);
    }
  });
}