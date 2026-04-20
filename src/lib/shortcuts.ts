import { useApp, type DeckId } from "@/state/store";
import { addHotCue, cueDeck, jumpHotCue, syncDeck, togglePlay } from "@/state/controller";
import { isRecording, startRecording, stopRecording } from "@/audio/recorder";
import { ensureRunning } from "@/audio/engine";
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