export type ParsedSale = {
  title: string;
  price: number;
  currency: "GBP" | "USD" | "EUR";
  source: "ebay";
  url?: string;
  soldDate?: string;
  image?: string;
  score?: number;
  flags?: string[];
};

export type PriceSummary = {
  averagePrice: number;
  medianPrice: number;
  lowestPrice: number;
  highestPrice: number;
  soldCount: number;
  confidence: "High" | "Medium" | "Low";
  confidenceScore: number;
  suggestedValue: number;
  spreadPercent: number;
  keptCount: number;
  rejectedCount: number;
  fairLow: number;
  fairHigh: number;
  pricingMethod: string;
};

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&pound;/g, "£")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function currencyFromSymbol(symbol: string): ParsedSale["currency"] {
  if (symbol === "$" || symbol.toUpperCase() === "US $") return "USD";
  if (symbol === "€") return "EUR";
  return "GBP";
}

function normalizePrice(raw: string) {
  const cleaned = raw.replace(/,/g, "").replace(/[^0-9.]/g, "");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : 0;
}

function uniqueSales(sales: ParsedSale[]) {
  const seen = new Set<string>();
  const unique: ParsedSale[] = [];

  for (const sale of sales) {
    const key = `${sale.title.toLowerCase()}-${sale.price}-${sale.currency}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(sale);
    }
  }

  return unique;
}

function likelyCardTitle(title: string) {
  const lower = title.toLowerCase();
  if (!title || title.length < 4) return false;
  if (lower.includes("shipping") || lower.includes("postage")) return false;
  if (lower.includes("sleeve") || lower.includes("toploader")) return false;
  if (lower.includes("lot of") && !lower.includes("rookie")) return false;
  return true;
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9/# ]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !["the", "and", "with", "card"].includes(token));
}

export function scoreComparable(title: string, query: string) {
  const titleTokens = new Set(tokenize(title));
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return { score: 50, flags: ["Manual query"] };

  let hits = 0;
  const flags: string[] = [];
  for (const token of queryTokens) {
    if (titleTokens.has(token)) hits += 1;
  }

  const lower = title.toLowerCase();
  if (/psa|bgs|sgc|cgc|tag/.test(lower)) flags.push("Graded");
  if (/auto|autograph/.test(lower)) flags.push("Auto");
  if (/patch|jersey|relic|memorabilia/.test(lower)) flags.push("Relic/Patch");
  if (/rookie|\brc\b/.test(lower)) flags.push("Rookie");
  if (/refractor|parallel|numbered|\/\d{1,5}/.test(lower)) flags.push("Parallel/numbered");

  const coverage = hits / queryTokens.length;
  const score = Math.round(Math.min(100, 35 + coverage * 65 + Math.min(10, flags.length * 2)));
  return { score, flags };
}

export function parsePricesFromText(text: string, query = ""): ParsedSale[] {
  const sales: ParsedSale[] = [];
  const blocks = text.split(/s-item__info|s-card__caption|srp-results/i);

  for (const block of blocks) {
    const priceMatch = block.match(/(?:£|\$|€)\s?([0-9,]+(?:\.[0-9]{1,2})?)/);
    if (!priceMatch) continue;

    const price = normalizePrice(priceMatch[0]);
    if (price <= 0 || price > 100000) continue;

    const titleMatch =
      block.match(/s-item__title[^>]*>(.*?)<\/[^>]+>/i) ||
      block.match(/<span[^>]*role=["']heading["'][^>]*>(.*?)<\/span>/i) ||
      block.match(/title=["']([^"']{8,180})["']/i);

    const rawTitle = titleMatch?.[1] || "eBay sold listing";
    const title = decodeHtml(rawTitle);
    if (!likelyCardTitle(title)) continue;

    const dateMatch = block.match(/(?:Sold|Ended)\s+([A-Za-z0-9, ]{6,30})/i);
    const hrefMatch = block.match(/href=["'](https:\/\/www\.ebay\.[^"']+)["']/i);
    const { score, flags } = scoreComparable(title, query);

    sales.push({
      title,
      price,
      currency: currencyFromSymbol(priceMatch[0].trim()[0]),
      source: "ebay",
      soldDate: dateMatch?.[1]?.trim(),
      url: hrefMatch?.[1],
      score,
      flags,
    });
  }

  if (!sales.length) {
    const priceRegex = /(£|\$|€)\s?([0-9,]+(?:\.[0-9]{1,2})?)/g;
    let match;

    while ((match = priceRegex.exec(text)) !== null) {
      const price = normalizePrice(match[0]);
      if (price > 0 && price < 100000) {
        sales.push({
          title: "eBay sold listing",
          price,
          currency: currencyFromSymbol(match[1]),
          source: "ebay",
          score: query ? 35 : 50,
          flags: ["Price only"],
        });
      }
    }
  }

  return uniqueSales(sales)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 36);
}

export function summarizeSales(sales: ParsedSale[]): PriceSummary {
  const comparableSales = sales.filter((sale) => Number(sale.score || 0) >= 45 || sales.length < 5);
  const valid = comparableSales
    .map((sale) => sale.price)
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b);

  if (!valid.length) {
    return {
      averagePrice: 0,
      medianPrice: 0,
      lowestPrice: 0,
      highestPrice: 0,
      soldCount: 0,
      confidence: "Low",
      confidenceScore: 0,
      suggestedValue: 0,
      spreadPercent: 0,
      keptCount: 0,
      rejectedCount: sales.length,
      fairLow: 0,
      fairHigh: 0,
      pricingMethod: "No usable sold comps",
    };
  }

  const medianOf = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  };

  const initialMedian = medianOf(valid);

  // Auction steals can sit well below the real fair market range.
  // Remove low/high outliers, then price from the middle of the remaining sold comps.
  let fairComps = valid.filter((price) => price >= initialMedian * 0.68 && price <= initialMedian * 1.75);
  if (fairComps.length < Math.min(3, valid.length)) fairComps = valid;

  const q1 = fairComps[Math.floor((fairComps.length - 1) * 0.25)];
  const q3 = fairComps[Math.floor((fairComps.length - 1) * 0.75)];
  const iqr = q3 - q1;
  if (fairComps.length >= 6 && iqr > 0) {
    const lowFence = q1 - iqr * 1.5;
    const highFence = q3 + iqr * 1.5;
    const iqrFiltered = fairComps.filter((price) => price >= lowFence && price <= highFence);
    if (iqrFiltered.length >= 3) fairComps = iqrFiltered;
  }

  const average = fairComps.reduce((sum, price) => sum + price, 0) / fairComps.length;
  const median = medianOf(fairComps);
  const lowest = valid[0];
  const highest = valid[valid.length - 1];
  const fairLow = Math.round(fairComps[0]);
  const fairHigh = Math.round(fairComps[fairComps.length - 1]);
  const count = valid.length;
  const spreadPercent = median ? Math.round(((fairComps[fairComps.length - 1] - fairComps[0]) / median) * 100) : 0;
  const averageScore = comparableSales.length
    ? comparableSales.reduce((sum, sale) => sum + Number(sale.score || 0), 0) / comparableSales.length
    : 0;
  const rejectedByPrice = valid.length - fairComps.length;
  const confidenceScore = Math.min(100, Math.round(Math.min(55, fairComps.length * 8) + averageScore * 0.35 - Math.min(22, spreadPercent / 9)));
  const confidence = confidenceScore >= 75 ? "High" : confidenceScore >= 45 ? "Medium" : "Low";

  // Use a 60/40 median-average blend. Median protects against one bad auction; average keeps the estimate realistic.
  const suggestedValue = Math.round(median * 0.6 + average * 0.4);

  return {
    averagePrice: Math.round(average),
    medianPrice: Math.round(median),
    lowestPrice: Math.round(lowest),
    highestPrice: Math.round(highest),
    soldCount: count,
    confidence,
    confidenceScore,
    suggestedValue,
    spreadPercent,
    keptCount: comparableSales.length - rejectedByPrice,
    rejectedCount: Math.max(0, sales.length - comparableSales.length + rejectedByPrice),
    fairLow,
    fairHigh,
    pricingMethod: rejectedByPrice > 0 ? "Median sold comps with auction/outlier filtering" : "Median sold comps",
  };
}

export function averageSalePrice(sales: ParsedSale[]) {
  return summarizeSales(sales).averagePrice;
}
