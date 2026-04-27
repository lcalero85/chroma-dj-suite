import { createFileRoute } from "@tanstack/react-router";
import { callAi } from "@/lib/aiGateway";

/**
 * Auto-tag AI — given a list of {id, title, artist, bpm} returns a set of
 * tags (genre + mood + energy bucket) per track. Conservative: only tags it
 * is reasonably confident about. Used by the Library "Enhance with AI" button.
 */
export const Route = createFileRoute("/api/ai/autotag")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let payload: any;
        try { payload = await request.json(); } catch {
          return Response.json({ error: "bad_request" }, { status: 400 });
        }
        const tracks = Array.isArray(payload?.tracks) ? payload.tracks.slice(0, 50) : [];
        if (tracks.length === 0) return Response.json({ tags: {} });
        const compact = tracks.map((t: any) => ({
          id: String(t.id),
          title: String(t.title ?? "").slice(0, 80),
          artist: String(t.artist ?? "").slice(0, 60),
          bpm: typeof t.bpm === "number" ? Math.round(t.bpm) : null,
        }));
        const tools = [
          {
            type: "function" as const,
            function: {
              name: "return_tags",
              description: "Return tags per track id. Each track maps to an array of 1-4 short lowercase tags (genre, sub-genre, mood, energy).",
              parameters: {
                type: "object",
                properties: {
                  tags: {
                    type: "object",
                    description: "Map of trackId → array of tags.",
                    additionalProperties: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                },
                required: ["tags"],
                additionalProperties: false,
              },
            },
          },
        ];
        const sys =
          `You classify DJ tracks. For each track return 1-4 short lowercase tags from this vocabulary: ` +
          `genres (house, techno, edm, trance, hiphop, reggaeton, pop, rock, latin, drumandbass, dubstep, lofi, ambient), ` +
          `moods (chill, peak, dark, uplifting, romantic, party), ` +
          `energy (low, mid, high). Skip tracks you are unsure about (omit their id from the result).`;
        const result = await callAi({
          messages: [
            { role: "system", content: sys },
            { role: "user", content: JSON.stringify(compact) },
          ],
          tools,
          tool_choice: { type: "function", function: { name: "return_tags" } },
          temperature: 0.2,
        });
        if (!result.ok) return result.response;
        try {
          const tc = result.data?.choices?.[0]?.message?.tool_calls?.[0];
          const args = tc?.function?.arguments ? JSON.parse(tc.function.arguments) : null;
          const tags = (args?.tags && typeof args.tags === "object") ? args.tags : {};
          // Sanitize: keep only known string arrays.
          const clean: Record<string, string[]> = {};
          for (const [id, arr] of Object.entries(tags)) {
            if (!Array.isArray(arr)) continue;
            const list = arr.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length < 24).slice(0, 4);
            if (list.length > 0) clean[id] = list;
          }
          return Response.json({ tags: clean });
        } catch (e) {
          console.error("[ai/autotag] parse error", e);
          return Response.json({ tags: {} });
        }
      },
    },
  },
});