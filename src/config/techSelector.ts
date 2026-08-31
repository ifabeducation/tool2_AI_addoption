// Assistente "Technology Feasibility Assessment" — Step 5.
// Non è più un'intervista generica sullo use case: è un AI Solution
// Architect / Technology Selection Facilitator che parte dal problema (output
// atteso, dati, processo, autonomia) e arriva a QUALE tecnologia è tecnicamente
// più adatta — preferendo sempre la soluzione più semplice che soddisfa i
// requisiti reali, senza proporre di default GenAI o AI Agent.
//
// Principio architetturale: il modello spiega e fa UNA domanda alla volta con
// risposte rapide selezionabili; la raccomandazione finale è calcolata SEMPRE
// da codice deterministico (vedi recommendTechnology), mai dal modello — stesso
// principio già usato per priorityAdvice e per il vecchio matchTechnologies.

// --- Famiglie tecnologiche -------------------------------------------------

export type TechnologyFamilyKey =
  | "mlClassification"
  | "mlRegression"
  | "mlClustering"
  | "mlRecommendation"
  | "genAI"
  | "rpa"
  | "aiAgent"
  | "decisionSupport";

export const TECHNOLOGY_FAMILY_KEYS: TechnologyFamilyKey[] = [
  "mlClassification",
  "mlRegression",
  "mlClustering",
  "mlRecommendation",
  "genAI",
  "rpa",
  "aiAgent",
  "decisionSupport",
];

/** Un prerequisito tipico della tecnologia, con la sua condizione di verifica sulle risposte raccolte. */
export type PrerequisiteCheck = { text: string; check: (answers: FeasibilityAnswerMap) => boolean };

export type TechnologyFamily = {
  key: TechnologyFamilyKey;
  label: string;
  /** "Da considerare quando..." — spiegazione generale, indipendente dalle risposte. */
  whenToUse: string;
  prerequisites: PrerequisiteCheck[];
  mainRisk: string;
  mvpApproach: string;
};

// --- Dimensioni dell'assessment ---------------------------------------------

export type FeasibilityDimensionKey =
  | "outputAtteso"
  | "tipoDati"
  | "disponibilitaDati"
  | "groundTruth"
  | "volumeStorico"
  | "regolarita"
  | "autonomia"
  | "integrazioni"
  | "frequenza";

export type FeasibilityOption = { value: string; label: string };

export type AssessmentDimension = {
  key: FeasibilityDimensionKey;
  /** Breve, per l'indicatore di avanzamento ("Output atteso", non l'intera domanda). */
  title: string;
  question: string;
  options: FeasibilityOption[];
  /** Scelta multipla (es. tipo di dati) invece di singola. */
  multiple?: boolean;
  /** Chiesta solo se vero; assente = sempre rilevante. Decide l'adattività del percorso. */
  relevantWhen?: (answers: FeasibilityAnswerMap) => boolean;
  /** Ordine tra le dimensioni rilevanti in un dato momento: più basso = prima. */
  priority: number;
};

export type FeasibilityAnswerValue = string | string[];

/** Una singola risposta: cosa si scambia tra UI, server e modello a ogni turno. */
export type FeasibilityAnswer = {
  dimension: FeasibilityDimensionKey;
  value: FeasibilityAnswerValue;
  /** true se il partecipante ha scelto "Non lo so / Da verificare" invece di un'opzione. */
  unknown?: boolean;
  /**
   * "quickReply": il testo del messaggio corrispondeva esattamente a
   * un'opzione (o a "non lo so"), riconosciuto dal codice in modo
   * deterministico, senza bisogno del modello. "text": estratta dal
   * modello da una risposta libera (scritta o dettata) — distingue
   * un'informazione dichiarata esplicitamente da una interpretata.
   */
  source?: "quickReply" | "text";
};

export type FeasibilityAnswerMap = Partial<Record<FeasibilityDimensionKey, FeasibilityAnswer>>;

/** Valore riconosciuto ovunque come "non lo so / da verificare": l'unica opzione universale offerta su ogni domanda. */
export const UNKNOWN_VALUE = "nonSo";
export const UNKNOWN_OPTION: FeasibilityOption = { value: UNKNOWN_VALUE, label: "Non lo so / Da verificare" };

function valueIncludes(answer: FeasibilityAnswer | undefined, value: string): boolean {
  if (!answer) return false;
  return Array.isArray(answer.value) ? answer.value.includes(value) : answer.value === value;
}

function valueIsAny(answer: FeasibilityAnswer | undefined, values: string[]): boolean {
  return values.some((v) => valueIncludes(answer, v));
}

// --- Riconoscimento semantico dell'incertezza -------------------------------
// Generico e indipendente dalle domande: funziona su qualunque dimensione,
// anche se in futuro cambiano titoli e opzioni (nessun testo hardcoded per
// una domanda specifica).

const UNCERTAIN_PATTERNS: RegExp[] = [
  /non\s+(lo\s+)?so\b/i,
  /non\s+saprei/i,
  /non\s+(ne\s+)?sono\s+sicur[oa]/i,
  /non\s+sono\s+cert[oa]/i,
  /^boh\.?$/i,
  /non\s+è\s+chiaro/i,
  /difficile\s+da\s+dire/i,
  /non\s+ho\s+idea/i,
  /^mah\b/i,
  /da\s+verificare/i,
];

/** Riconosce espressioni di incertezza equivalenti a "non lo so", in italiano, a prescindere dalla domanda posta. */
export function isUncertainText(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return UNCERTAIN_PATTERNS.some((re) => re.test(t));
}

/**
 * Riconoscimento deterministico della risposta a partire dal testo del
 * messaggio: se corrisponde esattamente (senza distinzione di maiuscole) a
 * un'opzione della dimensione, o a un'espressione di incertezza, la risposta
 * è certa e non serve affidarsi all'estrazione del modello — elimina
 * l'ambiguità che fa ripetere la domanda quando il modello non riesce a
 * estrarla, e permette di dirlo esplicitamente al prompt. Ritorna null se il
 * testo è libero e va interpretato dal modello (nessun match esatto).
 */
