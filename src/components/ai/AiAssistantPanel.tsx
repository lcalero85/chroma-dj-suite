import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Sparkles, Trash2 } from "lucide-react";

/**
 * In-app conversational assistant powered by Lovable AI Gateway. Streams
 * tokens via SSE for instant feedback. The UI is intentionally minimal so it
 * fits in the existing right-side drawer.
 */
interface Msg { role: "user" | "assistant"; content: string }

const STORAGE_KEY = "vdj-ai-chat-history-v1";

function loadHistory(): Msg[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.slice(-30);
  } catch { /* noop */ }
  return [];
}

function saveHistory(msgs: Msg[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-30))); } catch { /* noop */ }
}

export function AiAssistantPanel() {
  const [messages, setMessages] = useState<Msg[]>(() => loadHistory());
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { saveHistory(messages); }, [messages]);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setError(null);
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    let acc = "";
    let firstToken = false;
    const upsert = (chunk: string) => {
      acc += chunk;
      setMessages((prev) => {
        if (!firstToken) {
          firstToken = true;
          return [...prev, { role: "assistant", content: acc }];
        }
        const copy = prev.slice();
        copy[copy.length - 1] = { role: "assistant", content: acc };
        return copy;
      });
    };

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
        signal: ctrl.signal,
      });
      if (res.status === 429) { setError("Demasiadas solicitudes. Intenta en unos segundos."); setBusy(false); return; }
      if (res.status === 402) { setError("Créditos agotados. Agrega créditos en Settings → Workspace → Usage."); setBusy(false); return; }
      if (!res.ok || !res.body) { setError("La IA no está disponible ahora."); setBusy(false); return; }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;
      while (!done) {
        const { value, done: rd } = await reader.read();
        if (rd) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line || line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const delta: string | undefined = parsed?.choices?.[0]?.delta?.content;
            if (delta) upsert(delta);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e) {
      if ((e as any)?.name !== "AbortError") {
        console.warn("[chat] error", e);
        setError("Error de red al hablar con la IA.");
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function clearChat() {
    setMessages([]);
    setError(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-dim, #888)" }}>
        <Sparkles size={14} />
        <span>Asistente IA · pregúntame cómo usar VDJ PRO</span>
        <div style={{ marginLeft: "auto" }}>
          <button className="vdj-btn" onClick={clearChat} title="Limpiar conversación" style={{ padding: 4 }}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          background: "rgba(0,0,0,0.25)",
          borderRadius: 8,
          padding: 10,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          minHeight: 240,
        }}
      >
        {messages.length === 0 && (
          <div style={{ color: "var(--text-dim, #888)", fontSize: 12, textAlign: "center", marginTop: 40 }}>
            Escribe una pregunta. Ej: <em>"¿Cómo grabo mi sesión?"</em>, <em>"¿Cómo activo el Virtual DJ?"</em>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              padding: "8px 10px",
              borderRadius: 10,
              fontSize: 13,
              lineHeight: 1.45,
              whiteSpace: "pre-wrap",
              background: m.role === "user" ? "rgba(80, 140, 255, 0.18)" : "rgba(255,255,255,0.06)",
              border: m.role === "user" ? "1px solid rgba(80,140,255,0.35)" : "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {m.content || (busy && i === messages.length - 1 ? "…" : "")}
          </div>
        ))}
      </div>

      {error && (
        <div style={{ color: "#ff7676", fontSize: 12, padding: "4px 6px" }}>{error}</div>
      )}

      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="text"
          className="vdj-btn"
          placeholder="Pregunta algo…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          style={{ flex: 1, textAlign: "left", padding: "8px 10px", fontSize: 13 }}
          disabled={busy}
        />
        <button className="vdj-btn" onClick={() => void send()} disabled={busy || !input.trim()} title="Enviar">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>
    </div>
  );
}