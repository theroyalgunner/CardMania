export type AIQuality = {
  score?: number;
  label?: string;
  missingFields?: string[];
  strengths?: string[];
  warnings?: string[];
};

export type AIFeatures = {
  rookie?: boolean;
  autograph?: boolean;
  patch?: boolean;
  jersey?: boolean;
  relic?: boolean;
  numbered?: boolean;
  oneOfOne?: boolean;
  parallel?: boolean;
};

export type AIExtractedCard = {
  player?: string;
  team?: string;
  manufacturer?: string;
  product?: string;
  set?: string;
  year?: string | number;
  parallel?: string;
  serialNumber?: string;
  cardNumber?: string;
  league?: string;
  country?: string;
  grade?: string;
  confidence?: number;
  notes?: string;
  conditionEstimate?: string;
  ocr?: { frontText?: string; backText?: string; importantClues?: string[] };
  searchQuery?: string;
  features?: AIFeatures;
  quality?: AIQuality;
};

export function cleanGeminiJson(text: string) {
  return text.replace(/```json/gi, "").replace(/```/g, "").trim();
}

export function parseAIResult(result: any): AIExtractedCard {
  if (!result) return {};
  if (result.card && typeof result.card === "object") return result.card;

  if (typeof result.result === "string") {
    try {
      return JSON.parse(cleanGeminiJson(result.result));
    } catch {
      return { notes: result.result };
    }
  }

  if (typeof result.raw === "string") {
    try {
      return JSON.parse(cleanGeminiJson(result.raw));
    } catch {
      return { notes: result.raw };
    }
  }

  return result;
}

export function confidencePercent(value?: number) {
  if (!value) return "—";
  if (value <= 1) return `${Math.round(value * 100)}%`;
  return `${Math.round(value)}%`;
}
