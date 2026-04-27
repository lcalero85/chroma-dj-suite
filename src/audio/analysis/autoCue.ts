/**
 * Detect the first significant transient in an AudioBuffer and return its
 * position in seconds. Used to auto-set a track's cue point on import/load,
 * so pressing CUE jumps to the actual musical "1" instead of leading silence.
 *
 * Algorithm: downsample to ~4kHz mono, walk a 20ms RMS envelope, and pick the
 * first window whose RMS exceeds (peakRms * threshold). Falls back to 0 if no
 * transient is found (e.g. the whole buffer is silence).
 */
export function detectFirstTransient(buffer: AudioBuffer, threshold = 0.18): number {
  const sr = buffer.sampleRate;
  const ch0 = buffer.getChannelData(0);
  const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : ch0;
  const win = Math.max(1, Math.floor(sr * 0.02)); // 20ms windows
  const total = ch0.length;
  // First pass: find the peak RMS over the first 60s (limit work).
  const limit = Math.min(total, Math.floor(sr * 60));
  let peak = 0;
  const env: number[] = [];
  for (let i = 0; i + win < limit; i += win) {
    let s = 0;
    for (let j = 0; j < win; j++) {
      const v = (ch0[i + j] + ch1[i + j]) * 0.5;
      s += v * v;
    }
    const rms = Math.sqrt(s / win);
    env.push(rms);
    if (rms > peak) peak = rms;
  }
  if (peak < 1e-4 || env.length === 0) return 0;
  const trig = peak * threshold;
  for (let i = 0; i < env.length; i++) {
    if (env[i] >= trig) {
      // Snap a few ms earlier to land just before the attack.
      const t = (i * win) / sr;
      return Math.max(0, t - 0.01);
    }
  }
  return 0;
}