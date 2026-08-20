"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Save, ShieldAlert } from "lucide-react";
import { PRIORITY_DIMENSIONS, PRIORITY_LEVELS } from "@/config/priorityFramework";
import { savePriorityEvaluation } from "@/lib/clientApi";
import { arePriorityScores, evaluatePriority } from "@/lib/priorityScoring";
import {
  Participant,
  PriorityDimension,
  PriorityEvaluation,
  PriorityScores,
  Submission,
} from "@/lib/types";

const DIMENSIONS: PriorityDimension[] = ["impact", "effort", "risk", "reuse"];

export default function PriorityEvaluationPanel({
  code,
  participant,
  submission,
  onSaved,
}: {
  code: string;
  participant: Participant;
  submission: Submission;
  onSaved: (evaluation: PriorityEvaluation) => void;
}) {
  const current = submission.priority;
  const [scores, setScores] = useState<Partial<PriorityScores>>(current?.scores ?? {});
  const [rationale, setRationale] = useState<Partial<Record<PriorityDimension, string>>>(current?.rationale ?? {});
  const [boardNotes, setBoardNotes] = useState(current?.boardNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const completeScores = arePriorityScores(scores) ? scores : null;
  const result = useMemo(
    () => (completeScores ? evaluatePriority(completeScores, submission.block2) : null),
    [completeScores, submission.block2]
  );

  async function handleSave() {
    if (!completeScores) {
      setMessage("Assegna un punteggio da 1 a 5 a tutte le dimensioni.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await savePriorityEvaluation(code, participant.participantId, {
        scores: completeScores,
        rationale,
        boardNotes,
      });
      if (response.submission.priority) onSaved(response.submission.priority);
      setMessage("Valutazione salvata.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Salvataggio non riuscito");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-ifab-border bg-ifab-bg-soft p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ifab-navy">Valutazione · {participant.name}</h3>
          <p className="mt-1 text-xs text-ifab-text-muted">
            I punteggi sono modificabili solo dall&apos;AI Board. Le formule vengono applicate automaticamente.
          </p>
        </div>
        {current && (
          <span className="flex items-center gap-1 text-xs text-emerald-700">
            <CheckCircle2 size={14} /> Valutata da {current.evaluatedBy}
          </span>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {DIMENSIONS.map((dimension) => {
          const config = PRIORITY_DIMENSIONS[dimension];
          const selected = scores[dimension];
          const criterion = config.criteria.find((item) => item.score === selected);
          return (
            <div key={dimension} className="rounded-lg border border-ifab-border bg-white p-3">
              <label className="text-sm font-semibold text-ifab-navy" htmlFor={`score-${participant.participantId}-${dimension}`}>
                {config.label}
              </label>
              <p className="mb-2 text-xs text-ifab-text-muted">{config.description}</p>
              <select
                id={`score-${participant.participantId}-${dimension}`}
                value={selected ?? ""}
                onChange={(event) => setScores((prev) => ({ ...prev, [dimension]: Number(event.target.value) }))}
                className="w-full rounded-lg border border-ifab-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ifab-blue"
              >
                <option value="" disabled>Seleziona 1–5</option>
                {config.criteria.map((item) => (
                  <option key={item.score} value={item.score}>{item.score} · {item.label}</option>
                ))}
              </select>
              {criterion && <p className="mt-2 text-xs text-ifab-text-muted">{criterion.description}</p>}
              <textarea
                value={rationale[dimension] ?? ""}
                onChange={(event) => setRationale((prev) => ({ ...prev, [dimension]: event.target.value }))}
                rows={2}
                placeholder="Motivazione facoltativa"
                className="mt-2 w-full rounded-lg border border-ifab-border px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ifab-blue"
              />
            </div>
          );
        })}
      </div>

      <label className="mt-4 block text-xs font-medium text-ifab-text-muted" htmlFor={`notes-${participant.participantId}`}>
        Note AI Board
      </label>
      <textarea
        id={`notes-${participant.participantId}`}
        value={boardNotes}
        onChange={(event) => setBoardNotes(event.target.value)}
        rows={3}
        placeholder="Condizioni, dipendenze o decisioni da ricordare"
        className="mt-1 w-full rounded-lg border border-ifab-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ifab-blue"
      />

      {result && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-white p-3 text-center">
            <p className="text-xs text-ifab-text-muted">Priority Score</p>
            <p className="text-2xl font-bold text-ifab-navy">{result.score}/20</p>
          </div>
          <div className="rounded-lg bg-white p-3 text-center">
            <p className="text-xs text-ifab-text-muted">Priorità</p>
            <p className="text-lg font-bold" style={{ color: PRIORITY_LEVELS[result.level].color }}>{result.levelLabel}</p>
          </div>
          <div className="rounded-lg bg-white p-3 text-center">
            <p className="text-xs text-ifab-text-muted">Quadrante</p>
            <p className="text-lg font-bold text-ifab-navy">{result.quadrantLabel}</p>
          </div>
        </div>
      )}

      {result?.riskVeto && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-800">
          <ShieldAlert size={15} className="shrink-0" /> Veto rischio: serve una valutazione dedicata Legal/Compliance prima dell&apos;approvazione.
        </p>
      )}
      {result?.ethicalReviewRequired && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle size={15} className="shrink-0" /> Il caso impatta persone specifiche e richiede una valutazione etica esplicita.
        </p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-ifab-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-ifab-navy-deep disabled:opacity-50"
        >
          <Save size={15} /> {saving ? "Salvataggio..." : current ? "Aggiorna valutazione" : "Salva valutazione"}
        </button>
        {message && <span className="text-xs text-ifab-text-muted">{message}</span>}
      </div>
    </section>
  );
}
