import { inferCardFromText } from "@/services/cardAutofill";

export type ScannerProvider = "openai" | "gemini" | "smart-fill";

export type ScannerOcr = {
  frontText: string;
  backText: string;
  importantClues: string[];
};

export type ScannerQuality = {
  score: number;
  label: "High" | "Medium" | "Low" | "Manual review";
  missingFields: string[];
  strengths: string[];
  warnings: string[];
};

export type ScannerCard = {
  player: string;
  team: string;
  manufacturer: string;
  product: string;
  set: string;
  year: string;
  parallel: string;
  serialNumber: string;
  cardNumber: string;
  league: string;
  country: string;
  grade: string;
  confidence: number;
  notes: string;
  conditionEstimate?: "Mint" | "Near Mint" | "Excellent" | "Played" | "Unknown";
  ocr?: ScannerOcr;
  searchQuery?: string;
  features: {
    rookie: boolean;
    autograph: boolean;
    patch: boolean;
    jersey: boolean;
    relic: boolean;
    numbered: boolean;
    oneOfOne: boolean;
    parallel: boolean;
  };
  quality: ScannerQuality;
};

export const UNKNOWN_CARD: ScannerCard = {
  player: "Unknown Player",
  team: "Unknown Team",
  manufacturer: "Unknown",
  product: "",
  set: "",
  year: "",
  parallel: "",
  serialNumber: "",
  cardNumber: "",
  league: "",
  country: "",
  grade: "Raw",
  confidence: 0,
  notes: "Scanner could not identify the card confidently. Review and complete the fields manually.",
  conditionEstimate: "Unknown",
  ocr: { frontText: "", backText: "", importantClues: [] },
  searchQuery: "",
  features: {
    rookie: false,
    autograph: false,
    patch: false,
    jersey: false,
    relic: false,
    numbered: false,
    oneOfOne: false,
    parallel: false,
  },
  quality: {
    score: 0,
    label: "Manual review",
    missingFields: ["player", "set", "year", "cardNumber"],
    strengths: [],
    warnings: ["No confident scanner result."],
  },
};

const KNOWN_MANUFACTURERS = [
  "Topps",
  "Panini",
  "Futera",
  "Leaf",
  "Upper Deck",
  "Donruss",
  "Bowman",
  "Merlin",
  "Prizm",
  "Select",
  "Optic",
  "Obsidian",
  "Immaculate",
  "Flawless",
  "National Treasures",
];

const PARALLEL_TERMS = [
  "superfractor",
  "gold vinyl",
  "gold",
  "orange",
  "red",
  "black",
  "blue",
  "green",
  "purple",
  "sapphire",
  "mojo",
  "wave",
  "shimmer",
  "speckle",
  "x-fractor",
  "refractor",
  "cracked ice",
  "laser",
  "scope",
  "atomic",
  "silver",
  "prizm",
  "sepia",
  "aqua",
  "pink",
  "ruby",
  "emerald",
];

function clampConfidence(value: unknown) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

function cleanJson(text: string) {
  return String(text || "").replace(/```json/gi, "").replace(/```/g, "").trim();
}

function titleCase(value: string) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizedUnknown(value?: string) {
  const text = String(value || "").trim().toLowerCase();
  return !text || text === "unknown" || text === "unknown player" || text === "unknown team" || text === "n/a";
}

