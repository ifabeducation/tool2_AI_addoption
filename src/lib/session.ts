import { customAlphabet, nanoid } from "nanoid";
import { getRedis, SESSION_TTL_SECONDS } from "./kv";
import {
  Block2Submission,
  DEFAULT_UNLOCKED_STEPS,
  Participant,
  ParticipantProgress,
  PriorityAdvice,
  PriorityEvaluation,
  PriorityReflection,
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

/**
 * Un partecipante per campo dell'hash (chiave = participantId), non un unico
 * array JSON: aggiungere un nuovo partecipante è un HSET su un campo proprio,
 * atomico e indipendente dagli altri. Con l'array unico, più "join" arrivati
 * insieme (il caso normale a inizio workshop, quando tutti si iscrivono nello
 * stesso momento dallo stesso codice) leggevano la stessa lista, la
 * modificavano ciascuno per conto proprio e riscrivevano l'intero array:
 * l'ultima scrittura vinceva e cancellava in silenzio i partecipanti aggiunti
 * nel frattempo dalle altre richieste. Il rischio residuo (due persone che si
 * iscrivono con lo stesso nome nello stesso istante) è molto più tollerabile:
 * al peggio una voce duplicata, non un partecipante sparito.
 */
export async function getParticipants(code: string): Promise<Participant[]> {
  const redis = getRedis();
  const map = await redis.hgetall<Record<string, Participant>>(keyParticipants(code));
  return map ? Object.values(map) : [];
}

async function touchTtl(code: string): Promise<void> {
  await getRedis().expire(keyParticipants(code), SESSION_TTL_SECONDS);
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
    await redis.hset(keyParticipants(code), { [existing.participantId]: existing });
    await touchTtl(code);
    return { participant: existing, isNew: false };
  }

  const participant: Participant = {
    participantId: nanoid(10),
    name: displayName.trim(),
    normalizedName: normalized,
    joinedAt: now,
    lastSeenAt: now,
  };
  await redis.hset(keyParticipants(code), { [participant.participantId]: participant });
  await touchTtl(code);
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
  const participant = await redis.hget<Participant>(keyParticipants(code), participantId);
  if (!participant) return null;

  participant.lastSeenAt = Date.now();
  await redis.hset(keyParticipants(code), { [participantId]: participant });
  await touchTtl(code);
  return participant;
}

export async function touchParticipant(code: string, participantId: string): Promise<void> {
  const redis = getRedis();
  const p = await redis.hget<Participant>(keyParticipants(code), participantId);
  if (!p) return;
  p.lastSeenAt = Date.now();
  await redis.hset(keyParticipants(code), { [participantId]: p });
  await touchTtl(code);
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

/** Sostituisce la scheda con i dati estratti da un nuovo PDF importato. */
export async function replaceBlock2(
  code: string,
  participantId: string,
  data: Block2Submission
): Promise<Submission> {
  const redis = getRedis();
  const current = await getSubmission(code, participantId);
  current.block2 = data;
  // Una nuova scheda deve essere valutata di nuovo dal partecipante.
  delete current.priority;
  delete current.priorityReflection;
  delete current.priorityAdvice;
  await redis.set(keySubmission(code, participantId), current, { ex: SESSION_TTL_SECONDS });
  return current;
}

/** Blocco 3 — autovalutazione del partecipante. */
export async function savePriorityEvaluation(
  code: string,
  participantId: string,
  data: PriorityEvaluation
): Promise<Submission> {
  const redis = getRedis();
  const current = await getSubmission(code, participantId);
  const evaluationChanged =
    JSON.stringify(current.priority?.scores) !== JSON.stringify(data.scores) ||
    JSON.stringify(current.priority?.rationale) !== JSON.stringify(data.rationale) ||
    current.priority?.boardNotes !== data.boardNotes;
  current.priority = data;
  // Se cambia la valutazione, la persona deve riflettere sui nuovi dati prima
  // che l'IA produca nuovi consigli.
  if (evaluationChanged) {
    delete current.priorityReflection;
    delete current.priorityAdvice;
  }
  await redis.set(keySubmission(code, participantId), current, { ex: SESSION_TTL_SECONDS });
  return current;
}

export async function savePriorityReflection(
  code: string,
  participantId: string,
  reflection: PriorityReflection
): Promise<Submission> {
  const redis = getRedis();
  const current = await getSubmission(code, participantId);
  current.priorityReflection = reflection;
  delete current.priorityAdvice;
  await redis.set(keySubmission(code, participantId), current, { ex: SESSION_TTL_SECONDS });
  return current;
}

export async function savePriorityAdvice(
  code: string,
  participantId: string,
  advice: PriorityAdvice
): Promise<Submission> {
  const redis = getRedis();
  const current = await getSubmission(code, participantId);
  current.priorityAdvice = advice;
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
