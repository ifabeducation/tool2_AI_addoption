import { NextResponse } from "next/server";
import { getFacilitatorFromCookies } from "@/lib/auth";
import { setUnlockedStep } from "@/lib/session";
import { DEFAULT_UNLOCKED_STEPS, UnlockedSteps } from "@/lib/types";

// Derivato dal modello: aggiungendo uno step (es. il Blocco 2) non serve
// ricordarsi di aggiornare anche questa lista.
const VALID_STEPS = Object.keys(DEFAULT_UNLOCKED_STEPS) as (keyof UnlockedSteps)[];

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const facilitator = await getFacilitatorFromCookies();
  if (!facilitator) {
    return NextResponse.json({ error: "Non autenticato come facilitatore" }, { status: 401 });
  }

  const { code } = await params;
  const { step, value } = await req.json();

  if (!VALID_STEPS.includes(step)) {
    return NextResponse.json({ error: "Step non valido" }, { status: 400 });
  }

  const meta = await setUnlockedStep(code, step, value !== false);
  if (!meta) {
    return NextResponse.json({ error: "Sessione non trovata" }, { status: 404 });
  }

  return NextResponse.json({ meta });
}
