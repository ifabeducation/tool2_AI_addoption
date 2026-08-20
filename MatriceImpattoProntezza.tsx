"use client";

import { QUADRANTI } from "@/config/block1Frizione";
import { Esito } from "@/lib/frizioneScoring";

const W = 520;
const H = 420;
const PAD = { top: 28, right: 24, bottom: 46, left: 56 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const x = (impatto: number) => PAD.left + (impatto / 10) * PLOT_W;
const y = (prontezza: number) => PAD.top + (1 - prontezza / 10) * PLOT_H;

/**
 * Matrice Impatto × Prontezza in SVG inline: quattro quadranti nominati e le
 * candidate posizionate come punti etichettati. Niente librerie di grafici:
 * la figura è statica e deve restare leggibile anche nell'export PDF.
 */
export default function MatriceImpattoProntezza({ esiti }: { esiti: Esito[] }) {
  const quadranti = [
    { testo: QUADRANTI.altoSinistra, cx: x(2.5), cy: y(7.5) },
    { testo: QUADRANTI.altoDestra, cx: x(7.5), cy: y(7.5) },
    { testo: QUADRANTI.bassoSinistra, cx: x(2.5), cy: y(2.5) },
    { testo: QUADRANTI.bassoDestra, cx: x(7.5), cy: y(2.5) },
  ];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Matrice impatto per prontezza delle attività candidate"
      className="h-auto w-full"
    >
      <rect
        x={PAD.left}
        y={PAD.top}
        width={PLOT_W}
        height={PLOT_H}
        fill="#ffffff"
        stroke="var(--ifab-border)"
      />

      {/* Quadrante in alto a destra: è quello che conta, resta evidenziato */}
      <rect x={x(5)} y={y(10)} width={PLOT_W / 2} height={PLOT_H / 2} fill="#1b98e0" fillOpacity={0.06} />

      <line x1={x(5)} y1={PAD.top} x2={x(5)} y2={PAD.top + PLOT_H} stroke="var(--ifab-border)" strokeDasharray="4 4" />
      <line x1={PAD.left} y1={y(5)} x2={PAD.left + PLOT_W} y2={y(5)} stroke="var(--ifab-border)" strokeDasharray="4 4" />

      {quadranti.map((q) => (
        <text
          key={q.testo}
          x={q.cx}
          y={q.cy}
          textAnchor="middle"
          fontSize={11}
          fill="#8a8a8a"
          fontStyle="italic"
        >
          {q.testo}
        </text>
      ))}

      {/* Assi */}
      {[0, 5, 10].map((v) => (
        <text key={`xt-${v}`} x={x(v)} y={PAD.top + PLOT_H + 16} textAnchor="middle" fontSize={10} fill="#8a8a8a">
          {v}
        </text>
      ))}
      {[0, 5, 10].map((v) => (
        <text key={`yt-${v}`} x={PAD.left - 10} y={y(v) + 3} textAnchor="end" fontSize={10} fill="#8a8a8a">
          {v}
        </text>
      ))}
      <text x={PAD.left + PLOT_W / 2} y={H - 10} textAnchor="middle" fontSize={11} fill="#292929">
        Impatto
      </text>
      <text
        x={-(PAD.top + PLOT_H / 2)}
        y={16}
        textAnchor="middle"
        fontSize={11}
        fill="#292929"
        transform="rotate(-90)"
      >
        Prontezza
      </text>

      {esiti.map((e) => {
        const cx = x(e.impatto);
        const cy = y(e.prontezza);
        const aDestra = e.impatto > 6.5;
        return (
          <g key={e.domandaId}>
            <circle cx={cx} cy={cy} r={7} fill={e.colore} fillOpacity={0.85} stroke="#ffffff" strokeWidth={2} />
            <text
              x={aDestra ? cx - 12 : cx + 12}
              y={cy + 4}
              textAnchor={aDestra ? "end" : "start"}
              fontSize={11}
              fontWeight={600}
              fill="#292929"
            >
              {e.nome}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
