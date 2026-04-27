import { useApp } from "@/state/store";
import { Settings, Palette, HelpCircle, Disc3, Wifi, Clock, Keyboard, Info, Headphones, Sparkles, Circle, Square, Bot } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { getNextScheduledSegment, setNumpadDeck } from "@/state/controller";
import { ShortcutsOverlay } from "@/components/help/ShortcutsOverlay";
import { resolveShortcuts } from "@/lib/shortcutDefs";
import { isRecording, recordingElapsed, startRecording, stopRecording } from "@/audio/recorder";
import { ensureRunning } from "@/audio/engine";
import { listRecordings, putRecording, uid } from "@/lib/db";
import { formatTime } from "@/lib/format";
import { toast } from "sonner";
import { startVirtualDj, stopVirtualDj, isVirtualDjRunning, subscribeVdj, getVdjStatus } from "@/audio/virtualDj";

const APP_VERSION = "1.7.4";

export function TopBar() {
  const drawer = useApp((s) => s.drawer);
  const setDrawer = useApp((s) => s.setDrawer);
  const skin = useApp((s) => s.skin);
  const appName = useApp((s) => s.settings.appName);
  const djName = useApp((s) => s.settings.djName ?? "");
  const showController = useApp((s) => s.settings.showControllerInTopbar !== false);
  const midi = useApp((s) => s.midi);
  const stream = useApp((s) => s.stream);
  // Subscribe to segments so the next-segment chip refreshes on change.
  const segments = useApp((s) => s.segments);
  const radio = useApp((s) => s.radio);
  const numpadDeck = useApp((s) => s.mixer.numpadDeck);
  const enabledDecks = useApp((s) => s.settings.enabledDecks ?? 2);
  const [, tick] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const shortcutsCfg = useApp((s) => s.settings.shortcuts);
  const t = useT();

  // Live-ticking recording state (for the always-visible REC button)
  const [recOn, setRecOn] = useState<boolean>(() => isRecording());
  const [recSec, setRecSec] = useState<number>(0);
  const [recBusy, setRecBusy] = useState(false);
  const setRecordings = useApp((s) => s.setRecordings);
  const vdjEnabled = useApp((s) => s.settings.vdjEnabled === true);
  const vdjSelectedCount = useApp((s) => (s.settings.vdjSelectedTrackIds ?? []).length);
  const [vdjOn, setVdjOn] = useState<boolean>(() => isVirtualDjRunning());
  const [vdjMsg, setVdjMsg] = useState<string>(() => getVdjStatus().message);
  useEffect(() => {
    const unsub = subscribeVdj(() => {
      const st = getVdjStatus();
      setVdjOn(st.running);
      setVdjMsg(st.message);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (appName) document.title = appName;
  }, [appName]);

  // Refresh "next segment" chip every minute.
  useEffect(() => {
    const i = setInterval(() => tick((x) => x + 1), 60_000);
    return () => clearInterval(i);
  }, []);

  // Refresh REC indicator at 2 Hz so the elapsed time stays accurate even if
  // the user starts/stops recording from another panel (e.g. RecorderPanel).
  useEffect(() => {
    const i = setInterval(() => {
      const on = isRecording();
      setRecOn(on);
      setRecSec(on ? recordingElapsed() : 0);
    }, 500);
    return () => clearInterval(i);
  }, []);

  async function toggleRecord() {
    if (recBusy) return;
    setRecBusy(true);
    try {
      await ensureRunning();
      if (isRecording()) {
        const r = await stopRecording();
        if (r) {
          await putRecording({
            id: uid(),
            name: t("recSessionName", { date: new Date().toLocaleString() }),
            blob: r.blob,
            mime: r.mime,
            duration: r.duration,
            createdAt: Date.now(),
          });
          setRecordings(await listRecordings());
          toast.success(t("recStopped"));
        }
        setRecOn(false);
      } else {
        await startRecording();
        setRecOn(true);
        toast(t("recStarted"));
      }
    } catch (err) {
      toast.error((err as Error)?.message ?? "Error");
    } finally {
      setRecBusy(false);
    }
  }

  // Configurable "show shortcuts" hotkey (default Shift+/ = "?").
  useEffect(() => {
    const map = resolveShortcuts(shortcutsCfg);
    const code = map.showShortcuts;
    if (!code) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if ((window as unknown as { __vdjShortcutCapturing?: boolean }).__vdjShortcutCapturing) return;
      if (e.code !== code) return;
      // If the def requires Shift, enforce it.
      const needsShift = code === "Slash"; // default "?" requires shift
      if (needsShift && !e.shiftKey) return;
      e.preventDefault();
      setShowShortcuts((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcutsCfg]);

  const next = radio.enabled ? getNextScheduledSegment() : null;
  void segments;

  const liveBytes = stream.bytesSent;
  const liveKb = liveBytes > 1024 * 1024 ? `${(liveBytes / 1024 / 1024).toFixed(1)}MB` : `${(liveBytes / 1024).toFixed(0)}KB`;

  return (
    <div
      className="vdj-panel"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 14px",
        borderRadius: 0,
        borderLeft: 0,
        borderRight: 0,
        borderTop: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Disc3 size={20} style={{ color: "var(--accent)" }} />
        <div style={{ fontWeight: 800, letterSpacing: "0.18em", fontSize: 13, textTransform: "uppercase" }}>
          {appName || "VDJ PRO"}
        </div>
        <span className="vdj-chip" style={{ marginLeft: 8 }}>{t("skinLabel")} · {skin}</span>
        <span
          className="vdj-chip"
          title={t("aboutVersion") + " " + APP_VERSION}
          style={{
            fontVariantNumeric: "tabular-nums",
            background: "linear-gradient(90deg, var(--accent), var(--accent-2, var(--accent)))",
            color: "#0b0b0b",
            fontWeight: 800,
            letterSpacing: "0.06em",
          }}
        >
          v{APP_VERSION}
        </span>
        {djName.trim() && (
          <span
            className="vdj-loaded-badge"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: "linear-gradient(90deg, var(--accent), var(--accent-2, var(--accent)))",
              color: "var(--bg-1, #000)",
              backgroundSize: "200% 100%",
              animation: "vdj-dj-shimmer 3.5s linear infinite",
              fontWeight: 800,
              letterSpacing: "0.08em",
            }}
            title={t("djNameLabel")}
          >
            <Sparkles size={11} /> {djName}
          </span>
        )}
        {showController && (
          <span
            className="vdj-chip"
            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            title={t("controllerChipTitle")}
          >
            <Headphones size={11} />
            {(() => {
              const ins = midi.enabledInputIds ?? [];
              if (midi.enabled && ins.length > 0) return `${ins.length} MIDI`;
              return t("controllerNone");
            })()}
          </span>
        )}
        {stream.status === "live" && (
          <span
            className="vdj-loaded-badge"
            data-tone="live"
            style={{ display: "inline-flex", alignItems: "center", gap: 4, animation: "vdj-pulse 1.2s infinite" }}
            title={t("streamingTooltip", { x: liveKb })}
          >
            <Wifi size={11} /> {t("onAir")} · {liveKb}
          </span>
        )}
        {stream.status === "connecting" && (
          <span className="vdj-chip" style={{ display: "inline-flex", alignItems: "center", gap: 4 }} title={stream.lastError ?? t("connecting")}>
            <Wifi size={11} /> {t("connecting")}
          </span>
        )}
        {next && (
          <span
            className="vdj-chip"
            title={t("nextSegmentTooltip", { name: next.segment.name })}
            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <Clock size={11} />
            <span style={{ width: 8, height: 8, borderRadius: 2, background: next.segment.color }} />
            {next.segment.name} · {formatMinutes(next.minutesUntil, t)}
          </span>
        )}
      </div>
      {/* Always-visible Numpad target selector (mirrors the one in Recorder tab) */}
      <div
        className="vdj-panel-inset"
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px" }}
        title={t("numpadTip")}
      >
        <Keyboard size={12} />
        <span className="vdj-label">{t("numpadArrow")}</span>
        {(enabledDecks === 4 ? (["A", "B", "C", "D"] as const) : (["A", "B"] as const)).map((d) => (
          <button
            key={d}
            className="vdj-btn"
            data-active={numpadDeck === d}
            style={{ padding: "2px 8px", minWidth: 24 }}
            onClick={() => setNumpadDeck(d)}
          >
            {d}
          </button>
        ))}
        <span className="vdj-label" style={{ opacity: 0.7 }}>{t("numpadBacktickHint")}</span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {vdjEnabled && (
          <button
            className="vdj-btn"
            data-active={vdjOn}
            onClick={async () => {
              if (vdjOn) stopVirtualDj();
              else await startVirtualDj();
            }}
            title={vdjOn ? `Detener Virtual DJ — ${vdjMsg}` : `Iniciar Virtual DJ (${vdjSelectedCount} pistas)`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 700,
              color: vdjOn ? "#0b0b0b" : undefined,
              background: vdjOn
                ? "linear-gradient(90deg, var(--accent), var(--accent-2, var(--accent)))"
                : undefined,
              animation: vdjOn ? "vdj-pulse 1.2s infinite" : undefined,
              maxWidth: 220,
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
            }}
          >
            <Bot size={12} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {vdjOn ? `VDJ · ${vdjMsg}` : `VDJ (${vdjSelectedCount})`}
            </span>
          </button>
        )}
        <button
          className="vdj-btn"
          onClick={toggleRecord}
          disabled={recBusy}
          data-active={recOn}
          title={recOn ? t("recBtnStopSession") : t("recBtnStartSession")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontWeight: 700,
            color: recOn ? "#fff" : undefined,
            background: recOn
              ? "linear-gradient(90deg, #e11d48, #b91c1c)"
              : undefined,
            borderColor: recOn ? "#b91c1c" : undefined,
            animation: recOn ? "vdj-pulse 1.2s infinite" : undefined,
          }}
        >
          {recOn ? <Square size={12} /> : <Circle size={12} fill="currentColor" />}
          {recOn ? `REC ${formatTime(recSec)}` : "REC"}
        </button>
        <button className="vdj-btn" onClick={() => setShowShortcuts(true)} title={t("shortcutsBtnTitle")}>
          <Keyboard size={12} /> ?
        </button>
        <button className="vdj-btn" data-active={drawer === "skins"} onClick={() => setDrawer(drawer === "skins" ? null : "skins")}>
          <Palette size={12} /> {t("skins")}
        </button>
        <button className="vdj-btn" data-active={drawer === "settings"} onClick={() => setDrawer(drawer === "settings" ? null : "settings")}>
          <Settings size={12} /> {t("settings")}
        </button>
        <button className="vdj-btn" data-active={drawer === "help"} onClick={() => setDrawer(drawer === "help" ? null : "help")}>
          <HelpCircle size={12} /> {t("help")}
        </button>
        <button className="vdj-btn" data-active={drawer === "about"} onClick={() => setDrawer(drawer === "about" ? null : "about")} title={t("about")}>
          <Info size={12} /> {t("about")}
        </button>
      </div>
      {showShortcuts && <ShortcutsOverlay onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}

function formatMinutes(min: number, t: (k: import("@/lib/i18n").DictKey) => string): string {
  if (min < 1) return t("nowShort");
  if (min < 60) return `${Math.round(min)}${t("minutesShort")}`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h}${t("hoursShort")} ${m}${t("minutesShort")}` : `${h}${t("hoursShort")}`;
}