function textFromCard(card: Partial<ScannerCard>) {
  return [
    card.player,
    card.team,
    card.manufacturer,
    card.product,
    card.set,
    card.year,
    card.parallel,
    card.serialNumber,
    card.cardNumber,
    card.notes,
    card.ocr?.frontText,
    card.ocr?.backText,
    ...(card.ocr?.importantClues || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function extractSerial(text: string) {
  const match = String(text || "").match(/\b(?:0?\d{1,4})\s*\/\s*(?:0?\d{1,5})\b/i);
  return match ? match[0].replace(/\s+/g, "") : "";
}

function extractYear(text: string) {
  const match = String(text || "").match(/\b(19[5-9]\d|20[0-4]\d)\b/);
  return match ? match[1] : "";
}

function extractCardNumber(text: string) {
  const value = String(text || "");
  const hashMatch = value.match(/(?:card\s*(?:no\.?|number|#)|#)\s*([A-Z]{0,6}[- ]?\d{1,4}[A-Z]?)/i);
  if (hashMatch) return hashMatch[1].replace(/\s+/g, "");
  const codeMatch = value.match(/\b([A-Z]{2,6}[-]\d{1,4}[A-Z]?)\b/);
  return codeMatch ? codeMatch[1] : "";
}

function inferManufacturer(text: string, current?: string) {
  if (!normalizedUnknown(current)) return String(current);
  const lower = text.toLowerCase();
  const found = KNOWN_MANUFACTURERS.find((brand) => lower.includes(brand.toLowerCase()));
  return found || "Unknown";
}

function inferParallel(text: string, current?: string) {
  const existing = String(current || "").trim();
  const lower = text.toLowerCase();
  const terms = PARALLEL_TERMS.filter((term) => lower.includes(term));
  const serial = extractSerial(text);
  const numbered = serial ? `/${serial.split("/")[1]}` : "";
  const combined = [existing, ...terms.map(titleCase), numbered].filter(Boolean).join(" ");
  return Array.from(new Set(combined.split(" ").filter(Boolean))).join(" ");
}

function buildSearchQueryFromCard(card: Partial<ScannerCard>) {
  return [
    normalizedUnknown(card.player) ? "" : card.player,
    card.year,
    normalizedUnknown(card.manufacturer) ? "" : card.manufacturer,
    card.set || card.product,
    card.parallel,
    card.serialNumber,
    card.cardNumber ? `#${card.cardNumber}` : "",
    card.grade && card.grade !== "Raw" ? card.grade : "",
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeFeatureBooleans(card: Partial<ScannerCard>): ScannerCard["features"] {
  const text = textFromCard(card);
  const serialNumber = String(card.serialNumber || "");
  const serialText = serialNumber || text;

  return {
    rookie: Boolean(card.features?.rookie) || /\b(rc|rookie|debut|first)\b/i.test(text),
    autograph: Boolean(card.features?.autograph) || /\b(auto|autograph|signed|signature|on card auto|sticker auto)\b/i.test(text),
    patch: Boolean(card.features?.patch) || /\bpatch|logo patch|jumbo patch\b/i.test(text),
    jersey: Boolean(card.features?.jersey) || /\bjersey|kit|shirt|swatch\b/i.test(text),
    relic: Boolean(card.features?.relic) || /\brelic|memorabilia|match worn|player worn|game used\b/i.test(text),
    numbered: Boolean(card.features?.numbered) || /\b\d{1,4}\s*\/\s*\d{1,5}\b/.test(serialText),
    oneOfOne: Boolean(card.features?.oneOfOne) || /\b(1\s*\/\s*1|one of one|1-of-1|superfractor|printing plate)\b/i.test(serialText),
    parallel: Boolean(card.features?.parallel) || Boolean(card.parallel) || PARALLEL_TERMS.some((term) => text.includes(term)),
  };
}

function qualityFromCard(card: Partial<ScannerCard>): ScannerQuality {
  const required: Array<[keyof ScannerCard, string]> = [
    ["player", "player"],
    ["set", "set/product"],
    ["year", "year"],
    ["manufacturer", "manufacturer"],
    ["cardNumber", "card number"],
  ];

  const missingFields = required
    .filter(([key]) => normalizedUnknown(String(card[key] || "")))
    .map(([, label]) => label);

  const strengths: string[] = [];
  const warnings: string[] = [];
  const features = normalizeFeatureBooleans(card);
  const confidence = clampConfidence(card.confidence);

  if (!normalizedUnknown(card.player)) strengths.push("Player identified");
  if (card.set || card.product) strengths.push("Set/product clue found");
  if (card.year) strengths.push("Year found");
  if (card.cardNumber) strengths.push("Card number found");
  if (features.numbered) strengths.push("Serial-numbered card detected");
  if (features.autograph) strengths.push("Autograph flag detected");
  if (features.patch || features.jersey || features.relic) strengths.push("Relic/patch flag detected");
  if (confidence < 0.35) warnings.push("Low AI confidence");
  if (missingFields.length) warnings.push(`Missing: ${missingFields.join(", ")}`);
  if (!card.ocr?.frontText && !card.ocr?.backText) warnings.push("OCR text not returned by provider");

  const completeness = 1 - missingFields.length / required.length;
  const featureBonus = Math.min(10, strengths.length * 1.5);
  const score = Math.round(Math.max(0, Math.min(100, confidence * 65 + completeness * 25 + featureBonus)));
  const label = score >= 80 ? "High" : score >= 55 ? "Medium" : score >= 30 ? "Low" : "Manual review";

  return { score, label, missingFields, strengths, warnings };
}

export function normalizeScannerCard(input: any): ScannerCard {
  const card: Partial<ScannerCard> = typeof input === "object" && input ? input : {};
  const combinedText = textFromCard(card);
  const serialNumber = String(card.serialNumber || extractSerial(combinedText) || "");
  const year = String(card.year || extractYear(combinedText) || "");
  const cardNumber = String(card.cardNumber || extractCardNumber(combinedText) || "");
  const manufacturer = inferManufacturer(combinedText, card.manufacturer);
  const parallel = inferParallel(combinedText, card.parallel);
  const features = normalizeFeatureBooleans({ ...card, serialNumber, parallel });

  const next: ScannerCard = {
    ...UNKNOWN_CARD,
    ...card,
    player: normalizedUnknown(card.player) ? UNKNOWN_CARD.player : titleCase(String(card.player)),
    team: normalizedUnknown(card.team) ? UNKNOWN_CARD.team : titleCase(String(card.team)),
    manufacturer,
    product: String(card.product || ""),
    set: String(card.set || card.product || ""),
    year,
    parallel,
    serialNumber,
    cardNumber,
    league: String(card.league || ""),
    country: String(card.country || ""),
    grade: String(card.grade || "Raw"),
    confidence: clampConfidence(card.confidence),
    notes: String(card.notes || UNKNOWN_CARD.notes),
    conditionEstimate: (card.conditionEstimate as ScannerCard["conditionEstimate"]) || "Unknown",
    ocr: {
      frontText: String(card.ocr?.frontText || ""),
      backText: String(card.ocr?.backText || ""),
      importantClues: Array.isArray(card.ocr?.importantClues) ? card.ocr!.importantClues.map(String).slice(0, 8) : [],
    },
    searchQuery: String(card.searchQuery || ""),
    features,
    quality: UNKNOWN_CARD.quality,
  };

  next.searchQuery = next.searchQuery || buildSearchQueryFromCard(next);
  next.quality = qualityFromCard(next);
  return next;
}

export function parseScannerJson(text: string) {
  const cleaned = cleanJson(text);
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const json = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(json);
}

export function buildScannerPrompt(visibleText = "") {
  return `You are CardMania Real AI Card Identification V4.1, a specialist sports trading-card recognition engine.
Analyze the front image, optional back image, and visible text. Identify only what is supported by image/text evidence.

Visible text, seller title, or file title:
${String(visibleText || "").slice(0, 2000)}

Primary goal:
Identify the exact card as far as the evidence allows. Use the front image first, back image second, and visible text third. If the exact set, year, or parallel is uncertain, state uncertainty in notes and lower confidence.

Recognition priorities:
1. Player/person name
2. Team, club, country, or league
3. Manufacturer/brand
4. Product/set
5. Year or copyright year
6. Card number
7. Parallel/color/refractor pattern
8. Serial numbering, e.g. 07/50, 1/1, 12/25
9. Rookie, autograph, patch, jersey, relic, numbered, one-of-one
10. Condition estimate only if visible

Strict rules:
- Return ONLY valid JSON. No markdown.
- Do not invent a famous player unless the face, printed name, shirt, badge, team, or back text supports it.
- Prefer exact back-card information for manufacturer, product, set, year, cardNumber, and copyright text.
- Preserve serial numbers exactly, for example "07/50", "12/25", or "1/1".
- cardNumber means the actual printed card number only, such as "118", "UCC-12", "SS-7".
- parallel must include only visible or strongly implied attributes such as Gold Refractor, Purple, Sapphire, Mojo, Auto, Patch, Jersey, Cracked Ice, numbered /50.
- If the image only shows a generic base card, leave parallel empty.
- If the card is autographed, patched, jersey/relic, rookie, or numbered, mark the feature boolean true.
- Estimate condition from visible centering/corners/edges/surface only. If unclear, use "Unknown".
- Build searchQuery for sold-listing pricing using: player + year + manufacturer + set/product + parallel + serial/card number + grade when useful.
- Confidence must be 0 to 1. Use below 0.35 when manual review is needed.

Schema:
{
  "player": "",
  "team": "",
  "manufacturer": "Topps | Panini | Futera | Leaf | Upper Deck | Donruss | Bowman | Unknown",
  "product": "",
  "set": "",
  "year": "",
  "parallel": "",
  "serialNumber": "",
  "cardNumber": "",
  "league": "",
  "country": "",
  "grade": "Raw",
  "conditionEstimate": "Mint | Near Mint | Excellent | Played | Unknown",
  "confidence": 0.0,
  "notes": "short explanation, image clues, and uncertainty",
  "ocr": {
    "frontText": "visible front text only",
    "backText": "visible back text only",
    "importantClues": ["short clue 1", "short clue 2"]
  },
  "searchQuery": "pricing search query",
  "features": {
    "rookie": false,
    "autograph": false,
    "patch": false,
    "jersey": false,
    "relic": false,
    "numbered": false,
    "oneOfOne": false,
    "parallel": false
  }
}`;
}

export function imageToOpenAIInput(image?: string) {
  if (!image) return null;
  return { type: "input_image", image_url: image };
}

export function imageToGeminiPart(image?: string, mimeType?: string) {
  if (!image) return null;
  const base64 = String(image).includes(",") ? String(image).split(",")[1] : String(image);
  return {
    inline_data: {
      mime_type: mimeType || "image/jpeg",
      data: base64,
    },
  };
}

export function smartFillScannerResult(visibleText: string, reason: string) {
  const suggestion = inferCardFromText(visibleText || "");
  const card = normalizeScannerCard({
    ...UNKNOWN_CARD,
    ...suggestion,
    player: suggestion.player || UNKNOWN_CARD.player,
    team: suggestion.team || UNKNOWN_CARD.team,
    manufacturer: suggestion.manufacturer || UNKNOWN_CARD.manufacturer,
    product: suggestion.product || suggestion.set || "",
    set: suggestion.set || suggestion.product || "",
    year: String(suggestion.year || ""),
    confidence: suggestion.confidence || 0.2,
    notes: [reason, suggestion.notes, suggestion.reason].filter(Boolean).join("\n"),
    ocr: {
      frontText: visibleText || "",
      backText: "",
      importantClues: [suggestion.reason].filter(Boolean) as string[],
    },
  });

  return {
    mode: "smart-fill",
    provider: "smart-fill" as ScannerProvider,
    card,
    ...card,
    message: reason,
  };
}
