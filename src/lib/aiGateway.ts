/**
 * Shared helpers for the AI server routes (`/api/ai/*`). Centralizes the
 * Lovable AI Gateway URL, default model selection and error handling so each
 * endpoint stays small and consistent.
 *
 * IMPORTANT: This module is server-only — it reads `LOVABLE_API_KEY` from the
 * environment. Never import it from client code.
 */
export const AI_GATEWAY_URL =
  "https://ai.gateway.lovable.dev/v1/chat/completions";

/** Default model — Gemini Flash preview is fast, cheap and stable. */
export const DEFAULT_AI_MODEL = "google/gemini-3-flash-preview";

export interface AiChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
}

export interface AiToolCall {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

export interface AiCallOptions {
  model?: string;
  messages: AiChatMessage[];
  tools?: AiToolCall[];
  tool_choice?: unknown;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

/** Map gateway HTTP errors to friendly Response objects. */
export function aiErrorResponse(status: number, fallback?: string): Response {
  if (status === 429) {
    return new Response(
      JSON.stringify({ error: "rate_limited", message: "Demasiadas solicitudes a la IA. Intenta de nuevo en unos segundos." }),
      { status: 429, headers: { "Content-Type": "application/json" } },
    );
  }
  if (status === 402) {
    return new Response(
      JSON.stringify({ error: "payment_required", message: "Se agotaron los créditos de Lovable AI. Agrega créditos en Settings → Workspace → Usage." }),
      { status: 402, headers: { "Content-Type": "application/json" } },
    );
  }
  return new Response(
    JSON.stringify({ error: "ai_gateway_error", message: fallback ?? "Error en la pasarela de IA." }),
    { status: 500, headers: { "Content-Type": "application/json" } },
  );
}

/** Issue a non-streaming completion call and return the parsed JSON body. */
export async function callAi(opts: AiCallOptions): Promise<{ ok: true; data: any } | { ok: false; response: Response }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: "missing_api_key", message: "LOVABLE_API_KEY no está configurado." }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      ),
    };
  }
  const body: Record<string, unknown> = {
    model: opts.model ?? DEFAULT_AI_MODEL,
    messages: opts.messages,
  };
  if (opts.tools) body.tools = opts.tools;
  if (opts.tool_choice) body.tool_choice = opts.tool_choice;
  if (opts.temperature != null) body.temperature = opts.temperature;
  if (opts.max_tokens != null) body.max_tokens = opts.max_tokens;

  let res: Response;
  try {
    res = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: "network_error", message: e instanceof Error ? e.message : "Network error" }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      ),
    };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[ai] gateway error", res.status, text);
    return { ok: false, response: aiErrorResponse(res.status, text || undefined) };
  }
  const data = await res.json().catch(() => null);
  if (!data) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: "bad_gateway_response", message: "Respuesta inválida de la IA." }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      ),
    };
  }
  return { ok: true, data };
}

/** Stream a completion call straight back to the caller as SSE. */
export async function streamAi(opts: AiCallOptions): Promise<Response> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "missing_api_key", message: "LOVABLE_API_KEY no está configurado." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  let res: Response;
  try {
    res = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: opts.model ?? DEFAULT_AI_MODEL,
        messages: opts.messages,
        stream: true,
        ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
      }),
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "network_error", message: e instanceof Error ? e.message : "Network error" }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    console.error("[ai] stream gateway error", res.status, text);
    return aiErrorResponse(res.status, text || undefined);
  }
  return new Response(res.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}