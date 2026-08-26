"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Plus, RotateCcw, ShieldCheck, Trash2, Users } from "lucide-react";
import {
  createSession,
  deleteSession,
  facilitatorLogin,
  facilitatorLogout,
  facilitatorMe,
  listSessions,
} from "@/lib/clientApi";
import { clearFacilitatorCode, readFacilitatorCode, saveFacilitatorCode } from "@/lib/participantStorage";
import { SessionSummary } from "@/lib/types";

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function FacilitatorLoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // "checking": verifica del cookie in corso; "login": form; "picker": scelta sessione.
  const [phase, setPhase] = useState<"checking" | "login" | "picker">("checking");
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [lastCode, setLastCode] = useState<string | null>(null);
  // Eliminazione in due passaggi: il primo clic chiede conferma sulla riga.
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const enterSession = useCallback(
    (code: string) => {
      saveFacilitatorCode(code);
      router.push(`/facilitator/${code}`);
    },
    [router]
  );

  /**
   * Dopo l'autenticazione mostriamo le sessioni ancora attive: il facilitatore
   * che rientra (ricarica, browser diverso, giorno dopo) riprende quella in
   * corso invece di crearne una nuova con un codice che nessuno ha.
   */
  const loadSessions = useCallback(async () => {
    setLastCode(readFacilitatorCode());
    try {
      const { sessions: active } = await listSessions();
      if (active.length === 0) {
        // Nessuna sessione viva: comportamento di sempre, si parte subito.
        const { meta } = await createSession();
        enterSession(meta.code);
        return;
      }
      setSessions(active);
      setPhase("picker");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile leggere le sessioni attive");
      setPhase("picker");
    }
  }, [enterSession]);

  useEffect(() => {
    let cancelled = false;
    facilitatorMe()
      .then((me) => {
        if (cancelled) return;
        if (!me.authenticated) {
          setPhase("login");
          return;
        }
        // Cookie ancora valido (12h): niente password, si va direttamente alle sessioni.
        setName(me.name);
        void loadSessions();
      })
      .catch(() => {
        if (!cancelled) setPhase("login");
      });

    return () => {
      cancelled = true;
    };
  }, [loadSessions]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !password) {
      setError("Inserisci nome e password.");
      return;
    }
    setLoading(true);
    try {
      await facilitatorLogin(name.trim(), password);
      await loadSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    setLoading(true);
    setError(null);
    try {
      const { meta } = await createSession();
      enterSession(meta.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore nella creazione della sessione");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(code: string) {
    setDeleting(code);
    setError(null);
    try {
      await deleteSession(code);
      setSessions((prev) => prev.filter((s) => s.code !== code));
      if (readFacilitatorCode() === code) {
        clearFacilitatorCode();
        setLastCode(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore nell'eliminazione della sessione");
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  }

  async function handleLogout() {
    await facilitatorLogout();
    setPhase("login");
    setPassword("");
    setSessions([]);
  }

  if (phase === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ifab-navy px-4 text-sm text-white/70">
        Verifica accesso...
      </div>
    );
  }

  if (phase === "picker") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ifab-navy px-4">
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white p-8 shadow-xl">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-semibold text-ifab-navy">Le tue sessioni</h1>
            <p className="mt-1 text-sm text-ifab-text-muted">
              {name ? `Sei autenticato come ${name}. ` : ""}Riprendi una sessione in corso o creane una nuova.
            </p>
          </div>

          {error && <p className="mb-4 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex flex-col gap-2">
            {sessions.map((s) => (
              <div
                key={s.code}
                className="flex items-center gap-2 rounded-xl border border-ifab-border px-4 py-3 transition hover:border-ifab-blue"
              >
                <button
                  type="button"
                  onClick={() => enterSession(s.code)}
                  className="flex flex-1 items-center justify-between gap-3 text-left"
                >
                  <span>
                    <span className="flex items-center gap-2 text-sm font-semibold text-ifab-navy">
                      <span className="font-mono tracking-widest">{s.code}</span>
                      {s.code === lastCode && (
                        <span className="rounded-full bg-ifab-blue/10 px-2 py-0.5 text-[10px] font-medium text-ifab-blue">
                          ultima usata
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-ifab-text-muted">
                      Creata il {formatTime(s.createdAt)} · ultima attività {formatTime(s.lastActivityAt)}
                    </span>
                  </span>
                  <span className="flex items-center gap-3 text-xs text-ifab-text-muted">
                    <span className="flex items-center gap-1">
                      <Users size={13} /> {s.participantCount}
                    </span>
                    <RotateCcw size={16} className="text-ifab-blue" />
                  </span>
                </button>

                {confirmDelete === s.code ? (
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleDelete(s.code)}
                      disabled={deleting === s.code}
                      className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                    >
                      {deleting === s.code ? "Elimino..." : "Elimina"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(null)}
                      className="rounded-lg px-2 py-1.5 text-xs text-ifab-text-muted transition hover:text-ifab-navy"
                    >
                      Annulla
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(s.code)}
                    title="Elimina sessione e tutti i suoi dati"
                    className="rounded-lg p-2 text-ifab-text-muted transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}

            {sessions.length === 0 && (
              <p className="rounded-xl border border-dashed border-ifab-border px-4 py-6 text-center text-sm text-ifab-text-muted">
                Nessuna sessione attiva.
              </p>
            )}
          </div>

          {sessions.length > 0 && (
            <p className="mt-3 text-xs text-ifab-text-muted">
              L&apos;eliminazione rimuove la sessione e tutti i dati dei suoi partecipanti: non è reversibile.
            </p>
          )}

          <button
            type="button"
            onClick={handleCreate}
            disabled={loading}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-ifab-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ifab-navy-deep disabled:opacity-60"
          >
            <Plus size={16} /> {loading ? "Attendere..." : "Crea nuova sessione"}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 flex w-full items-center justify-center gap-2 text-xs text-ifab-text-muted underline transition hover:text-ifab-navy"
          >
            <LogOut size={13} /> Esci
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ifab-navy px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ifab-navy/10">
            <ShieldCheck className="text-ifab-navy" size={22} />
          </div>
          <h1 className="text-xl font-semibold text-ifab-navy">Accesso Facilitatore</h1>
          <p className="mt-1 text-sm text-ifab-text-muted">Workshop AI Adoption — IFAB Foundation</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ifab-text-muted">Nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-ifab-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ifab-blue"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ifab-text-muted">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-ifab-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ifab-blue"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-ifab-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ifab-navy-deep disabled:opacity-60"
          >
            {loading ? "Accesso in corso..." : "Accedi"}
          </button>
        </form>
      </div>
    </div>
  );
}
