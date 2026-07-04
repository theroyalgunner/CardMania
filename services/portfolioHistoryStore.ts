export type PortfolioHistoryPoint = {
  value: number;
  invested: number;
  profit: number;
  cards: number;
  createdAt: string;
};

const KEY = "cardmania_portfolio_history";

function safeParse(value: string | null): PortfolioHistoryPoint[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getPortfolioHistory() {
  if (typeof window === "undefined") return [];
  return safeParse(localStorage.getItem(KEY));
}

export function addPortfolioSnapshot(snapshot: Omit<PortfolioHistoryPoint, "createdAt">) {
  if (typeof window === "undefined") return;
  if (!snapshot.cards && !snapshot.value && !snapshot.invested) return;

  const today = new Date().toISOString().slice(0, 10);
  const current = getPortfolioHistory();
  const withoutToday = current.filter((point) => point.createdAt.slice(0, 10) !== today);
  const next: PortfolioHistoryPoint[] = [
    { ...snapshot, createdAt: new Date().toISOString() },
    ...withoutToday,
  ].slice(0, 365);

  localStorage.setItem(KEY, JSON.stringify(next));
}

export function portfolioMovement(points: PortfolioHistoryPoint[]) {
  const latest = points[0];
  const previous = points[1];
  if (!latest || !previous) return { valueChange: 0, profitChange: 0, percentChange: 0 };
  const valueChange = latest.value - previous.value;
  const profitChange = latest.profit - previous.profit;
  const percentChange = previous.value ? Math.round((valueChange / previous.value) * 100) : 0;
  return { valueChange, profitChange, percentChange };
}
