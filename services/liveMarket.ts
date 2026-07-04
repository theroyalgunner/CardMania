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

export function buildMarketQuery(card: Partial<CollectionCard>) {
  return [
    card.player,
    card.year,
    card.manufacturer,
    card.set,
    card.parallel,
    card.serialNumber,
    card.cardNumber ? `#${card.cardNumber}` : "",
    card.grade && card.grade !== "Raw" ? card.grade : "",
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function marketConfidenceLabel(result?: LiveMarketResult | null) {
  if (!result?.soldCount) return "Low confidence";
  return `${result.confidence || "Low"} confidence`;
}

export async function searchLiveMarket(query: string): Promise<LiveMarketResult> {
  try {
    const res = await fetch("/api/ebay", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: data?.error || "Unable to contact market service.",
      };
    }

    return data;
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Unknown error",
    };
  }
}
