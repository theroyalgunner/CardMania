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

function clampConfidence(value: unknown) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

function cleanJson(text: string) {
  return String(text || "").replace(/```json/gi, "").replace(/```/g, "").trim();
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
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function normalizeFeatureBooleans(card: Partial<ScannerCard>): ScannerCard["features"] {
  const text = textFromCard(card);
  const serialNumber = String(card.serialNumber || "");

  return {
    rookie: Boolean(card.features?.rookie) || /\b(rc|rookie)\b/i.test(text),
    autograph: Boolean(card.features?.autograph) || /\b(auto|autograph|signed|signature)\b/i.test(text),
    patch: Boolean(card.features?.patch) || /\bpatch\b/i.test(text),
    jersey: Boolean(card.features?.jersey) || /\bjersey|kit|shirt\b/i.test(text),
    relic: Boolean(card.features?.relic) || /\brelic|memorabilia|match worn|player worn\b/i.test(text),
    numbered: Boolean(card.features?.numbered) || /\b\d{1,4}\s*\/\s*\d{1,4}\b/.test(serialNumber || text),
    oneOfOne: Boolean(card.features?.oneOfOne) || /\b(1\s*\/\s*1|one of one|1-of-1)\b/i.test(serialNumber || text),
    parallel: Boolean(card.features?.parallel) || Boolean(card.parallel),
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
    .filter(([key]) => !String(card[key] || "").trim() || String(card[key] || "").toLowerCase().startsWith("unknown"))
    .map(([, label]) => label);

  const strengths: string[] = [];
  const warnings: string[] = [];
  const features = normalizeFeatureBooleans(card);
  const confidence = clampConfidence(card.confidence);

  if (card.player && !String(card.player).toLowerCase().includes("unknown")) strengths.push("Player identified");
  if (card.set || card.product) strengths.push("Set/product clue found");
  if (card.cardNumber) strengths.push("Card number found");
  if (features.numbered) strengths.push("Serial-numbered card detected");
  if (features.autograph) strengths.push("Autograph flag detected");
  if (features.patch || features.jersey || features.relic) strengths.push("Relic/patch flag detected");
  if (confidence < 0.35) warnings.push("Low AI confidence");
  if (missingFields.length) warnings.push(`Missing: ${missingFields.join(", ")}`);

  const completeness = 1 - missingFields.length / required.length;
  const score = Math.round(Math.max(0, Math.min(100, (confidence * 65 + completeness * 35) * 100)));
  const label = score >= 80 ? "High" : score >= 55 ? "Medium" : score >= 30 ? "Low" : "Manual review";

  return { score, label, missingFields, strengths, warnings };
}

export function normalizeScannerCard(input: any): ScannerCard {
  const card: Partial<ScannerCard> = typeof input === "object" && input ? input : {};
  const features = normalizeFeatureBooleans(card);
  const next: ScannerCard = {
    ...UNKNOWN_CARD,
    ...card,
    player: String(card.player || "Unknown Player"),
    team: String(card.team || "Unknown Team"),
    manufacturer: String(card.manufacturer || "Unknown"),
    product: String(card.product || ""),
    set: String(card.set || card.product || ""),
    year: String(card.year || ""),
    parallel: String(card.parallel || ""),
    serialNumber: String(card.serialNumber || ""),
    cardNumber: String(card.cardNumber || ""),
    league: String(card.league || ""),
    country: String(card.country || ""),
    grade: String(card.grade || "Raw"),
    confidence: clampConfidence(card.confidence),
    notes: String(card.notes || UNKNOWN_CARD.notes),
    conditionEstimate: (card.conditionEstimate as ScannerCard["conditionEstimate"]) || "Unknown",
    ocr: card.ocr || UNKNOWN_CARD.ocr,
    searchQuery: String(card.searchQuery || ""),
    features,
    quality: UNKNOWN_CARD.quality,
  };
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
  return `You are CardMania AI Scanner V2, a specialist trading-card identification system.
Analyze the front image, optional back image, and visible text. Identify only what is supported by the image/text.

Visible text, seller title, or file title:
${String(visibleText || "").slice(0, 1600)}

Primary goal:
Identify the exact card as far as the evidence allows. Use the image first, then the back image, then visible text. If the exact set or parallel is uncertain, say so in notes and lower confidence.

Recognition rules:
- Return ONLY valid JSON. No markdown.
- Do not invent a famous player unless the face, printed name, shirt, badge, team, or back text supports it.
- Prefer exact back-card information for set/product, year, manufacturer, cardNumber, and copyright text.
- Preserve serial numbers exactly, for example "07/50", "12 / 25", or "1/1".
- cardNumber means the actual printed card number only, such as "118", "UCC-12", "SS-7".
- parallel must only include visible or strongly implied attributes such as Gold Refractor, Purple, Sapphire, Mojo, Auto, Patch, Jersey, Cracked Ice, numbered /50.
- If the card is autographed, patched, jersey/relic, rookie, or numbered, mark the feature boolean true.
- Estimate condition from visible centering/corners/edges/surface only. If unclear, use "Unknown".
- Build searchQuery for sold-listing pricing using: player + year + manufacturer + set/product + parallel + serial/card number + grade when useful.
- Confidence must be 0 to 1. Use below 0.35 when manual review is needed.

Schema:
{
  "player": "",
  "team": "",
  "manufacturer": "Topps | Panini | Futera | Leaf | Upper Deck | Unknown",
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
  });

  return {
    mode: "smart-fill",
    provider: "smart-fill" as ScannerProvider,
    card,
    message: reason,
  };
}
