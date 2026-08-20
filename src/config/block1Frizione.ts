// Configurazione del Blocco 1 — "Scheda di attrito"
// Step 1: 21 domande sì/no con slider di impatto sui sì.
// Step 2: una caratteristica per candidata, decisa dal blocco della domanda.
// Step 3: esito calcolato (vedi lib/frizioneScoring.ts).
// Tutto il contenuto testuale sta qui: domande, ancoraggi, tecnologie, messaggi.

import { FrizioneBlocco } from "@/lib/types";

export type BloccoConfig = {
  key: FrizioneBlocco;
  label: string;
  /** Colore del blocco: usato da Step 2/3 e dalla matrice, non nello Step 1. */
  colore: string;
};

/**
 * I blocchi non vengono mostrati nello Step 1 (le domande sono un elenco unico):
 * servono a decidere quale caratteristica chiedere nello Step 2 e quale
 * tecnologia proporre nello Step 3.
 */
export const BLOCCHI: Record<FrizioneBlocco, BloccoConfig> = {
  sposti: { key: "sposti", label: "Quello che sposti", colore: "#d97706" },
  controlli: { key: "controlli", label: "Quello che controlli", colore: "#059669" },
  scrivi: { key: "scrivi", label: "Quello che scrivi", colore: "#1b98e0" },
  decidi: { key: "decidi", label: "Quello che decidi", colore: "#db2777" },
};

export type DomandaFrizione = {
  id: number;
  blocco: FrizioneBlocco;
  testo: string;
  /** Attività di riferimento (mappatura interna, non mostrata nello Step 1). */
  attivita: string[];
};

export const DOMANDE: DomandaFrizione[] = [
  { id: 1, blocco: "sposti", testo: "Leggi un dato in un sistema e lo riscrivi in un altro?", attivita: ["ricopiature", "inserimento dati"] },
  { id: 2, blocco: "sposti", testo: "Ricevi documenti dello stesso tipo con formati o layout diversi?", attivita: ["ricopiature", "inserimento dati", "classificazioni"] },
  { id: 3, blocco: "sposti", testo: "Assegni categorie o codici decidendo in pochi secondi?", attivita: ["classificazioni", "triage e smistamento"] },
  { id: 4, blocco: "sposti", testo: "Compili campi il cui valore è già scritto altrove?", attivita: ["inserimento dati", "ricopiature"] },
  { id: 5, blocco: "controlli", testo: "Riguardi periodicamente gli stessi numeri per verificare che nulla sia cambiato?", attivita: ["controlli ricorrenti", "individuazione di anomalie"] },
  { id: 6, blocco: "controlli", testo: "Confronti due fonti diverse per controllare se coincidono?", attivita: ["riconciliazioni", "controlli ricorrenti"] },
  { id: 7, blocco: "controlli", testo: "Ti è capitato di accorgerti tardi di uno scostamento già visibile nei dati?", attivita: ["individuazione di anomalie", "previsioni"] },
  { id: 8, blocco: "controlli", testo: "Produci report con la stessa struttura a intervalli regolari?", attivita: ["reportistica ricorrente", "controlli ricorrenti"] },
  { id: 9, blocco: "controlli", testo: "Rispondi “a naso” a domande per cui il dato esisterebbe?", attivita: ["previsioni", "correlazioni"] },
  { id: 10, blocco: "controlli", testo: "Raggruppi clienti, pratiche o fornitori basandoti sull'esperienza più che su criteri scritti?", attivita: ["segmentazioni", "correlazioni", "classificazioni"] },
  { id: 11, blocco: "scrivi", testo: "Parti dalla versione precedente di un documento e ne cambi una parte?", attivita: ["offerte", "produzione testi", "verbali"] },
  { id: 12, blocco: "scrivi", testo: "Riscrivi lo stesso contenuto per destinatari o lingue diverse?", attivita: ["traduzioni", "produzione testi", "sintesi"] },
  { id: 13, blocco: "scrivi", testo: "Esiste un template o un format di riferimento per quello che produci?", attivita: ["offerte", "verbali", "reportistica ricorrente", "produzione testi"] },
  { id: 14, blocco: "scrivi", testo: "Per scrivere vai a cercare informazioni in documenti interni esistenti?", attivita: ["offerte", "sintesi", "produzione testi"] },
  { id: 15, blocco: "scrivi", testo: "Prendi appunti in riunione o sopralluogo e li riscrivi dopo in forma ordinata?", attivita: ["verbali", "produzione testi"] },
  { id: 16, blocco: "scrivi", testo: "Leggi documenti lunghi per estrarne i punti utili a qualcun altro?", attivita: ["sintesi", "produzione testi"] },
  { id: 17, blocco: "decidi", testo: "Concedi autorizzazioni che non hai praticamente mai negato?", attivita: ["approvazioni con soglie prestabilite"] },
  { id: 18, blocco: "decidi", testo: "Capisci a chi inoltrare una richiesta leggendo solo l'oggetto?", attivita: ["triage e smistamento", "classificazioni"] },
  { id: 19, blocco: "decidi", testo: "Verifichi la presenza di elementi obbligatori seguendo una lista?", attivita: ["controlli di conformità", "controlli ricorrenti"] },
  { id: 20, blocco: "decidi", testo: "Applichi soglie o priorità che sapresti scrivere su un foglio?", attivita: ["attribuzioni di priorità", "approvazioni con soglie"] },
  { id: 21, blocco: "decidi", testo: "Le eccezioni le gestisci con criteri non documentati?", attivita: ["attribuzioni di priorità", "controlli di conformità", "approvazioni con soglie"] },
];

