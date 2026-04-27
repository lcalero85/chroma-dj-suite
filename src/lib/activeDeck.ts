import { useApp, type DeckId } from "@/state/store";

/**
 * Heuristic to determine the deck the user is currently "playing":
 *  1. The audible deck with the highest combined fader * gain among playing decks.
 *  2. If none playing, the first enabled deck.
 */
export function pickActiveDeck(state = useApp.getState()): DeckId {
  const candidates = state.activeDecks;
  let best: DeckId | null = null;
  let bestScore = -1;
  for (const id of candidates) {
    const d = state.decks[id];
    if (!d?.isPlaying) continue;
    const score = (d.fader ?? 0) * (d.gain ?? 1) + 0.001;
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best ?? candidates[0] ?? "A";
}

/** React hook — recomputes the active deck whenever decks/playing state change. */
export function useActiveDeck(): DeckId {
  return useApp((s) => pickActiveDeck(s));
}
