export type CardManiaSettings = {
  currency: "GBP" | "EUR" | "USD" | "SAR";
  marketMode: "manual" | "estimate";
  showAiRawOutput: boolean;
};

const KEY = "cardmania_settings";

export const defaultSettings: CardManiaSettings = {
  currency: "GBP",
  marketMode: "estimate",
  showAiRawOutput: false,
};

export function getSettings(): CardManiaSettings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    return { ...defaultSettings, ...(JSON.parse(localStorage.getItem(KEY) || "{}") || {}) };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: CardManiaSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(settings));
}

export function currencySymbol(currency: CardManiaSettings["currency"]) {
  return currency === "GBP" ? "£" : currency === "EUR" ? "€" : currency === "USD" ? "$" : "SAR ";
}
