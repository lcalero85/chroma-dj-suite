import { useApp } from "@/state/store";
import {
  radioEnable, radioRemove, radioMove, radioClear, radioPlayIndex, radioNext,
  createSegment, renameSegment, deleteSegment, addTrackToSegment, removeTrackFromSegment,
  setSegmentSchedule, loadSegmentToRadio,
  startLiveStream, stopLiveStream,
} from "@/state/controller";
import {
  Radio, Play, SkipForward, Trash2, ChevronUp, ChevronDown, Shuffle, Power,
  Plus, Pencil, Clock, ListMusic, Wifi, WifiOff, Disc3, X, Search,
} from "lucide-react";
import { formatTime } from "@/lib/format";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";

type Tab = "queue" | "segments" | "live";

export function RadioPanel() {
  const t = useT();
  const radio = useApp((s) => s.radio);
  const tracks = useApp((s) => s.tracks);
  const updateRadio = useApp((s) => s.updateRadio);
  const segments = useApp((s) => s.segments);
  const stream = useApp((s) => s.stream);
  const [tab, setTab] = useState<Tab>("queue");
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const trackById = (id: string) => tracks.find((t) => t.id === id);
  const activeSegment = segments.find((s) => s.id === activeSegmentId) ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 4 }}>
        <button className="vdj-btn" data-active={tab === "queue"} onClick={() => setTab("queue")}>
          <ListMusic size={12} style={{ marginRight: 4 }} /> {t("radioTabQueue")}
        </button>
        <button className="vdj-btn" data-active={tab === "segments"} onClick={() => setTab("segments")}>
          <Disc3 size={12} style={{ marginRight: 4 }} /> {t("radioTabSegments")}
          <span className="vdj-chip" style={{ marginLeft: 6 }}>{segments.length}</span>
        </button>
        <button
          className="vdj-btn"
          data-active={tab === "live"}
          data-tone={stream.status === "live" ? "live" : undefined}
          onClick={() => setTab("live")}
        >
          {stream.status === "live" ? <Wifi size={12} style={{ marginRight: 4 }} /> : <WifiOff size={12} style={{ marginRight: 4 }} />}
          {t("radioTabLive")}
          {stream.status === "live" && <span className="vdj-loaded-badge" data-tone="live" style={{ marginLeft: 6 }}>● {t("onAir")}</span>}
        </button>
      </div>

      {tab === "queue" && (
        <QueueView
          radio={radio}
          updateRadio={updateRadio}
          trackById={trackById}
        />
      )}

      {tab === "segments" && (
        <SegmentsView
          segments={segments}
          activeSegment={activeSegment}
          setActiveSegmentId={setActiveSegmentId}
          tracks={tracks}
        />
      )}

      {tab === "live" && <LiveView />}
    </div>
  );
}

