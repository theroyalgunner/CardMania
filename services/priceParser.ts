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
    .replace(/\\u002F/g, "/")
    .replace(/\\u0026/g, "&")
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
  if (symbol === "$" || symbol.toUpperCase().includes("US")) return "USD";
  if (symbol === "€") return "EUR";
  return "GBP";
}

function normalizePrice(raw: string) {
  const value = Number(String(raw).replace(/,/g, "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(value) ? value : 0;
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
  if (/auto|autograph|signed/.test(lower)) flags.push("Auto");
  if (/patch|jersey|relic|memorabilia/.test(lower)) flags.push("Relic/Patch");
  if (/rookie|\brc\b/.test(lower)) flags.push("Rookie");
  if (/refractor|parallel|numbered|\/\d{1,5}/.test(lower)) flags.push("Parallel/numbered");

  const coverage = hits / queryTokens.length;
  const score = Math.round(Math.min(100, 35 + coverage * 65 + Math.min(10, flags.length * 2)));

  return { score, flags };
}

function uniqueSales(sales: ParsedSale[]) {
  const seen = new Set<string>();
  return sales.filter((sale) => {
    const key = `${sale.title.toLowerCase()}-${sale.price}-${sale.currency}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function likelyBadTitle(title: string) {
  const lower = title.toLowerCase();
  return (
    !title ||
    title.length < 4 ||
    lower.includes("shipping") ||
    lower.includes("postage") ||
    lower.includes("sleeve") ||
    lower.includes("toploader")
  );
}

export function parsePricesFromText(text: string, query = ""): ParsedSale[] {
  const sales: ParsedSale[] = [];

  const itemBlocks = text.split(/s-item__wrapper|s-item__info clearfix|s-card__caption/i);

  for (const block of itemBlocks) {
    const priceMatch =
      block.match(/(?:£|\$|€)\s?[0-9,]+(?:\.[0-9]{1,2})?/i) ||
      block.match(/"price"[^}]*"value"\s*:\s*"?([0-9,.]+)"?/i);

    if (!priceMatch) continue;

    const rawPrice = priceMatch[0];
    const price = normalizePrice(rawPrice);
    if (price <= 0 || price > 100000) continue;

    const titleMatch =
      block.match(/<div[^>]*class="[^"]*s-item__title[^"]*"[^>]*>(.*?)<\/div>/i) ||
      block.match(/<span[^>]*role=["']heading["'][^>]*>(.*?)<\/span>/i) ||
      block.match(/"title"\s*:\s*"([^"]{4,220})"/i) ||
      block.match(/title=["']([^"']{4,220})["']/i);

    const title = decodeHtml(titleMatch?.[1] || "eBay sold listing");
    if (likelyBadTitle(title)) continue;

    const hrefMatch =
      block.match(/href=["'](https:\/\/www\.ebay\.[^"']+)["']/i) ||
      block.match(/"itemWebUrl"\s*:\s*"([^"]+)"/i);

    const dateMatch =
      block.match(/(?:Sold|Ended)\s+([A-Za-z0-9, ]{6,30})/i) ||
      block.match(/"itemEndDate"\s*:\s*"([^"]+)"/i);

    const imageMatch =
      block.match(/<img[^>]+src=["']([^"']+)["']/i) ||
      block.match(/"imageUrl"\s*:\s*"([^"]+)"/i);

    const { score, flags } = scoreComparable(title, query);

    sales.push({
      title,
      price,
      currency: currencyFromSymbol(rawPrice.trim()[0]),
      source: "ebay",
      soldDate: dateMatch?.[1]?.trim(),
      url: hrefMatch?.[1]?.replace(/\\u002F/g, "/"),
      image: imageMatch?.[1]?.replace(/\\u002F/g, "/"),
      score,
      flags,
    });
  }

  if (!sales.length) {
    const jsonTitlePrice =
      /"title"\s*:\s*"([^"]{4,220})"[\s\S]{0,900}?(?:£|\$|€)\s?[0-9,]+(?:\.[0-9]{1,2})?/gi;

    let match;
    while ((match = jsonTitlePrice.exec(text)) !== null) {
      const block = match[0];
      const priceMatch = block.match(/(?:£|\$|€)\s?[0-9,]+(?:\.[0-9]{1,2})?/i);
      if (!priceMatch) continue;

      const price = normalizePrice(priceMatch[0]);
      const title = decodeHtml(match[1]);

      if (price <= 0 || price > 100000 || likelyBadTitle(title)) continue;

      const { score, flags } = scoreComparable(title, query);

      sales.push({
        title,
        price,
        currency: currencyFromSymbol(priceMatch[0].trim()[0]),
        source: "ebay",
        score,
        flags,
      });
    }
  }

  return uniqueSales(sales)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 36);
}

function medianOf(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function summarizeSales(sales: ParsedSale[]): PriceSummary {
  const comparableSales = sales.filter((sale) => {
    const score = Number(sale.score || 0);
    const title = sale.title.toLowerCase();

    if (title.includes("lot")) return false;
    if (title.includes("break")) return false;
    if (title.includes("box")) return false;
    if (title.includes("pack")) return false;
    if (title.includes("team set")) return false;
    if (title.includes("printing plate")) return false;
    if (title.includes("redemption")) return false;

    return score >= 35;
  });

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

  const initialMedian = medianOf(valid);
  let fairComps = valid.filter((price) => price >= initialMedian * 0.5 && price <= initialMedian * 2.2);
  if (fairComps.length < Math.min(2, valid.length)) fairComps = valid;

  const average = fairComps.reduce((sum, price) => sum + price, 0) / fairComps.length;
  const median = medianOf(fairComps);
  const spreadPercent = median
    ? Math.round(((fairComps[fairComps.length - 1] - fairComps[0]) / median) * 100)
    : 0;

  const confidenceScore = Math.min(
    100,
    Math.round(Math.min(55, fairComps.length * 12) + 25 - Math.min(20, spreadPercent / 10))
  );

  return {
    averagePrice: Math.round(average),
    medianPrice: Math.round(median),
    lowestPrice: Math.round(valid[0]),
    highestPrice: Math.round(valid[valid.length - 1]),
    soldCount: valid.length,
    confidence: confidenceScore >= 75 ? "High" : confidenceScore >= 45 ? "Medium" : "Low",
    confidenceScore,
    suggestedValue: Math.round(median * 0.65 + average * 0.35),
    spreadPercent,
    keptCount: fairComps.length,
    rejectedCount: Math.max(0, sales.length - fairComps.length),
    fairLow: Math.round(fairComps[0]),
    fairHigh: Math.round(fairComps[fairComps.length - 1]),
    pricingMethod: "Parsed eBay sold comps with median/outlier filtering",
  };
}

export function averageSalePrice(sales: ParsedSale[]) {
  return summarizeSales(sales).averagePrice;
}
