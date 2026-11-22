import { createParser } from "eventsource-parser";
import { toast } from "sonner";

const SAMPLE_RATE = 24000;
const speechCache = new Map<string, Float32Array<ArrayBuffer>>();
let activeSpeech: AbortController | null = null;
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

export function speak(text: string) {
  const cleaned = text.trim();
  if (!cleaned || typeof window === "undefined") return;
  activeSpeech?.abort();
  const controller = new AbortController();
  activeSpeech = controller;
  void playSpeech(cleaned, controller.signal).catch((error: unknown) => {
    if (controller.signal.aborted) return;
    toast.error(error instanceof Error ? error.message : "Não consegui tocar a voz agora. Tente novamente.");
  }).finally(() => {
    if (activeSpeech === controller) activeSpeech = null;
  });
}

async function responseError(response: Response) {
  const raw = await response.text();
  try {
    const data = JSON.parse(raw) as { message?: string; error?: string | { message?: string } };
    if (data.message) return data.message;
    if (typeof data.error === "string") return data.error;
    if (data.error?.message) return data.error.message;
  } catch {
    // The fallback below is safe for non-JSON upstream responses.
  }
  return raw || "Não consegui tocar a voz agora. Tente novamente.";
}

async function openAudioContext() {
  const context = new AudioContext({ sampleRate: SAMPLE_RATE });
  if (context.state === "suspended") await context.resume();
  if (context.state !== "running") {
    await context.close();
    throw new Error("Toque em Ouvir para liberar o som do aparelho.");
  }
  return context;
}

async function playSpeech(text: string, signal: AbortSignal) {
  signal.throwIfAborted();
  const cached = speechCache.get(text);
  if (cached) {
    await playCached(cached, signal);
    return;
  }
  await streamSpeech(text, signal);
}

async function playCached(samples: Float32Array<ArrayBuffer>, signal: AbortSignal) {
  const context = await openAudioContext();
  try {
    signal.throwIfAborted();
    const source = context.createBufferSource();
    const buffer = context.createBuffer(1, samples.length, SAMPLE_RATE);
    buffer.copyToChannel(samples, 0);
    source.buffer = buffer;
    source.connect(context.destination);
    const abort = () => source.stop();
    signal.addEventListener("abort", abort, { once: true });
    try {
      await new Promise<void>((resolve) => {
        source.onended = () => resolve();
        source.start(context.currentTime + 0.03);
      });
      signal.throwIfAborted();
    } finally {
      signal.removeEventListener("abort", abort);
    }
  } finally {
    await context.close();
  }
}

function decodePCM(pending: Uint8Array, incoming: Uint8Array) {
  const bytes = new Uint8Array(pending.length + incoming.length);
  bytes.set(pending);
  bytes.set(incoming, pending.length);
  const usable = bytes.length - (bytes.length % 2);
  const view = new DataView(bytes.buffer);
  const samples = new Float32Array(usable / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
  return { samples, pending: bytes.slice(usable) };
}

async function streamSpeech(text: string, signal: AbortSignal) {
  const context = await openAudioContext();
  try {
    signal.throwIfAborted();
    let samples: Float32Array<ArrayBuffer>;
    try {
      samples = await fetchSpeech(text, signal);
    } catch (error) {
      signal.throwIfAborted();
      if (!(error instanceof IncompleteAudioError)) throw error;
      samples = await fetchSpeech(text, signal);
    }
    signal.throwIfAborted();
    speechCache.set(text, samples);
    const buffer = context.createBuffer(1, samples.length, SAMPLE_RATE);
    buffer.copyToChannel(samples, 0);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const abort = () => source.stop();
    signal.addEventListener("abort", abort, { once: true });
    try {
      await new Promise<void>((resolve) => {
        source.onended = () => resolve();
        source.start(context.currentTime + 0.03);
      });
      signal.throwIfAborted();
    } finally {
      signal.removeEventListener("abort", abort);
    }
  } finally {
    await context.close();
  }
}

class IncompleteAudioError extends Error {
  constructor() {
    super("Não consegui tocar a voz agora. Toque em Ouvir para tentar novamente.");
  }
}

async function fetchSpeech(text: string, signal: AbortSignal): Promise<Float32Array<ArrayBuffer>> {
  const chunks: Float32Array<ArrayBuffer>[] = [];
  let pending = new Uint8Array(0);
  let completed = false;
  let sampleCount = 0;

  try {
    const response = await fetch("/api/fala", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal,
    });
    if (!response.ok || !response.body) throw new Error(await responseError(response));

    const parser = createParser({
      onEvent(event) {
        const payload = JSON.parse(event.data) as { type?: string; audio?: string; error?: unknown; message?: string };
        if (payload.type === "error" || payload.error) {
          throw new Error(payload.message || (typeof payload.error === "string" ? payload.error : "A voz foi interrompida. Tente novamente."));
        }
        if (payload.type === "speech.audio.done") {
          completed = true;
          return;
        }
        if (payload.type !== "speech.audio.delta") return;
        if (completed || !payload.audio) throw new IncompleteAudioError();

        const decoded = decodePCM(pending, Uint8Array.from(atob(payload.audio), (character) => character.charCodeAt(0)));
        pending = new Uint8Array(decoded.pending);
        if (!decoded.samples.length) return;
        chunks.push(decoded.samples);
        sampleCount += decoded.samples.length;
      },
    });

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        parser.feed(next.value);
      }
      parser.reset({ consume: true });
    } finally {
      reader.releaseLock();
    }

    if (!completed || !sampleCount || pending.length) throw new IncompleteAudioError();
    const completeSamples = new Float32Array(sampleCount);
    let offset = 0;
    for (const chunk of chunks) {
      completeSamples.set(chunk, offset);
      offset += chunk.length;
    }
    return completeSamples;
  } catch (error) {
    signal.throwIfAborted();
    throw error;
  }
}
