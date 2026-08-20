import { NextResponse } from "next/server";
import { generatePriorityAdvice } from "@/lib/priorityAdvice";
import {
  getParticipants,
  getSubmission,
  savePriorityAdvice,
  savePriorityReflection,
} from "@/lib/session";

export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = await req.json().catch(() => ({}));
  const participantId = typeof body.participantId === "string" ? body.participantId : "";
  const reflection = typeof body.reflection === "string" ? body.reflection.trim() : "";

  if (!participantId || reflection.length < 10 || reflection.length > 3000) {
    return NextResponse.json(
      { error: "Inserisci una considerazione di almeno 10 e massimo 3000 caratteri" },
      { status: 400 }
    );
  }

  const participants = await getParticipants(code);
  if (!participants.some((participant) => participant.participantId === participantId)) {
    return NextResponse.json({ error: "Partecipante non registrato in questa sessione" }, { status: 403 });
  }

  const current = await getSubmission(code, participantId);
  if (!current.priority || !current.block2?.values) {
    return NextResponse.json(
      { error: "Completa prima la tua valutazione" },
      { status: 409 }
    );
  }

  let submission = await savePriorityReflection(code, participantId, {
    text: reflection,
    submittedAt: Date.now(),
  });

  try {
    const advice = await generatePriorityAdvice({
      block2: current.block2,
      evaluation: current.priority,
      reflection,
    });
    submission = await savePriorityAdvice(code, participantId, advice);
    return NextResponse.json({ submission, adviceGenerated: true });
  } catch (error) {
    console.error("[priority-reflection] generazione consigli non riuscita", {
      code,
      participantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({
      submission,
      adviceGenerated: false,
      warning: "La considerazione è stata salvata, ma i consigli IA non sono ancora disponibili. Riprova tra poco.",
    });
  }
}
