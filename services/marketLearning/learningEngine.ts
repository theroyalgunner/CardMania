import type { CollectionCard } from "@/services/collectionStore";
import {
  getMemory,
  updateMemory,
  MarketMemoryEntry,
} from "@/services/marketMemory";
import { buildFingerprint } from "@/services/cardFingerprint";
import type { MarketEngineSummary } from "@/services/marketEngine";

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function learnFromMarketResult(
  card: Partial<CollectionCard>,
  summary: MarketEngineSummary,
  query: string
) {
  const fingerprint = buildFingerprint(card);

  const memory =
    getMemory(fingerprint) || {
      fingerprint,
      successfulQueries: [],
      failedQueries: [],
      requiredWords: [],
      excludedWords: [],
      averageConfidence: 0,
      successfulSearches: 0,
      lastUpdated: Date.now(),
    } satisfies MarketMemoryEntry;

  if ((summary.keptCount || 0) >= 3) {
    memory.successfulQueries.push(query);
    memory.successfulSearches += 1;
  } else {
    memory.failedQueries.push(query);
  }

  memory.requiredWords = unique([
    ...memory.requiredWords,
    ...(summary.requiredWords || []),
  ]);

  memory.excludedWords = unique([
    ...memory.excludedWords,
    ...(summary.excludedWords || []),
  ]);

  const previousTotal =
    memory.averageConfidence *
    Math.max(memory.successfulSearches - 1, 0);

  memory.averageConfidence =
    memory.successfulSearches > 0
      ? Math.round(
          (previousTotal + (summary.confidenceScore || 0)) /
            memory.successfulSearches
        )
      : summary.confidenceScore || 0;

  memory.successfulQueries = unique(memory.successfulQueries).slice(0, 20);
  memory.failedQueries = unique(memory.failedQueries).slice(0, 20);
  memory.requiredWords = unique(memory.requiredWords).slice(0, 20);
  memory.excludedWords = unique(memory.excludedWords).slice(0, 20);

  memory.lastUpdated = Date.now();

  updateMemory(memory);

  return memory;
}