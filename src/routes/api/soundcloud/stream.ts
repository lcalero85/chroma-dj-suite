import { createFileRoute } from "@tanstack/react-router";
import { getSoundCloudClientId, invalidateSoundCloudClientId } from "@/lib/scClientId";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function resolveStream(t: string, clientId: string) {
  const resolveUrl = `${t}${t.includes("?") ? "&" : "?"}client_id=${clientId}`;
  return fetch(resolveUrl, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
}

// Resolves a SoundCloud "transcoding" URL into the actual MP3 URL and proxies
// the audio bytes back to the browser, avoiding CORS issues.

export const Route = createFileRoute("/api/soundcloud/stream")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const t = url.searchParams.get("t"); // transcoding url (already encoded)
        if (!t) return Response.json({ error: "missing t" }, { status: 400 });
        try {
          let clientId = await getSoundCloudClientId();
          let r1 = await resolveStream(t, clientId);
          if (r1.status === 401 || r1.status === 403) {
            invalidateSoundCloudClientId();
            clientId = await getSoundCloudClientId(true);
            r1 = await resolveStream(t, clientId);
          }
          if (!r1.ok) {
            const body = await r1.text();
            return Response.json(
              { error: "resolve_failed", status: r1.status, body: body.slice(0, 200) },
              { status: 502 },
            );
          }
          const j = (await r1.json()) as { url?: string };
          if (!j.url) return Response.json({ error: "no_stream_url" }, { status: 502 });

          const r2 = await fetch(j.url, {
            headers: { "User-Agent": UA },
          });
          if (!r2.ok || !r2.body) {
            return Response.json({ error: "stream_fetch_failed", status: r2.status }, { status: 502 });
          }
          return new Response(r2.body, {
            status: 200,
            headers: {
              "Content-Type": r2.headers.get("Content-Type") ?? "audio/mpeg",
              "Cache-Control": "public, max-age=3600",
            },
          });
        } catch (e) {
          return Response.json({ error: "fetch_failed", message: String(e) }, { status: 500 });
        }
      },
    },
  },
} as unknown as Parameters<typeof createFileRoute<"/api/soundcloud/stream">>[0]);