import { describe, expect, it } from "vitest";
import {
  applicableDimensions,
  ASSESSMENT_DIMENSIONS,
  dimensionAfter,
  dimensionByKey,
  FeasibilityAnswerMap,
  isAssessmentComplete,
  isUncertainText,
  matchOptionFromText,
  MAX_QUESTIONS,
  nextDimension,
  recommendTechnology,
  UNKNOWN_OPTION,
  UNKNOWN_VALUE,
} from "./techSelector";
import { CHATBOT_MODEL } from "@/lib/openaiClient";

const outputAtteso = dimensionByKey("outputAtteso")!;
const tipoDati = dimensionByKey("tipoDati")!;
const autonomia = dimensionByKey("autonomia")!;

describe("isUncertainText — riconoscimento semantico dell'incertezza", () => {
  it.each(["non so", "Non lo so", "non saprei", "Non ne sono sicuro", "non sono sicura", "boh", "Boh.", "mah", "difficile da dire"])(
    "riconosce '%s' come incertezza",
    (text) => {
      expect(isUncertainText(text)).toBe(true);
    }
  );

  it.each(["sì", "no", "operativi", "Assegnare una categoria a qualcosa", ""])(
    "non riconosce '%s' come incertezza",
    (text) => {
      expect(isUncertainText(text)).toBe(false);
    }
  );
});

describe("matchOptionFromText — Caso B (non so) e Caso D (opzioni = UI)", () => {
  it("riconosce il click sull'opzione 'non lo so' come risposta valida e informativa, non come errore", () => {
    const answer = matchOptionFromText(autonomia, UNKNOWN_OPTION.label);
    expect(answer).toEqual({ dimension: "autonomia", value: UNKNOWN_VALUE, unknown: true, source: "quickReply" });
  });

  it.each(["non so", "boh", "non ne sono sicuro"])("riconosce anche i sinonimi testuali di 'non so' ('%s')", (text) => {
    const answer = matchOptionFromText(autonomia, text);
    expect(answer?.unknown).toBe(true);
    expect(answer?.value).toBe(UNKNOWN_VALUE);
  });

  it("ogni opzione mostrata nella UI (etichetta) è riconosciuta esattamente: stessa source of truth", () => {
    for (const dimension of ASSESSMENT_DIMENSIONS) {
      for (const option of dimension.options) {
        const answer = matchOptionFromText(dimension, option.label);
        expect(answer, `opzione "${option.label}" di ${dimension.key} non riconosciuta`).not.toBeNull();
        if (!dimension.multiple) expect(answer?.value).toBe(option.value);
      }
    }
  });

  it("riconosce la scelta multipla come array di valori (tipoDati)", () => {
    const answer = matchOptionFromText(tipoDati, "Dati strutturati da ERP/CRM/database, Serie storiche numeriche");
    expect(answer?.value).toEqual(["erpCrm", "serieStoriche"]);
  });

  it("testo libero non riconducibile a nessuna opzione ritorna null (va interpretato dal modello)", () => {
    expect(matchOptionFromText(outputAtteso, "vorrei automatizzare la fatturazione ma non so bene come")).toBeNull();
  });
});

