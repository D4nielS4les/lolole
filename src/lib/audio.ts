import recordings from "./speech-recordings.json";
import { toast } from "sonner";

let activeSpeech: { stop: () => void } | null = null;
let effectContext: AudioContext | null = null;

type Effect = "tap" | "success" | "error" | "complete";

function tone(context: AudioContext, frequency: number, offset: number, duration: number, volume: number, type: OscillatorType = "sine") {
  const start = context.currentTime + offset;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function scheduleEffect(context: AudioContext, effect: Effect) {
  if (effect === "tap") {
    tone(context, 440, 0, 0.07, 0.035, "triangle");
    return;
  }
  const notes = effect === "success"
    ? [523.25, 659.25, 783.99]
    : effect === "complete"
      ? [523.25, 659.25, 783.99, 1046.5]
      : [220, 174.61];
  notes.forEach((frequency, index) => {
    tone(context, frequency, index * 0.09, effect === "error" ? 0.18 : 0.24, 0.065, effect === "error" ? "sawtooth" : "sine");
  });
}

export function playEffect(effect: Effect) {
  if (typeof window === "undefined") return;
  try {
    effectContext ??= new AudioContext();
    const context = effectContext;
    if (context.state === "suspended") {
      void context.resume().then(() => scheduleEffect(context, effect)).catch(() => {
        toast.error("Toque novamente para liberar o som do aparelho.");
      });
    } else {
      scheduleEffect(context, effect);
    }
  } catch {
    toast.error("Não consegui tocar o som. Verifique o volume do aparelho.");
  }
}

export function speak(text: string): Promise<void> {
  const cleaned = text.trim();
  if (!cleaned || typeof window === "undefined") return Promise.resolve();

  activeSpeech?.stop();
  activeSpeech = null;
  const source = (recordings as Record<string, string>)[cleaned];
  if (!source) {
    toast.error("Essa fala ainda não está disponível.");
    return Promise.resolve();
  }

  const audio = new Audio(source);
  return new Promise<void>((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      if (activeSpeech === playback) activeSpeech = null;
      resolve();
    };
    const playback = { stop: () => { audio.pause(); finish(); } };
    const reportError = () => {
      if (finished) return;
      toast.error("Não consegui tocar a voz. Toque em Ouvir para tentar novamente.");
      finish();
    };
    const timeout = window.setTimeout(() => { audio.pause(); reportError(); }, 15000);
    activeSpeech = playback;
    audio.onended = finish;
    audio.onerror = reportError;
    void audio.play().catch(reportError);
  });
}
