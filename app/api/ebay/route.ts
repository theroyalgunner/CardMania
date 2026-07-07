import { NextResponse } from "next/server";
import { parsePricesFromText, scoreComparable, summarizeSales, ParsedSale } from "@/services/priceParser";

function ebaySearchUrl(query: string) {
  return (
    "https://www.ebay.co.uk/sch/i.html?_nkw=" +
    encodeURIComponent(query) +
    "&LH_Sold=1&LH_Complete=1&_sop=13"
  );
}

function cleanQuery(query: string) {
  return String(query || "")
    .replace(/#(\S+)/g, "$1")
    .replace(/\bPSA\s*10\b/gi, "")
    .replace(/\bBGS\s*9\.5\b/gi, "")
    .replace(/\bRaw\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildStrictQueries(query: string) {
  const base = cleanQuery(query);
  const noSerial = base.replace(/\b\d{1,4}\s*\/\s*\d{1,4}\b/g, "").replace(/\s+/g, " ").trim();
  const noCardNumber = noSerial.replace(/\b[A-Z]{1,5}-?\d{1,5}\b/gi, "").replace(/\s+/g, " ").trim();

  return Array.from(new Set([base, noSerial, noCardNumber].filter((q) => q.length > 3)));
}

function normalizeBrowseItems(items: any[] = [], query: string): ParsedSale[] {
  return items
    .map((item) => {
      const price = Number(item?.price?.value || item?.currentBidPrice?.value || 0);
      const title = String(item?.title || "eBay sold listing");
      const { score, flags } = scoreComparable(title, query);
      const currencyCode = String(item?.price?.currency || "GBP").toUpperCase();
      const currency: ParsedSale["currency"] =
        currencyCode === "USD" ? "USD" : currencyCode === "EUR" ? "EUR" : "GBP";

      return {
        title,
        price,
        currency,
        source: "ebay" as const,
        url: item?.itemWebUrl,
        image: item?.image?.imageUrl,
        soldDate: item?.itemEndDate,
        score,
        flags,
      };
    })
    .filter((sale) => sale.price > 0)
    .slice(0, 36);
}

async function fetchEbayBrowseApi(query: string) {
  const token = process.env.EBAY_BEARER_TOKEN;
  if (!token) return { sales: [] as ParsedSale[], mode: "scrape" as const };

  const endpoint =
    "https://api.ebay.com/buy/browse/v1/item_summary/search?q=" +
    encodeURIComponent(query) +
    "&limit=30&filter=soldItems";

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": process.env.EBAY_MARKETPLACE_ID || "EBAY_GB",
      Accept: "application/json",
    },
    next: { revalidate: 300 },
  });

  if (!response.ok) return { sales: [] as ParsedSale[], mode: "api" as const };
  const data = await response.json();
  return { sales: normalizeBrowseItems(data?.itemSummaries || [], query), mode: "api" as const };
}

async function fetchEbayHtml(query: string) {
  const searchUrl = ebaySearchUrl(query);
  try {
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36 CardMania/1.0",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      next: { revalidate: 300 },
    });

    const html = await response.text();

    if (response.status === 403 || html.includes("Error Page | eBay") || html.includes("noindex,nofollow")) {
      return [];
    }

    return parsePricesFromText(html, query);
  } catch {
    return [] as ParsedSale[];
  }
}

async function runSearch(query: string) {
  const apiResult = await fetchEbayBrowseApi(query);
  const sales = apiResult.sales.length ? apiResult.sales : await fetchEbayHtml(query);
  const summary = summarizeSales(sales);

  return {
    query,
    searchUrl: ebaySearchUrl(query),
    sourceMode: apiResult.sales.length ? apiResult.mode : "scrape",
    sales,
    summary,
  };
}

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ success: false, error: "Missing search query" }, { status: 400 });
    }

    const queries = buildStrictQueries(query);
    const attempts = [];

    for (const q of queries) {
      const attempt = await runSearch(q);
      attempts.push({
        query: attempt.query,
        soldCount: attempt.summary.soldCount,
        keptCount: attempt.summary.keptCount,
        rejectedCount: attempt.summary.rejectedCount,
        confidence: attempt.summary.confidence,
        suggestedValue: attempt.summary.suggestedValue,
      });

      if ((attempt.summary.keptCount || 0) >= 2 && attempt.summary.confidence !== "Low") {
        return NextResponse.json({
          success: true,
          version: "Market Engine V4 exact eBay comps",
          query: attempt.query,
          searchUrl: attempt.searchUrl,
          sourceMode: attempt.sourceMode,
          sales: attempt.sales,
          attempts,
          ...attempt.summary,
          note: `V4 exact comps used: ${attempt.query}. ${attempt.summary.rejectedCount || 0} weak comps filtered out.`,
        });
      }
    }

    const best = attempts
      .map((a, index) => ({ ...a, index }))
      .sort((a, b) => (b.keptCount || 0) - (a.keptCount || 0))[0];

    const fallback = await runSearch(queries[best?.index || 0]);

    return NextResponse.json({
      success: true,
      version: "Market Engine V4 exact eBay comps",
      query: fallback.query,
      searchUrl: fallback.searchUrl,
      sourceMode: fallback.sourceMode,
      sales: fallback.sales,
      attempts,
      ...fallback.summary,
      note:
        fallback.sales.length > 0
          ? `V4 fallback used best available query: ${fallback.query}. Review comps before trusting value.`
          : "eBay blocked server-side sold-search parsing. Open the eBay sold search link manually, or add an official eBay API token later.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Unable to search eBay." },
      { status: 500 }
    );
  }
}