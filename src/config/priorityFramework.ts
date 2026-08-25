import { PriorityDimension } from "@/lib/types";

export type PriorityCriterion = {
  score: 1 | 2 | 3 | 4 | 5;
  label: string;
  description: string;
};

export type PriorityLevel = "high" | "medium" | "low";
export type PriorityQuadrant = "quickWin" | "strategicBet" | "fillIn" | "moneyPit";

export const PRIORITY_DIMENSIONS: Record<
  PriorityDimension,
  { label: string; description: string; criteria: PriorityCriterion[] }
> = {
  impact: {
    label: "Impact",
    description: "Valore generato per il business.",
    criteria: [
      { score: 1, label: "Minimo", description: "Nice-to-have, beneficio marginale." },
      { score: 2, label: "Limitato", description: "Beneficio locale a un singolo team o attività." },
      { score: 3, label: "Moderato", description: "Ottimizza un processo esistente, con beneficio apprezzabile su un'area circoscritta." },
      { score: 4, label: "Significativo", description: "Migliora un processo importante, con beneficio rilevante su più team o funzioni." },
      { score: 5, label: "Strategico", description: "Trasforma un processo core, con beneficio ampio e trasversale a tutta l'organizzazione." },
    ],
  },
  effort: {
    label: "Effort",
    description: "Complessità e tempo richiesti per realizzare l'MVP.",
    criteria: [
      { score: 1, label: "Minimo", description: "Dati pronti, nessuna integrazione complessa, MVP in 1–2 settimane." },
      { score: 2, label: "Basso", description: "Preparazione dati limitata, pattern noto, MVP in 2–4 settimane." },
      { score: 3, label: "Moderato", description: "Data engineering e validazione, MVP in 4–8 settimane." },
      { score: 4, label: "Alto", description: "Qualità dati critica o expertise specialistica, MVP in 8–12 settimane." },
      { score: 5, label: "Massimo", description: "Nuove fonti, ricerca o dipendenze multiple, MVP oltre 12 settimane." },
    ],
  },
  risk: {
    label: "Risk",
    description: "Rischio dati, tecnico, business, normativo ed etico.",
    criteria: [
      { score: 1, label: "Minimo", description: "Nessun dato sensibile, decisioni non critiche e rollback facile." },
      { score: 2, label: "Basso", description: "Dati interni standard, revisione umana e compliance chiara." },
      { score: 3, label: "Moderato", description: "Dati sensibili o decisioni semi-automatizzate; serve una review." },
      { score: 4, label: "Alto", description: "PII/finanziari o decisioni su persone; serve approvazione dedicata." },
      { score: 5, label: "Massimo", description: "Dati altamente sensibili, decisioni critiche o incertezza normativa." },
    ],
  },
  reuse: {
    label: "Reuse",
    description: "Potenziale di riuso di componenti, pattern e infrastruttura.",
    criteria: [
      { score: 1, label: "Nullo", description: "Soluzione completamente custom, senza elementi riutilizzabili." },
      { score: 2, label: "Limitato", description: "Caso specifico con pochi elementi trasferibili." },
      { score: 3, label: "Moderato", description: "Learning trasferibile a 1–2 casi d'uso simili." },
      { score: 4, label: "Alto", description: "Applicabile a 3–5 casi d'uso con componenti riutilizzabili." },
      { score: 5, label: "Massimo", description: "Pattern o infrastruttura per oltre 5 casi d'uso e più unità." },
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
export const RISK_VETO_SCORE = 5;
export const ETHICAL_REVIEW_RISK_THRESHOLD = 3;
