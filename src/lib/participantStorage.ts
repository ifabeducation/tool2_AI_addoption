// Identità del partecipante salvata nel browser: è ciò che permette di
// riaprire l'app (o tornarci il giorno dopo, finché la sessione è viva) e
// rientrare nella propria sessione senza ridigitare codice e nome.
// Chiave storica invariata per non invalidare i browser già usati.

export const PARTICIPANT_STORAGE_KEY = "ifab_ws_participant";
export const FACILITATOR_CODE_STORAGE_KEY = "ifab_ws_facilitator_code";

export type StoredIdentity = {
  code: string;
  participantId: string;
  name: string;
};

export function readStoredIdentity(): StoredIdentity | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PARTICIPANT_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredIdentity>;
    if (!parsed?.code || !parsed?.participantId || !parsed?.name) return null;
    return { code: parsed.code, participantId: parsed.participantId, name: parsed.name };
  } catch {
    // Dato corrotto (es. formato di una versione precedente): meglio ripartire pulito.
    window.localStorage.removeItem(PARTICIPANT_STORAGE_KEY);
    return null;
  }
}

export function saveStoredIdentity(identity: StoredIdentity): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PARTICIPANT_STORAGE_KEY, JSON.stringify(identity));
}

export function clearStoredIdentity(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PARTICIPANT_STORAGE_KEY);
}

export function readFacilitatorCode(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(FACILITATOR_CODE_STORAGE_KEY);
}

export function saveFacilitatorCode(code: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FACILITATOR_CODE_STORAGE_KEY, code);
}

export function clearFacilitatorCode(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(FACILITATOR_CODE_STORAGE_KEY);
}
