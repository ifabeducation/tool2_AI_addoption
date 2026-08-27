import { PriorityDimension } from "@/lib/types";

/** Una delle 5 alternative selezionabili per una dimensione: numero + livello sintetico + descrizione. */
export type ScoreOption = {
  score: 1 | 2 | 3 | 4 | 5;
  /** Livello sintetico già completo di nome dimensione (es. "Impatto strategico"): si mostra così com'è, senza concatenazioni. */
  label: string;
  description: string;
};

export type PriorityLevel = "high" | "medium" | "low";
export type PriorityQuadrant = "quickWin" | "strategicBet" | "fillIn" | "moneyPit";

/** Driver di complessità dell'Effort, diversi per GenAI e per ML: mostrati come helper secondario, non nella descrizione principale. */
export type EffortHelperGroup = { label: string; factors: string[] };

export type PriorityDimensionConfig = {
  label: string;
  description: string;
  /** "Più alto è il valore, maggiore è..." — chiarisce la polarità della scala senza ambiguità. */
  polarityNote: string;
  criteria: ScoreOption[];
  /** Fattori secondari da considerare, mostrati come helper text (non tooltip). */
  helperTitle?: string;
  helperFactors?: string[];
  /** Solo per Effort: i fattori cambiano a seconda del tipo di tecnologia. */
  helperByTech?: EffortHelperGroup[];
};

export const PRIORITY_DIMENSIONS: Record<PriorityDimension, PriorityDimensionConfig> = {
  impact: {
    label: "Impact",
    description:
      "Valore per il business. Misura quanto lo use case può migliorare o trasformare attività, processi o funzioni dell'organizzazione.",
    polarityNote: "Più alto è il valore, maggiore è il beneficio generato.",
    criteria: [
      { score: 1, label: "Impatto minimo", description: "Nice-to-have, beneficio marginale." },
      { score: 2, label: "Impatto limitato", description: "Beneficio locale a un singolo team o attività." },
      { score: 3, label: "Impatto moderato", description: "Ottimizza un processo esistente, con beneficio apprezzabile su un'area circoscritta." },
      { score: 4, label: "Impatto significativo", description: "Migliora un processo importante, con beneficio rilevante su più team o funzioni." },
      { score: 5, label: "Impatto strategico", description: "Trasforma un processo core, con beneficio ampio e trasversale a tutta l'organizzazione." },
    ],
    helperTitle: "Fattori da considerare",
    helperFactors: ["Frequenza d'uso", "Scalabilità ad altre unità", "Allineamento strategico"],
  },
  effort: {
    label: "Effort",
    description:
      "Complessità necessaria per realizzare lo use case, considerando dati, sviluppo, integrazioni, competenze e tempo necessario per arrivare a un MVP.",
    polarityNote: "Più alto è il valore, maggiore è l'effort.",
    criteria: [
      { score: 1, label: "Effort minimo", description: "Dati pronti, soluzione chiara, MVP realizzabile in 1–2 settimane, nessuna integrazione complessa." },
      { score: 2, label: "Effort basso", description: "Preparazione dati limitata, pattern esistente applicabile, MVP in 2–4 settimane." },
      { score: 3, label: "Effort moderato", description: "Data engineering necessario, soluzione da validare, MVP in 4–8 settimane." },
      { score: 4, label: "Effort alto", description: "Problemi di qualità dei dati, domain expertise critico, MVP in 8–12 settimane." },
      { score: 5, label: "Effort massimo", description: "Nuove sorgenti dati, ricerca necessaria, dipendenze multiple, più di 12 settimane per MVP." },
    ],
    helperTitle: "Cosa influenza l'Effort",
    helperByTech: [
      {
        label: "Per GenAI",
        factors: [
          "Complessità del prompt engineering",
          "Quantità di contesto",
          "Numero di fonti",
          "Integrazione con workflow esistenti",
          "Necessità di personalizzazione/fine-tuning",
        ],
      },
      {
        label: "Per ML",
        factors: [
          "Pulizia dei dati",
          "Feature engineering",
          "Labeling",
          "Complessità del modello",
          "Batch vs real-time",
          "Explainability",
        ],
      },
    ],
  },
  risk: {
    label: "Risk",
    description:
      "Rischio complessivo associato allo use case: dati, sicurezza, fattibilità tecnica, impatto sul business, compliance, normativa ed aspetti etici.",
    polarityNote: "Più alto è il valore, maggiore è il rischio.",
    criteria: [
      { score: 1, label: "Rischio minimo", description: "Nessun dato sensibile, nessuna decisione critica, compliance standard, rollback facile." },
      { score: 2, label: "Rischio basso", description: "Dati interni standard, decisioni riviste da un umano, compliance chiara." },
      { score: 3, label: "Rischio moderato", description: "Alcuni dati sensibili, decisioni semi-automatizzate, compliance review necessaria." },
      { score: 4, label: "Rischio alto", description: "Dati PII o finanziari, decisioni automatizzate che impattano persone, approvazione normativa necessaria." },
      { score: 5, label: "Rischio massimo", description: "Dati altamente sensibili, decisioni critiche automatizzate, incertezza legale o regolatoria." },
    ],
    helperTitle: "Dimensioni da considerare",
    helperFactors: ["Rischio dati/privacy/GDPR", "Rischio tecnico", "Rischio business", "Rischio normativo", "Rischio etico"],
  },
  reuse: {
    label: "Reuse",
    description:
      "Potenziale di riutilizzo della soluzione, dei componenti tecnologici, dei dati, dell'architettura o dei learning per altri use case.",
    polarityNote: "Più alto è il valore, maggiore è il potenziale di riuso.",
    criteria: [
      { score: 1, label: "Riutilizzo nullo", description: "Completamente custom, nessun elemento riutilizzabile." },
      { score: 2, label: "Riutilizzo limitato", description: "Caso specifico, pochi elementi trasferibili." },
      { score: 3, label: "Riutilizzo moderato", description: "Learning trasferibili, possibile adattamento a 1–2 use case simili." },
      { score: 4, label: "Riutilizzo alto", description: "Applicabile a 3–5 use case simili, alcuni componenti riutilizzabili." },
      { score: 5, label: "Riutilizzo massimo", description: "Crea pattern o infrastruttura riutilizzabile per più di 5 use case futuri, applicabile a più unità." },
    ],
  },
};

