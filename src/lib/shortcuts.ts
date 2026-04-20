import { useApp, type DeckId } from "@/state/store";
import { addHotCue, cueDeck, jumpHotCue, syncDeck, togglePlay } from "@/state/controller";
import { isRecording, startRecording, stopRecording } from "@/audio/recorder";
import { ensureRunning } from "@/audio/engine";
import { beatJump, brake, setReverse, autoMixTo, tap } from "@/audio/transport";
import { listRecordings, putRecording, uid } from "./db";
import { toast } from "sonner";

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
        startRecording();
        toast("Grabando…");
      }
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