import { Download } from "lucide-react";
import { downloadHelpPdf } from "@/lib/helpPdf";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

export function HelpPanel() {
  const t = useT();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 12, lineHeight: 1.6, color: "var(--text-2)" }}>
      <button
        className="vdj-btn"
        data-tone="live"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "8px 12px" }}
        onClick={() => {
          try {
            downloadHelpPdf();
            toast(t("pdfDownloaded"));
          } catch (e) {
            console.error(e);
            toast(t("pdfFailed"));
          }
        }}
      >
        <Download size={14} /> {t("downloadPdf")}
      </button>

      <h3 style={{ color: "var(--text-1)", margin: 0, fontSize: 14 }}>{t("quickStart")}</h3>
      <ol style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
        <li>{t("qs1")}</li>
        <li>{t("qs2")}</li>
        <li>{t("qs3")}</li>
        <li>{t("qs4")}</li>
        <li>{t("qs5")}</li>
        <li>{t("qs6")}</li>
        <li>{t("qs7")}</li>
      </ol>

      <h3 style={{ color: "var(--text-1)", margin: 0, fontSize: 14 }}>{t("proFeatures")}</h3>
      <ul style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
        <li>{t("pf1")}</li>
        <li>{t("pf2")}</li>
        <li>{t("pf3")}</li>
        <li>{t("pf4")}</li>
        <li>{t("pf5")}</li>
        <li>{t("pf6")}</li>
        <li>{t("pf7")}</li>
        <li>{t("pf8")}</li>
        <li>{t("pf9")}</li>
        <li>{t("pf10")}</li>
        <li>{t("pf11")}</li>
        <li>{t("pf12")}</li>
      </ul>

      <h3 style={{ color: "var(--text-1)", margin: 0, fontSize: 14 }}>{t("keyboardShortcuts")}</h3>
      <ul style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4, fontFamily: "var(--font-mono)", fontSize: 11 }}>
        <li>{t("ks1")}</li>
        <li>{t("ks2")}</li>
        <li>{t("ks3")}</li>
        <li>{t("ks4")}</li>
        <li>{t("ks5")}</li>
        <li>{t("ks6")}</li>
        <li>{t("ks7")}</li>
      </ul>

      <h3 style={{ color: "var(--text-1)", margin: 0, fontSize: 14 }}>{t("numpad")}</h3>
      <ul style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4, fontFamily: "var(--font-mono)", fontSize: 11 }}>
        <li>{t("np1")}</li>
        <li>{t("np2")}</li>
        <li>{t("np3")}</li>
        <li>{t("np4")}</li>
        <li>{t("np5")}</li>
        <li>{t("np6")}</li>
      </ul>

      <h3 style={{ color: "var(--text-1)", margin: 0, fontSize: 14 }}>{t("radioMode")}</h3>
      <ul style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
        <li>{t("rm1")}</li>
        <li>{t("rm2")}</li>
        <li>{t("rm3")}</li>
        <li>{t("rm4")}</li>
      </ul>

      <h3 style={{ color: "var(--text-1)", margin: 0, fontSize: 14 }}>{t("voiceOver")}</h3>
      <ul style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4, fontFamily: "var(--font-mono)", fontSize: 11 }}>
        <li>{t("vo1")}</li>
        <li>{t("vo2")}</li>
      </ul>

      <h3 style={{ color: "var(--text-1)", margin: 0, fontSize: 14 }}>{t("aboutEngine")}</h3>
      <p>{t("aboutEngineBody")}</p>
    </div>
  );
}