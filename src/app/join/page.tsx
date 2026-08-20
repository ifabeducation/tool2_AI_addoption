"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, joinSession, resumeSession } from "@/lib/clientApi";
import {
  clearStoredIdentity,
  readFacilitatorCode,
  readStoredIdentity,
  saveStoredIdentity,
} from "@/lib/participantStorage";
import { TEST_PARTICIPANT_NAME } from "@/lib/testData";
import { RotateCcw, Users } from "lucide-react";
import TestFillButton from "@/components/TestFillButton";

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Motivo per cui si è stati rimandati qui da /session/[code] (identità non più valida).
  const expired = searchParams.get("expired") === "1";
  // Si arriva così dal pulsante "test" della home: il nome parte già compilato
  // (il codice sessione non si può inventare, vedi fillTestData).
  const testMode = searchParams.get("test") === "1";

  const [code, setCode] = useState(searchParams.get("code")?.toUpperCase() ?? "");
  const [name, setName] = useState(testMode ? TEST_PARTICIPANT_NAME : "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resumable, setResumable] = useState<{ code: string; participantId: string; name: string } | null>(null);

  /**
   * Dati di test: il nome è di esempio, il codice sessione no — quello esiste solo
   * se una sessione è stata aperta. Si riusa l'ultimo codice visto su questo
   * browser (come partecipante o come facilitatore), altrimenti resta da digitare.
   */
  function fillTestData() {
    setName(TEST_PARTICIPANT_NAME);
    setCode((prev) => prev || readStoredIdentity()?.code || readFacilitatorCode() || "");
  }

  useEffect(() => {
    const identity = readStoredIdentity();
    if (!identity) return;

    // Anche senza sessione riprendibile, riproporre codice e nome evita di
    // ridigitarli: il rientro per nome recupera comunque i dati già inseriti.
    const prefill = (withCode: boolean) => {
      if (withCode) setCode((prev) => prev || identity.code);
      setName((prev) => prev || identity.name);
    };

    let cancelled = false;
    resumeSession(identity.code, identity.participantId)
      .then(() => {
        if (cancelled) return;
        prefill(true);
        setResumable(identity);
      })
      .catch((err) => {
        if (cancelled) return;
        // Identità non più valida lato server: si riparte da codice + nome, ma
        // il nome resta precompilato (serve per ritrovare i propri dati).
        if (err instanceof ApiError && err.status === 404) {
          clearStoredIdentity();
          prefill(false);
          return;
        }
        prefill(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleResume() {
    if (!resumable) return;
    setLoading(true);
    try {
      await resumeSession(resumable.code, resumable.participantId);
      saveStoredIdentity(resumable);
      router.push(`/session/${resumable.code}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        clearStoredIdentity();
        setResumable(null);
      }
      setError(err instanceof Error ? err.message : "Sessione non più disponibile");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!code.trim() || !name.trim()) {
      setError("Inserisci sia il codice sessione che il tuo nome.");
      return;
    }
    setLoading(true);
    try {
      const normalizedCode = code.trim().toUpperCase();
      const { participant } = await joinSession(normalizedCode, name.trim());
      saveStoredIdentity({
        code: normalizedCode,
        participantId: participant.participantId,
        name: participant.name,
      });
      router.push(`/session/${normalizedCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ifab-bg px-4">
      <div className="w-full max-w-sm rounded-2xl border border-ifab-border bg-white p-8 shadow-sm">
        <div className="mb-2 flex justify-end">
          <TestFillButton
            onClick={fillTestData}
            title="Compila nome (e codice, se già visto su questo browser) con dati di esempio"
          />
        </div>

        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ifab-blue/10">
            <Users className="text-ifab-blue" size={22} />
          </div>
          <h1 className="text-xl font-semibold text-ifab-navy">Workshop AI Adoption</h1>
          <p className="mt-1 text-sm text-ifab-text-muted">
            Inserisci il codice sessione fornito dal facilitatore e il tuo nome per partecipare.
          </p>
        </div>

        {expired && !resumable && (
          <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            La sessione precedente non è più attiva. Rientra con il codice e lo stesso nome: se la sessione è
            ancora aperta ritroverai i dati già inseriti.
          </p>
        )}

        {resumable && (
          <div className="mb-5 rounded-xl border border-ifab-blue/30 bg-ifab-blue/5 p-4">
            <p className="text-sm font-semibold text-ifab-navy">Riprendi dove eri</p>
            <p className="mt-0.5 text-xs text-ifab-text-muted">
              {resumable.name} · sessione {resumable.code}
            </p>
            <button
              type="button"
              onClick={handleResume}
              disabled={loading}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-ifab-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-ifab-blue-dark disabled:opacity-60"
            >
              <RotateCcw size={15} /> Rientra nella sessione
            </button>
            <button
              type="button"
              onClick={() => {
                clearStoredIdentity();
                setResumable(null);
                setName("");
              }}
              className="mt-2 w-full text-center text-xs text-ifab-text-muted underline transition hover:text-ifab-navy"
            >
              Entra con un altro nome
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ifab-text-muted">Codice sessione</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Es. K7P2QX"
              className="w-full rounded-lg border border-ifab-border px-3 py-2 text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-ifab-blue"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ifab-text-muted">Il tuo nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome e cognome"
              className="w-full rounded-lg border border-ifab-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ifab-blue"
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-ifab-text-muted">
              Se rientri con lo stesso nome ritroverai i dati già inseriti.
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-ifab-blue px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ifab-blue-dark disabled:opacity-60"
          >
            {loading ? "Accesso in corso..." : "Entra nel workshop"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinForm />
    </Suspense>
  );
}
