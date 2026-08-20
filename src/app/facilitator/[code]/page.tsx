"use client";

import { startTransition, use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, LogOut, Trash2 } from "lucide-react";
import { deleteSession, facilitatorLogout, facilitatorMe, fetchAggregate, fetchState } from "@/lib/clientApi";
import { clearFacilitatorCode, saveFacilitatorCode } from "@/lib/participantStorage";
import { Participant, Submission } from "@/lib/types";
import PriorityPortfolio from "@/components/PriorityPortfolio";

const POLL_MS = 4000;
type PortfolioRow = { participant: Participant; submission: Submission };

export default function FacilitatorDashboard({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [facilitatorName, setFacilitatorName] = useState("");
  const [rows, setRows] = useState<PortfolioRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sessionMissing, setSessionMissing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    facilitatorMe()
      .then((me) => {
        if (!me.authenticated) throw new Error("not-auth");
        setFacilitatorName(me.name);
        setAuthChecked(true);
        saveFacilitatorCode(code);
      })
      .catch(() => router.replace("/facilitator/login"));
  }, [router, code]);

  const poll = useCallback(async () => {
    try {
      const [state, aggregate] = await Promise.all([fetchState(code), fetchAggregate(code)]);
      setRows(aggregate.rows);
      setError(null);
      setSessionMissing(!state.meta);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Errore di caricamento";
      setSessionMissing(/non valido|scadut/i.test(message));
      setError(message);
    }
  }, [code]);

  useEffect(() => {
    if (!authChecked) return;
    startTransition(() => void poll());
    const interval = setInterval(poll, POLL_MS);
    return () => clearInterval(interval);
  }, [authChecked, poll]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Il codice resta visibile anche se il browser nega la clipboard.
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Errore nell'eliminazione della sessione");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (!authChecked) return null;

  return (
    <div className="min-h-screen bg-ifab-navy">
      <header className="border-b border-white/10 bg-ifab-navy-deep px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/60">Facilitatore · {facilitatorName}</p>
            <h1 className="text-lg font-semibold text-white">Valutazione e priorità</h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button onClick={copyCode} className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20" title="Copia il codice sessione">
              <Copy size={15} /> Codice: <span className="font-mono tracking-widest">{code}</span>
              {copied && <span className="text-xs font-normal text-white/70">copiato</span>}
            </button>
            {confirmDelete ? (
              <span className="flex items-center gap-1">
                <button onClick={handleDeleteSession} disabled={deleting} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  {deleting ? "Elimino..." : "Conferma eliminazione"}
                </button>
                <button onClick={() => setConfirmDelete(false)} className="rounded-lg px-2 py-2 text-sm text-white/70">Annulla</button>
              </span>
            ) : (
              <button onClick={() => setConfirmDelete(true)} title="Elimina la sessione" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/70 hover:text-red-300">
                <Trash2 size={15} /> Elimina
              </button>
            )}
            <button onClick={handleLogout} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/70 hover:text-white">
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
              <button onClick={() => { clearFacilitatorCode(); router.replace("/facilitator/login"); }} className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white">
                Scegli un&apos;altra sessione
              </button>
            )}
          </div>
        )}

        <section className="mb-6 rounded-xl border border-white/10 bg-white/10 p-4 text-white">
          <h2 className="font-semibold">Unica fase · Valutazione e priorità</h2>
          <p className="mt-1 text-sm text-white/70">
            I partecipanti caricano il PDF e compilano personalmente i quattro punteggi. Questa dashboard mostra i risultati in sola lettura.
          </p>
        </section>

        <PriorityPortfolio rows={rows} />
      </main>
    </div>
  );
}
