"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RotateCcw, X } from "lucide-react";
import { ApiError, resumeSession } from "@/lib/clientApi";
import { clearStoredIdentity, readStoredIdentity } from "@/lib/participantStorage";
import { ParticipantTab, Submission } from "@/lib/types";

const TAB_LABELS: Record<ParticipantTab, string> = {
  "1": "Step 1 · Scheda di attrito",
  "2": "Step 2 · Caratteristiche",
  "3": "Step 3 · Esito",
  UC: "Step 4 · Use Case",
  "5": "Step 5 · Valutazione e priorità",
};

function describeProgress(submission: Submission): string {
  const tab = submission.progress?.tab;
  // Una posizione salvata con una struttura precedente può non esistere più.
  if (tab && TAB_LABELS[tab]) return TAB_LABELS[tab];
  if (submission.priority?.evaluatedAt) return TAB_LABELS["5"];
  if (submission.block2?.updatedAt) return TAB_LABELS.UC;
  if (submission.step2?.completedAt) return TAB_LABELS["3"];
  if (submission.step2?.updatedAt) return TAB_LABELS["2"];
  return TAB_LABELS["1"];
}

/**
 * Scorciatoia di rientro in home: se il browser ha un'identità salvata e la
 * sessione è ancora attiva, si torna dentro con un clic (niente codice/nome).
 * Se la sessione è scaduta la card semplicemente non compare.
 */
export default function ResumeCard() {
  const [session, setSession] = useState<{ code: string; name: string; where: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const identity = readStoredIdentity();
    if (!identity) return;

    let cancelled = false;
    resumeSession(identity.code, identity.participantId)
      .then(({ participant, submission }) => {
        if (cancelled) return;
        setSession({
          code: identity.code,
          name: participant.name,
          where: describeProgress(submission),
        });
      })
      .catch((err) => {
        // Sessione scaduta o partecipante rimosso: l'identità salvata non serve più.
        // Con un errore di rete la teniamo: il rientro può ancora funzionare.
        if (err instanceof ApiError && err.status === 404) clearStoredIdentity();
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!session || dismissed) return null;

  return (
    <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-ifab-blue/30 bg-ifab-blue/5 p-5 text-left sm:flex-row sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ifab-blue/10">
          <RotateCcw className="text-ifab-blue" size={17} />
        </div>
        <div>
          <p className="text-sm font-semibold text-ifab-navy">
            Bentornato/a, {session.name} — sessione {session.code}
          </p>
          <p className="text-xs text-ifab-text-muted">Riprendi da: {session.where}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={`/session/${session.code}`}
          className="rounded-lg bg-ifab-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-ifab-blue-dark"
        >
          Riprendi
        </Link>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          title="Nascondi"
          className="rounded-lg p-2 text-ifab-text-muted transition hover:bg-white hover:text-ifab-navy"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
