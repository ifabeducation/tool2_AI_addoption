"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, HelpCircle, Send, Sparkles, Wand2 } from "lucide-react";
import {
  ASSESSMENT_DIMENSIONS,
  AssessmentDimension,
  ConfidenceLevel,
  estimatedTotalQuestions,
  FeasibilityAnswerMap,
  INITIAL_MESSAGE_FEASIBILITY,
  TechnologyRecommendation,
  UNKNOWN_OPTION,
} from "@/config/techSelector";
import { PRIORITY_QUADRANTS } from "@/config/priorityFramework";
import { ChatMessage } from "@/lib/types";
import { MicButton, SpeakToggle, useDictation, useSpeech } from "./VoiceInput";

const CONFIDENCE_LABEL: Record<ConfidenceLevel, { label: string; className: string }> = {
  alta: { label: "Alta", className: "bg-emerald-100 text-emerald-700" },
  media: { label: "Media", className: "bg-amber-100 text-amber-800" },
  bassa: { label: "Bassa", className: "bg-red-100 text-red-700" },
};

/**
 * Materiale di riferimento del workshop: la matrice Impatto × Sforzo (Quick
 * Win, Strategic Bet, Fill-in, Money Pit) usata anche nella valutazione di
 * priorità dello Step 5. Illustrazione statica in SVG inline (non un grafico
 * dati), leggibile in entrambi i temi senza dipendere da un file immagine
 * esterno — stesso principio di MatriceImpattoProntezza.tsx.
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
function composeSummary(recommendation: TechnologyRecommendation): string {
  const alt = recommendation.alternative
    ? ` Alternativa da considerare: ${recommendation.alternative.label}.`
    : "";
  return `Technology Feasibility Assessment — tecnologia consigliata: ${recommendation.primary.label} (fattibilità ${CONFIDENCE_LABEL[recommendation.primary.confidence].label.toLowerCase()}).${alt}\n\nLe mie considerazioni: `;
}

/**
 * Step 5 — Technology Feasibility Assessment: un AI Solution Architect che
 * parte dal problema (output atteso, dati, processo, autonomia) e non dalla
 * tecnologia, per capire quale famiglia tecnologica è davvero adatta e se lo
 * use case è fattibile. Poche domande mirate (5-8, adattive), una alla
 * volta, con risposte rapide selezionabili + "Non lo so" + risposta libera
 * (testo o voce, stesso microfono dello Step 4). Il risultato finale è
 * calcolato dal server (recommendTechnology), non dal modello: qui si mostra.
 */
