export interface MarketMemoryEntry {
  fingerprint: string;

  successfulQueries: string[];
  failedQueries: string[];

  requiredWords: string[];
  excludedWords: string[];

  averageConfidence: number;
  successfulSearches: number;

  lastUpdated: number;
}

const STORAGE_KEY = "cardmania-market-memory";

type MemoryMap = Record<string, MarketMemoryEntry>;

function hasStorage() {
  return typeof window !== "undefined";
}

export function loadMarketMemory(): MemoryMap {
  if (!hasStorage()) return {};

  try {
    return JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "{}"
    );
  } catch {
    return {};
  }
}

export function saveMarketMemory(memory: MemoryMap) {
  if (!hasStorage()) return;

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(memory)
  );
}

export function getMemory(
  fingerprint: string
): MarketMemoryEntry | null {
  const memory = loadMarketMemory();

  return memory[fingerprint] || null;
}

export function updateMemory(
  entry: MarketMemoryEntry
) {
  const memory = loadMarketMemory();

  memory[entry.fingerprint] = entry;

  saveMarketMemory(memory);
}

export function clearMemory() {
  if (!hasStorage()) return;

  localStorage.removeItem(STORAGE_KEY);
}