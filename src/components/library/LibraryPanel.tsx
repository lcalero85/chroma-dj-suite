import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/state/store";
import { listTracks, putTrack, deleteTrack, uid, type TrackRecord, type FolderRecord } from "@/lib/db";
import { loadTrackToDeck, refreshFolders, createFolder, renameFolder, removeFolder, moveTrackToFolder } from "@/state/controller";
import { ensureRunning } from "@/audio/engine";
import { formatTime } from "@/lib/format";
import { Upload, Trash2, Search, Radio, Folder, FolderPlus, ChevronRight, ChevronDown, Pencil, Film, Tag, SlidersHorizontal, FolderSearch, Star, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { radioAdd, addTrackToSegment } from "@/state/controller";
import { isCompatible, type CamelotKey } from "@/lib/camelot";
import { useT } from "@/lib/i18n";
import { useActiveDeck } from "@/lib/activeDeck";
import { Sparkles } from "lucide-react";
import { toggleVdjTrack } from "@/audio/virtualDj";

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
  const tr = useT();

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
        <button className="vdj-btn" style={{ padding: "1px 4px", fontSize: 9 }} title={tr("libRename")} onClick={(e) => { e.stopPropagation(); setEditing(true); }}>
          <Pencil size={9} />
        </button>
        <button className="vdj-btn" style={{ padding: "1px 4px", fontSize: 9 }} title={tr("libSubfolder")} onClick={async (e) => { e.stopPropagation(); const n = window.prompt(tr("libSubfolderPrompt")); if (n) { await createFolder(n, folder.id); setExpanded({ ...expanded, [folder.id]: true }); } }}>
          <FolderPlus size={9} />
        </button>
        <button className="vdj-btn" style={{ padding: "1px 4px", fontSize: 9 }} title={tr("libDelete")} onClick={async (e) => { e.stopPropagation(); if (confirm(tr("libDeleteFolderConfirm", { name: folder.name }))) { await removeFolder(folder.id); if (selectedId === folder.id) onSelect(null); } }}>
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
  const tr = useT();
  const tracks = useApp((s) => s.tracks);
  const search = useApp((s) => s.search);
  const setTracks = useApp((s) => s.setTracks);
  const setSearch = useApp((s) => s.setSearch);
  const folders = useApp((s) => s.folders);
  const selectedFolderId = useApp((s) => s.selectedFolderId);
  const setSelectedFolder = useApp((s) => s.setSelectedFolder);
  const segments = useApp((s) => s.segments);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dropActive, setDropActive] = useState(false);
  const dragDepthRef = useRef(0);

  // Advanced filters
  const [showFilters, setShowFilters] = useState(false);
  const [bpmMin, setBpmMin] = useState<number>(0);
  const [bpmMax, setBpmMax] = useState<number>(220);
  const [compatibleWith, setCompatibleWith] = useState<CamelotKey | "">("");
  const [tagFilter, setTagFilter] = useState<string>("");
  // Sort + favorites
  type SortKey = "added" | "title" | "artist" | "bpm" | "key" | "duration";
  const [sortBy, setSortBy] = useState<SortKey>("added");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showFavOnly, setShowFavOnly] = useState(false);
  // Smart Playlists — quick one-click curation presets that drive the
  // existing filter state (BPM range, key compatibility, favorites).
  type SmartPreset = "warmup" | "peak" | "cooldown" | "compat" | "fresh";
  const [smartPreset, setSmartPreset] = useState<SmartPreset | null>(null);
  const activeDeckId = useActiveDeck();
  const activeDeckKey = useApp((s) => s.decks[activeDeckId].key);
  const activeDeckBpm = useApp((s) => s.decks[activeDeckId].bpm);

  const applySmartPreset = (p: SmartPreset | null) => {
    if (p === null || smartPreset === p) {
      // toggle off → restore neutral filters
      setSmartPreset(null);
      setShowFilters(false);
      setBpmMin(0);
      setBpmMax(220);
      setCompatibleWith("");
      setShowFavOnly(false);
      setSortBy("added");
      setSortDir("desc");
      return;
    }
    setSmartPreset(p);
    setShowFilters(true);
    setShowFavOnly(false);
    setCompatibleWith("");
    switch (p) {
      case "warmup":
        setBpmMin(90); setBpmMax(115);
        setSortBy("bpm"); setSortDir("asc");
        break;
      case "peak":
        setBpmMin(122); setBpmMax(132);
        setSortBy("bpm"); setSortDir("asc");
        break;
      case "cooldown":
        setBpmMin(60); setBpmMax(95);
        setSortBy("bpm"); setSortDir("desc");
        break;
      case "compat": {
        // Match active deck ±4 BPM and harmonically compatible key.
        const bpm = activeDeckBpm ?? 0;
        if (bpm > 0) { setBpmMin(Math.max(0, Math.round(bpm - 4))); setBpmMax(Math.round(bpm + 4)); }
        else { setBpmMin(0); setBpmMax(220); }
        if (activeDeckKey) setCompatibleWith(activeDeckKey as CamelotKey);
        setSortBy("bpm"); setSortDir("asc");
        break;
      }
      case "fresh":
        setBpmMin(0); setBpmMax(220);
        setSortBy("added"); setSortDir("desc");
        break;
    }
  };

  const toggleFavorite = async (track: TrackRecord) => {
    const next = { ...track, favorite: !track.favorite };
    await putTrack(next);
    setTracks(await listTracks());
  };

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
    toast(tr("libTracksAdded", { n: files.length }));
  };

  // ===== Import folder (with subfolders) using webkitdirectory =====
  const handleFolderImport = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    await ensureRunning();
    const ctx = await ensureRunning();

    // Map relative folder path → folder id (created on demand).
    // Each file from <input webkitdirectory> exposes a `webkitRelativePath` like
    // "MyMusic/House/track.mp3". We replicate that hierarchy in our folders DB.
    const pathToFolderId = new Map<string, string | null>();
    pathToFolderId.set("", selectedFolderId ?? null); // root anchor: import inside selected folder if any

    const ensureFolderPath = async (segments: string[]): Promise<string | null> => {
      let parentId: string | null = selectedFolderId ?? null;
      let acc = "";
      for (const seg of segments) {
        acc = acc ? `${acc}/${seg}` : seg;
        if (pathToFolderId.has(acc)) {
          parentId = pathToFolderId.get(acc) ?? null;
          continue;
        }
        const created = await createFolder(seg, parentId);
        const fid = created?.id ?? null;
        pathToFolderId.set(acc, fid);
        parentId = fid;
      }
      return parentId;
    };

    const arr = Array.from(files);
    const accepted = arr.filter((f) => /^(audio|video)\//.test(f.type) || /\.(mp3|wav|flac|m4a|aac|ogg|opus|webm|mp4|mov|mkv)$/i.test(f.name));
    if (accepted.length === 0) {
      toast(tr("libNoAudioFound"));
      return;
    }
    toast(tr("libImportingFolder", { n: accepted.length }));

    let imported = 0;
    for (const f of accepted) {
      try {
        // Build folder hierarchy from the relative path
        // (last segment is the file name itself).
        const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || "";
        const parts = rel ? rel.split("/").slice(0, -1) : [];
        const folderId = parts.length > 0 ? await ensureFolderPath(parts) : (selectedFolderId ?? null);

        const id = uid();
        const buf = await f.arrayBuffer();
        const isVideo = f.type.startsWith("video/") || /\.(mp4|mov|mkv|webm)$/i.test(f.name);
        let duration = 0;
        try {
          const ab = await ctx.decodeAudioData(buf.slice(0));
          duration = ab.duration;
        } catch {
          if (isVideo) {
            duration = await new Promise<number>((resolve) => {
              const v = document.createElement("video");
              v.preload = "metadata";
              v.src = URL.createObjectURL(f);
              v.onloadedmetadata = () => { resolve(v.duration || 0); URL.revokeObjectURL(v.src); };
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
          folderId,
        };
        await putTrack(rec);
        imported++;
      } catch (err) {
        console.warn("Failed to import", f.name, err);
      }
    }

    setTracks(await listTracks());
    await refreshFolders();
    toast.success(tr("libImportedFromFolder", { n: imported }));
  };

  // Aggregate tags across the library for quick chips.
  const allTags = useMemo(() => {
    const set = new Set<string>();
    tracks.forEach((t) => (t.tags ?? []).forEach((tag) => set.add(tag)));
    return [...set].sort();
  }, [tracks]);

  const filtered = tracks
    .filter((t) => {
      const q = search.toLowerCase();
      const matchesText = !q || t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q);
      const matchesFolder = selectedFolderId === null
        ? true
        : (t.folderId ?? null) === selectedFolderId;
      const bpm = t.bpm ?? 0;
      const matchesBpm = !showFilters || (bpm === 0 ? bpmMin === 0 : bpm >= bpmMin && bpm <= bpmMax);
      const matchesKey = !showFilters || !compatibleWith || (t.key && isCompatible(t.key as CamelotKey, compatibleWith as CamelotKey));
      const matchesTag = !tagFilter || (t.tags ?? []).includes(tagFilter);
      const matchesFav = !showFavOnly || !!t.favorite;
      return matchesText && matchesFolder && matchesBpm && matchesKey && matchesTag && matchesFav;
    })
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const get = (x: TrackRecord): number | string => {
        switch (sortBy) {
          case "title": return x.title.toLowerCase();
          case "artist": return (x.artist || "").toLowerCase();
          case "bpm": return x.bpm ?? -1;
          case "key": return x.key ?? "";
          case "duration": return x.duration ?? 0;
          case "added":
          default: return x.addedAt;
        }
      };
      const va = get(a); const vb = get(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });

  const rootFolders = folders.filter((f) => f.parentId === null);
  const onDropToFolder = async (trackId: string, folderId: string | null) => {
    await moveTrackToFolder(trackId, folderId);
    setTracks(await listTracks());
    toast(tr("libTrackMoved"));
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        height: "100%",
        position: "relative",
        outline: dropActive ? "2px dashed var(--accent)" : "none",
        outlineOffset: -4,
        borderRadius: 6,
        transition: "outline-color 0.15s",
      }}
      onDragEnter={(e) => {
        // Highlight only when external files are being dragged in.
        if (e.dataTransfer.types.includes("Files")) {
          dragDepthRef.current += 1;
          setDropActive(true);
        }
      }}
      onDragLeave={() => {
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) setDropActive(false);
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
        e.preventDefault();
        dragDepthRef.current = 0;
        setDropActive(false);
        void handleFiles(e.dataTransfer.files);
      }}
    >
      {dropActive && (
        <div
          style={{
            position: "absolute",
            inset: 8,
            background: "color-mix(in oklab, var(--accent) 14%, transparent)",
            border: "2px dashed var(--accent)",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--accent)",
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: "0.06em",
            pointerEvents: "none",
            zIndex: 10,
            backdropFilter: "blur(2px)",
          }}
        >
          <Upload size={18} style={{ marginRight: 8 }} /> {tr("libDropHere")}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button className="vdj-btn" onClick={() => fileRef.current?.click()}>
          <Upload size={12} /> {tr("libImport")}
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
          onClick={() => folderRef.current?.click()}
          title={tr("libImportFolderTip")}
        >
          <FolderSearch size={12} /> {tr("libImportFolder")}
        </button>
        <input
          ref={folderRef}
          type="file"
          hidden
          multiple
          // Non-standard attributes to enable directory picker
          {...({ webkitdirectory: "", directory: "", mozdirectory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
          onChange={(e) => handleFolderImport(e.target.files)}
        />
        <button
          className="vdj-btn"
          onClick={async () => {
            const n = window.prompt(tr("libNewFolderPrompt"));
            if (n) await createFolder(n, null);
          }}
          title={tr("libNewRootFolderTip")}
        >
          <FolderPlus size={12} /> {tr("libNewFolder")}
        </button>
        <div
          className="vdj-panel-inset"
          style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, padding: "6px 10px" }}
        >
          <Search size={12} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr("libSearchPlaceholder")}
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
        <span className="vdj-chip">{filtered.length} {tr("libTracksCount")}</span>
        <button
          className="vdj-btn"
          data-active={showFavOnly}
          onClick={() => setShowFavOnly((v) => !v)}
          title={tr("libFavOnlyTip")}
        >
          <Star size={12} fill={showFavOnly ? "currentColor" : "none"} />
        </button>
        <select
          className="vdj-btn"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          title={tr("libSortByTip")}
          style={{ padding: "4px 6px", fontSize: 11 }}
        >
          <option value="added">{tr("libSortRecent")}</option>
          <option value="title">{tr("libSortTitle")}</option>
          <option value="artist">{tr("libSortArtist")}</option>
          <option value="bpm">{tr("libSortBpm")}</option>
          <option value="key">{tr("libSortKey")}</option>
          <option value="duration">{tr("libSortDuration")}</option>
        </select>
        <button
          className="vdj-btn"
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          title={sortDir === "asc" ? tr("libSortAsc") : tr("libSortDesc")}
          style={{ padding: "4px 6px" }}
        >
          <ArrowUpDown size={12} />{sortDir === "asc" ? "↑" : "↓"}
        </button>
        <button
          className="vdj-btn"
          data-active={showFilters}
          onClick={() => setShowFilters((v) => !v)}
          title={tr("libFiltersTip")}
        >
          <SlidersHorizontal size={12} />
        </button>
      </div>

      {/* Smart Playlist quick presets — one click curates BPM/Key/Sort */}
      <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap", padding: "0 2px" }}>
        <span title={tr("smartPlaylistsTip")} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--text-3)", marginRight: 2 }}>
          <Sparkles size={11} /> {tr("smartPlaylists")}
        </span>
        <button className="vdj-btn" data-active={smartPreset === "warmup"} style={{ padding: "2px 8px", fontSize: 10 }} onClick={() => applySmartPreset("warmup")} title={tr("smartWarmupTip")}>{tr("smartWarmup")}</button>
        <button className="vdj-btn" data-active={smartPreset === "peak"} style={{ padding: "2px 8px", fontSize: 10 }} onClick={() => applySmartPreset("peak")} title={tr("smartPeakTip")}>{tr("smartPeak")}</button>
        <button className="vdj-btn" data-active={smartPreset === "cooldown"} style={{ padding: "2px 8px", fontSize: 10 }} onClick={() => applySmartPreset("cooldown")} title={tr("smartCooldownTip")}>{tr("smartCooldown")}</button>
        <button className="vdj-btn" data-active={smartPreset === "compat"} style={{ padding: "2px 8px", fontSize: 10 }} onClick={() => applySmartPreset("compat")} title={tr("smartCompatTip", { deck: activeDeckId })} disabled={!activeDeckBpm && !activeDeckKey}>{tr("smartCompat", { deck: activeDeckId })}</button>
        <button className="vdj-btn" data-active={smartPreset === "fresh"} style={{ padding: "2px 8px", fontSize: 10 }} onClick={() => applySmartPreset("fresh")} title={tr("smartFreshTip")}>{tr("smartFresh")}</button>
        {smartPreset && (
          <button className="vdj-btn" style={{ padding: "2px 8px", fontSize: 10, opacity: 0.7 }} onClick={() => applySmartPreset(null)}>{tr("smartClear")}</button>
        )}
      </div>

      {showFilters && (
        <div className="vdj-panel-inset" style={{ padding: 8, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", fontSize: 11 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="vdj-label">BPM</span>
            <input
              type="number"
              value={bpmMin}
              min={0}
              max={220}
              onChange={(e) => setBpmMin(parseInt(e.target.value || "0", 10))}
              style={{ width: 56, background: "var(--surface-3)", border: "1px solid var(--line)", color: "var(--text-1)", padding: "2px 4px", fontSize: 11 }}
            />
            <span style={{ color: "var(--text-3)" }}>—</span>
            <input
              type="number"
              value={bpmMax}
              min={0}
              max={220}
              onChange={(e) => setBpmMax(parseInt(e.target.value || "220", 10))}
              style={{ width: 56, background: "var(--surface-3)", border: "1px solid var(--line)", color: "var(--text-1)", padding: "2px 4px", fontSize: 11 }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="vdj-label">{tr("libCompatibleWith")}</span>
            <select
              value={compatibleWith}
              onChange={(e) => setCompatibleWith(e.target.value as CamelotKey | "")}
              style={{ background: "var(--surface-3)", border: "1px solid var(--line)", color: "var(--text-1)", padding: "2px 4px", fontSize: 11 }}
            >
              <option value="">{tr("libAnyKey")}</option>
              {["1A","1B","2A","2B","3A","3B","4A","4B","5A","5B","6A","6B","7A","7B","8A","8B","9A","9B","10A","10B","11A","11B","12A","12B"].map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
          {allTags.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
              <Tag size={11} style={{ color: "var(--text-3)" }} />
              <button className="vdj-btn" data-active={tagFilter === ""} style={{ padding: "1px 6px", fontSize: 10 }} onClick={() => setTagFilter("")}>{tr("libAllTags")}</button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  className="vdj-btn"
                  data-active={tagFilter === tag}
                  style={{ padding: "1px 6px", fontSize: 10 }}
                  onClick={() => setTagFilter(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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
            <Folder size={11} /> {tr("libAllTracks")}
            <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-3)" }}>{tracks.length}</span>
          </div>
          {rootFolders.length === 0 && (
            <div style={{ fontSize: 10, color: "var(--text-3)", padding: 6, textAlign: "center" }}>
              {tr("libCreateFoldersHint")}
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
              <th style={{ padding: 6, fontWeight: 600 }}>{tr("libColTitle")}</th>
              <th style={{ padding: 6, fontWeight: 600 }}>{tr("libColArtist")}</th>
              <th style={{ padding: 6, fontWeight: 600 }}>{tr("libColBpm")}</th>
              <th style={{ padding: 6, fontWeight: 600 }}>{tr("libColKey")}</th>
              <th style={{ padding: 6, fontWeight: 600 }}>{tr("libColTime")}</th>
              <th style={{ padding: 6, fontWeight: 600 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 12,
                      padding: "44px 16px",
                      color: "var(--text-3)",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 999,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "color-mix(in oklab, var(--accent) 12%, transparent)",
                        color: "var(--accent)",
                      }}
                    >
                      <Upload size={26} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>
                      {tracks.length === 0 ? tr("libEmptyHintTitle") : tr("libEmpty")}
                    </div>
                    {tracks.length === 0 && (
                      <div style={{ fontSize: 11, maxWidth: 380, lineHeight: 1.5 }}>
                        {tr("libEmptyHintBody")}
                      </div>
                    )}
                    {tracks.length === 0 && (
                      <button
                        className="vdj-btn"
                        style={{ marginTop: 4 }}
                        onClick={() => fileRef.current?.click()}
                      >
                        <Upload size={12} /> {tr("libImport")}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
            {filtered.map((t) => (
              <tr
                key={t.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/track-id", t.id)}
                className="vdj-row-focusable"
                tabIndex={0}
                role="row"
                aria-label={`${t.title}${t.artist ? " — " + t.artist : ""}${t.bpm ? " · " + t.bpm.toFixed(1) + " BPM" : ""}`}
                style={{ borderTop: "1px solid var(--line)", outline: "none" }}
                onDoubleClick={() => loadTrackToDeck("A", t.id)}
                onKeyDown={(e) => {
                  // Keyboard navigation:
                  //   Enter           → load on Deck A
                  //   Shift+Enter     → load on Deck B
                  //   Delete/Backspace→ remove track
                  //   ArrowDown/Up    → move focus to sibling row
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void loadTrackToDeck(e.shiftKey ? "B" : "A", t.id);
                  } else if (e.key === "Delete" || e.key === "Backspace") {
                    e.preventDefault();
                    void deleteTrack(t.id).then(async () => setTracks(await listTracks()));
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    const next = (e.currentTarget.nextElementSibling as HTMLElement | null);
                    next?.focus();
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    const prev = (e.currentTarget.previousElementSibling as HTMLElement | null);
                    prev?.focus();
                  }
                }}
              >
                <td style={{ padding: 6, color: t.kind === "video" ? "var(--accent)" : "var(--text-3)" }}>
                  {t.kind === "video" ? <Film size={12} /> : null}
                </td>
                <td style={{ padding: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 4, height: 16, background: t.color, borderRadius: 2 }} />
                    <button
                      className="vdj-btn"
                      onClick={(e) => { e.stopPropagation(); void toggleFavorite(t); }}
                      title={t.favorite ? "Quitar de favoritos" : "Marcar favorito"}
                      style={{
                        padding: "2px 4px",
                        background: "transparent",
                        border: 0,
                        color: t.favorite ? "var(--accent)" : "var(--text-3)",
                      }}
                    >
                      <Star size={11} fill={t.favorite ? "currentColor" : "none"} />
                    </button>
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
                    title={tr("libAddToRadioTip")}
                    onClick={() => radioAdd(t.id)}
                  >
                    <Radio size={10} />
                  </button>{" "}
                  {segments.length > 0 && (
                    <select
                      className="vdj-btn"
                      title={tr("libAddToSegmentTip")}
                      style={{ padding: "2px 4px", fontSize: 10, maxWidth: 100 }}
                      value=""
                      onChange={(e) => {
                        const sid = e.target.value;
                        if (!sid) return;
                        addTrackToSegment(sid, t.id);
                        const seg = segments.find((s) => s.id === sid);
                        toast(tr("libAddedToSegment", { name: seg?.name ?? "segmento" }));
                        e.target.value = "";
                      }}
                    >
                      <option value="">{tr("libAddToSegmentPlaceholder")}</option>
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