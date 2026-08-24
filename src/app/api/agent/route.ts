import { NextResponse } from "next/server";
import { getOpenAI, CHAT_MODEL } from "@/lib/openaiClient";
import { buildStep1SystemPrompt, buildStep2SystemPrompt } from "@/config/block1Frizione";
import {
  BLOCK2_FIELDS,
  buildUseCaseInterviewSystemPrompt,
  isBlock2ValueFilled,
  remainingInterviewGroups,
  sanitizeClosedGroups,
  sanitizeInterviewFields,
} from "@/config/block2Form";
import {
  buildTechSelectorSystemPrompt,
  matchTechnologies,
  ProcessCategoryKey,
  remainingTechSelectorGroups,
  sanitizeTechSelectorClosedGroups,
  sanitizeTechSelectorFields,
  StrategicObjectiveKey,
} from "@/config/techSelector";
import { Block2FieldValue } from "@/lib/types";

type AgentContext = {
  /** Step 1 e 2: attività selezionate dal partecipante. */
  selectedActivityLabels?: string[];
  /** Step 4: attività emersa dal Blocco 1, stato della scheda e dell'intervista. */
  processoContext?: string;
  values?: Record<string, Block2FieldValue>;
  closedGroups?: string[];
  /** Step 5: assistente di selezione tecnologica, prima della considerazione finale. */
  useCaseSummary?: string;
  techValues?: { categoria?: ProcessCategoryKey; obiettivi?: StrategicObjectiveKey[] };
  techClosedGroups?: string[];
};

/**
 * Gli assistenti del Blocco 1 sono di supporto: spiegano e chiariscono, non
 * conducono un'intervista. Quello dello Step 4 invece la conduce, e la sua
 * risposta è JSON (testo + campi estratti + argomenti chiusi): per questo il
 * ramo `useCaseInterview` è gestito a parte.
 */
function supportPromptFor(subsection: string, context: AgentContext): string | null {
  switch (subsection) {
    case "step1":
      return buildStep1SystemPrompt();
    case "step2":
      return buildStep2SystemPrompt(context.selectedActivityLabels ?? []);
    default:
      return null;
  }
}

type ChatTurn = { role: "user" | "assistant"; content: string };

function normalizeMessages(messages: unknown): ChatTurn[] {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m): m is ChatTurn => Boolean(m) && typeof (m as ChatTurn).content === "string")
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
}

/**
 * Intervista dello Step 4. Gli argomenti ancora aperti li decide il server dai
 * `closedGroups` accumulati, non il modello: così l'avanzamento (e quindi il
 * passaggio alla scheda) non dipende da quanto il modello ricorda della
 * conversazione. Anche `done` è calcolato qui.
 */
async function runUseCaseInterview(messages: ChatTurn[], context: AgentContext) {
  const values = context.values ?? {};
  const closedBefore = sanitizeClosedGroups(context.closedGroups);
  const remaining = remainingInterviewGroups(closedBefore);

  const systemPrompt = buildUseCaseInterviewSystemPrompt({
    processoContext: context.processoContext ?? "",
    remainingGroups: remaining,
    compiledFieldIds: BLOCK2_FIELDS.filter((f) => isBlock2ValueFilled(values[f.id])).map((f) => f.id),
  });

  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    temperature: 0.5,
    response_format: { type: "json_object" },
  });

  const raw = (response.choices[0]?.message?.content ?? "").trim();
  let parsed: { reply?: unknown; fields?: unknown; closed?: unknown } = {};
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    // Il modello ha risposto in chiaro invece che in JSON: si salva almeno il
    // testo, l'estrazione riparte al turno successivo.
    parsed = { reply: raw };
  }

  const reply = typeof parsed.reply === "string" && parsed.reply.trim() ? parsed.reply.trim() : raw;
  const fields = sanitizeInterviewFields(parsed.fields);
  const closedGroups = sanitizeClosedGroups(parsed.closed, closedBefore);
  const remainingAfter = remainingInterviewGroups(closedGroups);

  return NextResponse.json({
    reply,
    fields,
    closedGroups,
    remaining: remainingAfter.map((g) => g.key),
    done: remainingAfter.length === 0,
    finished: false,
  });
}

/**
 * Assistente dello Step 5 che precede la considerazione finale: due domande
 * (categoria di processo, obiettivi strategici) per ricavare, con la Matrice
 * di Selezione Tecnologica del workshop, quale tecnologia AI si adatta
 * meglio al caso. Il confronto tra obiettivi e matrice lo calcola il server
 * (vedi matchTechnologies): il modello spiega e chiede, non inventa né
 * ricalcola il risultato — stesso principio di generatePriorityAdvice.
 */
async function runTechSelectorInterview(messages: ChatTurn[], context: AgentContext) {
  const techValues = context.techValues ?? {};
  const closedBefore = sanitizeTechSelectorClosedGroups(context.techClosedGroups);
  const remaining = remainingTechSelectorGroups(closedBefore);

  const priorMatch =
    techValues.categoria && techValues.obiettivi && techValues.obiettivi.length > 0
      ? matchTechnologies(techValues.categoria, techValues.obiettivi)
      : null;

  const systemPrompt = buildTechSelectorSystemPrompt({
    useCaseSummary: context.useCaseSummary ?? "",
    remainingGroups: remaining,
    match: priorMatch,
  });

  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    temperature: 0.5,
    response_format: { type: "json_object" },
  });

  const raw = (response.choices[0]?.message?.content ?? "").trim();
  let parsed: { reply?: unknown; fields?: unknown; closed?: unknown } = {};
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    parsed = { reply: raw };
  }

  const reply = typeof parsed.reply === "string" && parsed.reply.trim() ? parsed.reply.trim() : raw;
  const fields = sanitizeTechSelectorFields(parsed.fields);
  const closedGroups = sanitizeTechSelectorClosedGroups(parsed.closed, closedBefore);
  const remainingAfter = remainingTechSelectorGroups(closedGroups);

  const mergedCategoria = fields.categoria ?? techValues.categoria;
  const mergedObiettivi = fields.obiettivi ?? techValues.obiettivi;
  const match =
    mergedCategoria && mergedObiettivi && mergedObiettivi.length > 0
      ? matchTechnologies(mergedCategoria, mergedObiettivi)
      : null;

  return NextResponse.json({
    reply,
    fields,
    closedGroups,
    remaining: remainingAfter.map((g) => g.key),
    done: remainingAfter.length === 0,
    match,
    finished: false,
  });
}

export async function POST(req: Request) {
  try {
    const { subsection, messages, context } = await req.json();

    if (!subsection || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
    }

    const turns = normalizeMessages(messages);
    const ctx: AgentContext = context ?? {};

    if (subsection === "useCaseInterview") {
      return await runUseCaseInterview(turns, ctx);
    }

    if (subsection === "techSelector") {
      return await runTechSelectorInterview(turns, ctx);
    }

    const systemPrompt = supportPromptFor(subsection, ctx);
    if (!systemPrompt) {
      return NextResponse.json({ error: "subsection non valida" }, { status: 400 });
    }

    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [{ role: "system", content: systemPrompt }, ...turns],
      temperature: 0.6,
    });

    // Gli assistenti del Blocco 1 sono di supporto: non concludono step, quindi
    // `finished` resta sempre false (il campo è mantenuto per AgentChat).
    const reply = (response.choices[0]?.message?.content ?? "").trim();
    return NextResponse.json({ reply, finished: false });
  } catch (error) {
    console.error("Errore agente AI:", error);
    const message = error instanceof Error ? error.message : "Errore interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
