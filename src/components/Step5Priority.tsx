"use client";

import { useState } from "react";
import { AlertTriangle, FileCheck2, FileDown, ShieldAlert } from "lucide-react";
import { PRIORITY_DIMENSIONS, PRIORITY_LEVELS } from "@/config/priorityFramework";
import { downloadPriorityPdf } from "@/lib/priorityPdf";
import { evaluatePriority } from "@/lib/priorityScoring";
import { Block2Submission, PriorityDimension, PriorityEvaluation } from "@/lib/types";
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
}: {
  participantName: string;
  code: string;
  evaluation?: PriorityEvaluation;
  block2?: Block2Submission;
}) {
  const [exporting, setExporting] = useState(false);
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
      await downloadPriorityPdf({ participantName, code, evaluation: evaluation as PriorityEvaluation, block2, now: nowMs() });
    } finally {
      setExporting(false);
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
          return (
            <div key={dimension} className="rounded-xl border border-ifab-border bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-ifab-navy">{config.label}</h3>
                <span className="rounded-full bg-ifab-navy px-2.5 py-1 text-sm font-bold text-white">{score}/5</span>
              </div>
              <p className="mt-2 text-sm font-medium text-ifab-text">{criterion?.label}</p>
              <p className="mt-1 text-xs text-ifab-text-muted">{evaluation.rationale?.[dimension] || criterion?.description}</p>
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

      <section className="rounded-xl border border-ifab-border bg-white p-5">
        <h3 className="text-sm font-semibold text-ifab-navy">Azione raccomandata</h3>
        <p className="mt-2 text-sm text-ifab-text">{result.action}</p>
        <p className="mt-2 text-sm text-ifab-text-muted">{result.quadrantStrategy}</p>
        {evaluation.boardNotes && <p className="mt-4 border-t border-ifab-border pt-4 text-sm text-ifab-text-muted">{evaluation.boardNotes}</p>}
      </section>
    </div>
  );
}
