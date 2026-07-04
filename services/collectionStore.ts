export type CollectionCard = {
  id: string;
  image?: string;
  backImage?: string;
  player?: string;
  team?: string;
  manufacturer?: string;
  league?: string;
  country?: string;
  set?: string;
  year?: string;
  parallel?: string;
  serialNumber?: string;
  cardNumber?: string;
  grade?: string;
  condition?: string;
  notes?: string;
  purchasePrice?: number;
  estimatedValue?: number;
  confidence?: number;
  source?: "scanner" | "manual" | "bulk" | "import";
  createdAt: string;
  updatedAt?: string;
};

const KEY = "cardmania_collection";

function safeParse(value: string | null): CollectionCard[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getCollection(): CollectionCard[] {
  if (typeof window === "undefined") return [];
  return safeParse(localStorage.getItem(KEY));
}

export function saveCollection(cards: CollectionCard[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(cards));
}

export function addToCollection(card: CollectionCard) {
  const current = getCollection();
  saveCollection([{ ...card, updatedAt: new Date().toISOString() }, ...current]);
}

export function deleteFromCollection(id: string) {
  saveCollection(getCollection().filter((card) => card.id !== id));
}

export function getCardById(id: string) {
  return getCollection().find((card) => card.id === id) || null;
}

export function updateCard(id: string, updates: Partial<CollectionCard>) {
  const updated = getCollection().map((card) =>
    card.id === id ? { ...card, ...updates, updatedAt: new Date().toISOString() } : card
  );
  saveCollection(updated);
}

export function searchCollection(query: string, cards = getCollection()) {
  const q = query.trim().toLowerCase();
  if (!q) return cards;

  return cards.filter((card) =>
    [
      card.player,
      card.team,
      card.manufacturer,
      card.league,
      card.country,
      card.set,
      card.parallel,
      card.serialNumber,
      card.cardNumber,
      card.grade,
      card.condition,
      card.year,
    ]
      .join(" ")
      .toLowerCase()
      .includes(q)
  );
}

export function getCollectionStats(cards = getCollection()) {
  const estimatedValue = cards.reduce((sum, card) => sum + Number(card.estimatedValue || 0), 0);
  const purchaseValue = cards.reduce((sum, card) => sum + Number(card.purchasePrice || 0), 0);
  const profit = estimatedValue - purchaseValue;
  const averageValue = cards.length ? Math.round(estimatedValue / cards.length) : 0;
  const mostValuable = [...cards].sort((a, b) => Number(b.estimatedValue || 0) - Number(a.estimatedValue || 0))[0] || null;
  const highestProfit = [...cards].sort(
    (a, b) =>
      Number(b.estimatedValue || 0) - Number(b.purchasePrice || 0) -
      (Number(a.estimatedValue || 0) - Number(a.purchasePrice || 0))
  )[0] || null;

  return {
    totalCards: cards.length,
    estimatedValue,
    purchaseValue,
    profit,
    profitPercent: purchaseValue ? Math.round((profit / purchaseValue) * 100) : 0,
    averageValue,
    latestCard: cards[0] || null,
    mostValuable,
    highestProfit,
  };
}

export function exportCollection() {
  return JSON.stringify(getCollection(), null, 2);
}

export function importCollection(json: string) {
  const parsed = safeParse(json);
  saveCollection(parsed);
  return parsed;
}
