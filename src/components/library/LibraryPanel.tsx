import { useEffect, useRef } from "react";
import { useApp } from "@/state/store";
import { listTracks, putTrack, deleteTrack, uid, type TrackRecord } from "@/lib/db";
import { loadTrackToDeck } from "@/state/controller";
import { ensureRunning } from "@/audio/engine";
import { formatTime } from "@/lib/format";
import { Upload, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

export function LibraryPanel() {
  const tracks = useApp((s) => s.tracks);
  const search = useApp((s) => s.search);
  const setTracks = useApp((s) => s.setTracks);
  const setSearch = useApp((s) => s.setSearch);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listTracks().then(setTracks);
  }, [setTracks]);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    await ensureRunning();
    for (const f of Array.from(files)) {
      const id = uid();
      const buf = await f.arrayBuffer();
      // quick duration via decode
      let duration = 0;
      try {
        const ctx = await ensureRunning();
        const ab = await ctx.decodeAudioData(buf.slice(0));
        duration = ab.duration;
      } catch {
        /* noop */
      }
      const rec: TrackRecord = {
        id,
        title: f.name.replace(/\.[^.]+$/, ""),
        artist: "",
        duration,
        bpm: null,
        key: null,
        color: "#7c5cff",
        addedAt: Date.now(),
        lastPlayed: null,
        blob: f,
      };
      await putTrack(rec);
    }
    setTracks(await listTracks());
    toast(`${files.length} pista(s) añadidas`);
  };

  const filtered = tracks
    .filter((t) => {
      const q = search.toLowerCase();
      return !q || t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q);
    })
    .sort((a, b) => b.addedAt - a.addedAt);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button className="vdj-btn" onClick={() => fileRef.current?.click()}>
          <Upload size={12} /> Importar
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div
          className="vdj-panel-inset"
          style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, padding: "6px 10px" }}
        >
          <Search size={12} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar pistas…"
            style={{
              flex: 1,
              background: "transparent",
              border: 0,
              color: "var(--text-1)",
              outline: "none",
              fontSize: 12,
            }}
          />
        </div>
        <span className="vdj-chip">{filtered.length} pistas</span>
      </div>

      <div className="vdj-panel-inset vdj-scroll" style={{ flex: 1, overflow: "auto", padding: 4 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ color: "var(--text-3)", textAlign: "left" }}>
              <th style={{ padding: 6, fontWeight: 600 }}>Título</th>
              <th style={{ padding: 6, fontWeight: 600 }}>Artista</th>
              <th style={{ padding: 6, fontWeight: 600 }}>BPM</th>
              <th style={{ padding: 6, fontWeight: 600 }}>Key</th>
              <th style={{ padding: 6, fontWeight: 600 }}>Tiempo</th>
              <th style={{ padding: 6, fontWeight: 600 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--text-3)" }}>
                  Tu librería está vacía. Importa archivos de audio para comenzar.
                </td>
              </tr>
            )}
            {filtered.map((t) => (
              <tr
                key={t.id}
                style={{ borderTop: "1px solid var(--line)" }}
                onDoubleClick={() => loadTrackToDeck("A", t.id)}
              >
                <td style={{ padding: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 4, height: 16, background: t.color, borderRadius: 2 }} />
                    {t.title}
                  </div>
                </td>
                <td style={{ padding: 6, color: "var(--text-2)" }}>{t.artist || "—"}</td>
                <td style={{ padding: 6 }}>{t.bpm ? t.bpm.toFixed(1) : "—"}</td>
                <td style={{ padding: 6 }}>{t.key ?? "—"}</td>
                <td style={{ padding: 6, color: "var(--text-2)" }}>{formatTime(t.duration)}</td>
                <td style={{ padding: 6, textAlign: "right" }}>
                  <button className="vdj-btn" style={{ padding: "2px 8px", fontSize: 10 }} onClick={() => loadTrackToDeck("A", t.id)}>
                    →A
                  </button>{" "}
                  <button className="vdj-btn" style={{ padding: "2px 8px", fontSize: 10 }} onClick={() => loadTrackToDeck("B", t.id)}>
                    →B
                  </button>{" "}
                  <button
                    className="vdj-btn"
                    style={{ padding: "2px 6px", fontSize: 10 }}
                    onClick={async () => {
                      await deleteTrack(t.id);
                      setTracks(await listTracks());
                    }}
                  >
                    <Trash2 size={10} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}