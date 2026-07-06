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
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, 20);
}

export function loadMarketMemory(): MemoryMap {
  if (!hasStorage()) return {};

  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveMarketMemory(memory: MemoryMap) {
  if (!hasStorage()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
}

export function getMemory(fingerprint: string): MarketMemoryEntry | null {
  if (!fingerprint) return null;
  return loadMarketMemory()[fingerprint] || null;
}

export function updateMemory(entry: MarketMemoryEntry) {
  if (!entry.fingerprint) return;
  const memory = loadMarketMemory();
  memory[entry.fingerprint] = {
    ...entry,
    successfulQueries: unique(entry.successfulQueries),
    failedQueries: unique(entry.failedQueries),
    requiredWords: unique(entry.requiredWords),
    excludedWords: unique(entry.excludedWords),
    lastUpdated: Date.now(),
  };
  saveMarketMemory(memory);
}

export function rememberMarketSearch(args: {
  fingerprint: string;
  query: string;
  success: boolean;
  confidenceScore?: number;
  requiredWords?: string[];
  excludedWords?: string[];
}) {
  if (!args.fingerprint || !args.query) return;

  const current = getMemory(args.fingerprint) || {
    fingerprint: args.fingerprint,
    successfulQueries: [],
    failedQueries: [],
    requiredWords: [],
    excludedWords: [],
    averageConfidence: 0,
    successfulSearches: 0,
    lastUpdated: Date.now(),
  };

  if (args.success) {
    const nextCount = current.successfulSearches + 1;
    current.successfulQueries = unique([args.query, ...current.successfulQueries]);
    current.averageConfidence = Math.round(
      ((current.averageConfidence * current.successfulSearches) + Number(args.confidenceScore || 0)) / nextCount
    );
    current.successfulSearches = nextCount;
  } else {
    current.failedQueries = unique([args.query, ...current.failedQueries]);
  }

  current.requiredWords = unique([...(args.requiredWords || []), ...current.requiredWords]);
  current.excludedWords = unique([...(args.excludedWords || []), ...current.excludedWords]);

  updateMemory(current);
}

export function clearMemory() {
  if (!hasStorage()) return;
  localStorage.removeItem(STORAGE_KEY);
}
