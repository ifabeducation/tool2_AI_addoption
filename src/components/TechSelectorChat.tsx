"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Send, Sparkles, Wand2 } from "lucide-react";
import {
  INITIAL_MESSAGE_TECH_SELECTOR,
  ProcessCategoryKey,
  StrategicObjectiveKey,
  TECH_SELECTOR_GROUP_COUNT,
  TECH_SELECTOR_GROUPS,
  TechMatchResult,
  remainingTechSelectorGroups,
} from "@/config/techSelector";
import { PRIORITY_QUADRANTS } from "@/config/priorityFramework";
import { ChatMessage } from "@/lib/types";
import { MicButton, SpeakToggle, useDictation, useSpeech } from "./VoiceInput";

/**
 * Materiale di riferimento del workshop: la matrice Impatto × Sforzo (Quick
 * Win, Strategic Bet, Fill-in, Money Pit) usata anche nella valutazione di
 * priorità dello Step 5. È un'illustrazione statica, non un grafico dati:
 * stesso principio di MatriceImpattoProntezza.tsx, in SVG inline così resta
 * leggibile in entrambi i temi senza dipendere da un file immagine esterno.
 */
function FrameworkFigure() {
  const W = 460;
  const H = 230;
  const GRID = { x: 60, y: 14, w: 380, h: 176 };
  const cols = [GRID.x, GRID.x + GRID.w / 2, GRID.x + GRID.w];
  const rows = [GRID.y, GRID.y + GRID.h / 2, GRID.y + GRID.h];

  const quadrants = [
    { key: "quickWin", x: cols[0], y: rows[0] },
    { key: "strategicBet", x: cols[1], y: rows[0] },
    { key: "fillIn", x: cols[0], y: rows[1] },
    { key: "moneyPit", x: cols[1], y: rows[1] },
  ] as const;

  return (
    <figure className="rounded-xl border border-ifab-border bg-white p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Matrice Impatto per Sforzo: Quick Win, Strategic Bet, Fill-in, Money Pit">
        {quadrants.map((q) => (
          <g key={q.key}>
            <rect x={q.x} y={q.y} width={GRID.w / 2} height={GRID.h / 2} fill={PRIORITY_QUADRANTS[q.key].color} fillOpacity={0.12} stroke="var(--ifab-border)" />
            <text
              x={q.x + GRID.w / 4}
              y={q.y + GRID.h / 4}
              textAnchor="middle"
              fontSize={12}
              fontWeight={700}
              fill={PRIORITY_QUADRANTS[q.key].color}
            >
              {PRIORITY_QUADRANTS[q.key].label.toUpperCase()}
            </text>
          </g>
        ))}
        <line x1={cols[1]} y1={GRID.y} x2={cols[1]} y2={GRID.y + GRID.h} stroke="var(--ifab-border)" />
        <line x1={GRID.x} y1={rows[1]} x2={GRID.x + GRID.w} y2={rows[1]} stroke="var(--ifab-border)" />

        {/* Asse Impatto: verticale, a sinistra della griglia */}
        <line x1={30} y1={GRID.y + GRID.h} x2={30} y2={GRID.y} stroke="var(--ifab-navy)" strokeWidth={3} markerEnd="url(#arrow)" />
        <text x={14} y={GRID.y + 8} fontSize={10} fill="var(--ifab-navy)">alto</text>
        <text x={14} y={GRID.y + GRID.h} fontSize={10} fill="var(--ifab-navy)">basso</text>
        <text x={12} y={GRID.y + GRID.h / 2} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--ifab-navy)" transform={`rotate(-90 12 ${GRID.y + GRID.h / 2})`}>
          IMPATTO
        </text>

        {/* Asse Sforzo: orizzontale, sotto la griglia */}
        <line x1={GRID.x} y1={H - 16} x2={GRID.x + GRID.w} y2={H - 16} stroke="var(--ifab-navy)" strokeWidth={3} markerEnd="url(#arrow)" />
        <text x={GRID.x} y={H - 20} fontSize={10} fill="var(--ifab-navy)">basso</text>
        <text x={GRID.x + GRID.w} y={H - 20} textAnchor="end" fontSize={10} fill="var(--ifab-navy)">alto</text>
        <text x={GRID.x + GRID.w / 2} y={H - 2} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--ifab-navy)">
          SFORZO
        </text>

        <defs>
          <marker id="arrow" markerWidth={8} markerHeight={8} refX={4} refY={4} orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="var(--ifab-navy)" />
          </marker>
        </defs>
      </svg>
      <figcaption className="mt-2 text-center text-xs text-ifab-text-muted">
        Fig. — Matrice Impatto × Sforzo del workshop: lo stesso framework che userai nella valutazione di priorità dello Step 5.
      </figcaption>
    </figure>
  );
}

