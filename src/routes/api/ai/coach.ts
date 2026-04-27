import { createFileRoute } from "@tanstack/react-router";
import { callAi } from "@/lib/aiGateway";

/**
 * DJ Coach — receives a Mix Report summary and returns natural-language
 * feedback (3-5 short paragraphs) about the set quality, transitions, energy
 * arc and suggestions for next time. Used after the VDJ session ends.
 */
export const Route = createFileRoute("/api/ai/coach")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let payload: any;
        try { payload = await request.json(); } catch {
          return Response.json({ error: "bad_request" }, { status: 400 });
        }
        const lang: string = payload?.lang ?? "es";
        const summary = {
          djName: String(payload?.djName ?? ""),
          totalMin: Math.round(Number(payload?.totalSec ?? 0) / 60),
          tracks: Array.isArray(payload?.entries) ? payload.entries.slice(0, 60) : [],
          fxUsed: payload?.fxUsed ?? {},
          energyCurve: Array.isArray(payload?.energyCurve) ? payload.energyCurve.slice(0, 64) : [],
        };
        const sys = `You are a senior DJ coach. Reply in ${lang === "es" ? "Spanish" : lang}. ` +
          `Give concise, professional feedback (3 short paragraphs max) about: energy arc, ` +
          `transition quality, FX usage, and one concrete suggestion for the next set. ` +
          `Plain text, no markdown headings.`;
        const result = await callAi({
          messages: [
            { role: "system", content: sys },
            { role: "user", content: JSON.stringify(summary) },
          ],
          temperature: 0.7,
          max_tokens: 700,
        });
        if (!result.ok) return result.response;
        const text: string = result.data?.choices?.[0]?.message?.content ?? "";
        return Response.json({ feedback: text.trim() });
      },
    },
  },
});