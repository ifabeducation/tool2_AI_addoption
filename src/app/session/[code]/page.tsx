"use client";

import { startTransition, use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, RotateCcw, Users, X } from "lucide-react";
import { ApiError, fetchState, resumeSession } from "@/lib/clientApi";
import { clearStoredIdentity, readStoredIdentity, saveStoredIdentity, StoredIdentity } from "@/lib/participantStorage";
import { Submission } from "@/lib/types";
import Step5Priority from "@/components/Step5Priority";

const POLL_MS = 4000;

function hasWork(submission: Submission): boolean {
  return Boolean(submission.block2?.updatedAt || submission.priority?.evaluatedAt);
}

export default function SessionPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [identity, setIdentity] = useState<StoredIdentity | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [resumedBanner, setResumedBanner] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const backToJoin = useCallback(() => {
    clearStoredIdentity();
    router.replace(`/join?code=${code}&expired=1`);
  }, [code, router]);

  useEffect(() => {
    const stored = readStoredIdentity();
    if (!stored || stored.code !== code) {
      router.replace(`/join?code=${code}`);
      return;
    }

    let cancelled = false;
    resumeSession(code, stored.participantId)
      .then(({ participant, submission: restored }) => {
        if (cancelled) return;
        const refreshed: StoredIdentity = { code, participantId: participant.participantId, name: participant.name };
        saveStoredIdentity(refreshed);
        startTransition(() => {
          setIdentity(refreshed);
          setSubmission(restored);
          setResumedBanner(hasWork(restored));
        });
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 404) {
          backToJoin();
          return;
        }
        setLoadError("Sessione non raggiungibile. Controlla la connessione e ricarica la pagina.");
      });

    return () => { cancelled = true; };
  }, [code, router, backToJoin]);

  const poll = useCallback(async () => {
    if (!identity) return;
    try {
      const data = await fetchState(code, identity.participantId);
      if (!data.participantValid) {
        backToJoin();
        return;
      }
      setSubmission(data.ownSubmission ?? { participantId: identity.participantId });
      setLoadError(null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        backToJoin();
        return;
      }
      setLoadError(error instanceof Error ? error.message : "Sessione non raggiungibile");
    }
  }, [code, identity, backToJoin]);

  useEffect(() => {
    if (!identity) return;
    startTransition(() => void poll());
    const interval = setInterval(poll, POLL_MS);
    return () => clearInterval(interval);
  }, [identity, poll]);

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ifab-bg px-4 text-center">
        <p className="text-sm text-red-600">{loadError}</p>
        <button onClick={() => window.location.reload()} className="rounded-lg bg-ifab-blue px-4 py-2 text-sm font-semibold text-white">
          Riprova
        </button>
      </div>
    );
  }

  if (!identity || !submission) {
    return <div className="flex min-h-screen items-center justify-center bg-ifab-bg text-sm text-ifab-text-muted">Caricamento...</div>;
  }

  function handleExit() {
    clearStoredIdentity();
    router.replace("/join");
  }

  return (
    <div className="min-h-screen bg-ifab-bg">
      <header className="border-b border-ifab-border bg-white px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-ifab-text-muted">Workshop AI Adoption · IFAB Foundation</p>
            <h1 className="text-base font-semibold text-ifab-navy">Ciao, {identity.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full bg-ifab-bg-soft px-3 py-1.5 text-xs text-ifab-text-muted">
              <Users size={14} /> Sessione {identity.code}
            </div>
            <button onClick={handleExit} title="Esci da questa sessione" className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-ifab-text-muted hover:bg-ifab-bg-soft">
              <LogOut size={14} /> Esci
            </button>
          </div>
        </div>
      </header>

      {resumedBanner && (
        <div className="mx-auto mt-4 flex max-w-4xl items-center justify-between gap-3 rounded-xl border border-ifab-blue/30 bg-ifab-blue/5 px-4 py-3 text-sm text-ifab-navy sm:px-5">
          <span className="flex items-center gap-2"><RotateCcw size={15} className="text-ifab-blue" /> Sessione ripresa: i tuoi dati sono stati ripristinati.</span>
          <button onClick={() => setResumedBanner(false)} className="rounded-lg p-1 text-ifab-text-muted" title="Chiudi"><X size={15} /></button>
        </div>
      )}

      <nav className="mx-auto max-w-4xl px-4 pt-4 sm:px-8" aria-label="Fase del workshop">
        <span className="inline-flex rounded-lg bg-ifab-navy px-4 py-2 text-sm font-medium text-white">5 · Valutazione e priorità</span>
      </nav>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-8">
        <Step5Priority
          key={`${submission.priority?.evaluatedAt ?? 0}-${submission.priorityReflection?.submittedAt ?? 0}`}
          participantName={identity.name}
          participantId={identity.participantId}
          code={code}
          evaluation={submission.priority}
          block2={submission.block2}
          reflection={submission.priorityReflection}
          advice={submission.priorityAdvice}
          onSubmissionSaved={setSubmission}
        />
      </main>
    </div>
  );
}