/** Riassunto pronto da usare come base delle considerazioni finali del partecipante. */
function composeSummary(match: TechMatchResult): string {
  const consigliate = match.entries.filter((e) => e.consigliata).map((e) => e.label);
  const tecnologia =
    consigliate.length > 0 ? consigliate.join(" oppure ") : "nessuna tecnologia con obiettivi chiaramente in linea";
  return `Ambito tecnologico individuato: ${match.categoriaLabel}. Obiettivi prioritari: ${match.obiettiviLabels.join(", ")}. Tecnologia AI più indicata secondo la matrice del workshop: ${tecnologia}.\n\nLe mie considerazioni: `;
}

/**
 * Step 5 — assistente che precede la considerazione finale: due domande
 * (categoria di processo, obiettivi strategici) per capire, con la Matrice di
 * Selezione Tecnologica del workshop, quale ambito e quale tipo di IA si
 * adatta al caso. Si può rispondere scrivendo o a voce (stesso microfono e
 * stessa lettura ad alta voce dell'intervista dello Step 4). Il risultato è
 * calcolato dal server, non dal modello: qui si mostra soltanto.
 */
export default function TechSelectorChat({
  useCaseSummary,
  knownObjectives,
  onUseResult,
  onReady,
}: {
  useCaseSummary?: string;
  /** Obiettivi già indicati nella scheda Use Case importata: l'assistente li ripropone invece di richiederli da zero. */
  knownObjectives?: StrategicObjectiveKey[];
  onUseResult: (summary: string) => void;
  /** Chiamata una sola volta, alla prima comparsa del risultato: segnala che la conversazione guidata è stata completata. */
  onReady?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: INITIAL_MESSAGE_TECH_SELECTOR },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<ProcessCategoryKey | undefined>();
  const [obiettivi, setObiettivi] = useState<StrategicObjectiveKey[] | undefined>();
  const [closed, setClosed] = useState<string[]>([]);
  const [match, setMatch] = useState<TechMatchResult | null>(null);
  const [applied, setApplied] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dictation = useDictation((text) => {
    setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
  });
  const speech = useSpeech();

  const remaining = remainingTechSelectorGroups(closed);
  const corrente = remaining[0];
  const coperti = TECH_SELECTOR_GROUP_COUNT - remaining.length;

  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [messages, loading]);

  // Segnala il completamento una sola volta: onReady non deve richiamarsi ad
  // ogni turno successivo, solo al primo risultato calcolato.
  useEffect(() => {
    if (match) onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(match)]);

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
          subsection: "techSelector",
          messages: nextMessages,
          context: { useCaseSummary, knownObjectives, techValues: { categoria, obiettivi }, techClosedGroups: closed },
        }),
      });
      const data = await res.json();

      if (data.error) {
        setMessages([...nextMessages, { role: "assistant", content: `Si è verificato un errore: ${data.error}` }]);
        return;
      }

      const reply: string = data.reply ?? "";
      const finalMessages: ChatMessage[] = [...nextMessages, { role: "assistant", content: reply }];
      setMessages(finalMessages);
      if (data.fields?.categoria) setCategoria(data.fields.categoria);
      if (data.fields?.obiettivi) setObiettivi(data.fields.obiettivi);
      if (Array.isArray(data.closedGroups)) setClosed(data.closedGroups);
      if (data.match) setMatch(data.match);
      speech.speak(reply);
    } catch {
      setError("Errore di connessione: riprova a inviare la risposta.");
      setMessages(nextMessages);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <FrameworkFigure />

      <section className="rounded-xl border border-ifab-border bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-ifab-text-muted">
            {corrente ? (
              <>
                Argomento {coperti + 1} di {TECH_SELECTOR_GROUP_COUNT} · <span className="text-ifab-navy">{corrente.titolo}</span>
              </>
            ) : (
              <span className="text-emerald-600">Categoria e obiettivi raccolti: il risultato è qui sotto.</span>
            )}
          </p>
          <span className="text-xs text-ifab-text-muted">
            {coperti}/{TECH_SELECTOR_GROUP_COUNT}
          </span>
        </div>
        <div className="mt-2 flex gap-1">
          {TECH_SELECTOR_GROUPS.map((g) => (
            <span key={g.key} title={g.titolo} className={`h-1.5 flex-1 rounded-full ${closed.includes(g.key) ? "bg-ifab-blue" : "bg-ifab-border"}`} />
          ))}
        </div>
      </section>

      <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-ifab-border bg-white">
        <div className="flex items-center gap-2 border-b border-ifab-border bg-ifab-bg-soft px-4 py-2.5">
          <Sparkles size={16} className="text-ifab-blue" />
          <span className="text-sm font-medium text-ifab-navy">Assistente selezione tecnologia</span>
          <span className="ml-auto flex items-center gap-1">
            <SpeakToggle speech={speech} />
          </span>
        </div>

        <div ref={containerRef} className="ifab-scrollbar flex max-h-80 flex-col gap-2 overflow-y-auto px-4 py-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user" ? "bg-ifab-blue text-white" : "bg-ifab-bg-soft text-ifab-text border border-ifab-border"
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
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              rows={2}
              disabled={loading}
              placeholder={dictation.listening ? "Sto ascoltando: parla pure..." : "Scrivi la tua risposta o usa il microfono..."}
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
          {dictation.interim && <p className="mt-1.5 px-1 text-xs italic text-ifab-text-muted">{dictation.interim}</p>}
          {dictation.error && <p className="mt-1.5 px-1 text-xs text-amber-700">{dictation.error}</p>}
          {error && <p className="mt-1.5 px-1 text-xs text-red-600">{error}</p>}
        </form>
      </section>

      {match && (
        <section className="rounded-xl border border-violet-200 bg-violet-50 p-4">
          <h4 className="text-sm font-semibold text-violet-900">Risultato — Matrice di Selezione Tecnologica</h4>
          <p className="mt-1 text-xs text-violet-800">
            Categoria: <strong>{match.categoriaLabel}</strong> · Obiettivi: {match.obiettiviLabels.join(", ")}
          </p>
          <ul className="mt-3 space-y-1.5">
            {match.entries.map((e) => (
              <li
                key={e.key}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
                  e.consigliata ? "border-violet-400 bg-white font-semibold text-violet-950" : "border-violet-100 bg-white/60 text-violet-900"
                }`}
              >
                <span>
                  {e.label} <span className="font-normal text-violet-700">— {e.useCase}</span>
                </span>
                <span className="flex items-center gap-1 text-xs">
                  {e.overlap}/{match.obiettiviLabels.length} obiettivi in comune
                  {e.consigliata && (
                    <span className="flex items-center gap-1 rounded-full bg-violet-600 px-2 py-0.5 text-white">
                      <CheckCircle2 size={12} /> Consigliata
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              onUseResult(composeSummary(match));
              setApplied(true);
            }}
            className="mt-4 flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-800"
          >
            <Wand2 size={16} /> {applied ? "Aggiornato nelle tue considerazioni" : "Usa questo risultato nelle tue considerazioni"}
          </button>
        </section>
      )}
    </div>
  );
}
