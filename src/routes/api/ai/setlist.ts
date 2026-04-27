import { createFileRoute } from "@tanstack/react-router";
import { callAi } from "@/lib/aiGateway";

/**
 * Smart Setlist AI — receives a list of tracks (id, title, artist, bpm, key,
 * tags) and returns the same ids reordered into a professional warmup → peak
 * → cooldown arc with harmonically compatible jumps. Falls back to the
 * original order on any error so the VDJ never breaks.
 */
export const Route = createFileRoute("/api/ai/setlist")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return Response.json({ error: "bad_request" }, { status: 400 });
        }
        const tracks = Array.isArray(payload?.tracks) ? payload.tracks : [];
        const shape: string = payload?.shape ?? "arc";
        const genre: string = payload?.genre ?? "auto";
        if (tracks.length < 3 || tracks.length > 200) {
          return Response.json({ orderedIds: tracks.map((t: any) => t.id) });
        }
        const compact = tracks.map((t: any) => ({
          id: String(t.id),
          title: String(t.title ?? "").slice(0, 80),
          artist: String(t.artist ?? "").slice(0, 60),
          bpm: typeof t.bpm === "number" ? Math.round(t.bpm) : null,
          key: t.key ?? null,
          tags: Array.isArray(t.tags) ? t.tags.slice(0, 5) : [],
        }));

        const tools = [
          {
            type: "function" as const,
            function: {
              name: "return_setlist",
              description: "Return the ordered track IDs for the DJ set.",
              parameters: {
                type: "object",
                properties: {
                  orderedIds: {
                    type: "array",
                    description: "Track IDs in playback order. Must be a permutation of the input ids.",
                    items: { type: "string" },
                  },
                  reasoning: {
                    type: "string",
                    description: "One short sentence explaining the energy arc choice.",
                  },
                },
                required: ["orderedIds"],
                additionalProperties: false,
              },
            },
          },
        ];

        const sys =
          `You are a professional DJ tour manager. Order the given tracks into a ${shape} energy arc` +
          (genre !== "auto" ? ` for a ${genre} set` : "") +
          `. Prefer harmonic compatibility (Camelot ±1 or relative), smooth BPM jumps (≤ ±6%), ` +
          `and never repeat a track. Return EVERY input id exactly once via the return_setlist tool.`;

        const result = await callAi({
          messages: [
            { role: "system", content: sys },
            { role: "user", content: JSON.stringify(compact) },
          ],
          tools,
          tool_choice: { type: "function", function: { name: "return_setlist" } },
          temperature: 0.4,
        });

        if (!result.ok) return result.response;
        try {
          const tc = result.data?.choices?.[0]?.message?.tool_calls?.[0];
          const args = tc?.function?.arguments ? JSON.parse(tc.function.arguments) : null;
          const ordered: string[] = Array.isArray(args?.orderedIds) ? args.orderedIds : [];
          // Validate: must be a permutation. If not, repair.
          const inputIds = new Set(compact.map((t) => t.id));
          const seen = new Set<string>();
          const valid: string[] = [];
          for (const id of ordered) {
            if (typeof id === "string" && inputIds.has(id) && !seen.has(id)) {
              seen.add(id);
              valid.push(id);
            }
          }
          // Append any missing ids in original order to keep the queue intact.
          for (const t of compact) if (!seen.has(t.id)) valid.push(t.id);
          return Response.json({ orderedIds: valid, reasoning: args?.reasoning ?? null });
        } catch (e) {
          console.error("[ai/setlist] parse error", e);
          return Response.json({ orderedIds: compact.map((t) => t.id) });
        }
      },
    },
  },
});