import { LiveMarketResult } from "@/services/liveMarket";

export type PriceHistoryPoint = {
  cardId: string;
  value: number;
  averagePrice: number;
  medianPrice: number;
  soldCount: number;
  confidence?: string;
  createdAt: string;
};

const KEY = "cardmania_price_history";

function safeParse(value: string | null): PriceHistoryPoint[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getPriceHistory(cardId?: string) {
  if (typeof window === "undefined") return [];
  const points = safeParse(localStorage.getItem(KEY));
  return cardId ? points.filter((point) => point.cardId === cardId) : points;
}

export function addPriceHistoryPoint(cardId: string, result: LiveMarketResult) {
  if (typeof window === "undefined") return;
  const value = Number(result.suggestedValue || result.medianPrice || result.averagePrice || 0);
  if (!value) return;

  const point: PriceHistoryPoint = {
    cardId,
    value,
    averagePrice: Number(result.averagePrice || 0),
    medianPrice: Number(result.medianPrice || 0),
    soldCount: Number(result.soldCount || 0),
    confidence: result.confidence,
    createdAt: new Date().toISOString(),
  };

  const current = getPriceHistory();
  const next = [point, ...current].slice(0, 500);
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function latestPricePoint(cardId: string) {
  return getPriceHistory(cardId)[0] || null;
}
