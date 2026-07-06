import { CollectionCard } from "@/services/collectionStore";
import { LiveMarketSale } from "@/services/liveMarket";

import {
  AUTO_WORDS,
  BASE_WORDS,
  GRADED_WORDS,
  LOT_WORDS,
  PATCH_WORDS,
  titleHasAny,
  ValidationRuleResult,
} from "./validationRules";

function clean(value?: string | number) {
  return String(value || "")
    .toLowerCase()
    .trim();
}

function cardWants(
  card: Partial<CollectionCard>,
  words: string[]
) {
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
    .map(clean)
    .join(" ");

  return titleHasAny(combined, words);
}

export function validateMarketSale(
  sale: LiveMarketSale,
  card: Partial<CollectionCard>
): ValidationRuleResult[] {

  const title = clean(sale.title);

  const results: ValidationRuleResult[] = [];

  if (titleHasAny(title, LOT_WORDS)) {
    results.push({
      rule: "lot-check",
      severity: "reject",
      message:
        "Rejected because listing appears to be a lot, bundle, box, pack or case.",
    });
  }

  if (
    titleHasAny(title, BASE_WORDS) &&
    clean(card.parallel) &&
    !title.includes(clean(card.parallel))
  ) {
    results.push({
      rule: "parallel-check",
      severity: "reject",
      message:
        "Listing appears to be the base version instead of the requested parallel.",
    });
  }

  if (
    titleHasAny(title, AUTO_WORDS) &&
    !cardWants(card, AUTO_WORDS)
  ) {
    results.push({
      rule: "auto-check",
      severity: "reject",
      message:
        "Listing is autographed but target card is not.",
    });
  }

  if (
    titleHasAny(title, PATCH_WORDS) &&
    !cardWants(card, PATCH_WORDS)
  ) {
    results.push({
      rule: "patch-check",
      severity: "reject",
      message:
        "Listing is patch/relic but target card is not.",
    });
  }

  if (
    titleHasAny(title, GRADED_WORDS) &&
    !cardWants(card, GRADED_WORDS)
  ) {
    results.push({
      rule: "grade-check",
      severity: "reject",
      message:
        "Listing is graded but target card is raw.",
    });
  }

  if (!results.length) {
    results.push({
      rule: "basic-validation",
      severity: "pass",
      message:
        "Listing passed all validation rules.",
    });
  }

  return results;
}

export function isRejectedByValidation(
  results: ValidationRuleResult[]
) {
  return results.some(
    (result) => result.severity === "reject"
  );
}