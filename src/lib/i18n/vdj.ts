/**
 * Virtual DJ — bilingual string table (EN/ES).
 *
 * Lives outside `dict.ts` to avoid bloating the main dictionary with the
 * very large set of VDJ-specific labels, toasts and overlay messages.
 * The same `useApp().settings.lang` drives which side is returned, so the
 * Virtual DJ UI follows the global language switch with no Spanglish.
 */
import { useApp } from "@/state/store";

type VdjLang = "en" | "es";

export const VDJ_STR = {
  // ===== Status messages (TopBar chip + overlay) =====
  vdjIdle:                 { en: "Idle",                                         es: "En espera" },
  vdjBtnStartTip:          { en: "Start Virtual DJ ({n} {trackWord})",           es: "Iniciar Virtual DJ ({n} {trackWord})" },
  vdjBtnStopTip:           { en: "Stop Virtual DJ — {msg}",                      es: "Detener Virtual DJ — {msg}" },
  vdjTrackOne:             { en: "track",                                        es: "pista" },
  vdjTrackMany:            { en: "tracks",                                       es: "pistas" },
  vdjStarting:             { en: "Starting Virtual DJ ({n} tracks)",             es: "Iniciando Virtual DJ ({n} pistas)" },
  vdjAnalyzingKeys:        { en: "🎼 Analyzing musical keys…",                   es: "🎼 Analizando tonalidades…" },
  vdjHarmonicReady:        { en: "🎼 Harmonic queue ready ({n} tracks)",         es: "🎼 Cola armónica lista ({n} pistas)" },
  vdjPreparing:            { en: "Preparing {title} ({i}/{n})",                  es: "Preparando {title} ({i}/{n})" },
  vdjMixingTo:             { en: "Mixing → {title}",                             es: "Mezclando → {title}" },
  vdjEchoFreezeTo:         { en: "❄ Echo-Freeze → {title}",                      es: "❄ Echo-Freeze → {title}" },
  vdjBattleTo:             { en: "⚔ Battle Mode → {title}",                      es: "⚔ Battle Mode → {title}" },
  vdjMashupTo:             { en: "💥 Double Drop → {title}",                     es: "💥 Double Drop → {title}" },
  vdjLiveFx:               { en: "Live FX on {deck}",                            es: "Live FX en {deck}" },
  vdjBeatjuggle:           { en: "🤹 Beatjuggle on {deck}",                      es: "🤹 Beatjuggle en {deck}" },
  vdjWaitingLast:          { en: "Waiting for last track to finish",             es: "Esperando final de la última pista" },
  vdjOutroPro:             { en: "Pro outro…",                                   es: "Outro profesional…" },
  vdjStopping:             { en: "Stopping Virtual DJ…",                         es: "Deteniendo Virtual DJ…" },
  vdjPlayingFirst:         { en: "▶ {title} (1/{n})",                            es: "▶ {title} (1/{n})" },
  vdjJingle:               { en: "📻 Radio jingle…",                             es: "📻 Jingle de radio…" },

  // ===== Toasts =====
  toastAlreadyRunning:     { en: "Virtual DJ is already running",                es: "Virtual DJ ya está corriendo" },
  toastSelectFirst:        { en: "Select tracks with the VDJ checkbox in the Library", es: "Marca pistas con la casilla VDJ en la Library" },
  toastNoValid:            { en: "No valid tracks in the queue",                 es: "No hay pistas válidas en la cola" },
  toastRecording:          { en: "Recording Virtual DJ session",                 es: "Grabando sesión Virtual DJ" },
  toastVoiceOn:            { en: "🎤 Voice commands active",                     es: "🎤 Comandos por voz activos" },
  toastVoiceUnsupported:   { en: "Voice commands not supported in this browser", es: "Comandos por voz no soportados en este navegador" },
  toastStreamLive:         { en: "📡 Live streaming started",                    es: "📡 Streaming en vivo iniciado" },
  toastSessionSaved:       { en: "Session saved: {name}",                        es: "Sesión guardada: {name}" },
  toastCueExported:        { en: "📋 Cue sheet exported ({n} tracks)",           es: "📋 Cue sheet exportado ({n} pistas)" },
  toastReportPdf:          { en: "📄 Mix Report PDF generated",                  es: "📄 Mix Report PDF generado" },
  toastVdjError:           { en: "Virtual DJ: error {msg}",                      es: "Virtual DJ: error {msg}" },
  toastVoiceNext:          { en: "⏭ Next track",                                 es: "⏭ Siguiente pista" },
  toastVoicePause:         { en: "⏸ Paused",                                     es: "⏸ Pausado" },
  toastVoicePlay:          { en: "▶ Resumed",                                    es: "▶ Continúa" },
  toastVoiceReportNote:    { en: "📄 Report will be generated when finished",    es: "📄 El reporte se generará al finalizar" },
  toastVoiceSkip:          { en: "🎤 Command: next",                             es: "🎤 Comando: siguiente" },
  toastTrackLoadFail:      { en: "Skipped (failed to load): {title}",            es: "Omitida (fallo al cargar): {title}" },

  // ===== Recording session names =====
  sessionPrefix:           { en: "Virtual Mix",                                  es: "Mezcla Virtual" },

  // ===== Settings panel labels =====
  sectionTitle:            { en: "🎧 Virtual DJ",                                es: "🎧 Virtual DJ" },
  sectionIntro:            { en: "Tick songs in the Library (VDJ column) and let Virtual DJ mix them professionally.",
                              es: "Marca canciones en la Biblioteca (columna VDJ) y deja que el Virtual DJ las mezcle profesionalmente." },
  enableVdj:               { en: "Enable Virtual DJ",                            es: "Habilitar Virtual DJ" },
  mixGenre:                { en: "Mix genre",                                    es: "Género de la mezcla" },
  recordSession:           { en: "Record the session",                           es: "Grabar la sesión" },
  screenRecord:            { en: "Record screen (video)",                         es: "Grabar pantalla (video)" },
  screenRecordTip:         { en: "Captures the screen while Virtual DJ mixes. On start you will choose which screen/window to share.",
                              es: "Captura la pantalla mientras el Virtual DJ mezcla. Al iniciar elegirás qué pantalla o ventana compartir." },
  sessionName:             { en: "Session name",                                 es: "Nombre de la sesión" },
  sessionNamePh:           { en: "(optional — date is used)",                    es: "(opcional — se usará la fecha)" },
  behavior:                { en: "Virtual DJ behavior",                          es: "Comportamiento del Virtual DJ" },
  intensity:               { en: "Mix level",                                    es: "Nivel de mezcla" },
  intensityTip:            { en: "Soft = long & smooth · Normal = balanced · Hard = aggressive & acidic",
                              es: "Suave = transiciones largas y suaves · Normal = balanceado · Duro = ácido y agresivo" },
  intensitySoft:           { en: "🌊 Soft",                                       es: "🌊 Suave" },
  intensityNormal:         { en: "⚖️ Normal",                                     es: "⚖️ Normal" },
  intensityHard:           { en: "🔥 Hard (acidic)",                              es: "🔥 Duro (ácido)" },
  cleanCutMode:            { en: "Clean cut mode (no FX)",                        es: "Modo mezcla limpia (sin efectos)" },
  cleanCutModeTip:         { en: "Hard cut between tracks with no FX/scratch/spice and a brake at the end",
                              es: "Corte seco entre canciones sin efectos/scratch/adornos y un brake al final" },
  shuffle:                 { en: "Shuffle order",                                 es: "Orden aleatorio" },
  shuffleTip:              { en: "Mix selected tracks in random order (no repeats)", es: "Mezcla las pistas seleccionadas en orden aleatorio (sin repetir)" },
  cutAt:                   { en: "Cut track at (%)",                              es: "Cortar pista al (%)" },
  cutAtTip:                { en: "Percentage of the track where the transition starts (50–95%)", es: "Porcentaje de la pista donde inicia la transición (50–95%)" },
  xfadeSec:                { en: "Crossfade duration (s)",                        es: "Duración de transición (s)" },
  xfadeAuto:               { en: "0 = automatic per genre",                       es: "0 = automático según el género" },
  syncBpm:                 { en: "Sync BPM",                                      es: "Sincronizar BPM" },
  autoGain:                { en: "AutoGain per track",                            es: "Nivelación automática por pista" },
  useFx:                   { en: "Apply FX on transition",                        es: "Aplicar efectos (FX) en transición" },
  useLoops:                { en: "Automatic loops",                               es: "Loops automáticos" },
  useHotCues:              { en: "Automatic hot cues",                            es: "Puntos rápidos automáticos" },
  useScratch:              { en: "Scratch flourish",                              es: "Remate con scratch" },
  usePitchBend:            { en: "Pitch bend (micro-tweaks)",                     es: "Ajuste fino de tempo" },
  useSpice:                { en: "Spice (sweeps + mid loop)",                     es: "Adornos (barridos + loop a mitad)" },
  useSpiceTip:             { en: "Filters, loops, scratch and bends mid-track",   es: "Filtros, loops, scratch y ajustes de tempo a mitad de cada pista" },
  announceDj:              { en: "Announce DJ name",                              es: "Anunciar nombre del DJ" },
  announceDjTip:           { en: "Robotic voice with the name in 'DJ name'",      es: "Voz robótica con el nombre configurado en 'Nombre del DJ'" },
  announceMode:            { en: "Announce frequency",                            es: "Frecuencia del anuncio" },
  announceStart:           { en: "Only at start",                                 es: "Solo al iniciar" },
  announceMid:             { en: "Mid-track",                                     es: "A mitad de pista" },
  announceEvery:           { en: "Every transition",                              es: "En cada transición" },
  announceVol:             { en: "Announce volume",                               es: "Volumen del anuncio" },
  outroPro:                { en: "Pro outro (brake + reverb)",                    es: "Cierre profesional (frenado + reverberación)" },
  brakeSec:                { en: "Final brake duration (s)",                      es: "Duración del frenado final (s)" },
  selectedCount:           { en: "Selected tracks",                               es: "Pistas seleccionadas" },
  clearSelection:          { en: "Clear selection",                               es: "Vaciar selección" },
  advanced173:             { en: "✨ Advanced (v1.7.3)",                          es: "✨ Avanzado (v1.7.3)" },
  advanced174:             { en: "💥 Advanced (v1.7.4)",                          es: "💥 Avanzado (v1.7.4)" },
  advanced175:             { en: "🎙 Advanced (v1.7.5)",                          es: "🎙 Avanzado (v1.7.5)" },
  advancedPro:             { en: "🚀 Pro (v1.7.6)",                               es: "🚀 Pro (v1.7.6)" },
  smart:                   { en: "🤖 Autonomous (v1.7.7)",                        es: "🤖 Autónomo (v1.7.7)" },

  energyCurve:             { en: "Energy Curve (set planner)",                    es: "Curva de energía (planificador del set)" },
  energyCurveTip:          { en: "Reorders selected tracks following a pro warmup → peak → cooldown curve (BPM + Camelot)",
                              es: "Reordena las pistas seleccionadas con una curva profesional: calentamiento → pico → cierre (BPM + Camelot)" },
  energyShape:             { en: "Curve shape",                                   es: "Forma de la curva" },
  shapeArc:                { en: "🏔 Arc (warmup → peak → cooldown)",             es: "🏔 Arco (calentamiento → pico → cierre)" },
  shapeAsc:                { en: "📈 Ascending",                                  es: "📈 Ascendente" },
  shapeDesc:               { en: "📉 Descending",                                 es: "📉 Descendente" },
  shapeWave:               { en: "🌊 Waves (up and down)",                        es: "🌊 Olas (sube y baja)" },
  echoFreeze:              { en: "Echo-Freeze + Cut (Pioneer transition)",        es: "Congelación con eco + corte (transición Pioneer)" },
  echoFreezeTip:           { en: "Freezes the outgoing's last bar with echo and cuts dry on the incoming downbeat",
                              es: "Congela con eco el último compás de la pista saliente y corta seco al golpe fuerte de la entrante" },
  echoFreezeProb:          { en: "Echo-Freeze probability (%)",                   es: "Probabilidad de congelación con eco (%)" },
  echoFreezeProbTip:       { en: "% of transitions that will use Echo-Freeze instead of the classic crossfade",
                              es: "% de transiciones que usarán congelación con eco en lugar de transición clásica" },
  phraseAlign:             { en: "Align cut to downbeat / drop",                  es: "Alinear corte al golpe fuerte / caída" },
  phraseAlignTip:          { en: "Wait for the next downbeat or phrase marker (drop/buildup) before cutting — perfectly square transitions",
                              es: "Espera al próximo golpe fuerte o marca de frase (caída/subida) antes de cortar — transiciones perfectamente cuadradas" },
  phraseWindow:            { en: "Downbeat wait window (s)",                      es: "Ventana de espera al golpe fuerte (s)" },
  phraseWindowTip:         { en: "If no downbeat/drop appears within the window, cut anyway so the mix keeps moving",
                              es: "Si no aparece golpe fuerte o caída dentro de la ventana, corta igual para no bloquear la mezcla" },

  mashup:                  { en: "Mash-up Double Drop",                           es: "Mezcla superpuesta de doble caída" },
  mashupTip:               { en: "Both tracks play N bars with EQ split (lows from A, highs from B) before the cut",
                              es: "Ambas pistas suenan N compases con ecualización separada (graves de A, agudos de B) antes del corte" },
  mashupProb:              { en: "Mash-up probability (%)",                       es: "Probabilidad de mezcla superpuesta (%)" },
  mashupBars:              { en: "Double Drop bars",                              es: "Compases de doble caída" },
  stemAware:               { en: "Stem-aware (vocal duck on outgoing)",           es: "Separación vocal (atenúa voz saliente)" },
  stemAwareTip:            { en: "Cancels the outgoing centre vocal during the transition to avoid vocal clashes",
                              es: "Cancela la voz central del outgoing durante la transición para evitar choques vocales" },
  stemAmt:                 { en: "Vocal cancellation amount (%)",                 es: "Cantidad de reducción vocal (%)" },
  battle:                  { en: "⚔ Battle Mode (turntablism)",                   es: "⚔ Modo batalla (tornamesismo)" },
  battleTip:               { en: "Alternates decks every N bars with scratches and dry cuts, turntablism style",
                              es: "Alterna decks cada N compases con scratches y cortes secos estilo turntablism" },
  battleProb:              { en: "Battle probability (%)",                        es: "Probabilidad de batalla (%)" },
  battleBars:              { en: "Bars per Battle round",                         es: "Compases por ronda de batalla" },
  battleRounds:            { en: "Battle rounds",                                 es: "Rondas de batalla" },
  bars:                    { en: "{n} bars",                                      es: "{n} compases" },

  micShoutout:             { en: "Sidechain mic shoutouts",                       es: "Anuncios por micrófono con atenuación" },
  micShoutoutTip:          { en: "Detects when you speak into the mic and ducks the master automatically",
                              es: "Detecta cuando hablas por el micrófono y atenúa la salida principal automáticamente" },
  micThresh:               { en: "Mic threshold (%)",                             es: "Umbral del micrófono (%)" },
  duckDepth:               { en: "Duck depth (%)",                                es: "Profundidad de atenuación (%)" },
  moodAdaptive:            { en: "Mood adaptive (genre arc)",                     es: "Ánimo adaptativo (arco de género)" },
  moodAdaptiveTip:         { en: "Automatically changes the target genre every N tracks (chill → peak → cooldown)",
                              es: "Cambia automáticamente el género objetivo cada N pistas (relajado → pico → cierre)" },
  moodEvery:               { en: "Change mood every N tracks",                    es: "Cambiar ánimo cada N pistas" },
  moodShape:               { en: "Mood shape",                                    es: "Forma del ánimo" },
  exportCue:               { en: "Export cue sheet (.cue) when finished",         es: "Exportar hoja de marcas (.cue) al terminar" },
  exportCueTip:            { en: "Downloads a .cue file with each transition's timestamps alongside the recording",
                              es: "Descarga un archivo .cue con los tiempos de cada transición junto con la grabación" },
  autoStream:              { en: "Live streaming (auto)",                         es: "Transmisión en vivo (auto)" },
  autoStreamTip:           { en: "Automatically starts the Icecast broadcast at set start and updates per-track metadata",
                              es: "Inicia la transmisión Icecast automáticamente al arrancar el set y actualiza los datos de cada pista" },
  beatjuggleLbl:           { en: "Beatjuggling (on slow tracks)",                 es: "Cortes rítmicos (en pistas lentas)" },
  beatjuggleTip:           { en: "Short A↔B cuts on the same beat for low-BPM tracks", es: "Pequeños cortes A↔B sobre el mismo beat en tracks de BPM bajo" },
  beatjuggleMaxBpm:        { en: "Beatjuggle max BPM",                            es: "BPM máximo para cortes rítmicos" },
  beatjuggleProb:          { en: "Beatjuggle probability (%)",                    es: "Probabilidad de cortes rítmicos (%)" },
  radioShow:               { en: "📻 Radio Show mode",                            es: "📻 Modo programa de radio" },
  radioShowTip:            { en: "Inserts jingles + DJ voice between tracks, radio-show style",
                              es: "Inserta jingles + voz del DJ entre pistas, estilo radio show" },
  radioJingleEvery:        { en: "Jingle every N tracks",                         es: "Jingle cada N pistas" },
  radioJingleTrack:        { en: "Jingle track (Library)",                        es: "Pista de cortina (Biblioteca)" },
  none:                    { en: "— none —",                                      es: "— ninguna —" },

  harmonic:                { en: "🎼 Harmonic Mixing AI (real Camelot)",          es: "🎼 Mezcla armónica con IA (Camelot real)" },
  harmonicTip:             { en: "Detects real key and reorders so each jump is Camelot-compatible",
                              es: "Detecta la tonalidad real y reordena para que cada salto sea compatible con Camelot" },
  acapellaLayerLbl:        { en: "🎤 Acapella & Instrumental Layering",           es: "🎤 Capas de acapela e instrumental" },
  acapellaProb:            { en: "Acapella probability (%)",                      es: "Probabilidad acapella (%)" },
  acapellaBars:            { en: "Layering bars",                                 es: "Compases de capas" },
  loopRoll:                { en: "🌀 Automatic Loop Roll",                        es: "🌀 Ráfaga de loop automática" },
  loopRollProb:            { en: "Loop Roll probability (%)",                     es: "Probabilidad de ráfaga de loop (%)" },
  energyMeter:             { en: "📊 Crowd Energy Meter (overlay)",               es: "📊 Medidor de energía del público (animación)" },
  reverseFx:               { en: "↩ Reverse Censor FX",                           es: "↩ Censor inverso" },
  reverseProb:             { en: "Reverse probability (%)",                       es: "Probabilidad de reversa (%)" },
  reverseBars:             { en: "Reverse bars",                                  es: "Compases en reversa" },
  dropBuilder:             { en: "🎢 Auto Drop Builder (riser+snare)",            es: "🎢 Constructor automático de subida (elevador+caja)" },
  dropBuilderProb:         { en: "Drop Builder probability (%)",                  es: "Probabilidad de subida automática (%)" },
  dropBuilderSec:          { en: "Riser duration (s)",                            es: "Duración del elevador (s)" },
  voiceCmd:                { en: "🎙 Voice Command Mode",                         es: "🎙 Modo de comandos por voz" },
  voiceCmdTip:             { en: "Say: 'next', 'pause', 'play', 'reverse', 'drop', 'scratch'",
                              es: "Di: 'siguiente', 'pausa', 'play', 'reverse', 'drop', 'scratch'" },
  autoMashup:              { en: "💥 Auto Mashup Generator",                      es: "💥 Generador automático de mashups" },
  autoMashupEvery:         { en: "Mashup every N tracks",                         es: "Mashup cada N pistas" },
  mixReportPdf:            { en: "📄 Mix Report PDF when finished",               es: "📄 Informe de mezcla PDF al finalizar" },

  // ===== v1.7.7: skin + smart autonomy =====
  defaultSkin:             { en: "Virtual DJ default skin",                       es: "Aspecto predeterminado del Virtual DJ" },
  defaultSkinTip:          { en: "Applied automatically when the Virtual DJ starts; the previous skin is restored on stop.",
                              es: "Se aplica automáticamente al iniciar el Virtual DJ; el aspecto previo se restaura al detener." },
  defaultSkinKeep:         { en: "— don't change —",                              es: "— no cambiar —" },
  smartAutopilot:          { en: "🤖 Smart autopilot",                            es: "🤖 Autopiloto inteligente" },
  smartAutopilotTip:       { en: "Auto-tunes intensity, transitions and FX based on time of day, BPM and crowd energy.",
                              es: "Ajusta solo intensidad, transiciones y FX según hora, BPM y energía del público." },
  autoRecover:             { en: "Auto-recover failed tracks",                    es: "Recuperación automática" },
  autoRecoverTip:          { en: "If a track fails to load, skip to the next one without breaking the mix.",
                              es: "Si una pista falla al cargar, salta a la siguiente sin romper la mezcla." },
  smartTighten:            { en: "Tight transitions (no gaps)",                   es: "Transiciones ajustadas (sin silencios)" },
  smartTightenTip:         { en: "Pre-load the next track earlier and pre-roll it muted so the crossfade has zero gap.",
                              es: "Precarga la siguiente pista antes y la prepara en silencio para una transición sin huecos." },
  showStatusOverlay:       { en: "Show 'mixing' overlay",                         es: "Mostrar animación de mezcla" },
  showStatusOverlayTip:    { en: "Floating animation that doesn't block your controls.", es: "Animación flotante que no bloquea tus controles." },

  // ===== Status overlay copy =====
  overlayMixing:           { en: "MIXING",                                        es: "MEZCLANDO" },
  overlayTrack:            { en: "Track {i} of {n}",                              es: "Pista {i} de {n}" },
  overlayLive:             { en: "LIVE",                                          es: "EN VIVO" },
  moodArc:                 { en: "🏔 Arc (chill → peak → cooldown)",             es: "🏔 Arco (relajado → pico → cierre)" },
  moodWave:                { en: "🌊 Waves",                                      es: "🌊 Olas" },
  untitled:                { en: "Untitled",                                      es: "Sin título" },
  aiSection:               { en: "🤖 Artificial intelligence",                    es: "🤖 Inteligencia artificial" },
  aiSetlist:               { en: "Smart Setlist (AI)",                            es: "Lista inteligente (IA)" },
  aiSetlistTip:            { en: "Automatically reorders the Virtual DJ queue with AI for a professional energy arc.",
                              es: "Reordena automáticamente la cola del Virtual DJ con IA para un arco de energía profesional." },
  aiCoach:                 { en: "DJ Coach (AI)",                                 es: "Entrenador DJ (IA)" },
  aiCoachTip:              { en: "When the set ends, AI gives you professional feedback in natural language.",
                              es: "Al terminar el set, la IA te da comentarios profesionales en lenguaje natural." },

} as const;

export type VdjStrKey = keyof typeof VDJ_STR;

function getLang(): VdjLang {
  const l = useApp.getState().settings.lang;
  return l === "es" ? "es" : "en"; // pt/fr/it temporarily fall back to EN
}

function interp(s: string, params?: Record<string, string | number>): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
}

/** Non-reactive translator (use in toasts, engine code). */
export function vt(key: VdjStrKey, params?: Record<string, string | number>): string {
  const lang = getLang();
  const entry = VDJ_STR[key] as { en: string; es: string };
  return interp(entry[lang], params);
}

/** Reactive hook (rerenders when language changes). */
export function useVt() {
  const lang = useApp((s) => s.settings.lang) === "es" ? "es" : "en";
  return (key: VdjStrKey, params?: Record<string, string | number>): string => {
    const entry = VDJ_STR[key] as { en: string; es: string };
    return interp(entry[lang as VdjLang], params);
  };
}
