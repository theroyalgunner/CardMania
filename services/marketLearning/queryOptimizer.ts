import type { CollectionCard } from "@/services/collectionStore";
import { getMemory } from "@/services/marketMemory";
import { buildFingerprint } from "@/services/cardFingerprint";

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function clean(text: string) {
  return text
    .replace(/\s+/g, " ")
    .trim();
}

export function optimizeQueries(
  card: Partial<CollectionCard>,
  queries: string[]
): string[] {
  const fingerprint = buildFingerprint(card);
  const memory = getMemory(fingerprint);

  if (!memory) {
    return unique(queries);
  }

  let optimized = [...queries];

  // Move historically successful searches to the top
  if (memory.successfulQueries.length) {
    optimized = [
      ...memory.successfulQueries,
      ...optimized,
    ];
  }

  // Remove searches that repeatedly failed
  optimized = optimized.filter(
    (query) => !memory.failedQueries.includes(query)
  );

  // Inject required words
  optimized = optimized.map((query) => {
    let result = query;

    for (const word of memory.requiredWords) {
      if (
        word &&
        !result.toLowerCase().includes(word.toLowerCase())
      ) {
        result += ` ${word}`;
      }
    }

    return clean(result);
  });

  // Remove excluded words
  optimized = optimized.map((query) => {
    let result = query;

    for (const word of memory.excludedWords) {
      const regex = new RegExp(`\\b${word}\\b`, "ig");
      result = result.replace(regex, "");
    }

    return clean(result);
  });

  return unique(optimized);
}