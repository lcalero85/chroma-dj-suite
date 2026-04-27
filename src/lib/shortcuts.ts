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
import { pause } from "@/audio/deck";
import { triggerSlot } from "@/audio/sampler";
import { setFxMix, type FxRackHandles } from "@/audio/fx";
import { listRecordings, putRecording, uid } from "./db";
import { resolveShortcuts } from "./shortcutDefs";
import { toast } from "sonner";

declare global {
  interface Window {
    __vdjFxRacks?: Record<number, FxRackHandles>;
  }
}

/** Build a reverse map: code -> Set<actionId>, so a single key can fire multiple
 *  branches (e.g. "KeyL" fires playB; "KeyL"+Shift fires radioNext). */
function buildCodeMap(): Record<string, string[]> {
  const cfg = resolveShortcuts(useApp.getState().settings.shortcuts);
  const out: Record<string, string[]> = {};
  for (const [actionId, code] of Object.entries(cfg)) {
    if (!code) continue;
    if (!out[code]) out[code] = [];
    out[code].push(actionId);
  }
  return out;
}

async function fireRecord() {
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
}

async function runAction(id: string, e: KeyboardEvent) {
  switch (id) {
    case "playA": e.preventDefault(); await togglePlay("A"); return true;
    case "playA2": e.preventDefault(); await togglePlay("A"); return true;
    case "playB": e.preventDefault(); await togglePlay("B"); return true;
    case "playB2":
      // Shift+L is radioNext; plain L is playB. Skip if Shift held (radioNext handles it).
      if (e.shiftKey) return false;
      e.preventDefault(); await togglePlay("B"); return true;
    case "cueA": cueDeck("A"); return true;
    case "cueB": cueDeck("B"); return true;
    case "syncA": syncDeck("A", "B"); return true;
    case "syncB": syncDeck("B", "A"); return true;
    case "brakeA": e.preventDefault(); brake("A", 1.4); return true;
    case "stopA":
      e.preventDefault();
      pause("A");
      useApp.getState().updateDeck("A", { isPlaying: false });
      toast("Deck A: STOP");
      return true;
    case "brakeAB": brake(e.shiftKey ? "B" : "A", 1.4); return true;
    case "reverseAB": {
      const id2: DeckId = e.shiftKey ? "B" : "A";
      const cur = useApp.getState().decks[id2].reverse;
      setReverse(id2, !cur);
      return true;
    }
    // ===== Decks C & D =====
    case "playC": e.preventDefault(); await togglePlay("C"); return true;
    case "playD": e.preventDefault(); await togglePlay("D"); return true;
    case "cueC": cueDeck("C"); return true;
    case "cueD": cueDeck("D"); return true;
    case "syncC": syncDeck("C", "A"); return true;
    case "syncD": syncDeck("D", "A"); return true;
    case "brakeC": brake("C", 1.4); return true;
    case "brakeD": brake("D", 1.4); return true;
    case "reverseC": {
      const cur = useApp.getState().decks.C.reverse;
      setReverse("C", !cur);
      return true;
    }
    case "reverseD": {
      const cur = useApp.getState().decks.D.reverse;
      setReverse("D", !cur);
      return true;
    }
    case "jumpCback": beatJump("C", -4); return true;
    case "jumpCfwd":  beatJump("C",  4); return true;
    case "jumpDback": beatJump("D", -4); return true;
    case "jumpDfwd":  beatJump("D",  4); return true;
    case "automix": {
      e.preventDefault();
      const x = useApp.getState().mixer.xfader;
      const target = x >= 0 ? -1 : 1;
      const ok = autoMixTo(target, 8);
      if (ok) toast(`Auto-mix → Deck ${target === -1 ? "A" : "B"} (8s)`);
      return true;
    }
    case "tap": {
      const bpm = tap();
      if (bpm) toast(`Tap: ${bpm.toFixed(1)} BPM`);
      return true;
    }
    case "record": e.preventDefault(); await fireRecord(); return true;
    case "micToggle": {
      const cur = useApp.getState().mixer.micOn;
      await setMicOn(!cur);
      return true;
    }
    case "radioNext":
      // requires Shift
      if (!e.shiftKey) return false;
      e.preventDefault(); void radioNext(); return true;
    case "numpadToggle": {
      const cur = useApp.getState().mixer.numpadDeck;
      setNumpadDeck(cur === "A" ? "B" : "A");
      return true;
    }
    case "jumpAback":  beatJump("A", -4); return true;
    case "jumpAfwd":   beatJump("A",  4); return true;
    case "jumpBback":  beatJump("B", -4); return true;
    case "jumpBfwd":   beatJump("B",  4); return true;
    case "npLoop4": {
      const numpadDeck = useApp.getState().mixer.numpadDeck;
      const otherDeck: DeckId = numpadDeck === "A" ? "B" : "A";
      const deck: DeckId = e.shiftKey ? otherDeck : numpadDeck;
      setLoop(deck, 4);
      toast(`Loop 4 beats deck ${deck}`);
      return true;
    }
    case "npLoopToggle": {
      const numpadDeck = useApp.getState().mixer.numpadDeck;
      const otherDeck: DeckId = numpadDeck === "A" ? "B" : "A";
      toggleLoop(e.shiftKey ? otherDeck : numpadDeck);
      return true;
    }
    case "npLoopClear": {
      const numpadDeck = useApp.getState().mixer.numpadDeck;
      const otherDeck: DeckId = numpadDeck === "A" ? "B" : "A";
      clearLoop(e.shiftKey ? otherDeck : numpadDeck);
      return true;
    }
    case "npSampler1": triggerSlot(0); return true;
    case "npSampler2": triggerSlot(1); return true;
    case "npFx1": {
      const fx = useApp.getState().fx[0];
      const next = fx.wet > 0.05 ? 0 : 0.5;
      useApp.getState().updateFx(1, { wet: next });
      const r = window.__vdjFxRacks?.[1];
      if (r) setFxMix(r, next);
      return true;
    }
    case "npFx2": {
      const fx = useApp.getState().fx[1];
      const next = fx.wet > 0.05 ? 0 : 0.5;
      useApp.getState().updateFx(2, { wet: next });
      const r = window.__vdjFxRacks?.[2];
      if (r) setFxMix(r, next);
      return true;
    }
    case "npRecord": e.preventDefault(); await fireRecord(); return true;
    // ===== Smart Fader / AutoMix Pro toggles (Shift required) =====
    case "smartFaderToggle": {
      if (!e.shiftKey) return false;
      e.preventDefault();
      const cur = useApp.getState().settings.smartFaderEnabled ?? false;
      useApp.getState().updateSettings({ smartFaderEnabled: !cur });
      toast(`Smart Fader: ${!cur ? "ON" : "OFF"}`);
      return true;
    }
    case "automixProToggle": {
      if (!e.shiftKey) return false;
      e.preventDefault();
      const cur = useApp.getState().settings.automixProEnabled ?? false;
      useApp.getState().updateSettings({ automixProEnabled: !cur });
      toast(`AutoMix Pro: ${!cur ? "ON" : "OFF"}`);
      return true;
    }
    // ===== Open panels (F-keys) =====
    case "panelLibrary":   e.preventDefault(); useApp.getState().setActiveBottomTab("library");   return true;
    case "panelRecorder":  e.preventDefault(); useApp.getState().setActiveBottomTab("recorder");  return true;
    case "panelFx":        e.preventDefault(); useApp.getState().setActiveBottomTab("fx");        return true;
    case "panelSampler":   e.preventDefault(); useApp.getState().setActiveBottomTab("sampler");   return true;
    case "panelStems":     e.preventDefault(); useApp.getState().setActiveBottomTab("stems");     return true;
    case "panelPresets":   e.preventDefault(); useApp.getState().setActiveBottomTab("presets");   return true;
    case "panelRadio":     e.preventDefault(); useApp.getState().setActiveBottomTab("radio");     return true;
    case "panelOnline":    e.preventDefault(); useApp.getState().setActiveBottomTab("online");    return true;
    case "panelSynth":     e.preventDefault(); useApp.getState().setActiveBottomTab("synth");     return true;
    case "panelLiveVocal": e.preventDefault(); useApp.getState().setActiveBottomTab("livevocal"); return true;
    case "panelBeatMaker": e.preventDefault(); useApp.getState().setActiveBottomTab("beatmaker"); return true;
    // showShortcuts is handled in TopBar (it owns the overlay state)
  }
  return false;
}

