import { useEffect, useState } from "react";
import { Search, Download, Music2, Loader2, ExternalLink, Cloud } from "lucide-react";
import { toast } from "sonner";
import { putTrack, uid, listTracks, type TrackRecord } from "@/lib/db";
import { loadTrackToDeck } from "@/state/controller";
import { useApp } from "@/state/store";
import { ensureRunning } from "@/audio/engine";
import { formatTime } from "@/lib/format";
import { useT } from "@/lib/i18n";

interface ScResult {
  id: number;
  title: string;
  artist: string;
  duration: number;
  permalink: string;
  artwork: string | null;
  transcodingUrl: string;
}

type Provider = "soundcloud" | "spotify" | "beatport";

const PROVIDERS: { id: Provider; name: string; color: string; mixable: boolean; noteKey: "onlineNoteSC" | "onlineNoteSpot" | "onlineNoteBP" }[] = [
  { id: "soundcloud", name: "SoundCloud", color: "#ff5500", mixable: true, noteKey: "onlineNoteSC" },
  { id: "spotify", name: "Spotify", color: "#1db954", mixable: false, noteKey: "onlineNoteSpot" },
  { id: "beatport", name: "Beatport", color: "#a4ff00", mixable: false, noteKey: "onlineNoteBP" },
];

async function fetchAudioAsBlob(transcodingUrl: string): Promise<Blob> {
  const proxy = `/api/soundcloud/stream?t=${encodeURIComponent(transcodingUrl)}`;
  const r = await fetch(proxy);
  if (!r.ok) throw new Error(`stream HTTP ${r.status}`);
  return r.blob();
}

async function importToLibrary(item: ScResult): Promise<TrackRecord> {
  const blob = await fetchAudioAsBlob(item.transcodingUrl);
  const id = uid();
  let duration = item.duration;
  try {
    const ctx = await ensureRunning();
    const ab = await ctx.decodeAudioData(await blob.arrayBuffer().then((b) => b.slice(0)));
    duration = ab.duration;
  } catch {
    /* keep metadata duration */
  }
  const rec: TrackRecord = {
    id,
    title: item.title,
    artist: item.artist,
    duration,
    bpm: null,
    key: null,
    color: "#ff5500",
    addedAt: Date.now(),
    lastPlayed: null,
    blob,
    kind: "audio",
    mime: blob.type || "audio/mpeg",
    folderId: null,
  };
  await putTrack(rec);
  return rec;
}

