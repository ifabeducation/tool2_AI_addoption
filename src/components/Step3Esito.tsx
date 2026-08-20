"use client";

import { useRef } from "react";
import { AlertTriangle, FileDown } from "lucide-react";
import { Step1Submission, Step2Submission } from "@/lib/types";
import { calcolaEsiti, etichettaCaratteristica } from "@/lib/frizioneScoring";
import MatriceImpattoProntezza from "./MatriceImpattoProntezza";

/** Un decimale solo quando serve: la barra ora è a scala decimale. */
function arrotonda(v: number): string {
  return v % 1 === 0 ? String(v) : v.toFixed(1);
}

/**
 * Step 3 — esito. Tutto è calcolato da step1 + step2 (nessun dato proprio):
 * matrice Impatto × Prontezza e una scheda per candidata, in ordine di
 * punteggio. È il primo punto del percorso in cui compaiono numeri.
 */
export default function Step3Esito({
  participantName,
  step1,
  step2,
}: {
  participantName: string;
  step1?: Step1Submission;
  step2?: Step2Submission;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const esiti = calcolaEsiti(step1, step2);
  const criteriTaciti = Boolean(step1?.criteriTaciti);

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
    pdf.text(`Workshop AI Adoption — ${participantName}`, 24, 28);
    pdf.addImage(imgData, "PNG", 24, 40, imgWidth, imgHeight);
    pdf.save(`workshop-ai-adoption-${participantName.replace(/\s+/g, "_")}.pdf`);
  }

  if (esiti.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ifab-border bg-white p-8 text-center text-sm text-ifab-text-muted">
        L&apos;esito compare quando hai concluso lo Step 2 rispondendo per tutte le attività candidate.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="mb-1 text-lg font-semibold text-ifab-navy">Step 3 · Esito</h2>
          <p className="text-sm text-ifab-text-muted">
            Le tue candidate posizionate per impatto e prontezza, in ordine di punteggio.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportPdf}
          className="flex items-center gap-2 rounded-lg border border-ifab-navy px-4 py-2 text-sm font-semibold text-ifab-navy transition hover:bg-ifab-navy hover:text-white"
        >
          <FileDown size={16} /> Esporta PDF
        </button>
      </div>

      <div ref={printRef} className="flex flex-col gap-4">
        <section className="rounded-xl border border-ifab-border bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-ifab-navy">Matrice Impatto × Prontezza</h3>
          <MatriceImpattoProntezza esiti={esiti} />
        </section>

        {criteriTaciti && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{esiti[0].notaCriteriTaciti}</span>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {esiti.map((e, i) => (
            <section key={e.domandaId} className="rounded-xl border border-ifab-border bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: e.colore }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-ifab-navy">{e.nome}</h3>
                    <p className="mt-0.5 text-xs text-ifab-text-muted">{etichettaCaratteristica(e.blocco)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-ifab-navy">{Math.round(e.punteggio)}</p>
                  <p className="text-[11px] text-ifab-text-muted">
                    impatto {arrotonda(e.impatto)} × prontezza {arrotonda(e.prontezza)}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-sm text-ifab-text-muted">{e.motivazione}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
