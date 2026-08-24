// Configurazione dell'assistente "Selettore Tecnologia AI" — Step 5.
// Ricalca "Workshop2_Strumento Selezione Tecnologia IA": la Matrice di
// Selezione Tecnologica (tecnologia × categoria di processo × obiettivi
// strategici) e il Selettore Interattivo a 3 step (categoria → obiettivi →
// tecnologia idonea). Il partecipante parla con l'assistente — a voce o
// scrivendo — PRIMA di scrivere le proprie considerazioni finali sul caso.
//
// Il confronto tra obiettivi scelti e matrice lo calcola sempre il codice
// (vedi matchTechnologies): il modello spiega e fa domande, non inventa né
// ricalcola il risultato, come già avviene per lo scoring di priorità.

export type ProcessCategoryKey = "organizzativi" | "operativi" | "decisionali";

export const PROCESS_CATEGORY_KEYS: ProcessCategoryKey[] = ["organizzativi", "operativi", "decisionali"];

export const PROCESS_CATEGORIES: Record<ProcessCategoryKey, { label: string; description: string }> = {
  organizzativi: {
    label: "Processi organizzativi",
    description:
      "Gestione interna, comunicazione e conoscenza dell'organizzazione: non l'esecuzione operativa quotidiana né le decisioni di vertice. Esempi: catalogare documenti, organizzare una knowledge base, automatizzare pratiche amministrative.",
  },
  operativi: {
    label: "Processi operativi",
    description:
      "Esecuzione quotidiana di un servizio o attività, spesso ripetuta e a contatto con clienti o dati operativi. Esempi: segmentare i clienti, prevedere la domanda, generare documentazione, estrarre e inserire dati.",
  },
  decisionali: {
    label: "Processi decisionali",
    description:
      "Supporto o presa di decisioni: valutare rischi e opportunità, pianificare, scegliere tra alternative. Esempi: stimare impatti finanziari, definire priorità di investimento, confrontare scenari.",
  },
};

export type StrategicObjectiveKey =
  | "riduzioneTempi"
  | "diminuzioneErrori"
  | "liberareRisorse"
  | "personalizzazione"
  | "qualitaServizio"
  | "capacitaAnalitiche"
  | "riduzioneCosti";

export const STRATEGIC_OBJECTIVE_KEYS: StrategicObjectiveKey[] = [
  "riduzioneTempi",
  "diminuzioneErrori",
  "liberareRisorse",
  "personalizzazione",
  "qualitaServizio",
  "capacitaAnalitiche",
  "riduzioneCosti",
];

export const STRATEGIC_OBJECTIVES: Record<StrategicObjectiveKey, { label: string; hint: string }> = {
  riduzioneTempi: { label: "Riduzione tempi di esecuzione", hint: "si ottiene lo stesso risultato in meno tempo." },
  diminuzioneErrori: { label: "Diminuzione errori", hint: "meno sbagli e rilavorazioni, maggiore precisione." },
  liberareRisorse: {
    label: "Liberare risorse umane",
    hint: "le persone si dedicano ad attività a maggior valore aggiunto.",
  },
  personalizzazione: { label: "Personalizzazione servizi", hint: "l'offerta si adatta al singolo cliente o caso." },
  qualitaServizio: {
    label: "Miglioramento qualità servizio",
    hint: "il risultato percepito da chi riceve il servizio migliora.",
  },
  capacitaAnalitiche: {
    label: "Capacità analitiche avanzate",
    hint: "si ottengono analisi, pattern o previsioni non disponibili oggi.",
  },
  riduzioneCosti: { label: "Riduzione costi operativi", hint: "si spende meno per ottenere lo stesso risultato." },
};

export type AiTechnologyKey =
  | "mlClassificazione"
  | "mlRegressione"
  | "mlClustering"
  | "mlRaccomandazioni"
  | "genAiContent"
  | "rpa"
  | "supportoDecisionale"
  | "aiAgent";

/** Caso d'uso di riferimento per una tecnologia in una categoria; `null` se la matrice la segna non applicabile. */
export type TechCategoryEntry = { useCase: string; objectives: StrategicObjectiveKey[] } | null;