export function matchOptionFromText(dimension: AssessmentDimension, text: string): FeasibilityAnswer | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;

  // Il corto circuito su "non lo so" scatta solo per messaggi brevi, cioè
  // quasi interamente quell'espressione (click sul pulsante, o poche
  // parole dettate/scritte): una frase lunga che la contiene di sfuggita
  // ("vorrei automatizzare X ma non so se Y") ha comunque contenuto utile
  // e va interpretata dal modello, non scartata come pura incertezza.
  if (t === UNKNOWN_OPTION.label.toLowerCase() || (t.length <= 40 && isUncertainText(t))) {
    return { dimension: dimension.key, value: UNKNOWN_VALUE, unknown: true, source: "quickReply" };
  }

  if (dimension.multiple) {
    const parts = t.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) return null;
    const matched = dimension.options.filter((o) => parts.includes(o.label.toLowerCase())).map((o) => o.value);
    // Match solo se OGNI parte corrisponde a un'opzione nota: altrimenti è
    // testo libero parziale, meglio lasciarlo interpretare al modello.
    if (matched.length === parts.length) {
      return { dimension: dimension.key, value: matched, source: "quickReply" };
    }
    return null;
  }

  const exact = dimension.options.find((o) => o.label.toLowerCase() === t);
  return exact ? { dimension: dimension.key, value: exact.value, source: "quickReply" } : null;
}

// --- Catalogo delle dimensioni ----------------------------------------------
// Le prime 3 (output, dati, disponibilità) sono sempre chieste: fondano ogni
// percorso. Le successive sono condizionate dal ramo emerso da "outputAtteso",
// così la conversazione resta breve e mirata invece di un questionario fisso.

const OUTPUT_AUTOMATION_BRANCH = ["automazioneAzione", "processoMultiStep", "analisiDecisione"];

export const ASSESSMENT_DIMENSIONS: AssessmentDimension[] = [
  {
    key: "outputAtteso",
    title: "Output atteso",
    question: "Che cosa dovrebbe produrre concretamente la soluzione?",
    priority: 1,
    options: [
      { value: "categoria", label: "Assegnare una categoria a qualcosa" },
      { value: "numero", label: "Prevedere un valore numerico" },
      { value: "pattern", label: "Identificare gruppi o pattern" },
      { value: "suggerimento", label: "Suggerire un prodotto, contenuto o azione" },
      { value: "generazione", label: "Generare o trasformare contenuti" },
      { value: "analisiDecisione", label: "Analizzare dati e suggerire una decisione" },
      { value: "automazioneAzione", label: "Eseguire automaticamente un'attività" },
      { value: "processoMultiStep", label: "Gestire autonomamente un processo con più passaggi" },
    ],
  },
  {
    key: "tipoDati",
    title: "Tipo di dati",
    question: "Quali dati sono disponibili per far funzionare la soluzione? Puoi indicarne più di uno.",
    priority: 2,
    multiple: true,
    options: [
      { value: "erpCrm", label: "Dati strutturati da ERP/CRM/database" },
      { value: "serieStoriche", label: "Serie storiche numeriche" },
      { value: "testiDocumenti", label: "Testi, email, PDF, documenti" },
      { value: "immaginiVideo", label: "Immagini o video" },
      { value: "audio", label: "Audio" },
      { value: "iot", label: "Dati IoT/sensori" },
      { value: "interazioniUtenti", label: "Storico delle interazioni degli utenti" },
      { value: "multiFonte", label: "Combinazione di più fonti" },
    ],
  },
  {
    key: "disponibilitaDati",
    title: "Disponibilità dei dati",
    question: "Questi dati sono già disponibili e accessibili in modo continuativo — non solo se \"esistono\"?",
    priority: 3,
    options: [
      { value: "disponibiliAccessibili", label: "Sì, già disponibili e facilmente accessibili" },
      { value: "daEstrarre", label: "Esistono ma vanno estratti/integrati" },
      { value: "qualitaIncerta", label: "Esistono ma la qualità è incerta" },
      { value: "parziali", label: "Sono parziali" },
      { value: "nonEsistono", label: "Non esistono ancora" },
    ],
  },
  {
    key: "groundTruth",
    title: "Dato storico corretto",
    question:
      "Per i casi passati conoscete già il risultato corretto che il sistema dovrebbe imparare a prevedere (es. la categoria giusta, l'esito, il valore finale)?",
    priority: 4,
    relevantWhen: (a) => valueIsAny(a.outputAtteso, ["categoria", "numero"]),
    options: [
      { value: "siConosciamo", label: "Sì, lo conosciamo per un buon numero di casi" },
      { value: "parzialmente", label: "Solo in parte" },
      { value: "no", label: "No" },
    ],
  },
  {
    key: "volumeStorico",
    title: "Volume e storico",
    question: "Quanto storico avete a disposizione su questo processo o fenomeno?",
    priority: 5,
    relevantWhen: (a) =>
      valueIncludes(a.tipoDati, "serieStoriche") || valueIsAny(a.outputAtteso, ["categoria", "numero", "pattern", "suggerimento"]),
    options: [
      { value: "moltoStorico", label: "Sì, anni di storico" },
      { value: "storicoModerato", label: "Qualche mese" },
      { value: "pocoStorico", label: "Poco o nessuno" },
    ],
  },
  {
    key: "regolarita",
    title: "Regole vs interpretazione",
    question: "Il processo segue regole chiare e ripetibili, oppure richiede interpretazione e decisioni diverse caso per caso?",
    priority: 6,
    relevantWhen: (a) => valueIsAny(a.outputAtteso, [...OUTPUT_AUTOMATION_BRANCH, "generazione"]),
    options: [
      { value: "regoleChiare", label: "Regole chiare e ripetibili" },
      { value: "interpretazioneVariabile", label: "Richiede interpretazione, varia caso per caso" },
      { value: "misto", label: "Un po' entrambe le cose" },
    ],
  },
  {
    key: "autonomia",
    title: "Livello di autonomia",
    question: "La soluzione deve solo suggerire cosa fare, oppure deve eseguire direttamente delle azioni?",
    priority: 7,
    relevantWhen: (a) => valueIsAny(a.outputAtteso, [...OUTPUT_AUTOMATION_BRANCH, "generazione", "suggerimento"]),
    options: [
      { value: "soloInformazioni", label: "Fornire informazioni" },
      { value: "raccomandazione", label: "Fornire una raccomandazione" },
      { value: "outputVerificato", label: "Generare un output che una persona verifica" },
      { value: "azioneConApprovazione", label: "Eseguire un'azione dopo approvazione umana" },
      { value: "autonomo", label: "Eseguire autonomamente" },
      { value: "autonomoMultiStep", label: "Gestire autonomamente un processo con più passaggi" },
    ],
  },
  {
    key: "integrazioni",
    title: "Integrazioni",
    question: "Con quali sistemi deve interagire la soluzione, e sono disponibili API o integrazioni strutturate?",
    priority: 8,
    relevantWhen: (a) => valueIsAny(a.outputAtteso, OUTPUT_AUTOMATION_BRANCH),
    options: [
      { value: "nessuna", label: "Nessuna integrazione necessaria" },
      { value: "sistemiConApi", label: "Sì, con API/integrazioni disponibili" },
      { value: "sistemiSenzaApiRegoleFisse", label: "Sistemi esistenti senza API, ma con interfacce stabili" },
      { value: "multiSistemiDinamici", label: "Più sistemi diversi, in modo dinamico" },
    ],
  },
  {
    key: "frequenza",
    title: "Frequenza",
    question: "Con che frequenza servirebbe questo risultato?",
    // Priorità più bassa: è un dettaglio utile ma non decisivo, si chiede solo se restano turni disponibili.
    priority: 9,
    options: [
      { value: "batch", label: "Periodicamente (es. giornaliero/settimanale)" },
      { value: "onDemand", label: "Su richiesta" },
      { value: "quasiRealtime", label: "Quasi in tempo reale" },
      { value: "realtime", label: "In tempo reale" },
    ],
  },
];

