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
      <h3 style={{ color: "var(--text-1)", margin: 0, fontSize: 14 }}>Sobre el motor</h3>
      <p>Audio 100% Web Audio API. BPM detectado offline por onset + autocorrelación. Key inicial estimada y editable. Pistas, cues y grabaciones se guardan en IndexedDB; skin y settings en localStorage.</p>
    </div>
  );
}