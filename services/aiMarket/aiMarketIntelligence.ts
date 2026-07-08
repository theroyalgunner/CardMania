import { CollectionCard } from "@/services/collectionStore";
import { LiveMarketResult } from "@/services/liveMarket";
import { estimateCardValue, valuationConfidence } from "@/services/marketEngine";

function hasText(value?: string | number) {
  return String(value || "").trim().length > 0;
}

function money(value?: number) {
  return `£${Number(value || 0).toLocaleString()}`;
}

export type AIMarketInsight = {
  summary: string;
  fairValue: number;
  confidence: "High" | "Medium" | "Low";
  buyHoldSell: "Buy" | "Hold" | "Sell" | "Watch";
  reasons: string[];
  risks: string[];
  nextActions: string[];
};

export function explainCardMarket(
  card: Partial<CollectionCard>,
  market?: LiveMarketResult | null
): AIMarketInsight {
  const liveValue = Number(market?.suggestedValue || market?.medianPrice || market?.averagePrice || 0);
  const fallbackValue = estimateCardValue(card);
  const fairValue = liveValue > 0 ? liveValue : fallbackValue;

  const reasons: string[] = [];
  const risks: string[] = [];
  const nextActions: string[] = [];

  if (hasText(card.player)) reasons.push(`Player identified: ${card.player}.`);
  if (hasText(card.year)) reasons.push(`Year is known: ${card.year}.`);
  if (hasText(card.manufacturer)) reasons.push(`Manufacturer is known: ${card.manufacturer}.`);
  if (hasText(card.set)) reasons.push(`Set/product is known: ${card.set}.`);
  if (hasText(card.parallel)) reasons.push(`Parallel identified: ${card.parallel}.`);
  if (hasText(card.serialNumber)) reasons.push(`Serial numbering adds scarcity: ${card.serialNumber}.`);
  if (hasText(card.grade)) reasons.push(`Grade affects value: ${card.grade}.`);

  if (market?.keptCount) {
    reasons.push(`Live market found ${market.keptCount} usable comparable sales.`);
  }

  if (!hasText(card.player)) risks.push("Missing player name reduces search accuracy.");
  if (!hasText(card.set)) risks.push("Missing set/product can mix wrong comps.");
  if (!hasText(card.parallel)) risks.push("Missing parallel can mix base cards with rare versions.");
  if (!hasText(card.serialNumber)) risks.push("Missing serial number can miss scarcity premium.");
  if (!market?.keptCount) risks.push("No confirmed live sold comps yet; value uses fallback estimate.");

  if (!hasText(card.player)) nextActions.push("Add player name.");
  if (!hasText(card.set)) nextActions.push("Add set/product name.");
  if (!hasText(card.parallel)) nextActions.push("Add parallel/color.");
  if (!hasText(card.serialNumber)) nextActions.push("Add serial number if shown.");
  if (!market?.keptCount) nextActions.push("Run live market again after eBay API token is connected.");

  const purchase = Number(card.purchasePrice || 0);
  const profit = fairValue - purchase;
  const confidence =
    market?.confidence ||
    (valuationConfidence(card) as "High" | "Medium" | "Low");

  let buyHoldSell: AIMarketInsight["buyHoldSell"] = "Watch";
  if (purchase > 0 && profit > purchase * 0.35 && confidence !== "Low") buyHoldSell = "Hold";
  else if (purchase > 0 && profit < -purchase * 0.2) buyHoldSell = "Sell";
  else if (confidence === "High" && market?.keptCount && fairValue > purchase) buyHoldSell = "Buy";

  const summary = `${card.player || "This card"} is estimated around ${money(fairValue)} with ${confidence.toLowerCase()} confidence. ${
    liveValue > 0
      ? "The estimate is based on live comparable sales."
      : "The estimate is currently model-based until live eBay API data is connected."
  }`;

  return {
    summary,
    fairValue,
    confidence,
    buyHoldSell,
    reasons: reasons.slice(0, 8),
    risks: risks.slice(0, 6),
    nextActions: nextActions.slice(0, 6),
  };
}
