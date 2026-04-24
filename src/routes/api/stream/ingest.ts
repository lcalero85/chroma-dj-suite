import { createFileRoute } from "@tanstack/react-router";

// In-memory session table. Each session represents an open Icecast PUT request
// to the upstream server. We keep a writable stream and forward bytes from the
// browser.

type Session = {
  controller: ReadableStreamDefaultController<Uint8Array>;
  upstream: Promise<Response>;
  contentType: string;
  bytesSent: number;
  closed: boolean;
  /** Upstream base + admin auth used for metadata updates. */
  serverUrl: string;
  mount: string;
  username: string;
  password: string;
};

const sessions = new Map<string, Session>();

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/stream/ingest")({
  server: {
    handlers: {
      // Open an upstream Icecast connection
      POST: async ({ request }: { request: Request }) => {
        let body: {
          action: string;
          serverUrl: string;
          mount: string;
          username: string;
          password: string;
          contentType: string;
          stationName?: string;
          genre?: string;
          description?: string;
          bitrate?: number;
        };
        try {
          body = await request.json();
        } catch {
          return jsonResponse({ error: "invalid json" }, 400);
        }
        if (body.action !== "start") return jsonResponse({ error: "unknown action" }, 400);
        if (!body.serverUrl || !body.mount || !body.password) {
          return jsonResponse({ error: "missing fields" }, 400);
        }

        const sessionId = crypto.randomUUID();
        const base = body.serverUrl.replace(/\/+$/, "");
        const mount = body.mount.startsWith("/") ? body.mount : `/${body.mount}`;
        const target = `${base}${mount}`;

        const auth = "Basic " + btoa(`${body.username || "source"}:${body.password}`);

        // Build a streaming body that we will write to as data arrives.
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            sessions.set(sessionId, {
              controller,
              upstream: Promise.resolve(new Response(null)), // placeholder, replaced below
              contentType: body.contentType,
              bytesSent: 0,
              closed: false,
              serverUrl: base,
              mount,
              username: body.username || "source",
              password: body.password,
            });
          },
        });

        // Fire upstream PUT (Icecast 2.4 source protocol).
        const upstreamPromise = fetch(target, {
          method: "PUT",
          headers: {
            Authorization: auth,
            "Content-Type": body.contentType,
            "Ice-Public": "1",
            "Ice-Name": body.stationName ?? "VDJ PRO Radio",
            "Ice-Genre": body.genre ?? "Mixed",
            "Ice-Description": body.description ?? "Live DJ set",
            "Ice-Bitrate": String(body.bitrate ?? 128),
            Expect: "100-continue",
          },
          body: stream,
          // @ts-expect-error duplex required for streaming requests in fetch
          duplex: "half",
        });

        const sess = sessions.get(sessionId);
        if (sess) sess.upstream = upstreamPromise;

        // Race: wait briefly for early failure (e.g. 401/connection refused).
        const earlyError = await Promise.race([
          upstreamPromise.then(
            (r) => (r.ok || r.status === 200 ? null : `Icecast respondió ${r.status}`),
            (e) => `No se pudo conectar: ${String(e?.message ?? e)}`,
          ),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 800)),
        ]);

        if (earlyError) {
          const s = sessions.get(sessionId);
          if (s) {
            try { s.controller.close(); } catch { /* noop */ }
            sessions.delete(sessionId);
          }
          return jsonResponse({ error: earlyError }, 502);
        }

        return jsonResponse({ sessionId });
      },

      // Push a chunk of audio
      PUT: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const sessionId = url.searchParams.get("sessionId");
        if (!sessionId) return jsonResponse({ error: "missing sessionId" }, 400);
        const sess = sessions.get(sessionId);
        if (!sess || sess.closed) return jsonResponse({ error: "no session" }, 404);
        try {
          const buf = new Uint8Array(await request.arrayBuffer());
          sess.controller.enqueue(buf);
          sess.bytesSent += buf.byteLength;
          return jsonResponse({ ok: true, bytesSent: sess.bytesSent });
        } catch (err) {
          return jsonResponse({ error: String(err) }, 500);
        }
      },

      // Stop the session
      DELETE: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const sessionId = url.searchParams.get("sessionId");
        if (!sessionId) return jsonResponse({ error: "missing sessionId" }, 400);
        const sess = sessions.get(sessionId);
        if (!sess) return jsonResponse({ ok: true });
        sess.closed = true;
        try { sess.controller.close(); } catch { /* noop */ }
        sessions.delete(sessionId);
        return jsonResponse({ ok: true, bytesSent: sess.bytesSent });
      },

      // Update Icecast stream metadata (now-playing title/artist).
      PATCH: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const sessionId = url.searchParams.get("sessionId");
        if (!sessionId) return jsonResponse({ error: "missing sessionId" }, 400);
        const sess = sessions.get(sessionId);
        if (!sess || sess.closed) return jsonResponse({ error: "no session" }, 404);
        let body: { title?: string; artist?: string };
        try {
          body = await request.json();
        } catch {
          return jsonResponse({ error: "invalid json" }, 400);
        }
        const song = [body.artist, body.title].filter(Boolean).join(" - ").trim();
        if (!song) return jsonResponse({ ok: true });
        const auth = "Basic " + btoa(`${sess.username}:${sess.password}`);
        const adminUrl = `${sess.serverUrl}/admin/metadata?mount=${encodeURIComponent(sess.mount)}&mode=updinfo&song=${encodeURIComponent(song)}`;
        try {
          const r = await fetch(adminUrl, { method: "GET", headers: { Authorization: auth } });
          return jsonResponse({ ok: r.ok, status: r.status });
        } catch (err) {
          return jsonResponse({ error: String(err) }, 502);
        }
      },
    },
  },
} as unknown as Parameters<typeof createFileRoute<"/api/stream/ingest">>[0]);