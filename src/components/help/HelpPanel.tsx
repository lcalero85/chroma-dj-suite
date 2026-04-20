import { Download } from "lucide-react";
import { downloadHelpPdf } from "@/lib/helpPdf";
import { toast } from "sonner";

export function HelpPanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 12, lineHeight: 1.6, color: "var(--text-2)" }}>
      <button
        className="vdj-btn"
        data-tone="live"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "8px 12px" }}
        onClick={() => {
          try {
            downloadHelpPdf();
            toast("Manual PDF descargado");
          } catch (e) {
            console.error(e);
            toast("No se pudo generar el PDF");
          }
        }}
      >
        <Download size={14} /> Descargar manual PDF
      </button>

      <h3 style={{ color: "var(--text-1)", margin: 0, fontSize: 14 }}>Inicio rápido</h3>
      <ol style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
        <li>Abre la pestaña <b>Library</b> e importa archivos de audio.</li>
        <li>Doble clic o → A / → B para cargar pista en un deck.</li>
        <li>Pulsa Play, ajusta EQ/filtro/fader. Usa el crossfader.</li>
        <li>Marca hot cues con click derecho en los pads.</li>
        <li>Activa loops por beats o usa IN/OUT manuales.</li>
        <li>Encadena efectos en el panel <b>FX</b>.</li>
        <li>Graba tu sesión desde la pestaña <b>Recorder</b>.</li>
      </ol>

      <h3 style={{ color: "var(--text-1)", margin: 0, fontSize: 14 }}>Funciones Pro</h3>
      <ul style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
        <li><b>Beat Jump</b>: salta ±1 / ±4 beats sin perder fase.</li>
        <li><b>Slip</b>: marca acciones para volver a la posición original.</li>
        <li><b>Reverse</b>: reproduce la pista al revés en tiempo real.</li>
        <li><b>Brake / Stop</b>: efecto de frenado de plato (lento o rápido).</li>
        <li><b>Quantize (QNT)</b>: cuantiza hot cues al beat más cercano.</li>
        <li><b>Master Deck</b>: elige A o B como reloj maestro de referencia.</li>
        <li><b>Tap Tempo</b>: toca el botón TAP al ritmo para medir BPM.</li>
        <li><b>Auto-Mix</b>: barre el crossfader al deck contrario en 8s.</li>
        <li><b>Sleep Timer</b>: fade-out de master en 5/15/30/60 min.</li>
        <li><b>Voice-Over</b>: activa el micrófono con ducking del master + 10 efectos de voz (radio, teléfono, robot, eco, monstruo…).</li>
        <li><b>Modo Radio</b>: cola de pistas en Deck A que suenan una tras otra automáticamente, con shuffle y auto-mix.</li>
        <li><b>Numpad selector</b>: el teclado numérico controla el deck que elijas (A o B); pulsa <b>`</b> para alternar.</li>
      </ul>

      <h3 style={{ color: "var(--text-1)", margin: 0, fontSize: 14 }}>Atajos de teclado</h3>
      <ul style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4, fontFamily: "var(--font-mono)", fontSize: 11 }}>
        <li><b>Space</b> Play/Pause A · <b>Shift Right</b> Play/Pause B</li>
        <li><b>Q / W</b> Cue A / B · <b>A / S</b> Sync A / B</li>
        <li><b>1‑8</b> Hot cues A · <b>Shift+1‑8</b> Hot cues B</li>
        <li><b>[ ]</b> Beat jump A ±4 · <b>; '</b> Beat jump B ±4</li>
        <li><b>B / Shift+B</b> Brake A / B · <b>V / Shift+V</b> Reverse A / B</li>
        <li><b>M</b> Auto-mix · <b>T</b> Tap tempo · <b>R</b> Rec · <b>N</b> Voice-over</li>
        <li><b>L</b> Radio: siguiente pista · <b>`</b> Alternar deck destino del numpad (A↔B)</li>
      </ul>

      <h3 style={{ color: "var(--text-1)", margin: 0, fontSize: 14 }}>Teclado numérico (Numpad)</h3>
      <ul style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4, fontFamily: "var(--font-mono)", fontSize: 11 }}>
        <li><b>Num 1‑8</b> Hot cues del deck activo · <b>Shift+Num 1‑8</b> Hot cues del otro deck</li>
        <li><b>Num 9</b> Loop 4 beats · <b>Num 0</b> Loop ON/OFF · <b>Num .</b> Clear loop (Shift = otro deck)</li>
        <li><b>Num + / −</b> Sampler pad 1 / 2</li>
        <li><b>Num * / /</b> FX 1 / FX 2 toggle</li>
        <li><b>Num Enter</b> Rec start / stop</li>
        <li>Cambia el deck destino con <b>`</b> o desde el panel Recorder.</li>
      </ul>

      <h3 style={{ color: "var(--text-1)", margin: 0, fontSize: 14 }}>Modo Radio</h3>
      <ul style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
        <li>Pestaña <b>Radio</b>: cola de reproducción para Deck A.</li>
        <li>Añade pistas desde Library con el botón <b>📻</b>.</li>
        <li>Activa <b>RADIO ON</b>: las pistas avanzan solas al terminar.</li>
        <li>Modos: <b>Aleatorio</b> (shuffle) · <b>Auto-Mix</b> · <b>Siguiente</b> manual (tecla <b>L</b>).</li>
      </ul>

      <h3 style={{ color: "var(--text-1)", margin: 0, fontSize: 14 }}>Voice-Over: 10 efectos</h3>
      <ul style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4, fontFamily: "var(--font-mono)", fontSize: 11 }}>
        <li>Sin efecto · Locutor radio · Cálido club · Teléfono · Megáfono</li>
        <li>Eco salón · Doblador · Robot · Estadio · Susurro · Monstruo</li>
      </ul>

      <h3 style={{ color: "var(--text-1)", margin: 0, fontSize: 14 }}>Sobre el motor</h3>
      <p>
        Audio 100% Web Audio API. BPM detectado offline por onset + autocorrelación. Key inicial estimada y editable.
        Pistas, cues y grabaciones se guardan en IndexedDB; skin y settings en localStorage.
      </p>
    </div>
  );
}