function QueueView({
  radio,
  updateRadio,
  trackById,
}: {
  radio: ReturnType<typeof useApp.getState>["radio"];
  updateRadio: ReturnType<typeof useApp.getState>["updateRadio"];
  trackById: (id: string) => ReturnType<typeof useApp.getState>["tracks"][number] | undefined;
}) {
  const tr = useT();
  return (
    <>
      {/* Controls */}
      <div className="vdj-panel-inset" style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, flexWrap: "wrap" }}>
        <button
          className="vdj-btn"
          data-active={radio.enabled}
          data-tone={radio.enabled ? "live" : undefined}
          onClick={() => radioEnable(!radio.enabled)}
          style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 130, minHeight: 38, justifyContent: "center", fontWeight: 800, letterSpacing: "0.08em" }}
        >
          <Radio size={14} />
          {radio.enabled ? tr("radioOn") : tr("radioOff")}
        </button>

        {radio.enabled && (
          <span className="vdj-loaded-badge" data-tone="live" style={{ animation: "vdj-pulse 1.2s infinite" }}>{tr("radioBroadcasting")}</span>
        )}

        <button
          className="vdj-btn"
          onClick={() => void radioNext()}
          disabled={radio.queue.length === 0}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
          title={tr("radioNextTip")}
        >
          <SkipForward size={12} /> {tr("radioNext")}
        </button>

        <button
          className="vdj-btn"
          data-active={radio.shuffle}
          onClick={() => updateRadio({ shuffle: !radio.shuffle })}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <Shuffle size={12} /> {tr("radioShuffle")}
        </button>

        <button
          className="vdj-btn"
          data-active={radio.autoCrossfade}
          onClick={() => updateRadio({ autoCrossfade: !radio.autoCrossfade })}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
          title={tr("radioAutoMixTip")}
        >
          <Power size={12} /> {tr("radioAutoMix")}
        </button>

        <span className="vdj-chip" style={{ marginLeft: "auto" }}>
          {tr("radioInQueueDeckA", { n: radio.queue.length })}
        </span>

        {radio.queue.length > 0 && (
          <button
            className="vdj-btn"
            onClick={() => {
              radioClear();
              toast(tr("radioQueueClearedToast"));
            }}
            style={{ display: "flex", alignItems: "center", gap: 4 }}
          >
            <Trash2 size={12} /> {tr("radioClear")}
          </button>
        )}
      </div>

      {/* Queue */}
      <div className="vdj-panel-inset vdj-scroll" style={{ flex: 1, overflow: "auto", padding: 6 }}>
        {radio.queue.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>
            {tr("radioEmptyQueue")}
          </div>
        )}
        {radio.queue.map((tid, idx) => {
          const t = trackById(tid);
          const playing = idx === radio.currentIndex;
          return (
            <div
              key={tid + idx}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                borderTop: "1px solid var(--line)",
                background: playing ? "color-mix(in oklab, var(--accent) 12%, transparent)" : undefined,
              }}
            >
              <span className="vdj-readout" style={{ minWidth: 28, textAlign: "right", color: playing ? "var(--accent)" : "var(--text-3)" }}>
                {playing ? "▶" : String(idx + 1).padStart(2, "0")}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {t?.title ?? tr("radioDeletedTrack")}
                </div>
                <div className="vdj-label">
                  {t?.artist || "—"} · {t ? formatTime(t.duration) : "0:00"} {t?.bpm ? `· ${t.bpm.toFixed(0)} BPM` : ""}
                </div>
              </div>
              <button className="vdj-btn" style={{ padding: "2px 6px" }} onClick={() => void radioPlayIndex(idx)} title={tr("radioPlayThis")}>
                <Play size={10} />
              </button>
              <button className="vdj-btn" style={{ padding: "2px 6px" }} onClick={() => radioMove(idx, -1)} disabled={idx === 0}>
                <ChevronUp size={10} />
              </button>
              <button className="vdj-btn" style={{ padding: "2px 6px" }} onClick={() => radioMove(idx, 1)} disabled={idx === radio.queue.length - 1}>
                <ChevronDown size={10} />
              </button>
              <button className="vdj-btn" style={{ padding: "2px 6px" }} onClick={() => radioRemove(idx)}>
                <Trash2 size={10} />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

function SegmentsView({
  segments,
  activeSegment,
  setActiveSegmentId,
  tracks,
}: {
  segments: ReturnType<typeof useApp.getState>["segments"];
  activeSegment: ReturnType<typeof useApp.getState>["segments"][number] | null;
  setActiveSegmentId: (id: string | null) => void;
  tracks: ReturnType<typeof useApp.getState>["tracks"];
}) {
  const tr = useT();
  const trackById = (id: string) => tracks.find((t) => t.id === id);
  return (
    <div style={{ display: "flex", gap: 8, flex: 1, minHeight: 0 }}>
      {/* Segment list */}
      <div className="vdj-panel-inset vdj-scroll" style={{ width: 220, padding: 6, overflow: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
        <button
          className="vdj-btn"
          onClick={() => {
            const n = window.prompt(tr("radioNewSegmentPrompt"));
            if (!n) return;
            const s = createSegment(n);
            setActiveSegmentId(s.id);
          }}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontWeight: 700 }}
        >
          <Plus size={12} /> {tr("radioNewSegment")}
        </button>
        {segments.length === 0 && (
          <div style={{ fontSize: 10, color: "var(--text-3)", padding: 12, textAlign: "center" }}>
            {tr("radioCreateSegmentHint")}
          </div>
        )}
        {segments.map((s) => (
          <div
            key={s.id}
            onClick={() => setActiveSegmentId(s.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const tid = e.dataTransfer.getData("text/track-id");
              if (tid) addTrackToSegment(s.id, tid);
            }}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "6px 8px",
              cursor: "pointer", borderRadius: 4, fontSize: 11,
              background: activeSegment?.id === s.id ? "color-mix(in oklab, var(--accent) 18%, transparent)" : "transparent",
              border: `1px solid ${activeSegment?.id === s.id ? "var(--accent)" : "var(--line)"}`,
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
            <span className="vdj-chip">{s.trackIds.length}</span>
            {s.scheduledAt && <span className="vdj-chip" data-tone="live"><Clock size={9} style={{ marginRight: 2 }} />{s.scheduledAt}</span>}
          </div>
        ))}
      </div>

      {/* Segment detail */}
      <div className="vdj-panel-inset vdj-scroll" style={{ flex: 1, padding: 8, overflow: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        {!activeSegment && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>
            {tr("radioSelectOrCreate")}
          </div>
        )}
        {activeSegment && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ width: 14, height: 14, borderRadius: 3, background: activeSegment.color }} />
              <input
                value={activeSegment.name}
                onChange={(e) => renameSegment(activeSegment.id, e.target.value)}
                className="vdj-btn"
                style={{ padding: "4px 8px", fontWeight: 700, minWidth: 160 }}
              />
              <button
                className="vdj-btn"
                onClick={() => void loadSegmentToRadio(activeSegment.id, "replace")}
                title={tr("radioLoadToQueueTip")}
              >
                <Play size={11} /> {tr("radioLoadToQueue")}
              </button>
              <button
                className="vdj-btn"
                onClick={() => void loadSegmentToRadio(activeSegment.id, "append")}
                title={tr("radioAppendTip")}
              >
                <Plus size={11} /> {tr("radioAppend")}
              </button>
              <button
                className="vdj-btn"
                onClick={() => {
                  if (confirm(tr("radioDeleteSegmentConfirm", { name: activeSegment.name }))) {
                    deleteSegment(activeSegment.id);
                    setActiveSegmentId(null);
                  }
                }}
              >
                <Trash2 size={11} />
              </button>
            </div>

            <div className="vdj-panel-inset" style={{ padding: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span className="vdj-label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Clock size={11} /> {tr("radioSchedule")}
              </span>
              <input
                type="time"
                className="vdj-btn"
                value={activeSegment.scheduledAt ?? ""}
                onChange={(e) => setSegmentSchedule(activeSegment.id, e.target.value || null, activeSegment.recurring ?? true)}
                style={{ padding: "4px 8px" }}
              />
              <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="checkbox"
                  checked={activeSegment.recurring ?? true}
                  onChange={(e) => setSegmentSchedule(activeSegment.id, activeSegment.scheduledAt ?? null, e.target.checked)}
                />
                {tr("radioDaily")}
              </label>
              {activeSegment.scheduledAt && (
                <button className="vdj-btn" onClick={() => setSegmentSchedule(activeSegment.id, null, activeSegment.recurring ?? true)}>
                  <X size={10} /> {tr("radioRemove")}
                </button>
              )}
              <span className="vdj-label" style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-3)" }}>
                {tr("radioOnlyIfRadioOn")}
              </span>
            </div>

            <div
              className="vdj-panel-inset"
              style={{ flex: 1, padding: 6, overflow: "auto" }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const tid = e.dataTransfer.getData("text/track-id");
                if (tid) addTrackToSegment(activeSegment.id, tid);
              }}
            >
              {activeSegment.trackIds.length === 0 && (
                <div style={{ padding: 16, textAlign: "center", color: "var(--text-3)", fontSize: 11 }}>
                  {tr("radioSegmentEmpty")}
                </div>
              )}
              {activeSegment.trackIds.map((tid, idx) => {
                const t = trackById(tid);
                return (
                  <div key={tid + idx} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", borderTop: "1px solid var(--line)" }}>
                    <span className="vdj-readout" style={{ minWidth: 24, textAlign: "right", color: "var(--text-3)" }}>{String(idx + 1).padStart(2, "0")}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t?.title ?? tr("radioDeletedTrack")}</div>
                      <div className="vdj-label">{t?.artist || "—"} · {t ? formatTime(t.duration) : "0:00"}</div>
                    </div>
                    <button className="vdj-btn" style={{ padding: "2px 6px" }} onClick={() => removeTrackFromSegment(activeSegment.id, tid)}>
                      <Trash2 size={10} />
                    </button>
                  </div>
                );
              })}
            </div>

            <TrackPicker segmentId={activeSegment.id} excludeIds={activeSegment.trackIds} tracks={tracks} />
          </>
        )}
      </div>
    </div>
  );
}

