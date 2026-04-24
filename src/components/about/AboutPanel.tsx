import { Info, Code2, Headphones, Globe, Heart, BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "@/state/store";
import { useT } from "@/lib/i18n";
import { getSessionStats, resetSessionStats } from "@/state/controller";
import { toast } from "sonner";

const APP_VERSION = "1.4.0";

export function AboutPanel() {
  const t = useT();
  const appName = useApp((s) => s.settings.appName) || "VDJ PRO";
  const tracks = useApp((s) => s.tracks);
  const recordings = useApp((s) => s.recordings);
  const [, tick] = useState(0);

  // Refresh metrics every 5s while panel is open
  useEffect(() => {
    const i = setInterval(() => tick((x) => x + 1), 5000);
    return () => clearInterval(i);
  }, []);

  const stats = getSessionStats();
  const mins = Math.floor(stats.totalSeconds / 60);
  const hrs = Math.floor(mins / 60);
  const mixTime = hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m ${Math.floor(stats.totalSeconds % 60)}s`;

  const playedIds = new Set(stats.topTracks.map((x) => x.trackId));
  const bpms = tracks.filter((t) => playedIds.has(t.id) && t.bpm).map((t) => t.bpm as number);
  const avgBpm = bpms.length > 0 ? Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 12, lineHeight: 1.6, color: "var(--text-2)" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 8px", background: "var(--panel-2)", borderRadius: 10, border: "1px solid var(--border)" }}>
        <Headphones size={36} style={{ color: "var(--accent)" }} />
        <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-1)", letterSpacing: 1 }}>{appName}</div>
        <div style={{ fontSize: 11, opacity: 0.7 }}>{t("aboutVersion")} {APP_VERSION}</div>
      </div>

      <Section icon={<BarChart3 size={14} />} title={t("sessionMetrics")}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <Metric label={t("sessionMetricsTime")} value={mixTime} />
          <Metric label={t("sessionMetricsTracks")} value={String(stats.tracksPlayed)} />
          <Metric label={t("sessionMetricsRecordings")} value={String(recordings.length)} />
          <Metric label={t("sessionMetricsAvgBpm")} value={avgBpm > 0 ? String(avgBpm) : "—"} />
        </div>
        {stats.topTracks.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 4 }}>{t("sessionMetricsTopTracks")}</div>
            <ol style={{ paddingLeft: 18, margin: 0, fontSize: 11 }}>
              {stats.topTracks.slice(0, 5).map((tt) => {
                const tr = tracks.find((x) => x.id === tt.trackId);
                return <li key={tt.trackId}>{tr?.title ?? tt.trackId.slice(0, 8)} · ×{tt.count}</li>;
              })}
            </ol>
          </div>
        )}
        <button
          className="vdj-btn"
          style={{ marginTop: 8, padding: "4px 8px", fontSize: 11 }}
          onClick={() => { resetSessionStats(); toast.success(t("sessionMetricsResetOk")); tick((x) => x + 1); }}
        >
          {t("sessionMetricsReset")}
        </button>
      </Section>

      <Section icon={<Info size={14} />} title={t("aboutWhatIs")}>
        <p>{t("aboutDescription")}</p>
      </Section>

      <Section icon={<Code2 size={14} />} title={t("aboutDeveloper")}>
        <p>{t("aboutDeveloperBody")}</p>
        <ul style={{ paddingLeft: 18, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          <li>{t("aboutTechStack")}</li>
          <li>{t("aboutBuiltWith")}</li>
        </ul>
      </Section>

      <Section icon={<Heart size={14} />} title={t("aboutCredits")}>
        <p>{t("aboutCreditsBody")}</p>
      </Section>

      <Section icon={<Globe size={14} />} title={t("aboutLicense")}>
        <p>{t("aboutLicenseBody")}</p>
      </Section>

      <div style={{ fontSize: 10, textAlign: "center", color: "var(--text-3)", marginTop: 4 }}>
        © {new Date().getFullYear()} {appName} · {t("aboutAllRights")}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--panel-2)", borderRadius: 6, padding: "6px 8px", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 9, opacity: 0.65, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)", fontFamily: "var(--font-mono)" }}>{value}</div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <h3 style={{ margin: 0, fontSize: 13, color: "var(--text-1)", display: "flex", alignItems: "center", gap: 6 }}>
        {icon}{title}
      </h3>
      <div>{children}</div>
    </div>
  );
}