export const MIN_QUESTIONS_BEFORE_EARLY_STOP = 5;
export const MAX_QUESTIONS = 8;

/** Dimensioni ancora da chiedere, nell'ordine giusto per il ramo emerso finora. */
export function applicableDimensions(answers: FeasibilityAnswerMap): AssessmentDimension[] {
  return ASSESSMENT_DIMENSIONS.filter((d) => !answers[d.key] && (!d.relevantWhen || d.relevantWhen(answers)));
}

/** La prossima dimensione da chiedere, o null se l'assessment può considerarsi concluso. */
export function nextDimension(answers: FeasibilityAnswerMap): AssessmentDimension | null {
  if (Object.keys(answers).length >= MAX_QUESTIONS) return null;
  const applicable = applicableDimensions(answers).sort((a, b) => a.priority - b.priority);
  return applicable[0] ?? null;
}

/**
 * La dimensione che verrebbe chiesta subito dopo `dim`, ASSUMENDO che venga
 * risposta in un modo qualunque: i criteri di rilevanza delle altre
 * dimensioni non dipendono mai dal valore di `dim` stessa (solo da altre
 * dimensioni già risposte in precedenza), quindi si può calcolare senza
 * ancora conoscere la risposta — ed è proprio questo che permette al
 * modello di sapere, nello stesso turno in cui estrae la risposta corrente,
 * quale sarà la prossima domanda da fare.
 */
export function dimensionAfter(dim: AssessmentDimension | null, answers: FeasibilityAnswerMap): AssessmentDimension | null {
  if (!dim) return null;
  return nextDimension({ ...answers, [dim.key]: { dimension: dim.key, value: "__pending__" } });
}

/** Stima dinamica del totale domande per l'indicatore di avanzamento: non è un numero fisso, si aggiorna col ramo emerso. */
export function estimatedTotalQuestions(answers: FeasibilityAnswerMap): number {
  const answered = Object.keys(answers).length;
  return Math.min(MAX_QUESTIONS, answered + applicableDimensions(answers).length);
}

export function dimensionByKey(key: string): AssessmentDimension | undefined {
  return ASSESSMENT_DIMENSIONS.find((d) => d.key === key);
}

export function optionLabel(dimensionKey: FeasibilityDimensionKey, value: string): string {
  if (value === UNKNOWN_VALUE) return UNKNOWN_OPTION.label;
  return dimensionByKey(dimensionKey)?.options.find((o) => o.value === value)?.label ?? value;
}

/** Etichetta leggibile di una risposta (gestisce anche le scelte multiple). */
export function answerLabel(answer: FeasibilityAnswer): string {
  if (answer.unknown) return UNKNOWN_OPTION.label;
  const values = Array.isArray(answer.value) ? answer.value : [answer.value];
  return values.map((v) => optionLabel(answer.dimension, v)).join(", ");
}

/** Ripulisce una risposta ricavata dal modello: tiene solo valori ammessi per quella dimensione. */
export function sanitizeFeasibilityAnswer(dimensionKey: string, raw: unknown): FeasibilityAnswer | null {
  const dimension = dimensionByKey(dimensionKey);
  if (!dimension) return null;

  const known = new Set([...dimension.options.map((o) => o.value), UNKNOWN_VALUE]);
  const rawValues = Array.isArray(raw) ? raw : [raw];
  const values = rawValues.filter((v): v is string => typeof v === "string" && known.has(v));
  if (values.length === 0) return null;

  if (values.includes(UNKNOWN_VALUE)) {
    return { dimension: dimension.key, value: UNKNOWN_VALUE, unknown: true };
  }
  return { dimension: dimension.key, value: dimension.multiple ? values : values[0] };
}

// --- Motore di raccomandazione (deterministico, non lasciato al modello) ---

