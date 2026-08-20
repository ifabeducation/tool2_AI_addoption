"use client";

import { PRIORITY_QUADRANTS } from "@/config/priorityFramework";
import { PriorityResult } from "@/lib/priorityScoring";
import { PriorityScores } from "@/lib/types";

export type PortfolioPoint = {
  id: string;
  label: string;
  scores: PriorityScores;
  result: PriorityResult;
};

const W = 640;
const H = 430;
const PAD = { top: 30, right: 26, bottom: 52, left: 62 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;
const x = (impact: number) => PAD.left + ((impact - 1) / 4) * plotW;
const y = (effort: number) => PAD.top + ((effort - 1) / 4) * plotH;

/** Matrice di portfolio: Impact cresce verso destra, Effort cresce verso il basso. */
export default function ImpactEffortMatrix({ points }: { points: PortfolioPoint[] }) {
  const quadrants = [
    { key: "fillIn", x: PAD.left + plotW * 0.22, y: PAD.top + 22 },
    { key: "quickWin", x: PAD.left + plotW * 0.76, y: PAD.top + 22 },
    { key: "moneyPit", x: PAD.left + plotW * 0.22, y: PAD.top + plotH - 12 },
    { key: "strategicBet", x: PAD.left + plotW * 0.76, y: PAD.top + plotH - 12 },
  ] as const;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label="Matrice Impact per Effort dei casi d'uso valutati"
    >
      <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} fill="#fff" stroke="#e5e5e5" />
      <rect x={x(3.5)} y={PAD.top} width={x(5) - x(3.5)} height={y(2.5) - PAD.top} fill="#059669" opacity="0.08" />
      <line x1={x(3.5)} x2={x(3.5)} y1={PAD.top} y2={PAD.top + plotH} stroke="#cbd5e1" strokeDasharray="5 4" />
      <line x1={PAD.left} x2={PAD.left + plotW} y1={y(2.5)} y2={y(2.5)} stroke="#cbd5e1" strokeDasharray="5 4" />

      {quadrants.map((q) => (
        <text key={q.key} x={q.x} y={q.y} textAnchor="middle" fontSize="11" fill="#64748b" fontWeight="600">
          {PRIORITY_QUADRANTS[q.key].label}
        </text>
      ))}

      {[1, 2, 3, 4, 5].map((value) => (
        <g key={value}>
          <text x={x(value)} y={PAD.top + plotH + 18} textAnchor="middle" fontSize="10" fill="#777">
            {value}
          </text>
          <text x={PAD.left - 12} y={y(value) + 4} textAnchor="end" fontSize="10" fill="#777">
            {value}
          </text>
        </g>
      ))}
      <text x={PAD.left + plotW / 2} y={H - 10} textAnchor="middle" fontSize="12" fill="#292929">Impact</text>
      <text x={-(PAD.top + plotH / 2)} y="17" textAnchor="middle" fontSize="12" fill="#292929" transform="rotate(-90)">
        Effort (basso in alto)
      </text>

      {points.map((point, index) => {
        const cx = x(point.scores.impact);
        const cy = y(point.scores.effort);
        const color = point.result.riskVeto ? "#dc2626" : PRIORITY_QUADRANTS[point.result.quadrant].color;
        const toLeft = point.scores.impact >= 4.5;
        return (
          <g key={point.id}>
            <circle cx={cx} cy={cy} r="10" fill={color} stroke="#fff" strokeWidth="2" />
            <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">{index + 1}</text>
            <text x={toLeft ? cx - 14 : cx + 14} y={cy + 4} textAnchor={toLeft ? "end" : "start"} fontSize="10" fill="#292929">
              {point.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
