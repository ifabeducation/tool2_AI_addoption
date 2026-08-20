"use client";

import { Fragment, startTransition, use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Lock, RotateCcw, Users, X } from "lucide-react";
import {
  ApiError,
  fetchState,
  resumeSession,
  saveProgress,
  submitStep1,
  submitStep2,
} from "@/lib/clientApi";
import {
  clearStoredIdentity,
  readStoredIdentity,
  saveStoredIdentity,
  StoredIdentity,
} from "@/lib/participantStorage";
import {
  Block2Submission,
  ParticipantTab,
  Step1Submission,
  Step2Submission,
  Submission,
  UnlockedSteps,
} from "@/lib/types";
import { DEFAULT_UNLOCKED_STEPS } from "@/lib/types";
import { nowMs } from "@/lib/time";
import { candidateAttive } from "@/lib/frizioneScoring";
import { testStep1Submission, testStep2Submission } from "@/lib/testData";
import Step1Frizione from "@/components/Step1Frizione";
import Step2Caratteristiche from "@/components/Step2Caratteristiche";
import Step3Esito from "@/components/Step3Esito";
import UseCaseStep, { UseCaseStepHandle } from "@/components/UseCaseStep";
import TestFillButton from "@/components/TestFillButton";
import Step5Priority from "@/components/Step5Priority";

const POLL_MS = 4000;

const TAB_TO_STEP: Record<ParticipantTab, keyof UnlockedSteps> = {
  "1": "step1",
  "2": "step2",
  "3": "step3",
  UC: "useCase",
  "5": "priority",
};

function hasWork(submission: Submission): boolean {
  return Boolean(
    submission.step1?.updatedAt ||
      submission.step2?.updatedAt ||
      submission.block2?.updatedAt ||
      submission.priority?.evaluatedAt
  );
}

