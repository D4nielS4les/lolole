import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const speechSchema = z.object({ text: z.string().trim().min(1).max(120) });

export const Route = createFileRoute("/api/fala")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ message: "Não consegui entender o pedido de voz." }, { status: 400 });
        }

        const parsed = speechSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ message: "Escolha um texto curto para o Lololê falar." }, { status: 400 });
        }

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return Response.json({ message: "A voz do Lololê ainda não está configurada." }, { status: 503 });
        }

        try {
          const upstream = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-3.1-flash-tts-preview",
              contents: [{
                role: "user",
                parts: [{ text: `Fale alegremente, com clareza e um pouco devagar, em português do Brasil: ${parsed.data.text}` }],
              }],
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
              },
              stream_format: "sse",
            }),
          });

          return new Response(upstream.body, {
            status: upstream.status,
            headers: {
              "Content-Type": upstream.headers.get("Content-Type") ?? "text/event-stream; charset=utf-8",
              "Cache-Control": "no-cache",
            },
          });
        } catch {
          return Response.json({ message: "Não consegui alcançar a voz agora. Tente novamente." }, { status: 502 });
        }
      },
    },
  },
});