function TrackPicker({
  segmentId,
  excludeIds,
  tracks,
}: {
  segmentId: string;
  excludeIds: string[];
  tracks: ReturnType<typeof useApp.getState>["tracks"];
}) {
  const tr = useT();
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const ex = new Set(excludeIds);
    const ql = q.toLowerCase().trim();
    return tracks
      .filter((t) => !ex.has(t.id))
      .filter((t) => !ql || t.title.toLowerCase().includes(ql) || t.artist.toLowerCase().includes(ql))
      .slice(0, 50);
  }, [tracks, excludeIds, q]);

  return (
    <div className="vdj-panel-inset" style={{ padding: 6, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Search size={11} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tr("radioPickerPlaceholder")}
          style={{ flex: 1, background: "transparent", border: 0, color: "var(--text-1)", outline: "none", fontSize: 12 }}
        />
        <span className="vdj-chip">{filtered.length}</span>
      </div>
      {q && (
        <div style={{ maxHeight: 180, overflow: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          {filtered.length === 0 && (
            <div style={{ padding: 8, fontSize: 10, color: "var(--text-3)", textAlign: "center" }}>{tr("radioPickerNoResults")}</div>
          )}
          {filtered.map((t) => (
            <button
              key={t.id}
              className="vdj-btn"
              onClick={() => {
                addTrackToSegment(segmentId, t.id);
                toast(`+ ${t.title}`);
              }}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 6px", justifyContent: "flex-start" }}
            >
              <Plus size={10} />
              <span style={{ flex: 1, fontSize: 11, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {t.title} <span style={{ color: "var(--text-3)" }}>— {t.artist || "—"}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LiveView() {
  const tr = useT();
  const fmt = useFormatNumber();
  const stream = useApp((s) => s.stream);
  const setDrawer = useApp((s) => s.setDrawer);
  const kb = (n: number) => fmt(n / 1024, { maximumFractionDigits: 1 }) + " KB";
  const mb = (n: number) => fmt(n / 1024 / 1024, { maximumFractionDigits: 2 }) + " MB";
  const elapsed = stream.startedAt ? Math.floor((Date.now() - stream.startedAt) / 1000) : 0;
  const hh = String(Math.floor(elapsed / 3600)).padStart(2, "0");
  const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 4 }}>
      <div className="vdj-panel-inset" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {stream.status === "live" ? (
            <button
              className="vdj-btn"
              data-tone="live"
              onClick={() => void stopLiveStream()}
              style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 160, minHeight: 44, justifyContent: "center", fontWeight: 800 }}
            >
              <WifiOff size={16} /> {tr("streamStopLiveBtn")}
            </button>
          ) : (
            <button
              className="vdj-btn"
              data-active={stream.status === "connecting"}
              disabled={!stream.enabled || stream.status === "connecting"}
              onClick={() => void startLiveStream()}
              style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 160, minHeight: 44, justifyContent: "center", fontWeight: 800 }}
            >
              <Wifi size={16} /> {stream.status === "connecting" ? tr("streamConnecting") : tr("streamStartLiveBtn")}
            </button>
          )}
          <button className="vdj-btn" onClick={() => setDrawer("settings")} title={tr("settings")}>
            <Pencil size={11} /> {tr("streamConfigureBtn")}
          </button>
          {!stream.enabled && (
            <span className="vdj-chip" style={{ color: "var(--warning, #ffb000)" }}>
              {tr("streamWarnEnable")}
            </span>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          <Stat label={tr("streamStatus")} value={stream.status.toUpperCase()} tone={stream.status === "live" ? "live" : stream.status === "error" ? "warn" : undefined} />
          <Stat label={tr("streamServer")} value={stream.serverUrl ? new URL(stream.serverUrl).host : "—"} />
          <Stat label={tr("streamMountLbl")} value={stream.mount || "—"} />
          <Stat label={tr("streamBitrateLbl")} value={`${stream.bitrate} kbps`} />
          <Stat label={tr("streamElapsed")} value={`${hh}:${mm}:${ss}`} />
          <Stat label={tr("streamSent")} value={stream.bytesSent < 1024 * 1024 ? kb(stream.bytesSent) : mb(stream.bytesSent)} />
        </div>

        {stream.lastError && (
          <div style={{ fontSize: 11, color: "var(--danger, #ff3b6b)", padding: "6px 8px", border: "1px solid var(--danger, #ff3b6b)", borderRadius: 4 }}>
            {stream.lastError}
          </div>
        )}

        <div className="vdj-label" style={{ fontSize: 10, color: "var(--text-3)", lineHeight: 1.5 }}>
          {tr("streamHelpFooter")}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "live" | "warn" }) {
  return (
    <div className="vdj-panel-inset" style={{ padding: 8 }}>
      <div className="vdj-label" style={{ fontSize: 9 }}>{label}</div>
      <div className="vdj-readout" style={{ fontSize: 14, color: tone === "live" ? "var(--accent)" : tone === "warn" ? "var(--warning, #ffb000)" : undefined }}>
        {value}
      </div>
    </div>
  );
}
