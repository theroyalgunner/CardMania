import { CollectionCard } from "@/services/collectionStore";

export type BulkStatus = "queued" | "scanning" | "ready" | "error" | "saved";
export type DetectionMode = "single" | "grid-2" | "grid-4" | "grid-9";

export type BulkInsight = {
  totalCards: number;
  selectedCards: number;
  readyCards: number;
  savedCards: number;
  errorCards: number;
  totalEstimatedValue: number;
  highestValueCard?: CollectionCard | null;
  rookieCount: number;
  premiumCount: number;
  averageConfidence: number;
};

export function premiumText(card: Partial<CollectionCard>) {
  return [card.player, card.set, card.parallel, card.serialNumber, card.notes, card.grade]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function isRookie(card: Partial<CollectionCard>) {
  return /\brookie\b|\brc\b/.test(premiumText(card));
}

export function isPremiumHit(card: Partial<CollectionCard>) {
  return /auto|autograph|patch|jersey|relic|case hit|ssp|superfractor|gold|red|black|orange|1\/1|\/5|\/10|\/25|\/50/.test(
    premiumText(card)
  );
}

export function queueProgress<T extends { status: BulkStatus }>(drafts: T[]) {
  if (!drafts.length) return 0;
  const done = drafts.filter((draft) => ["ready", "error", "saved"].includes(draft.status)).length;
  return Math.round((done / drafts.length) * 100);
}

export function bulkInsights<T extends CollectionCard & { selected?: boolean; status?: BulkStatus }>(drafts: T[]): BulkInsight {
  const highestValueCard = [...drafts].sort(
    (a, b) => Number(b.estimatedValue || 0) - Number(a.estimatedValue || 0)
  )[0] || null;
  const confidenceCards = drafts.filter((draft) => Number(draft.confidence || 0) > 0);

  return {
    totalCards: drafts.length,
    selectedCards: drafts.filter((draft) => draft.selected && draft.status !== "saved").length,
    readyCards: drafts.filter((draft) => draft.status === "ready").length,
    savedCards: drafts.filter((draft) => draft.status === "saved").length,
    errorCards: drafts.filter((draft) => draft.status === "error").length,
    totalEstimatedValue: Math.round(drafts.reduce((sum, draft) => sum + Number(draft.estimatedValue || 0), 0)),
    highestValueCard,
    rookieCount: drafts.filter(isRookie).length,
    premiumCount: drafts.filter(isPremiumHit).length,
    averageConfidence: confidenceCards.length
      ? Math.round((confidenceCards.reduce((sum, draft) => sum + Number(draft.confidence || 0), 0) / confidenceCards.length) * 100)
      : 0,
  };
}

export function detectionCells(mode: DetectionMode) {
  if (mode === "grid-2") return [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 1 }];
  if (mode === "grid-4") return [
    { x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.5, y: 0, w: 0.5, h: 0.5 },
    { x: 0, y: 0.5, w: 0.5, h: 0.5 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
  ];
  if (mode === "grid-9") return Array.from({ length: 9 }, (_, index) => ({
    x: (index % 3) / 3,
    y: Math.floor(index / 3) / 3,
    w: 1 / 3,
    h: 1 / 3,
  }));
  return [{ x: 0, y: 0, w: 1, h: 1 }];
}
