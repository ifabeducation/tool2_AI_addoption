"use client";

import { Ref, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, FileDown, HelpCircle, Save } from "lucide-react";
import {
  BLOCK2_SECTIONS,
  Block2Field,
  Block2Section,
  isBlock2ValueFilled,
} from "@/config/block2Form";
import { calcolaEsiti, candidateAttive } from "@/lib/frizioneScoring";
import {
  Block2FieldValue,
  Block2Submission,
  ChatMessage,
  Step1Submission,
  Step2Submission,
} from "@/lib/types";
import { submitBlock2 } from "@/lib/clientApi";
import { nowMs } from "@/lib/time";
import { TEST_CLOSED_GROUPS, TEST_USE_CASE_VALUES } from "@/lib/testData";
import { downloadUseCasePdf } from "@/lib/useCasePdf";
import UseCaseInterview, { InterviewTurn } from "./UseCaseInterview";

const TOTAL_FIELDS = BLOCK2_SECTIONS.reduce((n, s) => n + s.fields.length, 0);

/** Il pulsante "test" della pagina compila la scheda e la apre già piena. */
export type UseCaseStepHandle = {
  fillWithTestData: () => void;
};

function asText(value: Block2FieldValue | undefined): string {
  return typeof value === "string" ? value : "";
}

