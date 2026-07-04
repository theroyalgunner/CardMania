import { CollectionCard } from "@/services/collectionStore";

export type CollectionSort =
  | "newest"
  | "oldest"
  | "value-desc"
  | "value-asc"
  | "profit-desc"
  | "profit-asc"
  | "player-az"
  | "year-desc";

export type CollectionFilterState = {
  query: string;
  manufacturer: string;
  team: string;
  year: string;
  grade: string;
  valueStatus: "all" | "valued" | "missing";
  sort: CollectionSort;
};

export const defaultCollectionFilters: CollectionFilterState = {
  query: "",
  manufacturer: "all",
  team: "all",
  year: "all",
  grade: "all",
  valueStatus: "all",
  sort: "newest",
};

function textOf(card: CollectionCard) {
  return [
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
    card.notes,
  ]
    .join(" ")
    .toLowerCase();
}

export function uniqueOptions(cards: CollectionCard[], key: keyof CollectionCard) {
  return Array.from(new Set(cards.map((card) => String(card[key] || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function cardProfit(card: CollectionCard) {
  return Number(card.estimatedValue || 0) - Number(card.purchasePrice || 0);
}

export function filterCollection(cards: CollectionCard[], filters: CollectionFilterState) {
  const q = filters.query.toLowerCase().trim();

  return cards.filter((card) => {
    if (q && !textOf(card).includes(q)) return false;
    if (filters.manufacturer !== "all" && card.manufacturer !== filters.manufacturer) return false;
    if (filters.team !== "all" && card.team !== filters.team) return false;
    if (filters.year !== "all" && String(card.year || "") !== filters.year) return false;
    if (filters.grade !== "all" && String(card.grade || "") !== filters.grade) return false;
    if (filters.valueStatus === "valued" && !Number(card.estimatedValue || 0)) return false;
    if (filters.valueStatus === "missing" && Number(card.estimatedValue || 0)) return false;
    return true;
  });
}

export function sortCollection(cards: CollectionCard[], sort: CollectionSort) {
  const list = [...cards];

  switch (sort) {
    case "oldest":
      return list.sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
    case "value-desc":
      return list.sort((a, b) => Number(b.estimatedValue || 0) - Number(a.estimatedValue || 0));
    case "value-asc":
      return list.sort((a, b) => Number(a.estimatedValue || 0) - Number(b.estimatedValue || 0));
    case "profit-desc":
      return list.sort((a, b) => cardProfit(b) - cardProfit(a));
    case "profit-asc":
      return list.sort((a, b) => cardProfit(a) - cardProfit(b));
    case "player-az":
      return list.sort((a, b) => String(a.player || "Unknown").localeCompare(String(b.player || "Unknown")));
    case "year-desc":
      return list.sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
    case "newest":
    default:
      return list.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }
}

export function applyCollectionView(cards: CollectionCard[], filters: CollectionFilterState) {
  return sortCollection(filterCollection(cards, filters), filters.sort);
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export function collectionToCsv(cards: CollectionCard[]) {
  const headers = ["Player", "Team", "Manufacturer", "Set", "Year", "Parallel", "Serial", "Card Number", "Grade", "Cost", "Value", "Profit", "Created"];
  const rows = cards.map((card) => [
    card.player,
    card.team,
    card.manufacturer,
    card.set,
    card.year,
    card.parallel,
    card.serialNumber,
    card.cardNumber,
    card.grade,
    card.purchasePrice || 0,
    card.estimatedValue || 0,
    cardProfit(card),
    card.createdAt,
  ]);

  return [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
}
