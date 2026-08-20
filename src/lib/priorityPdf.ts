import { PRIORITY_DIMENSIONS } from "@/config/priorityFramework";
import { evaluatePriority } from "./priorityScoring";
import {
  Block2Submission,
  PriorityAdvice,
  PriorityDimension,
  PriorityEvaluation,
  PriorityReflection,
} from "./types";

const DIMENSIONS: PriorityDimension[] = ["impact", "effort", "risk", "reuse"];

export async function downloadPriorityPdf(input: {
  participantName: string;
  code: string;
  evaluation: PriorityEvaluation;
  block2?: Block2Submission;
  reflection?: PriorityReflection;
  advice?: PriorityAdvice;
  now: number;
}) {
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const result = evaluatePriority(input.evaluation.scores, input.block2);
  const left = 48;
  const width = pdf.internal.pageSize.getWidth() - left * 2;
  let y = 52;

  function write(text: string, size = 10, bold = false, gap = 8) {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(text, width) as string[];
    const requiredHeight = lines.length * (size + 3) + gap;
    if (y + requiredHeight > pdf.internal.pageSize.getHeight() - 48) {
      pdf.addPage();
      y = 52;
    }
    pdf.text(lines, left, y);
    y += requiredHeight;
  }

  write("Workshop AI Adoption — IFAB Foundation", 9);
  write("Blocco 3 — Valutazione e priorità", 18, true, 4);
  write(`${input.participantName} · sessione ${input.code} · ${new Date(input.now).toLocaleString("it-IT")}`, 9, false, 18);
  write(`Priority Score: ${result.score}/20 · Priorità ${result.levelLabel}`, 15, true, 4);
  write(`${result.quadrantLabel} — ${result.quadrantStrategy}`, 11, false, 16);

  for (const dimension of DIMENSIONS) {
    const score = input.evaluation.scores[dimension];
    const config = PRIORITY_DIMENSIONS[dimension];
    const criterion = config.criteria.find((item) => item.score === score);
    write(`${config.label}: ${score}/5 · ${criterion?.label ?? ""}`, 11, true, 2);
    write(`Criterio: ${criterion?.description || "—"}`, 9, false, 3);
    if (input.evaluation.rationale?.[dimension]) {
      write(`Motivazione del partecipante: ${input.evaluation.rationale[dimension]}`, 9, false, 10);
    }
  }

  if (result.riskVeto) write("VETO RISCHIO — Valutazione Legal/Compliance necessaria prima dell'approvazione.", 10, true, 8);
  if (result.ethicalReviewRequired) write("REVIEW ETICA — Il caso impatta persone specifiche e richiede una valutazione etica esplicita.", 10, true, 8);
  write(`Azione raccomandata: ${result.action}`, 10, true, 8);
  if (input.evaluation.boardNotes) write(`Note della valutazione: ${input.evaluation.boardNotes}`, 10, false, 8);
  if (input.reflection) {
    write("Considerazioni del partecipante", 12, true, 3);
    write(input.reflection.text, 10, false, 12);
  }
  if (input.advice && input.reflection) {
    write("Consigli IA successivi alla considerazione", 12, true, 3);
    write(input.advice.summary, 10, false, 8);
    if (input.advice.strengths.length) write(`Punti di forza: ${input.advice.strengths.join(" · ")}`, 9, false, 6);
    if (input.advice.cautions.length) write(`Attenzioni: ${input.advice.cautions.join(" · ")}`, 9, false, 6);
    if (input.advice.nextSteps.length) write(`Prossimi passi: ${input.advice.nextSteps.join(" · ")}`, 9, false, 8);
  }
  write(`Autovalutazione di ${input.evaluation.evaluatedBy}`, 8, false, 0);

  const slug = input.participantName.trim().replace(/\s+/g, "_").replace(/[^\w-]/g, "") || "partecipante";
  pdf.save(`valutazione-priorita-${slug}.pdf`);
}
