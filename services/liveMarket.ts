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
  queries?: string[];
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

function serialDenominator(serialNumber?: string) {
  const value = cleanToken(serialNumber);
  const match = value.match(/\/?(\d+)\s*\/\s*(\d+)/);
  if (!match) return value;
  return `/${match[2]}`;
}

function withoutFullSerial(query: string) {
  return query.replace(/\b0*\d+\s*\/\s*(\d+)\b/g, "/$1").replace(/\s+/g, " ").trim();
}

function compact(parts: string[]) {
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

export function buildMarketQueries(card: Partial<CollectionCard>) {
  const player = cleanToken(card.player);
  const year = cleanToken(card.year);
  const manufacturer = cleanToken(card.manufacturer);
  const set = cleanToken(card.set);
  const parallel = cleanToken(card.parallel);
  const serial = serialDenominator(card.serialNumber);
  const number = cardNumberToken(card.cardNumber);
  const grade = cleanToken(card.grade);
  const gradePart = grade && grade.toLowerCase() !== "raw" ? grade : "";

  const queries = [
    compact([player, year, manufacturer, set, parallel, serial, number, gradePart]),
    compact([player, year, manufacturer, set, parallel, serial, number]),
    compact([player, manufacturer, set, parallel, serial, number]),
    compact([player, manufacturer, set, parallel, serial]),
    compact([player, manufacturer, set, number]),
    compact([player, manufacturer, set]),
  ];

  return Array.from(new Set(queries.filter((q) => q.length > 3)));
}

export function buildMarketQuery(card: Partial<CollectionCard>) {
  return buildMarketQueries(card)[0] || "";
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
    if (t.includes(word)) score += 10;
  }

  if (/\blot\b|\bbundle\b|\bjob lot\b|\bset of\b|\bteam set\b|\bbox\b|\bpack\b|\bcase\b/i.test(t)) {
    score -= 60;
    flags.push("Rejected lot/box/pack");
  }

  if (/\bauto|autograph|signed\b/i.test(t) && !/\bauto|autograph|signed\b/i.test(q)) {
    score -= 45;
    flags.push("Auto mismatch");
  }

  if (/\bpsa|bgs|sgc|cgc|tag\b/i.test(t) && !/\bpsa|bgs|sgc|cgc|tag\b/i.test(q)) {
    score -= 45;
    flags.push("Grade mismatch");
  }

  if (/\bpatch|relic|jersey|memorabilia\b/i.test(t) && !/\bpatch|relic|jersey|memorabilia\b/i.test(q)) {
    score -= 40;
    flags.push("Relic mismatch");
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
    .filter((sale) => (sale.score || 0) >= 55)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 8);

  const prices = kept.map((sale) => Number(sale.price || 0));
  const medianPrice = median(prices);
  const averagePrice = average(prices);
  const lowestPrice = prices.length ? Math.min(...prices) : 0;
  const highestPrice = prices.length ? Math.max(...prices) : 0;
  const suggestedValue = medianPrice || data.suggestedValue || 0;

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
    confidenceScore: kept.length >= 4 ? 88 : kept.length >= 2 ? 62 : 25,
    pricingMethod: "Market V5 multi-query exact-comps median",
    note: `Market V5 used query: ${query}. Kept ${kept.length} comps, rejected ${Math.max(0, scored.length - kept.length)} weaker matches.`,
  };
}

export function marketConfidenceLabel(result?: LiveMarketResult | null) {
  if (!result?.soldCount) return "Low confidence";
  return `${result.confidence || "Low"} confidence`;
}

export async function searchLiveMarket(query: string): Promise<LiveMarketResult> {
  try {
    const cleanQuery = withoutFullSerial(cleanToken(query));

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

export async function searchLiveMarketForCard(card: Partial<CollectionCard>): Promise<LiveMarketResult> {
  const queries = buildMarketQueries(card);

  if (!queries.length) {
    return {
      success: false,
      error: "Not enough card details to search market.",
    };
  }

  const attempts: LiveMarketResult[] = [];

  for (const query of queries) {
    const result = await searchLiveMarket(query);
    attempts.push(result);

    if ((result.keptCount || 0) >= 3 && (result.confidenceScore || 0) >= 60) {
      return {
        ...result,
        queries,
        note: `${result.note} Multi-query search stopped after finding reliable comps.`,
      };
    }
  }

  const best =
    attempts
      .filter((result) => result.success)
      .sort((a, b) => (b.confidenceScore || 0) - (a.confidenceScore || 0))[0] || attempts[0];

  return {
    ...best,
    queries,
    note: `${best?.note || "Market search completed."} Multi-query fallback used best available result.`,
  };
}