import { NextResponse } from "next/server";
import { getParticipants, getSessionMeta, getSubmission, touchParticipant } from "@/lib/session";

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const url = new URL(req.url);
  const participantId = url.searchParams.get("participantId");

  const meta = await getSessionMeta(code);
  if (!meta) {
    return NextResponse.json({ error: "Codice sessione non valido o scaduto" }, { status: 404 });
  }

  const participants = await getParticipants(code);

  let ownSubmission = null;
  // participantValid distingue "non ho chiesto una submission" da "l'identità
  // salvata nel browser non vale più": nel secondo caso il client rimanda a /join.
  const participantValid = Boolean(
    participantId && participants.some((p) => p.participantId === participantId)
  );
  if (participantId && participantValid) {
    await touchParticipant(code, participantId);
    ownSubmission = await getSubmission(code, participantId);
  }

  return NextResponse.json({
    meta,
    participantValid,
    participants: participants.map((p) => ({
      name: p.name,
      joinedAt: p.joinedAt,
      lastSeenAt: p.lastSeenAt,
    })),
    ownSubmission,
  });
}
