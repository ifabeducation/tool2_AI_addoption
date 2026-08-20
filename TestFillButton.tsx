"use client";

import Link from "next/link";
import { FlaskConical } from "lucide-react";

/**
 * Pulsante "test", presente in alto in ogni pagina del tool: riempie i campi
 * della pagina con dati di esempio (vedi `lib/testData.ts`). Serve alle prove e
 * alle demo, non al workshop: resta piccolo e discreto, e il titolo dice sempre
 * che cosa compila in quella pagina specifica.
 */
export default function TestFillButton({
  onClick,
  href,
  title,
  tone = "light",
  disabled,
}: {
  onClick?: () => void;
  /** Alternativa a onClick per le pagine senza campi: porta dove i dati servono. */
  href?: string;
  title: string;
  tone?: "light" | "dark";
  disabled?: boolean;
}) {
  const className = `flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
    tone === "dark"
      ? "border-white/25 text-white/70 hover:border-white/60 hover:text-white"
      : "border-dashed border-ifab-border text-ifab-text-muted hover:border-ifab-blue hover:text-ifab-blue"
  } ${disabled ? "cursor-not-allowed opacity-50" : ""}`;

  if (href) {
    return (
      <Link href={href} title={title} className={className}>
        <FlaskConical size={13} /> test
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className={className}>
      <FlaskConical size={13} /> test
    </button>
  );
}
