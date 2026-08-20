import { NextResponse } from "next/server";
import { getFacilitatorFromCookies } from "@/lib/auth";
import { createSession } from "@/lib/session";

export async function POST() {
  const facilitator = await getFacilitatorFromCookies();
  if (!facilitator) {
    return NextResponse.json({ error: "Non autenticato come facilitatore" }, { status: 401 });
  }

  const meta = await createSession(facilitator.name);
  return NextResponse.json({ meta });
}
