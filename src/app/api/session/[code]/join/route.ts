import { NextResponse } from "next/server";
import { getSessionMeta, getSubmission, joinOrResumeParticipant } from "@/lib/session";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { name } = await req.json();

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Nome mancante" }, { status: 400 });
  }

  const meta = await getSessionMeta(code);
  if (!meta) {
    return NextResponse.json({ error: "Codice sessione non valido o scaduto" }, { status: 404 });
  }

  const { participant, isNew } = await joinOrResumeParticipant(code, name);
  const submission = await getSubmission(code, participant.participantId);

  return NextResponse.json({ participant, isNew, submission, meta });
}