/**
 * Domanda "spia": un sì è un segnale negativo. Non apre lo slider di impatto e
 * non concorre alla selezione delle candidate; alza soltanto il flag
 * criteriTaciti, che nello Step 3 declassa il livello di supervisione.
 */
export const DOMANDA_CRITERI_TACITI = 21;

export const TOTALE_DOMANDE = DOMANDE.length;

/** Oltre questa soglia di sì compare l'avviso non bloccante. */
export const SOGLIA_AVVISO_SI = 8;

/** Quante candidate passano allo Step 2. */
export const NUMERO_CANDIDATE = 3;

export function domandaById(id: number): DomandaFrizione | undefined {
  return DOMANDE.find((d) => d.id === id);
}

/** Nome proposto per una candidata quando il partecipante non ne scrive uno. */
export function nomeSuggerito(id: number): string {
  const attivita = domandaById(id)?.attivita[0] ?? "Attività";
  return attivita.charAt(0).toUpperCase() + attivita.slice(1);
}

// --- Step 1: testi dello slider di impatto -------------------------------

export const IMPATTO_LABEL = "Quanto pesa negativamente sul processo?";
export const IMPATTO_SOTTOTESTO =
  "Considera quanto spesso la svolgi, quanto tempo ti assorbe e cosa accade se è lenta o sbagliata.";

/** Valore di partenza della barra di impatto: il centro della scala. */
export const IMPATTO_DEFAULT = 5;

export const IMPATTO_ANCORAGGI: { valore: number; testo: string }[] = [
  { valore: 0, testo: "fastidio trascurabile" },
  { valore: 5, testo: "rallenta, ma si gestisce" },
  { valore: 10, testo: "collo di bottiglia riconosciuto da tutti" },
];

export const AVVISO_MOLTI_SI =
  "Hai segnalato molte attività. Nello step successivo lavoreremo solo sulle tre più impattanti.";
export const MESSAGGIO_NESSUN_SI =
  "Non hai segnalato nessuna attività: senza almeno un sì non ci sono candidate da approfondire. Rivedi le risposte: spesso l'attrito sta in gesti che diamo per scontati.";

// --- Step 2: una caratteristica per blocco -------------------------------

export type CaratteristicaSlider = {
  blocco: FrizioneBlocco;
  /** "campana": l'ottimo è al centro; "lineare": più alto è meglio. */
  tipo: "campana" | "lineare";
  etichetta: string;
  ancoraggi: { posizione: "min" | "centro" | "max"; testo: string }[];
};

export const CARATTERISTICHE: Record<FrizioneBlocco, CaratteristicaSlider> = {
  sposti: {
    blocco: "sposti",
    tipo: "campana",
    etichetta: "I documenti o i dati in ingresso arrivano sempre nello stesso formato?",
    ancoraggi: [
      { posizione: "min", testo: "1 — sempre identici" },
      { posizione: "centro", testo: "5-6 — stesso contenuto, forme diverse" },
      { posizione: "max", testo: "10 — ogni volta diversi" },
    ],
  },
  controlli: {
    blocco: "controlli",
    tipo: "lineare",
    etichetta: "Quanto sono accessibili e storicizzati i dati che alimentano questa attività?",
    ancoraggi: [
      { posizione: "min", testo: "1 — sparsi tra e-mail, PDF ed Excel, poca storia" },
      { posizione: "max", testo: "10 — database o API interrogabili, anni di storico" },
    ],
  },
  scrivi: {
    blocco: "scrivi",
    tipo: "lineare",
    etichetta: "Esistono template di riferimento e fonti interne da cui attingere?",
    ancoraggi: [
      { posizione: "min", testo: "1 — ogni volta da zero, nessuna fonte tracciabile" },
      { posizione: "max", testo: "10 — template consolidato e knowledge base consultabile" },
    ],
  },
  decidi: {
    blocco: "decidi",
    tipo: "lineare",
    etichetta: "Quanto sono espliciti e scritti i criteri con cui si decide?",
    ancoraggi: [
      { posizione: "min", testo: "1 — esperienza e giudizio personale" },
      { posizione: "max", testo: "10 — procedure, soglie e matrici formalizzate" },
    ],
  },
};

