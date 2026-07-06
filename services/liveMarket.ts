import { CollectionCard } from "@/services/collectionStore";
import { buildFingerprint } from "@/services/cardFingerprint";
import { getMemory, rememberMarketSearch } from "@/services/marketMemory";
import { processMarketSales } from "@/services/marketEngine";
import { buildQueries } from "@/services/queryBuilder";

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

function withoutFullSerial(query: string) {
  return query
    .replace(/\b0*\d+\s*\/\s*(\d+)\b/g, "/$1")
    .replace(/\s+/g, " ")
    .trim();
}

function ebaySearchUrl(query: string) {
  return `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1&_sop=13`;
}

function mergeQueryOrder(queries: string[], fingerprint?: string) {
  if (!fingerprint) return queries;
  const memory = getMemory(fingerprint);
  if (!memory) return queries;

  const successful = memory.successfulQueries.filter((query) => queries.includes(query));
  const remaining = queries.filter((query) => !successful.includes(query));
  return [...successful, ...remaining];
}

function refineResult(data: LiveMarketResult, query: string): LiveMarketResult {
  const engine = processMarketSales(data.sales || [], query);

  return {
    ...data,
    query,
    sales: engine.sales,
    averagePrice: engine.averagePrice,
    medianPrice: engine.medianPrice,
    lowestPrice: engine.lowestPrice,
    highestPrice: engine.highestPrice,
    suggestedValue: engine.keptCount > 0 ? engine.suggestedValue : 0,
    soldCount: engine.soldCount,
    keptCount: engine.keptCount,
    rejectedCount: engine.rejectedCount,
    spreadPercent: engine.spreadPercent,
    fairLow: engine.fairLow,
    fairHigh: engine.fairHigh,
    confidence: engine.confidence,
    confidenceScore: engine.confidenceScore,
    pricingMethod: engine.pricingMethod,
    note:
      engine.keptCount > 0
        ? `Market V10 used query: ${query}. Kept ${engine.keptCount} strict comps and rejected ${engine.rejectedCount} weak/base/wrong-parallel matches.`
        : `No exact comps found for: ${query}. Value not updated.`,
  };
}

export function buildMarketQueries(card: Partial<CollectionCard>) {
  return buildQueries(card).map(withoutFullSerial);
}

export function buildMarketQuery(card: Partial<CollectionCard>) {
  return buildMarketQueries(card)[0] || "";
}

export function marketConfidenceLabel(result?: LiveMarketResult | null) {
  if (!result?.soldCount) return "Low confidence";
  return `${result.confidence || "Low"} confidence`;
}

export async function searchLiveMarket(query: string): Promise<LiveMarketResult> {
  try {
    const cleanQuery = withoutFullSerial(cleanToken(query));

    if (!cleanQuery) {
      return { success: false, error: "Missing search query." };
    }

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

    return refineResult(
      {
        ...data,
        searchUrl: data?.searchUrl || ebaySearchUrl(cleanQuery),
      },
      cleanQuery
    );
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Live market search failed.",
    };
  }
}

export async function searchLiveMarketForCard(card: Partial<CollectionCard>): Promise<LiveMarketResult> {
  const fingerprint = buildFingerprint(card);
  const queries = mergeQueryOrder(buildMarketQueries(card), fingerprint);

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

    const success = result.success && Number(result.keptCount || 0) > 0 && Number(result.suggestedValue || 0) > 0;

    rememberMarketSearch({
      fingerprint,
      query,
      success,
      confidenceScore: result.confidenceScore,
      requiredWords: result.sales?.flatMap((sale) => sale.flags || []).filter((flag) => !/^Rejected|mismatch|Wrong|Missing/i.test(flag)) || [],
      excludedWords: result.sales?.flatMap((sale) => sale.flags || []).filter((flag) => /^Rejected|mismatch|Wrong|Missing/i.test(flag)) || [],
    });

    if ((result.keptCount || 0) >= 3 && (result.confidenceScore || 0) >= 60 && (result.suggestedValue || 0) > 0) {
      return {
        ...result,
        queries,
        note: `${result.note} Market memory saved this successful query.`,
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
    suggestedValue: best?.keptCount ? best.suggestedValue : 0,
    note:
      best?.keptCount && best.keptCount > 0
        ? `${best.note || "Market search completed."} Multi-query fallback used best strict result.`
        : "No exact comps found after multi-query search. Value not updated.",
  };
}
