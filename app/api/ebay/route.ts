import { NextResponse } from "next/server";
import { parsePricesFromText, scoreComparable, summarizeSales, ParsedSale } from "@/services/priceParser";

function ebaySearchUrl(query: string) {
  return (
    "https://www.ebay.co.uk/sch/i.html?_nkw=" +
    encodeURIComponent(query) +
    "&LH_Sold=1&LH_Complete=1&_sop=13"
  );
}

function normalizeBrowseItems(items: any[] = [], query: string): ParsedSale[] {
  return items
    .map((item) => {
      const price = Number(item?.price?.value || item?.currentBidPrice?.value || 0);
      const title = String(item?.title || "eBay sold listing");
      const { score, flags } = scoreComparable(title, query);
      const currencyCode = String(item?.price?.currency || "GBP").toUpperCase();
      const currency: ParsedSale["currency"] = currencyCode === "USD" ? "USD" : currencyCode === "EUR" ? "EUR" : "GBP";

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
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 CardMania/1.0",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      },
      next: { revalidate: 300 },
    });

    const html = await response.text();
    return parsePricesFromText(html, query);
  } catch {
    return [] as ParsedSale[];
  }
}

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json(
        { success: false, error: "Missing search query" },
        { status: 400 }
      );
    }

    const cleanQuery = String(query).replace(/\s+/g, " ").trim();
    const searchUrl = ebaySearchUrl(cleanQuery);
    const apiResult = await fetchEbayBrowseApi(cleanQuery);
    const sales = apiResult.sales.length ? apiResult.sales : await fetchEbayHtml(cleanQuery);
    const summary = summarizeSales(sales);

    return NextResponse.json({
      success: true,
      query: cleanQuery,
      searchUrl,
      sourceMode: apiResult.sales.length ? apiResult.mode : "scrape",
      sales,
      ...summary,
      note:
        sales.length > 0
          ? `Analyzed ${summary.keptCount || summary.soldCount} comparable sold listing${(summary.keptCount || summary.soldCount) === 1 ? "" : "s"}. ${summary.rejectedCount ? `${summary.rejectedCount} weak comp${summary.rejectedCount === 1 ? "" : "s"} filtered out.` : ""}`
          : "Opened eBay sold search. eBay did not expose parseable sold prices for this request.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Unable to search eBay.",
      },
      { status: 500 }
    );
  }
}