type SignalRule = { check: (a: FeasibilityAnswerMap) => boolean; points: number; reason: string };

const SIGNALS: Record<TechnologyFamilyKey, SignalRule[]> = {
  mlClassification: [
    { check: (a) => valueIncludes(a.outputAtteso, "categoria"), points: 3, reason: "L'obiettivo è assegnare una categoria: è il caso d'uso classico della classificazione." },
    { check: (a) => valueIncludes(a.groundTruth, "siConosciamo"), points: 3, reason: "Per i casi passati è già noto il risultato corretto: c'è un dataset etichettabile da cui imparare." },
    { check: (a) => valueIncludes(a.groundTruth, "parzialmente"), points: 1, reason: "Il risultato corretto è noto solo in parte: un buon punto di partenza, ma andrà completato." },
    { check: (a) => valueIsAny(a.tipoDati, ["erpCrm", "testiDocumenti", "immaginiVideo"]), points: 1, reason: "I dati disponibili sono del tipo tipicamente usato per addestrare un classificatore." },
    { check: (a) => valueIsAny(a.volumeStorico, ["moltoStorico", "storicoModerato"]), points: 1, reason: "C'è abbastanza storico per addestrare e validare un modello." },
  ],
  mlRegression: [
    { check: (a) => valueIncludes(a.outputAtteso, "numero"), points: 3, reason: "L'obiettivo è prevedere un valore numerico continuo: è il caso d'uso classico della regressione." },
    { check: (a) => valueIncludes(a.tipoDati, "serieStoriche"), points: 2, reason: "Sono disponibili serie storiche numeriche, la materia prima della previsione." },
    { check: (a) => valueIncludes(a.volumeStorico, "moltoStorico"), points: 2, reason: "Lo storico copre diversi anni: condizione ideale per un modello di previsione affidabile." },
    { check: (a) => valueIncludes(a.volumeStorico, "storicoModerato"), points: 1, reason: "Lo storico è di qualche mese: utilizzabile, ma da monitorare per l'affidabilità." },
  ],
  mlClustering: [
    { check: (a) => valueIncludes(a.outputAtteso, "pattern"), points: 3, reason: "L'obiettivo è scoprire gruppi o pattern non ancora noti: è il caso d'uso classico del clustering." },
    { check: (a) => valueIncludes(a.groundTruth, "no"), points: 2, reason: "Non esistono categorie già note: il clustering non richiede etichette, a differenza della classificazione." },
    { check: (a) => valueIsAny(a.tipoDati, ["erpCrm", "interazioniUtenti"]), points: 1, reason: "I dati disponibili hanno attributi distintivi utili a far emergere gruppi naturali." },
  ],
  mlRecommendation: [
    { check: (a) => valueIncludes(a.outputAtteso, "suggerimento"), points: 3, reason: "L'obiettivo è suggerire il contenuto o l'azione più adatta a un caso specifico." },
    { check: (a) => valueIncludes(a.tipoDati, "interazioniUtenti"), points: 3, reason: "È disponibile uno storico delle interazioni utente-contenuto, la base di un sistema di raccomandazione." },
  ],
  genAI: [
    { check: (a) => valueIncludes(a.outputAtteso, "generazione"), points: 3, reason: "L'obiettivo è generare o trasformare contenuti non strutturati." },
    { check: (a) => valueIsAny(a.tipoDati, ["testiDocumenti", "immaginiVideo", "audio"]), points: 2, reason: "I dati coinvolti sono testi, immagini o audio: il dominio naturale della GenAI." },
    { check: (a) => valueIncludes(a.regolarita, "interpretazioneVariabile"), points: 1, reason: "Il contenuto richiede interpretazione caso per caso, non regole fisse." },
  ],
  rpa: [
    { check: (a) => valueIncludes(a.regolarita, "regoleChiare"), points: 3, reason: "Il processo segue regole chiare e ripetibili: la condizione ideale per l'automazione robotica." },
    { check: (a) => valueIncludes(a.outputAtteso, "automazioneAzione"), points: 2, reason: "L'obiettivo è eseguire automaticamente un'attività definita." },
    { check: (a) => valueIncludes(a.integrazioni, "sistemiSenzaApiRegoleFisse"), points: 2, reason: "I sistemi coinvolti non hanno API ma interfacce stabili: lo scenario tipico per l'RPA." },
    { check: (a) => valueIsAny(a.autonomia, ["azioneConApprovazione", "outputVerificato"]), points: 1, reason: "È previsto un controllo umano prima o dopo l'azione, coerente con un'automazione supervisionata." },
  ],
  aiAgent: [
    { check: (a) => valueIncludes(a.outputAtteso, "processoMultiStep"), points: 3, reason: "L'obiettivo è gestire autonomamente un processo con più passaggi, non un singolo compito." },
    { check: (a) => valueIsAny(a.autonomia, ["autonomo", "autonomoMultiStep"]), points: 3, reason: "Il sistema deve eseguire in autonomia, non solo raccomandare o attendere approvazione." },
    { check: (a) => valueIsAny(a.integrazioni, ["sistemiConApi", "multiSistemiDinamici"]), points: 2, reason: "Sono disponibili più sistemi/API da orchestrare dinamicamente." },
    { check: (a) => valueIsAny(a.regolarita, ["interpretazioneVariabile", "misto"]), points: 1, reason: "Il contesto è variabile e richiede scelte dinamiche, non solo regole fisse." },
    // Smorzatore: se serve forte validazione umana, un agente autonomo non è la scelta giusta.
    { check: (a) => valueIsAny(a.autonomia, ["soloInformazioni", "raccomandazione"]), points: -3, reason: "" },
  ],
  decisionSupport: [
    { check: (a) => valueIncludes(a.outputAtteso, "analisiDecisione"), points: 3, reason: "L'obiettivo è analizzare dati per supportare una decisione, che resta a una persona." },
    { check: (a) => valueIsAny(a.autonomia, ["raccomandazione", "soloInformazioni"]), points: 2, reason: "La soluzione deve fornire informazioni o una raccomandazione, non agire da sola." },
    { check: (a) => valueIncludes(a.tipoDati, "erpCrm"), points: 1, reason: "Sono disponibili dati strutturati aziendali (ERP/CRM), la base tipica di un cruscotto decisionale." },
    { check: (a) => valueIncludes(a.integrazioni, "sistemiConApi"), points: 1, reason: "È possibile integrare i sistemi aziendali esistenti per alimentare l'analisi." },
  ],
};

