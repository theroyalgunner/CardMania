import { CollectionCard } from "./collectionStore";

const PLAYER_TIERS: Array<[string[], number]> = [
  [["messi", "cristiano", "ronaldo", "pele", "maradona"], 6],
  [["ronaldinho", "zidane", "beckham", "neymar", "mbappe", "haaland"], 4.2],
  [["yamal", "bellingham", "vinicius", "vini", "musiala", "endrick", "guler", "saka", "pedri"], 3.2],
  [["foden", "wirtz", "osimhen", "kane", "salah", "son", "de bruyne"], 2.4],
];

const BRAND_MULTIPLIERS: Array<[string[], number]> = [
  [["topps chrome", "chrome sapphire", "sapphire"], 1.8],
  [["topps finest", "merlin", "stadium club chrome"], 1.45],
  [["panini prizm", "prizm", "select", "optic"], 1.5],
  [["futera", "museum", "obsidian", "immaculate", "flawless", "national treasures"], 2.1],
  [["match attax", "adrenalyn"], 0.75],
];

const FEATURE_MULTIPLIERS: Array<[string[], number]> = [
  [["superfractor", "1/1", "one of one", "printing plate"], 20],
  [["black", "red", "gold vinyl"], 6],
  [["orange", "gold"], 4],
  [["purple", "blue", "green"], 2.1],
  [["refractor", "x-fractor", "speckle", "wave", "shimmer", "mojo"], 1.7],
  [["auto", "autograph", "signed"], 3.8],
  [["patch", "jersey", "relic", "memorabilia"], 2.7],
  [["rookie", " rc ", "debut"], 2.2],
  [["ssp", "sp", "case hit", "kaboom", "downtown", "color blast"], 4.5],
];

function normalizeText(card: Partial<CollectionCard>) {
  return [
    card.player,
    card.team,
    card.manufacturer,
    card.set,
    card.year,
    card.parallel,
    card.serialNumber,
    card.cardNumber,
    card.grade,
    card.condition,
    card.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function has(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function bestMultiplier(text: string, rules: Array<[string[], number]>, fallback = 1) {
  return rules.reduce((value, [terms, mult]) => (has(text, terms) ? Math.max(value, mult) : value), fallback);
}

function serialMultiplier(serial?: string, combinedText = "") {
  const text = `${serial || ""} ${combinedText}`;
  if (/(^|\s)1\s*\/\s*1(\s|$)|1\/1|one of one|superfractor|printing plate/i.test(text)) return 20;

  const match = text.match(/(?:^|\s)(\d{1,4})\s*\/\s*(\d{1,4})(?:\s|$)/);
  if (!match) return 1;

  const cardNo = Number(match[1]);
  const run = Number(match[2]);
  let mult = 1;

  if (run <= 5) mult = 9;
  else if (run <= 10) mult = 6;
  else if (run <= 25) mult = 4;
  else if (run <= 50) mult = 3;
  else if (run <= 99) mult = 2;
  else if (run <= 199) mult = 1.45;
  else mult = 1.15;

  if (cardNo === 1 || cardNo === run) mult *= 1.2;
  if (cardNo === 10 || cardNo === 7) mult *= 1.08;

  return mult;
}

function gradeMultiplier(grade?: string) {
  const g = String(grade || "raw").toLowerCase();
  if (g.includes("psa 10") || g.includes("sgc 10") || g.includes("bgs 10") || g.includes("black label")) return 4.2;
  if (g.includes("psa 9") || g.includes("bgs 9.5") || g.includes("sgc 9.5")) return 2.1;
  if (g.includes("psa 8") || g.includes("bgs 9") || g.includes("sgc 9")) return 1.35;
  if (g.includes("graded")) return 1.6;
  return 1;
}

function ageMultiplier(year?: string) {
  const y = Number(String(year || "").match(/\d{4}/)?.[0] || 0);
  if (!y) return 1;
  if (y < 1990) return 2;
  if (y < 2005) return 1.6;
  if (y < 2015) return 1.25;
  if (y >= 2023) return 1.08;
  return 1;
}

function detailCompleteness(card: Partial<CollectionCard>) {
  const fields = [card.player, card.manufacturer, card.set, card.year, card.parallel, card.serialNumber, card.grade];
  return fields.filter(Boolean).length / fields.length;
}

function stableVariation(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) % 997;
  return 0.85 + (hash % 35) / 100;
}

export function estimateCardValue(card: Partial<CollectionCard>) {
  const text = normalizeText(card);

  // If a live/manual value already exists, keep it unless it is the old placeholder value.
  const existing = Number(card.estimatedValue || 0);
  if (existing > 0 && existing !== 10) return Math.round(existing);

  const premiumSignals = ["gold", "orange", "red", "black", "refractor", "auto", "patch", "rookie", "/", "ssp", "1/1"];
  const hasPremium = has(text, premiumSignals);

  let base = 8;
  if (card.player) base += 5;
  if (card.manufacturer || card.set) base += 6;
  if (hasPremium) base += 10;
  if (card.serialNumber) base += 8;
  if (String(card.grade || "").toLowerCase() !== "raw" && card.grade) base += 10;

  const player = bestMultiplier(text, PLAYER_TIERS, card.player ? 1.25 : 1);
  const brand = bestMultiplier(text, BRAND_MULTIPLIERS, 1);
  const feature = bestMultiplier(text, FEATURE_MULTIPLIERS, 1);
  const serial = serialMultiplier(card.serialNumber, text);
  const grade = gradeMultiplier(card.grade);
  const age = ageMultiplier(card.year);
  const completeness = 0.8 + detailCompleteness(card) * 0.45;
  const variation = stableVariation(text || card.id || "cardmania");

  const raw = base * player * brand * feature * serial * grade * age * completeness * variation;

  // Keep unknown simple cards affordable, but stop every card becoming exactly £10.
  return Math.max(5, Math.min(250000, Math.round(raw)));
}

export function valuationConfidence(card: Partial<CollectionCard>) {
  const completeness = detailCompleteness(card);
  const text = normalizeText(card);
  if (completeness >= 0.8 && (card.serialNumber || has(text, ["refractor", "auto", "patch", "rookie"]))) return "Medium";
  if (completeness >= 0.55) return "Low-Medium";
  return "Low";
}

export function profitFor(card: Partial<CollectionCard>) {
  return Number(card.estimatedValue || 0) - Number(card.purchasePrice || 0);
}

export function profitLabel(card: Partial<CollectionCard>) {
  const profit = profitFor(card);
  return `${profit >= 0 ? "+" : "-"}£${Math.abs(profit).toLocaleString()}`;
}
