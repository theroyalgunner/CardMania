import type { CollectionCard } from "@/services/collectionStore";

export interface CardSearchProfile {
  player: string;
  year?: string;
  manufacturer?: string;
  set?: string;

  isPatch: boolean;
  isAuto: boolean;
  isPatchAuto: boolean;
  isRelic: boolean;
  isRookie: boolean;
  isGraded: boolean;

  serial?: string;
  grade?: string;

  requiredTerms: string[];
  optionalTerms: string[];
}

function clean(value?: string | number | null) {
  return String(value || "").trim();
}

function lower(value?: string | number | null) {
  return clean(value).toLowerCase();
}

function hasAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word.toLowerCase()));
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((v) => clean(v)).filter(Boolean)));
}

export function detectCardType(card: Partial<CollectionCard>): CardSearchProfile {
  const combined = [
    card.player,
    card.manufacturer,
    card.set,
    card.parallel,
    card.serialNumber,
    card.cardNumber,
    card.grade,
    card.notes,
  ]
    .map(lower)
    .join(" ");

  const patchWords = ["patch", "player worn", "player-worn", "game worn", "game-worn", "relic", "memorabilia", "jersey", "fabric", "swatch"];
  const autoWords = ["auto", "autograph", "signed", "on card", "on-card", "sticker auto"];
  const rookieWords = ["rookie", " rc ", " rc", "rc "];
  const gradedWords = ["psa", "bgs", "sgc", "cgc"];

  const isPatch = hasAny(combined, patchWords);
  const isRelic = hasAny(combined, ["relic", "memorabilia", "jersey", "fabric", "swatch", "player worn", "player-worn", "game worn", "game-worn"]);
  const isAuto = hasAny(combined, autoWords);
  const isRookie = hasAny(` ${combined} `, rookieWords);
  const isGraded = hasAny(combined, gradedWords) || Boolean(card.grade);

  const requiredTerms = unique([
    card.player || "",
    card.set || "",
    isPatch || isRelic ? "Patch" : "",
    isAuto ? "Auto" : "",
    isRookie ? "RC" : "",
  ]);

  const optionalTerms = unique([
    card.year ? String(card.year) : "",
    card.manufacturer || "",
    card.parallel || "",
    card.serialNumber || "",
    card.cardNumber ? `#${card.cardNumber}` : "",
    card.grade || "",
  ]);

  return {
    player: clean(card.player) || "Unknown Player",
    year: clean(card.year),
    manufacturer: clean(card.manufacturer),
    set: clean(card.set),

    isPatch,
    isAuto,
    isPatchAuto: isPatch && isAuto,
    isRelic,
    isRookie,
    isGraded,

    serial: clean(card.serialNumber),
    grade: clean(card.grade),

    requiredTerms,
    optionalTerms,
  };
}