export const TECHNOLOGY_FAMILIES: Record<TechnologyFamilyKey, TechnologyFamily> = {
  mlClassification: {
    key: "mlClassification",
    label: "Machine Learning — Classification",
    whenToUse: "Da considerare quando bisogna assegnare elementi a categorie predefinite.",
    prerequisites: [
      { text: "Dataset etichettato per un buon numero di casi passati", check: (a) => valueIsAny(a.groundTruth, ["siConosciamo", "parzialmente"]) },
      { text: "Dati sufficienti, puliti e rappresentativi", check: (a) => valueIncludes(a.disponibilitaDati, "disponibiliAccessibili") },
    ],
    mainRisk: "Bias o scarsa rappresentatività del dataset etichettato può produrre classificazioni sbagliate su casi reali.",
    mvpApproach: "Allena un modello su un sottoinsieme già etichettato e misura l'accuratezza su casi reali prima di estendere la copertura.",
  },
  mlRegression: {
    key: "mlRegression",
    label: "Machine Learning — Regression",
    whenToUse: "Da considerare quando bisogna prevedere un valore numerico continuo.",
    prerequisites: [
      { text: "Serie storiche numeriche strutturate", check: (a) => valueIncludes(a.tipoDati, "serieStoriche") },
      { text: "Storico di alcuni anni, quando possibile", check: (a) => valueIncludes(a.volumeStorico, "moltoStorico") },
    ],
    mainRisk: "Serie storiche brevi, instabili o con eventi anomali riducono l'affidabilità delle previsioni.",
    mvpApproach: "Costruisci una previsione su una singola metrica con lo storico disponibile e confrontala con la stima attuale prima di sostituirla.",
  },
  mlClustering: {
    key: "mlClustering",
    label: "Machine Learning — Clustering",
    whenToUse: "Da considerare quando si vogliono scoprire gruppi o pattern naturali senza avere categorie già definite.",
    prerequisites: [
      { text: "Dataset sufficientemente ampio con attributi distintivi", check: (a) => valueIncludes(a.disponibilitaDati, "disponibiliAccessibili") },
      { text: "Non servono etichette pregresse", check: (a) => !a.groundTruth || valueIncludes(a.groundTruth, "no") },
    ],
    mainRisk: "I gruppi individuati potrebbero non avere un significato di business immediato: serve interpretazione umana per renderli utili.",
    mvpApproach: "Esegui il clustering su un campione dei dati e verifica con chi conosce il dominio se i gruppi trovati hanno senso operativo.",
  },
  mlRecommendation: {
    key: "mlRecommendation",
    label: "Machine Learning — Recommendation",
    whenToUse: "Da considerare quando bisogna suggerire contenuti, prodotti, servizi o azioni rilevanti per uno specifico utente o caso.",
    prerequisites: [
      { text: "Storico delle interazioni utente-item", check: (a) => valueIncludes(a.tipoDati, "interazioniUtenti") },
      { text: "Dati accessibili in modo continuativo", check: (a) => valueIncludes(a.disponibilitaDati, "disponibiliAccessibili") },
    ],
    mainRisk: "Con pochi dati su utenti o contenuti nuovi (cold start) i suggerimenti sono poco affidabili all'inizio.",
    mvpApproach: "Parti da un modello semplice sullo storico disponibile e misura se i suggerimenti migliorano l'indicatore che ti interessa rispetto a oggi.",
  },
  genAI: {
    key: "genAI",
    label: "Generative AI",
    whenToUse: "Da considerare quando l'output è contenuto nuovo o trasformazione di contenuti non strutturati: testo, documenti, sintesi, immagini, audio, video o codice.",
    prerequisites: [
      { text: "Contenuti di qualità nel dominio per il grounding", check: (a) => valueIsAny(a.tipoDati, ["testiDocumenti", "immaginiVideo", "audio"]) },
      { text: "Requisiti di accuratezza e rischio di hallucination valutati", check: () => false },
    ],
    mainRisk: "Rischio di hallucination: il sistema può generare contenuti plausibili ma non corretti se non è ben ancorato a fonti verificate.",
    mvpApproach: "Prototipa su un set ristretto di casi reali, con una persona che verifica ogni output, prima di ridurre la supervisione.",
  },
  rpa: {
    key: "rpa",
    label: "RPA — Robotic Process Automation",
    whenToUse: "Da privilegiare quando il processo è ripetitivo, digitale, stabile, basato su regole chiare, ad alto volume e con poche eccezioni.",
    prerequisites: [
      { text: "Processo stabile, documentato, con poche eccezioni", check: (a) => valueIncludes(a.regolarita, "regoleChiare") },
      { text: "Interfacce esistenti raggiungibili in modo affidabile", check: (a) => valueIsAny(a.integrazioni, ["sistemiSenzaApiRegoleFisse", "sistemiConApi"]) },
    ],
    mainRisk: "Cambiamenti nell'interfaccia o nella logica dei sistemi esistenti possono interrompere l'automazione senza preavviso.",
    mvpApproach: "Automatizza prima il percorso più frequente e senza eccezioni, lasciando i casi anomali a una persona.",
  },
  aiAgent: {
    key: "aiAgent",
    label: "AI Agent",
    whenToUse: "Da considerare solo quando il sistema deve perseguire un obiettivo, pianificare più passaggi, scegliere dinamicamente cosa fare, usare strumenti/API e reagire ai risultati delle proprie azioni.",
    prerequisites: [
      { text: "Mappatura del processo e delle eccezioni", check: (a) => Boolean(a.regolarita) },
      { text: "API/tool disponibili per agire sui sistemi", check: (a) => valueIsAny(a.integrazioni, ["sistemiConApi", "multiSistemiDinamici"]) },
      { text: "Gestione delle autorizzazioni e orchestrazione robusta", check: (a) => valueIsAny(a.autonomia, ["autonomo", "autonomoMultiStep"]) },
    ],
    mainRisk: "Serve un'orchestrazione robusta e un controllo chiaro sulle autorizzazioni: un errore in un passaggio può propagarsi ai successivi.",
    mvpApproach: "Limita l'autonomia a un obiettivo ristretto con supervisione umana sulle azioni critiche, poi allarga gradualmente.",
  },
  decisionSupport: {
    key: "decisionSupport",
    label: "Decision Support",
    whenToUse: "Da considerare quando il sistema deve analizzare dati e produrre insight, previsioni o raccomandazioni, ma la decisione finale resta a una persona.",
    prerequisites: [
      { text: "Dati storici strutturati e/o real-time", check: (a) => valueIncludes(a.tipoDati, "erpCrm") },
      { text: "Integrazione con ERP/CRM o data warehouse/BI", check: (a) => valueIsAny(a.integrazioni, ["sistemiConApi", "multiSistemiDinamici"]) },
    ],
    mainRisk: "L'insight è utile solo se i dati sottostanti sono affidabili e aggiornati: dati di scarsa qualità producono raccomandazioni fuorvianti.",
    mvpApproach: "Costruisci un cruscotto o un report che confronta la raccomandazione del sistema con le decisioni prese finora, senza automatizzare nulla.",
  },
};