function asList(value: Block2FieldValue | undefined): string[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Step 4 — un unico step per il caso d'uso, in due fasi:
 *   1. intervista: l'agente parte dalla domanda generica sul processo e ricava
 *      i campi della scheda da quello che il partecipante racconta;
 *   2. scheda: gli stessi campi del template, precompilati, da confermare o
 *      correggere a mano, con l'export PDF in fondo.
 * La fase raggiunta vive lato server (`interviewDone`), così il rientro riapre
 * la scheda e non ricomincia la conversazione.
 */
export default function UseCaseStep({
  code,
  participantId,
  participantName,
  step1,
  step2,
  block2,
  onSaved,
  ref,
}: {
  code: string;
  participantId: string;
  participantName: string;
  step1?: Step1Submission;
  step2?: Step2Submission;
  block2?: Block2Submission;
  onSaved: (data: Block2Submission) => void;
  ref?: Ref<UseCaseStepHandle>;
}) {
  const [values, setValues] = useState<Record<string, Block2FieldValue>>(block2?.values ?? {});
  const [chatLog, setChatLog] = useState<ChatMessage[]>(block2?.chatLog ?? []);
  const [closedGroups, setClosedGroups] = useState<string[]>(block2?.closedGroups ?? []);
  const [phase, setPhase] = useState<"intervista" | "scheda">(
    block2?.interviewDone || block2?.completedAt ? "scheda" : "intervista"
  );
  const [askedQuestion, setAskedQuestion] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(block2?.completedAt ?? null);
  const [exporting, setExporting] = useState(false);
  const [draftState, setDraftState] = useState<"idle" | "saving" | "saved">(
    block2?.updatedAt || block2?.completedAt ? "saved" : "idle"
  );

  // Stessa meccanica degli altri step: la bozza si salva da sola, così chiudere
  // il browser a metà scheda non fa perdere nulla e il rientro riparte da qui.
  const dirtyRef = useRef(false);
  const pendingRef = useRef<Record<string, Block2FieldValue> | null>(null);
  const onSavedRef = useRef(onSaved);

  // Contesto per l'agente: la candidata migliore del Blocco 1 (o, se l'esito
  // non è ancora calcolabile, le candidate in gioco).
  const esiti = calcolaEsiti(step1, step2);
  const processoContext =
    esiti[0]?.nome ?? candidateAttive(step1, step2).map((c) => c.nome).join(", ");
  const compiled = BLOCK2_SECTIONS.flatMap((s) => s.fields).filter((f) =>
    isBlock2ValueFilled(values[f.id])
  ).length;

  useEffect(() => {
    onSavedRef.current = onSaved;
  });

  useEffect(() => {
    pendingRef.current = values;
    if (!dirtyRef.current) return;

    const timer = setTimeout(async () => {
      dirtyRef.current = false;
      setDraftState("saving");
      try {
        const data: Block2Submission = { values, updatedAt: nowMs() };
        await submitBlock2(code, participantId, data);
        onSavedRef.current(data);
        setDraftState("saved");
      } catch {
        dirtyRef.current = true;
        setDraftState("idle");
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [values, code, participantId]);

  useEffect(() => {
    return () => {
      const pending = pendingRef.current;
      if (!dirtyRef.current || !pending) return;
      dirtyRef.current = false;
      void submitBlock2(code, participantId, { values: pending, updatedAt: nowMs() });
    };
  }, [code, participantId]);

  useImperativeHandle(ref, () => ({
    fillWithTestData: () => {
      dirtyRef.current = true;
      setDraftState("idle");
      setValues((prev) => ({ ...prev, ...TEST_USE_CASE_VALUES }));
      setClosedGroups(TEST_CLOSED_GROUPS);
      setAskedQuestion(undefined);
      setPhase("scheda");
      void submitBlock2(code, participantId, {
        values: TEST_USE_CASE_VALUES,
        closedGroups: TEST_CLOSED_GROUPS,
        interviewDone: true,
        updatedAt: nowMs(),
      });
    },
  }));

  function setValue(id: string, value: Block2FieldValue) {
    dirtyRef.current = true;
    setDraftState("idle");
    setValues((prev) => ({ ...prev, [id]: value }));
  }

  function toggleInList(id: string, option: string) {
    const current = asList(values[id]);
    setValue(id, current.includes(option) ? current.filter((v) => v !== option) : [...current, option]);
  }

  /** Un turno di intervista: i campi ricavati entrano nella scheda e si salvano. */
  async function handleTurn(turn: InterviewTurn) {
    const merged = { ...values, ...turn.fields };
    setValues(merged);
    setChatLog(turn.chatLog);
    setClosedGroups(turn.closedGroups);
    setDraftState("saving");
    const data: Block2Submission = {
      values: merged,
      chatLog: turn.chatLog,
      closedGroups: turn.closedGroups,
      updatedAt: nowMs(),
    };
    try {
      await submitBlock2(code, participantId, data);
      onSaved(data);
      setDraftState("saved");
    } catch {
      setDraftState("idle");
    }
  }

  /** Fine dell'intervista (o passaggio manuale): si apre la scheda da confermare. */
  async function openScheda() {
    setAskedQuestion(undefined);
    setPhase("scheda");
    const data: Block2Submission = { interviewDone: true, updatedAt: nowMs() };
    try {
      await submitBlock2(code, participantId, data);
      onSaved(data);
    } catch {
      // La fase è un comfort per il rientro: se non si salva si prosegue.
    }
  }

  function backToInterview(question?: string) {
    setAskedQuestion(question);
    setPhase("intervista");
  }

  async function handleSave() {
    setSaving(true);
    try {
      dirtyRef.current = false;
      const data: Block2Submission = {
        values,
        interviewDone: true,
        updatedAt: nowMs(),
        completedAt: nowMs(),
      };
      await submitBlock2(code, participantId, data);
      onSaved(data);
      setSavedAt(nowMs());
      setDraftState("saved");
    } finally {
      setSaving(false);
    }
  }

  async function handleExportPdf() {
    setExporting(true);
    try {
      await downloadUseCasePdf({ participantName, code, values, now: nowMs() });
    } finally {
      setExporting(false);
    }
  }

  function askAboutSection(section: Block2Section) {
    backToInterview(
      `Riprendiamo la sezione "${section.number} ${section.title}": aiutami a completarla meglio.`
    );
  }

  function renderField(field: Block2Field) {
    if (field.type === "textarea") {
      return (
        <textarea
          value={asText(values[field.id])}
          onChange={(e) => setValue(field.id, e.target.value)}
          rows={field.rows ?? 4}
          placeholder={field.placeholder}
          className="w-full rounded-lg border border-ifab-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ifab-blue"
        />
      );
    }

    if (field.type === "text") {
      return (
        <input
          value={asText(values[field.id])}
          onChange={(e) => setValue(field.id, e.target.value)}
          placeholder={field.placeholder}
          className="w-full rounded-lg border border-ifab-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ifab-blue"
          autoComplete="off"
        />
      );
    }

    if (field.type === "radio") {
      const selected = asText(values[field.id]);
      return (
        <div className="flex flex-wrap gap-2">
          {(field.options ?? []).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setValue(field.id, selected === opt.value ? "" : opt.value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                selected === opt.value
                  ? "border-ifab-blue bg-ifab-blue text-white"
                  : "border-ifab-border bg-ifab-bg-soft text-ifab-text hover:border-ifab-blue"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      );
    }

    const selectedList = asList(values[field.id]);
    return (
      <div className="flex flex-wrap gap-2">
        {(field.options ?? []).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggleInList(field.id, opt.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              selectedList.includes(opt.value)
                ? "border-ifab-blue bg-ifab-blue text-white"
                : "border-ifab-border bg-ifab-bg-soft text-ifab-text hover:border-ifab-blue"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  if (phase === "intervista") {
    return (
      <UseCaseInterview
        processoContext={processoContext}
        values={values}
        closedGroups={closedGroups}
        chatLog={chatLog}
        initialInput={askedQuestion}
        onTurn={handleTurn}
        onDone={openScheda}
        onOpenScheda={openScheda}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="mb-1 text-lg font-semibold text-ifab-navy">Step 4 · Scheda Use Case</h2>
        <p className="text-sm text-ifab-text-muted">
          Queste sono le informazioni che ho raccolto dalla conversazione, organizzate nei campi della scheda.
          Controllale: puoi correggere qualsiasi campo qui, oppure tornare a parlarne con l&apos;assistente.
        </p>
        <p className="mt-2 text-xs text-ifab-text-muted">
          Campi compilati: {compiled}/{TOTAL_FIELDS}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-ifab-blue/30 bg-ifab-blue/5 px-4 py-3">
        <button
          type="button"
          onClick={() => backToInterview()}
          className="flex items-center gap-2 rounded-lg border border-ifab-blue px-3 py-1.5 text-xs font-semibold text-ifab-blue-dark transition hover:bg-ifab-blue hover:text-white"
        >
          <ArrowLeft size={14} /> Torna alla conversazione
        </button>
        <span className="text-xs text-ifab-text-muted">
          Serve per aggiungere o cambiare qualcosa raccontandolo, invece di scriverlo campo per campo.
        </span>
      </div>

      {BLOCK2_SECTIONS.map((section) => (
        <section key={section.key} className="rounded-xl border border-ifab-border bg-white p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold text-ifab-blue-dark">
              {section.number} · {section.title}
            </h3>
            <button
              type="button"
              onClick={() => askAboutSection(section)}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-ifab-border px-2.5 py-1.5 text-xs font-medium text-ifab-navy transition hover:border-ifab-blue hover:text-ifab-blue"
            >
              <HelpCircle size={13} /> Chiedi all&apos;assistente
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {section.fields.map((field) => (
              <div key={field.id}>
                <label className="mb-1 block text-xs font-medium text-ifab-text-muted">{field.label}</label>
                {field.hint && <p className="mb-1.5 text-xs text-ifab-text-muted/80">{field.hint}</p>}
                {renderField(field)}
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-ifab-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-ifab-navy-deep disabled:opacity-50"
        >
          <Save size={16} /> {saving ? "Salvataggio..." : "Confermo la scheda"}
        </button>
        <button
          type="button"
          onClick={handleExportPdf}
          disabled={exporting}
          className="flex items-center gap-2 rounded-lg border border-ifab-navy px-4 py-2 text-sm font-semibold text-ifab-navy transition hover:bg-ifab-navy hover:text-white disabled:opacity-50"
        >
          <FileDown size={16} /> {exporting ? "Preparo il PDF..." : "Scarica PDF"}
        </button>
        {savedAt && (
          <span className="flex items-center gap-1 text-xs text-emerald-600">
            <CheckCircle2 size={14} /> Scheda confermata
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
