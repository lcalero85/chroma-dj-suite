/**
 * Smart Fader — autonomously rides the crossfader as the master deck approaches
 * its smart-exit point and triggers a `smartCrossfade()` once.
 *
 * It polls the app store at 2 Hz (cheap), so it's safe to leave running.
 * Disable by setting `smartFaderEnabled = false` in settings.
 *
 * Internal flow:
 *  1. Read master deck + its smart-exit (normalized 0..1).
 *  2. If the head is within `triggerWindowSec` of the exit AND the AutoMix Pro
 *     engine is idle AND a target deck has a track loaded, fire smartCrossfade.
 *  3. Use a debounce so we never fire twice for the same approach.
 */
import { useApp } from "@/state/store";
import { getAutoMixStatus, smartCrossfade, smartExitPoint } from "./automix";

let pollId: ReturnType<typeof setInterval> | null = null;
let lastFiredFor: { deck: string; trackId: string } | null = null;

const TRIGGER_WINDOW_SEC = 12; // start the mix this many seconds before the exit

export function startSmartFader() {
  if (pollId) return;
  pollId = setInterval(tick, 500);
}

export function stopSmartFader() {
  if (pollId) clearInterval(pollId);
  pollId = null;
  lastFiredFor = null;
}

export function isSmartFaderRunning(): boolean {
  return pollId !== null;
}

function tick() {
  const state = useApp.getState();
  if (!state.settings.smartFaderEnabled) {
    stopSmartFader();
    return;
  }
  const masterId = state.mixer.masterDeck;
  if (masterId !== "A" && masterId !== "B") return;
  const ds = state.decks[masterId];
  if (!ds.isPlaying || !ds.trackId || !ds.duration) return;

  const exit = smartExitPoint(masterId);
  const headSec = ds.position * ds.duration;
  const exitSec = exit * ds.duration;
  const remaining = exitSec - headSec;
  if (remaining <= 0 || remaining > TRIGGER_WINDOW_SEC) return;

  // Don't pile up — only fire once per (deck, trackId) approach.
  const key = { deck: masterId, trackId: ds.trackId };
  if (lastFiredFor && lastFiredFor.deck === key.deck && lastFiredFor.trackId === key.trackId) return;

  // Don't interrupt a running mix.
  const st = getAutoMixStatus();
  if (st.isRunning || st.pendingSwap) return;

  lastFiredFor = key;
  void smartCrossfade();
}

/** Reset the per-track debounce (e.g. when user manually loads a new track). */
export function resetSmartFader() {
  lastFiredFor = null;
}