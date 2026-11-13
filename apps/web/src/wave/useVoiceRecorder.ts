import { useCallback, useEffect, useRef, useState } from "react";

export interface VoiceRecorder {
  recording: boolean;
  elapsedSec: number;
  start: () => Promise<void>;
  stop: () => void;
}

/** MediaRecorder wrapper. Calls `onComplete` with the recorded file when stopped. */
export function useVoiceRecorder(
  onComplete: (file: File, durationSec: number) => void,
  onError: (message: string) => void,
): VoiceRecorder {
  const [recording, setRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const startedAtRef = useRef(0);
  const cbRef = useRef({ onComplete, onError });
  cbRef.current = { onComplete, onError };

  const cleanup = useCallback(() => {
    window.clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setRecording(false);
  }, []);

  const start = useCallback(async () => {
    if (recorderRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      cbRef.current.onError("Voice notes aren\u2019t supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const duration = (Date.now() - startedAtRef.current) / 1000;
        const type = recorder.mimeType || "audio/webm";
        const ext = type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : "webm";
        const file = new File(chunks, `voice-note-${Date.now()}.${ext}`, { type });
        cleanup();
        if (file.size > 0) cbRef.current.onComplete(file, duration);
      };
      streamRef.current = stream;
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsedSec(0);
      timerRef.current = window.setInterval(() => setElapsedSec((Date.now() - startedAtRef.current) / 1000), 250);
      recorder.start();
      setRecording(true);
    } catch {
      cleanup();
      cbRef.current.onError("Couldn\u2019t reach the microphone. Check the browser permission and try again.");
    }
  }, [cleanup]);

  const stop = useCallback(() => {
    const r = recorderRef.current;
    if (r && r.state !== "inactive") r.stop();
  }, []);

  useEffect(
    () => () => {
      const r = recorderRef.current;
      if (r) {
        r.onstop = null;
        if (r.state !== "inactive") r.stop();
      }
      window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  return { recording, elapsedSec, start, stop };
}
