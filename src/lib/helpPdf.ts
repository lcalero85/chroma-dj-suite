import jsPDF from "jspdf";

interface Section {
  title: string;
  rows: string[];
}

const SECTIONS: Section[] = [
  {
    title: "Inicio rápido",
    rows: [
      "1. Abre la pestaña Library e importa archivos de audio.",
      "2. Doble clic o → A / → B para cargar pista en un deck.",
      "3. Pulsa Play, ajusta EQ / filtro / fader. Usa el crossfader.",
      "4. Marca hot cues con click derecho en los pads.",
      "5. Activa loops por beats o usa IN / OUT manuales.",
      "6. Encadena efectos en el panel FX.",
      "7. Graba tu sesión desde la pestaña Recorder.",
    ],
  },
  {
    title: "Funciones Pro",
    rows: [
      "Beat Jump: salta ±1 / ±4 beats sin perder fase.",
      "Slip: marca acciones para volver a la posición original (visual).",
      "Reverse: reproduce la pista al revés en tiempo real.",
      "Brake / Stop: efecto de frenado de plato (lento o rápido).",
      "Quantize (QNT): cuantiza hot cues al beat más cercano.",
      "Master Deck: elige A o B como reloj maestro de referencia.",
      "Tap Tempo: toca el botón TAP al ritmo para medir BPM.",
      "Auto-Mix: barre el crossfader al deck contrario en 8s.",
      "Sleep Timer: fade-out de master en 5/15/30/60 min.",
      "Voice-Over (mic): activa el micrófono y duckea el master.",
    ],
  },
  {
    title: "Atajos de teclado (general)",
    rows: [
      "Space → Play / Pause Deck A",
      "Shift derecho → Play / Pause Deck B",
      "Q / W → Cue Deck A / Cue Deck B",
      "A / S → Sync Deck A / Sync Deck B",
      "1..8 → Hot cues Deck A (Shift + dígito = Deck B)",
      "[ / ] → Beat jump Deck A ±4",
      "; / ' → Beat jump Deck B ±4",
      "B / Shift+B → Brake Deck A / Brake Deck B",
      "V / Shift+V → Reverse Deck A / Reverse Deck B",
      "M → Auto-mix",
      "T → Tap tempo",
      "R → Iniciar / detener grabación",
      "N → Activar / apagar voice-over (micrófono)",
    ],
  },
  {
    title: "Atajos de teclado numérico (Numpad)",
    rows: [
      "Numpad 1..8 → Hot cues Deck A (Shift = Deck B)",
      "Numpad 9 → Loop de 4 beats Deck A (Shift = Deck B)",
      "Numpad 0 → Activar / desactivar loop actual",
      "Numpad . → Limpiar loop",
      "Numpad + → Disparar Sampler pad 1",
      "Numpad − → Disparar Sampler pad 2",
      "Numpad * → Toggle FX 1 ON/OFF (mix 50%)",
      "Numpad / → Toggle FX 2 ON/OFF (mix 50%)",
      "Numpad Enter → Iniciar / detener grabación",
    ],
  },
  {
    title: "Motor de audio",
    rows: [
      "Audio 100% Web Audio API.",
      "BPM detectado offline por onset + autocorrelación.",
      "Key inicial estimada y editable.",
      "Pistas, cues y grabaciones se guardan en IndexedDB.",
      "Skin y settings en localStorage.",
      "Cadena: Decks → master → master-duck → limiter → analyser → salida + record-tap.",
      "Mic chain: micSource → micGain → micDuck → salida + recorder.",
    ],
  },
];

export function downloadHelpPdf() {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = margin;

  const writeLine = (text: string, size: number, bold = false, color: [number, number, number] = [30, 30, 30]) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, pageW - margin * 2) as string[];
    for (const ln of lines) {
      if (y > pageH - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(ln, margin, y);
      y += size * 1.35;
    }
  };

  // Cover
  writeLine("VDJ PRO", 28, true, [20, 20, 60]);
  writeLine("Documentación técnica y atajos de teclado", 13, false, [80, 80, 80]);
  y += 8;
  writeLine(
    "Esta guía describe el uso de la consola, las funciones profesionales, " +
      "el motor de audio interno y todos los atajos de teclado, incluyendo el teclado numérico.",
    11,
  );
  y += 8;

  for (const s of SECTIONS) {
    y += 6;
    writeLine(s.title, 15, true, [20, 20, 80]);
    y += 2;
    for (const row of s.rows) writeLine("• " + row, 11);
  }

  // Footer
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text(`VDJ PRO · ${i} / ${pages}`, pageW - margin, pageH - 20, { align: "right" });
    doc.text(new Date().toLocaleString(), margin, pageH - 20);
  }

  doc.save(`vdj-pro-manual-${Date.now()}.pdf`);
}