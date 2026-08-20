// Tipi condivisi per il modello dati del workshop.
// Blocco 1 — Scheda di attrito, in 3 step:
//   1. 21 domande sì/no; su ogni sì, impatto 1-10 (e nome dell'attività)
//   2. per le 3 candidate a impatto più alto, una caratteristica 1-10
//   3. esito calcolato: prontezza, punteggio, tecnologia, supervisione, matrice
// Step 4 — Use Case: intervista con l'agente e scheda da confermare (Blocco 2).

/** Blocco di appartenenza di una domanda: decide caratteristica e tecnologia. */
export type FrizioneBlocco = "sposti" | "controlli" | "scrivi" | "decidi";

export type UnlockedSteps = {
  step1: boolean;
  step2: boolean;
  step3: boolean;
  // Step 4 — descrizione del processo e scheda Use Case: un unico step, che
  // parte dall'intervista dell'agente e finisce sulla scheda da confermare.
  useCase: boolean;
  // Step 5 — esito del Blocco 3, compilato dall'AI Board e visibile in sola lettura.
  priority: boolean;
};

export const DEFAULT_UNLOCKED_STEPS: UnlockedSteps = {
  step1: false,
  step2: false,
  step3: false,
  useCase: false,
  priority: false,
};

export type SessionMeta = {
  code: string;
  facilitatorName: string;
  createdAt: number;
  unlockedSteps: UnlockedSteps;
};

export type Participant = {
  participantId: string;
  name: string; // nome visualizzato (come inserito dall'utente)
  normalizedName: string; // chiave di match per il rientro/recupero dati
  joinedAt: number;
  lastSeenAt: number;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

/**
 * Risposta a una domanda della scheda di attrito. `impatto` e `nome` esistono
 * solo quando la risposta è "si": passando a "no" il dato viene scartato.
 */
export type Step1Answer = {
  risposta: "si" | "no";
  impatto?: number; // 1-10, nessun valore finché il partecipante non muove la barra
  nome?: string; // come il partecipante chiama questa attività
};

export type Step1Submission = {
  risposte?: Record<string, Step1Answer>; // chiave: id domanda come stringa
  /** Domanda 21: le eccezioni si gestiscono con criteri non documentati. */
  criteriTaciti?: boolean;
  chatLog?: ChatMessage[];
  updatedAt?: number; // ultimo salvataggio automatico della bozza
  completedAt?: number;
};

/**
 * Step 2 — un valore 1-10 per candidata (la caratteristica dipende dal blocco
 * della domanda di origine). `candidate` congela le tre candidate al momento
 * della conclusione dello step, così modifiche successive allo Step 1 non
 * rimescolano un esito già calcolato.
 */
export type Step2Submission = {
  valori?: Record<string, number>; // chiave: id domanda come stringa
  candidate?: number[];
  chatLog?: ChatMessage[];
  updatedAt?: number;
  completedAt?: number; // dopo la conclusione gli slider non sono più modificabili
};

/**
 * Step 4 — Use Case Submission. I campi non sono elencati uno per uno: la
 * struttura del form (sezioni, campi, opzioni) vive in `config/block2Form.ts`
 * e qui si conservano i valori indicizzati per id di campo, così aggiornare il
 * template non richiede modifiche al modello dati né alle API.
 *
 * I valori arrivano dall'intervista dell'agente (`chatLog`) e restano
 * modificabili a mano nella scheda di conferma. `closedGroups` sono gli
 * argomenti dell'intervista già affrontati: sono loro, non il conteggio dei
 * campi, a dire quanto manca (un argomento si chiude anche se il partecipante
 * non sa rispondere). `interviewDone` distingue "sto ancora parlando" da "sono
 * sulla scheda", così il rientro riapre la fase giusta.
 */
export type Block2FieldValue = string | string[];

export type Block2Submission = {
  values?: Record<string, Block2FieldValue>;
  chatLog?: ChatMessage[];
  closedGroups?: string[];
  interviewDone?: boolean;
  updatedAt?: number;
  completedAt?: number;
  /** Documento prodotto nel workshop precedente e importato per il Blocco 3. */
  sourcePdf?: {
    fileName: string;
    importedAt: number;
    extractedFieldCount: number;
  };
};

export type PriorityDimension = "impact" | "effort" | "risk" | "reuse";

export type PriorityScores = Record<PriorityDimension, number>;

/** Valutazione del Blocco 3: i risultati derivati vengono sempre ricalcolati. */
export type PriorityEvaluation = {
  scores: PriorityScores;
  /** Motivazione sintetica facoltativa per ciascuna dimensione. */
  rationale?: Partial<Record<PriorityDimension, string>>;
  boardNotes?: string;
  evaluatedBy: string;
  evaluatedAt: number;
};

/** Considerazione personale inserita prima di richiedere i consigli IA. */
export type PriorityReflection = {
  text: string;
  submittedAt: number;
};

/** Consigli generati solo dopo il salvataggio della considerazione personale. */
export type PriorityAdvice = {
  summary: string;
  strengths: string[];
  cautions: string[];
  nextSteps: string[];
  generatedAt: number;
  model: string;
};

export type ParticipantTab = "1" | "2" | "3" | "UC" | "5";

/**
 * Punto in cui il partecipante stava lavorando: salvato lato server insieme
 * alla submission così che il rientro (anche da un altro dispositivo) riapra
 * esattamente lo step dove ci si era interrotti. "UC" è lo Step 4 (Use Case).
 */
export type ParticipantProgress = {
  tab: ParticipantTab;
  updatedAt: number;
};

export type Submission = {
  participantId: string;
  step1?: Step1Submission;
  step2?: Step2Submission;
  // Lo Step 3 non ha dati propri: l'esito è calcolato da step1 + step2
  // (vedi lib/frizioneScoring.ts), così non può divergere da ciò che si vede.
  block2?: Block2Submission;
  // Blocco 3 — salvato esclusivamente tramite API autenticata del facilitatore.
  priority?: PriorityEvaluation;
  priorityReflection?: PriorityReflection;
  priorityAdvice?: PriorityAdvice;
  progress?: ParticipantProgress;
};

/** Riepilogo di una sessione attiva, mostrato al facilitatore che rientra. */
export type SessionSummary = {
  code: string;
  facilitatorName: string;
  createdAt: number;
  participantCount: number;
  lastActivityAt: number;
};
