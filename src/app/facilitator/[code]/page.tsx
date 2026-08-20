"use client";

import { startTransition, use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Lock, LockOpen, LogOut, Users, Copy, FileDown, Trash2 } from "lucide-react";
import {
  facilitatorMe,
  facilitatorLogout,
  fetchState,
  fetchAggregate,
  unlockStep,
  deleteSession,
} from "@/lib/clientApi";
import { clearFacilitatorCode, saveFacilitatorCode } from "@/lib/participantStorage";
import { DOMANDE, DOMANDA_CRITERI_TACITI } from "@/config/block1Frizione";
import { BLOCK2_FIELDS } from "@/config/block2Form";
import { calcolaEsiti } from "@/lib/frizioneScoring";
import { nowMs } from "@/lib/time";
import { downloadUseCasePdf } from "@/lib/useCasePdf";
import { Participant, Submission, UnlockedSteps, DEFAULT_UNLOCKED_STEPS } from "@/lib/types";
import TestFillButton from "@/components/TestFillButton";
import PriorityPortfolio from "@/components/PriorityPortfolio";

const POLL_MS = 4000;

const BLOCK2_FIELD_COUNT = BLOCK2_FIELDS.length;

const STEP_ORDER: { key: keyof UnlockedSteps; label: string; block: 1 | 2 | 3 }[] = [
  { key: "step1", label: "1 · Scheda di attrito", block: 1 },
  { key: "step2", label: "2 · Caratteristiche", block: 1 },
  { key: "step3", label: "3 · Esito", block: 1 },
  { key: "useCase", label: "4 · Use Case (intervista + scheda)", block: 2 },
  { key: "priority", label: "5 · Valutazione e priorità", block: 3 },
];

