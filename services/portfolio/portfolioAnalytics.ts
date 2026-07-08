import { CollectionCard } from "@/services/collectionStore";
import { PriceHistoryPoint } from "@/services/priceHistoryStore";

export type PortfolioAnalyticsRow = {
  card: CollectionCard;
  cost: number;
  value: number;
  profit: number;
  roi: number;
  weight: number;
  lastMove: number;
  lastMovePct: number;
  dataQuality: "Complete" | "Partial" | "Weak";
};

function n(value: any) {
  return Number(value || 0);
}

export function portfolioAnalytics(cards: CollectionCard[], historyByCard: Record<string, PriceHistoryPoint[]>) {
  const totalValue = cards.reduce((sum, card) => sum + n(card.estimatedValue), 0);

  const rows: PortfolioAnalyticsRow[] = cards.map((card) => {
    const cost = n(card.purchasePrice);
    const value = n(card.estimatedValue);
    const profit = value - cost;
    const roi = cost ? (profit / cost) * 100 : 0;
    const history = historyByCard[card.id] || [];
    const latest = history[0];
    const previous = history[1];
    const lastMove = latest && previous ? latest.value - previous.value : 0;
    const lastMovePct = previous?.value ? (lastMove / previous.value) * 100 : 0;

    const completeFields = [
      card.player,
      card.manufacturer,
      card.set,
      card.year,
      card.parallel,
      card.serialNumber,
      card.cardNumber,
      card.purchasePrice,
      card.estimatedValue,
    ].filter(Boolean).length;

    return {
      card,
      cost,
      value,
      profit,
      roi,
      weight: totalValue ? (value / totalValue) * 100 : 0,
      lastMove,
      lastMovePct,
      dataQuality: completeFields >= 8 ? "Complete" : completeFields >= 5 ? "Partial" : "Weak",
    };
  });

  const winners = [...rows].sort((a, b) => b.profit - a.profit).slice(0, 5);
  const losers = [...rows].sort((a, b) => a.profit - b.profit).slice(0, 5);
  const concentration = [...rows].sort((a, b) => b.weight - a.weight).slice(0, 5);
  const cleanup = rows.filter((row) => row.dataQuality !== "Complete").slice(0, 6);

  const portfolioRisk =
    concentration[0]?.weight > 45 ? "High" :
    concentration[0]?.weight > 28 ? "Medium" :
    "Low";

  const bestAction =
    cleanup.length > 0
      ? "Clean missing data first, then refresh live market values."
      : portfolioRisk === "High"
        ? "Portfolio is concentrated. Avoid adding more exposure to the same player/card type."
        : "Portfolio data is healthy. Continue refreshing market values before buy/sell decisions.";

  return {
    rows,
    winners,
    losers,
    concentration,
    cleanup,
    portfolioRisk,
    bestAction,
  };
}
