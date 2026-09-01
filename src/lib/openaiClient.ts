import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY non configurata in .env.local");
  }
  client = new OpenAI({ apiKey });
  return client;
}

export const CHAT_MODEL = "gpt-4o-mini";

/**
 * Modello del chatbot (Technology Feasibility Assessment, Step 5): l'unica
 * conversazione IA multi-turno realmente raggiungibile dall'interfaccia.
 * Override possibile via env var CHATBOT_MODEL, senza toccare il codice;
 * default "gpt-5.4-mini" — variante "mini" della stessa famiglia di gpt-5,
 * quindi più veloce e più economica a parità di generazione (compito
 * conversazionale a domande guidate con estrazione JSON, non ragionamento
 * pesante) mantenendo structured_outputs, streaming e la stessa finestra di
 * contesto di gpt-5. Non tocca CHAT_MODEL, usato dai consigli di priorità
 * (una singola chiamata non conversazionale) e dagli assistenti legacy
 * Step 1/2/4 (non più raggiungibili): ruoli diversi, non richiedono lo
 * stesso modello del chatbot.
 */
export const CHATBOT_MODEL = process.env.CHATBOT_MODEL || "gpt-5.4-mini";