export default function FacilitatorDashboard({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [facilitatorName, setFacilitatorName] = useState("");
  const [unlockedSteps, setUnlockedSteps] = useState<UnlockedSteps>(DEFAULT_UNLOCKED_STEPS);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [rows, setRows] = useState<{ participant: Participant; submission: Submission }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sessionMissing, setSessionMissing] = useState(false);
  // Eliminazione in due passaggi: cancella dati di tutti i partecipanti.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copiato, setCopiato] = useState(false);
  // Partecipante di cui si sta generando il PDF della scheda Use Case.
  const [pdfFor, setPdfFor] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    facilitatorMe()
      .then((me) => {
        if (!me.authenticated) throw new Error("not-auth");
        setFacilitatorName(me.name);
        setAuthChecked(true);
        // Sessione effettivamente aperta: diventa quella proposta al prossimo rientro,
        // anche se ci si è arrivati da un link invece che dal selettore.
        saveFacilitatorCode(code);
      })
      .catch(() => router.replace("/facilitator/login"));
  }, [router, code]);

  const poll = useCallback(async () => {
    try {
      const state = await fetchState(code);
      setUnlockedSteps(state.meta.unlockedSteps);
      const agg = await fetchAggregate(code);
      setParticipants(agg.rows.map((r) => r.participant));
      setRows(agg.rows);
      setError(null);
      setSessionMissing(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore di caricamento";
      // Sessione scaduta o codice non più valido: da qui si torna al selettore
      // invece di restare su una dashboard che non aggiornerà mai nulla.
      setSessionMissing(/non valido|scadut/i.test(message));
      setError(message);
    }
  }, [code]);

  useEffect(() => {
    if (!authChecked) return;
    startTransition(() => {
      void poll();
    });
    const interval = setInterval(poll, POLL_MS);
    return () => clearInterval(interval);
  }, [authChecked, poll]);

  async function toggleStep(step: keyof UnlockedSteps) {
    const next = !unlockedSteps[step];
    setUnlockedSteps((prev) => ({ ...prev, [step]: next }));
    await unlockStep(code, step, next);
  }

  /**
   * Pulsante "test" della dashboard: qui non ci sono campi da compilare, ma per
   * provare il tool serve una sessione con tutti gli step aperti (i dati di
   * esempio li genera il pulsante "test" della pagina partecipante).
   */
  async function unlockAllSteps() {
    const chiusi = STEP_ORDER.filter((s) => !unlockedSteps[s.key]);
    setUnlockedSteps((prev) => {
      const next = { ...prev };
      for (const s of STEP_ORDER) next[s.key] = true;
      return next;
    });
    for (const s of chiusi) await unlockStep(code, s.key, true);
  }

  /** Scheda Use Case di un partecipante, in PDF, dai soli dati salvati. */
  async function handleUseCasePdf(participant: Participant, submission: Submission) {
    setPdfFor(participant.participantId);
    try {
      await downloadUseCasePdf({
        participantName: participant.name,
        code,
        values: submission.block2?.values ?? {},
        now: nowMs(),
      });
    } finally {
      setPdfFor(null);
    }
  }

  async function handleLogout() {
    await facilitatorLogout();
    clearFacilitatorCode();
    router.replace("/facilitator/login");
  }

  async function handleDeleteSession() {
    setDeleting(true);
    try {
      await deleteSession(code);
      clearFacilitatorCode();
      router.replace("/facilitator/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore nell'eliminazione della sessione");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  /** Copia il solo codice: e' quello che il facilitatore detta o proietta. */
  async function copyCodice() {
    try {
      await navigator.clipboard.writeText(code);
      setCopiato(true);
      setTimeout(() => setCopiato(false), 2000);
    } catch {
      // Clipboard negata dal browser: il codice resta comunque leggibile sul pulsante.
    }
  }

  async function handleExportPdf() {
    if (!printRef.current) return;
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
      import("jspdf"),
      import("html2canvas"),
    ]);
    const canvas = await html2canvas(printRef.current, { backgroundColor: "#ffffff", scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgWidth = pageWidth - 48;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.text(`Workshop AI Adoption — Sessione ${code}`, 24, 28);
    pdf.addImage(imgData, "PNG", 24, 40, imgWidth, imgHeight);
    pdf.save(`workshop-ai-adoption-sessione-${code}.pdf`);
  }

  if (!authChecked) return null;

  // Quante persone hanno segnalato attrito su ciascuna attività di riferimento
  // (una domanda può mappare più attività: contano tutte).
  const attivitaCounts = new Map<string, number>();
  for (const { submission } of rows) {
    const attivitaPersona = new Set<string>();
    for (const domanda of DOMANDE) {
      if (domanda.id === DOMANDA_CRITERI_TACITI) continue;
      if (submission.step1?.risposte?.[String(domanda.id)]?.risposta !== "si") continue;
      domanda.attivita.forEach((a) => attivitaPersona.add(a));
    }
    attivitaPersona.forEach((a) => attivitaCounts.set(a, (attivitaCounts.get(a) ?? 0) + 1));
  }
  const activityCounts = Array.from(attivitaCounts.entries())
    .map(([attivita, conteggio]) => ({ attivita, conteggio }))
    .sort((a, b) => b.conteggio - a.conteggio);

  return (
    <div className="min-h-screen bg-ifab-navy">
      <header className="border-b border-white/10 bg-ifab-navy-deep px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/60">Facilitatore · {facilitatorName}</p>
            <h1 className="text-lg font-semibold text-white">Workshop AI Adoption</h1>
          </div>
          <div className="flex items-center gap-3">
            <TestFillButton
              onClick={() => void unlockAllSteps()}
              tone="dark"
              title="Sblocca tutti gli step per una prova (i dati di esempio si generano dalla pagina partecipante)"
            />
            <button
              onClick={copyCodice}
              className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
              title="Copia il codice sessione"
            >
              <Copy size={15} /> Codice: <span className="font-mono tracking-widest">{code}</span>
              {copiato && <span className="text-xs font-normal text-white/70">copiato</span>}
            </button>
            {confirmDelete ? (
              <span className="flex items-center gap-1">
                <button
                  onClick={handleDeleteSession}
                  disabled={deleting}
                  className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                >
                  {deleting ? "Elimino..." : "Conferma eliminazione"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-lg px-2 py-2 text-sm text-white/70 transition hover:text-white"
                >
                  Annulla
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                title="Elimina la sessione e tutti i dati dei partecipanti"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/70 transition hover:text-red-300"
              >
                <Trash2 size={15} /> Elimina
              </button>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/70 transition hover:text-white"
            >
              <LogOut size={15} /> Esci
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
        {error && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700">
            <span>{error}</span>
            {sessionMissing && (
              <button
                onClick={() => {
                  clearFacilitatorCode();
                  router.replace("/facilitator/login");
                }}
                className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-800"
              >
                Scegli un&apos;altra sessione
              </button>
            )}
          </div>
        )}

        <section className="mb-6 rounded-xl bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-ifab-navy">
            Sblocca gli step <span className="font-normal text-ifab-text-muted">— Blocco 1</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {STEP_ORDER.filter((s) => s.block === 1).map((s) => {
              const unlocked = unlockedSteps[s.key];
              return (
                <button
                  key={s.key}
                  onClick={() => toggleStep(s.key)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    unlocked
                      ? "border-ifab-blue bg-ifab-blue text-white"
                      : "border-ifab-border bg-white text-ifab-text hover:border-ifab-blue"
                  }`}
                >
                  {unlocked ? <LockOpen size={14} /> : <Lock size={14} />}
                  {s.label}
                </button>
              );
            })}
          </div>

          <h2 className="mb-3 mt-5 text-sm font-semibold text-ifab-navy">
            Sblocca gli step <span className="font-normal text-ifab-text-muted">— Blocco 2</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {STEP_ORDER.filter((s) => s.block === 2).map((s) => {
              const unlocked = unlockedSteps[s.key];
              return (
                <button
                  key={s.key}
                  onClick={() => toggleStep(s.key)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    unlocked
                      ? "border-ifab-blue bg-ifab-blue text-white"
                      : "border-ifab-border bg-white text-ifab-text hover:border-ifab-blue"
                  }`}
                >
                  {unlocked ? <LockOpen size={14} /> : <Lock size={14} />}
                  {s.label}
                </button>
              );
            })}
          </div>

          <h2 className="mb-3 mt-5 text-sm font-semibold text-ifab-navy">
            Sblocca gli step <span className="font-normal text-ifab-text-muted">— Blocco 3</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {STEP_ORDER.filter((s) => s.block === 3).map((s) => {
              const unlocked = unlockedSteps[s.key];
              return (
                <button
                  key={s.key}
                  onClick={() => toggleStep(s.key)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    unlocked
                      ? "border-ifab-blue bg-ifab-blue text-white"
                      : "border-ifab-border bg-white text-ifab-text hover:border-ifab-blue"
                  }`}
                >
                  {unlocked ? <LockOpen size={14} /> : <Lock size={14} />}
                  {s.label}
                </button>
              );
            })}
          </div>
        </section>

        <div ref={printRef} className="rounded-xl bg-white p-5">
          <section className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ifab-navy">
                <Users size={16} /> Partecipanti ({participants.length})
              </h2>
              <button
                onClick={handleExportPdf}
                className="flex items-center gap-2 rounded-lg border border-ifab-navy px-3 py-1.5 text-xs font-semibold text-ifab-navy transition hover:bg-ifab-navy hover:text-white"
              >
                <FileDown size={14} /> Esporta dashboard
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-ifab-border text-ifab-text-muted">
                    <th className="py-2 pr-4">Nome</th>
                    <th className="py-2 pr-4">Step 1</th>
                    <th className="py-2 pr-4">Step 2</th>
                    <th className="py-2 pr-4">Candidata migliore</th>
                    <th className="py-2 pr-4">Use Case</th>
                    <th className="py-2 pr-4">Scheda</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ participant, submission }) => {
                    const risposteDate = Object.values(submission.step1?.risposte ?? {}).filter(
                      (r) => r?.risposta
                    ).length;
                    const siDichiarati = Object.values(submission.step1?.risposte ?? {}).filter(
                      (r) => r?.risposta === "si"
                    ).length;
                    const esiti = calcolaEsiti(submission.step1, submission.step2);
                    const migliore = esiti[0];
                    // Blocco 2: distingue "consegnata" (Salva scheda) da "in bozza".
                    const useCaseFilled = Object.values(submission.block2?.values ?? {}).filter((v) =>
                      Array.isArray(v) ? v.length > 0 : Boolean(v && v.trim())
                    ).length;
                    const useCaseLabel = submission.block2?.sourcePdf
                      ? `PDF · ${submission.block2.sourcePdf.extractedFieldCount} campi`
                      : submission.block2?.completedAt
                        ? "✅"
                      : useCaseFilled > 0
                        ? `${useCaseFilled}/${BLOCK2_FIELD_COUNT}`
                        : "—";
                    return (
                      <tr key={participant.participantId} className="border-b border-ifab-border">
                        <td className="py-2 pr-4 font-medium text-ifab-text">
                          {participant.name}
                          {submission.step1?.criteriTaciti && (
                            <span
                              className="ml-1.5 text-amber-600"
                              title="Ha dichiarato criteri non documentati sulle eccezioni"
                            >
                              ⚠
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          {submission.step1?.completedAt
                            ? `✅ ${siDichiarati} sì`
                            : risposteDate > 0
                              ? `${risposteDate}/${DOMANDE.length}`
                              : "—"}
                        </td>
                        <td className="py-2 pr-4">
                          {submission.step2?.completedAt
                            ? "✅"
                            : Object.keys(submission.step2?.valori ?? {}).length > 0
                              ? "in corso"
                              : "—"}
                        </td>
                        <td className="py-2 pr-4 text-ifab-text-muted">
                          {migliore ? `${migliore.nome} (${Math.round(migliore.punteggio)})` : "—"}
                        </td>
                        <td className="py-2 pr-4">{useCaseLabel}</td>
                        <td className="py-2 pr-4">
                          {useCaseFilled > 0 ? (
                            <button
                              onClick={() => void handleUseCasePdf(participant, submission)}
                              disabled={pdfFor === participant.participantId}
                              title={`Scarica la scheda Use Case di ${participant.name} in PDF`}
                              className="flex items-center gap-1.5 rounded-lg border border-ifab-border px-2 py-1 text-[11px] font-semibold text-ifab-navy transition hover:border-ifab-navy hover:bg-ifab-navy hover:text-white disabled:opacity-50"
                            >
                              <FileDown size={12} />
                              {pdfFor === participant.participantId ? "Attendere..." : "PDF"}
                            </button>
                          ) : (
                            <span className="text-ifab-text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-ifab-text-muted">
                        Nessun partecipante ancora connesso.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-ifab-navy">
              Attrito segnalato per attività di riferimento
            </h2>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityCounts} layout="vertical" margin={{ left: 24, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="attivita" width={180} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="conteggio" fill="#1b98e0" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        <div className="mt-6">
          <PriorityPortfolio
            code={code}
            rows={rows}
            onEvaluationSaved={(participantId, evaluation) =>
              setRows((current) =>
                current.map((row) =>
                  row.participant.participantId === participantId
                    ? { ...row, submission: { ...row.submission, priority: evaluation } }
                    : row
                )
              )
            }
          />
        </div>
      </main>
    </div>
  );
}
