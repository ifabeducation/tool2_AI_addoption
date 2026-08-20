"use client";

import { FormEvent, useState } from "react";
import { AlertTriangle, FileCheck2, FileDown, LoaderCircle, ShieldAlert, Sparkles } from "lucide-react";
import { PRIORITY_DIMENSIONS, PRIORITY_LEVELS } from "@/config/priorityFramework";
import { submitPriorityReflection } from "@/lib/clientApi";
import { downloadPriorityPdf } from "@/lib/priorityPdf";
import { evaluatePriority, getPriorityScorePresentation } from "@/lib/priorityScoring";
import {
  Block2Submission,
  PriorityAdvice,
  PriorityDimension,
  PriorityEvaluation,
  PriorityReflection,
  Submission,
} from "@/lib/types";
import { nowMs } from "@/lib/time";

const DIMENSIONS: PriorityDimension[] = ["impact", "effort", "risk", "reuse"];

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

  if (!evaluation) {
    return (
      <div className="flex flex-col gap-4">
        <ImportedPdfSummary block2={block2} />
        <div className="rounded-xl border border-dashed border-ifab-border bg-white p-8 text-center text-sm text-ifab-text-muted">
          Il tuo Use Case è arrivato all&apos;AI Board. La valutazione comparirà qui quando saranno stati assegnati i punteggi.
        </div>
      </div>
    );
  }

  const result = evaluatePriority(evaluation.scores, block2);
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
          <h2 className="text-lg font-semibold text-ifab-navy">Step 5 · Valutazione e priorità</h2>
          <p className="text-sm text-ifab-text-muted">Esito finale assegnato dall&apos;AI Board. I valori sono in sola lettura.</p>
        </div>
        <button
          type="button"
          onClick={() => void exportPdf()}
          disabled={exporting}
          className="flex items-center gap-2 rounded-lg border border-ifab-navy px-4 py-2 text-sm font-semibold text-ifab-navy transition hover:bg-ifab-navy hover:text-white disabled:opacity-50"
        >
          <FileDown size={16} /> {exporting ? "Preparo il PDF..." : "Scarica PDF"}
        </button>
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
                  <strong>Motivazione AI Board:</strong> {evaluation.rationale[dimension]}
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
          <span>Il caso impatta persone specifiche: l&apos;AI Board richiede una valutazione etica esplicita.</span>
        </div>
      )}

      {evaluation.boardNotes && (
        <section className="rounded-xl border border-ifab-border bg-white p-5">
          <h3 className="text-sm font-semibold text-ifab-navy">Note dell&apos;AI Board</h3>
          <p className="mt-2 text-sm text-ifab-text">{evaluation.boardNotes}</p>
        </section>
      )}

      <form onSubmit={handleReflectionSubmit} className="rounded-xl border border-ifab-blue/30 bg-blue-50/50 p-5">
        <h3 className="font-semibold text-ifab-navy">Prima i tuoi pensieri</h3>
        <p className="mt-1 text-sm text-ifab-text-muted">
          Scrivi cosa condividi, cosa ti sorprende e quali vincoli conosci. I consigli IA restano nascosti finché non invii questa considerazione.
        </p>
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
