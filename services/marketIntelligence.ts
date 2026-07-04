import { CollectionCard } from "@/services/collectionStore";
import { PriceHistoryPoint } from "@/services/priceHistoryStore";
import { estimateCardValue, valuationConfidence } from "@/services/marketEngine";
import { LiveMarketResult } from "@/services/liveMarket";

export type MarketTrend = "Rising" | "Stable" | "Falling" | "Unknown";
export type MarketVerdict = "Buy" | "Hold" | "Sell" | "Watch";
export type MarketRisk = "Low" | "Medium" | "High";

export type MarketIntelligence = {
  fairValue: number;
  rawValue: number;
  gradedValue: number;
  psa9Value: number;
  psa10Value: number;
  valueSource: "Live comps" | "Saved value" | "Offline estimate";
  confidenceScore: number;
  confidenceLabel: "High" | "Medium" | "Low";
  trend: MarketTrend;
  trendPercent: number;
  spreadPercent: number;
  liquidityScore: number;
  risk: MarketRisk;
  verdict: MarketVerdict;
  upside: number;
  downside: number;
  reasons: string[];
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function roundMoney(value: number) {
  return Math.max(0, Math.round(value));
}

function serialLimit(card: Partial<CollectionCard>) {
  const match = `${card.serialNumber || ""} ${card.parallel || ""}`.match(/\/(\d{1,6})/);
  return match ? Number(match[1]) : 0;
}

function isGraded(card: Partial<CollectionCard>) {
  return /psa|bgs|sgc|cgc|tag/i.test(String(card.grade || ""));
}

function gradeMultiplier(card: Partial<CollectionCard>) {
  const grade = String(card.grade || "Raw").toLowerCase();
  if (grade.includes("psa 10") || grade.includes("sgc 10") || grade.includes("bgs 10")) return 3.2;
  if (grade.includes("psa 9") || grade.includes("bgs 9.5") || grade.includes("sgc 9.5")) return 1.9;
  if (/psa|bgs|sgc|cgc|tag/.test(grade)) return 1.45;
  return 1;
}

function premiumSignal(card: Partial<CollectionCard>) {
  const text = [card.player, card.manufacturer, card.set, card.parallel, card.serialNumber, card.grade, card.notes]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /rookie|\brc\b|auto|autograph|patch|jersey|relic|superfractor|gold|red|black|orange|ssp|case hit|1\/1/.test(text);
}

function confidenceFromCard(card: Partial<CollectionCard>, result?: LiveMarketResult | null) {
  if (result?.confidenceScore) return clamp(result.confidenceScore);
  const fields = [card.player, card.year, card.manufacturer, card.set, card.parallel, card.serialNumber, card.cardNumber, card.grade];
  let score = fields.filter(Boolean).length * 9;
  if (premiumSignal(card)) score += 12;
  if (Number(card.estimatedValue || 0) > 0) score += 8;
  if (valuationConfidence(card) === "Medium") score += 10;
  return clamp(score, 12, 78);
}

function confidenceLabel(score: number): MarketIntelligence["confidenceLabel"] {
  if (score >= 75) return "High";
  if (score >= 45) return "Medium";
  return "Low";
}

export function calculateMarketTrend(history: PriceHistoryPoint[] = []): Pick<MarketIntelligence, "trend" | "trendPercent"> {
  const latest = history[0]?.value || 0;
  const previous = history[1]?.value || 0;
  if (!latest || !previous) return { trend: "Unknown", trendPercent: 0 };
  const trendPercent = previous ? Math.round(((latest - previous) / previous) * 100) : 0;
  const trend: MarketTrend = trendPercent >= 8 ? "Rising" : trendPercent <= -8 ? "Falling" : "Stable";
  return { trend, trendPercent };
}

export function calculateMarketIntelligence(
  card: CollectionCard,
  history: PriceHistoryPoint[] = [],
  liveResult?: LiveMarketResult | null
): MarketIntelligence {
  const savedValue = Number(card.estimatedValue || 0);
  const liveValue = Number(liveResult?.suggestedValue || liveResult?.medianPrice || liveResult?.averagePrice || 0);
  const offlineValue = estimateCardValue({ ...card, estimatedValue: 0 });
  const sourceValue = liveValue || savedValue || offlineValue;
  const valueSource: MarketIntelligence["valueSource"] = liveValue ? "Live comps" : savedValue ? "Saved value" : "Offline estimate";
  const gradeMult = gradeMultiplier(card);
  const rawValue = isGraded(card) ? roundMoney(sourceValue / gradeMult) : roundMoney(sourceValue);
  const psa9Value = roundMoney(rawValue * 1.85);
  const psa10Value = roundMoney(rawValue * 3.15);
  const gradedValue = isGraded(card) ? roundMoney(sourceValue) : psa10Value;
  const fairValue = roundMoney(sourceValue);

  const count = Number(liveResult?.soldCount || history[0]?.soldCount || 0);
  const spread = liveResult?.highestPrice && liveResult?.lowestPrice && fairValue
    ? ((Number(liveResult.highestPrice) - Number(liveResult.lowestPrice)) / fairValue) * 100
    : 0;
  const confidenceScore = clamp(confidenceFromCard(card, liveResult) + Math.min(20, count * 2) - Math.min(24, spread / 8));
  const liquidityScore = clamp((count ? Math.min(70, count * 7) : 25) + (fairValue >= 100 ? 10 : 0) + (premiumSignal(card) ? 12 : 0));
  const { trend, trendPercent } = calculateMarketTrend(history);
  const cost = Number(card.purchasePrice || 0);
  const roi = cost ? ((fairValue - cost) / cost) * 100 : 0;
  const run = serialLimit(card);
  const risk: MarketRisk = confidenceScore < 35 || spread > 140 ? "High" : confidenceScore >= 70 && liquidityScore >= 55 ? "Low" : "Medium";

  let verdict: MarketVerdict = "Hold";
  if (confidenceScore < 35 || (!count && valueSource !== "Live comps")) verdict = "Watch";
  else if (roi >= 60 && trend !== "Rising") verdict = "Sell";
  else if (roi <= -20 && confidenceScore >= 55) verdict = "Buy";
  else if (trend === "Falling" && roi > 20) verdict = "Sell";
  else if (trend === "Rising" || premiumSignal(card) || run > 0) verdict = "Hold";

  const reasons: string[] = [];
  reasons.push(`${valueSource} used as the current fair value base.`);
  if (count) reasons.push(`${count} comparable sale${count === 1 ? "" : "s"} support the latest market sample.`);
  if (spread > 120) reasons.push("Wide price range means comps are noisy; exact variation matching matters.");
  if (trend !== "Unknown") reasons.push(`Recent saved price trend is ${trend.toLowerCase()} (${trendPercent}%).`);
  if (isGraded(card)) reasons.push("Card is already graded, so graded comps should be prioritized over raw comps.");
  else reasons.push(`Raw-to-PSA 10 model estimates upside to ${roundMoney(psa10Value).toLocaleString()}.`);

  return {
    fairValue,
    rawValue,
    gradedValue,
    psa9Value,
    psa10Value,
    valueSource,
    confidenceScore,
    confidenceLabel: confidenceLabel(confidenceScore),
    trend,
    trendPercent,
    spreadPercent: Math.round(spread),
    liquidityScore,
    risk,
    verdict,
    upside: roundMoney(Math.max(psa10Value, fairValue) - fairValue),
    downside: roundMoney(Math.max(0, fairValue - rawValue * 0.72)),
    reasons,
  };
}

export function marketToneClass(value: MarketTrend | MarketVerdict | MarketRisk | string) {
  if (["Rising", "Buy", "Low", "High"].includes(value) && value !== "High") return "text-cm-green";
  if (["Falling", "Sell", "High"].includes(value)) return "text-red-300";
  if (["Watch", "Medium", "Stable"].includes(value)) return "text-yellow-300";
  return "text-white";
}
