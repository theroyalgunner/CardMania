"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
import { CollectionCard, getCollectionStats } from "@/services/collectionStore";
import { listCards } from "@/services/cardRepository";
import { estimateCardValue, profitLabel } from "@/services/marketEngine";
import { calculateCardIntelligence, scoreColor } from "@/services/cardIntelligence";

function money(value?: number) {
  return `£${Number(value || 0).toLocaleString()}`;
}

export default function HomePage() {
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [source, setSource] = useState("Loading");

  async function load() {
    const result = await listCards();
    setCards(result.data || []);
    setSource(result.source === "cloud" ? "Cloud" : "Local");
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => getCollectionStats(cards), [cards]);
  const latestCard = stats.latestCard;
  const estimatedTotal = useMemo(
    () => cards.reduce((sum, card) => sum + Number(card.estimatedValue || estimateCardValue(card) || 0), 0),
    [cards]
  );
  const topIntel = useMemo(
    () =>
      [...cards]
        .map((card) => ({ card, intel: calculateCardIntelligence(card) }))
        .sort((a, b) => b.intel.score - a.intel.score)[0] || null,
    [cards]
  );

  return (
    <main className="min-h-screen px-4 pb-28 pt-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-cm-muted">{source} • AI Collector Platform</p>
          <h1 className="text-3xl font-black">CardMania</h1>
        </div>
        <div className="rounded-full bg-cm-purple px-4 py-2 text-sm font-bold">V9.1</div>
      </header>

      <section className="mb-5 rounded-[30px] border border-cm-line bg-gradient-to-br from-violet-500/30 to-white/5 p-5 shadow-card">
        <p className="text-xs text-cm-muted">Collection Value</p>
        <div className="mt-1 text-4xl font-black">{money(estimatedTotal || stats.estimatedValue)}</div>
        <p className={stats.profit >= 0 ? "mt-2 text-cm-green" : "mt-2 text-red-300"}>
          {stats.profit >= 0 ? "+" : "-"}{money(Math.abs(stats.profit))} profit/loss
        </p>
      </section>

      <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-[24px] border border-cm-line bg-cm-surface p-4">
          <p className="text-xs text-cm-muted">Saved Cards</p>
          <div className="mt-1 text-3xl font-black">{stats.totalCards}</div>
        </div>
        <div className="rounded-[24px] border border-cm-line bg-cm-surface p-4">
          <p className="text-xs text-cm-muted">Average Value</p>
          <div className="mt-1 text-lg font-black text-yellow-300">{money(stats.averageValue)}</div>
        </div>
        <div className="rounded-[24px] border border-cm-line bg-cm-surface p-4">
          <p className="text-xs text-cm-muted">Scanner</p>
          <div className="mt-1 text-lg font-black text-cm-green">Pro Ready</div>
        </div>
        <div className="rounded-[24px] border border-cm-line bg-cm-surface p-4">
          <p className="text-xs text-cm-muted">Market</p>
          <div className="mt-1 text-lg font-black text-blue-300">Live Tools</div>
        </div>
      </section>

      <section className="mb-5">
        <h2 className="mb-3 text-lg font-black">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Link href="/scanner" className="rounded-[24px] border border-cm-line bg-cm-surface p-5 font-black">📷 AI Scan</Link>
          <Link href="/bulk" className="rounded-[24px] border border-cm-line bg-cm-surface p-5 font-black">🧺 Bulk Scan</Link>
          <Link href="/collection" className="rounded-[24px] border border-cm-line bg-cm-surface p-5 font-black">📚 Collection</Link>
          <Link href="/portfolio" className="rounded-[24px] border border-cm-line bg-cm-surface p-5 font-black">📊 Portfolio</Link>
          <Link href="/market" className="rounded-[24px] border border-cm-line bg-cm-surface p-5 font-black">💹 Market</Link>
          <Link href="/grading" className="rounded-[24px] border border-cm-line bg-cm-surface p-5 font-black">🏆 Grading</Link>
          <Link href="/assistant" className="rounded-[24px] border border-cm-line bg-cm-surface p-5 font-black">🤖 Assistant</Link>
          <Link href="/wishlist" className="rounded-[24px] border border-cm-line bg-cm-surface p-5 font-black">❤️ Wishlist</Link>
        </div>
      </section>

      {topIntel && (
        <section className="mb-5 rounded-[28px] border border-cm-line bg-cm-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-cm-muted">Top Card Intelligence</p>
              <h2 className="mt-1 text-xl font-black">{topIntel.card.player || "Unknown Player"}</h2>
              <p className="mt-1 text-sm text-cm-muted">{topIntel.card.set || "Unknown Set"}</p>
            </div>
            <div className="text-right">
              <p className={`text-4xl font-black ${scoreColor(topIntel.intel.score)}`}>{topIntel.intel.score}</p>
              <p className="text-xs text-cm-muted">{topIntel.intel.action}</p>
            </div>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-black">Latest Card</h2>
        {latestCard ? (
          <Link href={`/card/${latestCard.id}`} className="block rounded-[28px] border border-cm-line bg-cm-surface p-4">
            {latestCard.image && <img src={latestCard.image} alt={latestCard.player || "Card"} className="mb-3 max-h-64 w-full rounded-2xl bg-black/30 object-contain" />}
            <h3 className="text-xl font-black">{latestCard.player || "Unknown Player"}</h3>
            <p className="mt-1 text-sm text-cm-muted">{latestCard.set || "Unknown Set"}</p>
            <p className="mt-2 text-sm text-cm-green">{profitLabel(latestCard)}</p>
          </Link>
        ) : (
          <div className="rounded-[24px] border border-cm-line bg-cm-surface p-5 text-cm-muted">No cards yet. Start by scanning or bulk importing.</div>
        )}
      </section>

      <BottomNav />
    </main>
  );
}
