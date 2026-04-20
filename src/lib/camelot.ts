export const CAMELOT_KEYS = [
  "1A", "1B", "2A", "2B", "3A", "3B", "4A", "4B",
  "5A", "5B", "6A", "6B", "7A", "7B", "8A", "8B",
  "9A", "9B", "10A", "10B", "11A", "11B", "12A", "12B",
] as const;

export type CamelotKey = (typeof CAMELOT_KEYS)[number];

const KEY_NAMES: Record<CamelotKey, string> = {
  "1A": "Ab Min", "1B": "B Maj",
  "2A": "Eb Min", "2B": "F# Maj",
  "3A": "Bb Min", "3B": "Db Maj",
  "4A": "F Min",  "4B": "Ab Maj",
  "5A": "C Min",  "5B": "Eb Maj",
  "6A": "G Min",  "6B": "Bb Maj",
  "7A": "D Min",  "7B": "F Maj",
  "8A": "A Min",  "8B": "C Maj",
  "9A": "E Min",  "9B": "G Maj",
  "10A": "B Min", "10B": "D Maj",
  "11A": "F# Min","11B": "A Maj",
  "12A": "Db Min","12B": "E Maj",
};

export function keyName(c: CamelotKey) {
  return KEY_NAMES[c];
}

export function isCompatible(a: CamelotKey, b: CamelotKey): boolean {
  if (a === b) return true;
  const numA = parseInt(a);
  const numB = parseInt(b);
  const letA = a.slice(-1);
  const letB = b.slice(-1);
  if (numA === numB && letA !== letB) return true; // same number, different letter (relative)
  if (letA === letB && (Math.abs(numA - numB) === 1 || Math.abs(numA - numB) === 11)) return true;
  return false;
}

// Heuristic "fake" auto-detect: deterministic from string hash so each track always
// gets the same key; user can edit it in the Camelot wheel.
export function pseudoDetectKey(seed: string): CamelotKey {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % CAMELOT_KEYS.length;
  return CAMELOT_KEYS[idx];
}