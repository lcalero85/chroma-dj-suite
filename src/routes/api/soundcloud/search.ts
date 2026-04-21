import { createFileRoute } from "@tanstack/react-router";
import { getSoundCloudClientId, invalidateSoundCloudClientId } from "@/lib/scClientId";

// Public SoundCloud search proxy. The client_id is auto-scraped from
// soundcloud.com because the historical public id rotates frequently.
// Override with SOUNDCLOUD_CLIENT_ID env var if needed.

async function callSearch(q: string, limit: string, clientId: string) {
  const sc = new URL("https://api-v2.soundcloud.com/search/tracks");
  sc.searchParams.set("q", q);
  sc.searchParams.set("client_id", clientId);
  sc.searchParams.set("limit", limit);
  sc.searchParams.set("offset", "0");
  sc.searchParams.set("linked_partitioning", "1");
  sc.searchParams.set("app_locale", "en");
  return fetch(sc.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "application/json",
    },
  });
}

export const Route = createFileRoute("/api/soundcloud/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const q = url.searchParams.get("q")?.trim();
        const limit = url.searchParams.get("limit") || "20";
        if (!q) {
          return Response.json({ error: "missing q" }, { status: 400 });
        }
        try {
          let clientId = await getSoundCloudClientId();
          let res = await callSearch(q, limit, clientId);
          if (res.status === 401 || res.status === 403) {
            // cached id is stale — refresh and retry once
            invalidateSoundCloudClientId();
            clientId = await getSoundCloudClientId(true);
            res = await callSearch(q, limit, clientId);
          }
          if (!res.ok) {
            const body = await res.text();
            return Response.json(
              { error: "soundcloud_search_failed", status: res.status, body: body.slice(0, 300) },
              { status: 502 },
            );
          }
          const data = (await res.json()) as {
            collection?: Array<{
              id: number;
              title: string;
              duration: number;
              permalink_url: string;
              artwork_url: string | null;
              user?: { username?: string };
              media?: { transcodings?: Array<{ url: string; format: { protocol: string; mime_type: string } }> };
              streamable?: boolean;
              policy?: string;
            }>;
          };
          const items = (data.collection ?? [])
            .filter((t) => t.streamable !== false && t.policy !== "BLOCK")
            .map((t) => {
              const progressive = t.media?.transcodings?.find(
                (x) => x.format.protocol === "progressive",
              );
              return {
                id: t.id,
                title: t.title,
                artist: t.user?.username ?? "",
                duration: Math.round((t.duration ?? 0) / 1000),
                permalink: t.permalink_url,
                artwork: t.artwork_url,
                transcodingUrl: progressive?.url ?? null,
              };
            })
            .filter((t) => !!t.transcodingUrl);
          return Response.json({ items });
        } catch (e) {
          return Response.json({ error: "fetch_failed", message: String(e) }, { status: 500 });
        }
      },
    },
  },
});