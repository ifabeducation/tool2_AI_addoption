import { NextResponse } from "next/server";
import { BLOCK2_INTERVIEW_GROUPS } from "@/config/block2Form";
import { extractUseCaseFromPdf, MAX_USE_CASE_PDF_BYTES } from "@/lib/pdfImport";
import {
  getParticipants,
  replaceBlock2,
  saveProgress,
  setUnlockedStep,
} from "@/lib/session";

export const maxDuration = 60;

function safeFileName(name: string): string {
  return name.replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 180) || "use-case.pdf";
}

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invia il PDF come multipart/form-data" }, { status: 400 });
  }
  const participantId = formData.get("participantId");
  const file = formData.get("file");

  if (typeof participantId !== "string" || !(file instanceof File)) {
    return NextResponse.json({ error: "Partecipante o PDF mancante" }, { status: 400 });
  }

  const participants = await getParticipants(code);
  if (!participants.some((participant) => participant.participantId === participantId)) {
    return NextResponse.json({ error: "Partecipante non registrato in questa sessione" }, { status: 403 });
  }

  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Carica un file in formato PDF" }, { status: 415 });
  }
  if (file.size === 0 || file.size > MAX_USE_CASE_PDF_BYTES) {
    return NextResponse.json({ error: "Il PDF deve avere una dimensione massima di 4 MB" }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
    return NextResponse.json({ error: "Il file selezionato non è un PDF valido" }, { status: 415 });
  }

  try {
    const values = await extractUseCaseFromPdf({ fileName: safeFileName(file.name), bytes });
    const extractedFieldCount = Object.keys(values).length;
    if (extractedFieldCount === 0) {
      return NextResponse.json(
        { error: "Il PDF non contiene una scheda Use Case riconoscibile" },
        { status: 422 }
      );
    }

    const now = Date.now();
    let submission = await replaceBlock2(code, participantId, {
      values,
      closedGroups: BLOCK2_INTERVIEW_GROUPS.map((group) => group.key),
      interviewDone: true,
      updatedAt: now,
      completedAt: now,
      sourcePdf: {
        fileName: safeFileName(file.name),
        importedAt: now,
        extractedFieldCount,
      },
    });
    submission = await saveProgress(code, participantId, { tab: "5", updatedAt: now });
    const meta = await setUnlockedStep(code, "priority", true);

    return NextResponse.json({ submission, meta, extractedFieldCount });
  } catch (error) {
    console.error("[import-pdf] estrazione non riuscita", {
      code,
      participantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Non è stato possibile leggere il PDF. Verifica che sia il PDF Use Case esportato dal workshop precedente." },
      { status: 502 }
    );
  }
}
