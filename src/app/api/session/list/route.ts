import { NextResponse } from "next/server";
import { getFacilitatorFromCookies } from "@/lib/auth";
import { listActiveSessions } from "@/lib/session";

/**
 * Sessioni ancora attive: permette al facilitatore che rientra (nuovo browser,
 * localStorage svuotato, PC diverso) di riprendere quella in corso invece di
 * crearne una nuova con un codice che i partecipanti non hanno.
 */
export async function GET() {
  const facilitator = await getFacilitatorFromCookies();
  if (!facilitator) {
    return NextResponse.json({ error: "Non autenticato come facilitatore" }, { status: 401 });
  }

  const sessions = await listActiveSessions();
  return NextResponse.json({ sessions });
}
