import { BLOCK2_FIELDS, sanitizeInterviewFields } from "@/config/block2Form";
import { getOpenAI, CHAT_MODEL } from "./openaiClient";
import { Block2FieldValue } from "./types";

export const MAX_USE_CASE_PDF_BYTES = 4 * 1024 * 1024;

function valueSchema(field: (typeof BLOCK2_FIELDS)[number]) {
  if (field.type === "checkbox") {
    return {
      type: "array",
      items: { type: "string", enum: field.options?.map((option) => option.value) ?? [] },
    };
  }
  if (field.type === "radio") {
    return {
      type: "string",
      enum: ["", ...(field.options?.map((option) => option.value) ?? [])],
    };
  }
  return { type: "string" };
}

const VALUE_PROPERTIES = Object.fromEntries(
  BLOCK2_FIELDS.map((field) => [field.id, valueSchema(field)])
);

const FIELD_CATALOG = BLOCK2_FIELDS.map((field) => {
  const options = field.options
    ? ` Valori ammessi: ${field.options.map((option) => `${option.value}=${option.label}`).join(", ")}.`
    : "";
  return `- ${field.id}: ${field.label}.${options}`;
}).join("\n");

/**
 * Estrae la scheda Use Case da un PDF precedente. Il documento non viene
 * persistito: Redis riceve solo i valori strutturati restituiti dal modello.
 */
export async function extractUseCaseFromPdf(input: {
  fileName: string;
  bytes: Uint8Array;
}): Promise<Record<string, Block2FieldValue>> {
  const base64 = Buffer.from(input.bytes).toString("base64");
  const response = await getOpenAI().responses.create({
    model: CHAT_MODEL,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_file",
            filename: input.fileName,
            file_data: `data:application/pdf;base64,${base64}`,
            detail: "low",
          },
          {
            type: "input_text",
            text: `Estrai dal PDF "Use Case Submission" i campi elencati sotto.
Non inventare informazioni: usa una stringa vuota o un array vuoto quando un dato non compare.
Per radio e checkbox restituisci esclusivamente i codici ammessi, ricavandoli dalle etichette leggibili nel PDF.

${FIELD_CATALOG}`,
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "use_case_pdf_import",
        strict: true,
        schema: {
          type: "object",
          properties: {
            values: {
              type: "object",
              properties: VALUE_PROPERTIES,
              required: BLOCK2_FIELDS.map((field) => field.id),
              additionalProperties: false,
            },
          },
          required: ["values"],
          additionalProperties: false,
        },
      },
    },
  });

  if (!response.output_text) {
    throw new Error("Il PDF non ha prodotto dati estraibili");
  }

  const parsed = JSON.parse(response.output_text) as { values?: unknown };
  return sanitizeInterviewFields(parsed.values);
}
