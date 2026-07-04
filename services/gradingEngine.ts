import { CollectionCard } from "@/services/collectionStore";
import { calculateCardIntelligence } from "@/services/cardIntelligence";
import { calculateMarketIntelligence } from "@/services/marketIntelligence";

export type GradingCompany = "PSA" | "BGS" | "SGC" | "TAG";
export type GradingVerdict = "Grade now" | "Inspect first" | "Keep raw" | "Already graded";
export type GradingRisk = "Low" | "Medium" | "High";

export type GradingCandidate = {
  card: CollectionCard;
  score: number;
  verdict: GradingVerdict;
  recommendedCompany: GradingCompany;
  risk: GradingRisk;
  rawValue: number;
  psa9Value: number;
  psa10Value: number;
  estimatedFee: number;
  netPsa9Upside: number;
  netPsa10Upside: number;
  breakEvenGrade: "PSA 9" | "PSA 10" | "Not attractive";
  centeringScore: number;
  surfaceScore: number;
  cornerScore: number;
  edgeScore: number;
  checklist: string[];
  reasons: string[];
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function money(value: number) {
  return Math.max(0, Math.round(value));
}

function hasAny(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(term.toLowerCase()));
}

function textFor(card: CollectionCard) {
  return [card.player, card.team, card.manufacturer, card.set, card.year, card.parallel, card.serialNumber, card.cardNumber, card.grade, card.condition, card.notes]
    .filter(Boolean)
    .join(" ");
}

function isAlreadyGraded(card: CollectionCard) {
  return /psa|bgs|sgc|cgc|tag/i.test(String(card.grade || ""));
}

function gradingFee(card: CollectionCard) {
  const value = Number(card.estimatedValue || 0);
  if (value >= 1500) return 65;
  if (value >= 500) return 42;
  if (value >= 150) return 28;
  return 20;
}

function recommendedCompany(card: CollectionCard): GradingCompany {
  const text = textFor(card);
  const value = Number(card.estimatedValue || 0);
  if (hasAny(text, ["modern", "chrome", "prizm", "select", "optic", "merlin", "sapphire", "rookie", "rc"])) return "PSA";
  if (hasAny(text, ["auto", "autograph", "patch", "thick", "relic", "jersey"])) return "BGS";
  if (value < 80) return "SGC";
  return "PSA";
}

function conditionScores(card: CollectionCard) {
  const text = textFor(card);
  let centeringScore = 78;
  let surfaceScore = 78;
  let cornerScore = 78;
  let edgeScore = 78;

  if (hasAny(text, ["gem", "mint", "clean", "sharp", "pack fresh"])) {
    centeringScore += 8;
    surfaceScore += 8;
    cornerScore += 8;
    edgeScore += 8;
  }
  if (hasAny(text, ["off center", "oc", "miscut"])) centeringScore -= 28;
  if (hasAny(text, ["scratch", "print line", "surface", "dent", "dimple"])) surfaceScore -= 26;
  if (hasAny(text, ["soft corner", "corner", "ding", "white corner"])) cornerScore -= 24;
  if (hasAny(text, ["edge", "chipping", "white edge", "peel"])) edgeScore -= 24;
  if (hasAny(text, ["crease", "bend", "water", "damage", "poor"])) {
    centeringScore -= 20;
    surfaceScore -= 35;
    cornerScore -= 35;
    edgeScore -= 28;
  }

  return {
    centeringScore: clamp(centeringScore),
    surfaceScore: clamp(surfaceScore),
    cornerScore: clamp(cornerScore),
    edgeScore: clamp(edgeScore),
  };
}

export function analyzeGradingCandidate(card: CollectionCard): GradingCandidate {
  const intel = calculateCardIntelligence(card);
  const market = calculateMarketIntelligence(card);
  const alreadyGraded = isAlreadyGraded(card);
  const fee = gradingFee(card);
  const rawValue = money(market.rawValue || Number(card.estimatedValue || 0));
  const psa9Value = money(market.psa9Value || rawValue * 1.85);
  const psa10Value = money(market.psa10Value || rawValue * 3.15);
  const netPsa9Upside = money(psa9Value - rawValue - fee);
  const netPsa10Upside = money(psa10Value - rawValue - fee);
  const condition = conditionScores(card);
  const conditionAverage = (condition.centeringScore + condition.surfaceScore + condition.cornerScore + condition.edgeScore) / 4;

  const score = alreadyGraded
    ? clamp(intel.gradingScore + 8)
    : clamp(intel.gradingScore * 0.35 + market.confidenceScore * 0.15 + conditionAverage * 0.3 + Math.min(100, netPsa10Upside) * 0.2);

  let verdict: GradingVerdict = "Keep raw";
  if (alreadyGraded) verdict = "Already graded";
  else if (score >= 76 && netPsa9Upside > 0) verdict = "Grade now";
  else if (score >= 58 && netPsa10Upside > fee) verdict = "Inspect first";

  const risk: GradingRisk = alreadyGraded || (netPsa9Upside > 0 && conditionAverage >= 78) ? "Low" : netPsa10Upside <= fee || conditionAverage < 62 ? "High" : "Medium";
  const breakEvenGrade = netPsa9Upside > 0 ? "PSA 9" : netPsa10Upside > 0 ? "PSA 10" : "Not attractive";

  const checklist = [
    "Check centering with borders visible on all sides.",
    "Inspect surface under angled light for print lines, scratches, dents, and dimples.",
    "Check all four corners for whitening, softness, or dings.",
    "Check edges for chipping, peeling, or whitening.",
    "Compare against exact sold comps for raw, PSA 9, and PSA 10 before submitting.",
  ];

  const reasons: string[] = [];
  if (alreadyGraded) reasons.push("This card is already graded; focus on resale timing, crossover, or grade review only.");
  if (netPsa9Upside > 0) reasons.push("PSA 9 model is already profitable after estimated grading cost.");
  else if (netPsa10Upside > 0) reasons.push("Profit depends on achieving a gem-mint result.");
  if (market.confidenceScore < 45) reasons.push("Pricing confidence is limited, so verify exact sold comps first.");
  if (conditionAverage < 70) reasons.push("Condition notes suggest higher grading risk.");
  if (reasons.length === 0) reasons.push("Candidate is balanced, but final decision depends on physical inspection.");

  return {
    card,
    score,
    verdict,
    recommendedCompany: recommendedCompany(card),
    risk,
    rawValue,
    psa9Value,
    psa10Value,
    estimatedFee: fee,
    netPsa9Upside,
    netPsa10Upside,
    breakEvenGrade,
    ...condition,
    checklist,
    reasons,
  };
}

export function rankGradingCandidates(cards: CollectionCard[]) {
  return cards.map(analyzeGradingCandidate).sort((a, b) => b.score - a.score);
}

export function gradingToneClass(value: string | number) {
  if (typeof value === "number") {
    if (value >= 75) return "text-cm-green";
    if (value >= 55) return "text-yellow-300";
    return "text-red-300";
  }
  if (["Grade now", "Low", "PSA 9"].includes(value)) return "text-cm-green";
  if (["Inspect first", "Medium", "PSA 10"].includes(value)) return "text-yellow-300";
  if (["Keep raw", "High", "Not attractive"].includes(value)) return "text-red-300";
  return "text-white";
}
