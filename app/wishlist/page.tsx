"use client";

import { useEffect, useMemo, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { searchLiveMarket } from "@/services/liveMarket";
import { wishlistDealLabel } from "@/services/cardAdvisor";
import {
  WishlistItem,
  addWishlistItem,
  deleteWishlistItem,
  getWishlist,
  updateWishlistItem,
  wishlistStats,
} from "@/services/wishlistStore";

function money(value?: number) {
  return `£${Number(value || 0).toLocaleString()}`;
}

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [name, setName] = useState("");
  const [targetPrice, setTargetPrice] = useState(0);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priority, setPriority] = useState<WishlistItem["priority"]>("Medium");
  const [notes, setNotes] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  function load() {
    setItems(getWishlist());
  }

  useEffect(() => load(), []);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => wishlistDealLabel(b).score - wishlistDealLabel(a).score),
    [items]
  );

  function addItem() {
    if (!name.trim()) return;
    addWishlistItem({
      id: crypto.randomUUID(),
      name: name.trim(),
      targetPrice,
      currentPrice,
      priority,
      notes,
      createdAt: new Date().toISOString(),
    });
    setName("");
    setTargetPrice(0);
    setCurrentPrice(0);
    setPriority("Medium");
    setNotes("");
    setMessage("Wishlist card added.");
    load();
  }

  function remove(id: string) {
    deleteWishlistItem(id);
    setMessage("Wishlist card removed.");
    load();
  }

  async function refreshItem(item: WishlistItem) {
    setLoadingId(item.id);
    setMessage("");

    const result = await searchLiveMarket(item.name);
    setLoadingId(null);

    if (!result.success) {
      setMessage(result.error || "Could not refresh wishlist market price.");
      return;
    }

    const suggested = Number(result.suggestedValue || result.medianPrice || result.averagePrice || 0);

    if (suggested > 0) {
      updateWishlistItem(item.id, {
        currentPrice: suggested,
        notes: item.notes || result.note || "Updated from live market intelligence.",
      });
      setMessage(`Updated ${item.name} to ${money(suggested)} from market comps.`);
      load();
      return;
    }

    if (result.searchUrl) window.open(result.searchUrl, "_blank");
    setMessage(result.note || "Opened eBay sold search. No parsed price found yet.");
  }

  function updatePrice(id: string, key: "targetPrice" | "currentPrice", value: number) {
    updateWishlistItem(id, { [key]: value });
    load();
  }

  const stats = wishlistStats(items);
  const strongestDeals = sortedItems.filter((item) => wishlistDealLabel(item).score >= 65).length;

  return (
    <main className="min-h-screen px-4 pb-28 pt-6">
      <p className="text-sm text-cm-muted">Wishlist Pro • CardMania</p>
      <h1 className="text-3xl font-black">Wishlist Alerts</h1>
      <p className="mt-1 text-sm text-cm-muted">
        Track target cards, market prices, deal labels, and buy alerts.
      </p>

      {message && (
        <div className="mt-5 rounded-[22px] border border-cm-line bg-cm-surface p-4 text-sm text-cm-muted">
          {message}
        </div>
      )}

      <section className="mt-5 grid grid-cols-4 gap-3">
        <div className="rounded-[22px] border border-cm-line bg-cm-surface p-3 text-center">
          <div className="text-2xl font-black">{stats.total}</div>
          <div className="text-xs text-cm-muted">Targets</div>
        </div>
        <div className="rounded-[22px] border border-cm-line bg-cm-surface p-3 text-center">
          <div className="text-2xl font-black">{money(stats.targetValue)}</div>
          <div className="text-xs text-cm-muted">Target</div>
        </div>
        <div className="rounded-[22px] border border-cm-line bg-cm-surface p-3 text-center">
          <div className="text-2xl font-black">{money(stats.currentValue)}</div>
          <div className="text-xs text-cm-muted">Market</div>
        </div>
        <div className="rounded-[22px] border border-cm-line bg-cm-surface p-3 text-center">
          <div className="text-2xl font-black text-cm-green">{strongestDeals}</div>
          <div className="text-xs text-cm-muted">Alerts</div>
        </div>
      </section>

      <section className="mt-5 rounded-[28px] border border-cm-line bg-cm-surface p-4">
        <h2 className="text-lg font-black">Add Target</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Card name, e.g. Ronaldinho Topps Chrome Gold /50"
          className="mt-3 w-full rounded-2xl border border-cm-line bg-black/30 p-3 outline-none"
        />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block text-xs text-cm-muted">
            Target Price (£)
            <input
              type="number"
              value={targetPrice}
              onChange={(e) => setTargetPrice(Number(e.target.value))}
              className="mt-1 w-full rounded-2xl border border-cm-line bg-black/30 p-3 text-white outline-none"
            />
          </label>
          <label className="block text-xs text-cm-muted">
            Current Price (£)
            <input
              type="number"
              value={currentPrice}
              onChange={(e) => setCurrentPrice(Number(e.target.value))}
              className="mt-1 w-full rounded-2xl border border-cm-line bg-black/30 p-3 text-white outline-none"
            />
          </label>
        </div>
        <label className="mt-3 block text-xs text-cm-muted">
          Priority
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as WishlistItem["priority"])}
            className="mt-1 w-full rounded-2xl border border-cm-line bg-black/30 p-3 text-white outline-none"
          >
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes: preferred grade, seller, max budget..."
          className="mt-3 min-h-20 w-full rounded-2xl border border-cm-line bg-black/30 p-3 outline-none"
        />
        <button onClick={addItem} className="mt-3 w-full rounded-2xl bg-cm-purple py-3 font-black">
          Add Wishlist Card
        </button>
      </section>

      <section className="mt-5 space-y-3">
        {sortedItems.length ? (
          sortedItems.map((item) => {
            const deal = wishlistDealLabel(item);
            const discount = item.targetPrice && item.currentPrice ? Math.round(((item.targetPrice - item.currentPrice) / item.targetPrice) * 100) : 0;
            return (
              <div key={item.id} className="rounded-[24px] border border-cm-line bg-cm-surface p-4">
                <div className="flex justify-between gap-3">
                  <div>
                    <b>{item.name}</b>
                    <p className="mt-1 text-xs text-cm-muted">Priority: {item.priority}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-black ${deal.tone}`}>{deal.label}</p>
                    <p className="text-xs text-cm-muted">Score {deal.score}/100</p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="text-xs text-cm-muted">
                    Target
                    <input
                      type="number"
                      value={item.targetPrice || 0}
                      onChange={(e) => updatePrice(item.id, "targetPrice", Number(e.target.value))}
                      className="mt-1 w-full rounded-2xl border border-cm-line bg-black/30 p-3 text-white outline-none"
                    />
                  </label>
                  <label className="text-xs text-cm-muted">
                    Current
                    <input
                      type="number"
                      value={item.currentPrice || 0}
                      onChange={(e) => updatePrice(item.id, "currentPrice", Number(e.target.value))}
                      className="mt-1 w-full rounded-2xl border border-cm-line bg-black/30 p-3 text-white outline-none"
                    />
                  </label>
                </div>

                <p className="mt-3 text-sm text-cm-muted">
                  Target {money(item.targetPrice)} • Current {money(item.currentPrice)}
                  {item.targetPrice && item.currentPrice ? ` • ${discount >= 0 ? discount + "% under target" : Math.abs(discount) + "% over target"}` : ""}
                </p>

                {item.notes && <p className="mt-2 text-xs text-cm-muted">{item.notes}</p>}

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button
                    onClick={() => refreshItem(item)}
                    disabled={loadingId === item.id}
                    className="rounded-xl border border-cm-line bg-white/10 px-3 py-2 text-sm font-bold disabled:opacity-50"
                  >
                    {loadingId === item.id ? "Refreshing..." : "Refresh Market"}
                  </button>
                  <button onClick={() => remove(item.id)} className="rounded-xl border border-red-500/40 px-3 py-2 text-sm text-red-300">
                    Remove
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-[24px] border border-cm-line bg-cm-surface p-5 text-cm-muted">No wishlist cards yet.</div>
        )}
      </section>

      <BottomNav />
    </main>
  );
}