export function OnlinePanel() {
  const setTracks = useApp((s) => s.setTracks);
  const tr = useT();
  const [provider, setProvider] = useState<Provider>("soundcloud");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [results, setResults] = useState<ScResult[]>([]);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [audio] = useState(() => (typeof Audio !== "undefined" ? new Audio() : null));

  useEffect(() => () => { audio?.pause(); }, [audio]);

  const search = async () => {
    if (provider !== "soundcloud") {
      const name = provider === "spotify" ? "Spotify" : "Beatport";
      toast(tr("onlineProviderNotMixable", { name }), {
        description: tr("onlineProviderNotMixableDesc"),
      });
      return;
    }
    if (!q.trim()) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/soundcloud/search?q=${encodeURIComponent(q)}&limit=25`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "search failed");
      setResults(j.items as ScResult[]);
      if ((j.items as ScResult[]).length === 0) toast(tr("onlineNoResults"));
    } catch (e) {
      toast.error(tr("onlineSearchError"), { description: String(e) });
    } finally {
      setLoading(false);
    }
  };

  const togglePreview = async (item: ScResult) => {
    if (!audio) return;
    if (previewId === item.id) {
      audio.pause();
      setPreviewId(null);
      return;
    }
    audio.pause();
    audio.src = `/api/soundcloud/stream?t=${encodeURIComponent(item.transcodingUrl)}`;
    audio.currentTime = 0;
    setPreviewId(item.id);
    try {
      await audio.play();
      audio.onended = () => setPreviewId(null);
    } catch {
      toast.error(tr("onlineCouldNotPreview"));
      setPreviewId(null);
    }
  };

  const loadDeck = async (item: ScResult, deck: "A" | "B") => {
    setBusyId(item.id);
    try {
      const rec = await importToLibrary(item);
      setTracks(await listTracks());
      await loadTrackToDeck(deck, rec.id);
    } catch (e) {
      toast.error(tr("onlineFailedLoadDeck", { deck }), { description: String(e) });
    } finally {
      setBusyId(null);
    }
  };

  const saveOnly = async (item: ScResult) => {
    setBusyId(item.id);
    try {
      await importToLibrary(item);
      setTracks(await listTracks());
      toast.success(t("onlineSavedTitle"), { description: item.title });
    } catch (e) {
      toast.error(tr("onlineCouldNotSave"), { description: String(e) });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
      {/* Provider tabs */}
      <div style={{ display: "flex", gap: 4 }}>
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            className="vdj-btn"
            data-active={provider === p.id}
            onClick={() => setProvider(p.id)}
            title={tr(p.noteKey)}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 8, background: p.color }} />
            {p.name}
            {!p.mixable && <span style={{ fontSize: 9, opacity: 0.6 }}>(read-only)</span>}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div className="vdj-panel-inset" style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, padding: "6px 10px" }}>
          <Search size={12} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void search(); }}
            placeholder={
              provider === "soundcloud"
                ? tr("onlineSearchSCPlaceholder")
                : tr("onlineSearchOtherPlaceholder")
            }
            disabled={provider !== "soundcloud"}
            style={{ flex: 1, background: "transparent", border: 0, color: "var(--text-1)", outline: "none", fontSize: 12 }}
          />
        </div>
        <button className="vdj-btn" onClick={() => void search()} disabled={loading || provider !== "soundcloud"}>
          {loading ? <Loader2 size={12} className="vdj-spin" /> : <Search size={12} />} {tr("onlineSearchBtn")}
        </button>
      </div>

      {provider !== "soundcloud" && (
        <div className="vdj-panel-inset" style={{ padding: 14, fontSize: 11, color: "var(--text-2)", lineHeight: 1.5 }}>
          {tr("onlineNotMixable", { name: provider === "spotify" ? "Spotify" : "Beatport" })}
          <br />
          {tr("onlineUseSoundCloud")}
        </div>
      )}

      {provider === "soundcloud" && (
        <div className="vdj-panel-inset vdj-scroll" style={{ flex: 1, overflow: "auto", padding: 4, minHeight: 0 }}>
          {results.length === 0 && !loading && (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>
              <Cloud size={20} style={{ opacity: 0.4, marginBottom: 6 }} />
              <div>{tr("onlineEmptyHint")}</div>
              <div style={{ fontSize: 10, marginTop: 6, opacity: 0.7 }}>{tr("onlineEmptySubHint")}</div>
            </div>
          )}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <tbody>
              {results.map((t) => (
                <tr key={t.id} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: 6, width: 36 }}>
                    {t.artwork ? (
                      <img src={t.artwork.replace("-large.", "-t67x67.")} width={28} height={28} style={{ borderRadius: 3, display: "block" }} alt="" />
                    ) : (
                      <div style={{ width: 28, height: 28, background: "var(--bg-2)", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Music2 size={12} style={{ opacity: 0.5 }} />
                      </div>
                    )}
                  </td>
                  <td style={{ padding: 6, minWidth: 0 }}>
                    <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 280 }}>{t.title}</div>
                    <div style={{ fontSize: 10, color: "var(--text-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 280 }}>{t.artist}</div>
                  </td>
                  <td style={{ padding: 6, color: "var(--text-2)", fontSize: 11 }}>{formatTime(t.duration)}</td>
                  <td style={{ padding: 6, textAlign: "right", whiteSpace: "nowrap" }}>
                    <button className="vdj-btn" style={{ padding: "2px 8px", fontSize: 10 }} onClick={() => void togglePreview(t)} disabled={busyId === t.id}>
                      {previewId === t.id ? "■" : "▶"}
                    </button>{" "}
                    <button className="vdj-btn" style={{ padding: "2px 8px", fontSize: 10 }} onClick={() => void loadDeck(t, "A")} disabled={busyId === t.id}>
                      {busyId === t.id ? <Loader2 size={9} className="vdj-spin" /> : "→A"}
                    </button>{" "}
                    <button className="vdj-btn" style={{ padding: "2px 8px", fontSize: 10 }} onClick={() => void loadDeck(t, "B")} disabled={busyId === t.id}>
                      {busyId === t.id ? <Loader2 size={9} className="vdj-spin" /> : "→B"}
                    </button>{" "}
                    <button className="vdj-btn" style={{ padding: "2px 6px", fontSize: 10 }} title={tr("onlineSaveTip")} onClick={() => void saveOnly(t)} disabled={busyId === t.id}>
                      <Download size={10} />
                    </button>{" "}
                    <a className="vdj-btn" style={{ padding: "2px 6px", fontSize: 10, display: "inline-flex" }} href={t.permalink} target="_blank" rel="noreferrer" title={tr("onlineOpenInSC")}>
                      <ExternalLink size={10} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}