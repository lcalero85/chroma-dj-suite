import { getEngine } from "./engine";

let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let startTs = 0;

export function startRecording(): void {
  const { recorderDest } = getEngine();
  if (recorder && recorder.state === "recording") return;
  chunks = [];
  const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : "audio/webm";
  recorder = new MediaRecorder(recorderDest.stream, { mimeType: mime, audioBitsPerSecond: 256000 });
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  recorder.start(1000);
  startTs = Date.now();
}

export function isRecording() {
  return !!recorder && recorder.state === "recording";
}

export function recordingElapsed() {
  return isRecording() ? (Date.now() - startTs) / 1000 : 0;
}

export async function stopRecording(): Promise<{ blob: Blob; mime: string; duration: number } | null> {
  if (!recorder) return null;
  const mime = recorder.mimeType;
  const duration = (Date.now() - startTs) / 1000;
  return new Promise((resolve) => {
    recorder!.onstop = () => {
      const blob = new Blob(chunks, { type: mime });
      recorder = null;
      chunks = [];
      resolve({ blob, mime, duration });
    };
    recorder!.stop();
  });
}