export type AiTechnology = {
  key: AiTechnologyKey;
  label: string;
  /** Spiegazione generale, indipendente dalla categoria: usata dall'assistente per rispondere a "che cos'è". */
  description: string;
  perCategory: Record<ProcessCategoryKey, TechCategoryEntry>;
};

export const AI_TECHNOLOGIES: AiTechnology[] = [
  {
    key: "mlClassificazione",
    label: "ML - Classificazione",
    description: "Assegna automaticamente un'etichetta o una categoria a un elemento (es. documenti, clienti, richieste).",
    perCategory: {
      organizzativi: { useCase: "Categorizzazione automatica documenti", objectives: ["riduzioneTempi", "diminuzioneErrori", "liberareRisorse"] },
      operativi: { useCase: "Segmentazione clienti", objectives: ["personalizzazione", "qualitaServizio", "capacitaAnalitiche"] },
      decisionali: { useCase: "Valutazione rischio/opportunità", objectives: ["capacitaAnalitiche", "diminuzioneErrori", "riduzioneCosti"] },
    },
  },
  {
    key: "mlRegressione",
    label: "ML - Regressione",
    description: "Stima un valore numerico futuro o mancante a partire da dati storici (es. previsioni, stime di impatto).",
    perCategory: {
      organizzativi: null,
      operativi: { useCase: "Forecasting domanda servizi", objectives: ["riduzioneCosti", "qualitaServizio", "capacitaAnalitiche"] },
      decisionali: { useCase: "Stima impatti finanziari", objectives: ["capacitaAnalitiche", "riduzioneCosti", "diminuzioneErrori"] },
    },
  },
  {
    key: "mlClustering",
    label: "ML - Clustering",
    description: "Raggruppa elementi simili tra loro senza categorie predefinite, utile per scoprire pattern nascosti.",
    perCategory: {
      organizzativi: { useCase: "Organizzazione knowledge base", objectives: ["riduzioneTempi", "qualitaServizio", "capacitaAnalitiche"] },
      operativi: { useCase: "Segmentazione associate", objectives: ["personalizzazione", "qualitaServizio", "capacitaAnalitiche"] },
      decisionali: { useCase: "Identificazione pattern/comportamenti ripetuti", objectives: ["capacitaAnalitiche", "qualitaServizio", "personalizzazione"] },
    },
  },
  {
    key: "mlRaccomandazioni",
    label: "ML - Raccomandazioni",
    description: "Suggerisce il contenuto, prodotto o azione più adatta a una persona o caso specifico.",
    perCategory: {
      organizzativi: null,
      operativi: { useCase: "Personalizzazione servizi", objectives: ["personalizzazione", "qualitaServizio", "riduzioneCosti"] },
      decisionali: { useCase: "Prioritizzazione investimenti", objectives: ["capacitaAnalitiche", "riduzioneCosti", "qualitaServizio"] },
    },
  },
  {
    key: "genAiContent",
    label: "GenAI - Content Creation",
    description: "Genera testi, documenti o contenuti nuovi a partire da istruzioni o dati.",
    perCategory: {
      organizzativi: { useCase: "Redazione comunicazioni interne", objectives: ["riduzioneTempi", "liberareRisorse", "qualitaServizio"] },
      operativi: { useCase: "Generazione documentazione", objectives: ["riduzioneTempi", "diminuzioneErrori", "liberareRisorse"] },
      decisionali: { useCase: "Sviluppo scenari simulativi", objectives: ["capacitaAnalitiche", "diminuzioneErrori", "qualitaServizio"] },
    },
  },
  {
    key: "rpa",
    label: "RPA",
    description: 'Automatizza in modo meccanico compiti ripetitivi su sistemi esistenti, senza "capire" il contenuto.',
    perCategory: {
      organizzativi: { useCase: "Automazione processi amministrativi", objectives: ["riduzioneTempi", "diminuzioneErrori", "liberareRisorse"] },
      operativi: { useCase: "Estrazione e inserimento dati", objectives: ["riduzioneTempi", "diminuzioneErrori", "riduzioneCosti"] },
      decisionali: { useCase: "Compilazione reportistica automatica", objectives: ["riduzioneTempi", "diminuzioneErrori", "liberareRisorse"] },
    },
  },
  {
    key: "supportoDecisionale",
    label: "Supporto Decisionale",
    description: "Cruscotti, simulazioni e ottimizzazioni che aiutano una persona a decidere meglio, senza decidere al posto suo.",
    perCategory: {
      organizzativi: { useCase: "Cruscotti direzionali e monitoraggio KPI", objectives: ["capacitaAnalitiche", "riduzioneTempi", "riduzioneCosti"] },
      operativi: { useCase: "Ottimizzazione pianificazione e allocazione risorse", objectives: ["riduzioneCosti", "qualitaServizio", "capacitaAnalitiche"] },
      decisionali: { useCase: "Analisi what-if e comparazione alternative decisionali", objectives: ["capacitaAnalitiche", "diminuzioneErrori", "riduzioneCosti"] },
    },
  },
  {
    key: "aiAgent",
    label: "AI Agent",
    description: "Sistema autonomo che monitora, agisce e supporta un processo in modo continuativo, con più iniziativa delle altre tecnologie.",
    perCategory: {
      organizzativi: { useCase: "Assistenza operativa autonoma", objectives: ["liberareRisorse", "riduzioneTempi", "diminuzioneErrori"] },
      operativi: { useCase: "Monitoraggio continuo processi", objectives: ["diminuzioneErrori", "qualitaServizio", "liberareRisorse"] },
      decisionali: { useCase: "Supporto decisionale contestuale", objectives: ["capacitaAnalitiche", "diminuzioneErrori", "riduzioneTempi"] },
    },
  },
];

