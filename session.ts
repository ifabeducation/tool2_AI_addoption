import { customAlphabet, nanoid } from "nanoid";
import { getRedis, SESSION_TTL_SECONDS } from "./kv";
import {
  Block2Submission,
  DEFAULT_UNLOCKED_STEPS,
  Participant,
  ParticipantProgress,
  PriorityEvaluation,
  SessionMeta,
  SessionSummary,
  Step1Submission,
  Step2Submission,
  Submission,
  UnlockedSteps,
} from "./types";

// Alfabeto senza caratteri ambigui (niente 0/O, 1/I/L) per i codici sessione
// che il facilitatore detta a voce o scrive su una slide.
const generateCode = customAlphabet("ABCDEFGHJKMNPQRSTUVWXYZ23456789", 6);

function keyMeta(code: string) {
  return `session:${code}:meta`;
}
function keyParticipants(code: string) {
  return `session:${code}:participants`;
}
function keySubmission(code: string, participantId: string) {
  return `session:${code}:submissions:${participantId}`;
}
// Indice dei codici sessione creati: serve al facilitatore che rientra da un
// browser diverso (o dopo aver svuotato il localStorage) per ritrovare e
// riprendere la sessione già in corso invece di crearne una nuova.
function keySessionIndex() {
  return `sessions:index`;
}

// Quante sessioni tenere nell'indice: un facilitatore ne apre poche per evento,
// il tetto serve solo a evitare che la chiave cresca senza limite.
const SESSION_INDEX_MAX = 50;

