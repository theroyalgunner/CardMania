import { CollectionCard } from "@/services/collectionStore";

export type SmartCardSuggestion = Partial<CollectionCard> & {
  product?: string;
  confidence?: number;
  reason?: string;
};

type PlayerRow = [keyword: string, player: string, team: string, country: string, league: string];
type TeamRow = [keyword: string, team: string, league: string];

const PLAYERS: PlayerRow[] = [
  ["jude bellingham", "Jude Bellingham", "Real Madrid", "England", "LaLiga"],
  ["bellingham", "Jude Bellingham", "Real Madrid", "England", "LaLiga"],
  ["lamine yamal", "Lamine Yamal", "FC Barcelona", "Spain", "LaLiga"],
  ["yamal", "Lamine Yamal", "FC Barcelona", "Spain", "LaLiga"],
  ["lionel messi", "Lionel Messi", "Inter Miami", "Argentina", "MLS"],
  ["messi", "Lionel Messi", "Inter Miami", "Argentina", "MLS"],
  ["cristiano ronaldo", "Cristiano Ronaldo", "Al Nassr", "Portugal", "Saudi Pro League"],
  ["ronaldo", "Cristiano Ronaldo", "Al Nassr", "Portugal", "Saudi Pro League"],
  ["cr7", "Cristiano Ronaldo", "Al Nassr", "Portugal", "Saudi Pro League"],
  ["kylian mbappe", "Kylian Mbappé", "Real Madrid", "France", "LaLiga"],
  ["mbappe", "Kylian Mbappé", "Real Madrid", "France", "LaLiga"],
  ["erling haaland", "Erling Haaland", "Manchester City", "Norway", "Premier League"],
  ["haaland", "Erling Haaland", "Manchester City", "Norway", "Premier League"],
  ["vinicius junior", "Vinícius Júnior", "Real Madrid", "Brazil", "LaLiga"],
  ["vinicius", "Vinícius Júnior", "Real Madrid", "Brazil", "LaLiga"],
  ["vini jr", "Vinícius Júnior", "Real Madrid", "Brazil", "LaLiga"],
  ["zinedine zidane", "Zinedine Zidane", "France", "France", "International"],
  ["zidane", "Zinedine Zidane", "France", "France", "International"],
  ["ronaldinho", "Ronaldinho", "Brazil", "Brazil", "International"],
  ["ronaldiho", "Ronaldinho", "Brazil", "Brazil", "International"],
  ["r9", "Ronaldo Nazário", "Brazil", "Brazil", "International"],
  ["ronaldo nazario", "Ronaldo Nazário", "Brazil", "Brazil", "International"],
];

const TEAMS: TeamRow[] = [
  ["real madrid", "Real Madrid", "LaLiga"],
  ["madrid", "Real Madrid", "LaLiga"],
  ["barcelona", "FC Barcelona", "LaLiga"],
  ["fc barcelona", "FC Barcelona", "LaLiga"],
  ["manchester city", "Manchester City", "Premier League"],
  ["man city", "Manchester City", "Premier League"],
  ["inter miami", "Inter Miami", "MLS"],
  ["al nassr", "Al Nassr", "Saudi Pro League"],
  ["psg", "Paris Saint-Germain", "Ligue 1"],
  ["paris saint", "Paris Saint-Germain", "Ligue 1"],
  ["arsenal", "Arsenal", "Premier League"],
  ["liverpool", "Liverpool", "Premier League"],
  ["brazil", "Brazil", "International"],
  ["france", "France", "International"],
  ["england", "England", "International"],
];

const MANUFACTURERS = ["Topps", "Panini", "Futera", "Leaf", "Upper Deck", "Merlin", "Donruss", "Prizm"];

const PARALLELS = [
  "Gold Refractor",
  "Orange Refractor",
  "Red Refractor",
  "Purple Refractor",
  "Blue Refractor",
  "Green Refractor",
  "Black Refractor",
  "Aqua Refractor",
  "Pink Refractor",
  "Silver Refractor",
  "X-Fractor",
  "Mojo Refractor",
  "Sapphire",
  "Cracked Ice",
  "Ice",
  "Speckle",
  "Wave",
  "Lava",
  "Atomic",
  "Legendary",
  "Gold",
  "Orange",
  "Red",
  "Purple",
  "Blue",
  "Green",
  "Black",
  "Aqua",
  "Pink",
  "Silver",
  "Refractor",
  "Auto",
  "Autograph",
  "Patch",
  "Jersey",
  "Relic",
  "Printing Plate",
];

