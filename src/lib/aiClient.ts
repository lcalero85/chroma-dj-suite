/**
 * Front-end client for the `/api/ai/*` server routes. All calls are best-effort
 * — they return `null` (or a typed fallback) on any error so the surrounding
 * UX never breaks. Network errors, 429 (rate limit), and 402 (out of credits)
 * are surfaced via `toast` only when the caller explicitly requests it.
 */
import { toast } from "sonner";

async function safeFetch(url: string, body: unknown, opts?: { silent?: boolean }): Promise<any | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 429) {
      if (!opts?.silent) toast.error("IA: demasiadas solicitudes. Intenta de nuevo en unos segundos.");
      return null;
    }
    if (res.status === 402) {
      if (!opts?.silent) toast.error("IA: créditos agotados. Agrega créditos en Settings → Workspace → Usage.");
      return null;
    }
    if (!res.ok) {
      if (!opts?.silent) toast.error("IA no disponible en este momento.");
      return null;
    }
    return await res.json();
  } catch (e) {
    console.warn("[aiClient] error", e);
    return null;
  }
}

export interface SetlistTrack {
  id: string;
  title: string;
  artist: string;
  bpm: number | null;
  key: string | null;
  tags: string[];
}

export async function aiBuildSetlist(
  tracks: SetlistTrack[],
  shape: "arc" | "ascending" | "descending" | "wave" = "arc",
  genre = "auto",
): Promise<{ orderedIds: string[]; reasoning: string | null } | null> {
  if (tracks.length < 3) return null;
  const data = await safeFetch("/api/ai/setlist", { tracks, shape, genre }, { silent: true });
  if (!data || !Array.isArray(data.orderedIds)) return null;
  return { orderedIds: data.orderedIds as string[], reasoning: data.reasoning ?? null };
}

export interface CoachInput {
  djName: string;
  totalSec: number;
  entries: Array<{ title: string; artist: string; bpm: number | null; key: string | null; transitionInto?: string }>;
  fxUsed: Record<string, number>;
  energyCurve: number[];
  lang?: string;
}

export async function aiDjCoach(input: CoachInput): Promise<string | null> {
  const data = await safeFetch("/api/ai/coach", input, { silent: true });
  if (!data || typeof data.feedback !== "string") return null;
  return data.feedback;
}

export interface AutoTagTrack { id: string; title: string; artist: string; bpm: number | null }

export async function aiAutoTag(tracks: AutoTagTrack[]): Promise<Record<string, string[]> | null> {
  if (tracks.length === 0) return null;
  const data = await safeFetch("/api/ai/autotag", { tracks });
  if (!data || typeof data.tags !== "object" || !data.tags) return null;
  return data.tags as Record<string, string[]>;
}