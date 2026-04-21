import jsPDF from "jspdf";

interface Section {
  title: string;
  intro?: string;
  rows: string[];
}

const SECTIONS_ES: Section[] = [
  {
    title: "Inicio rápido",
    intro: "Pasos básicos para empezar a mezclar en menos de un minuto.",
    rows: [
      "Abre la pestaña Library e importa archivos de audio o video.",
      "Doble clic o → A / → B para cargar la pista en un deck.",
      "Pulsa Play, ajusta EQ, filtro y fader. Mueve el crossfader.",
      "Marca hot cues con click derecho en los pads.",
      "Activa loops por beats o usa IN / OUT manuales.",
      "Encadena efectos en el panel FX.",
      "Graba tu sesión desde la pestaña Recorder.",
      "Modo Radio: añade pistas a la cola y se reproducen solas en Deck A.",
    ],
  },
  {
    title: "Funciones profesionales",
    rows: [
      "Beat Jump: salta ±1 / ±4 beats sin perder fase.",
      "Slip: marca acciones para volver a la posición original.",
      "Reverse: reproduce la pista al revés en tiempo real.",
      "Brake / Stop: efecto de frenado de plato (lento o rápido).",
      "Quantize (QNT): cuantiza hot cues al beat más cercano.",
      "Master Deck: elige A o B como reloj maestro de referencia.",
      "Tap Tempo: toca al ritmo para medir BPM manualmente.",
      "Auto-Mix: barre el crossfader al deck contrario en 8 s. Requiere ambos decks cargados, si no se mostrará una alerta.",
      "Sleep Timer: fade-out de master en 5 / 15 / 30 / 60 minutos.",
      "Voice-Over: micrófono en vivo con ducking del master y 10 efectos.",
      "Vocal Cut (KARAOKE): atenúa la voz principal de la pista de forma suave por deck.",
      "Sampler: 4 bancos de 16 pads, cada pad con su propio control de volumen.",
      "Modo Radio: cola de pistas que suenan una tras otra automáticamente.",
    ],
  },
  {
    title: "Atajos de teclado generales",
    rows: [
      "Space → Play / Pause Deck A",
      "Shift derecho → Play / Pause Deck B",
      "J → Play / Pause Deck A",
      "L → Play / Pause Deck B",
      "O → Brake (frenado) Deck A",
      "U → Stop inmediato Deck A",
      "Q / W → Cue Deck A / Cue Deck B",
      "A / S → Sync Deck A / Sync Deck B",
      "1..8 → Hot cues Deck A (Shift + dígito = Deck B)",
      "[ / ] → Beat jump Deck A ±4",
      "; / ' → Beat jump Deck B ±4",
      "B / Shift+B → Brake Deck A / Brake Deck B",
      "V / Shift+V → Reverse Deck A / Reverse Deck B",
      "M → Auto-mix (alerta si falta cargar un deck)",
      "T → Tap tempo",
      "R → Iniciar / detener grabación",
      "N → Activar / apagar voice-over",
      "Shift + L → Radio: siguiente pista",
      "` (backquote) → Alternar deck destino del numpad (A ↔ B)",
    ],
  },
  {
    title: "Atajos del teclado numérico (Numpad)",
    rows: [
      "Numpad 1..8 → Hot cues del deck activo (Shift = el otro deck)",
      "Numpad 9 → Loop de 4 beats",
      "Numpad 0 → Activar / desactivar loop actual",
      "Numpad . → Limpiar loop",
      "Numpad + → Disparar Sampler pad 1",
      "Numpad − → Disparar Sampler pad 2",
      "Numpad * → Toggle FX 1 ON / OFF",
      "Numpad / → Toggle FX 2 ON / OFF",
      "Numpad Enter → Iniciar / detener grabación",
    ],
  },
  {
    title: "Modo Radio",
    rows: [
      "Cola de reproducción auto-encadenada en Deck A.",
      "Añade pistas: botón 📻 en cada fila de Library.",
      "Controles: RADIO ON/OFF, Siguiente (Shift+L), Aleatorio, Auto-Mix.",
      "Reordena con flechas y elimina con la papelera.",
      "Compatible con voice-over: habla por encima sin cortar la música.",
    ],
  },
  {
    title: "Segmentos de Radio (bloques temáticos)",
    intro: "Crea bloques temáticos (Romántico, Reggae, Salsa, Top 40…) y prográmalos para que suenen automáticamente a una hora exacta.",
    rows: [
      "Pestaña Radio → sub-pestaña Segmentos → botón '+ Nuevo segmento'.",
      "Pon nombre y color al segmento (ej. 'Romántico' en rojo, 'Reggae' en verde).",
      "Añade pistas al segmento de 2 formas: (1) desde Library con el menú '+ Segmento' en cada fila, (2) desde el segmento usando el buscador interno.",
      "Programa la hora de disparo en formato 24h (HH:MM). Ej: 21:00 lanza el segmento Romántico cada noche a las 9.",
      "Modo de carga: 'Reemplazar' (sustituye la cola actual) o 'Añadir' (encola al final).",
      "Cuando llega la hora programada y la Radio está ON, las pistas del segmento se cargan en la cola del Deck A y empiezan a sonar una tras otra.",
      "El scheduler revisa cada 30 segundos; un segmento solo se dispara una vez por minuto programado.",
      "Disparo manual: botón ▶ en el segmento para cargarlo en la cola sin esperar la hora.",
      "Compatible con Auto-Mix: si está activo, las pistas del segmento se mezclan automáticamente al cambiar.",
      "Compatible con Aleatorio: el orden del segmento se baraja al cargarse en la cola.",
      "Tip de programación: encadena varios segmentos a horas distintas para una parrilla tipo emisora (ej. 18:00 Reggae, 20:00 Salsa, 22:00 Romántico).",
    ],
  },
  {
    title: "Voice-over y efectos de voz",
    rows: [
      "Tecla N o botón VOICE OVER en la pestaña Recorder.",
      "LVL: nivel del micrófono · DUCK: cuánto baja la música.",
      "Cuando está activo se muestra un banner rojo «EN VIVO».",
      "10 presets: Sin efecto, Locutor radio, Cálido club, Teléfono, Megáfono, Eco salón, Doblador, Robot, Estadio, Susurro, Monstruo.",
      "El efecto se aplica también a la grabación (queda capturado en el WAV).",
    ],
  },
  {
    title: "Vocal Cut (karaoke por deck)",
    rows: [
      "Cada deck tiene su propio control VOCAL bajo los hot cues / pro controls.",
      "Mueve el slider de 0 a 100 % para atenuar la voz suavemente.",
      "Botones rápidos OFF (sin efecto) y KARAOKE (máximo).",
      "El cambio es gradual (~150 ms) para que no se note brusco al público.",
      "Funciona mejor en pistas con la voz centrada en el estéreo (la mayoría).",
    ],
  },
  {
    title: "Sampler",
    rows: [
      "4 bancos × 16 pads cada uno (64 muestras totales).",
      "Click en un pad vacío o click derecho para cargar un archivo.",
      "Click en pad cargado: dispara la muestra al instante sobre la mezcla.",
      "Slider VOL en cada pad cargado: controla el volumen del sample 0–150 %.",
      "Numpad + / − disparan los pads 1 y 2 del banco actual.",
    ],
  },
  {
    title: "Compatibilidad MIDI (controladores reales)",
    rows: [
      "Activa MIDI desde Ajustes → MIDI.",
      "Selecciona dispositivo de entrada y, opcionalmente, de salida (LEDs).",
      "Perfiles preconfigurados: Pioneer DDJ-400, Numark Mixtrack Pro/Platinum, Hercules Inpulse 200/300.",
      "MIDI Learn: pulsa cualquier control y asígnalo a una acción de la app.",
      "Feedback LED: la consola refleja play, cue, loop y hot cues activos.",
      "Importa / exporta tus mapeos en JSON.",
    ],
  },
  {
    title: "Mezcla de video",
    rows: [
      "Importa MP4, WebM o MOV desde Library.",
      "Las pistas de video se marcan con un icono de película.",
      "Carga un video en Deck A o Deck B con →A / →B.",
      "Aparece la pantalla flotante VIDEO MIX.",
      "El audio del video pasa por toda la cadena: EQ, filter, FX, master, grabación.",
      "El crossfader mezcla audio y video al mismo tiempo (link activo por defecto).",
      "Cada deck tiene panel VIDEO FX: BLUR, BRIGHT, CONTRAST, SATURATE, HUE, INVERT, RGB, GLITCH, ZOOM.",
    ],
  },
  {
    title: "Grabación",
    rows: [
      "Botón Grabar: captura el master completo en formato WAV (estéreo 44.1 kHz).",
      "El voice-over también se graba dentro del WAV automáticamente.",
      "Botón Grabar video (cuando hay video cargado): MP4/H.264 a 30 FPS · 4 Mbps + audio master.",
      "Las grabaciones se guardan en IndexedDB y se pueden descargar al PC.",
    ],
  },
  {
    title: "Levantar la app en local",
    rows: [
      "Requisitos: Node 20+ o Bun 1.1+, navegador Chromium reciente.",
      "git clone <url-del-repo> && cd <carpeta>",
      "bun install (o npm install)",
      "bun dev (o npm run dev) → http://localhost:5173",
      "bun run build → bundle de producción.",
      "Para usar el micrófono: localhost o HTTPS.",
      "Para grabar MP4: navegador con soporte H.264 (Chrome / Edge).",
    ],
  },
];

