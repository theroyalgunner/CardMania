"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Award, CheckCircle2, ClipboardCheck, Gem, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { CollectionCard } from "@/services/collectionStore";
import { listCards } from "@/services/cardRepository";
import { gradingToneClass, rankGradingCandidates } from "@/services/gradingEngine";

function money(value?: number) {
  return `£${Number(value || 0).toLocaleString()}`;
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Award }) {
  return (
    <div className="rounded-[24px] border border-cm-line bg-cm-surface p-4 shadow-card">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
        <Icon size={19} />
      </div>
      <p className="text-xs text-cm-muted">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-cm-muted">{label}</span>
        <b>{value}</b>
      </div>
      <div className="h-2 rounded-full bg-black/30">
        <div className="h-2 rounded-full bg-cm-green" style={{ width: `${Math.max(6, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

export default function GradingPage() {
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [status, setStatus] = useState("Loading grading candidates...");

  async function load() {
    const result = await listCards();
    setCards(result.data || []);
    setStatus(result.ok ? "" : result.message || "Could not load cards.");
  }

  useEffect(() => {
    load();
  }, []);

  const ranked = useMemo(() => rankGradingCandidates(cards).slice(0, 30), [cards]);
  const gradeNow = ranked.filter((item) => item.verdict === "Grade now").length;
  const inspectFirst = ranked.filter((item) => item.verdict === "Inspect first").length;
  const best = ranked[0];
  const totalPsa10Upside = ranked.reduce((sum, item) => sum + Number(item.netPsa10Upside || 0), 0);

  return (
    <main className="min-h-screen px-4 pb-28 pt-6">
      <section className="rounded-[32px] border border-cm-line bg-gradient-to-br from-cm-surface to-black/30 p-5 shadow-card">
        <p className="text-sm text-cm-muted">Sprint 6 Production Polish</p>
        <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-black">Grading Center</h1>
            <p className="mt-2 max-w-2xl text-sm text-cm-muted">
              Prioritize raw cards with the best grading economics. CardMania now compares raw value, PSA 9, PSA 10,
              estimated fee, physical risk, and break-even grade before you submit.
            </p>
          </div>
          <div className="rounded-[24px] border border-cm-line bg-black/20 p-4 text-sm">
            <p className="text-cm-muted">Best candidate</p>
            <p className="mt-1 font-black">{best?.card.player || "No cards yet"}</p>
            <p className={best ? gradingToneClass(best.score) : "text-cm-muted"}>{best ? `${best.score}/100` : "Scan cards first"}</p>
          </div>
        </div>
      </section>

      {status && <div className="mt-5 rounded-[22px] border border-cm-line bg-cm-surface p-4 text-sm text-cm-muted">{status}</div>}

      <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Cards reviewed" value={cards.length} icon={ClipboardCheck} />
        <StatCard label="Grade now" value={gradeNow} icon={Gem} />
        <StatCard label="Inspect first" value={inspectFirst} icon={ShieldCheck} />
        <StatCard label="PSA 10 upside" value={money(totalPsa10Upside)} icon={TrendingUp} />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black">Top Grading Candidates</h2>
            <p className="text-xs text-cm-muted">Ranked by profit, risk, and condition signals</p>
          </div>

          {ranked.length ? (
            ranked.map((item) => (
              <Link key={item.card.id} href={`/card/${item.card.id}`} className="block rounded-[28px] border border-cm-line bg-cm-surface p-4 shadow-card transition hover:border-white/30">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black">{item.card.player || "Unknown Player"}</h3>
                    <p className="text-sm text-cm-muted">
                      {item.card.year || ""} {item.card.set || "Unknown Set"}
                    </p>
                    <p className="mt-1 text-xs text-cm-muted">
                      {item.card.parallel || "Base/standard"} • {item.card.grade || "Raw"} • Recommended: {item.recommendedCompany}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-black ${gradingToneClass(item.score)}`}>{item.score}</p>
                    <p className="text-xs text-cm-muted">grade score</p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs md:grid-cols-5">
                  <div className="rounded-2xl bg-black/20 p-3"><b>{money(item.rawValue)}</b><br /><span className="text-cm-muted">Raw</span></div>
                  <div className="rounded-2xl bg-black/20 p-3"><b>{money(item.psa9Value)}</b><br /><span className="text-cm-muted">PSA 9</span></div>
                  <div className="rounded-2xl bg-black/20 p-3"><b>{money(item.psa10Value)}</b><br /><span className="text-cm-muted">PSA 10</span></div>
                  <div className="rounded-2xl bg-black/20 p-3"><b>{money(item.estimatedFee)}</b><br /><span className="text-cm-muted">Est. fee</span></div>
                  <div className="rounded-2xl bg-black/20 p-3"><b className={gradingToneClass(item.breakEvenGrade)}>{item.breakEvenGrade}</b><br /><span className="text-cm-muted">Break-even</span></div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <Meter label="Centering" value={item.centeringScore} />
                  <Meter label="Surface" value={item.surfaceScore} />
                  <Meter label="Corners" value={item.cornerScore} />
                  <Meter label="Edges" value={item.edgeScore} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className={`rounded-full bg-black/25 px-3 py-1 font-bold ${gradingToneClass(item.verdict)}`}>{item.verdict}</span>
                  <span className={`rounded-full bg-black/25 px-3 py-1 font-bold ${gradingToneClass(item.risk)}`}>{item.risk} risk</span>
                  <span className="rounded-full bg-black/25 px-3 py-1 text-cm-muted">Net PSA 9: {money(item.netPsa9Upside)}</span>
                  <span className="rounded-full bg-black/25 px-3 py-1 text-cm-muted">Net PSA 10: {money(item.netPsa10Upside)}</span>
                </div>

                <p className="mt-3 text-sm text-cm-muted">{item.reasons[0]}</p>
              </Link>
            ))
          ) : (
            <div className="rounded-[24px] border border-cm-line bg-cm-surface p-5 text-cm-muted">No cards yet. Scan or import cards first.</div>
          )}
        </div>

        <aside className="h-fit rounded-[28px] border border-cm-line bg-cm-surface p-5 shadow-card">
          <div className="flex items-center gap-2">
            <Sparkles size={18} />
            <h2 className="font-black">Submission checklist</h2>
          </div>
          <p className="mt-2 text-sm text-cm-muted">Use this before sending cards to PSA, BGS, SGC, or TAG.</p>
          <div className="mt-4 space-y-3">
            {(best?.checklist || [
              "Scan or add cards first.",
              "Open each card detail page and confirm exact set, card number, parallel, and serial.",
              "Compare raw, PSA 9, and PSA 10 sold comps before submitting.",
            ]).map((item) => (
              <div key={item} className="flex gap-3 rounded-2xl bg-black/20 p-3 text-sm text-cm-muted">
                <CheckCircle2 className="mt-0.5 shrink-0 text-cm-green" size={16} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <BottomNav />
    </main>
  );
}
