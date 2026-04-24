import { useRef } from "react";
import { Cloud, Upload, Download } from "lucide-react";
import { downloadSyncBackup, importSyncBackup } from "@/lib/cloudSync";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";

export function CloudSyncPanel() {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, opacity: 0.9 }}>
        <Cloud size={14} /> {t("cloudSync")}
      </div>
      <div style={{ fontSize: 11, opacity: 0.7, lineHeight: 1.4 }}>{t("cloudSyncHint")}</div>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          className="vdj-btn"
          style={{ flex: 1, padding: "6px 8px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          onClick={() => {
            downloadSyncBackup();
            toast.success(t("cloudExportOk"));
          }}
        >
          <Download size={12} /> {t("cloudExport")}
        </button>
        <button
          className="vdj-btn"
          style={{ flex: 1, padding: "6px 8px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={12} /> {t("cloudImport")}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const ok = await importSyncBackup(f);
            if (ok) toast.success(t("cloudImportOk"));
            else toast.error(t("cloudImportFail"));
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}