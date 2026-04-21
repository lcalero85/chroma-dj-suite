import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/state/store";
import { listTracks, putTrack, deleteTrack, uid, type TrackRecord, type FolderRecord } from "@/lib/db";
import { loadTrackToDeck, refreshFolders, createFolder, renameFolder, removeFolder, moveTrackToFolder } from "@/state/controller";
import { ensureRunning } from "@/audio/engine";
import { formatTime } from "@/lib/format";
import { Upload, Trash2, Search, Radio, Folder, FolderPlus, ChevronRight, ChevronDown, Pencil, Film, Tag, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { radioAdd, addTrackToSegment } from "@/state/controller";
import { isCompatible, type CamelotKey } from "@/lib/camelot";

function FolderNode({
  folder,
  allFolders,
  depth,
  selectedId,
  onSelect,
  expanded,
  setExpanded,
  onDropTrack,
}: {
  folder: FolderRecord;
  allFolders: FolderRecord[];
  depth: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  expanded: Record<string, boolean>;
  setExpanded: (e: Record<string, boolean>) => void;
  onDropTrack: (trackId: string, folderId: string) => void;
}) {
  const children = allFolders.filter((f) => f.parentId === folder.id);
  const isOpen = expanded[folder.id] ?? true;
  const isSel = selectedId === folder.id;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const [hover, setHover] = useState(false);

  return (
    <div>
      <div
        onClick={() => onSelect(folder.id)}
        onDragOver={(e) => { e.preventDefault(); setHover(true); }}
        onDragLeave={() => setHover(false)}
        onDrop={(e) => {
          e.preventDefault();
          setHover(false);
          const tid = e.dataTransfer.getData("text/track-id");
          if (tid) onDropTrack(tid, folder.id);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "3px 6px",
          paddingLeft: 6 + depth * 14,
          cursor: "pointer",
          background: isSel ? "color-mix(in oklab, var(--accent) 18%, transparent)" : hover ? "color-mix(in oklab, var(--accent) 10%, transparent)" : "transparent",
          borderRadius: 4,
          fontSize: 11,
        }}
      >
        <span
          onClick={(e) => { e.stopPropagation(); setExpanded({ ...expanded, [folder.id]: !isOpen }); }}
          style={{ display: "inline-flex", width: 12 }}
        >
          {children.length > 0 ? (isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />) : null}
        </span>
        <Folder size={11} />
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={async () => {
              setEditing(false);
              if (name.trim() && name !== folder.name) await renameFolder(folder.id, name.trim());
            }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            style={{ flex: 1, fontSize: 11, background: "transparent", border: "1px solid var(--line)", color: "var(--text-1)", padding: "0 4px" }}
          />
        ) : (
          <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{folder.name}</span>
        )}
        <button className="vdj-btn" style={{ padding: "1px 4px", fontSize: 9 }} title="Renombrar" onClick={(e) => { e.stopPropagation(); setEditing(true); }}>
          <Pencil size={9} />
        </button>
        <button className="vdj-btn" style={{ padding: "1px 4px", fontSize: 9 }} title="Subcarpeta" onClick={async (e) => { e.stopPropagation(); const n = window.prompt("Nombre de la subcarpeta"); if (n) { await createFolder(n, folder.id); setExpanded({ ...expanded, [folder.id]: true }); } }}>
          <FolderPlus size={9} />
        </button>
        <button className="vdj-btn" style={{ padding: "1px 4px", fontSize: 9 }} title="Eliminar" onClick={async (e) => { e.stopPropagation(); if (confirm(`Eliminar carpeta "${folder.name}" y sus subcarpetas? Las pistas se moverán a la raíz.`)) { await removeFolder(folder.id); if (selectedId === folder.id) onSelect(null); } }}>
          <Trash2 size={9} />
        </button>
      </div>
      {isOpen && children.map((c) => (
        <FolderNode
          key={c.id}
          folder={c}
          allFolders={allFolders}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
          expanded={expanded}
          setExpanded={setExpanded}
          onDropTrack={onDropTrack}
        />
      ))}
    </div>
  );
}

