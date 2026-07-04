import { CollectionCard } from "@/services/collectionStore";
import { PriceHistoryPoint } from "@/services/priceHistoryStore";
import { cardSearchText, RiskLevel } from "@/services/cardIntelligence";

export type DetailSignal = {
  label: string;
  value: string;
  tone: "good" | "neutral" | "warning" | "danger";
};

export type DetailIntelligence = {
  identityStrength: number;
  compReadiness: number;
  dataQuality: "Complete" | "Good" | "Needs work" | "Weak";
  liquidityTier: "Fast" | "Normal" | "Thin" | "Unknown";
  gradePrecheck: "Send only if clean" | "Possible candidate" | "Keep raw" | "Already graded";
  exitPlan: string;
  watchlistTriggers: string[];
  missingCriticalFields: string[];
  riskFlags: string[];
  catalysts: string[];
  signals: DetailSignal[];
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function hasAny(text: string, words: string[]) {
  const value = text.toLowerCase();
  return words.some((word) => value.includes(word.toLowerCase()));
}

function serialRun(card: CollectionCard) {
  const match = `${card.serialNumber || ""} ${card.parallel || ""}`.match(/\/(\d{1,6})/);
  return match ? Number(match[1]) : 0;
}

function gradedText(card: CollectionCard) {
  return String(card.grade || "Raw").toLowerCase();
}

export function calculateDetailIntelligence(card: CollectionCard, history: PriceHistoryPoint[] = []): DetailIntelligence {
  const text = cardSearchText(card);
  const value = Number(card.estimatedValue || 0);
  const cost = Number(card.purchasePrice || 0);
  const roi = cost > 0 ? ((value - cost) / cost) * 100 : 0;
  const run = serialRun(card);
  const isGraded = /psa|bgs|sgc|cgc|tag/.test(gradedText(card));
  const conditionText = `${card.condition || ""} ${card.notes || ""}`;

  const identityFields: Array<[string, unknown]> = [
    ["player", card.player],
    ["year", card.year],
    ["manufacturer", card.manufacturer],
    ["set", card.set],
    ["parallel", card.parallel],
    ["serial number", card.serialNumber],
    ["card number", card.cardNumber],
    ["grade/condition", card.grade || card.condition],
  ];
  const presentIdentity = identityFields.filter(([, value]) => Boolean(value)).length;
  const missingCriticalFields = identityFields.filter(([, value]) => !value).map(([label]) => label);
  const identityStrength = clamp((presentIdentity / identityFields.length) * 100);

  let compReadiness = identityStrength;
  if (card.player && (card.set || card.manufacturer)) compReadiness += 8;
  if (card.parallel || card.serialNumber) compReadiness += 8;
  if (card.grade && !/raw/i.test(String(card.grade))) compReadiness += 6;
  if (!card.player) compReadiness -= 25;
  if (!card.year && !card.set) compReadiness -= 15;
  compReadiness = clamp(compReadiness);

  const dataQuality = compReadiness >= 88 ? "Complete" : compReadiness >= 70 ? "Good" : compReadiness >= 45 ? "Needs work" : "Weak";
  const premiumAttributes = hasAny(text, ["rookie", "rc", "auto", "autograph", "patch", "jersey", "relic", "superfractor", "gold", "red", "black", "1/1"]);
  const liquidityTier = value >= 250 || hasAny(text, ["messi", "ronaldo", "mbappe", "bellingham", "yamal", "haaland", "zidane"])
    ? "Fast"
    : value >= 50 || premiumAttributes
      ? "Normal"
      : value > 0
        ? "Thin"
        : "Unknown";

  const conditionRisks = hasAny(conditionText, ["damage", "damaged", "crease", "corner", "edge", "surface", "print line", "scratch", "dent", "soft"]);
  const gradePrecheck = isGraded
    ? "Already graded"
    : conditionRisks
      ? "Keep raw"
      : value >= 120 || run > 0 && run <= 50 || premiumAttributes
        ? "Send only if clean"
        : value >= 50
          ? "Possible candidate"
          : "Keep raw";

  const riskFlags: string[] = [];
  if (missingCriticalFields.length >= 4) riskFlags.push("Card identity is incomplete, so comps may match the wrong variation.");
  if (value > 0 && cost > 0 && roi < -20) riskFlags.push("Current estimated value is materially below purchase price.");
  if (value === 0) riskFlags.push("No estimated value saved yet.");
  if (conditionRisks) riskFlags.push("Condition notes include possible grading or resale risk.");
  if (!card.image) riskFlags.push("Front image is missing.");
  if (!card.backImage) riskFlags.push("Back image is missing, limiting condition review.");

  const catalysts: string[] = [];
  if (run === 1) catalysts.push("1/1 scarcity can create collector-driven upside.");
  else if (run > 0 && run <= 25) catalysts.push(`Low serial run /${run} supports scarcity premium.`);
  else if (run > 0 && run <= 99) catalysts.push(`Numbered /${run} adds scarcity versus base cards.`);
  if (hasAny(text, ["rookie", "rc"])) catalysts.push("Rookie designation can improve demand if player momentum rises.");
  if (hasAny(text, ["auto", "autograph"])) catalysts.push("Autograph attribute can widen buyer demand.");
  if (hasAny(text, ["patch", "jersey", "relic"])) catalysts.push("Relic/patch material can help if the set is desirable.");
  if (isGraded) catalysts.push("Third-party grade gives cleaner price comparison and buyer confidence.");
  if (!catalysts.length) catalysts.push("Upside depends mainly on player demand and fresh sold comps.");

  const latest = history[0]?.value || 0;
  const previous = history[1]?.value || 0;
  const trendPct = latest && previous ? ((latest - previous) / previous) * 100 : 0;

  const exitPlan = roi >= 80
    ? "You have strong profit. Consider listing above latest comps or selling into demand if liquidity is high."
    : roi >= 25
      ? "Hold unless a buyer pays near the upper comp range; protect profit with refreshed comps."
      : roi < -15
        ? "Avoid panic selling. Re-check exact variation comps, then decide whether to average down, hold, or cut exposure."
        : "Hold and refresh market data before buying more or selling.";

  const watchlistTriggers = [
    "Refresh comps before any buy/sell decision.",
    compReadiness < 75 ? "Complete missing identity fields before trusting market value." : "Compare only exact year, set, parallel, serial, and grade.",
    trendPct > 10 ? "Recent value trend is positive; watch for a good selling window." : trendPct < -10 ? "Recent value trend is negative; wait for stronger comps before increasing exposure." : "Track at least two market refreshes to form a trend.",
    gradePrecheck === "Send only if clean" ? "Inspect centering, corners, edges, and surface under light before grading." : "Do not grade unless the value gap clearly pays for fees and risk.",
  ];

  const signals: DetailSignal[] = [
    { label: "Identity", value: `${identityStrength}/100`, tone: identityStrength >= 75 ? "good" : identityStrength >= 50 ? "warning" : "danger" },
    { label: "Comp readiness", value: `${compReadiness}/100`, tone: compReadiness >= 75 ? "good" : compReadiness >= 50 ? "warning" : "danger" },
    { label: "Liquidity", value: liquidityTier, tone: liquidityTier === "Fast" ? "good" : liquidityTier === "Unknown" ? "warning" : "neutral" },
    { label: "Grade path", value: gradePrecheck, tone: gradePrecheck === "Keep raw" ? "warning" : gradePrecheck === "Already graded" ? "neutral" : "good" },
  ];

  return {
    identityStrength,
    compReadiness,
    dataQuality,
    liquidityTier,
    gradePrecheck,
    exitPlan,
    watchlistTriggers,
    missingCriticalFields,
    riskFlags,
    catalysts,
    signals,
  };
}

export function detailToneClass(tone: DetailSignal["tone"]) {
  if (tone === "good") return "text-cm-green";
  if (tone === "danger") return "text-red-300";
  if (tone === "warning") return "text-yellow-300";
  return "text-white";
}

export function riskToneClass(risk: RiskLevel) {
  if (risk === "Low") return "text-cm-green";
  if (risk === "High") return "text-red-300";
  return "text-yellow-300";
}
