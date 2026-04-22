import { Info, Code2, Headphones, Globe, Heart } from "lucide-react";
import { useApp } from "@/state/store";
import { useT } from "@/lib/i18n";

const APP_VERSION = "1.0.0";

export function AboutPanel() {
  const t = useT();
  const appName = useApp((s) => s.settings.appName) || "VDJ PRO";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 12, lineHeight: 1.6, color: "var(--text-2)" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 8px", background: "var(--panel-2)", borderRadius: 10, border: "1px solid var(--border)" }}>
        <Headphones size={36} style={{ color: "var(--accent)" }} />
        <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-1)", letterSpacing: 1 }}>{appName}</div>
        <div style={{ fontSize: 11, opacity: 0.7 }}>{t("aboutVersion")} {APP_VERSION}</div>
      </div>

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