export default function TechSelectorChat({
  useCaseSummary,
  onUseResult,
  onReady,
}: {
  useCaseSummary?: string;
  onUseResult: (summary: string) => void;
  /** Chiamata una sola volta, alla prima comparsa del risultato. */
  onReady?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: INITIAL_MESSAGE_FEASIBILITY },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<FeasibilityAnswerMap>({});
  const [current, setCurrent] = useState<AssessmentDimension | null>(ASSESSMENT_DIMENSIONS[0]);
  const [complete, setComplete] = useState(false);
  const [recommendation, setRecommendation] = useState<TechnologyRecommendation | null>(null);
  const [selectedMultiple, setSelectedMultiple] = useState<string[]>([]);
  const [applied, setApplied] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dictation = useDictation((text) => {
    setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
  });
  const speech = useSpeech();

  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [messages, loading]);

  // Segnala il completamento una sola volta: onReady non deve richiamarsi ad
  // ogni turno successivo, solo al primo risultato calcolato.
  useEffect(() => {
    if (complete && recommendation) onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete]);

  async function sendMessage(text: string) {
    const testo = text.trim();
    if (!testo || loading) return;

    dictation.stop();
    setSelectedMultiple([]);
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
          subsection: "feasibilityAssessment",
          messages: nextMessages,
          context: { useCaseSummary, feasibilityAnswers: answers },
        }),
      });
      const data = await res.json();

      if (data.error) {
        setMessages([...nextMessages, { role: "assistant", content: `Si è verificato un errore: ${data.error}` }]);
        return;
      }

      const reply: string = data.reply ?? "";
      setMessages([...nextMessages, { role: "assistant", content: reply }]);
      if (data.answer?.dimension) {
        setAnswers((prev) => ({ ...prev, [data.answer.dimension]: data.answer }));
      }
      setCurrent(data.current ?? null);
      setComplete(Boolean(data.complete));
      if (data.recommendation) setRecommendation(data.recommendation);
      speech.speak(reply);
    } catch {
      setError("Errore di connessione: riprova a inviare la risposta.");
      setMessages(nextMessages);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    void sendMessage(input);
  }

  function handleQuickReply(optionLabel: string) {
    void sendMessage(optionLabel);
  }

  function toggleMultiple(optionLabel: string) {
    setSelectedMultiple((prev) => (prev.includes(optionLabel) ? prev.filter((v) => v !== optionLabel) : [...prev, optionLabel]));
  }

  const answeredCount = Object.keys(answers).length;
  const estimatedTotal = estimatedTotalQuestions(answers);
  const showQuickReplies = current && !complete && !loading;

  return (
    <div className="flex flex-col gap-3">
      <FrameworkFigure />

      <section className="rounded-xl border border-ifab-border bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-ifab-text-muted">
            {complete ? (
              <span className="text-emerald-600">Assessment completato: il risultato è qui sotto.</span>
            ) : (
              <>
                Analisi della fattibilità · <span className="text-ifab-navy">{Math.min(answeredCount + 1, estimatedTotal)}/{estimatedTotal}</span>
              </>
            )}
          </p>
        </div>
        <div className="mt-2 flex gap-1">
          {Array.from({ length: estimatedTotal }).map((_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i < answeredCount ? "bg-ifab-blue" : "bg-ifab-border"}`} />
          ))}
        </div>
      </section>

      <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-ifab-border bg-white">
        <div className="flex items-center gap-2 border-b border-ifab-border bg-ifab-bg-soft px-4 py-2.5">
          <Sparkles size={16} className="text-ifab-blue" />
          <span className="text-sm font-medium text-ifab-navy">Technology Feasibility Assessment</span>
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

        {showQuickReplies && current && (
          <div className="border-t border-ifab-border bg-ifab-bg-soft px-4 py-2.5">
            <div className="flex flex-wrap gap-1.5">
              {current.options.map((option) => {
                const isSelected = selectedMultiple.includes(option.label);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => (current.multiple ? toggleMultiple(option.label) : handleQuickReply(option.label))}
                    aria-pressed={current.multiple ? isSelected : undefined}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      isSelected
                        ? "border-ifab-blue bg-ifab-blue text-white"
                        : "border-ifab-border bg-white text-ifab-navy hover:border-ifab-blue"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => handleQuickReply(UNKNOWN_OPTION.label)}
                className="flex items-center gap-1 rounded-full border border-dashed border-ifab-border bg-white px-3 py-1.5 text-xs font-medium text-ifab-text-muted transition hover:border-ifab-blue hover:text-ifab-navy"
              >
                <HelpCircle size={12} /> {UNKNOWN_OPTION.label}
              </button>
            </div>
            {current.multiple && (
              <button
                type="button"
                onClick={() => handleQuickReply(selectedMultiple.join(", "))}
                disabled={selectedMultiple.length === 0}
                className="mt-2 flex items-center gap-1 rounded-lg bg-ifab-blue px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-ifab-blue-dark disabled:opacity-40"
              >
                <Send size={12} /> Conferma {selectedMultiple.length > 0 ? `(${selectedMultiple.length})` : ""}
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="border-t border-ifab-border p-2.5">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              rows={2}
              disabled={loading}
              placeholder={dictation.listening ? "Sto ascoltando: parla pure..." : "Oppure scrivi/parla liberamente..."}
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

      {complete && recommendation && (
        <section className="rounded-xl border border-violet-200 bg-violet-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-violet-900">Tecnologia consigliata</h4>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${CONFIDENCE_LABEL[recommendation.primary.confidence].className}`}>
              Fattibilità {CONFIDENCE_LABEL[recommendation.primary.confidence].label}
            </span>
          </div>
          <p className="mt-1 text-base font-bold text-violet-950">{recommendation.primary.label}</p>

          <div className="mt-3">
            <p className="text-xs font-semibold text-violet-900">Perché</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-violet-950">
              {recommendation.primary.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                <CheckCircle2 size={13} /> Prerequisiti già presenti
              </p>
              {recommendation.primary.prerequisitesPresent.length > 0 ? (
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-violet-950">
                  {recommendation.primary.prerequisitesPresent.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-violet-800">Nessuno confermato dalle risposte date finora.</p>
              )}
            </div>
            <div>
              <p className="flex items-center gap-1 text-xs font-semibold text-amber-700">
                <AlertTriangle size={13} /> Prerequisiti da verificare
              </p>
              {recommendation.primary.prerequisitesToVerify.length > 0 ? (
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-violet-950">
                  {recommendation.primary.prerequisitesToVerify.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-violet-800">Nessuno: le condizioni essenziali risultano già coperte.</p>
              )}
            </div>
          </div>

          <div className="mt-3 rounded-lg bg-white/60 p-3">
            <p className="text-xs font-semibold text-violet-900">Principale rischio tecnico</p>
            <p className="mt-1 text-sm text-violet-950">{recommendation.primary.mainRisk}</p>
          </div>

          <div className="mt-3 rounded-lg bg-white/60 p-3">
            <p className="text-xs font-semibold text-violet-900">Approccio MVP proposto</p>
            <p className="mt-1 text-sm text-violet-950">{recommendation.primary.mvpApproach}</p>
          </div>

          {recommendation.alternative && (
            <div className="mt-3 rounded-lg border border-dashed border-violet-300 bg-white/60 p-3">
              <p className="text-xs font-semibold text-violet-900">Tecnologia alternativa da considerare</p>
              <p className="mt-1 text-sm font-semibold text-violet-950">{recommendation.alternative.label}</p>
              <p className="mt-1 text-xs text-violet-800">{recommendation.alternative.whatWouldDecide}</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              onUseResult(composeSummary(recommendation));
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
