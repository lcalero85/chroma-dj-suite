// Resolves a working SoundCloud client_id by scraping it from soundcloud.com
// public bundled JS. The widely-known public id rotates and frequently returns
// 401, so we extract a fresh one at runtime and cache it in memory.

let cached: { id: string; ts: number } | null = null;
const TTL_MS = 1000 * 60 * 60 * 6; // 6h

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function scrape(): Promise<string> {
  const home = await fetch("https://soundcloud.com/discover", {
    headers: { "User-Agent": UA, Accept: "text/html" },
  });
  if (!home.ok) throw new Error(`home ${home.status}`);
  const html = await home.text();
  // find all <script src="https://a-v2.sndcdn.com/assets/*.js"> URLs
  const scriptUrls = Array.from(
    html.matchAll(/<script[^>]+src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g),
  ).map((m) => m[1]);
  if (scriptUrls.length === 0) throw new Error("no asset scripts found");

  // The client_id is usually defined in one of the last asset scripts.
  for (const url of scriptUrls.reverse()) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA } });
      if (!r.ok) continue;
      const js = await r.text();
      const m = js.match(/client_id\s*[:=]\s*"([a-zA-Z0-9]{30,})"/);
      if (m) return m[1];
    } catch {
      /* try next */
    }
  }
  throw new Error("client_id not found in any asset script");
}

export async function getSoundCloudClientId(forceRefresh = false): Promise<string> {
  const envId = process.env.SOUNDCLOUD_CLIENT_ID;
  if (envId) return envId;
  if (!forceRefresh && cached && Date.now() - cached.ts < TTL_MS) return cached.id;
  const id = await scrape();
  cached = { id, ts: Date.now() };
  return id;
}

export function invalidateSoundCloudClientId() {
  cached = null;
}