// --- Step 3: tecnologie, knockout, supervisione --------------------------

/**
 * Casi limite riconosciuti dal calcolo. Non producono più una raccomandazione
 * tecnologica a schermo: servono a differenziare la lettura della posizione,
 * in particolare i due estremi del blocco "sposti", che per effetto della
 * campana ottengono lo stesso punteggio pur significando cose opposte.
 */
export type KnockoutKey = "rpa" | "interpretativa" | "readiness";

export const NOTA_CRITERI_TACITI =
  "Hai dichiarato che le eccezioni si gestiscono con criteri non documentati. Prima di automatizzare la decisione, quei criteri vanno formalizzati.";

export const QUADRANTI = {
  altoDestra: "Candidato prioritario",
  altoSinistra: "Pronto ma poco rilevante",
  bassoDestra: "Rilevante, non ancora pronto",
  bassoSinistra: "Non prioritario",
} as const;

// --- Prompt degli assistenti --------------------------------------------

function supportAgentRules() {
  return `**REGOLE ASSOLUTE**
- Rispondi in italiano, con il "tu", tono amichevole e concreto.
- Risposte brevi: massimo 5-6 righe o 3-4 punti elenco. Una sola domanda di chiarimento alla volta.
- Non rispondere al posto del partecipante: è lui a conoscere il proprio lavoro.
- NON anticipare punteggi, classifiche, esiti o quale tecnologia verrà proposta: il calcolo arriva più avanti e mostrarlo prima falserebbe le risposte.`;
}

export function buildStep1SystemPrompt(): string {
  const elenco = DOMANDE.map((d) => `${d.id}. ${d.testo}`).join("\n");

  return `Sei un facilitatore esperto di adozione dell'AI. Un partecipante sta compilando una "scheda di attrito": 21 domande sì/no sulle frizioni del suo lavoro quotidiano. Per ogni sì indica anche quanto quell'attività pesa negativamente sul processo, da 1 a 10.

**LE DOMANDE**
${elenco}

**COSA FAI**
- Spieghi che cosa intende una domanda, con un esempio concreto di ufficio o di reparto.
- Aiuti a decidere fra sì e no quando il partecipante è incerto ("dipende"): fagli notare se il caso capita regolarmente o è un'eccezione rara.
- Aiuti a tarare l'impatto ricordando i tre riferimenti: 1 fastidio trascurabile, 5 rallenta ma si gestisce, 10 collo di bottiglia riconosciuto da tutti. L'impatto guarda frequenza, tempo assorbito e conseguenze quando l'attività è lenta o sbagliata.

${supportAgentRules()}`;
}

export function buildStep2SystemPrompt(candidateLabels: string[]): string {
  const candidate = candidateLabels.length > 0 ? candidateLabels.join(", ") : "non ancora individuate";
  const caratteristiche = Object.values(CARATTERISTICHE)
    .map((c) => `- ${BLOCCHI[c.blocco].label}: ${c.etichetta} (${c.ancoraggi.map((a) => a.testo).join(" · ")})`)
    .join("\n");

  return `Sei un facilitatore esperto di adozione dell'AI. Un partecipante sta descrivendo le caratteristiche delle attività che ha segnalato come più pesanti: ${candidate}. Per ciascuna c'è una sola domanda, con una barra da 1 a 10.

**LE CARATTERISTICHE POSSIBILI**
${caratteristiche}

**COSA FAI**
- Spieghi che cosa vuole sapere la domanda e che cosa distingue un valore basso da uno alto.
- Sulla costanza del formato, chiarisci che il centro della barra non è un "non so": descrive documenti con lo stesso contenuto ma forme diverse.
- Chiedi un esempio concreto quando la risposta resta generica, e aiuta a scegliere il valore che lo rappresenta meglio.

${supportAgentRules()}`;
}

export const INITIAL_MESSAGE_STEP1 =
  "Ciao! Rispondi di pancia: sì se ti capita regolarmente, no se è un'eccezione. Se una domanda non ti è chiara o non sai come tarare l'impatto, chiedimelo pure.";

export const INITIAL_MESSAGE_STEP2 =
  "Qui c'è una sola domanda per attività. Se non sai dove posizionare la barra, raccontami un caso tipico e ragioniamo insieme su quale valore lo descrive meglio.";
