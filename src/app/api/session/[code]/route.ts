import { NextResponse } from "next/server";
import { getFacilitatorFromCookies } from "@/lib/auth";
import { deleteSession } from "@/lib/session";

/**
 * Eliminazione di una sessione: solo il facilitatore autenticato. Rimuove
 * meta, partecipanti e submission — i partecipanti ancora collegati vengono
 * riportati al form di ingresso dal normale polling di stato.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const facilitator = await getFacilitatorFromCookies();
  if (!facilitator) {
    return NextResponse.json({ error: "Non autenticato come facilitatore" }, { status: 401 });
  }

  const { code } = await params;
  const existed = await deleteSession(code);
  if (!existed) {
    return NextResponse.json(
      { error: "Codice sessione non valido o scaduto", reason: "session-expired" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, code });
}
