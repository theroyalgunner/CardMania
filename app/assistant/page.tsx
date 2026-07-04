"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
import { CollectionCard, getCollection, getCollectionStats } from "@/services/collectionStore";
import { analyzeCardOpportunity, assistantAnswer, gradeAdvice } from "@/services/cardAdvisor";
import { getWishlist, WishlistItem } from "@/services/wishlistStore";

function money(value?: number) {
  return `£${Number(value || 0).toLocaleString()}`;
}

function toneClass(tone: string) {
  if (tone === "green") return "text-cm-green";
  if (tone === "red") return "text-red-300";
  if (tone === "purple") return "text-cm-purple";
  if (tone === "yellow") return "text-yellow-300";
  return "text-blue-300";
}

export default function AssistantPage() {
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("Ask a question about your cards, grading, wishlist, or portfolio risk.");

  function load() {
    const nextCards = getCollection();
    const nextWishlist = getWishlist();
    setCards(nextCards);
    setWishlist(nextWishlist);
    setAnswer(assistantAnswer("", nextCards, nextWishlist));
  }

  useEffect(() => load(), []);

  const stats = useMemo(() => getCollectionStats(cards), [cards]);
  const opportunities = useMemo(
    () => [...cards].sort((a, b) => analyzeCardOpportunity(b).score - analyzeCardOpportunity(a).score).slice(0, 5),
    [cards]
  );
  const gradeCandidates = useMemo(
    () => opportunities.filter((card) => analyzeCardOpportunity(card).score >= 55).slice(0, 4),
    [opportunities]
  );

  function ask(customQuestion?: string) {
    const nextQuestion = customQuestion || question;
    setQuestion(nextQuestion);
    setAnswer(assistantAnswer(nextQuestion, cards, wishlist));
  }

  const suggestions = [
    "Which cards should I grade?",
    "What is my best opportunity?",
    "What should I sell?",
    "What is my portfolio risk?",
    "Show my best wishlist deals",
  ];

  return (
    <main className="min-h-screen px-4 pb-28 pt-6">
      <p className="text-sm text-cm-muted">Assistant Pro • CardMania</p>
      <h1 className="text-3xl font-black">AI Collector Assistant</h1>
      <p className="mt-1 text-sm text-cm-muted">
        Local investment-style guidance based on your saved cards, values, parallels, grades, and wishlist targets.
      </p>

      <section className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-[22px] border border-cm-line bg-cm-surface p-3 text-center">
          <div className="text-xl font-black">{money(stats.estimatedValue)}</div>
          <div className="text-xs text-cm-muted">Value</div>
        </div>
        <div className="rounded-[22px] border border-cm-line bg-cm-surface p-3 text-center">
          <div className={stats.profit >= 0 ? "text-xl font-black text-cm-green" : "text-xl font-black text-red-300"}>
            {stats.profit >= 0 ? "+" : "-"}{money(Math.abs(stats.profit))}
          </div>
          <div className="text-xs text-cm-muted">P/L</div>
        </div>
        <div className="rounded-[22px] border border-cm-line bg-cm-surface p-3 text-center">
          <div className="text-xl font-black">{wishlist.length}</div>
          <div className="text-xs text-cm-muted">Watchlist</div>
        </div>
      </section>

      <section className="mt-5 rounded-[28px] border border-cm-line bg-cm-surface p-4">
        <h2 className="text-lg font-black">Ask CardMania</h2>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Example: Should I grade my Ronaldinho card?"
          className="mt-3 h-28 w-full rounded-2xl border border-cm-line bg-black/30 p-3 outline-none"
        />
        <button onClick={() => ask()} className="mt-3 w-full rounded-2xl bg-cm-purple py-3 font-black">
          Ask Assistant
        </button>
      </section>

      <section className="mt-5 rounded-[28px] border border-cm-line bg-black/40 p-4">
        <h2 className="text-lg font-black">Answer</h2>
        <p className="mt-2 text-sm leading-6 text-cm-muted">{answer}</p>
      </section>

      <section className="mt-5">
        <h2 className="mb-3 text-lg font-black">Quick Prompts</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {suggestions.map((item) => (
            <button
              key={item}
              onClick={() => ask(item)}
              className="rounded-[22px] border border-cm-line bg-cm-surface p-4 text-left text-sm font-bold"
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-black">Opportunity Scores</h2>
        {opportunities.length ? (
          <div className="space-y-3">
            {opportunities.map((card) => {
              const analysis = analyzeCardOpportunity(card);
              return (
                <Link key={card.id} href={`/card/${card.id}`} className="block rounded-[24px] border border-cm-line bg-cm-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black">{card.player || "Unknown Player"}</h3>
                      <p className="mt-1 text-sm text-cm-muted">{card.set || "Unknown Set"}</p>
                      <p className="mt-2 text-xs text-cm-muted">{analysis.headline}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-black ${toneClass(analysis.tone)}`}>{analysis.score}/100</p>
                      <p className="text-xs text-cm-muted">{analysis.rating}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[24px] border border-cm-line bg-cm-surface p-5 text-cm-muted">No cards yet.</div>
        )}
      </section>

      <section className="mt-6 rounded-[28px] border border-cm-line bg-cm-surface p-4">
        <h2 className="text-lg font-black">Grading Watch</h2>
        {gradeCandidates.length ? (
          <div className="mt-3 space-y-3">
            {gradeCandidates.map((card) => (
              <div key={card.id} className="rounded-2xl bg-black/20 p-3">
                <p className="font-black">{card.player || "Unknown Player"}</p>
                <p className="mt-1 text-xs leading-5 text-cm-muted">{gradeAdvice(card)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-cm-muted">No strong grading candidates yet. Add values, serial numbers, and parallels.</p>
        )}
      </section>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Link href="/portfolio" className="rounded-[24px] border border-cm-line bg-cm-surface p-4 font-black">Portfolio →</Link>
        <Link href="/wishlist" className="rounded-[24px] border border-cm-line bg-cm-surface p-4 font-black">Wishlist →</Link>
      </div>

      <BottomNav />
    </main>
  );
}