async function addToSessionIndex(code: string): Promise<void> {
  const redis = getRedis();
  const codes = (await redis.get<string[]>(keySessionIndex())) ?? [];
  const next = [code, ...codes.filter((c) => c !== code)].slice(0, SESSION_INDEX_MAX);
  await redis.set(keySessionIndex(), next, { ex: SESSION_TTL_SECONDS });
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function createSession(facilitatorName: string): Promise<SessionMeta> {
  const redis = getRedis();
  let code = generateCode();
  // Evita (improbabili) collisioni con sessioni ancora attive
  for (let i = 0; i < 5 && (await redis.get(keyMeta(code))); i++) {
    code = generateCode();
  }

  const meta: SessionMeta = {
    code,
    facilitatorName,
    createdAt: Date.now(),
    unlockedSteps: { ...DEFAULT_UNLOCKED_STEPS },
  };

  await redis.set(keyMeta(code), meta, { ex: SESSION_TTL_SECONDS });
  await redis.set(keyParticipants(code), [], { ex: SESSION_TTL_SECONDS });
  await addToSessionIndex(code);
  return meta;
}

/**
 * Sessioni ancora vive (meta non scaduta), più recenti prima. Ripulisce
 * l'indice dai codici la cui meta è nel frattempo scaduta.
 */
export async function listActiveSessions(): Promise<SessionSummary[]> {
  const redis = getRedis();
  const codes = (await redis.get<string[]>(keySessionIndex())) ?? [];
  if (codes.length === 0) return [];

  const summaries: SessionSummary[] = [];
  const stillAlive: string[] = [];

  for (const code of codes) {
    const meta = await getSessionMeta(code);
    if (!meta) continue;
    stillAlive.push(code);
    const participants = await getParticipants(code);
    const lastActivityAt = participants.reduce((max, p) => Math.max(max, p.lastSeenAt), meta.createdAt);
    summaries.push({
      code: meta.code,
      facilitatorName: meta.facilitatorName,
      createdAt: meta.createdAt,
      participantCount: participants.length,
      lastActivityAt,
    });
  }

  if (stillAlive.length !== codes.length) {
    await redis.set(keySessionIndex(), stillAlive, { ex: SESSION_TTL_SECONDS });
  }

  return summaries.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
}

/**
 * Cancella una sessione e tutto ciò che le appartiene (partecipanti e
 * submission), oltre alla voce nell'indice. Serve al facilitatore per
 * ripulire le sessioni di prova e chiudere quelle concluse: i dati non
 * sopravvivono comunque al TTL, questa è solo la rimozione immediata.
 */
export async function deleteSession(code: string): Promise<boolean> {
  const redis = getRedis();
  const meta = await getSessionMeta(code);
  const participants = await getParticipants(code);

  const keys = [
    keyMeta(code),
    keyParticipants(code),
    ...participants.map((p) => keySubmission(code, p.participantId)),
  ];
  await Promise.all(keys.map((k) => redis.del(k)));

  const codes = (await redis.get<string[]>(keySessionIndex())) ?? [];
  if (codes.includes(code)) {
    await redis.set(
      keySessionIndex(),
      codes.filter((c) => c !== code),
      { ex: SESSION_TTL_SECONDS }
    );
  }

  return Boolean(meta);
}

export async function getSessionMeta(code: string): Promise<SessionMeta | null> {
  const redis = getRedis();
  const meta = await redis.get<SessionMeta>(keyMeta(code));
  if (!meta) return null;
  // Le sessioni create prima dell'aggiunta di uno step non hanno la nuova
  // chiave in Redis: il merge le rende compatibili e mantiene lo step bloccato.
  return {
    ...meta,
    unlockedSteps: { ...DEFAULT_UNLOCKED_STEPS, ...meta.unlockedSteps },
  };
}

export async function setUnlockedStep(
  code: string,
  step: keyof UnlockedSteps,
  value: boolean
): Promise<SessionMeta | null> {
  const redis = getRedis();
  const meta = await getSessionMeta(code);
  if (!meta) return null;
  meta.unlockedSteps[step] = value;
  await redis.set(keyMeta(code), meta, { ex: SESSION_TTL_SECONDS });
  return meta;
}

export async function getParticipants(code: string): Promise<Participant[]> {
  const redis = getRedis();
  const list = await redis.get<Participant[]>(keyParticipants(code));
  return list ?? [];
}

/**
 * Registra un partecipante alla sessione oppure, se un partecipante con lo
 * stesso nome (normalizzato) esiste già in questa sessione, ne ripristina
 * l'identità esistente: questo è il meccanismo di recupero dati al rientro
 * (stessa sessione + stesso nome = stesso participantId = stesse submission).
 */
export async function joinOrResumeParticipant(
  code: string,
  displayName: string
): Promise<{ participant: Participant; isNew: boolean }> {
  const redis = getRedis();
  const normalized = normalizeName(displayName);
  const participants = await getParticipants(code);

  const existing = participants.find((p) => p.normalizedName === normalized);
  const now = Date.now();

  if (existing) {
    existing.lastSeenAt = now;
    await redis.set(keyParticipants(code), participants, { ex: SESSION_TTL_SECONDS });
    return { participant: existing, isNew: false };
  }

  const participant: Participant = {
    participantId: nanoid(10),
    name: displayName.trim(),
    normalizedName: normalized,
    joinedAt: now,
    lastSeenAt: now,
  };
  participants.push(participant);
  await redis.set(keyParticipants(code), participants, { ex: SESSION_TTL_SECONDS });
  return { participant, isNew: true };
}

/**
 * Ripristina l'identità a partire dal solo participantId salvato nel browser:
 * è la via di rientro "senza riscrivere nulla" (stesso dispositivo, sessione
 * ancora attiva). Ritorna null se la sessione è scaduta o se quel partecipante
 * non risulta più registrato: in quel caso il client torna al form di /join.
 */
export async function resumeParticipantById(
  code: string,
  participantId: string
): Promise<Participant | null> {
  const redis = getRedis();
  const participants = await getParticipants(code);
  const participant = participants.find((p) => p.participantId === participantId);
  if (!participant) return null;

  participant.lastSeenAt = Date.now();
  await redis.set(keyParticipants(code), participants, { ex: SESSION_TTL_SECONDS });
  return participant;
}

export async function touchParticipant(code: string, participantId: string): Promise<void> {
  const redis = getRedis();
  const participants = await getParticipants(code);
  const p = participants.find((x) => x.participantId === participantId);
  if (!p) return;
  p.lastSeenAt = Date.now();
  await redis.set(keyParticipants(code), participants, { ex: SESSION_TTL_SECONDS });
}

export async function getSubmission(code: string, participantId: string): Promise<Submission> {
  const redis = getRedis();
  const sub = await redis.get<Submission>(keySubmission(code, participantId));
  return sub ?? { participantId };
}

export async function getAllSubmissions(code: string): Promise<Submission[]> {
  const participants = await getParticipants(code);
  const redis = getRedis();
  if (participants.length === 0) return [];
  const keys = participants.map((p) => keySubmission(code, p.participantId));
  const results = await Promise.all(keys.map((k) => redis.get<Submission>(k)));
  return results.map((sub, i) => sub ?? { participantId: participants[i].participantId });
}

/** Step 1 — scheda di attrito: le risposte si fondono per id di domanda. */
export async function saveStep1(
  code: string,
  participantId: string,
  data: Step1Submission
): Promise<Submission> {
  const redis = getRedis();
  const current = await getSubmission(code, participantId);
  current.step1 = { ...current.step1, ...data, risposte: { ...current.step1?.risposte, ...data.risposte } };
  await redis.set(keySubmission(code, participantId), current, { ex: SESSION_TTL_SECONDS });
  return current;
}

/**
 * Step 2 — valori delle caratteristiche. Si fondono per candidata, così un
 * salvataggio parziale non azzera le risposte già date.
 */
export async function saveStep2(
  code: string,
  participantId: string,
  data: Step2Submission
): Promise<Submission> {
  const redis = getRedis();
  const current = await getSubmission(code, participantId);
  current.step2 = {
    ...current.step2,
    ...data,
    valori: { ...current.step2?.valori, ...data.valori },
  };
  await redis.set(keySubmission(code, participantId), current, { ex: SESSION_TTL_SECONDS });
  return current;
}


/**
 * Blocco 2 — Use Case Submission. I valori dei campi si fondono per id, così un
 * salvataggio parziale (autosalvataggio della bozza) non azzera il resto.
 */
export async function saveBlock2(
  code: string,
  participantId: string,
  data: Block2Submission
): Promise<Submission> {
  const redis = getRedis();
  const current = await getSubmission(code, participantId);
  current.block2 = {
    ...current.block2,
    ...data,
    values: { ...current.block2?.values, ...data.values },
  };
  await redis.set(keySubmission(code, participantId), current, { ex: SESSION_TTL_SECONDS });
  return current;
}

/** Blocco 3 — scrittura riservata alla route autenticata del facilitatore. */
export async function savePriorityEvaluation(
  code: string,
  participantId: string,
  data: PriorityEvaluation
): Promise<Submission> {
  const redis = getRedis();
  const current = await getSubmission(code, participantId);
  current.priority = data;
  await redis.set(keySubmission(code, participantId), current, { ex: SESSION_TTL_SECONDS });
  return current;
}

/** Memorizza lo step su cui il partecipante stava lavorando (vedi ParticipantProgress). */
export async function saveProgress(
  code: string,
  participantId: string,
  progress: ParticipantProgress
): Promise<Submission> {
  const redis = getRedis();
  const current = await getSubmission(code, participantId);
  current.progress = progress;
  await redis.set(keySubmission(code, participantId), current, { ex: SESSION_TTL_SECONDS });
  return current;
}
