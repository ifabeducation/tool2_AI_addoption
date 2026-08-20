"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Save } from "lucide-react";
import {
  AVVISO_MOLTI_SI,
  DOMANDA_CRITERI_TACITI,
  DOMANDE,
  IMPATTO_ANCORAGGI,
  IMPATTO_DEFAULT,
  IMPATTO_LABEL,
  IMPATTO_SOTTOTESTO,
  INITIAL_MESSAGE_STEP1,
  MESSAGGIO_NESSUN_SI,
  SOGLIA_AVVISO_SI,
  TOTALE_DOMANDE,
  nomeSuggerito,
} from "@/config/block1Frizione";
import { ChatMessage, Step1Answer, Step1Submission } from "@/lib/types";
import { submitStep1 } from "@/lib/clientApi";
import { nowMs } from "@/lib/time";
import AgentChat from "./AgentChat";
import AssistantPanel from "./AssistantPanel";

/**
 * Step 1 — scheda di attrito: 21 domande sì/no in elenco unico (i blocchi
 * restano interni). Sul sì si aprono nome e barra di impatto, già posizionata
 * al centro della scala; tornando al no il valore viene scartato, perché un
 * impatto senza attrito dichiarato non significa nulla.
 */
export default function Step1Frizione({
  code,
  participantId,
  data,
  locked,
  onSaved,
}: {
  code: string;
  participantId: string;
  data?: Step1Submission;
  locked: boolean;
  onSaved: (data: Step1Submission) => void;
}) {
  const [risposte, setRisposte] = useState<Record<string, Step1Answer>>(data?.risposte ?? {});
  const [chatLog, setChatLog] = useState<ChatMessage[]>(data?.chatLog ?? []);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(data?.completedAt ?? null);
  const [draftState, setDraftState] = useState<"idle" | "saving" | "saved">(
    data?.updatedAt || data?.completedAt ? "saved" : "idle"
  );

  const dirtyRef = useRef(false);
  const pendingRef = useRef<Record<string, Step1Answer> | null>(null);
  const onSavedRef = useRef(onSaved);

  const risposteDate = Object.values(risposte).filter((r) => r?.risposta).length;
  const si = Object.entries(risposte).filter(([, r]) => r?.risposta === "si");
  const candidateCount = si.filter(([id]) => Number(id) !== DOMANDA_CRITERI_TACITI).length;
  const criteriTaciti = risposte[String(DOMANDA_CRITERI_TACITI)]?.risposta === "si";

  useEffect(() => {
    onSavedRef.current = onSaved;
  });

  useEffect(() => {
    if (locked) return;
    pendingRef.current = risposte;
    if (!dirtyRef.current) return;

    const timer = setTimeout(async () => {
      dirtyRef.current = false;
      setDraftState("saving");
      try {
        const payload: Step1Submission = { risposte, criteriTaciti, updatedAt: nowMs() };
        await submitStep1(code, participantId, payload);
        onSavedRef.current(payload);
        setDraftState("saved");
      } catch {
        dirtyRef.current = true;
        setDraftState("idle");
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [locked, risposte, criteriTaciti, code, participantId]);

  useEffect(() => {
    return () => {
      const pending = pendingRef.current;
      if (!dirtyRef.current || !pending) return;
      dirtyRef.current = false;
      const tacitiPending = pending[String(DOMANDA_CRITERI_TACITI)]?.risposta === "si";
      void submitStep1(code, participantId, {
        risposte: pending,
        criteriTaciti: tacitiPending,
        updatedAt: nowMs(),
      });
    };
  }, [code, participantId]);

  function setRisposta(id: number, patch: Partial<Step1Answer>) {
    if (locked) return;
    dirtyRef.current = true;
    setDraftState("idle");
    setRisposte((prev) => {
      const current = prev[String(id)] ?? { risposta: "no" };
      const next = { ...current, ...patch };
      // Passando a "no" impatto e nome vengono scartati, non conservati nascosti.
      if (next.risposta === "no") return { ...prev, [String(id)]: { risposta: "no" } };
      // Sul si la barra parte gia impostata: non esiste un valore "non ancora scelto".
      if (typeof next.impatto !== "number") next.impatto = IMPATTO_DEFAULT;
      return { ...prev, [String(id)]: next };
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      dirtyRef.current = false;
      const payload: Step1Submission = {
        risposte,
        criteriTaciti,
        chatLog,
        updatedAt: nowMs(),
        completedAt: nowMs(),
      };
      await submitStep1(code, participantId, payload);
      onSaved(payload);
      setSavedAt(nowMs());
      setDraftState("saved");
    } finally {
      setSaving(false);
    }
  }

  async function handleChatUpdate(newLog: ChatMessage[]) {
    setChatLog(newLog);
    const payload: Step1Submission = { chatLog: newLog, updatedAt: nowMs() };
    await submitStep1(code, participantId, payload);
    onSaved(payload);
  }

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h2 className="mb-1 text-lg font-semibold text-ifab-navy">Step 1 · Scheda di attrito</h2>
        <p className="text-sm text-ifab-text-muted">
          Rispondi sì o no pensando al tuo lavoro delle ultime settimane: sì se ti capita regolarmente, no se è
          un&apos;eccezione. Su ogni sì ti chiediamo quanto quell&apos;attività pesa sul processo.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-ifab-navy px-3 py-1.5 text-xs font-semibold text-white">
            {risposteDate}/{TOTALE_DOMANDE} risposte
          </span>
          {candidateCount > 0 && (
            <span className="text-xs text-ifab-text-muted">
              {candidateCount} {candidateCount === 1 ? "attività segnalata" : "attività segnalate"}
            </span>
          )}
        </div>
      </section>

      {si.length > SOGLIA_AVVISO_SI && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{AVVISO_MOLTI_SI}</span>
        </div>
      )}

      {risposteDate === TOTALE_DOMANDE && candidateCount === 0 && (
        <div className="rounded-xl border border-ifab-border bg-white px-4 py-3 text-sm text-ifab-text">
          {MESSAGGIO_NESSUN_SI}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {DOMANDE.map((domanda) => {
          const answer = risposte[String(domanda.id)];
          const isSi = answer?.risposta === "si";
          const isNo = answer?.risposta === "no";
          const isSpia = domanda.id === DOMANDA_CRITERI_TACITI;

          return (
            <section
              key={domanda.id}
              className={`rounded-xl border bg-white p-4 transition ${
                isSi ? "border-ifab-blue/50" : "border-ifab-border"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm text-ifab-text">
                  <span className="mr-2 text-xs font-semibold text-ifab-text-muted">{domanda.id}</span>
                  {domanda.testo}
                </p>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => setRisposta(domanda.id, { risposta: "si" })}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                      isSi
                        ? "border-ifab-blue bg-ifab-blue text-white"
                        : "border-ifab-border bg-white text-ifab-text hover:border-ifab-blue"
                    }`}
                  >
                    Sì
                  </button>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => setRisposta(domanda.id, { risposta: "no" })}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                      isNo
                        ? "border-ifab-navy bg-ifab-navy text-white"
                        : "border-ifab-border bg-white text-ifab-text hover:border-ifab-navy"
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>

              {isSi && isSpia && (
                <p className="mt-3 rounded-lg bg-ifab-bg-soft px-3 py-2 text-xs text-ifab-text-muted">
                  Questa risposta non concorre alla scelta delle attività: la useremo per calibrare quanta
                  supervisione umana serve.
                </p>
              )}

              {isSi && !isSpia && (
                <div className="mt-4 border-t border-ifab-border pt-4">
                  <label className="mb-1 block text-xs font-medium text-ifab-text-muted">
                    Come chiami questa attività? <span className="font-normal">(facoltativo)</span>
                  </label>
                  <input
                    disabled={locked}
                    value={answer?.nome ?? ""}
                    onChange={(e) => setRisposta(domanda.id, { nome: e.target.value })}
                    placeholder={nomeSuggerito(domanda.id)}
                    className="mb-4 w-full rounded-lg border border-ifab-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ifab-blue disabled:bg-ifab-bg-soft"
                    autoComplete="off"
                  />

                  <p className="text-xs font-medium text-ifab-text">{IMPATTO_LABEL}</p>
                  <p className="mt-0.5 text-xs text-ifab-text-muted">{IMPATTO_SOTTOTESTO}</p>

                  <div className="mt-3">
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={0.1}
                      disabled={locked}
                      value={answer?.impatto ?? IMPATTO_DEFAULT}
                      onChange={(e) => setRisposta(domanda.id, { impatto: Number(e.target.value) })}
                      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ifab-blue/30 accent-ifab-blue"
                    />
                  </div>

                  <div className="mt-2 flex flex-col gap-0.5 text-[11px] text-ifab-text-muted sm:flex-row sm:justify-between">
                    {IMPATTO_ANCORAGGI.map((a) => (
                      <span key={a.valore}>
                        <span className="font-semibold">{a.valore}</span> — {a.testo}
                      </span>
                    ))}
                  </div>

                </div>
              )}
            </section>
          );
        })}
      </div>

      <AssistantPanel title="Assistente AI" subtitle="Dubbi su una domanda o sull'impatto">
        <AgentChat
          variant="panel"
          subsection="step1"
          initialMessage={INITIAL_MESSAGE_STEP1}
          initialChatLog={chatLog}
          onUpdate={handleChatUpdate}
          disabled={locked}
        />
      </AssistantPanel>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={locked || saving || candidateCount === 0}
          className="flex items-center gap-2 rounded-lg bg-ifab-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-ifab-navy-deep disabled:opacity-50"
        >
          <Save size={16} /> {saving ? "Salvataggio..." : "Conferma la scheda"}
        </button>
        {candidateCount === 0 && risposteDate > 0 && (
          <span className="text-xs text-amber-700">
            Serve almeno un sì per proseguire: rivedi le risposte.
          </span>
        )}
        {savedAt && (
          <span className="flex items-center gap-1 text-xs text-emerald-600">
            <CheckCircle2 size={14} /> Salvato
          </span>
        )}
        {!savedAt && draftState !== "idle" && (
          <span className="text-xs text-ifab-text-muted">
            {draftState === "saving" ? "Salvataggio bozza..." : "Bozza salvata — la ritrovi al rientro"}
          </span>
        )}
      </div>
    </div>
  );
}
