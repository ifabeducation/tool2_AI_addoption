import Link from "next/link";
import { Users, ShieldCheck } from "lucide-react";
import ResumeCard from "@/components/ResumeCard";
import TestFillButton from "@/components/TestFillButton";

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-1 items-center justify-center bg-ifab-bg px-4">
      {/* La home non ha campi: il "test" apre l'ingresso già compilato. */}
      <div className="absolute left-4 top-4 sm:left-6 sm:top-6">
        <TestFillButton href="/join?test=1" title="Apri l'ingresso con codice e nome di esempio" />
      </div>

      {/* Accesso facilitatore: presente ma defilato, la home è dei partecipanti. */}
      <Link
        href="/facilitator/login"
        className="absolute right-4 top-4 flex items-center gap-1.5 rounded-lg border border-ifab-border bg-white px-3 py-1.5 text-xs font-medium text-ifab-navy shadow-sm transition hover:border-ifab-navy sm:right-6 sm:top-6"
      >
        <ShieldCheck size={14} />
        Sono il facilitatore
      </Link>

      <div className="w-full max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-ifab-blue">IFAB Foundation</p>
        <h1 className="mt-2 text-3xl font-bold text-ifab-navy">Workshop AI Adoption</h1>
        <p className="mt-3 text-sm text-ifab-text-muted">
          Blocco 3 — importa il tuo Use Case e passa direttamente alla valutazione e priorità dell&apos;AI Board.
        </p>

        <ResumeCard />

        <div className="mt-10 flex justify-center">
          <Link
            href="/join"
            className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border border-ifab-border bg-white p-8 shadow-sm transition hover:border-ifab-blue hover:shadow-md"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ifab-blue/10">
              <Users className="text-ifab-blue" size={22} />
            </div>
            <span className="text-base font-semibold text-ifab-navy">Sono un partecipante</span>
            <span className="text-xs text-ifab-text-muted">Entra con codice, nome e PDF Use Case precedente</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
