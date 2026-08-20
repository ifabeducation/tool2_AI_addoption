import { ParticipantProgress, Submission } from "./types";

/**
 * Errore con lo status HTTP: serve a distinguere "sessione/partecipante non
 * esistono più" (404 → torna al form di ingresso) da un problema di rete
 * temporaneo (→ si riprova, senza buttare fuori nessuno).
 */
export class ApiError extends Error {
  status: number;
  reason?: string;

  constructor(message: string, status: number, reason?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.reason = reason;
  }
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error ?? `Errore ${res.status}`, res.status, data.reason);
  }
  return data as T;
}

export function facilitatorLogin(name: string, password: string) {
  return jsonFetch<{ ok: true; name: string }>("/api/facilitator/login", {
    method: "POST",
    body: JSON.stringify({ name, password }),
  });
}

export function facilitatorMe() {
  return jsonFetch<{ authenticated: boolean; name: string }>("/api/facilitator/me");
}

export function facilitatorLogout() {
  return jsonFetch<{ ok: true }>("/api/facilitator/logout", { method: "POST" });
}

export function createSession() {
  return jsonFetch<{ meta: import("./types").SessionMeta }>("/api/session/create", { method: "POST" });
}

export function joinSession(code: string, name: string) {
  return jsonFetch<{
    participant: import("./types").Participant;
    isNew: boolean;
    submission: Submission;
    meta: import("./types").SessionMeta;
  }>(`/api/session/${code}/join`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function importUseCasePdf(code: string, participantId: string, file: File) {
  const formData = new FormData();
  formData.set("participantId", participantId);
  formData.set("file", file);
  const res = await fetch(`/api/session/${code}/import-pdf`, {
    method: "POST",
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error ?? `Errore ${res.status}`, res.status, data.reason);
  }
  return data as {
    submission: Submission;
    meta: import("./types").SessionMeta;
    extractedFieldCount: number;
  };
}

/** Rientro con l'identità già salvata nel browser: nessun codice/nome da riscrivere. */
export function resumeSession(code: string, participantId: string) {
  return jsonFetch<{
    participant: import("./types").Participant;
    submission: Submission;
    meta: import("./types").SessionMeta;
  }>(`/api/session/${code}/resume`, {
    method: "POST",
    body: JSON.stringify({ participantId }),
  });
}

export function deleteSession(code: string) {
  return jsonFetch<{ ok: true; code: string }>(`/api/session/${code}`, { method: "DELETE" });
}

export function listSessions() {
  return jsonFetch<{ sessions: import("./types").SessionSummary[] }>("/api/session/list");
}

export function fetchState(code: string, participantId?: string) {
  const qs = participantId ? `?participantId=${encodeURIComponent(participantId)}` : "";
  return jsonFetch<{
    meta: import("./types").SessionMeta;
    participants: { name: string; joinedAt: number; lastSeenAt: number }[];
    participantValid: boolean;
    ownSubmission: Submission | null;
  }>(`/api/session/${code}/state${qs}`);
}

export function unlockStep(code: string, step: string, value: boolean) {
  return jsonFetch<{ meta: import("./types").SessionMeta }>(`/api/session/${code}/unlock`, {
    method: "POST",
    body: JSON.stringify({ step, value }),
  });
}

export function submitStep1(code: string, participantId: string, data: import("./types").Step1Submission) {
  return jsonFetch<{ submission: Submission }>(`/api/session/${code}/submit`, {
    method: "POST",
    body: JSON.stringify({ participantId, part: "step1", data }),
  });
}

export function submitStep2(code: string, participantId: string, data: import("./types").Step2Submission) {
  return jsonFetch<{ submission: Submission }>(`/api/session/${code}/submit`, {
    method: "POST",
    body: JSON.stringify({ participantId, part: "step2", data }),
  });
}

export function submitBlock2(
  code: string,
  participantId: string,
  data: import("./types").Block2Submission
) {
  return jsonFetch<{ submission: Submission }>(`/api/session/${code}/submit`, {
    method: "POST",
    body: JSON.stringify({ participantId, part: "block2", data }),
  });
}

export function saveProgress(code: string, participantId: string, progress: ParticipantProgress) {
  return jsonFetch<{ submission: Submission }>(`/api/session/${code}/submit`, {
    method: "POST",
    body: JSON.stringify({ participantId, part: "progress", data: progress }),
  });
}

export function fetchAggregate(code: string) {
  return jsonFetch<{
    rows: { participant: import("./types").Participant; submission: Submission }[];
  }>(`/api/session/${code}/aggregate`);
}

export function savePriorityEvaluation(
  code: string,
  participantId: string,
  data: {
    scores: import("./types").PriorityScores;
    rationale?: import("./types").PriorityEvaluation["rationale"];
    boardNotes?: string;
  }
) {
  return jsonFetch<{
    submission: Submission;
    result: import("./priorityScoring").PriorityResult;
  }>(`/api/session/${code}/priority`, {
    method: "POST",
    body: JSON.stringify({ participantId, ...data }),
  });
}