const SECTIONS_EN: Section[] = [
  {
    title: "Quick start",
    intro: "Get mixing in under a minute.",
    rows: [
      "Open the Library tab and import audio or video files.",
      "Double-click or → A / → B to load a track on a deck.",
      "Press Play, tweak EQ, filter and fader. Move the crossfader.",
      "Right-click pads to set hot cues.",
      "Trigger beat-loops or use manual IN / OUT.",
      "Chain effects in the FX panel.",
      "Record your set from the Recorder tab.",
      "Radio mode: queue tracks and they play back-to-back on Deck A.",
    ],
  },
  {
    title: "Pro features",
    rows: [
      "Beat Jump: ±1 / ±4 beats while keeping phase.",
      "Slip: marks actions to return to the original playhead.",
      "Reverse: real-time reverse playback.",
      "Brake / Stop: turntable spin-down (slow or fast).",
      "Quantize (QNT): snap cues / loops to the nearest beat.",
      "Master Deck: pick A or B as the reference clock.",
      "Tap Tempo: tap to measure BPM manually.",
      "Auto-Mix: 8-second crossfade. Requires both decks loaded — alerts otherwise.",
      "Sleep Timer: master fade-out after 5 / 15 / 30 / 60 minutes.",
      "Voice-Over: live mic with master ducking and 10 voice presets.",
      "Vocal Cut (KARAOKE): smoothly fade out the lead vocal per deck.",
      "Sampler: 4 banks of 16 pads, each pad has its own volume.",
      "Radio mode: auto-chained queue on Deck A with shuffle and auto-mix.",
    ],
  },
  {
    title: "Keyboard shortcuts",
    rows: [
      "Space → Play / Pause Deck A",
      "Right Shift → Play / Pause Deck B",
      "J → Play / Pause Deck A",
      "L → Play / Pause Deck B",
      "O → Brake Deck A",
      "U → Stop Deck A",
      "Q / W → Cue Deck A / Cue Deck B",
      "A / S → Sync Deck A / Sync Deck B",
      "1..8 → Hot cues Deck A (Shift + digit = Deck B)",
      "[ / ] → Beat jump Deck A ±4",
      "; / ' → Beat jump Deck B ±4",
      "B / Shift+B → Brake A / B · V / Shift+V → Reverse A / B",
      "M → Auto-mix (alert if a deck is empty)",
      "T → Tap tempo · R → Record · N → Voice-over",
      "Shift + L → Radio: next track",
      "` (backquote) → Toggle numpad target deck",
    ],
  },
  {
    title: "Numpad shortcuts",
    rows: [
      "Numpad 1..8 → Hot cues of active deck (Shift = other deck)",
      "Numpad 9 → 4-beat loop",
      "Numpad 0 → Toggle current loop",
      "Numpad . → Clear loop",
      "Numpad + / − → Sampler pads 1 / 2",
      "Numpad * / / → Toggle FX 1 / FX 2",
      "Numpad Enter → Start / stop recording",
    ],
  },
  {
    title: "Radio segments (themed blocks)",
    intro: "Create themed blocks (Romantic, Reggae, Salsa, Top 40…) and schedule them to fire automatically at a given time.",
    rows: [
      "Radio tab → Segments sub-tab → '+ New segment'.",
      "Give the segment a name and color (e.g. 'Romantic' in red, 'Reggae' in green).",
      "Add tracks two ways: (1) from Library using the '+ Segment' menu on each row, (2) inside the segment using the built-in search.",
      "Schedule the trigger time in 24h format (HH:MM). Ex: 21:00 fires the Romantic block every night at 9pm.",
      "Load mode: 'Replace' (overwrites the current queue) or 'Append' (queues at the end).",
      "When the scheduled time hits and Radio is ON, segment tracks are loaded into Deck A's queue and start playing back-to-back.",
      "The scheduler polls every 30 seconds and each segment only fires once per scheduled minute.",
      "Manual trigger: ▶ button on the segment loads it into the queue immediately.",
      "Auto-Mix friendly: if Auto-Mix is on, segment tracks crossfade automatically.",
      "Shuffle friendly: enabling Random shuffles the segment order on load.",
      "Programming tip: chain segments at different times for a radio-style schedule (e.g. 18:00 Reggae, 20:00 Salsa, 22:00 Romantic).",
    ],
  },
  {
    title: "Vocal Cut (karaoke per deck)",
    rows: [
      "Each deck has a VOCAL slider under the hot cues / pro controls.",
      "Drag from 0 to 100 % to fade out the lead vocal smoothly.",
      "Quick OFF and KARAOKE buttons for instant toggling.",
      "Transitions take ~150 ms so the change is never abrupt for the audience.",
      "Works best on tracks with center-panned vocals (most modern songs).",
    ],
  },
  {
    title: "MIDI controllers",
    rows: [
      "Enable MIDI under Settings → MIDI.",
      "Select input device and optionally an output device for LED feedback.",
      "Built-in profiles: Pioneer DDJ-400, Numark Mixtrack Pro/Platinum, Hercules Inpulse 200/300.",
      "MIDI Learn: hit any control to bind it to an app action.",
      "LED feedback: hardware mirrors play, cue, loop and hot-cue states.",
      "Import / export your mappings as JSON.",
    ],
  },
  {
    title: "Recording",
    rows: [
      "Record button: captures the full master to stereo 44.1 kHz WAV.",
      "Voice-over is automatically captured inside the WAV.",
      "Video record (when a clip is loaded): MP4/H.264 30 FPS · 4 Mbps + master audio.",
      "All recordings live in IndexedDB and can be downloaded to disk.",
    ],
  },
];