export type ConfidenceLevel = "alta" | "media" | "bassa";

export type TechnologyRecommendation = {
  primary: {
    key: TechnologyFamilyKey;
    label: string;
    confidence: ConfidenceLevel;
    reasons: string[];
    prerequisitesPresent: string[];
    prerequisitesToVerify: string[];
    mainRisk: string;
    mvpApproach: string;
  };
  alternative?: {
    key: TechnologyFamilyKey;
    label: string;
    whatWouldDecide: string;
  };
};

/** Quanti "non lo so" ci sono tra le risposte raccolte: più sono, più bassa la confidenza. */
function unknownCount(answers: FeasibilityAnswerMap): number {
  return Object.values(answers).filter((a) => a?.unknown).length;
}

/**
 * AI Agent è definito da PIÙ requisiti insieme (obiettivo perseguito,
 * pianificazione multi-step, scelta dinamica, uso di tool/API — vedi
 * TECHNOLOGY_FAMILIES.aiAgent.whenToUse), non da uno solo: un singolo
 * segnale positivo (es. il solo "output multi-step") non basta a
 * qualificarla, altrimenti basterebbe che lo use case contenga più di
 * un'attività. Le altre famiglie non hanno questo vincolo esplicito.
 */
const MIN_POSITIVE_SIGNALS: Partial<Record<TechnologyFamilyKey, number>> = {
  aiAgent: 2,
};

/**
 * Calcola la raccomandazione dalle risposte raccolte. Puramente deterministico:
 * non è mai il modello a scegliere la tecnologia, solo a spiegarla (vedi
 * buildFeasibilitySystemPrompt). Non sceglie MAI GenAI/Agent per default: sono
 * semplicemente due delle 8 famiglie con i propri segnali, senza alcun bonus.
 */
export function recommendTechnology(answers: FeasibilityAnswerMap): TechnologyRecommendation | null {
  if (!answers.outputAtteso) return null;

  const scored = TECHNOLOGY_FAMILY_KEYS.map((key) => {
    const rules = SIGNALS[key];
    const fired = rules.filter((r) => r.check(answers));
    const positiveCount = fired.filter((r) => r.points > 0).length;
    const belowMinimum = positiveCount < (MIN_POSITIVE_SIGNALS[key] ?? 1);
    const score = belowMinimum ? 0 : fired.reduce((sum, r) => sum + r.points, 0);
    const reasons = belowMinimum
      ? []
      : fired
          .filter((r) => r.points > 0 && r.reason)
          .sort((a, b) => b.points - a.points)
          .slice(0, 4)
          .map((r) => r.reason);
    return { key, score, reasons };
  }).sort((a, b) => b.score - a.score);

  const top = scored[0];
  const second = scored[1];
  if (!top || top.score <= 0) return null;

  const gap = top.score - (second?.score ?? 0);
  const unknowns = unknownCount(answers);
  const confidence: ConfidenceLevel =
    top.score >= 6 && gap >= 3 && unknowns <= 1 ? "alta" : top.score >= 3 && gap >= 1 ? "media" : "bassa";

  const family = TECHNOLOGY_FAMILIES[top.key];
  const prerequisitesPresent = family.prerequisites.filter((p) => p.check(answers)).map((p) => p.text);
  const prerequisitesToVerify = family.prerequisites.filter((p) => !p.check(answers)).map((p) => p.text);

  const recommendation: TechnologyRecommendation = {
    primary: {
      key: top.key,
      label: family.label,
      confidence,
      reasons: top.reasons.length > 0 ? top.reasons : [family.whenToUse],
      prerequisitesPresent,
      prerequisitesToVerify,
      mainRisk: family.mainRisk,
      mvpApproach: family.mvpApproach,
    },
  };

  // Alternativa: solo se davvero competitiva, non per completezza.
  if (second && second.score > 0 && second.score >= top.score - 2) {
    recommendation.alternative = {
      key: second.key,
      label: TECHNOLOGY_FAMILIES[second.key].label,
      whatWouldDecide: `Verificare meglio: ${TECHNOLOGY_FAMILIES[second.key].prerequisites[0]?.text.toLowerCase() ?? "i prerequisiti di questa alternativa"}.`,
    };
  }

  return recommendation;
}