// --- Interviste: due argomenti, come il Blocco 2 ---------------------------

export type TechSelectorGroupKey = "categoria" | "obiettivi";

export type TechSelectorGroup = { key: TechSelectorGroupKey; titolo: string; domanda: string; fields: string[] };

export const TECH_SELECTOR_GROUPS: TechSelectorGroup[] = [
  {
    key: "categoria",
    titolo: "Categoria di processo",
    domanda:
      "Di che tipo di processo si tratta? Scegli quello che descrive meglio il caso: Organizzativi (gestione interna, es. catalogare documenti), Operativi (esecuzione quotidiana di un servizio, es. segmentare clienti) oppure Decisionali (supporto a una decisione, es. valutare rischi).",
    fields: ["categoria"],
  },
  {
    key: "obiettivi",
    titolo: "Obiettivi strategici",
    domanda:
      "Quali obiettivi contano di più per questo caso? Puoi indicarne anche più di uno tra: riduzione dei tempi di esecuzione, diminuzione degli errori, liberare risorse umane, personalizzazione dei servizi, miglioramento della qualità del servizio, capacità analitiche avanzate, riduzione dei costi operativi.",
    fields: ["obiettivi"],
  },
];

export const TECH_SELECTOR_GROUP_COUNT = TECH_SELECTOR_GROUPS.length;

/** Argomenti non ancora chiusi dall'agente, nell'ordine previsto (stesso pattern del Blocco 2). */
export function remainingTechSelectorGroups(closedGroups?: string[]): TechSelectorGroup[] {
  const closed = new Set(closedGroups ?? []);
  return TECH_SELECTOR_GROUPS.filter((g) => !closed.has(g.key));
}

/** Tiene solo chiavi di argomento esistenti (l'agente potrebbe inventarne). */
export function sanitizeTechSelectorClosedGroups(raw: unknown, previous?: string[]): string[] {
  const known = new Set(TECH_SELECTOR_GROUPS.map((g) => g.key));
  const fromModel = Array.isArray(raw) ? raw.filter((k): k is string => typeof k === "string") : [];
  const merged = [...(previous ?? []), ...fromModel].filter((k) => known.has(k));
  return TECH_SELECTOR_GROUPS.map((g) => g.key).filter((k) => merged.includes(k));
}

export type TechSelectorFields = { categoria?: ProcessCategoryKey; obiettivi?: StrategicObjectiveKey[] };

