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
 * Modello dell'assistente di selezione tecnologica (Step 5): interviste brevi
 * a domande guidate con estrazione JSON, senza bisogno di ragionamento
 * complesso. gpt-5-mini offre un buon equilibrio qualità/costo per questo
 * compito — non tocca CHAT_MODEL, usato anche dai consigli di priorità e
 * dagli assistenti legacy, per non cambiarne il comportamento.
 */
export const TECH_SELECTOR_MODEL = "gpt-5-mini";