export function installShortcuts() {
  if ((window as unknown as { __vdjShortcutsInstalled?: boolean }).__vdjShortcutsInstalled) return;
  (window as unknown as { __vdjShortcutsInstalled?: boolean }).__vdjShortcutsInstalled = true;

  window.addEventListener("keydown", async (e) => {
    const target = e.target as HTMLElement;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
    // Suspend when capturing a new shortcut from the settings UI.
    if ((window as unknown as { __vdjShortcutCapturing?: boolean }).__vdjShortcutCapturing) return;

    const codeMap = buildCodeMap();
    const ids = codeMap[e.code];
    if (ids && ids.length) {
      for (const id of ids) {
        const handled = await runAction(id, e);
        if (handled) return;
      }
    }

    // Hot cues 1..8 (Digit keys). Default deck = the currently active deck (numpadDeck,
    // which auto-follows the deck in use when "auto active deck" is on).
    // Shift+Digit targets the OTHER deck so the user can still drive both decks from
    // the main keyboard without switching the numpad target.
    const m = e.code.match(/^Digit([1-8])$/);
    if (m) {
      const slot = parseInt(m[1]) - 1;
      const active = useApp.getState().mixer.numpadDeck;
      const other: DeckId = active === "A" ? "B" : "A";
      const deck: DeckId = e.shiftKey ? other : active;
      const cue = useApp.getState().decks[deck].hotCues.find((c) => c.id === slot);
      if (cue) jumpHotCue(deck, slot); else addHotCue(deck, slot);
      return;
    }
    // Numpad 1-8 hot cues on the selected numpadDeck (Shift => other deck)
    const np = e.code.match(/^Numpad([1-8])$/);
    if (np) {
      const slot = parseInt(np[1]) - 1;
      const numpadDeck = useApp.getState().mixer.numpadDeck;
      const otherDeck: DeckId = numpadDeck === "A" ? "B" : "A";
      const deck: DeckId = e.shiftKey ? otherDeck : numpadDeck;
      const cue = useApp.getState().decks[deck].hotCues.find((c) => c.id === slot);
      if (cue) jumpHotCue(deck, slot); else addHotCue(deck, slot);
      return;
    }
  });
}
