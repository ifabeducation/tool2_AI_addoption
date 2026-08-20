import {
  ETHICAL_REVIEW_RISK_THRESHOLD,
  HIGH_IMPACT_MIN,
  LOW_EFFORT_MAX,
  PRIORITY_FORMULA,
  PRIORITY_LEVELS,
  PRIORITY_QUADRANTS,
  PriorityLevel,
  PriorityQuadrant,
  RISK_VETO_SCORE,
} from "@/config/priorityFramework";
import { Block2Submission, PriorityDimension, PriorityScores } from "./types";

export type PriorityScorePresentation = {
  emoji: string;
  sentiment: "excellent" | "good" | "neutral" | "weak" | "critical";
  accessibleLabel: string;
};

const SCORE_PRESENTATIONS: Record<
  PriorityScorePresentation["sentiment"],
  Pick<PriorityScorePresentation, "emoji" | "accessibleLabel">
> = {
  excellent: { emoji: "🤩", accessibleLabel: "Molto favorevole" },
  good: { emoji: "🙂", accessibleLabel: "Favorevole" },
  neutral: { emoji: "😐", accessibleLabel: "Intermedio" },
  weak: { emoji: "🙁", accessibleLabel: "Poco favorevole" },
  critical: { emoji: "🚨", accessibleLabel: "Critico" },
};

/**
 * Traduce il punteggio in una lettura visiva. Impact e Reuse migliorano al
 * crescere del valore; Effort e Risk migliorano quando il valore diminuisce.
 */
export function getPriorityScorePresentation(
  dimension: PriorityDimension,
  score: number
): PriorityScorePresentation {
  const desirability = dimension === "effort" || dimension === "risk" ? 6 - score : score;
  const sentiment: PriorityScorePresentation["sentiment"] =
    desirability >= 5
      ? "excellent"
      : desirability === 4
        ? "good"
        : desirability === 3
          ? "neutral"
          : desirability === 2
            ? "weak"
            : "critical";
  return { sentiment, ...SCORE_PRESENTATIONS[sentiment] };
}

export type PriorityResult = {
  score: number;
  level: PriorityLevel;
  levelLabel: string;
  action: string;
  quadrant: PriorityQuadrant;
  quadrantLabel: string;
  quadrantStrategy: string;
  riskVeto: boolean;
  ethicalReviewRequired: boolean;
};

export function isPriorityScore(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

export function arePriorityScores(value: unknown): value is PriorityScores {
  if (!value || typeof value !== "object") return false;
  const scores = value as Partial<PriorityScores>;
  return [scores.impact, scores.effort, scores.risk, scores.reuse].every(isPriorityScore);
}

export function calculatePriorityScore(scores: PriorityScores): number {
  return (
    scores.impact * PRIORITY_FORMULA.impactWeight +
    scores.reuse -
    scores.effort -
    scores.risk +
    PRIORITY_FORMULA.offset
  );
}

export function classifyPriority(score: number): PriorityLevel {
  if (score >= PRIORITY_LEVELS.high.min) return "high";
  if (score >= PRIORITY_LEVELS.medium.min) return "medium";
  return "low";
}

export function classifyQuadrant(scores: Pick<PriorityScores, "impact" | "effort">): PriorityQuadrant {
  const highImpact = scores.impact >= HIGH_IMPACT_MIN;
  const lowEffort = scores.effort <= LOW_EFFORT_MAX;
  if (highImpact && lowEffort) return "quickWin";
  if (highImpact) return "strategicBet";
  if (lowEffort) return "fillIn";
  return "moneyPit";
}

export function hasRiskVeto(scores: PriorityScores): boolean {
  return scores.risk === RISK_VETO_SCORE;
}

export function requiresEthicalReview(scores: PriorityScores, block2?: Block2Submission): boolean {
  return block2?.values?.eticaDecisioni === "si" && scores.risk > ETHICAL_REVIEW_RISK_THRESHOLD;
}

export function evaluatePriority(scores: PriorityScores, block2?: Block2Submission): PriorityResult {
  const score = calculatePriorityScore(scores);
  const level = classifyPriority(score);
  const quadrant = classifyQuadrant(scores);
  return {
    score,
    level,
    levelLabel: PRIORITY_LEVELS[level].label,
    action: PRIORITY_LEVELS[level].action,
    quadrant,
    quadrantLabel: PRIORITY_QUADRANTS[quadrant].label,
    quadrantStrategy: PRIORITY_QUADRANTS[quadrant].strategy,
    riskVeto: hasRiskVeto(scores),
    ethicalReviewRequired: requiresEthicalReview(scores, block2),
  };
}
