import type { CollectionCard } from "@/services/collectionStore";

function normalize(value?: string | number | boolean | null): string {
  if (value === undefined || value === null) return "";

  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function buildFingerprint(card: Partial<CollectionCard>): string {
  return [
    normalize(card.player),
    normalize(card.year),
    normalize(card.manufacturer),
    normalize(card.set),
    normalize(card.parallel),
    normalize(card.serialNumber),
    normalize(card.cardNumber),
    normalize(card.grade),
  ]
    .filter(Boolean)
    .join("|");
}