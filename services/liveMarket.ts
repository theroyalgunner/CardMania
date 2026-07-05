import { CollectionCard } from "@/services/collectionStore";

export type LiveMarketSale = {
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

export type LiveMarketResult = {
  success: boolean;
  searchUrl?: string;
  query?: string;
  sales?: LiveMarketSale[];
  averagePrice?: number;
  medianPrice?: number;
  lowestPrice?: number;
  highestPrice?: number;
  suggestedValue?: number;
  soldCount?: number;
  keptCount?: number;
  rejectedCount?: number;
  spreadPercent?: number;
  fairLow?: number;
  fairHigh?: number;
  pricingMethod?: string;
  sourceMode?: "api" | "scrape";
  confidence?: "High" | "Medium" | "Low";
  confidenceScore?: number;
  note?: string;
  error?: string;
};

function cleanToken(value?: string | number) {
  return String(value || "")
    .replace(/unknown/gi, "")
    .replace(/card\s*#/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cardNumberToken(cardNumber?: string) {
  const value = cleanToken(cardNumber);
  if (!value) return "";
  return value.startsWith("#") ? value : `#${value}`;
}

export function buildMarketQuery(card: Partial<CollectionCard>) {
  const player = cleanToken(card.player);
  const year = cleanToken(card.year);
  const manufacturer = cleanToken(card.manufacturer);
  const set = cleanToken(card.set);
  const parallel = cleanToken(card.parallel);
  const serial = cleanToken(card.serialNumber);
  const number = cardNumberToken(card.cardNumber);
  const grade = cleanToken(card.grade);

  return [
    player,
    year,
    manufacturer,
    set,
    parallel,
    serial,
    number,
    grade && grade.toLowerCase() !== "raw" ? grade : "",
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\bunknown\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function median(values: number[]) {
  const sorted = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function average(values: number[]) {
  const clean = values.filter((v) => Number.isFinite(v) && v > 0);
  if (!clean.length) return 0;
  return Math.round(clean.reduce((sum, value) => sum + value, 0) / clean.length);
}

function scoreSale(title: string, query: string) {
  const t = title.toLowerCase();
  const q = query.toLowerCase();
  let score = 0;
  const flags: string[] = [];

  const important = q
    .replace(/[#/]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3);

  for (const word of important) {
    if (t.includes(word)) score += 8;
  }

  if (/\bauto|autograph|signed\b/i.test(t) && !/\bauto|autograph|signed\b/i.test(q)) {
    score -= 30;
    flags.push("Rejected possible auto mismatch");
  }

  if (/\bpsa|bgs|sgc|cgc|tag\b/i.test(t) && !/\bpsa|bgs|sgc|cgc|tag\b/i.test(q)) {
    score -= 25;
    flags.push("Rejected graded mismatch");
  }

  if (/\blot\b|\bbundle\b|\bjob lot\b|\bset of\b/i.test(t)) {
    score -= 25;
    flags.push("Rejected lot/bundle");
  }

  if (/\bpatch|relic|jersey\b/i.test(t) && !/\bpatch|relic|jersey\b/i.test(q)) {
    score -= 20;
    flags.push("Rejected relic mismatch");
  }

  return { score: Math.max(0, Math.min(100, score)), flags };
}

function refineResult(data: LiveMarketResult, query: string): LiveMarketResult {
  const sales = data.sales || [];

  const scored = sales.map((sale) => {
    const scoredSale = scoreSale(sale.title || "", query);
    return { ...sale, score: scoredSale.score, flags: scoredSale.flags };
  });

  const kept = scored
    .filter((sale) => Number(sale.price || 0) > 0)
    .filter((sale) => (sale.score || 0) >= 35)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 8);

  const prices = kept.map((sale) => Number(sale.price || 0));
  const medianPrice = median(prices);
  const averagePrice = average(prices);
  const lowestPrice = prices.length ? Math.min(...prices) : 0;
  const highestPrice = prices.length ? Math.max(...prices) : 0;
  const suggestedValue = medianPrice || data.suggestedValue || data.medianPrice || data.averagePrice || 0;

  return {
    ...data,
    query,
    sales: kept,
    soldCount: scored.length,
    keptCount: kept.length,
    rejectedCount: Math.max(0, scored.length - kept.length),
    medianPrice,
    averagePrice,
    lowestPrice,
    highestPrice,
    suggestedValue,
    confidence: kept.length >= 4 ? "High" : kept.length >= 2 ? "Medium" : "Low",
    confidenceScore: kept.length >= 4 ? 85 : kept.length >= 2 ? 60 : 30,
    pricingMethod: "Market Valuation V3 exact-comps median",
    note: `Market V3 kept ${kept.length} exact/near comps and rejected ${Math.max(0, scored.length - kept.length)} weaker matches.`,
  };
}

export function marketConfidenceLabel(result?: LiveMarketResult | null) {
  if (!result?.soldCount) return "Low confidence";
  return `${result.confidence || "Low"} confidence`;
}

export async function searchLiveMarket(query: string): Promise<LiveMarketResult> {
  try {
    const cleanQuery = cleanToken(query);

    const res = await fetch("/api/ebay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: cleanQuery }),
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: data?.error || "Unable to contact market service.",
      };
    }

    return refineResult(data, cleanQuery);
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Live market search failed.",
    };
  }
}