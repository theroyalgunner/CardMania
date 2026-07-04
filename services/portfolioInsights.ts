import { CollectionCard } from "@/services/collectionStore";

export type BreakdownItem = {
  label: string;
  count: number;
  value: number;
  percent: number;
};

export type PortfolioInsight = {
  title: string;
  detail: string;
  tone: "good" | "warning" | "neutral";
};

function money(value: number) {
  return `£${Math.round(value).toLocaleString()}`;
}

function cardProfit(card: CollectionCard) {
  return Number(card.estimatedValue || 0) - Number(card.purchasePrice || 0);
}

export function getPortfolioBreakdown(cards: CollectionCard[], key: "manufacturer" | "team" | "year" | "grade"): BreakdownItem[] {
  const totalValue = cards.reduce((sum, card) => sum + Number(card.estimatedValue || 0), 0);
  const map = new Map<string, { count: number; value: number }>();

  for (const card of cards) {
    const raw = String(card[key] || "Unknown").trim() || "Unknown";
    const current = map.get(raw) || { count: 0, value: 0 };
    current.count += 1;
    current.value += Number(card.estimatedValue || 0);
    map.set(raw, current);
  }

  return [...map.entries()]
    .map(([label, item]) => ({
      label,
      count: item.count,
      value: item.value,
      percent: totalValue ? Math.round((item.value / totalValue) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value || b.count - a.count)
    .slice(0, 6);
}

export function getTopProfitCards(cards: CollectionCard[], limit = 5) {
  return [...cards]
    .map((card) => ({ card, profit: cardProfit(card), roi: Number(card.purchasePrice || 0) ? Math.round((cardProfit(card) / Number(card.purchasePrice || 0)) * 100) : 0 }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, limit);
}

export function getCardsNeedingAttention(cards: CollectionCard[], limit = 5) {
  return cards
    .filter((card) => !card.player || !card.set || !card.estimatedValue || !card.purchasePrice)
    .slice(0, limit);
}

export function getPortfolioInsights(cards: CollectionCard[]): PortfolioInsight[] {
  const totalCost = cards.reduce((sum, card) => sum + Number(card.purchasePrice || 0), 0);
  const totalValue = cards.reduce((sum, card) => sum + Number(card.estimatedValue || 0), 0);
  const profit = totalValue - totalCost;
  const missingValues = cards.filter((card) => !Number(card.estimatedValue || 0)).length;
  const missingNames = cards.filter((card) => !card.player || card.player === "Unknown Player").length;
  const top = getTopProfitCards(cards, 1)[0];

  const insights: PortfolioInsight[] = [];

  if (!cards.length) {
    return [{ title: "Start scanning", detail: "Add your first card to unlock portfolio analytics.", tone: "neutral" }];
  }

  insights.push({
    title: profit >= 0 ? "Portfolio profitable" : "Portfolio below cost",
    detail: `${profit >= 0 ? "Gain" : "Loss"} of ${money(Math.abs(profit))} across ${cards.length} cards.`,
    tone: profit >= 0 ? "good" : "warning",
  });

  if (missingValues) {
    insights.push({
      title: "Values missing",
      detail: `${missingValues} card${missingValues === 1 ? "" : "s"} need estimated values before analytics are accurate.`,
      tone: "warning",
    });
  }

  if (missingNames) {
    insights.push({
      title: "Metadata cleanup",
      detail: `${missingNames} card${missingNames === 1 ? "" : "s"} still show Unknown Player. Open and edit them for better search and reporting.`,
      tone: "warning",
    });
  }

  if (top?.profit > 0) {
    insights.push({
      title: "Best performer",
      detail: `${top.card.player || "Unknown Player"} is leading with ${money(top.profit)} profit.`,
      tone: "good",
    });
  }

  return insights.slice(0, 4);
}
