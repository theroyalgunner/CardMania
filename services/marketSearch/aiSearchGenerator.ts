import type { CollectionCard } from "@/services/collectionStore";
import { detectCardType } from "@/services/marketSearch/cardTypeDetector";

function clean(value?: string | number | null) {
  return String(value || "")
    .replace(/unknown/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: string[]) {
  return Array.from(new Set(values.map(clean).filter((v) => v.length > 3))).slice(0, 12);
}

function serialShort(value?: string | number | null) {
  const text = clean(value);
  const match = text.match(/\/\s*(\d+)/);
  return match ? `/${match[1]}` : text;
}

function initials(name?: string | null) {
  return clean(name)
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function generateAISearchQueries(card: Partial<CollectionCard>) {
  const player = clean(card.player);
  const year = clean(card.year);
  const maker = clean(card.manufacturer);
  const set = clean(card.set);
  const parallel = clean(card.parallel);
  const serial = serialShort(card.serialNumber);
  const cardNo = clean(card.cardNumber);
  const grade = clean(card.grade);
  const shortPlayer = initials(player);
  const profile = detectCardType(card);
  const typeTerms = [
    profile.isPatch || profile.isRelic ? "Patch" : "",
    profile.isRelic ? "Relic" : "",
    profile.isAuto ? "Auto" : "",
    profile.isRookie ? "RC" : "",
  ].filter(Boolean);

  const base = [player, year, maker, set, parallel, ...typeTerms, serial, cardNo].filter(Boolean).join(" ");

  return unique([
    base,
    [player, set, parallel, ...typeTerms, serial].filter(Boolean).join(" "),
    [player, maker, set, ...typeTerms, serial].filter(Boolean).join(" "),
    [player, parallel, serial, cardNo].filter(Boolean).join(" "),
    [player, cardNo, serial].filter(Boolean).join(" "),
    [shortPlayer, set, parallel, serial].filter(Boolean).join(" "),
    [player, set.replace(/panini|topps|upper deck/gi, ""), parallel, serial].filter(Boolean).join(" "),
    [player, maker, parallel, ...typeTerms, serial].filter(Boolean).join(" "),
    [player, set, grade].filter(Boolean).join(" "),
    [player, serial].filter(Boolean).join(" "),
  ]);
}
