import { CollectionCard } from "@/services/collectionStore";

export type IntelligenceBand = "Elite" | "Strong" | "Balanced" | "Speculative" | "Weak";
export type ActionSignal = "Buy" | "Hold" | "Sell" | "Watch";
export type RiskLevel = "Low" | "Medium" | "High";

export type CardIntelligence = {
  score: number;
  band: IntelligenceBand;
  action: ActionSignal;
  risk: RiskLevel;
  scarcityScore: number;
  liquidityScore: number;
  gradingScore: number;
  momentumScore: number;
  valueScore: number;
  reasons: string[];
  gradingRecommendation: string;
  shortTermOutlook: string;
  longTermOutlook: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function numberFromSerial(serial?: string) {
  const match = String(serial || "").match(/\/(\d{1,6})/);
  return match ? Number(match[1]) : 0;
}

function hasAny(text: string, words: string[]) {
  const value = text.toLowerCase();
  return words.some((word) => value.includes(word.toLowerCase()));
}

function isGraded(card: CollectionCard) {
  return /psa|bgs|sgc|cgc|tag/i.test(String(card.grade || ""));
}

function isRaw(card: CollectionCard) {
  return !card.grade || /raw|ungraded/i.test(String(card.grade || ""));
}

export function cardSearchText(card: CollectionCard) {
  return [
    card.player,
    card.team,
    card.manufacturer,
    card.set,
    card.year,
    card.parallel,
    card.serialNumber,
    card.cardNumber,
    card.grade,
    card.notes,
  ]
    .filter(Boolean)
    .join(" ");
}

export function calculateCardIntelligence(card: CollectionCard): CardIntelligence {
  const text = cardSearchText(card);
  const serialLimit = numberFromSerial(card.serialNumber) || numberFromSerial(card.parallel);
  const value = Number(card.estimatedValue || 0);
  const cost = Number(card.purchasePrice || 0);
  const profit = value - cost;
  const roi = cost > 0 ? (profit / cost) * 100 : value > 0 ? 35 : 0;

  const rareKeywords = ["1/1", "one of one", "superfractor", "gold", "red", "black", "orange", "numbered", "ssp", "sp", "case hit", "rookie", "auto", "autograph", "patch", "jersey", "game used", "printing plate"];
  const hotKeywords = ["rookie", "rc", "auto", "autograph", "patch", "jersey", "psa 10", "bgs 9.5", "sgc 10", "gold", "superfractor"];

  let scarcityScore = 35;
  if (serialLimit === 1) scarcityScore = 100;
  else if (serialLimit > 0 && serialLimit <= 5) scarcityScore = 95;
  else if (serialLimit > 0 && serialLimit <= 10) scarcityScore = 90;
  else if (serialLimit > 0 && serialLimit <= 25) scarcityScore = 82;
  else if (serialLimit > 0 && serialLimit <= 50) scarcityScore = 74;
  else if (serialLimit > 0 && serialLimit <= 99) scarcityScore = 64;
  else if (serialLimit > 0) scarcityScore = 54;
  if (hasAny(text, rareKeywords)) scarcityScore += 12;
  scarcityScore = clamp(scarcityScore);

  let liquidityScore = 35;
  if (value >= 1000) liquidityScore = 78;
  else if (value >= 300) liquidityScore = 70;
  else if (value >= 100) liquidityScore = 62;
  else if (value >= 30) liquidityScore = 52;
  if (hasAny(text, hotKeywords)) liquidityScore += 10;
  liquidityScore = clamp(liquidityScore);

  let gradingScore = 45;
  if (isGraded(card)) gradingScore = 80;
  if (isRaw(card) && value >= 80) gradingScore += 18;
  if (hasAny(text, ["psa 10", "bgs 10", "black label", "sgc 10"])) gradingScore = 95;
  if (hasAny(text, ["damaged", "crease", "corner", "surface issue", "poor"])) gradingScore -= 25;
  gradingScore = clamp(gradingScore);

  let momentumScore = 48 + Math.min(22, Math.max(-12, roi / 5));
  if (hasAny(text, ["rookie", "rc", "world cup", "champions league", "legend", "goat"])) momentumScore += 8;
  momentumScore = clamp(momentumScore);

  let valueScore = 50;
  if (cost > 0 && value > 0) {
    if (roi >= 100) valueScore = 92;
    else if (roi >= 50) valueScore = 82;
    else if (roi >= 20) valueScore = 70;
    else if (roi >= 0) valueScore = 58;
    else if (roi >= -20) valueScore = 42;
    else valueScore = 28;
  } else if (value > 0) {
    valueScore = 58;
  }

  const score = clamp(
    scarcityScore * 0.28 + liquidityScore * 0.22 + gradingScore * 0.2 + momentumScore * 0.16 + valueScore * 0.14
  );

  const band: IntelligenceBand = score >= 85 ? "Elite" : score >= 72 ? "Strong" : score >= 58 ? "Balanced" : score >= 42 ? "Speculative" : "Weak";
  const risk: RiskLevel = scarcityScore >= 80 && liquidityScore >= 55 ? "Low" : valueScore < 40 || liquidityScore < 45 ? "High" : "Medium";
  const action: ActionSignal = score >= 78 && valueScore >= 55 ? "Buy" : score >= 60 ? "Hold" : risk === "High" ? "Watch" : "Sell";

  const reasons: string[] = [];
  if (scarcityScore >= 75) reasons.push("Strong scarcity profile from serial, parallel, or premium card attributes.");
  if (liquidityScore >= 65) reasons.push("Healthy liquidity signal based on value range and marketable card attributes.");
  if (gradingScore >= 75) reasons.push("Good grading upside or already carries a strong third-party grade.");
  if (valueScore >= 70) reasons.push("Current value compares favorably to purchase cost.");
  if (reasons.length === 0) reasons.push("Needs more market evidence before making an aggressive decision.");

  const gradingRecommendation = isGraded(card)
    ? "Already graded. Compare the grade premium against raw and lower-grade comps before selling."
    : gradingScore >= 75
      ? "Strong grading candidate if condition is clean under light: corners, edges, centering, and surface should be checked."
      : gradingScore >= 55
        ? "Possible grading candidate, but only if condition is clearly near mint or better."
        : "Probably keep raw unless the card has exceptional condition or rare attributes.";

  const shortTermOutlook = score >= 75 ? "Positive if recent comps support the current value." : score >= 55 ? "Stable, but avoid overpaying without fresh sales data." : "Unclear until stronger sold comps appear.";
  const longTermOutlook = scarcityScore >= 75 ? "Better long-term profile due to rarity and collectible attributes." : liquidityScore >= 65 ? "Good long-term liquidity if player demand remains active." : "Long-term upside depends heavily on player demand and future market data.";

  return {
    score,
    band,
    action,
    risk,
    scarcityScore,
    liquidityScore,
    gradingScore,
    momentumScore,
    valueScore,
    reasons,
    gradingRecommendation,
    shortTermOutlook,
    longTermOutlook,
  };
}

export function scoreColor(score: number) {
  if (score >= 75) return "text-cm-green";
  if (score >= 55) return "text-yellow-300";
  return "text-red-300";
}
