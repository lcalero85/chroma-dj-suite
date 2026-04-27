import { createFileRoute } from "@tanstack/react-router";
import { streamAi, type AiChatMessage } from "@/lib/aiGateway";

/**
 * In-app conversational assistant. Streams replies (SSE) so the UI can render
 * tokens as they arrive. The system prompt scopes the assistant to VDJ PRO
 * usage, so it stays on-topic without revealing implementation details.
 */
const SYSTEM_PROMPT =
  "Eres el asistente integrado de VDJ PRO, una aplicación profesional de DJ en el navegador. " +
  "Ayudas al usuario con cómo usar la app: decks, mixer, FX, AutoMix, Virtual DJ, library, " +
  "stream, MIDI, atajos, grabaciones. Responde siempre en el mismo idioma del usuario. " +
  "Sé breve, claro y profesional. Si no sabes una respuesta, dilo y sugiere una alternativa. " +
  "No inventes funciones que no existen.";

export const Route = createFileRoute("/api/ai/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let payload: any;
        try { payload = await request.json(); } catch {
          return Response.json({ error: "bad_request" }, { status: 400 });
        }
        const incoming: AiChatMessage[] = Array.isArray(payload?.messages) ? payload.messages : [];
        const sanitized: AiChatMessage[] = incoming
          .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .slice(-20)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
        if (sanitized.length === 0) {
          return Response.json({ error: "empty_messages" }, { status: 400 });
        }
        return streamAi({
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...sanitized],
          temperature: 0.6,
        });
      },
    },
  },
});