/** Ripulisce l'estrazione del modello: scarta categorie/obiettivi non previsti dalla matrice. */
export function sanitizeTechSelectorFields(raw: unknown): TechSelectorFields {
  const out: TechSelectorFields = {};
  if (!raw || typeof raw !== "object") return out;
  const record = raw as Record<string, unknown>;

  const categoriaRaw = record.categoria;
  if (typeof categoriaRaw === "string") {
    const t = categoriaRaw.trim().toLowerCase();
    const match = PROCESS_CATEGORY_KEYS.find((k) => k === t || PROCESS_CATEGORIES[k].label.toLowerCase() === t);
    if (match) out.categoria = match;
  }

  const obiettiviRaw = record.obiettivi;
  if (Array.isArray(obiettiviRaw)) {
    const list = obiettiviRaw
      .filter((v): v is string => typeof v === "string")
      .map((v) => {
        const t = v.trim().toLowerCase();
        return STRATEGIC_OBJECTIVE_KEYS.find((k) => k.toLowerCase() === t || STRATEGIC_OBJECTIVES[k].label.toLowerCase() === t);
      })
      .filter((v): v is StrategicObjectiveKey => Boolean(v));
    if (list.length > 0) out.obiettivi = Array.from(new Set(list));
  }

  return out;
}

// --- Calcolo deterministico (non affidato al modello) -----------------------

export type TechMatchEntry = {
  key: AiTechnologyKey;
  label: string;
  useCase: string;
  objectiveLabels: string[];
  overlap: number;
  /** Tra le tecnologie applicabili alla categoria, quelle col punteggio più alto (se > 0). */
  consigliata: boolean;
};

export type TechMatchResult = {
  categoriaLabel: string;
  obiettiviLabels: string[];
  /** Solo le tecnologie applicabili alla categoria scelta, ordinate per punteggio decrescente. */
  entries: TechMatchEntry[];
  maxOverlap: number;
};

/** Incrocia categoria e obiettivi scelti con la Matrice di Selezione Tecnologica. */
export function matchTechnologies(categoria: ProcessCategoryKey, obiettivi: StrategicObjectiveKey[]): TechMatchResult {
  const selected = new Set(obiettivi);
  const entries: TechMatchEntry[] = AI_TECHNOLOGIES.flatMap((tech) => {
    const entry = tech.perCategory[categoria];
    if (!entry) return [];
    const overlap = entry.objectives.filter((o) => selected.has(o)).length;
    return [
      {
        key: tech.key,
        label: tech.label,
        useCase: entry.useCase,
        objectiveLabels: entry.objectives.map((o) => STRATEGIC_OBJECTIVES[o].label),
        overlap,
        consigliata: false,
      },
    ];
  });

  const maxOverlap = entries.reduce((max, e) => Math.max(max, e.overlap), 0);
  const sorted = [...entries].sort((a, b) => b.overlap - a.overlap);

  return {
    categoriaLabel: PROCESS_CATEGORIES[categoria].label,
    obiettiviLabels: obiettivi.map((o) => STRATEGIC_OBJECTIVES[o].label),
    entries: sorted.map((e) => ({ ...e, consigliata: maxOverlap > 0 && e.overlap === maxOverlap })),
    maxOverlap,
  };
}

// --- Prompt dell'assistente --------------------------------------------

export const INITIAL_MESSAGE_TECH_SELECTOR =
  "Ciao! Prima di scrivere le tue considerazioni finali, ti aiuto a capire quale ambito tecnologico e quale tipo di intelligenza artificiale si adatta meglio al tuo caso, seguendo la Matrice di Selezione Tecnologica del workshop. Ti faccio due domande — sul tipo di processo e sugli obiettivi che contano di più — poi guardiamo insieme il risultato. Puoi rispondere scrivendo o a voce col microfono.\n\n" +
  TECH_SELECTOR_GROUPS[0].domanda;

function formatTechMatch(match: TechMatchResult): string {
  const righe = match.entries
    .map(
      (e) =>
        `- ${e.label} (caso d'uso: ${e.useCase}): ${e.overlap}/${match.obiettiviLabels.length} obiettivi in comune${
          e.consigliata ? " — CONSIGLIATA" : ""
        }`
    )
    .join("\n");
  return `Categoria scelta: ${match.categoriaLabel}\nObiettivi scelti: ${match.obiettiviLabels.join(", ")}\nRisultato già calcolato dal sistema (NON ricalcolarlo, NON contraddirlo):\n${righe}`;
}

/**
 * System prompt dell'assistente. Stesso schema JSON del Blocco 2 (reply +
 * fields + closed): il modello spiega e chiede, il server decide quali
 * argomenti restano aperti e calcola il risultato con `matchTechnologies`.
 */
