// Dati di test e di esempio usati dal pulsante "test" presente in alto in ogni
// pagina. Servono a percorrere il tool senza compilare tutto a mano (prove,
// demo, verifica del deploy): stanno qui, in un unico punto, e non in mezzo ai
// componenti, così restano coerenti fra gli step — lo Step 2 lavora sulle
// candidate dello Step 1 e la scheda Use Case racconta la stessa attività.

import { BLOCK2_INTERVIEW_GROUPS } from "@/config/block2Form";
import { Block2FieldValue, Step1Answer, Step1Submission, Step2Submission } from "./types";
import { candidateAttive } from "./frizioneScoring";
import { CARATTERISTICHE, DOMANDE, DOMANDA_CRITERI_TACITI } from "@/config/block1Frizione";
import { nowMs } from "./time";

export const TEST_PARTICIPANT_NAME = "Mario Rossi (test)";
export const TEST_FACILITATOR_NAME = "Facilitatore di test";

/** Le attività segnalate con un sì: una per blocco, con impatto decrescente. */
const TEST_SI: Record<number, { nome: string; impatto: number }> = {
  1: { nome: "Registrazione fatture fornitori nell'ERP", impatto: 8.5 },
  6: { nome: "Riconciliazione ordini/bolle/fatture", impatto: 7 },
  13: { nome: "Offerte commerciali su template", impatto: 6.5 },
  19: { nome: "Check di conformità sui documenti di gara", impatto: 5 },
};

/** Step 1 di esempio: tutte le 21 domande risposte, quattro sì con impatto. */
export function testStep1Submission(): Step1Submission {
  const risposte: Record<string, Step1Answer> = {};
  for (const domanda of DOMANDE) {
    const si = TEST_SI[domanda.id];
    if (si) {
      risposte[String(domanda.id)] = { risposta: "si", nome: si.nome, impatto: si.impatto };
      continue;
    }
    // La domanda spia resta un sì: serve a vedere anche la nota sui criteri taciti.
    risposte[String(domanda.id)] =
      domanda.id === DOMANDA_CRITERI_TACITI ? { risposta: "si" } : { risposta: "no" };
  }
  return { risposte, criteriTaciti: true, updatedAt: nowMs() };
}

/**
 * Step 2 di esempio: un valore per candidata, scelto in base al tipo di scala
 * (sul blocco "sposti" l'ottimo è al centro, sugli altri più alto è meglio),
 * così l'esito dello Step 3 risulta leggibile e non tutto in un quadrante.
 */
export function testStep2Submission(step1: Step1Submission): Step2Submission {
  const valori: Record<string, number> = {};
  for (const candidata of candidateAttive(step1)) {
    valori[String(candidata.domandaId)] =
      CARATTERISTICHE[candidata.blocco].tipo === "campana" ? 5 : 8;
  }
  return { valori, updatedAt: nowMs() };
}

/** Scheda Use Case di esempio, coerente con la candidata più impattante. */
export const TEST_USE_CASE_VALUES: Record<string, Block2FieldValue> = {
  problema:
    "Le fatture fornitore arrivano via email in PDF con layout diversi e vengono registrate a mano nell'ERP: due persone dell'amministrazione ricopiano intestazione, righe e centro di costo. Il ciclo di registrazione impiega in media 3 giorni, gli errori di imputazione vengono scoperti a fine mese e obbligano a note di credito e riaperture di periodo.",
  soluzione:
    "Un sistema che legge il PDF, estrae i campi (fornitore, numero, data, righe, IVA, centro di costo) e propone la registrazione precompilata nell'ERP, che l'addetto conferma o corregge. Le fatture riconosciute con confidenza alta passano in automatico, le altre restano in coda di verifica.",
  obiettivi: ["riduzioneTempi", "diminuzioneErrori", "liberareRisorse"],
  obiettiviAltro: "",
  datiNecessari:
    "PDF delle fatture degli ultimi 24 mesi, anagrafica fornitori, piano dei conti e centri di costo, storico delle registrazioni già validate come riferimento.",
  datiDove:
    "PDF nella casella condivisa dell'amministrazione e nel gestionale documentale; anagrafiche e registrazioni nell'ERP (SQL Server on premise, accessibile con viste dedicate).",
  datiVolume: "Circa 1.400 fatture al mese, 17.000 all'anno, con 6 righe medie per fattura.",
  datiQualita: "media",
  datiEtichettati: "parzialmente",
  impattoTipo: "diretto",
  beneficioPrimario: "tempo",
  stimaBeneficio:
    "Circa 2 ore al giorno di data entry risparmiate su 2 persone, stimate 900 ore/anno; ciclo di registrazione da 3 giorni a 1. Stima da confermare con un mese di misurazione.",
  utentiImpattati: "Circa 8 persone: 2 addetti alla registrazione, 4 responsabili di reparto, 2 in controllo di gestione",
  confidenzaStima: "media",
  frequenzaUso: "piuVolteGiorno",
  baseline:
    "Oggi: 3 giorni medi di attraversamento, circa il 6% di registrazioni corrette a posteriori, 2 FTE dedicati per metà del loro tempo.",
  metricaPrimaria:
    "Tempo medio di registrazione di una fattura da 3 giorni a 1 giorno entro il pilota, senza peggiorare la percentuale di errori (oggi 6%).",
  eticaDecisioni: "no",
  eticaCategorie: ["dipendenti"],
  eticaInformate: "si",
  eticaRevisione: "si",
  complessita: "media",
  datiSensibili:
    "No dati particolari: solo dati aziendali e di fornitori, con i nominativi dei referenti commerciali.",
  compliance: "Sì — GDPR per i dati dei referenti; conservazione sostitutiva a norma per i documenti fiscali.",
  dipendenze:
    "Dipende dal modulo di integrazione dell'ERP (upgrade previsto nel prossimo trimestre) e dalla casella email condivisa.",
  resistenze:
    "Gli addetti all'amministrazione, per timore che il controllo sulle registrazioni si sposti su di loro senza tempo per farlo; il responsabile IT per il carico di integrazione.",
  sostenitori:
    "Il controllo di gestione, che oggi aspetta la chiusura per avere i dati, e il responsabile amministrativo.",
  azioniResistenza:
    "Pilota su un solo fornitore ad alto volume con revisione umana sempre attiva, formazione di mezza giornata e obiettivo dichiarato di eliminare il data entry, non le persone.",
};

/** Tutti gli argomenti dell'intervista: la scheda di test parte già completa. */
export const TEST_CLOSED_GROUPS: string[] = BLOCK2_INTERVIEW_GROUPS.map((g) => g.key);
