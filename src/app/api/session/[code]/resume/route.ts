import { NextResponse } from "next/server";
import { getSessionMeta, getSubmission, resumeParticipantById } from "@/lib/session";

/**
 * Rientro del partecipante con l'identità salvata nel browser: valida il
 * participantId contro la sessione e restituisce dati + posizione salvata.
 * Il campo `reason` dice al client se rimandare a /join (sessione scaduta o
 * partecipante non più registrato) invece di lasciare la pagina in caricamento.
 */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { participantId } = await req.json();

  if (!participantId || typeof participantId !== "string") {
    return NextResponse.json({ error: "participantId mancante", reason: "invalid-request" }, { status: 400 });
  }

  const meta = await getSessionMeta(code);
  if (!meta) {
    return NextResponse.json(
      { error: "Codice sessione non valido o scaduto", reason: "session-expired" },
      { status: 404 }
    );
  }

  const participant = await resumeParticipantById(code, participantId);
  if (!participant) {
    return NextResponse.json(
      { error: "Partecipante non più registrato in questa sessione", reason: "participant-not-found" },
      { status: 404 }
    );
  }

  const submission = await getSubmission(code, participant.participantId);
  return NextResponse.json({ participant, submission, meta });
}
