"use client";

import { FormEvent, useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, FileCheck2, FileDown, Lock, LoaderCircle, Pencil, Save, ShieldAlert, Sparkles } from "lucide-react";
import { PRIORITY_DIMENSIONS, PRIORITY_LEVELS } from "@/config/priorityFramework";
import { submitPriorityEvaluation, submitPriorityReflection } from "@/lib/clientApi";
import TechSelectorChat from "./TechSelectorChat";
import { downloadPriorityPdf } from "@/lib/priorityPdf";
import { arePriorityScores, evaluatePriority, getPriorityScorePresentation } from "@/lib/priorityScoring";
import {
  Block2Submission,
  PriorityAdvice,
  PriorityDimension,
  PriorityEvaluation,
  PriorityReflection,
  PriorityScores,
  Submission,
} from "@/lib/types";
import { nowMs } from "@/lib/time";

const DIMENSIONS: PriorityDimension[] = ["impact", "effort", "risk", "reuse"];

function PrioritySelfAssessment({
  code,
  participantId,
  block2,
  current,
  onSaved,
  onCancel,
}: {
  code: string;
  participantId: string;
  block2?: Block2Submission;
  current?: PriorityEvaluation;
  onSaved: (submission: Submission) => void;
  onCancel?: () => void;
}) {
  const [scores, setScores] = useState<Partial<PriorityScores>>(current?.scores ?? {});
  const [rationale, setRationale] = useState<Partial<Record<PriorityDimension, string>>>(current?.rationale ?? {});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const completeScores = arePriorityScores(scores) ? scores : null;
  const preview = completeScores ? evaluatePriority(completeScores, block2) : null;

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!completeScores) {
      setMessage("Assegna un punteggio a tutte e quattro le dimensioni.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await submitPriorityEvaluation(code, participantId, {
        scores: completeScores,
        rationale,
      });
      onSaved(response.submission);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Salvataggio non riuscito");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4">
      <section className="rounded-xl border border-ifab-blue/30 bg-blue-50/50 p-5">
        <h2 className="text-lg font-semibold text-ifab-navy">5 · La tua valutazione e priorità</h2>
        <p className="mt-1 text-sm text-ifab-text-muted">
          Valuta personalmente il caso importato. Per Impact e Reuse un valore alto è positivo; per Effort e Risk indica maggiore complessità o rischio.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {DIMENSIONS.map((dimension) => {
          const config = PRIORITY_DIMENSIONS[dimension];
          const selected = scores[dimension];
          return (
            <fieldset key={dimension} className="rounded-xl border border-ifab-border bg-white p-4">
              <legend className="px-1 text-base font-semibold text-ifab-navy">{config.label}</legend>
              {/* Descrizione permanente della dimensione: sempre visibile, non un tooltip. */}
              <p className="mt-1 text-sm text-ifab-text">{config.description}</p>
              <p className="mt-1 text-xs font-medium text-ifab-blue">{config.polarityNote}</p>

              <div role="group" aria-label={`Punteggio ${config.label}`} className="mt-3 flex flex-col gap-2">
                {config.criteria.map((item) => {
                  const isSelected = selected === item.score;
                  const presentation = getPriorityScorePresentation(dimension, item.score);
                  return (
                    <button
                      key={item.score}
                      type="button"
                      onClick={() => setScores((previous) => ({ ...previous, [dimension]: item.score }))}
                      aria-pressed={isSelected}
                      className={`flex w-full items-start gap-3 rounded-xl border-2 p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ifab-blue focus-visible:ring-offset-2 ${
                        isSelected
                          ? "border-ifab-blue bg-ifab-blue/5"
                          : "border-ifab-border bg-white hover:border-ifab-blue/50 hover:bg-ifab-bg-soft"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          isSelected ? "bg-ifab-blue text-white" : "bg-ifab-bg-soft text-ifab-navy"
                        }`}
                      >
                        {item.score}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-ifab-navy">
                          {item.label}
                          {isSelected && (
                            <span role="img" aria-label={presentation.accessibleLabel}>
                              {presentation.emoji}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-ifab-text-muted">{item.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {(config.helperFactors || config.helperByTech) && (
                <div className="mt-3 rounded-lg bg-ifab-bg-soft p-3 text-xs text-ifab-text-muted">
                  <p className="font-medium text-ifab-text">{config.helperTitle}</p>
                  {config.helperFactors && (
                    <ul className="mt-1 list-disc space-y-0.5 pl-4">
                      {config.helperFactors.map((factor) => (
                        <li key={factor}>{factor}</li>
                      ))}
                    </ul>
                  )}
                  {config.helperByTech?.map((group) => (
                    <div key={group.label} className="mt-2">
                      <p className="font-medium text-ifab-text">{group.label}</p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4">
                        {group.factors.map((factor) => (
                          <li key={factor}>{factor}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              <label htmlFor={`self-rationale-${dimension}`} className="mt-3 block text-xs font-medium text-ifab-text">
                Perché hai scelto questo punteggio? <span className="font-normal text-ifab-text-muted">(facoltativo)</span>
              </label>
              <textarea
                id={`self-rationale-${dimension}`}
                value={rationale[dimension] ?? ""}
                onChange={(event) => setRationale((previous) => ({ ...previous, [dimension]: event.target.value.slice(0, 1000) }))}
                rows={2}
                maxLength={1000}
                className="mt-1 w-full rounded-lg border border-ifab-border px-3 py-2 text-xs outline-none focus:border-ifab-blue focus:ring-2 focus:ring-ifab-blue/20"
              />
            </fieldset>
          );
        })}
      </div>

      {preview && (
        <section className="grid gap-3 rounded-xl border border-ifab-border bg-white p-5 sm:grid-cols-3">
          <div><p className="text-xs text-ifab-text-muted">Priority Score</p><p className="text-2xl font-bold text-ifab-navy">{preview.score}/20</p></div>
          <div><p className="text-xs text-ifab-text-muted">Priorità</p><p className="text-xl font-bold" style={{ color: PRIORITY_LEVELS[preview.level].color }}>{preview.levelLabel}</p></div>
          <div><p className="text-xs text-ifab-text-muted">Quadrante</p><p className="text-xl font-bold text-ifab-navy">{preview.quadrantLabel}</p></div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving || !completeScores}
          className="flex items-center gap-2 rounded-lg bg-ifab-navy px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ifab-blue disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />}
          {saving ? "Salvataggio..." : current ? "Aggiorna la mia valutazione" : "Conferma la mia valutazione"}
        </button>
        {current && onCancel && (
          <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-ifab-text-muted hover:text-ifab-navy disabled:opacity-50">
            Annulla
          </button>
        )}
        {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
      </div>
    </form>
  );
}

function ImportedPdfSummary({ block2 }: { block2?: Block2Submission }) {
  if (!block2?.sourcePdf) return null;
  const problem = block2.values?.problema;
  const solution = block2.values?.soluzione;
  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex items-start gap-3">
        <FileCheck2 className="mt-0.5 shrink-0 text-emerald-700" size={19} />
        <div className="min-w-0">
          <h2 className="font-semibold text-emerald-900">Use Case importato dal workshop precedente</h2>
          <p className="mt-0.5 truncate text-xs text-emerald-800">
            {block2.sourcePdf.fileName} · {block2.sourcePdf.extractedFieldCount} campi acquisiti
          </p>
          {typeof problem === "string" && problem && (
            <p className="mt-3 text-sm text-emerald-950"><strong>Problema:</strong> {problem}</p>
          )}
          {typeof solution === "string" && solution && (
            <p className="mt-2 text-sm text-emerald-950"><strong>Soluzione:</strong> {solution}</p>
          )}
        </div>
      </div>
    </section>
  );
}

export default function Step5Priority({
  participantName,
  code,
  evaluation,
  block2,
  reflection,
  advice,
  participantId,
  onSubmissionSaved,
}: {
  participantName: string;
  code: string;
  evaluation?: PriorityEvaluation;
  block2?: Block2Submission;
  reflection?: PriorityReflection;
  advice?: PriorityAdvice;
  participantId: string;
  onSubmissionSaved: (submission: Submission) => void;
}) {
  const [exporting, setExporting] = useState(false);
  const [reflectionText, setReflectionText] = useState(reflection?.text ?? "");
  const [requestingAdvice, setRequestingAdvice] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingEvaluation, setEditingEvaluation] = useState(false);
  // L'assistente tecnologia è un passaggio obbligatorio prima delle considerazioni:
  // resta sbloccato per sempre una volta raggiunto, e per chi aveva già inviato la
  // considerazione prima che questo passaggio esistesse (non li si blocca a ritroso).
  const [techReady, setTechReady] = useState(Boolean(reflection));

  if (!block2?.values || Object.keys(block2.values).length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <ImportedPdfSummary block2={block2} />
        <div className="rounded-xl border border-dashed border-ifab-border bg-white p-8 text-center text-sm text-ifab-text-muted">
          Non è disponibile un caso d&apos;uso da valutare. Esci e carica il PDF prodotto nella sessione precedente.
        </div>
      </div>
    );
  }

  if (!evaluation || editingEvaluation) {
    return (
      <div className="flex flex-col gap-4">
        <ImportedPdfSummary block2={block2} />
        <PrioritySelfAssessment
          code={code}
          participantId={participantId}
          block2={block2}
          current={evaluation}
          onSaved={onSubmissionSaved}
          onCancel={() => setEditingEvaluation(false)}
        />
      </div>
    );
  }

  const result = evaluatePriority(evaluation.scores, block2);
  const useCaseSummary = [block2.values?.problema, block2.values?.soluzione]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join(" ");

  function applyTechResult(summary: string) {
    setReflectionText((prev) => {
      const resto = prev.trim();
      return resto ? `${summary}${resto}` : summary;
    });
  }

  async function exportPdf() {
    setExporting(true);
    try {
      await downloadPriorityPdf({
        participantName,
        code,
        evaluation: evaluation as PriorityEvaluation,
        block2,
        reflection,
        advice,
        now: nowMs(),
      });
    } finally {
      setExporting(false);
    }
  }

  async function handleReflectionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestingAdvice(true);
    setError(null);
    setFeedback(null);
    try {
      const response = await submitPriorityReflection(code, participantId, reflectionText);
      onSubmissionSaved(response.submission);
      setFeedback(
        response.adviceGenerated
          ? "Considerazione salvata. I consigli IA sono stati generati tenendone conto."
          : response.warning ?? "Considerazione salvata."
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Non è stato possibile salvare la considerazione");
    } finally {
      setRequestingAdvice(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ImportedPdfSummary block2={block2} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ifab-navy">5 · Valutazione e priorità</h2>
          <p className="text-sm text-ifab-text-muted">Risultato calcolato a partire dalla tua autovalutazione.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEditingEvaluation(true)}
            className="flex items-center gap-2 rounded-lg border border-ifab-border px-4 py-2 text-sm font-semibold text-ifab-navy transition hover:border-ifab-navy"
          >
            <Pencil size={16} /> Modifica valutazione
          </button>
          <button
            type="button"
            onClick={() => void exportPdf()}
            disabled={exporting}
            className="flex items-center gap-2 rounded-lg border border-ifab-navy px-4 py-2 text-sm font-semibold text-ifab-navy transition hover:bg-ifab-navy hover:text-white disabled:opacity-50"
          >
            <FileDown size={16} /> {exporting ? "Preparo il PDF..." : "Scarica PDF"}
          </button>
        </div>
      </div>

      <section className="grid gap-3 rounded-xl border border-ifab-border bg-white p-5 sm:grid-cols-3">
        <div><p className="text-xs text-ifab-text-muted">Priority Score</p><p className="text-3xl font-bold text-ifab-navy">{result.score}/20</p></div>
        <div><p className="text-xs text-ifab-text-muted">Priorità</p><p className="text-2xl font-bold" style={{ color: PRIORITY_LEVELS[result.level].color }}>{result.levelLabel}</p></div>
        <div><p className="text-xs text-ifab-text-muted">Quadrante</p><p className="text-2xl font-bold text-ifab-navy">{result.quadrantLabel}</p></div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {DIMENSIONS.map((dimension) => {
          const score = evaluation.scores[dimension];
          const config = PRIORITY_DIMENSIONS[dimension];
          const criterion = config.criteria.find((item) => item.score === score);
          const presentation = getPriorityScorePresentation(dimension, score);
          return (
            <div key={dimension} className="rounded-xl border border-ifab-border bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-ifab-navy">{config.label}</h3>
                <div className="flex items-center gap-2">
                  <span
                    className="text-2xl"
                    role="img"
                    aria-label={`${presentation.accessibleLabel} per ${config.label}`}
                    title={presentation.accessibleLabel}
                  >
                    {presentation.emoji}
                  </span>
                  <span className="rounded-full bg-ifab-navy px-2.5 py-1 text-sm font-bold text-white">{score}/5</span>
                </div>
              </div>
              <p className="mt-2 text-sm font-medium text-ifab-text">{criterion?.label}</p>
              <p className="mt-1 text-xs text-ifab-text-muted">{criterion?.description}</p>
              {evaluation.rationale?.[dimension] && (
                <p className="mt-3 border-t border-ifab-border pt-3 text-xs text-ifab-text">
                  <strong>La tua motivazione:</strong> {evaluation.rationale[dimension]}
                </p>
              )}
            </div>
          );
        })}
      </section>

      {result.riskVeto && (
        <div className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <ShieldAlert className="shrink-0" size={18} />
          <span><strong>Veto rischio.</strong> Prima dell&apos;approvazione è necessaria una valutazione dedicata con Legal/Compliance.</span>
        </div>
      )}
      {result.ethicalReviewRequired && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="shrink-0" size={18} />
          <span>Il caso impatta persone specifiche: il framework richiede una valutazione etica esplicita.</span>
        </div>
      )}

      {evaluation.boardNotes && (
        <section className="rounded-xl border border-ifab-border bg-white p-5">
          <h3 className="text-sm font-semibold text-ifab-navy">Note della valutazione</h3>
          <p className="mt-2 text-sm text-ifab-text">{evaluation.boardNotes}</p>
        </section>
      )}

      <section className="rounded-xl border border-violet-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-semibold text-ifab-navy">
            <Bot size={18} className="text-violet-700" /> Passaggio obbligatorio: Technology Feasibility Assessment
          </span>
          {techReady ? (
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <CheckCircle2 size={13} /> Completato
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Da completare</span>
          )}
        </div>
        <p className="mt-1 text-sm text-ifab-text-muted">
          Prima di scrivere le tue considerazioni devi parlare — a voce o scrivendo — con questo assistente: parte dal problema (non dalla tecnologia), ti fa poche domande mirate su dati, processo e autonomia richiesta, e stabilisce quale tecnologia è davvero adatta e quanto lo use case è fattibile.
        </p>
        <div className="mt-4">
          <TechSelectorChat
            useCaseSummary={useCaseSummary || undefined}
            onUseResult={applyTechResult}
            onReady={() => setTechReady(true)}
          />
        </div>
      </section>

      {techReady ? (
        <form onSubmit={handleReflectionSubmit} className="rounded-xl border border-ifab-blue/30 bg-blue-50/50 p-5">
          <h3 className="font-semibold text-ifab-navy">Prima i tuoi pensieri</h3>
          <p className="mt-1 text-sm text-ifab-text-muted">
            Prima di leggere i consigli dell&apos;IA, ripensa a tutto il percorso fatto finora. Può aiutarti rispondere a queste domande:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ifab-text-muted">
            <li>Tra i processi emersi finora, quali ti sono risultati più chiari? In quali hai avuto più interesse, e perché?</li>
            <li>Ti sono sorte perplessità o dubbi — sui dati, sull&apos;impatto stimato, sui rischi o sulla fattibilità?</li>
            <li>Cosa condividi della valutazione appena fatta, e cosa invece ti sorprende?</li>
          </ul>
          <label htmlFor="priority-reflection" className="mt-4 block text-sm font-medium text-ifab-text">
            Le tue considerazioni
          </label>
          <textarea
            id="priority-reflection"
            value={reflectionText}
            onChange={(event) => setReflectionText(event.target.value.slice(0, 3000))}
            rows={5}
            minLength={10}
            maxLength={3000}
            required
            disabled={requestingAdvice}
            placeholder="Per esempio: condivido il punteggio di impatto, ma prima dell'MVP dobbiamo verificare..."
            className="mt-2 w-full rounded-lg border border-ifab-border bg-white px-3 py-2 text-sm text-ifab-text outline-none transition focus:border-ifab-blue focus:ring-2 focus:ring-ifab-blue/20 disabled:opacity-60"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-ifab-text-muted">{reflectionText.length}/3000 caratteri</span>
            <button
              type="submit"
              disabled={requestingAdvice || reflectionText.trim().length < 10}
              className="flex items-center gap-2 rounded-lg bg-ifab-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-ifab-blue disabled:cursor-not-allowed disabled:opacity-50"
            >
              {requestingAdvice ? <LoaderCircle className="animate-spin" size={16} /> : <Sparkles size={16} />}
              {requestingAdvice
                ? "Sto preparando i consigli..."
                : advice
                  ? "Aggiorna e rigenera i consigli"
                  : reflection
                    ? "Riprova a generare i consigli"
                    : "Invia e scopri i consigli IA"}
            </button>
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
          {feedback && <p role="status" className="mt-3 text-sm text-emerald-700">{feedback}</p>}
        </form>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-ifab-border bg-white p-5 text-sm text-ifab-text-muted">
          <Lock size={18} className="shrink-0 text-ifab-text-muted" />
          <span>
            <strong className="text-ifab-navy">Completa prima la conversazione con l&apos;assistente qui sopra.</strong> Ti aiuta a individuare l&apos;ambito tecnologico e il tipo di IA più adatti: solo dopo puoi scrivere le tue considerazioni finali.
          </span>
        </div>
      )}

      {reflection && (
        <section className="rounded-xl border border-ifab-border bg-white p-5">
          <h3 className="text-sm font-semibold text-ifab-navy">Indicazione del framework</h3>
          <p className="mt-2 text-sm text-ifab-text">{result.action}</p>
          <p className="mt-2 text-sm text-ifab-text-muted">{result.quadrantStrategy}</p>
        </section>
      )}

      {advice && reflection ? (
        <section className="rounded-xl border border-violet-200 bg-violet-50 p-5">
          <div className="flex items-center gap-2 text-violet-900">
            <Sparkles size={18} />
            <h3 className="font-semibold">Consigli dell&apos;IA dopo la tua considerazione</h3>
          </div>
          <p className="mt-3 text-sm text-violet-950">{advice.summary}</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {([
              ["Punti di forza", advice.strengths],
              ["Attenzioni", advice.cautions],
              ["Prossimi passi", advice.nextSteps],
            ] as const).map(([title, items]) => (
              <div key={title}>
                <h4 className="text-sm font-semibold text-violet-900">{title}</h4>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-violet-950">
                  {items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : reflection ? (
        <div className="rounded-xl border border-dashed border-violet-300 bg-white p-5 text-sm text-ifab-text-muted">
          La tua considerazione è salvata. Usa il pulsante qui sopra per generare i consigli IA quando il servizio è disponibile.
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-ifab-border bg-white p-5 text-center text-sm text-ifab-text-muted">
          🔒 I consigli IA saranno disponibili soltanto dopo la tua considerazione.
        </div>
      )}
    </div>
  );
}