function getAppName(): string {
  if (typeof window === "undefined") return "VDJ PRO";
  try {
    const raw = window.localStorage.getItem("vdj-pro-state");
    if (!raw) return "VDJ PRO";
    const parsed = JSON.parse(raw) as { state?: { settings?: { appName?: string } }; settings?: { appName?: string } };
    return parsed?.state?.settings?.appName || parsed?.settings?.appName || "VDJ PRO";
  } catch {
    return "VDJ PRO";
  }
}

function getLang(): "en" | "es" {
  if (typeof window === "undefined") return "en";
  try {
    const raw = window.localStorage.getItem("vdj-pro-state");
    if (!raw) return "en";
    const parsed = JSON.parse(raw) as { state?: { settings?: { lang?: "en" | "es" } }; settings?: { lang?: "en" | "es" } };
    return parsed?.state?.settings?.lang || parsed?.settings?.lang || "en";
  } catch {
    return "en";
  }
}

export function downloadHelpPdf() {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const appName = getAppName();
  const lang = getLang();
  const SECTIONS = lang === "es" ? SECTIONS_ES : SECTIONS_EN;

  // Theme
  const ACCENT: [number, number, number] = [25, 161, 255]; // pioneer cyan
  const ACCENT_DARK: [number, number, number] = [10, 90, 155];
  const INK: [number, number, number] = [22, 26, 36];
  const SUB: [number, number, number] = [110, 118, 132];

  // ===== Cover =====
  // Top accent band
  doc.setFillColor(ACCENT_DARK[0], ACCENT_DARK[1], ACCENT_DARK[2]);
  doc.rect(0, 0, pageW, 180, "F");
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.rect(0, 175, pageW, 6, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(36);
  doc.text(appName, margin, 90);
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text(lang === "es" ? "Manual de usuario" : "User manual", margin, 120);
  doc.setFontSize(11);
  doc.setTextColor(220, 235, 255);
  doc.text(
    lang === "es"
      ? "Mezcla profesional · Audio · Video · MIDI · Grabación · Voice-over"
      : "Professional mixing · Audio · Video · MIDI · Recording · Voice-over",
    margin,
    140,
  );

  // Cover body
  let y = 230;
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(lang === "es" ? "Acerca de este documento" : "About this document", margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(SUB[0], SUB[1], SUB[2]);
  const intro = lang === "es"
    ? "Esta guía describe el uso completo de la consola: decks, mezclador, efectos, sampler, grabación, voice-over, mezcla de video, modo radio, controladores MIDI y todos los atajos de teclado."
    : "This guide covers the full console: decks, mixer, FX, sampler, recording, voice-over, video mixing, radio mode, MIDI controllers and every keyboard shortcut.";
  const introLines = doc.splitTextToSize(intro, pageW - margin * 2) as string[];
  introLines.forEach((line) => { doc.text(line, margin, y); y += 16; });

  // Index card
  y += 10;
  doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.setLineWidth(0.8);
  doc.roundedRect(margin, y, pageW - margin * 2, 24 + SECTIONS.length * 16, 6, 6, "S");
  y += 22;
  doc.setTextColor(ACCENT_DARK[0], ACCENT_DARK[1], ACCENT_DARK[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(lang === "es" ? "Contenido" : "Contents", margin + 14, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  SECTIONS.forEach((s, i) => {
    y += 16;
    doc.text(`${String(i + 1).padStart(2, "0")} · ${s.title}`, margin + 14, y);
  });

  // ===== Body pages =====
  const writeBullet = (text: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    const lines = doc.splitTextToSize(text, pageW - margin * 2 - 16) as string[];
    // bullet dot
    if (y + lines.length * 14 > pageH - margin - 30) {
      doc.addPage();
      y = margin;
    }
    doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.circle(margin + 4, y - 3, 1.8, "F");
    let first = true;
    for (const line of lines) {
      doc.text(line, margin + 14, y);
      y += 14;
      first = false;
    }
    void first;
    y += 2;
  };

  const writeSectionHeader = (title: string, num: number, intro?: string) => {
    if (y + 60 > pageH - margin) {
      doc.addPage();
      y = margin;
    }
    // colored side bar + title
    doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.rect(margin, y - 12, 3, 22, "F");
    doc.setTextColor(ACCENT_DARK[0], ACCENT_DARK[1], ACCENT_DARK[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(`${String(num).padStart(2, "0")}  ${title}`, margin + 12, y + 4);
    y += 18;
    if (intro) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.setTextColor(SUB[0], SUB[1], SUB[2]);
      const lines = doc.splitTextToSize(intro, pageW - margin * 2) as string[];
      lines.forEach((line) => { doc.text(line, margin + 12, y); y += 13; });
    }
    y += 6;
  };

  doc.addPage();
  y = margin;

  SECTIONS.forEach((s, i) => {
    writeSectionHeader(s.title, i + 1, s.intro);
    s.rows.forEach((row) => writeBullet(row));
    y += 8;
  });

  // ===== Footer on every page =====
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    // footer line
    doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.setLineWidth(0.4);
    doc.line(margin, pageH - 32, pageW - margin, pageH - 32);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(SUB[0], SUB[1], SUB[2]);
    doc.text(`${appName} · ${lang === "es" ? "Manual" : "Manual"}`, margin, pageH - 18);
    doc.text(`${i} / ${pages}`, pageW - margin, pageH - 18, { align: "right" });
    doc.text(new Date().toLocaleDateString(), pageW / 2, pageH - 18, { align: "center" });
  }

  const slug = appName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "app";
  doc.save(`${slug}-${lang === "es" ? "manual" : "manual"}-${Date.now()}.pdf`);
}
