"use client";

import { AlertTriangle, CheckCircle2, ClipboardList, FileCheck2, ShieldAlert } from "lucide-react";
import { PRIORITY_LEVELS } from "@/config/priorityFramework";
import { evaluatePriority } from "@/lib/priorityScoring";
import { Participant, Submission } from "@/lib/types";
import ImpactEffortMatrix from "./ImpactEffortMatrix";

type PortfolioRow = { participant: Participant; submission: Submission };

function hasUseCase(submission: Submission): boolean {
  return Object.values(submission.block2?.values ?? {}).some((value) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value?.trim())
  );
}

function caseExcerpt(submission: Submission): string {
  const value = submission.block2?.values?.soluzione ?? submission.block2?.values?.problema;
  if (typeof value !== "string" || !value.trim()) return "Caso d'uso senza descrizione";
  const clean = value.trim().replace(/\s+/g, " ");
  return clean.length > 110 ? `${clean.slice(0, 107)}…` : clean;
}

export default function PriorityPortfolio({ rows }: { rows: PortfolioRow[] }) {
  const useCases = rows.filter(({ submission }) => hasUseCase(submission));
  const points = useCases.flatMap(({ participant, submission }) => {
    if (!submission.priority) return [];
    return [{
      id: participant.participantId,
      label: participant.name,
      scores: submission.priority.scores,
      result: evaluatePriority(submission.priority.scores, submission.block2),
    }];
  });

  if (useCases.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ifab-border bg-white p-8 text-center text-sm text-ifab-text-muted">
        <ClipboardList className="mx-auto mb-2" size={21} />
        Il portfolio comparirà quando almeno un partecipante avrà caricato il PDF del caso d&apos;uso.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl bg-white p-5">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-ifab-navy">Portfolio Use Case</h2>
          <p className="text-xs text-ifab-text-muted">
            {points.length}/{useCases.length} partecipanti hanno completato la propria autovalutazione. I risultati sono in sola lettura.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead>
              <tr className="border-b border-ifab-border text-ifab-text-muted">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Use Case</th>
                <th className="py-2 pr-3">I</th>
                <th className="py-2 pr-3">E</th>
                <th className="py-2 pr-3">R</th>
                <th className="py-2 pr-3">Reuse</th>
                <th className="py-2 pr-3">Score</th>
                <th className="py-2 pr-3">Priorità</th>
                <th className="py-2 pr-3">Quadrante</th>
                <th className="py-2 pr-3">Considerazione</th>
                <th className="py-2">Consigli IA</th>
              </tr>
            </thead>
            <tbody>
              {useCases.map(({ participant, submission }, index) => {
                const evaluation = submission.priority;
                const result = evaluation ? evaluatePriority(evaluation.scores, submission.block2) : null;
                return (
                  <tr key={participant.participantId} className="border-b border-ifab-border align-top">
                    <td className="py-3 pr-3 text-ifab-text-muted">{index + 1}</td>
                    <td className="max-w-xs py-3 pr-3">
                      <p className="font-semibold text-ifab-navy">{participant.name}</p>
                      <p className="mt-0.5 text-ifab-text-muted">{caseExcerpt(submission)}</p>
                      {submission.block2?.sourcePdf && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700">
                          <FileCheck2 size={11} /> PDF importato · {submission.block2.sourcePdf.fileName}
                        </p>
                      )}
                    </td>
                    {(["impact", "effort", "risk", "reuse"] as const).map((key) => (
                      <td key={key} className="py-3 pr-3 font-semibold text-ifab-text">
                        {evaluation?.scores[key] ?? "—"}
                      </td>
                    ))}
                    <td className="py-3 pr-3 font-bold text-ifab-navy">{result ? `${result.score}/20` : "—"}</td>
                    <td className="py-3 pr-3">
                      {result ? (
                        <>
                          <span className="font-semibold" style={{ color: PRIORITY_LEVELS[result.level].color }}>
                            {result.levelLabel}
                          </span>
                          {result.riskVeto && <ShieldAlert className="mt-1 text-red-600" size={15} aria-label="Veto rischio" />}
                          {!result.riskVeto && result.ethicalReviewRequired && (
                            <AlertTriangle className="mt-1 text-amber-600" size={15} aria-label="Review etica richiesta" />
                          )}
                        </>
                      ) : "Da valutare"}
                    </td>
                    <td className="py-3 pr-3 text-ifab-text-muted">{result?.quadrantLabel ?? "—"}</td>
                    <td className="py-3 pr-3">
                      {submission.priorityReflection ? (
                        <CheckCircle2 className="text-emerald-600" size={16} aria-label="Considerazione inserita" />
                      ) : (
                        <span className="text-ifab-text-muted">—</span>
                      )}
                    </td>
                    <td className="py-3">
                      {submission.priorityAdvice ? (
                        <CheckCircle2 className="text-violet-600" size={16} aria-label="Consigli IA generati" />
                      ) : (
                        <span className="text-ifab-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl bg-white p-5">
        <h2 className="mb-1 text-base font-semibold text-ifab-navy">Matrice Impact × Effort</h2>
        <p className="mb-3 text-xs text-ifab-text-muted">Sono mostrati solo i casi già valutati. Il rosso segnala un veto sul rischio.</p>
        {points.length ? (
          <ImpactEffortMatrix points={points} />
        ) : (
          <p className="rounded-lg border border-dashed border-ifab-border p-6 text-center text-sm text-ifab-text-muted">
            La matrice si popolerà dopo la prima valutazione.
          </p>
        )}
      </section>
    </div>
  );
}