function normalize(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[_\-.]+/g, " ")
    .replace(/[^a-z0-9/# ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueWords(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function parseCardNumber(rawText: string) {
  const explicit = rawText.match(/(?:card\s*(?:no\.?|number|#)|#)\s*([A-Z]{0,6}\d{1,5}[A-Z]?)\b/i);
  if (explicit) return explicit[1].toUpperCase();

  const chromeStyle = rawText.match(/\b([A-Z]{1,5}-?\d{1,4})\b/);
  if (chromeStyle && !/^\d{4}$/.test(chromeStyle[1])) return chromeStyle[1].toUpperCase();

  return "";
}

export function inferCardFromText(rawText: string): SmartCardSuggestion {
  const lower = normalize(rawText);
  const suggestion: SmartCardSuggestion = {};
  const reasons: string[] = [];

  const player = PLAYERS.find(([keyword]) => lower.includes(normalize(keyword)));
  if (player) {
    suggestion.player = player[1];
    suggestion.team = player[2];
    suggestion.country = player[3];
    suggestion.league = player[4];
    reasons.push(`player: ${player[1]}`);
  }

  const team = TEAMS.find(([keyword]) => lower.includes(normalize(keyword)));
  if (team) {
    suggestion.team = team[1];
    suggestion.league = suggestion.league || team[2];
    reasons.push(`team: ${team[1]}`);
  }

  const manufacturer = MANUFACTURERS.find((name) => lower.includes(normalize(name)));
  if (manufacturer) {
    suggestion.manufacturer = manufacturer === "Merlin" ? "Topps" : manufacturer;
    reasons.push(`manufacturer: ${suggestion.manufacturer}`);
  }

  if (lower.includes("topps chrome") || lower.includes("chrome uefa") || lower.includes("uefa club competitions")) {
    suggestion.manufacturer = suggestion.manufacturer || "Topps";
    suggestion.set = "Topps Chrome UEFA";
    suggestion.product = "Topps Chrome UEFA";
    reasons.push("set: Topps Chrome UEFA");
  } else if (lower.includes("merlin")) {
    suggestion.manufacturer = suggestion.manufacturer || "Topps";
    suggestion.set = "Topps Merlin UEFA";
    suggestion.product = "Topps Merlin UEFA";
    reasons.push("set: Topps Merlin UEFA");
  } else if (lower.includes("prizm")) {
    suggestion.manufacturer = suggestion.manufacturer || "Panini";
    suggestion.set = "Panini Prizm";
    suggestion.product = "Panini Prizm";
    reasons.push("set: Panini Prizm");
  } else if (lower.includes("donruss")) {
    suggestion.manufacturer = suggestion.manufacturer || "Panini";
    suggestion.set = "Panini Donruss";
    suggestion.product = "Panini Donruss";
    reasons.push("set: Panini Donruss");
  }

  const year = rawText.match(/\b(19\d{2}|20\d{2})\b/);
  if (year) {
    suggestion.year = year[1];
    reasons.push(`year: ${year[1]}`);
  }

  const serial = rawText.match(/\b(\d{1,4})\s*\/\s*(\d{1,4})\b/);
  if (serial) {
    suggestion.serialNumber = `${serial[1]}/${serial[2]}`;
    reasons.push(`serial: ${suggestion.serialNumber}`);
  }

  const cardNumber = parseCardNumber(rawText);
  if (cardNumber) {
    suggestion.cardNumber = cardNumber;
    reasons.push(`card #: ${cardNumber}`);
  }

  const parallelHits = PARALLELS.filter((name) => lower.includes(normalize(name)));
  const mergedParallel = uniqueWords(parallelHits).join(" ").replace(/Refractor Refractor/g, "Refractor").trim();

  if (mergedParallel) {
    let value = mergedParallel;
    if (suggestion.serialNumber) {
      const run = suggestion.serialNumber.split("/")[1];
      if (run && !value.includes(`/${run}`)) value = `${value} /${run}`;
    }
    suggestion.parallel = value;
    reasons.push(`parallel: ${value}`);
  } else if (suggestion.serialNumber) {
    const run = Number(suggestion.serialNumber.split("/")[1]);
    if (run === 50) suggestion.parallel = "Gold Refractor /50";
    if (run === 25) suggestion.parallel = "Purple Refractor /25";
    if (run === 10) suggestion.parallel = "Red Refractor /10";
    if (run === 5) suggestion.parallel = "Orange Refractor /5";
    if (suggestion.parallel) reasons.push(`parallel: ${suggestion.parallel}`);
  }

  const flags: string[] = [];
  if (/\b(rc|rookie|rookie card)\b/i.test(rawText)) flags.push("Rookie card");
  if (/\b(auto|autograph|signed)\b/i.test(rawText)) flags.push("Autograph");
  if (/\b(patch|jersey|relic|match worn|player worn)\b/i.test(rawText)) flags.push("Patch/Jersey relic");
  if (/\bprinting plate\b/i.test(rawText)) flags.push("Printing plate");
  if (flags.length) suggestion.notes = flags.join(" • ");

  const hits = Object.keys(suggestion).filter((key) => !["reason", "confidence", "notes"].includes(key)).length;
  suggestion.confidence = Math.min(0.95, Math.max(0.2, hits / 9));
  suggestion.reason = reasons.length ? `Smart fill detected ${reasons.join(", ")}.` : "No strong text clues detected yet.";

  return suggestion;
}

export function inferCardFromFileName(fileName: string) {
  return inferCardFromText(fileName);
}

export function mergeSuggestionIntoForm<T extends Record<string, string>>(form: T, suggestion: SmartCardSuggestion): T {
  const notes = [form.notes, suggestion.notes, suggestion.reason].filter(Boolean).join("\n");

  return {
    ...form,
    player: form.player || suggestion.player || "",
    team: form.team || suggestion.team || "",
    manufacturer: form.manufacturer || suggestion.manufacturer || "",
    set: form.set || suggestion.set || suggestion.product || "",
    year: form.year || String(suggestion.year || ""),
    parallel: form.parallel || suggestion.parallel || "",
    serialNumber: form.serialNumber || suggestion.serialNumber || "",
    cardNumber: form.cardNumber || suggestion.cardNumber || "",
    grade: form.grade || suggestion.grade || "Raw",
    notes,
  };
}