export default function SessionPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [identity, setIdentity] = useState<StoredIdentity | null>(null);
  const [unlockedSteps, setUnlockedSteps] = useState<UnlockedSteps>(DEFAULT_UNLOCKED_STEPS);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [tab, setTab] = useState<ParticipantTab>("1");
  const [resumedBanner, setResumedBanner] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // I componenti degli step tengono in stato locale i propri valori: dopo un
  // riempimento di test vanno rimontati, altrimenti mostrano ancora i vecchi.
  const [testStamp, setTestStamp] = useState(0);
  const useCaseRef = useRef<UseCaseStepHandle>(null);

  /** L'identità salvata non vale più (sessione scaduta, nuova sessione, dati ripuliti). */
  const backToJoin = useCallback(() => {
    clearStoredIdentity();
    router.replace(`/join?code=${code}&expired=1`);
  }, [code, router]);

  // Rientro: valida l'identità salvata nel browser e ripristina dati e posizione.
  useEffect(() => {
    const stored = readStoredIdentity();
    if (!stored || stored.code !== code) {
      router.replace(`/join?code=${code}`);
      return;
    }

    let cancelled = false;
    resumeSession(code, stored.participantId)
      .then(({ participant, submission: restored, meta }) => {
        if (cancelled) return;
        const refreshed: StoredIdentity = {
          code,
          participantId: participant.participantId,
          name: participant.name,
        };
        saveStoredIdentity(refreshed);

        const savedTab = restored.progress?.tab;
        startTransition(() => {
          setIdentity(refreshed);
          setUnlockedSteps(meta.unlockedSteps);
          setSubmission(restored);
          // Uno step salvato ma non più previsto (struttura cambiata) non
          // riapre nulla: si riparte dal primo step sbloccato.
          const savedStep = savedTab ? TAB_TO_STEP[savedTab] : undefined;
          if (restored.block2?.sourcePdf) setTab("5");
          else if (savedTab && savedStep && meta.unlockedSteps[savedStep]) setTab(savedTab);
          setResumedBanner(hasWork(restored));
        });
      })
      .catch((err) => {
        if (cancelled) return;
        // Solo un "non esiste più" lato server fa ripartire dal form: un errore
        // di rete deve poter essere superato ricaricando la pagina.
        if (err instanceof ApiError && err.status === 404) {
          backToJoin();
          return;
        }
        setLoadError("Sessione non raggiungibile. Controlla la connessione e ricarica la pagina.");
      });

    return () => {
      cancelled = true;
    };
  }, [code, router, backToJoin]);

  const poll = useCallback(async () => {
    if (!identity) return;
    try {
      const data = await fetchState(code, identity.participantId);
      if (!data.participantValid) {
        backToJoin();
        return;
      }
      setUnlockedSteps(data.meta.unlockedSteps);
      setSubmission(data.ownSubmission ?? { participantId: identity.participantId });
      setLoadError(null);
    } catch (err) {
      // Sessione eliminata dal facilitatore o scaduta mentre si lavorava:
      // meglio riportare al form di ingresso che lasciare un errore secco.
      if (err instanceof ApiError && err.status === 404) {
        backToJoin();
        return;
      }
      setLoadError(err instanceof Error ? err.message : "Sessione non raggiungibile");
    }
  }, [code, identity, backToJoin]);

  useEffect(() => {
    if (!identity) return;
    startTransition(() => {
      void poll();
    });
    const interval = setInterval(poll, POLL_MS);
    return () => clearInterval(interval);
  }, [identity, poll]);

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ifab-bg px-4 text-center">
        <p className="text-sm text-red-600">{loadError}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-ifab-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-ifab-blue-dark"
        >
          Riprova
        </button>
      </div>
    );
  }

  if (!identity) return null;

  if (!submission) {
    return <div className="flex min-h-screen items-center justify-center bg-ifab-bg text-sm text-ifab-text-muted">Caricamento...</div>;
  }

  const { step1, step2, block2, priority, priorityReflection, priorityAdvice } = submission;

  function updateSubmission(patch: Partial<Submission>) {
    setSubmission((prev) => ({ ...(prev as Submission), ...patch }));
  }

  /**
   * Ogni cambio di step viene memorizzato lato server: al rientro (anche da un
   * altro dispositivo) si riparte da qui invece che sempre dal primo step.
   */
  function handleTabChange(nextTab: ParticipantTab) {
    setTab(nextTab);
    setResumedBanner(false);
    const current = identity;
    if (!current) return;
    void saveProgress(code, current.participantId, { tab: nextTab, updatedAt: nowMs() }).catch(() => {
      // La posizione è un comfort, non un dato del workshop: se fallisce si prosegue.
    });
  }

  /**
   * Pulsante "test": compila con dati di esempio lo step che si sta guardando.
   * Lo Step 2 e l'esito si appoggiano alle candidate dello Step 1, quindi se le
   * risposte dello Step 1 mancano vengono generate anche quelle.
   */
  async function handleTestFill() {
    const current = identity;
    if (!current) return;

    if (tab === "UC") {
      useCaseRef.current?.fillWithTestData();
      return;
    }
    // Lo Step 5 è deliberatamente read-only anche nel percorso di test.
    if (tab === "5") return;

    const patch: Partial<Submission> = {};
    const serveStep1 = tab === "1" || candidateAttive(step1, step2).length === 0;
    let base = step1;

    if (serveStep1) {
      const dati = testStep1Submission();
      await submitStep1(code, current.participantId, dati);
      patch.step1 = dati;
      base = dati;
    }

    if (tab !== "1" && base) {
      const dati = testStep2Submission(base);
      await submitStep2(code, current.participantId, dati);
      patch.step2 = { ...step2, ...dati };
    }

    updateSubmission(patch);
    setTestStamp((n) => n + 1);
  }

  function handleExit() {
    clearStoredIdentity();
    router.replace("/join");
  }

  const tabs: { key: ParticipantTab; label: string }[] = [
    { key: "1", label: "1 · Scheda di attrito" },
    { key: "2", label: "2 · Caratteristiche" },
    { key: "3", label: "3 · Esito" },
    { key: "UC", label: "4 · Use Case" },
    { key: "5", label: "5 · Valutazione e priorità" },
  ];
  const importedFromPdf = Boolean(block2?.sourcePdf);
  const visibleTabs = importedFromPdf ? tabs.filter((item) => item.key === "5") : tabs;

  const testTitles: Record<ParticipantTab, string> = {
    "1": "Compila lo Step 1 con risposte di esempio",
    "2": "Compila lo Step 2 con valori di esempio",
    "3": "Genera Step 1 e 2 di esempio per vedere l'esito",
    UC: "Compila la scheda Use Case con dati di esempio",
    "5": "La valutazione può essere compilata solo dal facilitatore",
  };

  return (
    // Quando il pannello dell'assistente è aperto, da lg in su la pagina si
    // restringe per non finirgli sotto.
    <div className="min-h-screen bg-ifab-bg transition-[padding] lg:has-[aside[data-assistant=open]]:pr-[380px]">
      <header className="border-b border-ifab-border bg-white px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-ifab-text-muted">Workshop AI Adoption · IFAB Foundation</p>
            <h1 className="text-base font-semibold text-ifab-navy">Ciao, {identity.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            {!importedFromPdf && (
              <TestFillButton
                onClick={() => void handleTestFill()}
                title={testTitles[tab]}
                disabled={tab === "5" || !unlockedSteps[TAB_TO_STEP[tab]]}
              />
            )}
            <div className="flex items-center gap-1.5 rounded-full bg-ifab-bg-soft px-3 py-1.5 text-xs text-ifab-text-muted">
              <Users size={14} /> Sessione {identity.code}
            </div>
            <button
              onClick={handleExit}
              title="Esci da questa sessione su questo dispositivo"
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-ifab-text-muted transition hover:bg-ifab-bg-soft hover:text-ifab-navy"
            >
              <LogOut size={14} /> Esci
            </button>
          </div>
        </div>
      </header>

      {resumedBanner && (
        <div className="mx-auto mt-4 flex max-w-4xl items-center justify-between gap-3 rounded-xl border border-ifab-blue/30 bg-ifab-blue/5 px-4 py-3 text-sm text-ifab-navy sm:px-5">
          <span className="flex items-center gap-2">
            <RotateCcw size={15} className="text-ifab-blue" />
            Sessione ripresa: i dati che avevi inserito sono stati ripristinati.
          </span>
          <button
            onClick={() => setResumedBanner(false)}
            className="rounded-lg p-1 text-ifab-text-muted transition hover:text-ifab-navy"
            title="Chiudi"
          >
            <X size={15} />
          </button>
        </div>
      )}

      <nav className="mx-auto flex max-w-4xl flex-wrap items-center gap-2 px-4 pt-4 sm:px-8">
        {visibleTabs.map((t) => {
          const unlocked = unlockedSteps[TAB_TO_STEP[t.key]];
          return (
            <Fragment key={t.key}>
              {/* Separatore fra gli step del Blocco 1 e lo Step 4 del caso d'uso */}
              {(t.key === "UC" || t.key === "5") && <span className="mx-1 hidden h-6 w-px bg-ifab-border sm:block" />}
              <button
                onClick={() => unlocked && handleTabChange(t.key)}
                disabled={!unlocked}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  tab === t.key ? "bg-ifab-navy text-white" : "bg-white text-ifab-navy border border-ifab-border"
                }`}
              >
                {!unlocked && <Lock size={13} />}
                {t.label}
              </button>
            </Fragment>
          );
        })}
      </nav>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-8">
        {tab === "1" && (
          <Step1Frizione
            key={`step1-${testStamp}`}
            code={code}
            participantId={identity.participantId}
            data={step1}
            locked={!unlockedSteps.step1}
            onSaved={(data: Step1Submission) =>
              updateSubmission({ step1: { ...step1, ...data, risposte: data.risposte ?? step1?.risposte } })
            }
          />
        )}
        {tab === "2" && (
          <Step2Caratteristiche
            key={`step2-${testStamp}`}
            code={code}
            participantId={identity.participantId}
            step1={step1}
            step2={step2}
            locked={!unlockedSteps.step2}
            onSaved={(data: Step2Submission) =>
              updateSubmission({ step2: { ...step2, ...data, valori: { ...step2?.valori, ...data.valori } } })
            }
          />
        )}
        {tab === "3" && <Step3Esito participantName={identity.name} step1={step1} step2={step2} />}
        {tab === "UC" &&
          (unlockedSteps.useCase ? (
            <UseCaseStep
              ref={useCaseRef}
              code={code}
              participantId={identity.participantId}
              participantName={identity.name}
              step1={step1}
              step2={step2}
              block2={block2}
              onSaved={(data: Block2Submission) =>
                updateSubmission({ block2: { ...block2, ...data, values: { ...block2?.values, ...data.values } } })
              }
            />
          ) : (
            <div className="rounded-xl border border-dashed border-ifab-border bg-white p-8 text-center text-sm text-ifab-text-muted">
              <Lock className="mx-auto mb-2" size={20} />
              In attesa che il facilitatore sblocchi lo Step 4 — Use Case.
            </div>
          ))}
        {tab === "5" &&
          (unlockedSteps.priority ? (
            <Step5Priority
              key={`${priority?.evaluatedAt ?? 0}-${priorityReflection?.submittedAt ?? 0}`}
              participantName={identity.name}
              participantId={identity.participantId}
              code={code}
              evaluation={priority}
              block2={block2}
              reflection={priorityReflection}
              advice={priorityAdvice}
              onSubmissionSaved={setSubmission}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-ifab-border bg-white p-8 text-center text-sm text-ifab-text-muted">
              <Lock className="mx-auto mb-2" size={20} />
              In attesa che il facilitatore sblocchi lo Step 5 — Valutazione e priorità.
            </div>
          ))}
      </main>
    </div>
  );
}
