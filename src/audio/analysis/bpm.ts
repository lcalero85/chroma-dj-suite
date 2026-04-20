// Approximate BPM detection via offline rendering + onset autocorrelation.
// Returns BPM in 70..180 range.

export async function detectBPM(buffer: AudioBuffer): Promise<number> {
  const sampleRate = 8000;
  const duration = Math.min(buffer.duration, 30);
  const offline = new OfflineAudioContext(1, Math.floor(sampleRate * duration), sampleRate);
  const src = offline.createBufferSource();
  src.buffer = buffer;
  // Lowpass to focus on kick energy
  const lp = offline.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 150;
  src.connect(lp);
  lp.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();
  const data = rendered.getChannelData(0);

  // Energy envelope (windowed RMS)
  const win = 256;
  const env: number[] = [];
  for (let i = 0; i < data.length; i += win) {
    let s = 0;
    for (let j = 0; j < win && i + j < data.length; j++) s += data[i + j] * data[i + j];
    env.push(Math.sqrt(s / win));
  }
  // Differentiate (onset-ish)
  const onset = env.map((v, i) => Math.max(0, v - (env[i - 1] ?? 0)));
  const envSampleRate = sampleRate / win;

  // Autocorrelation across plausible BPM range
  let bestBpm = 120;
  let bestScore = -Infinity;
  for (let bpm = 70; bpm <= 180; bpm += 0.5) {
    const lag = Math.round((60 / bpm) * envSampleRate);
    if (lag <= 0 || lag >= onset.length) continue;
    let s = 0;
    for (let i = 0; i + lag < onset.length; i++) s += onset[i] * onset[i + lag];
    if (s > bestScore) {
      bestScore = s;
      bestBpm = bpm;
    }
  }
  return Math.round(bestBpm * 10) / 10;
}

export async function extractPeaks(buffer: AudioBuffer, count = 1024): Promise<number[]> {
  const channel = buffer.getChannelData(0);
  const blockSize = Math.max(1, Math.floor(channel.length / count));
  const peaks: number[] = new Array(count);
  for (let i = 0; i < count; i++) {
    let max = 0;
    const start = i * blockSize;
    const end = Math.min(start + blockSize, channel.length);
    for (let j = start; j < end; j++) {
      const v = Math.abs(channel[j]);
      if (v > max) max = v;
    }
    peaks[i] = max;
  }
  // normalize
  const m = Math.max(...peaks, 0.0001);
  return peaks.map((p) => p / m);
}