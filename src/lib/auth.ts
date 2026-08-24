import crypto from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "ifab_facilitator_auth";
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12h: copre una giornata di workshop

type FacilitatorToken = {
  name: string;
  iat: number;
};

function getSecret(): string {
  // Riusa la password del facilitatore come base del secret di firma: per un
  // singolo evento con un'unica password condivisa non serve un segreto separato.
  // Stesso default di @/app/api/facilitator/login/route.ts: se non è configurata
  // nessuna variabile d'ambiente, la password dell'evento è "IFAB123!".
  return process.env.SESSION_SECRET || process.env.FACILITATOR_PASSWORD || "IFAB123!";
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createFacilitatorToken(name: string): string {
  const token: FacilitatorToken = { name, iat: Date.now() };
  const payload = Buffer.from(JSON.stringify(token)).toString("base64url");
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function verifyFacilitatorToken(cookieValue: string | undefined): FacilitatorToken | null {
  if (!cookieValue) return null;
  const [payload, signature] = cookieValue.split(".");
  if (!payload || !signature) return null;
  if (sign(payload) !== signature) return null;

  try {
    const token: FacilitatorToken = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (Date.now() - token.iat > MAX_AGE_SECONDS * 1000) return null;
    return token;
  } catch {
    return null;
  }
}

export const FACILITATOR_COOKIE_NAME = COOKIE_NAME;
export const FACILITATOR_COOKIE_MAX_AGE = MAX_AGE_SECONDS;

/**
 * Helper per le Route Handler: legge e verifica il cookie del facilitatore
 * dalla richiesta corrente. Ritorna null se assente/non valido/scaduto.
 *
 * Nota di semplificazione: la password è unica e condivisa per l'evento, quindi
 * un cookie valido autorizza ad agire su QUALSIASI codice sessione (non c'è un
 * legame stretto facilitatore↔sessione). Coerente con l'uso reale: un solo
 * facilitatore per workshop, niente gestione utenti multipla in questa fase.
 */
export async function getFacilitatorFromCookies(): Promise<FacilitatorToken | null> {
  const store = await cookies();
  return verifyFacilitatorToken(store.get(FACILITATOR_COOKIE_NAME)?.value);
}