export function isAssessmentComplete(answers: FeasibilityAnswerMap): boolean {
  const answeredCount = Object.keys(answers).length;
  if (answeredCount >= MAX_QUESTIONS) return true;
  if (answeredCount >= MIN_QUESTIONS_BEFORE_EARLY_STOP) {
    const rec = recommendTechnology(answers);
    if (rec?.primary.confidence === "alta") return true;
  }
  return nextDimension(answers) === null;
}

// --- Prompt del facilitatore -------------------------------------------------

export const INITIAL_MESSAGE_FEASIBILITY =
  "Ciao! Sono qui per aiutarti a capire quale tecnologia AI è davvero adatta al tuo caso — e se è realmente fattibile, non solo interessante sulla carta. Non partiamo dalla tecnologia: partiamo dal problema. Ti faccio poche domande mirate (di solito 5-8), una alla volta, con risposte rapide da scegliere — puoi sempre rispondere \"Non lo so\" o scrivere/parlare liberamente.\n\n" +
  ASSESSMENT_DIMENSIONS[0].question;

function technologyCatalogText(): string {
  return TECHNOLOGY_FAMILY_KEYS.map((key) => `- ${TECHNOLOGY_FAMILIES[key].label}: ${TECHNOLOGY_FAMILIES[key].whenToUse}`).join("\n");
}

function answersSummaryText(answers: FeasibilityAnswerMap): string {
  const entries = Object.values(answers).filter((a): a is FeasibilityAnswer => Boolean(a));
  if (entries.length === 0) return "Nessuna risposta ancora raccolta.";
  return entries
    .map((a) => `- ${dimensionByKey(a.dimension)?.title ?? a.dimension}: ${answerLabel(a)}`)
    .join("\n");
}

function optionsBlock(dimension: AssessmentDimension): string {
  const opts = dimension.options.map((o) => `"${o.label}" = ${o.value}`).join(" · ");
  const multi = dimension.multiple ? ' (il partecipante può scegliere più opzioni, elencale tutte in "value" come array)' : "";
  return `${opts} · "${UNKNOWN_OPTION.label}" = ${UNKNOWN_VALUE}${multi}`;
}

/**
 * System prompt del facilitatore. Il modello: spiega, fa UNA domanda alla
 * volta, ed estrae la risposta in JSON — ma SOLO quando serve davvero:
 * `toExtract` e `toAsk` sono calcolati dal server (mai dal modello), quindi
 * lo stesso turno può sia riconoscere che una risposta è già certa
 * (`alreadyKnown`, niente da estrarre) sia sapere subito quale sarà
 * l'argomento successivo da chiedere — senza questo, il modello non aveva
 * modo di sapere "cosa chiedere dopo" ed era portato a confermare o
 * ripetere. Non calcola né sceglie la tecnologia: quando l'assessment è
 * completo il risultato arriva già calcolato da recommendTechnology e il
 * modello lo commenta soltanto.
 */
