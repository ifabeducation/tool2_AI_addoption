// Esportazione PDF della scheda Use Case, condivisa fra partecipante (piede
// della scheda) e facilitatore (dashboard). Il PDF si compone con le primitive
// testuali di jsPDF invece di fotografare il DOM: la scheda è lunga, va su più
// pagine e il testo deve restare selezionabile e cercabile. Per lo stesso
// motivo non serve che la pagina sia visibile: il facilitatore la scarica
// partendo dai soli valori salvati.

import {
  BLOCK2_SECTIONS,
  block2ValueLabel,
  isBlock2ValueFilled,
} from "@/config/block2Form";
import { Block2FieldValue } from "./types";

const MARGIN = 48;
const LINE = 14;

export type UseCasePdfInput = {
  participantName: string;
  code: string;
  values: Record<string, Block2FieldValue>;
  /** Momento dell'esportazione, in millisecondi. */
  now: number;
};

function fileName(participantName: string): string {
  const slug = participantName.trim().replace(/\s+/g, "_").replace(/[^\w-]/g, "") || "partecipante";
  return `use-case-${slug}.pdf`;
}

export async function downloadUseCasePdf({
  participantName,
  code,
  values,
  now,
}: UseCasePdfInput): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  let y = MARGIN;

  /** Salta pagina quando lo spazio residuo non basta per il blocco successivo. */
  function ensureSpace(needed: number) {
    if (y + needed <= pageHeight - MARGIN) return;
    pdf.addPage();
    y = MARGIN;
  }

  function write(text: string, options: { size: number; style: "normal" | "bold"; gap?: number }) {
    pdf.setFont("helvetica", options.style);
    pdf.setFontSize(options.size);
    const lines = pdf.splitTextToSize(text, contentWidth) as string[];
    const lineHeight = options.size + 3;
    for (const line of lines) {
      ensureSpace(lineHeight);
      pdf.text(line, MARGIN, y);
      y += lineHeight;
    }
    y += options.gap ?? 0;
  }

  write("Workshop AI Adoption — IFAB Foundation", { size: 9, style: "normal" });
  write("Use Case Submission", { size: 18, style: "bold", gap: 2 });
  write(
    `${participantName} · sessione ${code} · ${new Date(now).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`,
    { size: 9, style: "normal", gap: 10 }
  );

  for (const section of BLOCK2_SECTIONS) {
    // Il titolo di sezione non deve restare orfano in fondo alla pagina.
    ensureSpace(LINE * 3);
    pdf.setDrawColor(200);
    pdf.line(MARGIN, y - 6, pageWidth - MARGIN, y - 6);
    write(`${section.number} ${section.title}`, { size: 12, style: "bold", gap: 2 });

    for (const field of section.fields) {
      const value = values[field.id];
      write(field.label, { size: 8.5, style: "bold" });
      write(isBlock2ValueFilled(value) ? block2ValueLabel(field, value) : "— non compilato", {
        size: 10,
        style: "normal",
        gap: 6,
      });
    }

    y += 6;
  }

  pdf.save(fileName(participantName));
}
