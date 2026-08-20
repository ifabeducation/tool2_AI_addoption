import { NextResponse } from "next/server";
import { getFacilitatorFromCookies } from "@/lib/auth";
import { arePriorityScores, evaluatePriority } from "@/lib/priorityScoring";
import {
  getParticipants,
  getSubmission,
  savePriorityEvaluation,
} from "@/lib/session";
import { PriorityDimension } from "@/lib/types";

const DIMENSIONS: PriorityDimension[] = ["impact", "effort", "risk", "reuse"];

function cleanRationale(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const cleaned: Partial<Record<PriorityDimension, string>> = {};
  for (const dimension of DIMENSIONS) {
    if (typeof raw[dimension] === "string" && raw[dimension].trim()) {
      cleaned[dimension] = raw[dimension].trim().slice(0, 1000);
    }
  }
  return Object.keys(cleaned).length ? cleaned : undefined;
}

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const facilitator = await getFacilitatorFromCookies();
  if (!facilitator) {
    return NextResponse.json({ error: "Non autenticato come facilitatore" }, { status: 401 });
  }

  const { code } = await params;
  const body = await req.json();
  if (typeof body.participantId !== "string" || !arePriorityScores(body.scores)) {
    return NextResponse.json(
      { error: "Servono participantId e quattro punteggi interi da 1 a 5" },
      { status: 400 }
    );
  }

  const participants = await getParticipants(code);
  if (!participants.some((p) => p.participantId === body.participantId)) {
    return NextResponse.json({ error: "Partecipante non trovato" }, { status: 404 });
  }

  const current = await getSubmission(code, body.participantId);
  if (!current.block2?.values || Object.keys(current.block2.values).length === 0) {
    return NextResponse.json(
      { error: "Il partecipante non ha ancora compilato il caso d'uso" },
      { status: 409 }
    );
  }

  const evaluation = {
    scores: body.scores,
    rationale: cleanRationale(body.rationale),
    boardNotes:
      typeof body.boardNotes === "string" && body.boardNotes.trim()
        ? body.boardNotes.trim().slice(0, 2000)
        : undefined,
    evaluatedBy: facilitator.name,
    evaluatedAt: Date.now(),
  };
  const submission = await savePriorityEvaluation(code, body.participantId, evaluation);
  return NextResponse.json({
    submission,
    result: evaluatePriority(evaluation.scores, submission.block2),
  });
}
