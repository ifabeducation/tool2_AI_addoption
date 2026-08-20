// Motore di calcolo del Blocco 1. Nessuno stato: prende le risposte degli step
// 1 e 2 e produce l'esito. Vive qui (e non nei componenti) perché la stessa
// valutazione serve al partecipante nello Step 3 e al facilitatore in dashboard,
// e non devono poter divergere.

import {
  BLOCCHI,
  CARATTERISTICHE,
  DOMANDA_CRITERI_TACITI,
  KnockoutKey,
  NOTA_CRITERI_TACITI,
  NUMERO_CANDIDATE,
  domandaById,
  nomeSuggerito,
} from "@/config/block1Frizione";
import { FrizioneBlocco, Step1Submission, Step2Submission } from "./types";

export type Candidata = {
  domandaId: number;
  blocco: FrizioneBlocco;
  nome: string;
  impatto: number;
};

export type Esito = Candidata & {
  /** Valore della caratteristica dello Step 2 (1-10). */
  valore: number;
  /** 0-10: quanto le condizioni sono pronte (campana sul blocco "sposti"). */
  prontezza: number;
  /** Impatto × prontezza, 0-100. */
  punteggio: number;
  /** Caso limite riconosciuto: cambia la lettura della posizione, non il punteggio. */
  knockout?: KnockoutKey;
  motivazione: string;
  notaCriteriTaciti?: string;
  colore: string;
};

/** Nome mostrato per una candidata: quello scritto dal partecipante o il suggerito. */
export function nomeCandidata(domandaId: number, nome?: string): string {
  const scritto = nome?.trim();
  return scritto || nomeSuggerito(domandaId);
}

/**
 * Candidate ordinate per impatto decrescente; a parità vince quella dichiarata
 * prima (id di domanda più basso). La domanda spia sui criteri taciti non
 * concorre mai: è un segnale negativo, non un'opportunità.
 */
export function candidateOrdinate(step1?: Step1Submission): Candidata[] {
  const risposte = step1?.risposte ?? {};

  return Object.entries(risposte)
    .map(([id, answer]) => ({ id: Number(id), answer }))
    .filter(
      ({ id, answer }) =>
        id !== DOMANDA_CRITERI_TACITI &&
        answer?.risposta === "si" &&
        typeof answer.impatto === "number"
    )
    .map(({ id, answer }) => {
      const domanda = domandaById(id);
      return {
        domandaId: id,
        blocco: (domanda?.blocco ?? "sposti") as FrizioneBlocco,
        nome: nomeCandidata(id, answer.nome),
        impatto: answer.impatto as number,
      };
    })
    .sort((a, b) => b.impatto - a.impatto || a.domandaId - b.domandaId);
}

/** Le (massimo) tre candidate dello Step 2: quelle congelate, o le prime per impatto. */
export function candidateAttive(step1?: Step1Submission, step2?: Step2Submission): Candidata[] {
  const ordinate = candidateOrdinate(step1);
  const congelate = step2?.candidate;
  if (congelate?.length) {
    return congelate
      .map((id) => ordinate.find((c) => c.domandaId === id))
      .filter((c): c is Candidata => Boolean(c));
  }
  return ordinate.slice(0, NUMERO_CANDIDATE);
}

/**
 * Prontezza 0-10. Per il blocco "sposti" la curva è a campana: l'ottimo è al
 * centro (5,5), perché formati sempre identici non richiedono AI e formati
 * sempre diversi non sono ancora automatizzabili in modo affidabile.
 */
export function prontezzaDa(blocco: FrizioneBlocco, valore: number): number {
  if (blocco === "sposti") return Math.max(0, 10 - Math.abs(valore - 5.5) * 2);
  return valore;
}

/** Knockout valutati nell'ordine previsto: il primo che scatta vince. */
function knockoutDa(blocco: FrizioneBlocco, valore: number): KnockoutKey | undefined {
  if (blocco === "sposti" && valore <= 2) return "rpa";
  if (blocco === "sposti" && valore >= 9) return "interpretativa";
  if (blocco !== "sposti" && valore <= 3) return "readiness";
  return undefined;
}

/** Riga di motivazione: spiega la posizione nella matrice, non il calcolo. */
function motivazioneDa(
  blocco: FrizioneBlocco,
  impatto: number,
  prontezza: number,
  knockout: KnockoutKey | undefined,
  criteriTaciti: boolean
): string {
  const impattoAlto = impatto >= 6;
  const prontezzaAlta = prontezza >= 6;

  if (knockout === "rpa") {
    return `Impatto ${impattoAlto ? "elevato" : "contenuto"}, ma il formato è già costante: qui il guadagno arriva dall'automazione classica, non dall'AI.`;
  }
  if (knockout === "interpretativa") {
    return `Impatto ${impattoAlto ? "elevato" : "contenuto"} con input ogni volta diversi: automatizzabile solo con una persona che valida ogni caso.`;
  }
  if (knockout === "readiness") {
    const cosa =
      blocco === "controlli"
        ? "i dati sono ancora sparsi e poco storicizzati"
        : blocco === "scrivi"
          ? "mancano template e fonti interne su cui appoggiarsi"
          : "i criteri di decisione non sono formalizzati";
    return `Impatto ${impattoAlto ? "elevato" : "contenuto"}, ma ${cosa}: prima le fondamenta, poi l'automazione.`;
  }

  if (impattoAlto && prontezzaAlta) {
    return "Impatto elevato e condizioni già pronte: è la candidata su cui partire.";
  }
  if (impattoAlto && !prontezzaAlta) {
    return criteriTaciti
      ? "Impatto elevato, ma i criteri decisionali non sono documentati: va formalizzato prima."
      : "Impatto elevato, ma le condizioni sono ancora parziali: serve un intervento preparatorio.";
  }
  if (!impattoAlto && prontezzaAlta) {
    return "Condizioni pronte, però pesa poco sul processo: intervento facile ma di beneficio limitato.";
  }
  return "Impatto contenuto e condizioni parziali: non è qui che conviene iniziare.";
}

/** Valuta una candidata di cui è noto il valore della caratteristica. */
export function valutaCandidata(candidata: Candidata, valore: number, criteriTaciti: boolean): Esito {
  const prontezza = prontezzaDa(candidata.blocco, valore);
  const knockout = knockoutDa(candidata.blocco, valore);

  return {
    ...candidata,
    valore,
    prontezza,
    punteggio: candidata.impatto * prontezza,
    knockout,
    motivazione: motivazioneDa(candidata.blocco, candidata.impatto, prontezza, knockout, criteriTaciti),
    notaCriteriTaciti: criteriTaciti ? NOTA_CRITERI_TACITI : undefined,
    colore: BLOCCHI[candidata.blocco].colore,
  };
}

/** Esiti delle candidate con valore compilato, in ordine di punteggio decrescente. */
export function calcolaEsiti(step1?: Step1Submission, step2?: Step2Submission): Esito[] {
  const criteriTaciti = Boolean(step1?.criteriTaciti);
  const valori = step2?.valori ?? {};

  return candidateAttive(step1, step2)
    .filter((c) => typeof valori[String(c.domandaId)] === "number")
    .map((c) => valutaCandidata(c, valori[String(c.domandaId)], criteriTaciti))
    .sort((a, b) => b.punteggio - a.punteggio || a.domandaId - b.domandaId);
}

/** Etichetta della caratteristica chiesta nello Step 2 per un blocco. */
export function etichettaCaratteristica(blocco: FrizioneBlocco): string {
  return CARATTERISTICHE[blocco].etichetta;
}
