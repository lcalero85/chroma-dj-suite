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
      "8. Modo Radio: añade pistas a la cola y se reproducen solas en Deck A.",
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
      "Voice-Over (mic): activa el micrófono y duckea el master, con 10 efectos de voz.",
      "Modo Radio: cola de pistas que suenan una tras otra automáticamente en Deck A.",
      "Numpad Selector: alterna el deck destino del teclado numérico (tecla ` o desde Recorder).",
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
      "L → Radio: saltar a la siguiente pista de la cola",
      "` (backquote) → Alternar deck destino del numpad (A ↔ B)",
    ],
  },
  {
    title: "Atajos de teclado numérico (Numpad)",
    rows: [
      "Numpad 1..8 → Hot cues del deck activo (Shift = el otro deck)",
      "Numpad 9 → Loop de 4 beats en el deck activo (Shift = el otro deck)",
      "Numpad 0 → Activar / desactivar loop actual del deck activo",
      "Numpad . → Limpiar loop del deck activo",
      "Numpad + → Disparar Sampler pad 1",
      "Numpad − → Disparar Sampler pad 2",
      "Numpad * → Toggle FX 1 ON/OFF (mix 50%)",
      "Numpad / → Toggle FX 2 ON/OFF (mix 50%)",
      "Numpad Enter → Iniciar / detener grabación",
      "Cambia el deck destino con ` o desde el panel Recorder (botón A/B junto a NUMPAD →).",
    ],
  },
  {
    title: "Modo Radio",
    rows: [
      "Pestaña Radio en la barra inferior: lista de reproducción auto-encadenada en Deck A.",
      "Añadir pistas: botón 📻 en cada fila de Library.",
      "Controles: RADIO ON/OFF, Siguiente (tecla L), Aleatorio (shuffle), Auto-Mix.",
      "Reordenar la cola con las flechas ↑ ↓ y eliminar con la papelera.",
      "Cuando termina una pista, la siguiente carga y empieza automáticamente.",
      "Compatible con voice-over: habla por encima de la radio sin parar la música.",
    ],
  },
  {
    title: "Voice-Over y efectos de voz",
    rows: [
      "Tecla N o botón VOICE OVER en la pestaña Recorder.",
      "LVL: nivel del micrófono · DUCK: cuánto baja la música mientras hablas.",
      "Cuando está activo se muestra un banner rojo 'EN VIVO'.",
      "Selecciona uno de los 10 efectos preset:",
      "  1. Sin efecto         2. Locutor radio    3. Cálido club",
      "  4. Teléfono           5. Megáfono         6. Eco salón",
      "  7. Doblador           8. Robot            9. Estadio",
      "  10. Susurro           11. Monstruo",
      "El efecto se aplica también a la grabación (queda capturado en el WAV final).",
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
      "Cadena master: Decks → master → master-duck → limiter → analyser → salida.",
      "Cadena mic: micSource → micGain → [HP → Peak EQ → Shaper → Delay] → micDuck → salida.",
      "Tap de grabación: limiter + micDuck → recordTap → ScriptProcessor (PCM 16-bit, WAV estéreo 44.1 kHz).",
    ],
  },
  {
    title: "Librería con carpetas (géneros y subgéneros)",
    rows: [
      "Sidebar izquierda en Library con árbol de carpetas anidadas.",
      "Crea carpetas raíz con el botón 'Carpeta'.",
      "Cada carpeta tiene botones para renombrar (lápiz), añadir subcarpeta y eliminar.",
      "Arrastra y suelta una pista sobre una carpeta para asignarla allí (drag & drop).",
      "Arrastra a 'Todas las pistas' para sacarla de cualquier carpeta.",
      "Eliminar una carpeta también borra sus subcarpetas; las pistas vuelven a la raíz.",
      "Filtro automático: al seleccionar una carpeta solo se muestran sus pistas.",
      "Persistencia 100% local en IndexedDB (store 'folders').",
    ],
  },
  {
    title: "Mezcla de video",
    rows: [
      "Importa archivos de video (MP4, WebM, MOV) desde Library igual que audio.",
      "Las pistas de video se marcan con un icono de película.",
      "Carga el video en Deck A o Deck B con →A / →B o doble click.",
      "Aparece automáticamente la pantalla flotante 'VIDEO MIX' (esquina inferior derecha).",
      "El audio del video se reproduce a través de toda la cadena: EQ, filter, FX, master, grabación.",
      "El crossfader de audio mezcla también el video (link activado por defecto).",
      "Cada deck tiene un panel 'VIDEO FX' bajo los hot cues con 9 parámetros:",
      "  · BLUR · BRIGHT · CONTRAST · SATURATE · HUE · INVERT · RGB shift · GLITCH · ZOOM",
      "Botón RESET por deck para volver al estado neutral.",
      "El video sigue al pitch/tempo del audio (rate match) y se sincroniza cada frame.",
    ],
  },
  {
    title: "Grabación de video MP4",
    rows: [
      "Cuando hay video cargado, aparece el botón 'Grabar video' en Recorder.",
      "Captura el canvas central + audio master (incluye voice-over).",
      "Encoder: MediaRecorder con MP4/H.264 si el navegador lo soporta, fallback a WebM.",
      "Bitrate de video: 4 Mbps · 30 FPS · audio del master en tiempo real.",
      "El archivo se guarda en IndexedDB y se reproduce/descarga desde la lista del Recorder.",
      "La grabación de audio WAV (botón 'Grabar') sigue funcionando en paralelo y por separado.",
    ],
  },
  {
    title: "Levantar la app en local",
    rows: [
      "Requisitos: Node.js 20+ o Bun 1.1+, npm o bun, navegador Chromium reciente.",
      "1. Clona el repositorio: git clone <url-del-repo> && cd <carpeta>",
      "2. Instala dependencias:    bun install        (o npm install)",
      "3. Modo desarrollo:         bun dev            (o npm run dev)",
      "4. Abre el navegador en:    http://localhost:5173",
      "5. Build de producción:     bun run build",
      "6. Servir el build local:   bun run start      (sirve la carpeta dist)",
      "Notas:",
      "  · La app usa IndexedDB y localStorage del navegador, no necesita backend.",
      "  · Para usar el micrófono el sitio debe ser localhost o https.",
      "  · La grabación MP4 solo funciona en navegadores con soporte H.264 (Chrome/Edge).",
      "  · Si vas a desplegar: hace falta servidor estático con HTTPS para mic + MediaRecorder.",
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