export function LibraryPanel() {
  const tracks = useApp((s) => s.tracks);
  const search = useApp((s) => s.search);
  const setTracks = useApp((s) => s.setTracks);
  const setSearch = useApp((s) => s.setSearch);
  const folders = useApp((s) => s.folders);
  const selectedFolderId = useApp((s) => s.selectedFolderId);
  const setSelectedFolder = useApp((s) => s.setSelectedFolder);
  const segments = useApp((s) => s.segments);
  const fileRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    listTracks().then(setTracks);
    refreshFolders();
  }, [setTracks]);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    await ensureRunning();
    for (const f of Array.from(files)) {
      const id = uid();
      const buf = await f.arrayBuffer();
      const isVideo = f.type.startsWith("video/");
      // quick duration via decode (audio path) or video metadata (video path)
      let duration = 0;
      try {
        const ctx = await ensureRunning();
        const ab = await ctx.decodeAudioData(buf.slice(0));
        duration = ab.duration;
      } catch {
        if (isVideo) {
          duration = await new Promise<number>((resolve) => {
            const v = document.createElement("video");
            v.preload = "metadata";
            v.src = URL.createObjectURL(f);
            v.onloadedmetadata = () => {
              resolve(v.duration || 0);
              URL.revokeObjectURL(v.src);
            };
            v.onerror = () => resolve(0);
          });
        }
      }
      const rec: TrackRecord = {
        id,
        title: f.name.replace(/\.[^.]+$/, ""),
        artist: "",
        duration,
        bpm: null,
        key: null,
        color: isVideo ? "#19a7ff" : "#7c5cff",
        addedAt: Date.now(),
        lastPlayed: null,
        blob: f,
        kind: isVideo ? "video" : "audio",
        mime: f.type,
        folderId: selectedFolderId,
      };
      await putTrack(rec);
    }
    setTracks(await listTracks());
    toast(`${files.length} pista(s) añadidas`);
  };

  const filtered = tracks
    .filter((t) => {
      const q = search.toLowerCase();
      const matchesText = !q || t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q);
      const matchesFolder = selectedFolderId === null
        ? true
        : (t.folderId ?? null) === selectedFolderId;
      return matchesText && matchesFolder;
    })
    .sort((a, b) => b.addedAt - a.addedAt);

  const rootFolders = folders.filter((f) => f.parentId === null);
  const onDropToFolder = async (trackId: string, folderId: string | null) => {
    await moveTrackToFolder(trackId, folderId);
    setTracks(await listTracks());
    toast("Pista movida");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button className="vdj-btn" onClick={() => fileRef.current?.click()}>
          <Upload size={12} /> Importar
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*,video/*"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          className="vdj-btn"
          onClick={async () => {
            const n = window.prompt("Nombre del género o carpeta");
            if (n) await createFolder(n, null);
          }}
          title="Nueva carpeta raíz"
        >
          <FolderPlus size={12} /> Carpeta
        </button>
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

      <div style={{ display: "flex", gap: 8, flex: 1, minHeight: 0 }}>
        {/* Folder tree sidebar */}
        <div
          className="vdj-panel-inset vdj-scroll"
          style={{ width: 200, overflow: "auto", padding: 6, flexShrink: 0 }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const tid = e.dataTransfer.getData("text/track-id");
            if (tid) void onDropToFolder(tid, null);
          }}
        >
          <div
            onClick={() => setSelectedFolder(null)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 6px",
              cursor: "pointer",
              background: selectedFolderId === null ? "color-mix(in oklab, var(--accent) 18%, transparent)" : "transparent",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            <Folder size={11} /> Todas las pistas
            <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-3)" }}>{tracks.length}</span>
          </div>
          {rootFolders.length === 0 && (
            <div style={{ fontSize: 10, color: "var(--text-3)", padding: 6, textAlign: "center" }}>
              Crea carpetas para organizar por géneros y subgéneros.
            </div>
          )}
          {rootFolders.map((f) => (
            <FolderNode
              key={f.id}
              folder={f}
              allFolders={folders}
              depth={0}
              selectedId={selectedFolderId}
              onSelect={setSelectedFolder}
              expanded={expanded}
              setExpanded={setExpanded}
              onDropTrack={(tid, fid) => void onDropToFolder(tid, fid)}
            />
          ))}
        </div>

        {/* Track table */}
        <div className="vdj-panel-inset vdj-scroll" style={{ flex: 1, overflow: "auto", padding: 4, minWidth: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ color: "var(--text-3)", textAlign: "left" }}>
              <th style={{ padding: 6, fontWeight: 600, width: 18 }}></th>
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
                <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-3)" }}>
                  Tu librería está vacía. Importa archivos de audio para comenzar.
                </td>
              </tr>
            )}
            {filtered.map((t) => (
              <tr
                key={t.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/track-id", t.id)}
                style={{ borderTop: "1px solid var(--line)" }}
                onDoubleClick={() => loadTrackToDeck("A", t.id)}
              >
                <td style={{ padding: 6, color: t.kind === "video" ? "var(--accent)" : "var(--text-3)" }}>
                  {t.kind === "video" ? <Film size={12} /> : null}
                </td>
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
                    title="Añadir a cola de Radio (Deck A)"
                    onClick={() => radioAdd(t.id)}
                  >
                    <Radio size={10} />
                  </button>{" "}
                  {segments.length > 0 && (
                    <select
                      className="vdj-btn"
                      title="Añadir a un segmento"
                      style={{ padding: "2px 4px", fontSize: 10, maxWidth: 100 }}
                      value=""
                      onChange={(e) => {
                        const sid = e.target.value;
                        if (!sid) return;
                        addTrackToSegment(sid, t.id);
                        const seg = segments.find((s) => s.id === sid);
                        toast(`Añadida a "${seg?.name ?? "segmento"}"`);
                        e.target.value = "";
                      }}
                    >
                      <option value="">+ Segmento</option>
                      {segments.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  )}{" "}
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
    </div>
  );
}