describe("nextDimension / dimensionAfter — percorso adattivo, mai la stessa domanda due volte", () => {
  it("parte sempre da outputAtteso quando non c'è ancora nessuna risposta", () => {
    expect(nextDimension({})?.key).toBe("outputAtteso");
  });

  it("una dimensione già risposta non viene mai riproposta (Caso A: niente ripetizioni)", () => {
    const answers: FeasibilityAnswerMap = { outputAtteso: { dimension: "outputAtteso", value: "categoria" } };
    const next = nextDimension(answers);
    expect(next?.key).not.toBe("outputAtteso");
  });

  it("groundTruth è rilevante solo per output categoria/numero, non per output generazione", () => {
    const perClassificazione: FeasibilityAnswerMap = {
      outputAtteso: { dimension: "outputAtteso", value: "categoria" },
      tipoDati: { dimension: "tipoDati", value: ["testiDocumenti"] },
      disponibilitaDati: { dimension: "disponibilitaDati", value: "disponibiliAccessibili" },
    };
    expect(applicableDimensions(perClassificazione).some((d) => d.key === "groundTruth")).toBe(true);

    const perGenerazione: FeasibilityAnswerMap = {
      outputAtteso: { dimension: "outputAtteso", value: "generazione" },
      tipoDati: { dimension: "tipoDati", value: ["testiDocumenti"] },
      disponibilitaDati: { dimension: "disponibilitaDati", value: "disponibiliAccessibili" },
    };
    expect(applicableDimensions(perGenerazione).some((d) => d.key === "groundTruth")).toBe(false);
  });

  it("dimensionAfter calcola la dimensione successiva senza dipendere dal valore di quella corrente", () => {
    const before: FeasibilityAnswerMap = { outputAtteso: { dimension: "outputAtteso", value: "categoria" } };
    const after = dimensionAfter(tipoDati, before);
    // Con qualunque valore ipotetico di tipoDati, il prossimo passo è sempre lo stesso (disponibilitaDati).
    expect(after?.key).toBe("disponibilitaDati");
  });

  it("non supera mai MAX_QUESTIONS domande", () => {
    const many: FeasibilityAnswerMap = {};
    for (const d of ASSESSMENT_DIMENSIONS.slice(0, MAX_QUESTIONS)) {
      many[d.key] = { dimension: d.key, value: "__test__" };
    }
    expect(nextDimension(many)).toBeNull();
  });
});

describe("isAssessmentComplete — si ferma prima se la confidenza è già alta", () => {
  it("non è mai completo con zero risposte", () => {
    expect(isAssessmentComplete({})).toBe(false);
  });

  it("è completo al raggiungimento di MAX_QUESTIONS anche a bassa confidenza", () => {
    const many: FeasibilityAnswerMap = {};
    for (const d of ASSESSMENT_DIMENSIONS.slice(0, MAX_QUESTIONS)) {
      many[d.key] = { dimension: d.key, value: "__test__" };
    }
    expect(isAssessmentComplete(many)).toBe(true);
  });
});

describe("recommendTechnology — motore deterministico, mai generico su GenAI/Agent", () => {
  it("segnali di classificazione forti (categoria + ground truth noto) portano a ML Classification", () => {
    const rec = recommendTechnology({
      outputAtteso: { dimension: "outputAtteso", value: "categoria" },
      groundTruth: { dimension: "groundTruth", value: "siConosciamo" },
      disponibilitaDati: { dimension: "disponibilitaDati", value: "disponibiliAccessibili" },
      tipoDati: { dimension: "tipoDati", value: ["erpCrm"] },
    });
    expect(rec?.primary.key).toBe("mlClassification");
    expect(rec?.primary.reasons.length).toBeGreaterThan(0);
  });

  it("AI Agent richiede insieme multi-step + esecuzione autonoma + integrazioni API, non basta un output multi-step da solo", () => {
    const soloMultiStep = recommendTechnology({
      outputAtteso: { dimension: "outputAtteso", value: "processoMultiStep" },
    });
    expect(soloMultiStep?.primary.key).not.toBe("aiAgent");

    const agentCompleto = recommendTechnology({
      outputAtteso: { dimension: "outputAtteso", value: "processoMultiStep" },
      autonomia: { dimension: "autonomia", value: "autonomoMultiStep" },
      integrazioni: { dimension: "integrazioni", value: "sistemiConApi" },
      regolarita: { dimension: "regolarita", value: "interpretazioneVariabile" },
    });
    expect(agentCompleto?.primary.key).toBe("aiAgent");
  });

  it("richiesta di forte validazione umana smorza il punteggio di AI Agent anche con output multi-step", () => {
    const conValidazioneUmana = recommendTechnology({
      outputAtteso: { dimension: "outputAtteso", value: "processoMultiStep" },
      autonomia: { dimension: "autonomia", value: "soloInformazioni" },
    });
    expect(conValidazioneUmana?.primary.key).not.toBe("aiAgent");
  });

  it("nessuna risposta ancora data (nemmeno l'output atteso) non produce una raccomandazione", () => {
    expect(recommendTechnology({})).toBeNull();
  });
});

describe("Caso E — modello del chatbot", () => {
  it("usa la famiglia gpt-5 (non gpt-4o o altre famiglie) come modello di default per il chatbot", () => {
    expect(CHATBOT_MODEL).toMatch(/^gpt-5/);
  });
});
