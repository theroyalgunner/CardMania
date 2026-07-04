"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
import { CollectionCard, getCollectionStats } from "@/services/collectionStore";
import { deleteCard, listCards, updateCard } from "@/services/cardRepository";
import {
  applyCollectionView,
  cardProfit,
  collectionToCsv,
  defaultCollectionFilters,
  uniqueOptions,
} from "@/services/collectionFilters";

export default function CollectionPage() {
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [filters, setFilters] = useState(defaultCollectionFilters);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [source, setSource] = useState<"cloud" | "local" | "loading">("loading");
  const [message, setMessage] = useState("");

  async function loadCards() {
    setMessage("");
    const result = await listCards();
    setCards(result.data || []);
    setSource(result.source || "local");
    if (!result.ok) setMessage(result.message || "Could not load cloud collection. Showing local data.");
  }

  async function remove(id: string) {
    const result = await deleteCard(id);
    if (!result.ok) setMessage(result.message || "Delete failed.");
    await loadCards();
  }

  useEffect(() => {
    loadCards();
  }, []);

  const stats = getCollectionStats(cards);
  const visibleCards = useMemo(() => applyCollectionView(cards, filters), [cards, filters]);
  const selectedIds = Object.entries(selected).filter(([, value]) => value).map(([id]) => id);
  const selectedCards = visibleCards.filter((card) => selectedIds.includes(card.id));

  const manufacturers = uniqueOptions(cards, "manufacturer");
  const teams = uniqueOptions(cards, "team");
  const years = uniqueOptions(cards, "year").sort((a, b) => Number(b) - Number(a));
  const grades = uniqueOptions(cards, "grade");

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function toggleAll() {
    if (selectedIds.length === visibleCards.length) {
      setSelected({});
      return;
    }
    setSelected(Object.fromEntries(visibleCards.map((card) => [card.id, true])));
  }

  async function clearSelectedValues() {
    for (const card of selectedCards) {
      await updateCard(card.id, { estimatedValue: 0 });
    }
    setSelected({});
    await loadCards();
    setMessage("Cleared estimated values for selected cards.");
  }

  async function deleteSelected() {
    for (const card of selectedCards) {
      await deleteCard(card.id);
    }
    setSelected({});
    await loadCards();
    setMessage("Deleted selected cards.");
  }

  function exportVisibleCsv() {
    const csv = collectionToCsv(visibleCards);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cardmania-collection-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen px-4 pb-28 pt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-cm-muted">
            {source === "cloud" ? "Cloud Collection" : source === "loading" ? "Loading..." : "Local Collection"} • Collection Pro
          </p>
          <h1 className="text-3xl font-black">My Collection</h1>
          <p className="mt-1 text-sm text-cm-muted">
            {visibleCards.length} shown from {cards.length} saved cards
          </p>
        </div>
        <button onClick={loadCards} className="rounded-2xl border border-cm-line bg-cm-surface px-4 py-2 text-sm font-black">
          Refresh
        </button>
      </div>

      {message && <div className="mt-4 rounded-[22px] border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-200">{message}</div>}

      <section className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-[22px] border border-cm-line bg-cm-surface p-3 text-center"><div className="text-2xl font-black">{stats.totalCards}</div><div className="text-xs text-cm-muted">Cards</div></div>
        <div className="rounded-[22px] border border-cm-line bg-cm-surface p-3 text-center"><div className="text-2xl font-black">£{stats.estimatedValue.toLocaleString()}</div><div className="text-xs text-cm-muted">Value</div></div>
        <div className="rounded-[22px] border border-cm-line bg-cm-surface p-3 text-center"><div className={stats.profit >= 0 ? "text-2xl font-black text-cm-green" : "text-2xl font-black text-red-300"}>£{stats.profit.toLocaleString()}</div><div className="text-xs text-cm-muted">Profit</div></div>
      </section>

      <section className="mt-5 rounded-[28px] border border-cm-line bg-cm-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black">Filters</h2>
          <button onClick={() => setFilters(defaultCollectionFilters)} className="rounded-xl border border-cm-line bg-white/5 px-3 py-2 text-xs font-black">
            Reset
          </button>
        </div>

        <input
          value={filters.query}
          onChange={(e) => updateFilter("query", e.target.value)}
          placeholder="Search player, set, serial, grade, notes..."
          className="mt-4 w-full rounded-2xl border border-cm-line bg-black/30 p-3 outline-none"
        />

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <select value={filters.manufacturer} onChange={(e) => updateFilter("manufacturer", e.target.value)} className="rounded-2xl border border-cm-line bg-black/30 p-3 outline-none">
            <option value="all">All manufacturers</option>
            {manufacturers.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={filters.team} onChange={(e) => updateFilter("team", e.target.value)} className="rounded-2xl border border-cm-line bg-black/30 p-3 outline-none">
            <option value="all">All teams</option>
            {teams.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={filters.year} onChange={(e) => updateFilter("year", e.target.value)} className="rounded-2xl border border-cm-line bg-black/30 p-3 outline-none">
            <option value="all">All years</option>
            {years.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={filters.grade} onChange={(e) => updateFilter("grade", e.target.value)} className="rounded-2xl border border-cm-line bg-black/30 p-3 outline-none">
            <option value="all">All grades</option>
            {grades.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={filters.valueStatus} onChange={(e) => updateFilter("valueStatus", e.target.value)} className="rounded-2xl border border-cm-line bg-black/30 p-3 outline-none">
            <option value="all">All value statuses</option>
            <option value="valued">Has value</option>
            <option value="missing">Missing value</option>
          </select>
          <select value={filters.sort} onChange={(e) => updateFilter("sort", e.target.value)} className="rounded-2xl border border-cm-line bg-black/30 p-3 outline-none">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="value-desc">Highest value</option>
            <option value="value-asc">Lowest value</option>
            <option value="profit-desc">Highest profit</option>
            <option value="profit-asc">Lowest profit</option>
            <option value="player-az">Player A-Z</option>
            <option value="year-desc">Newest year</option>
          </select>
        </div>
      </section>

      <section className="mt-4 flex flex-wrap gap-2">
        <button onClick={toggleAll} className="rounded-2xl border border-cm-line bg-white/5 px-4 py-2 text-sm font-black">
          {selectedIds.length === visibleCards.length && visibleCards.length ? "Clear Selection" : "Select Visible"}
        </button>
        <button onClick={exportVisibleCsv} className="rounded-2xl border border-cm-line bg-white/5 px-4 py-2 text-sm font-black">Export Visible CSV</button>
        {selectedIds.length > 0 && (
          <>
            <button onClick={clearSelectedValues} className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm font-black text-yellow-200">Clear Values ({selectedIds.length})</button>
            <button onClick={deleteSelected} className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-black text-red-300">Delete Selected</button>
          </>
        )}
      </section>

      {visibleCards.length === 0 ? (
        <div className="mt-5 rounded-[24px] border border-cm-line bg-cm-surface p-5 text-cm-muted">No cards found.</div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visibleCards.map((card) => {
            const profit = cardProfit(card);
            return (
              <div key={card.id} className="overflow-hidden rounded-[28px] border border-cm-line bg-cm-surface shadow-card">
                <div className="flex items-center justify-between border-b border-cm-line px-4 py-3">
                  <label className="flex items-center gap-2 text-sm text-cm-muted">
                    <input type="checkbox" checked={Boolean(selected[card.id])} onChange={(e) => setSelected((current) => ({ ...current, [card.id]: e.target.checked }))} />
                    Select
                  </label>
                  <span className={profit >= 0 ? "text-sm font-black text-cm-green" : "text-sm font-black text-red-300"}>{profit >= 0 ? "+" : "-"}£{Math.abs(profit).toLocaleString()}</span>
                </div>

                <Link href={`/card/${card.id}`}>
                  {card.image ? (
                    <div className="bg-black/30 p-3"><img src={card.image} alt={card.player || "Card"} className="max-h-72 w-full rounded-2xl object-contain" /></div>
                  ) : (
                    <div className="flex h-56 items-center justify-center bg-black/30 text-5xl font-black text-cm-muted">CM</div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div><h2 className="text-lg font-black">{card.player || "Unknown Player"}</h2><p className="mt-1 text-sm text-cm-muted">{card.team || "Unknown Team"}</p></div>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-cm-muted">#{card.cardNumber || "—"}</span>
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-cm-muted">
                      <p><span className="text-white">Set:</span> {card.set || "Unknown Set"}</p>
                      <p><span className="text-white">Parallel:</span> {card.parallel || "—"}</p>
                      <p><span className="text-white">Grade:</span> {card.grade || "Raw"}</p>
                      <p><span className="text-white">Cost:</span> £{Number(card.purchasePrice || 0).toLocaleString()} <span className="text-white">Value:</span> £{Number(card.estimatedValue || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </Link>
                <div className="grid grid-cols-2 gap-2 px-4 pb-4">
                  <Link href={`/card/${card.id}`} className="rounded-2xl border border-cm-line bg-white/5 py-3 text-center text-sm font-black">Open</Link>
                  <button onClick={() => remove(card.id)} className="rounded-2xl border border-red-500/40 bg-red-500/10 py-3 text-sm font-black text-red-300">Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <BottomNav />
    </main>
  );
}
