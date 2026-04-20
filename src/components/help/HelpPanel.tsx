export function HelpPanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 12, lineHeight: 1.6, color: "var(--text-2)" }}>
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
        <li><b>Slip</b>: marca acciones para volver a la posición original (visual).</li>
        <li><b>Reverse</b>: reproduce la pista al revés en tiempo real.</li>
        <li><b>Brake / Stop</b>: efecto de frenado de plato (lento o rápido).</li>
        <li><b>Quantize (QNT)</b>: cuantiza hot cues al beat más cercano.</li>
        <li><b>Master Deck</b>: elige A o B como reloj maestro de referencia.</li>
        <li><b>Tap Tempo</b>: toca el botón TAP al ritmo para medir BPM.</li>
        <li><b>Auto-Mix</b>: barre el crossfader al deck contrario en 8s.</li>
        <li><b>Sleep Timer</b>: fade-out de master en 5/15/30/60 min.</li>
      </ul>
      <h3 style={{ color: "var(--text-1)", margin: 0, fontSize: 14 }}>Atajos de teclado</h3>
      <ul style={{ paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4, fontFamily: "var(--font-mono)", fontSize: 11 }}>
        <li><b>Space</b> Play/Pause A · <b>Shift Right</b> Play/Pause B</li>
        <li><b>Q / W</b> Cue A / Cue B · <b>A / S</b> Sync A / Sync B</li>
        <li><b>1‑8</b> Hot cues A · <b>Shift+1‑8</b> Hot cues B</li>
        <li><b>[ ]</b> Beat jump A ±4 · <b>; '</b> Beat jump B ±4</li>
        <li><b>B / Shift+B</b> Brake A / B · <b>V / Shift+V</b> Reverse A / B</li>
        <li><b>M</b> Auto-mix · <b>T</b> Tap tempo · <b>R</b> Rec start/stop</li>
      </ul>
      <h3 style={{ color: "var(--text-1)", margin: 0, fontSize: 14 }}>Sobre el motor</h3>
      <p>Audio 100% Web Audio API. BPM detectado offline por onset + autocorrelación. Key inicial estimada y editable. Pistas, cues y grabaciones se guardan en IndexedDB; skin y settings en localStorage.</p>
    </div>
  );
}