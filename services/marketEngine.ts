import { CollectionCard } from "./collectionStore";
import { MatchResult, matchMarketListing } from "@/services/cardMatcher";

export type MarketEngineSale = {
  title: string;
  price: number;
  currency: "GBP" | "USD" | "EUR";
  source: "ebay";
  url?: string;
  soldDate?: string;
  image?: string;
  score?: number;
  flags?: string[];
};

export type MarketEngineSummary = {
  sales: MarketEngineSale[];
  averagePrice: number;
  medianPrice: number;
  lowestPrice: number;
  highestPrice: number;
  suggestedValue: number;
  soldCount: number;
  keptCount: number;
  rejectedCount: number;
  fairLow: number;
  fairHigh: number;
  spreadPercent: number;
  confidence: "High" | "Medium" | "Low";
  confidenceScore: number;
  pricingMethod: string;
  requiredWords: string[];
  excludedWords: string[];
};

function normalizeText(card: Partial<CollectionCard>) {
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
    card.condition,
    card.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function has(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function detailCompleteness(card: Partial<CollectionCard>) {
  const fields = [card.player, card.manufacturer, card.set, card.year, card.parallel, card.serialNumber, card.grade];
  return fields.filter(Boolean).length / fields.length;
}

function extractRun(serial?: string, text = "") {
  const value = `${serial || ""} ${text}`;
  if (/1\s*\/\s*1|one of one|superfractor|printing plate/i.test(value)) return 1;
  const match = value.match(/(\d{1,4})\s*\/\s*(\d{1,4})/);
  return match ? Number(match[2]) : null;
}

function qualityMultiplier(card: Partial<CollectionCard>) {
  const text = normalizeText(card);
  let multiplier = 1;

  if (has(text, ["messi", "cristiano", "ronaldo", "pele", "maradona"])) multiplier *= 3.8;
  else if (has(text, ["zidane", "beckham", "ronaldinho", "neymar", "mbappe", "haaland"])) multiplier *= 2.8;
  else if (has(text, ["yamal", "bellingham", "vinicius", "endrick", "saka", "pedri"])) multiplier *= 2.2;

  if (has(text, ["topps chrome", "sapphire", "prizm", "select", "obsidian", "immaculate", "flawless"])) multiplier *= 1.6;
  if (has(text, ["auto", "autograph", "signed"])) multiplier *= 2.9;
  if (has(text, ["patch", "jersey", "relic", "memorabilia"])) multiplier *= 2.1;
  if (has(text, ["rookie", " rc ", "debut"])) multiplier *= 1.7;
  if (has(text, ["gold", "orange", "red", "black", "refractor", "mojo", "wave"])) multiplier *= 1.8;
  if (has(text, ["ssp", "case hit", "kaboom", "downtown", "color blast"])) multiplier *= 3.2;

  const run = extractRun(card.serialNumber, text);
  if (run === 1) multiplier *= 10;
  else if (run && run <= 5) multiplier *= 5.5;
  else if (run && run <= 10) multiplier *= 4.2;
  else if (run && run <= 25) multiplier *= 3.1;
  else if (run && run <= 50) multiplier *= 2.25;
  else if (run && run <= 99) multiplier *= 1.65;
  else if (run && run <= 199) multiplier *= 1.25;

  const grade = String(card.grade || "").toLowerCase();
  if (grade.includes("psa 10") || grade.includes("bgs 10") || grade.includes("sgc 10")) multiplier *= 3.4;
  else if (grade.includes("psa 9") || grade.includes("bgs 9.5") || grade.includes("sgc 9.5")) multiplier *= 1.85;
  else if (grade.includes("psa 8") || grade.includes("graded")) multiplier *= 1.25;

  return multiplier;
}

function median(values: number[]) {
  const sorted = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function average(values: number[]) {
  const clean = values.filter((value) => Number.isFinite(value) && value > 0);
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function outlierFilter(values: number[]) {
  const sorted = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (sorted.length < 4) return sorted;

  const med = median(sorted);
  let filtered = sorted.filter((value) => value >= med * 0.55 && value <= med * 1.85);

  if (filtered.length >= 6) {
    const q1 = filtered[Math.floor((filtered.length - 1) * 0.25)];
    const q3 = filtered[Math.floor((filtered.length - 1) * 0.75)];
    const iqr = q3 - q1;
    if (iqr > 0) {
      const lowFence = q1 - iqr * 1.5;
      const highFence = q3 + iqr * 1.5;
      const iqrFiltered = filtered.filter((value) => value >= lowFence && value <= highFence);
      if (iqrFiltered.length >= 3) filtered = iqrFiltered;
    }
  }

  return filtered.length >= Math.min(3, sorted.length) ? filtered : sorted;
}

function wordsFromMatches(matches: MatchResult[]) {
  const requiredWords = new Set<string>();
  const excludedWords = new Set<string>();

  for (const match of matches) {
    match.reasons.forEach((reason) => requiredWords.add(reason));
    match.rejects.forEach((reject) => excludedWords.add(reject));
  }

  return {
    requiredWords: Array.from(requiredWords).slice(0, 12),
    excludedWords: Array.from(excludedWords).slice(0, 12),
  };
}

export function processMarketSales(sales: MarketEngineSale[], query: string): MarketEngineSummary {
  const scored = sales.map((sale) => {
    const match = matchMarketListing(sale.title || "", query);
    return {
      ...sale,
      score: match.score,
      flags: [...(sale.flags || []), ...match.reasons, ...match.rejects],
      accepted: match.accepted,
      match,
    };
  });

  const kept = scored
    .filter((sale) => sale.accepted)
    .filter((sale) => Number(sale.price || 0) > 0)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 12)
    .map(({ accepted, match, ...sale }) => sale);

  const validPrices = kept.map((sale) => Number(sale.price || 0)).filter((price) => price > 0).sort((a, b) => a - b);
  const fairComps = outlierFilter(validPrices);
  const medianPrice = Math.round(median(fairComps));
  const averagePrice = Math.round(average(fairComps));
  const lowestPrice = validPrices.length ? Math.round(validPrices[0]) : 0;
  const highestPrice = validPrices.length ? Math.round(validPrices[validPrices.length - 1]) : 0;
  const fairLow = fairComps.length ? Math.round(fairComps[0]) : 0;
  const fairHigh = fairComps.length ? Math.round(fairComps[fairComps.length - 1]) : 0;
  const suggestedValue = fairComps.length ? Math.round(medianPrice * 0.7 + averagePrice * 0.3) : 0;
  const spreadPercent = medianPrice && fairComps.length
    ? Math.round(((fairComps[fairComps.length - 1] - fairComps[0]) / medianPrice) * 100)
    : 0;

  const averageScore = kept.length
    ? kept.reduce((sum, sale) => sum + Number(sale.score || 0), 0) / kept.length
    : 0;
  const confidenceScore = Math.max(
    0,
    Math.min(100, Math.round(Math.min(58, kept.length * 12) + averageScore * 0.42 - Math.min(25, spreadPercent / 8)))
  );
  const confidence = confidenceScore >= 76 ? "High" : confidenceScore >= 50 ? "Medium" : "Low";
  const learned = wordsFromMatches(scored.map((sale) => sale.match));

  return {
    sales: kept,
    averagePrice,
    medianPrice,
    lowestPrice,
    highestPrice,
    suggestedValue,
    soldCount: scored.length,
    keptCount: kept.length,
    rejectedCount: Math.max(0, scored.length - kept.length),
    fairLow,
    fairHigh,
    spreadPercent,
    confidence,
    confidenceScore,
    pricingMethod: "Market V10 strict matcher + memory-ready median",
    ...learned,
  };
}

export function estimateCardValue(card: Partial<CollectionCard>) {
  const existing = Number(card.estimatedValue || 0);
  if (existing > 10) return Math.round(existing);
  const base = 15 + detailCompleteness(card) * 20;
  return Math.max(5, Math.round(base * qualityMultiplier(card)));
}

export function valuationConfidence(card: Partial<CollectionCard>) {
  const score = detailCompleteness(card);
  if (score > 0.8) return "High";
  if (score > 0.5) return "Medium";
  return "Low";
}

export function profitFor(card: Partial<CollectionCard>) {
  return Number(card.estimatedValue || 0) - Number(card.purchasePrice || 0);
}

export function profitLabel(card: Partial<CollectionCard>) {
  const profit = profitFor(card);
  return `${profit >= 0 ? "+" : "-"}£${Math.abs(profit).toLocaleString()}`;
}
