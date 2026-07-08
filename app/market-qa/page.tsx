"use client";

import { useState } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
import { matchMarketListing } from "@/services/cardMatcher";
import { loadMarketMemory } from "@/services/marketMemory";
import { validateMarketSale, isRejectedByValidation } from "@/services/marketValidation/marketValidation";

type RawSale = {
  title: string;
  price: number;
  currency?: string;
  url?: string;
  soldDate?: string;
  image?: string;
};

function money(value?: number) {
  return `£${Number(value || 0).toLocaleString()}`;
}

export default function MarketQAPage() {
  const [query, setQuery] = useState("");
  const [sales, setSales] = useState<any[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function runQA() {
    if (!query.trim()) {
      setStatus("Enter a search query first.");
      return;
    }

    setLoading(true);
    setStatus("");
    setSales([]);

    try {
      const res = await fetch("/api/ebay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus(data?.error || "Market QA search failed.");
        setLoading(false);
        return;
      }

      const checked = (data.sales || []).map((sale: RawSale) => {
        const match = matchMarketListing(sale.title || "", query);
        const validation = validateMarketSale(sale as any, {
          player: query,
          set: query,
          parallel: query,
          notes: query,
        });
        const validationRejected = isRejectedByValidation(validation);

        return {
          ...sale,
          accepted: match.accepted && !validationRejected,
          score: validationRejected ? Math.min(match.score, 49) : match.score,
          reasons: [
            ...(match.reasons || []),
            ...validation.filter((rule) => rule.severity === "pass").map((rule) => rule.message),
          ],
          rejects: [
            ...(match.rejects || []),
            ...validation.filter((rule) => rule.severity === "reject").map((rule) => rule.message),
          ],
        };
      });

      setSales(checked);
      setStatus(`Checked ${checked.length} sold listings.`);
    } catch (error: any) {
      setStatus(error?.message || "Market QA failed.");
    }

    setLoading(false);
  }

  const accepted = sales.filter((sale) => sale.accepted);
  const rejected = sales.filter((sale) => !sale.accepted);
  const memoryEntries = Object.values(loadMarketMemory()).sort((a: any, b: any) => b.lastUpdated - a.lastUpdated);

  return (
    <main className="min-h-screen px-4 pb-28 pt-6">
      <Link href="/market" className="text-sm text-cm-muted">← Back to Market</Link>

      <h1 className="mt-3 text-3xl font-black">Market QA</h1>
      <p className="mt-1 text-sm text-cm-muted">
        Test why sold comps are accepted or rejected before values are saved.
      </p>

      <section className="mt-5 rounded-[28px] border border-cm-line bg-cm-surface p-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Example: Messi Topps Chrome Gold /50"
          className="w-full rounded-2xl border border-cm-line bg-black/30 p-3 outline-none"
        />

        <button
          onClick={runQA}
          disabled={loading}
          className="mt-3 w-full rounded-2xl bg-blue-600 py-3 font-black text-white disabled:opacity-50"
        >
          {loading ? "Checking..." : "Run Market QA"}
        </button>

        {status && <p className="mt-3 text-sm text-cm-green">{status}</p>}
      </section>

      {!!memoryEntries.length && (
        <section className="mt-5 rounded-[28px] border border-cm-line bg-cm-surface p-4">
          <h2 className="text-lg font-black">Market Learning Memory</h2>
          <p className="mt-1 text-sm text-cm-muted">Saved query learning from previous market searches.</p>
          <div className="mt-3 space-y-3">
            {memoryEntries.slice(0, 5).map((memory: any) => (
              <div key={memory.fingerprint} className="rounded-2xl border border-cm-line bg-black/20 p-3">
                <p className="text-xs text-cm-muted">Fingerprint</p>
                <p className="break-words text-sm font-black">{memory.fingerprint}</p>
                <p className="mt-2 text-xs text-cm-muted">Avg Confidence: {memory.averageConfidence} • Successful Searches: {memory.successfulSearches}</p>
                <p className="mt-2 text-xs text-cm-green">Successful: {memory.successfulQueries?.join(" • ") || "None"}</p>
                <p className="mt-1 text-xs text-red-300">Failed: {memory.failedQueries?.join(" • ") || "None"}</p>
                <p className="mt-1 text-xs text-cm-muted">Required: {memory.requiredWords?.join(" • ") || "None"}</p>
                <p className="mt-1 text-xs text-cm-muted">Excluded: {memory.excludedWords?.join(" • ") || "None"}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {!!sales.length && (
        <section className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-cm-line bg-cm-surface p-4">
            <p className="text-xs text-cm-muted">Total</p>
            <p className="text-2xl font-black">{sales.length}</p>
          </div>
          <div className="rounded-2xl border border-cm-line bg-cm-surface p-4">
            <p className="text-xs text-cm-muted">Accepted</p>
            <p className="text-2xl font-black text-cm-green">{accepted.length}</p>
          </div>
          <div className="rounded-2xl border border-cm-line bg-cm-surface p-4">
            <p className="text-xs text-cm-muted">Rejected</p>
            <p className="text-2xl font-black text-red-300">{rejected.length}</p>
          </div>
        </section>
      )}

      <section className="mt-5 space-y-3">
        {sales.map((sale, index) => (
          <a
            key={`${sale.title}-${index}`}
            href={sale.url}
            target="_blank"
            rel="noreferrer"
            className="block rounded-[24px] border border-cm-line bg-cm-surface p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black">{sale.accepted ? "✅ Accepted" : "❌ Rejected"} • Match {sale.score}%</p>
                <p className="mt-1 text-sm">{sale.title}</p>
                <p className="mt-2 text-xs text-cm-muted">
                  Reasons: {sale.reasons.length ? sale.reasons.join(" • ") : "None"}
                </p>
                <p className="mt-1 text-xs text-red-300">
                  Rejects: {sale.rejects.length ? sale.rejects.join(" • ") : "None"}
                </p>
              </div>
              <p className="shrink-0 text-sm font-black">{money(sale.price)}</p>
            </div>
          </a>
        ))}
      </section>

      <BottomNav />
    </main>
  );
}