export function buildFeasibilitySystemPrompt(ctx: {
  useCaseSummary?: string;
  answers: FeasibilityAnswerMap;
  /** Dimensione la cui risposta va ancora estratta da questo messaggio; null se già nota (vedi alreadyKnown) o se non resta nulla da chiedere. */
  toExtract: AssessmentDimension | null;
  /** Dimensione da chiedere in "reply" in questo turno, una volta gestito toExtract; null se l'assessment è concluso. */
  toAsk: AssessmentDimension | null;
  /** Risposta a toExtract già riconosciuta con certezza dal codice (opzione cliccata, o "non lo so" testuale): il modello non deve estrarla di nuovo, solo reagire di conseguenza. */
  alreadyKnown?: FeasibilityAnswer | null;
  recommendation: TechnologyRecommendation | null;
}): string {
  const contesto = ctx.useCaseSummary
    ? `Il caso d'uso di riferimento, dalla scheda importata all'inizio: ${ctx.useCaseSummary}`
    : "Non hai una descrizione dettagliata del caso: fai domande semplici e concrete, restando su quanto il partecipante racconta.";

  const raccolte = answersSummaryText(ctx.answers);

  const notaGiaNota = ctx.alreadyKnown
    ? ctx.alreadyKnown.unknown
      ? `\n**IMPORTANTE — IL PARTECIPANTE NON SA RISPONDERE**\nHa appena indicato che non sa rispondere alla domanda su "${dimensionByKey(ctx.alreadyKnown.dimension)?.title ?? ctx.alreadyKnown.dimension}". È un'informazione valida, non un errore: NON ripetere la stessa domanda, NON riproporre le stesse alternative tali e quali. Invece, in "reply":\n1. Se da "RISPOSTE GIÀ RACCOLTE" o dal resto della conversazione puoi già dedurre una risposta plausibile, proponila esplicitamente con la tua motivazione (es. "Da quello che hai descritto mi sembra di capire che..., ti direi quindi ...") e lascia che il partecipante confermi o corregga.\n2. Se non hai abbastanza elementi, fai UNA domanda di chiarimento diversa da quella già fatta: più semplice, concreta, con un esempio pratico che aiuti davvero a distinguere le alternative — non un'altra formulazione della stessa domanda.\n`
      : `\n**Il partecipante ha già risposto in modo chiaro**: "${answerLabel(ctx.alreadyKnown)}". È già stato registrato automaticamente: NON estrarlo di nuovo, NON chiedere conferma (non è ambiguo né in contraddizione con altro). Riconoscilo con al massimo una breve frase, poi vai dritto alla domanda successiva.\n`
    : "";

  const daEstrarre = ctx.toExtract
    ? `Devi ancora ricavare la risposta a: [${ctx.toExtract.key}] ${ctx.toExtract.title} — "${ctx.toExtract.question}"\nOpzioni (etichetta = valore da usare in "value"): ${optionsBlock(ctx.toExtract)}`
    : "Nessuna: la domanda corrente è già stata gestita (vedi sopra).";

  const daChiedere = ctx.toAsk
    ? `Nella tua "reply" chiedi QUESTO, con parole tue e un esempio se non è ovvio: [${ctx.toAsk.key}] ${ctx.toAsk.title} — "${ctx.toAsk.question}"\n(Non serve che tu elenchi le opzioni in "reply": sono già mostrate come pulsanti nell'interfaccia, tu introduci solo la domanda.)`
    : "Nessuna: non resta altro da chiedere. Il risultato è qui sotto: commentalo in 2-3 frasi semplici, spiegando perché quella tecnologia emerge dalle risposte date, e rispondi a eventuali domande del partecipante.";

  const risultato = ctx.recommendation
    ? `\n**RACCOMANDAZIONE GIÀ CALCOLATA (non ricalcolarla, non contraddirla, non sceglierne un'altra)**\nTecnologia principale: ${ctx.recommendation.primary.label} (confidenza ${ctx.recommendation.primary.confidence})\n${ctx.recommendation.alternative ? `Alternativa considerata: ${ctx.recommendation.alternative.label}\n` : ""}`
    : "";

  return `Sei un AI Solution Architect / Technology Selection Facilitator che guida un partecipante di un workshop aziendale — probabilmente senza competenze tecniche — in un Technology Feasibility Assessment.

**PRINCIPIO FONDAMENTALE**
Non partire mai dalla tecnologia. Parti dal problema, dai dati e dal processo reali, e lascia che sia la tecnologia più semplice in grado di soddisfare i requisiti a emergere. Non proporre di default Generative AI o AI Agent: se una soluzione deterministica, RPA o ML tradizionale è più appropriata, è quella la risposta giusta.

${contesto}

**LE 8 FAMIGLIE TECNOLOGICHE CHE DEVI SAPER DISTINGUERE** (spiegale se il partecipante chiede cosa significano; non scegliere tu quale sia la più adatta, lo dice il calcolo)
${technologyCatalogText()}

**RISPOSTE GIÀ RACCOLTE IN QUESTA CONVERSAZIONE**
${raccolte}
${notaGiaNota}
**COSA ESTRARRE DA QUESTO MESSAGGIO**
${daEstrarre}

**COSA CHIEDERE SUBITO DOPO, NELLA STESSA RISPOSTA**
${daChiedere}
${risultato}

**COME CONDUCI**
- Una sola domanda alla volta: quella in "COSA CHIEDERE SUBITO DOPO". Non anticipare altre domande, non tornare su argomenti già coperti in "RISPOSTE GIÀ RACCOLTE".
- Se in "COSA ESTRARRE DA QUESTO MESSAGGIO" c'è una dimensione da estrarre e il messaggio del partecipante è davvero troppo ambiguo per ricavarla con sicurezza (caso diverso da "non lo so", che va gestito come sopra), NON procedere comunque a "COSA CHIEDERE SUBITO DOPO": fai invece una domanda di chiarimento mirata su quella stessa dimensione, altrimenti quell'informazione andrebbe persa.
- Non ripetere mai una domanda a cui il partecipante ha già risposto chiaramente, e non chiederne conferma — salvo che la nuova risposta contraddica esplicitamente una precedente, sia realmente ambigua, o la conferma sia indispensabile per una decisione importante del flusso (es. subito prima di dare il risultato finale).
- Prima di una domanda nuova, se non è ovvia spiega in 1 riga perché te la stai chiedendo, con parole semplici e senza gergo tecnico; se usi un termine tecnico spiegalo brevemente.
- Non fingere di avere informazioni che il partecipante non ha dato: se qualcosa non è chiaro, dillo esplicitamente invece di presumerlo.
- Se il partecipante esprime incertezza con parole diverse da "non lo so" (es. "boh", "non ne sono sicuro", "difficile da dire", "mah", "non saprei"), trattalo esattamente come "non lo so": vedi sopra "IL PARTECIPANTE NON SA RISPONDERE" se presente, altrimenti applica lo stesso principio.
- Quando il risultato è già calcolato, presentalo con le sue motivazioni in modo semplice, e se manca qualcosa di indispensabile per confermarlo dillo chiaramente (es. "la tecnologia più probabile è X, ma prima di confermarla va verificato Y").
- Resta sempre nel perimetro di questo assessment: fattibilità tecnologica del caso. Se il partecipante chiede altro, rispondi in una riga che qui trattate solo questo e riporta la conversazione alla domanda aperta.
- Nessun testo superfluo tra una domanda e l'altra: conversazione naturale, breve, progressiva.

**FORMATO DELLA RISPOSTA**
Rispondi SEMPRE e SOLO con un oggetto JSON valido con queste chiavi:
{
  "reply": "il messaggio per il partecipante, in italiano, con il tu, massimo 3-4 righe: breve, semplice, una sola domanda",
  "answer": { "dimension": "chiave-dimensione", "value": "valore-opzione" | ["valore1","valore2"], "unknown": true|false }
}
- Valorizza "answer" SOLO se in "COSA ESTRARRE DA QUESTO MESSAGGIO" c'è una dimensione da estrarre E riesci a ricavarla con sicurezza da questo messaggio; altrimenti ometti del tutto la chiave "answer" (non inventare, non forzare un valore incerto).
- "value" deve usare ESATTAMENTE uno dei valori ammessi elencati sopra per quella dimensione (non le etichette).
- Se il partecipante non sa rispondere, imposta "unknown": true e "value": "${UNKNOWN_VALUE}".
- Non usare mai in "answer" una dimensione diversa da quella indicata in "COSA ESTRARRE DA QUESTO MESSAGGIO".
- Nessun testo fuori dal JSON, nessun markdown.

**REGOLE ASSOLUTE**
- Italiano, "tu", tono amichevole e concreto, parole semplici: mai gergo tecnico non spiegato (niente "vuoi un LLM?", "supervised o unsupervised?", "quale modello?").
- Una sola domanda per turno.
- Non inventare opzioni diverse da quelle elencate qui sopra, e non elencarle di nuovo per esteso in "reply": sono già selezionabili nell'interfaccia.
- Non decidere tu la tecnologia consigliata: la calcola il sistema, tu la commenti.`;
}
