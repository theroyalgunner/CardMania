import { CollectionCard } from "@/services/collectionStore";

function clean(value?: string | number) {
  return String(value || "")
    .replace(/unknown/gi, "")
    .replace(/card\s*#/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(parts: Array<string | number | undefined>) {
  return parts
    .map((part) => clean(part))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function cardNumberToken(cardNumber?: string) {
  const value = clean(cardNumber);
  if (!value) return "";
  return value.startsWith("#") ? value : `#${value}`;
}

function serialDenominator(serialNumber?: string) {
  const value = clean(serialNumber);
  const match = value.match(/\/?(\d+)\s*\/\s*(\d+)/);
  if (!match) return value;
  return `/${match[2]}`;
}

export function buildQueries(card: Partial<CollectionCard>): string[] {
  const player = clean(card.player);
  const year = clean(card.year);
  const brand = clean(card.manufacturer);
  const set = clean(card.set);
  const parallel = clean(card.parallel);
  const serial = serialDenominator(card.serialNumber);
  const cardNo = cardNumberToken(card.cardNumber);
  const grade = clean(card.grade);
  const gradePart = grade && grade.toLowerCase() !== "raw" ? grade : "";

  const queries = [
    compact([player, year, brand, set, parallel, serial, cardNo, gradePart]),
    compact([player, year, brand, set, parallel, serial, cardNo]),
    compact([player, year, brand, set, parallel, serial]),
    compact([player, brand, set, parallel, serial, cardNo]),
    compact([player, brand, set, parallel, serial]),
    compact([player, brand, set, parallel]),
    compact([player, brand, set, cardNo]),
    compact([player, year, brand, set]),
    compact([player, brand, set]),
  ];

  return Array.from(new Set(queries.filter((query) => query.length > 8)));
}
