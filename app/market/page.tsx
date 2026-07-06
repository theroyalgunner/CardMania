"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
import { CollectionCard } from "@/services/collectionStore";
import { listCards, updateCard } from "@/services/cardRepository";
import { estimateCardValue, profitLabel } from "@/services/marketEngine";
import { addPriceHistoryPoint, getPriceHistory } from "@/services/priceHistoryStore";
import { buildMarketQuery, LiveMarketResult, searchLiveMarket, searchLiveMarketForCard } from "@/services/liveMarket";
import { calculateMarketIntelligence, marketToneClass } from "@/services/marketIntelligence";

function money(value?: number) {
  return `£${Number(value || 0).toLocaleString()}`;
}

export default function MarketPage() {
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("Loading");
  const [searchingId, setSearchingId] = useState<string | null>(null);
  const [manualQuery, setManualQuery] = useState("");
  const [marketResult, setMarketResult] = useState<LiveMarketResult | null>(null);

  async function load() {
    const result = await listCards();
    setCards(result.data || []);
    setSource(result.source === "cloud" ? "Cloud" : "Local");

    if (!result.ok) {
      setStatus(result.message || "Could not load cards.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const missingValues = useMemo(
    () => cards.filter((card) => !Number(card.estimatedValue || 0)),
    [cards]
  );

  const marketRows = useMemo(
    () =>
      cards.map((card) => ({
        card,
        intelligence: calculateMarketIntelligence(card, getPriceHistory(card.id)),
      })),
    [cards]
  );

  const topProfits = useMemo(
    () =>
      [...marketRows]
        .sort(
          (a, b) =>
            b.intelligence.fairValue - Number(b.card.purchasePrice || 0) -
            (a.intelligence.fairValue - Number(a.card.purchasePrice || 0))
        )
        .slice(0, 8),
    [marketRows]
  );

  const marketSummary = useMemo(() => {
    const value = marketRows.reduce((sum, row) => sum + row.intelligence.fairValue, 0);
    const cost = marketRows.reduce((sum, row) => sum + Number(row.card.purchasePrice || 0), 0);
    const highConfidence = marketRows.filter((row) => row.intelligence.confidenceLabel === "High").length;
    const rising = marketRows.filter((row) => row.intelligence.trend === "Rising").length;
    const watch = marketRows.filter((row) => row.intelligence.verdict === "Watch").length;
    return { value, cost, profit: value - cost, highConfidence, rising, watch };
  }, [marketRows]);

  const cardsReadyForMarket = useMemo(
    () => cards.filter((card) => buildMarketQuery(card).length > 3),
    [cards]
  );

  async function estimateAll() {
    for (const card of cards) {
      if (!Number(card.estimatedValue || 0) || Number(card.estimatedValue || 0) === 10) {
        await updateCard(card.id, {
          estimatedValue: estimateCardValue(card),
        });
      }
    }

    await load();
    setStatus("Estimated missing or placeholder values using Market Engine V2.");
  }

  async function searchCard(card: CollectionCard, saveValue = false) {
    const query = buildMarketQuery(card);

    if (!query) {
      setStatus("This card does not have enough details to search.");
      return;
    }

    setSearchingId(card.id);
    setStatus("");

const result = await searchLiveMarketForCard(card);    setMarketResult(result);
    setSearchingId(null);

    if (!result.success) {
      setStatus(result.error || "Could not search live market.");
      return;
    }

    const suggestedValue = Number(result.suggestedValue || result.medianPrice || result.averagePrice || 0);

    if (saveValue && suggestedValue > 0) {
      await updateCard(card.id, { estimatedValue: suggestedValue });
      addPriceHistoryPoint(card.id, result);
      await load();
      setStatus(`Updated ${card.player || "card"} to ${money(suggestedValue)} from live market.`);
      return;
    }

    if (result.searchUrl) window.open(result.searchUrl, "_blank");
    setStatus(result.note || `Opened live eBay sold search for: ${query}`);
  }

  async function refreshAllMarketValues() {
    const targets = cardsReadyForMarket.slice(0, 10);

    if (!targets.length) {
      setStatus("No cards have enough searchable details yet.");
      return;
    }

    setSearchingId("all");
    let updated = 0;

    for (const card of targets) {
const result = await searchLiveMarketForCard(card);      const suggestedValue = Number(result.suggestedValue || result.medianPrice || result.averagePrice || 0);

      if (result.success && suggestedValue > 0) {
        await updateCard(card.id, { estimatedValue: suggestedValue });
        addPriceHistoryPoint(card.id, result);
        updated += 1;
      }
    }

    setSearchingId(null);
    await load();
    setStatus(`Live market refresh complete. Updated ${updated} of ${targets.length} searchable cards.`);
  }

  async function searchManual() {
    if (!manualQuery.trim()) {
      setStatus("Enter a card name or search query first.");
      return;
    }

    setSearchingId("manual");
    setStatus("");

    const result = await searchLiveMarket(manualQuery);
    setMarketResult(result);
    setSearchingId(null);

    if (!result.success || !result.searchUrl) {
      setStatus(result.error || "Could not open live eBay search.");
      return;
    }

    window.open(result.searchUrl, "_blank");
    setStatus(result.note || `Opened live eBay sold search for: ${manualQuery}`);
  }

  return (
    <main className="min-h-screen px-4 pb-28 pt-6">
      <p className="text-sm text-cm-muted">{source} Market • CardMania V10 Market Intelligence</p>
      <h1 className="text-3xl font-black">Market Intelligence</h1>
      <p className="mt-1 text-sm text-cm-muted">
        Median-led valuation, live sold comps, outlier filtering, confidence scoring, and profit tracking.
      </p>

      {status && (
        <div className="mt-5 rounded-[22px] border border-cm-line bg-cm-surface p-4 text-sm text-cm-green">
          {status}
        </div>
      )}

      <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-[24px] border border-cm-line bg-cm-surface p-4">
          <p className="text-xs text-cm-muted">Market Value</p>
          <p className="mt-1 text-2xl font-black">{money(marketSummary.value)}</p>
        </div>

        <div className="rounded-[24px] border border-cm-line bg-cm-surface p-4">
          <p className="text-xs text-cm-muted">Profit / Loss</p>
          <p className={marketSummary.profit >= 0 ? "mt-1 text-2xl font-black text-cm-green" : "mt-1 text-2xl font-black text-red-300"}>
            {marketSummary.profit >= 0 ? "+" : "-"}{money(Math.abs(marketSummary.profit))}
          </p>
        </div>

        <div className="rounded-[24px] border border-cm-line bg-cm-surface p-4">
          <p className="text-xs text-cm-muted">Searchable Cards</p>
          <p className="mt-1 text-3xl font-black">{cardsReadyForMarket.length}</p>
        </div>

        <div className="rounded-[24px] border border-cm-line bg-cm-surface p-4">
          <p className="text-xs text-cm-muted">High Confidence</p>
          <p className="mt-1 text-3xl font-black text-cm-green">{marketSummary.highConfidence}</p>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-[24px] border border-cm-line bg-cm-surface p-4">
          <p className="text-xs text-cm-muted">Missing Value</p>
          <p className="mt-1 text-3xl font-black">{missingValues.length}</p>
        </div>

        <div className="rounded-[24px] border border-cm-line bg-cm-surface p-4">
          <p className="text-xs text-cm-muted">Cost Basis</p>
          <p className="mt-1 text-2xl font-black">{money(marketSummary.cost)}</p>
        </div>

        <div className="rounded-[24px] border border-cm-line bg-cm-surface p-4">
          <p className="text-xs text-cm-muted">Rising</p>
          <p className="mt-1 text-3xl font-black text-cm-green">{marketSummary.rising}</p>
        </div>

        <div className="rounded-[24px] border border-cm-line bg-cm-surface p-4">
          <p className="text-xs text-cm-muted">Watch List</p>
          <p className="mt-1 text-3xl font-black">{marketSummary.watch}</p>
        </div>
      </section>

      <section className="mt-5 rounded-[28px] border border-cm-line bg-cm-surface p-4">
        <h2 className="text-lg font-black">Live Market Search</h2>
        <p className="mt-1 text-sm text-cm-muted">
          Search sold listings using any card name or details. V2 prioritizes median comps and rejected outliers.
        </p>

        <input
          value={manualQuery}
          onChange={(e) => setManualQuery(e.target.value)}
          placeholder="Example: Ronaldinho Topps Chrome Legendary Refractor"
          className="mt-3 w-full rounded-2xl border border-cm-line bg-black/30 p-3 outline-none"
        />

        <button
          onClick={searchManual}
          disabled={searchingId === "manual"}
          className="mt-3 w-full rounded-2xl bg-blue-600 py-3 font-black text-white disabled:opacity-50"
        >
          {searchingId === "manual" ? "Checking..." : "Analyze Sold Listings"}
        </button>

        {marketResult && (
          <div className="mt-4 rounded-2xl border border-cm-line bg-black/20 p-4">
            <p className="text-xs text-cm-muted">Parsed Market Result</p>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div><p className="text-xs text-cm-muted">Market Value</p><p className="text-xl font-black">{money(marketResult.suggestedValue || marketResult.medianPrice || marketResult.averagePrice)}</p></div>
              <div><p className="text-xs text-cm-muted">Average</p><p className="text-xl font-black">{money(marketResult.averagePrice)}</p></div>
              <div><p className="text-xs text-cm-muted">Median</p><p className="text-xl font-black">{money(marketResult.medianPrice)}</p></div>
              <div><p className="text-xs text-cm-muted">Confidence</p><p className="text-xl font-black">{marketResult.confidence || "Low"}</p></div>
            </div>
            <p className="mt-3 text-sm text-cm-muted">
              {marketResult.soldCount || 0} comps • Range {money(marketResult.lowestPrice)} – {money(marketResult.highestPrice)} • Spread {marketResult.spreadPercent || 0}%
            </p>
            <p className="mt-1 text-xs text-cm-muted">
              Source: {marketResult.sourceMode === "api" ? "eBay API" : "eBay sold-search fallback"} • Kept {marketResult.keptCount || marketResult.soldCount || 0} / Rejected {marketResult.rejectedCount || 0}
            </p>
            {marketResult.note && <p className="mt-1 text-xs text-cm-muted">{marketResult.note}</p>}

            {!!marketResult.sales?.length && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-black uppercase tracking-wide text-cm-muted">Top comparable sales</p>
                {marketResult.sales.slice(0, 5).map((sale, index) => (
                  <a
                    key={`${sale.title}-${sale.price}-${index}`}
                    href={sale.url || marketResult.searchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-2xl border border-cm-line bg-black/20 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="line-clamp-2 text-sm font-bold">{sale.title}</p>
                        <p className="mt-1 text-xs text-cm-muted">
                          Match {sale.score || 0}% {sale.flags?.length ? `• ${sale.flags.join(" • ")}` : ""}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-black">{money(sale.price)}</p>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <button
          onClick={estimateAll}
          className="w-full rounded-2xl bg-cm-purple py-3 font-black"
        >
          Estimate Missing Values
        </button>

        <button
          onClick={refreshAllMarketValues}
          disabled={searchingId === "all"}
          className="w-full rounded-2xl bg-green-600 py-3 font-black disabled:opacity-50"
        >
          {searchingId === "all" ? "Refreshing..." : "Refresh Top 10 Live Values"}
        </button>
      </div>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-black">Top Profit Cards</h2>

        {topProfits.length ? (
          <div className="space-y-3">
            {topProfits.map(({ card, intelligence }) => (
              <div key={card.id} className="rounded-[24px] border border-cm-line bg-cm-surface p-4">
                <Link href={`/card/${card.id}`} className="block">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black">{card.player || "Unknown Player"}</h3>
                      <p className="text-sm text-cm-muted">{card.set || "Unknown Set"}</p>
                      <p className="mt-1 text-xs text-cm-muted">{buildMarketQuery(card) || "No searchable details yet"}</p>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                        <span className="rounded-xl bg-black/20 p-2">Confidence <b className={marketToneClass(intelligence.confidenceLabel)}>{intelligence.confidenceScore}</b></span>
                        <span className="rounded-xl bg-black/20 p-2">Trend <b className={marketToneClass(intelligence.trend)}>{intelligence.trend}</b></span>
                        <span className="rounded-xl bg-black/20 p-2">Verdict <b className={marketToneClass(intelligence.verdict)}>{intelligence.verdict}</b></span>
                        <span className="rounded-xl bg-black/20 p-2">Raw/PSA10 <b>{money(intelligence.rawValue)} / {money(intelligence.psa10Value)}</b></span>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-black">{money(intelligence.fairValue)}</p>
                      <p className={intelligence.fairValue - Number(card.purchasePrice || 0) >= 0 ? "text-xs text-cm-green" : "text-xs text-red-300"}>
                        {intelligence.fairValue - Number(card.purchasePrice || 0) >= 0 ? "+" : "-"}{money(Math.abs(intelligence.fairValue - Number(card.purchasePrice || 0)))}
                      </p>
                      <p className="mt-1 text-[11px] text-cm-muted">{intelligence.valueSource}</p>
                      <p className="mt-1 text-[11px] text-cm-muted">{profitLabel(card)}</p>
                    </div>
                  </div>
                </Link>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => searchCard(card, false)}
                    disabled={searchingId === card.id}
                    className="rounded-2xl bg-blue-600 py-2 text-sm font-black text-white disabled:opacity-50"
                  >
                    Analyze
                  </button>
                  <button
                    onClick={() => searchCard(card, true)}
                    disabled={searchingId === card.id}
                    className="rounded-2xl bg-green-600 py-2 text-sm font-black text-white disabled:opacity-50"
                  >
                    Update Value
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[24px] border border-cm-line bg-cm-surface p-5 text-cm-muted">No cards yet.</div>
        )}
      </section>

      <section className="mt-6 rounded-[28px] border border-cm-line bg-cm-surface p-4">
        <h2 className="text-lg font-black">Live Source Status</h2>
        <ul className="mt-3 space-y-2 text-sm text-cm-muted">
          <li>✅ eBay sold listing search and parsing</li>
          <li>✅ Median-led Market Engine V2 pricing</li>
          <li>✅ Average, median, low, high, spread, and confidence score</li>
          <li>✅ Raw vs graded value model, trend, liquidity, risk, and investment verdict</li>
          <li>✅ Card value update and local price history</li>
          <li>🔜 130Point confirmed sale prices</li>
          <li>🔜 PSA population reports</li>
        </ul>
      </section>

      <BottomNav />
    </main>
  );
}
