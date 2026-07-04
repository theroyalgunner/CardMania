export type MarketSale = {
  source: "manual" | "ebay" | "130point" | "comc" | "cardladder" | "psa";
  title: string;
  price: number;
  currency: "GBP" | "USD" | "EUR";
  soldAt?: string;
  url?: string;
};

export type MarketEstimate = {
  query: string;
  sales: MarketSale[];
  low: number;
  average: number;
  high: number;
  confidence: number;
  note: string;
};

function cleanQuery(parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function average(values: number[]) {
  if (!values.length) return 0;

  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length
  );
}

export function buildCardMarketQuery(card: {
  player?: string;
  team?: string;
  manufacturer?: string;
  set?: string;
  year?: string;
  parallel?: string;
  serialNumber?: string;
  cardNumber?: string;
  grade?: string;
}) {
  return cleanQuery([
    card.year,
    card.manufacturer,
    card.set,
    card.player,
    card.team,
    card.parallel,
    card.serialNumber,
    card.cardNumber ? `#${card.cardNumber}` : "",
    card.grade && card.grade !== "Raw" ? card.grade : "",
  ]);
}

export async function estimateCardMarketValue(card: {
  player?: string;
  team?: string;
  manufacturer?: string;
  set?: string;
  year?: string;
  parallel?: string;
  serialNumber?: string;
  cardNumber?: string;
  grade?: string;
}): Promise<MarketEstimate> {
  const query = buildCardMarketQuery(card);
  const sales: MarketSale[] = [];

  const prices = sales.map((sale) => sale.price).filter((price) => price > 0);

  return {
    query,
    sales,
    low: prices.length ? Math.min(...prices) : 0,
    average: average(prices),
    high: prices.length ? Math.max(...prices) : 0,
    confidence: prices.length >= 5 ? 0.85 : prices.length >= 2 ? 0.55 : 0.2,
    note:
      prices.length > 0
        ? "Market estimate based on recent comparable sales."
        : "No live market source connected yet. Add eBay/130point/COMC next.",
  };
}