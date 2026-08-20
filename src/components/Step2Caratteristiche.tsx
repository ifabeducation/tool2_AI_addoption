"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Lock, Save } from "lucide-react";
import { CARATTERISTICHE, INITIAL_MESSAGE_STEP2 } from "@/config/block1Frizione";
import { ChatMessage, Step1Submission, Step2Submission } from "@/lib/types";
import { candidateAttive } from "@/lib/frizioneScoring";
import { submitStep2 } from "@/lib/clientApi";
import { nowMs } from "@/lib/time";
import AgentChat from "./AgentChat";
import AssistantPanel from "./AssistantPanel";

/**
 * Step 2 — una scheda alla volta per ciascuna delle tre candidate, con un solo
 * slider deciso dal blocco della domanda di origine. Nessun punteggio, ranking
 * o anteprima: il calcolo appare solo nello Step 3, e da lì gli slider non si
 * toccano più (lo step si chiude con "Concludi").
 */
export default function Step2Caratteristiche({
  code,
  participantId,
  step1,
  step2,
  locked,
  onSaved,
}: {
  code: string;
  participantId: string;
  step1?: Step1Submission;
  step2?: Step2Submission;
  locked: boolean;
  onSaved: (data: Step2Submission) => void;
}) {
  const candidate = candidateAttive(step1, step2);
  const concluso = Boolean(step2?.completedAt);
  const readOnly = locked || concluso;

  const [valori, setValori] = useState<Record<string, number>>(step2?.valori ?? {});
  const [indice, setIndice] = useState(0);
  const [chatLog, setChatLog] = useState<ChatMessage[]>(step2?.chatLog ?? []);
  const [saving, setSaving] = useState(false);

  const dirtyRef = useRef(false);
  const pendingRef = useRef<Record<string, number> | null>(null);
  const onSavedRef = useRef(onSaved);

  useEffect(() => {
    onSavedRef.current = onSaved;
  });

  useEffect(() => {
    if (readOnly) return;
    pendingRef.current = valori;
    if (!dirtyRef.current) return;

    const timer = setTimeout(async () => {
      dirtyRef.current = false;
      try {
        const payload: Step2Submission = { valori, updatedAt: nowMs() };
        await submitStep2(code, participantId, payload);
        onSavedRef.current(payload);
      } catch {
        dirtyRef.current = true;
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [readOnly, valori, code, participantId]);

  useEffect(() => {
    return () => {
      const pending = pendingRef.current;
      if (!dirtyRef.current || !pending) return;
      dirtyRef.current = false;
      void submitStep2(code, participantId, { valori: pending, updatedAt: nowMs() });
    };
  }, [code, participantId]);

  async function handleChatUpdate(newLog: ChatMessage[]) {
    setChatLog(newLog);
    const payload: Step2Submission = { chatLog: newLog, updatedAt: nowMs() };
    await submitStep2(code, participantId, payload);
    onSaved(payload);
  }

  if (candidate.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ifab-border bg-white p-8 text-center text-sm text-ifab-text-muted">
        Nessuna attività da approfondire: torna allo Step 1 e segnala almeno un&apos;attività con il suo impatto.
      </div>
    );
  }

  const corrente = candidate[Math.min(indice, candidate.length - 1)];
  const caratteristica = CARATTERISTICHE[corrente.blocco];
  const valore = valori[String(corrente.domandaId)];
  const impostati = candidate.filter((c) => typeof valori[String(c.domandaId)] === "number").length;
  const tutteImpostate = impostati === candidate.length;

  function setValore(v: number) {
    if (readOnly) return;
    dirtyRef.current = true;
    setValori((prev) => ({ ...prev, [String(corrente.domandaId)]: v }));
  }

  async function handleConcludi() {
    setSaving(true);
    try {
      dirtyRef.current = false;
      const payload: Step2Submission = {
        valori,
        // Congela le candidate: da qui in poi l'esito non cambia se si rimette
        // mano allo Step 1.
        candidate: candidate.map((c) => c.domandaId),
        chatLog,
        updatedAt: nowMs(),
        completedAt: nowMs(),
      };
      await submitStep2(code, participantId, payload);
      onSaved(payload);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h2 className="mb-1 text-lg font-semibold text-ifab-navy">Step 2 · Le tre attività più impattanti</h2>
        <p className="text-sm text-ifab-text-muted">
          Una domanda per attività. Rispondi con la barra: non c&apos;è una risposta giusta in assoluto, serve a
          fotografare la situazione.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {candidate.map((c, i) => {
            const fatto = typeof valori[String(c.domandaId)] === "number";
            return (
              <button
                key={c.domandaId}
                type="button"
                onClick={() => !concluso && setIndice(i)}
                disabled={concluso}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:cursor-default ${
                  i === indice
                    ? "border-ifab-navy bg-ifab-navy text-white"
                    : "border-ifab-border bg-white text-ifab-text hover:border-ifab-blue"
                }`}
              >
                {i + 1}. {c.nome}
                {fatto && <span className={i === indice ? "text-emerald-300" : "text-emerald-500"}>●</span>}
              </button>
            );
          })}
        </div>
      </section>

      {concluso && (
        <div className="flex items-center gap-2 rounded-xl border border-ifab-border bg-ifab-bg-soft px-4 py-3 text-sm text-ifab-text-muted">
          <Lock size={15} /> Step concluso: le risposte non sono più modificabili. L&apos;esito è nello Step 3.
        </div>
      )}

      <section className="rounded-xl border border-ifab-border bg-white p-5">
        <p className="text-xs uppercase tracking-wide text-ifab-text-muted">
          Attività {indice + 1} di {candidate.length}
        </p>
        <h3 className="mt-1 text-lg font-semibold" style={{ color: "var(--ifab-navy)" }}>
          {corrente.nome}
        </h3>

        <p className="mt-4 text-sm font-medium text-ifab-text">{caratteristica.etichetta}</p>

        <div className="mt-4 flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            disabled={readOnly}
            value={valore ?? 5}
            onChange={(e) => setValore(Number(e.target.value))}
            className={`h-1.5 w-full cursor-pointer appearance-none rounded-full accent-ifab-blue ${
              typeof valore === "number" ? "bg-ifab-blue/30" : "bg-ifab-border"
            } disabled:cursor-not-allowed`}
          />
          <span
            className={`w-14 shrink-0 rounded-lg px-2 py-1 text-center text-sm font-semibold ${
              typeof valore === "number" ? "bg-ifab-blue/10 text-ifab-blue" : "bg-ifab-bg-soft text-ifab-text-muted"
            }`}
          >
            {typeof valore === "number" ? valore : "—"}
          </span>
        </div>

        {/* Sul blocco "sposti" il centro è la posizione ottimale: va reso
            evidente, altrimenti viene letto come un "non so". */}
        <div className="mt-3 grid gap-2 text-[11px] text-ifab-text-muted sm:grid-cols-3">
          {caratteristica.ancoraggi.map((a) => (
            <span
              key={a.posizione}
              className={`${a.posizione === "centro" ? "sm:text-center" : a.posizione === "max" ? "sm:text-right" : ""} ${
                a.posizione === "centro"
                  ? "rounded-lg bg-ifab-blue/10 px-2 py-1 font-semibold text-ifab-blue-dark"
                  : ""
              }`}
            >
              {a.testo}
            </span>
          ))}
        </div>

        {caratteristica.tipo === "campana" && (
          <p className="mt-3 rounded-lg bg-ifab-bg-soft px-3 py-2 text-xs text-ifab-text-muted">
            Il centro della barra non è un &quot;non so&quot;: descrive documenti con lo stesso contenuto ma forme
            diverse.
          </p>
        )}

        {typeof valore !== "number" && !readOnly && (
          <p className="mt-3 text-xs text-amber-700">Muovi la barra per rispondere.</p>
        )}

        {!concluso && (
          <div className="mt-5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIndice((i) => Math.max(0, i - 1))}
              disabled={indice === 0}
              className="flex items-center gap-1.5 rounded-lg border border-ifab-border px-3 py-2 text-sm text-ifab-navy transition hover:border-ifab-blue disabled:opacity-40"
            >
              <ArrowLeft size={15} /> Indietro
            </button>
            <button
              type="button"
              onClick={() => setIndice((i) => Math.min(candidate.length - 1, i + 1))}
              disabled={indice === candidate.length - 1}
              className="flex items-center gap-1.5 rounded-lg border border-ifab-border px-3 py-2 text-sm text-ifab-navy transition hover:border-ifab-blue disabled:opacity-40"
            >
              Avanti <ArrowRight size={15} />
            </button>
          </div>
        )}
      </section>

      <AssistantPanel title="Assistente AI" subtitle="Come interpretare la domanda">
        <AgentChat
          variant="panel"
          subsection="step2"
          context={{ selectedActivityLabels: candidate.map((c) => c.nome) }}
          initialMessage={INITIAL_MESSAGE_STEP2}
          initialChatLog={chatLog}
          onUpdate={handleChatUpdate}
          disabled={readOnly}
        />
      </AssistantPanel>

      {!concluso && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleConcludi}
            disabled={locked || saving || !tutteImpostate}
            className="flex items-center gap-2 rounded-lg bg-ifab-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-ifab-navy-deep disabled:opacity-50"
          >
            <Save size={16} /> {saving ? "Salvataggio..." : "Concludi lo step"}
          </button>
          <span className="text-xs text-ifab-text-muted">
            {tutteImpostate
              ? "Dopo la conclusione le risposte non saranno più modificabili."
              : `Risposte date: ${impostati}/${candidate.length}`}
          </span>
        </div>
      )}

      {concluso && (
        <p className="flex items-center gap-1 text-xs text-emerald-600">
          <CheckCircle2 size={14} /> Step concluso
        </p>
      )}
    </div>
  );
}
