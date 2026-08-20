import { NextResponse } from "next/server";
import { getFacilitatorFromCookies } from "@/lib/auth";
import { getAllSubmissions, getParticipants } from "@/lib/session";

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const facilitator = await getFacilitatorFromCookies();
  if (!facilitator) {
    return NextResponse.json({ error: "Non autenticato come facilitatore" }, { status: 401 });
  }

  const { code } = await params;
  const [participants, submissions] = await Promise.all([getParticipants(code), getAllSubmissions(code)]);

  const byId = new Map(submissions.map((s) => [s.participantId, s]));
  const rows = participants.map((p) => ({
    participant: p,
    submission: byId.get(p.participantId) ?? { participantId: p.participantId },
  }));

  return NextResponse.json({ rows });
}