export const PRIORITY_FORMULA = {
  impactWeight: 2,
  offset: 7,
  min: 0,
  max: 20,
} as const;

export const PRIORITY_LEVELS: Record<
  PriorityLevel,
  { label: string; min: number; action: string; color: string }
> = {
  high: {
    label: "Alta",
    min: 15,
    action: "Fast-track: approvazione immediata e avvio MVP entro 2 settimane dal meeting AI Board.",
    color: "#059669",
  },
  medium: {
    label: "Media",
    min: 8,
    action: "Review standard: approvazione AI Board e inserimento nel backlog del trimestre corrente.",
    color: "#d97706",
  },
  low: {
    label: "Bassa",
    min: 0,
    action: "Backlog: rivalutare nella review trimestrale.",
    color: "#64748b",
  },
};

export const PRIORITY_QUADRANTS: Record<
  PriorityQuadrant,
  { label: string; strategy: string; color: string }
> = {
  quickWin: { label: "Quick Win", strategy: "Fare subito: costruisce credibilità nei primi mesi.", color: "#059669" },
  strategicBet: { label: "Strategic Bet", strategy: "Pianificare con risorse dedicate e orizzonte esplicito.", color: "#2563eb" },
  fillIn: { label: "Fill-in", strategy: "Fare solo se c'è capacità disponibile.", color: "#d97706" },
  moneyPit: { label: "Money Pit", strategy: "Evitare: l'effort non è giustificato dal valore atteso.", color: "#dc2626" },
};

export const HIGH_IMPACT_MIN = 4;
export const LOW_EFFORT_MAX = 2;
/** Risk = 5 (rischio massimo) attiva il veto: 1 è rischio minimo, non ha alcun significato di blocco. */
export const RISK_VETO_SCORE = 5;
export const ETHICAL_REVIEW_RISK_THRESHOLD = 3;
