import { CollectionCard } from "@/services/collectionStore";

function clean(value?: string) {
  return (value || "")
    .replace(/unknown/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildQueries(card: Partial<CollectionCard>): string[] {
  const player = clean(card.player);
  const year = clean(card.year);
  const brand = clean(card.manufacturer);
  const set = clean(card.set);
  const parallel = clean(card.parallel);
  const serial = clean(card.serialNumber);
  const cardNo = clean(card.cardNumber);

  const queries = [
    `${player} ${year} ${brand} ${set} ${parallel}`,
    `${player} ${brand} ${parallel}`,
    `${player} ${set} ${parallel}`,
    `${player} ${parallel}`,
    `${player} ${serial}`,
    `${player} ${cardNo}`,
    `${player} ${brand} ${set}`,
    `${player} ${year} ${brand}`,
  ];

  return [...new Set(
    queries
      .map(q => q.replace(/\s+/g, " ").trim())
      .filter(q => q.length > 8)
  )];
}