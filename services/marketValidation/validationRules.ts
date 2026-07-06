export type ValidationSeverity = "pass" | "warning" | "reject";

export type ValidationRuleResult = {
  rule: string;
  severity: ValidationSeverity;
  message: string;
};

export function hasWord(text: string, word: string) {
  return new RegExp(`\\b${word}\\b`, "i").test(text);
}

export function titleHasAny(text: string, words: string[]) {
  return words.some((word) => hasWord(text, word));
}

export const BASE_WORDS = [
  "base",
  "standard",
];

export const AUTO_WORDS = [
  "auto",
  "autograph",
  "signed",
];

export const PATCH_WORDS = [
  "patch",
  "relic",
  "jersey",
  "memorabilia",
];

export const GRADED_WORDS = [
  "psa",
  "bgs",
  "sgc",
  "cgc",
  "tag",
];

export const LOT_WORDS = [
  "lot",
  "bundle",
  "box",
  "pack",
  "case",
];