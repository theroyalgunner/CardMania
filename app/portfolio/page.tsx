"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
import { BreakdownBars, InsightCards } from "@/components/PortfolioCharts";
import { PortfolioHistoryChart } from "@/components/PortfolioHistoryChart";
import { CollectionCard, getCollectionStats } from "@/services/collectionStore";
import { listCards } from "@/services/cardRepository";
import { profitLabel } from "@/services/marketEngine";
import { getCardsNeedingAttention, getPortfolioBreakdown, getPortfolioInsights, getTopProfitCards } from "@/services/portfolioInsights";
import { addPortfolioSnapshot, getPortfolioHistory, portfolioMovement, PortfolioHistoryPoint } from "@/services/portfolioHistoryStore";

export default function PortfolioPage() {
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [source, setSource] = useState("Loading");
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<PortfolioHistoryPoint[]>([]);

  async function loadPortfolio() {
    setMessage("");
    const result = await listCards();
    setCards(result.data || []);
    setSource(result.source === "cloud" ? "Cloud" : "Local");
    if (!result.ok) setMessage(result.message || "Could not load portfolio.");

    const loadedCards = result.data || [];
    const estimatedValue = loadedCards.reduce((sum, card) => sum + Number(card.estimatedValue || 0), 0);
    const purchaseValue = loadedCards.reduce((sum, card) => sum + Number(card.purchasePrice || 0), 0);
    addPortfolioSnapshot({
      value: estimatedValue,
      invested: purchaseValue,
      profit: estimatedValue - purchaseValue,
      cards: loadedCards.length,
    });
    setHistory(getPortfolioHistory());
  }

  useEffect(() => {
    loadPortfolio();
  }, []);

  const stats = getCollectionStats(cards);
  const topValueCards = [...cards].sort((a, b) => Number(b.estimatedValue || 0) - Number(a.estimatedValue || 0)).slice(0, 5);
  const topProfitCards = getTopProfitCards(cards, 5);
  const attentionCards = getCardsNeedingAttention(cards, 4);
  const manufacturerBreakdown = getPortfolioBreakdown(cards, "manufacturer");
  const teamBreakdown = getPortfolioBreakdown(cards, "team");
  const insights = getPortfolioInsights(cards);
  const movement = portfolioMovement(history);
  const invested = stats.purchaseValue || 0;
  const value = stats.estimatedValue || 0;
  const max = Math.max(value, invested, 1);
  const valueBar = Math.min(100, Math.round((value / max) * 100));
  const costBar = Math.min(100, Math.round((invested / max) * 100));

  return (
    <main className="min-h-screen px-4 pb-28 pt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-cm-muted">{source} Portfolio • CardMania V7.2</p>
          <h1 className="text-3xl font-black">Portfolio Pro</h1>
        </div>
        <button onClick={loadPortfolio} className="rounded-2xl border border-cm-line bg-cm-surface px-4 py-2 text-sm font-black">Refresh</button>
      </div>

      {message && <div className="mt-4 rounded-[22px] border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-200">{message}</div>}

      <section className="mt-5 rounded-[30px] border border-cm-line bg-gradient-to-br from-violet-500/30 to-white/5 p-5 shadow-card">
        <p className="text-xs text-cm-muted">Collection Value</p>
        <div className="mt-1 text-4xl font-black">£{stats.estimatedValue.toLocaleString()}</div>
        <p className={stats.profit >= 0 ? "mt-2 text-cm-green" : "mt-2 text-red-300"}>
          {stats.profit >= 0 ? "+" : "-"}£{Math.abs(stats.profit).toLocaleString()} ({stats.profitPercent}% ROI)
        </p>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-[24px] border border-cm-line bg-cm-surface p-4"><p className="text-xs text-cm-muted">Invested</p><p className="mt-1 text-2xl font-black">£{stats.purchaseValue.toLocaleString()}</p></div>
        <div className="rounded-[24px] border border-cm-line bg-cm-surface p-4"><p className="text-xs text-cm-muted">Cards</p><p className="mt-1 text-2xl font-black">{stats.totalCards}</p></div>
        <div className="rounded-[24px] border border-cm-line bg-cm-surface p-4"><p className="text-xs text-cm-muted">Average</p><p className="mt-1 text-2xl font-black">£{stats.averageValue.toLocaleString()}</p></div>
        <div className="rounded-[24px] border border-cm-line bg-cm-surface p-4"><p className="text-xs text-cm-muted">Needs Data</p><p className="mt-1 text-2xl font-black">{attentionCards.length}</p></div>
        <div className="rounded-[24px] border border-cm-line bg-cm-surface p-4"><p className="text-xs text-cm-muted">Movement</p><p className={movement.valueChange >= 0 ? "mt-1 text-2xl font-black text-cm-green" : "mt-1 text-2xl font-black text-red-300"}>{movement.valueChange >= 0 ? "+" : "-"}£{Math.abs(movement.valueChange).toLocaleString()}</p></div>
      </section>

      <section className="mt-5 rounded-[28px] border border-cm-line bg-cm-surface p-4">
        <h2 className="text-lg font-black">Investment Snapshot</h2>
        <div className="mt-4 space-y-4">
          <div>
            <div className="mb-1 flex justify-between text-sm"><span className="text-cm-muted">Current Value</span><b>£{value.toLocaleString()}</b></div>
            <div className="h-3 rounded-full bg-black/40"><div className="h-3 rounded-full bg-cm-purple" style={{ width: `${valueBar}%` }} /></div>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-sm"><span className="text-cm-muted">Total Cost</span><b>£{invested.toLocaleString()}</b></div>
            <div className="h-3 rounded-full bg-black/40"><div className="h-3 rounded-full bg-white/40" style={{ width: `${costBar}%` }} /></div>
          </div>
        </div>
      </section>

      <div className="mt-5">
        <InsightCards insights={insights} />
      </div>

      <div className="mt-5">
        <PortfolioHistoryChart points={history} />
      </div>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <BreakdownBars title="Value by Manufacturer" items={manufacturerBreakdown} />
        <BreakdownBars title="Value by Team" items={teamBreakdown} />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-black">Most Valuable Cards</h2>
          {topValueCards.length === 0 ? <div className="rounded-[24px] border border-cm-line bg-cm-surface p-5 text-cm-muted">No cards yet.</div> : (
            <div className="space-y-3">
              {topValueCards.map((card) => (
                <Link key={card.id} href={`/card/${card.id}`} className="block rounded-[24px] border border-cm-line bg-cm-surface p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div><h3 className="font-black">{card.player || "Unknown Player"}</h3><p className="text-sm text-cm-muted">{card.set || "Unknown Set"}</p></div>
                    <div className="text-right"><p className="font-black">£{Number(card.estimatedValue || 0).toLocaleString()}</p><p className="text-xs text-cm-green">{profitLabel(card)}</p></div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-lg font-black">Top Profit Cards</h2>
          {topProfitCards.length === 0 ? <div className="rounded-[24px] border border-cm-line bg-cm-surface p-5 text-cm-muted">No profit data yet.</div> : (
            <div className="space-y-3">
              {topProfitCards.map(({ card, profit, roi }) => (
                <Link key={card.id} href={`/card/${card.id}`} className="block rounded-[24px] border border-cm-line bg-cm-surface p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div><h3 className="font-black">{card.player || "Unknown Player"}</h3><p className="text-sm text-cm-muted">{card.set || "Unknown Set"}</p></div>
                    <div className="text-right"><p className={profit >= 0 ? "font-black text-cm-green" : "font-black text-red-300"}>{profit >= 0 ? "+" : "-"}£{Math.abs(profit).toLocaleString()}</p><p className="text-xs text-cm-muted">{roi}% ROI</p></div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {attentionCards.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-black">Needs Cleanup</h2>
          <div className="space-y-3">
            {attentionCards.map((card) => (
              <Link key={card.id} href={`/card/${card.id}`} className="block rounded-[24px] border border-yellow-500/30 bg-yellow-500/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div><h3 className="font-black">{card.player || "Unknown Player"}</h3><p className="text-sm text-cm-muted">Missing player, set, price, or value details.</p></div>
                  <span className="text-sm font-black text-yellow-200">Fix</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <BottomNav />
    </main>
  );
}
