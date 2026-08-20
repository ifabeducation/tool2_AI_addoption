"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Send, Sparkles } from "lucide-react";
import {
  BLOCK2_INTERVIEW_GROUPS,
  BLOCK2_INTERVIEW_GROUP_COUNT,
  INITIAL_MESSAGE_USE_CASE_INTERVIEW,
  remainingInterviewGroups,
} from "@/config/block2Form";
import { Block2FieldValue, ChatMessage } from "@/lib/types";
import { MicButton, SpeakToggle, useDictation, useSpeech } from "./VoiceInput";

export type InterviewTurn = {
  chatLog: ChatMessage[];
  fields: Record<string, Block2FieldValue>;
  closedGroups: string[];
};

/**
 * Step 4 — l'intervista che compila la scheda Use Case. Il partecipante
 * racconta (scrivendo o a voce), l'agente ricava i campi del modulo: si parte
 * dalla domanda generica su com'è il processo oggi, poi l'agente chiede solo
 * quello che non ha ancora sentito, un argomento per volta (gli argomenti
 * raggruppano i campi che si possono raccogliere con una domanda sola).
 * Quando non resta più nulla da chiedere si passa alla scheda da confermare.
 */
export default function UseCaseInterview({
  processoContext,
  values,
  closedGroups,
  chatLog,
  initialInput,
  onTurn,
  onDone,
  onOpenScheda,
}: {
  processoContext: string;
  values: Record<string, Block2FieldValue>;
  closedGroups: string[];
  chatLog: ChatMessage[];
  /** Domanda già scritta nel campo: si arriva così dal "Chiedi all'assistente" della scheda. */
  initialInput?: string;
  onTurn: (turn: InterviewTurn) => void;
  onDone: () => void;
  onOpenScheda: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    chatLog.length > 0 ? chatLog : [{ role: "assistant", content: INITIAL_MESSAGE_USE_CASE_INTERVIEW }]
  );
  const [input, setInput] = useState(initialInput ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Stato dell'intervista tenuto anche qui: il turno successivo deve partire da
  // quello che ha risposto il server, non dallo stato del componente padre
  // (che si aggiorna un attimo dopo).
  const [closed, setClosed] = useState<string[]>(closedGroups);
  const valuesRef = useRef<Record<string, Block2FieldValue>>(values);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const dictation = useDictation((text) => {
    setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
  });
  const speech = useSpeech();

  const remaining = remainingInterviewGroups(closed);
  const corrente = remaining[0];
  const coperti = BLOCK2_INTERVIEW_GROUP_COUNT - remaining.length;

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Si arriva qui anche dalla scheda, con una domanda già scritta: il campo va
  // messo a fuoco, altrimenti la domanda passa inosservata in fondo alla pagina.
  useEffect(() => {
    if (initialInput) inputRef.current?.focus();
  }, [initialInput]);

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const testo = input.trim();
    if (!testo || loading) return;

    dictation.stop();
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: testo }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subsection: "useCaseInterview",
          messages: nextMessages,
          context: { processoContext, values: valuesRef.current, closedGroups: closed },
        }),
      });
      const data = await res.json();

      if (data.error) {
        setMessages([...nextMessages, { role: "assistant", content: `Si è verificato un errore: ${data.error}` }]);
        return;
      }

      const reply: string = data.reply ?? "";
      const fields: Record<string, Block2FieldValue> = data.fields ?? {};
      const nuoviChiusi: string[] = Array.isArray(data.closedGroups) ? data.closedGroups : closed;

      const finalMessages: ChatMessage[] = [...nextMessages, { role: "assistant", content: reply }];
      setMessages(finalMessages);
      setClosed(nuoviChiusi);
      valuesRef.current = { ...valuesRef.current, ...fields };
      onTurn({ chatLog: finalMessages, fields, closedGroups: nuoviChiusi });
      speech.speak(reply);

      if (data.done) onDone();
    } catch {
      setError("Errore di connessione: riprova a inviare la risposta.");
      setMessages(nextMessages);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section>
        <h2 className="mb-1 text-lg font-semibold text-ifab-navy">Step 4 · Il tuo caso d&apos;uso</h2>
        <p className="text-sm text-ifab-text-muted">
          Non c&apos;è un modulo da compilare: raccontalo all&apos;assistente, a voce o scrivendo. Alla fine ti
          mostra la scheda già compilata da confermare o correggere.
        </p>
      </section>

      <section className="rounded-xl border border-ifab-border bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-ifab-text-muted">
            {corrente ? (
              <>
                Argomento {coperti + 1} di {BLOCK2_INTERVIEW_GROUP_COUNT} ·{" "}
                <span className="text-ifab-navy">{corrente.titolo}</span>
              </>
            ) : (
              <span className="text-emerald-600">Tutti gli argomenti coperti: la scheda è pronta.</span>
            )}
          </p>
          <span className="text-xs text-ifab-text-muted">
            {coperti}/{BLOCK2_INTERVIEW_GROUP_COUNT}
          </span>
        </div>
        <div className="mt-2 flex gap-1">
          {BLOCK2_INTERVIEW_GROUPS.map((g) => (
            <span
              key={g.key}
              title={g.titolo}
              className={`h-1.5 flex-1 rounded-full ${
                closed.includes(g.key) ? "bg-ifab-blue" : "bg-ifab-border"
              }`}
            />
          ))}
        </div>
      </section>

      <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-ifab-border bg-white">
        <div className="flex items-center gap-2 border-b border-ifab-border bg-ifab-bg-soft px-4 py-2.5">
          <Sparkles size={16} className="text-ifab-blue" />
          <span className="text-sm font-medium text-ifab-navy">Assistente AI</span>
          <span className="ml-auto flex items-center gap-1">
            <SpeakToggle speech={speech} />
          </span>
        </div>

        <div
          ref={containerRef}
          className="ifab-scrollbar flex max-h-[26rem] flex-col gap-2 overflow-y-auto px-4 py-3"
        >
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-ifab-blue text-white"
                    : "bg-ifab-bg-soft text-ifab-text border border-ifab-border"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-1 pl-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ifab-blue" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ifab-blue [animation-delay:0.1s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ifab-blue [animation-delay:0.2s]" />
            </div>
          )}
        </div>

        <form onSubmit={handleSend} className="border-t border-ifab-border p-2.5">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                // Invio manda la risposta, Maiusc+Invio va a capo: le risposte
                // parlate sono lunghe e capita di volerle spezzare.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              rows={2}
              disabled={loading}
              placeholder={
                dictation.listening ? "Sto ascoltando: parla pure..." : "Scrivi la tua risposta o usa il microfono..."
              }
              className="ifab-scrollbar max-h-40 flex-1 resize-y rounded-lg border border-ifab-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ifab-blue disabled:bg-ifab-bg-soft"
            />
            <MicButton dictation={dictation} disabled={loading} />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex shrink-0 items-center justify-center rounded-lg bg-ifab-blue px-3 py-2 text-white transition hover:bg-ifab-blue-dark disabled:bg-ifab-text-muted"
            >
              <Send size={16} />
            </button>
          </div>

          {dictation.interim && (
            <p className="mt-1.5 px-1 text-xs italic text-ifab-text-muted">{dictation.interim}</p>
          )}
          {dictation.error && <p className="mt-1.5 px-1 text-xs text-amber-700">{dictation.error}</p>}
          {error && <p className="mt-1.5 px-1 text-xs text-red-600">{error}</p>}
        </form>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onOpenScheda}
          className="flex items-center gap-2 rounded-lg border border-ifab-navy px-4 py-2 text-sm font-semibold text-ifab-navy transition hover:bg-ifab-navy hover:text-white"
        >
          Vai alla scheda <ArrowRight size={15} />
        </button>
        <span className="text-xs text-ifab-text-muted">
          Puoi passare alla scheda quando vuoi: quello che manca lo completi a mano, o torni qui a parlarne.
        </span>
      </div>
    </div>
  );
}