export function buildTechSelectorSystemPrompt(ctx: {
  useCaseSummary?: string;
  remainingGroups: TechSelectorGroup[];
  match: TechMatchResult | null;
}): string {
  const contesto = ctx.useCaseSummary
    ? `Il caso d'uso di riferimento, dal Blocco 2: ${ctx.useCaseSummary}`
    : "Non hai una descrizione dettagliata del caso: fai domande generiche, restando sul processo che il partecipante descrive.";

  const daCoprire =
    ctx.remainingGroups.length > 0
      ? ctx.remainingGroups.map((g, i) => `${i + 1}. [${g.key}] ${g.titolo}\n   Domanda suggerita: ${g.domanda}`).join("\n")
      : "Nessuno: hai già categoria e obiettivi. Il risultato è qui sotto: commentalo in poche righe, rispondi alle domande del partecipante e invitalo a dirti cosa ne pensa — servirà come base delle sue considerazioni finali.";

  const risultato = ctx.match ? `\n**RISULTATO GIÀ CALCOLATO**\n${formatTechMatch(ctx.match)}\n` : "";

  return `Sei un facilitatore esperto di adozione dell'AI in azienda. Un partecipante del workshop sta cercando di capire, prima di scrivere le proprie considerazioni finali sul caso, quale ambito tecnologico e quale tipo di intelligenza artificiale si adatta meglio, seguendo la "Matrice di Selezione Tecnologica" del workshop.

${contesto}

**LE 3 CATEGORIE DI PROCESSO**
${PROCESS_CATEGORY_KEYS.map((k) => `- ${PROCESS_CATEGORIES[k].label}: ${PROCESS_CATEGORIES[k].description}`).join("\n")}

**I 7 OBIETTIVI STRATEGICI**
${STRATEGIC_OBJECTIVE_KEYS.map((k) => `- ${STRATEGIC_OBJECTIVES[k].label}: ${STRATEGIC_OBJECTIVES[k].hint}`).join("\n")}

**LE TECNOLOGIE AI POSSIBILI** (spiegale se il partecipante chiede che cos'è una di queste; non dire tu quale sia la più adatta, lo dice il calcolo qui sotto)
${AI_TECHNOLOGIES.map((t) => `- ${t.label}: ${t.description}`).join("\n")}

**ARGOMENTI ANCORA DA COPRIRE**
${daCoprire}
${risultato}

**COME CONDUCI**
- Una domanda alla volta, sul primo argomento ancora da coprire; spiega sempre brevemente le opzioni prima di chiedere (categorie o obiettivi), con un esempio pratico.
- Se il partecipante chiede di capire meglio una categoria, un obiettivo o una tecnologia, spiegaglielo con parole semplici e un esempio concreto prima di procedere.
- Quando il risultato è già calcolato, presentalo in una o due frasi, rispondi a eventuali domande e invita il partecipante a dirti cosa ne pensa.
- Non inventare tecnologie, obiettivi o categorie diverse da quelle elencate sopra. Non calcolare né modificare tu il risultato: è già calcolato dal sistema.

**FORMATO DELLA RISPOSTA**
Rispondi SEMPRE e SOLO con un oggetto JSON valido con queste chiavi:
{
  "reply": "il messaggio per il partecipante, in italiano, con il tu, massimo 4-5 righe",
  "fields": { "categoria": "organizzativi" | "operativi" | "decisionali", "obiettivi": ["chiave1", "chiave2"] },
  "closed": ["chiave-argomento-appena-chiuso"]
}
- Chiavi valide per "categoria": ${PROCESS_CATEGORY_KEYS.join(", ")}.
- Chiavi valide per "obiettivi": ${STRATEGIC_OBJECTIVE_KEYS.join(", ")}.
- Ometti "fields" o le sue chiavi se non hai ancora l'informazione. "closed" solo per gli argomenti appena conclusi.
- Nessun testo fuori dal JSON, nessun markdown.

**REGOLE ASSOLUTE**
- Italiano, "tu", tono amichevole e concreto.
- Non decidere tu la tecnologia consigliata: la mostra il sistema, tu la commenti.`;
}
