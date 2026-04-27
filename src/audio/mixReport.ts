/**
 * Virtual DJ — Mix Report PDF generator.
 *
 * Recopila tracks reproducidos, transiciones, BPM/key, FX usados, energy
 * curve y duración total y produce un PDF descargable al finalizar la sesión.
 */
import jsPDF from "jspdf";
import type { TrackRecord } from "@/lib/db";

export interface MixReportEntry {
  index: number;
  title: string;
  artist: string;
  bpm: number | null;
  key: string | null;
  startSec: number;
  /** Style of transition INTO this track (e.g., "Crossfade", "Echo-Freeze",
   *  "Mash-up", "Battle"). */
  transitionInto?: string;
  /** Energy estimate (0..1) at this track's peak. */
  energy?: number;
}

export interface MixReportData {
  djName: string;
  sessionName: string;
  startedAt: number;
  endedAt: number;
  totalSec: number;
  entries: MixReportEntry[];
  energyCurve: number[]; // 0..1 samples across the set
  fxUsed: Record<string, number>;
}

function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
    : `${m}:${String(ss).padStart(2, "0")}`;
}

/** Generate and trigger download of the Mix Report PDF. Returns the filename. */
export function generateMixReport(data: MixReportData): string {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("VDJ PRO — Mix Report", margin, y);
  y += 26;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110);
  const startedStr = new Date(data.startedAt).toLocaleString();
  const endedStr = new Date(data.endedAt).toLocaleString();
  doc.text(`DJ: ${data.djName || "—"}    Session: ${data.sessionName || "—"}`, margin, y); y += 14;
  doc.text(`Started: ${startedStr}    Ended: ${endedStr}    Total: ${fmtTime(data.totalSec)}`, margin, y); y += 14;
  doc.text(`Tracks played: ${data.entries.length}`, margin, y); y += 20;

  // Energy curve graph
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Energy curve", margin, y); y += 8;
  const graphW = W - margin * 2;
  const graphH = 70;
  doc.setDrawColor(180);
  doc.rect(margin, y, graphW, graphH);
  if (data.energyCurve.length > 1) {
    doc.setDrawColor(40, 130, 230);
    doc.setLineWidth(1.2);
    const n = data.energyCurve.length;
    const stepX = graphW / (n - 1);
    let prevX = margin;
    let prevY = y + graphH - data.energyCurve[0] * graphH;
    for (let i = 1; i < n; i++) {
      const x = margin + i * stepX;
      const yp = y + graphH - Math.max(0, Math.min(1, data.energyCurve[i])) * graphH;
      doc.line(prevX, prevY, x, yp);
      prevX = x; prevY = yp;
    }
    doc.setLineWidth(0.5);
  }
  y += graphH + 18;

  // FX summary
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("FX & transitions used", margin, y); y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const fxEntries = Object.entries(data.fxUsed).sort((a, b) => b[1] - a[1]);
  if (fxEntries.length === 0) {
    doc.setTextColor(140);
    doc.text("(none recorded)", margin, y); y += 14;
    doc.setTextColor(0);
  } else {
    fxEntries.forEach(([name, count]) => {
      doc.text(`• ${name} × ${count}`, margin, y);
      y += 12;
      if (y > H - margin) { doc.addPage(); y = margin; }
    });
  }
  y += 10;

  // Tracklist
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Tracklist", margin, y); y += 14;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  // Header row
  const cols = [
    { x: margin, label: "#" },
    { x: margin + 24, label: "Time" },
    { x: margin + 70, label: "Title" },
    { x: margin + 280, label: "Artist" },
    { x: margin + 420, label: "BPM" },
    { x: margin + 460, label: "Key" },
    { x: margin + 495, label: "Transition" },
  ];
  doc.setFont("helvetica", "bold");
  cols.forEach((c) => doc.text(c.label, c.x, y));
  y += 12;
  doc.setDrawColor(220);
  doc.line(margin, y - 6, W - margin, y - 6);
  doc.setFont("helvetica", "normal");

  data.entries.forEach((e) => {
    if (y > H - margin) { doc.addPage(); y = margin; }
    const row = [
      String(e.index + 1),
      fmtTime(e.startSec),
      (e.title || "—").slice(0, 36),
      (e.artist || "—").slice(0, 24),
      e.bpm != null ? String(Math.round(e.bpm)) : "—",
      e.key ?? "—",
      e.transitionInto ?? "—",
    ];
    cols.forEach((c, i) => doc.text(row[i], c.x, y));
    y += 12;
  });

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`VDJ PRO — Mix Report · Page ${p}/${totalPages}`, W / 2, H - 18, { align: "center" });
  }

  const safeName = (data.sessionName || data.djName || "session")
    .replace(/[\\/:*?"<>|]+/g, "_").trim().slice(0, 50) || "session";
  const stamp = new Date(data.startedAt).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fname = `vdj-mix-report_${safeName}_${stamp}.pdf`;
  doc.save(fname);
  return fname;
}

/** Helper to build a MixReportEntry from a TrackRecord. */
export function trackToReportEntry(t: TrackRecord, idx: number, startSec: number, transitionInto?: string, energy?: number): MixReportEntry {
  return {
    index: idx,
    title: t.title || "—",
    artist: t.artist || "—",
    bpm: typeof t.bpm === "number" ? t.bpm : null,
    key: (t.key as string) ?? null,
    startSec,
    transitionInto,
    energy,
  };
}
