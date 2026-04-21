/**
 * Lightweight loudness estimation: integrated RMS in dBFS using a downsample
 * pass over the decoded buffer. Not full EBU R128, but enough to flatten the
 * perceived volume between tracks within ~±1 dB.
 *
 * Returns { rmsDb, gainOffsetDb } where gainOffsetDb is the dB delta required
 * to bring the track to TARGET_DB. Applied as a linear multiplier on the
 * channel-gain node when the track is loaded.
 */
const TARGET_DB = -14; // streaming-friendly target (similar to Spotify/YT)
const MIN_DB = -36;
const MAX_DB = 0;
const MAX_BOOST_DB = 8;   // never amplify quiet recordings past +8 dB
const MAX_CUT_DB = -12;   // never cut hot masters more than -12 dB

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

export function analyzeLoudness(buffer: AudioBuffer): { rmsDb: number; gainOffsetDb: number } {
  // Downsample to ~200 windows of 50ms each, average the loudest 60% (gated).
  const win = Math.floor(buffer.sampleRate * 0.05);
  const channels = Math.min(2, buffer.numberOfChannels);
  const ch0 = buffer.getChannelData(0);
  const ch1 = channels > 1 ? buffer.getChannelData(1) : ch0;
  const total = ch0.length;
  const windows: number[] = [];
  for (let i = 0; i + win < total; i += win) {
    let sum = 0;
    for (let j = 0; j < win; j++) {
      const s = (ch0[i + j] + ch1[i + j]) * 0.5;
      sum += s * s;
    }
    const rms = Math.sqrt(sum / win);
    if (rms > 1e-5) windows.push(rms);
  }
  if (windows.length === 0) return { rmsDb: MIN_DB, gainOffsetDb: 0 };
  // Sort and pick the upper 60% (gate silence/intros)
  windows.sort((a, b) => b - a);
  const keep = Math.max(1, Math.floor(windows.length * 0.6));
  let acc = 0;
  for (let i = 0; i < keep; i++) acc += windows[i] * windows[i];
  const rms = Math.sqrt(acc / keep);
  const rmsDb = Math.max(MIN_DB, Math.min(MAX_DB, 20 * Math.log10(rms)));
  let offset = TARGET_DB - rmsDb;
  offset = Math.max(MAX_CUT_DB, Math.min(MAX_BOOST_DB, offset));
  return { rmsDb, gainOffsetDb: offset };
}