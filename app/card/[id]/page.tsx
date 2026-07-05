"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { CollectionCard } from "@/services/collectionStore";
import { deleteCard, getCard, updateCard } from "@/services/cardRepository";
import { addPriceHistoryPoint, getPriceHistory, PriceHistoryPoint } from "@/services/priceHistoryStore";
import { buildMarketQuery, LiveMarketResult, marketConfidenceLabel, searchLiveMarket } from "@/services/liveMarket";
import { calculateCardIntelligence, scoreColor } from "@/services/cardIntelligence";
import { calculateDetailIntelligence, detailToneClass, riskToneClass } from "@/services/cardDetailIntelligence";
import { calculateMarketIntelligence, marketToneClass } from "@/services/marketIntelligence";

const textFields: Array<{ key: keyof CollectionCard; label: string; placeholder: string }> = [
  { key: "player", label: "Player", placeholder: "Player name" },
  { key: "team", label: "Team", placeholder: "Team / Club" },
  { key: "manufacturer", label: "Manufacturer", placeholder: "Topps, Panini, Futera" },
  { key: "set", label: "Set / Product", placeholder: "Topps Chrome UEFA" },
  { key: "year", label: "Year", placeholder: "2024" },
  { key: "parallel", label: "Parallel", placeholder: "Gold Refractor /50" },
  { key: "serialNumber", label: "Serial Number", placeholder: "07/50" },
  { key: "cardNumber", label: "Card Number", placeholder: "118" },
  { key: "grade", label: "Grade", placeholder: "Raw, PSA 10, BGS 9.5" },
  { key: "condition", label: "Condition", placeholder: "Raw, Mint, Near Mint" },
  { key: "notes", label: "Notes", placeholder: "Condition, purchase source, seller notes" },
];

function money(value?: number) {
  return `£${Number(value || 0).toLocaleString()}`;
}

function pct(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function isRawGrade(grade?: string) {
  const value = String(grade || "Raw").toLowerCase();
  return !value.includes("psa") && !value.includes("bgs") && !value.includes("sgc") && !value.includes("tag") && !value.includes("cgc");
}

function gradingProjection(card: CollectionCard, intelligenceScore: number) {
  const currentValue = Number(card.estimatedValue || 0);
  const purchasePrice = Number(card.purchasePrice || 0);
  const gradingCost = 35;
  const raw = isRawGrade(card.grade);
  const psa9Multiplier = raw ? 1.45 : 1;
  const psa10Multiplier = raw ? (intelligenceScore >= 75 ? 3.2 : intelligenceScore >= 55 ? 2.35 : 1.75) : 1;
  const psa9Value = Math.round(currentValue * psa9Multiplier);
  const psa10Value = Math.round(currentValue * psa10Multiplier);
  const breakeven = purchasePrice + gradingCost;
  const expectedValue = Math.round((psa9Value * 0.55) + (psa10Value * 0.45));
  const expectedProfit = expectedValue - breakeven;

  return {
    raw,
    gradingCost,
    psa9Value,
    psa10Value,
    breakeven,
    expectedValue,
    expectedProfit,
    roi: breakeven ? (expectedProfit / breakeven) * 100 : 0,
  };
}

function makeAISummary(
  card: CollectionCard,
  marketIntel: ReturnType<typeof calculateMarketIntelligence>,
  projection: ReturnType<typeof gradingProjection>,
  missingFields: string[],
) {
  const player = card.player || "This card";
  const valueText = money(marketIntel.fairValue);
  const verdict = marketIntel.verdict.toLowerCase();
  const risk = marketIntel.risk.toLowerCase();

  if (missingFields.length) {
    return `${player} needs cleaner identity data before the valuation should be treated as reliable. Complete ${missingFields.slice(0, 3).join(", ")} first, then refresh live market comps. Current estimated fair value is ${valueText}, with ${risk} risk and a ${verdict} market signal.`;
  }

  if (marketIntel.verdict === "Sell") {
    return `${player} is showing a sell-biased profile at ${valueText}. Profit should be reviewed against recent sold comps, especially if the market trend is flattening or spread is widening.`;
  }

  if (marketIntel.verdict === "Buy") {
    return `${player} looks undervalued relative to the current model. The card shows a buy signal at ${valueText}, but confirm recent comparable sales before increasing exposure.`;
  }

  if (projection.raw && projection.expectedProfit > 0) {
    return `${player} is currently valued around ${valueText}. The grading model shows possible upside, with an expected graded ROI of ${pct(projection.roi)} after estimated fees.`;
  }

  return `${player} currently profiles as a ${verdict} at approximately ${valueText}. Risk is ${risk}, liquidity is ${marketIntel.liquidityScore}/100, and the best next action is to refresh comps periodically before making a sale or grading decision.`;
}

export default function CardDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [card, setCard] = useState<CollectionCard | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<CollectionCard>>({});
  const [loading, setLoading] = useState(true);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketResult, setMarketResult] = useState<LiveMarketResult | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryPoint[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const result = await getCard(params.id);
    setCard(result.data || null);
    setForm(result.data || {});
    setPriceHistory(getPriceHistory(params.id));
    setMessage(result.ok ? "" : result.message || "Could not load card.");
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [params.id]);

  const liveProfit = useMemo(
    () => Number(form.estimatedValue || 0) - Number(form.purchasePrice || 0),
    [form.purchasePrice, form.estimatedValue]
  );

  if (loading) {
    return (
      <main className="min-h-screen px-4 pb-28 pt-6">
        <p className="text-cm-muted">Loading card...</p>
        <BottomNav />
      </main>
    );
  }

  if (!card) {
    return (
      <main className="min-h-screen px-4 pb-28 pt-6">
        <Link href="/collection" className="text-sm text-cm-purple">← Collection</Link>
        <div className="mt-5 rounded-[24px] border border-cm-line bg-cm-surface p-5 text-cm-muted">Card not found.</div>
        <BottomNav />
      </main>
    );
  }

  const profit = Number(card.estimatedValue || 0) - Number(card.purchasePrice || 0);
  const roi = Number(card.purchasePrice || 0) ? (profit / Number(card.purchasePrice || 0)) * 100 : 0;
  const query = buildMarketQuery(card);
  const intelligence = calculateCardIntelligence(card);
  const detailIntelligence = calculateDetailIntelligence(card, priceHistory);
  const marketIntel = calculateMarketIntelligence(card, priceHistory, marketResult);
  const projection = gradingProjection(card, intelligence.gradingScore);
  const latestHistory = priceHistory[0] || null;
  const previousHistory = priceHistory[1] || null;
  const historyMove = latestHistory && previousHistory ? latestHistory.value - previousHistory.value : 0;
  const historyMovePct = previousHistory?.value ? (historyMove / previousHistory.value) * 100 : 0;
  const missingFields = [
    ["team", card.team],
    ["manufacturer", card.manufacturer],
    ["set", card.set],
    ["year", card.year],
    ["parallel", card.parallel],
    ["serial number", card.serialNumber],
    ["card number", card.cardNumber],
  ].filter(([, value]) => !value).map(([label]) => label);

  const aiSummary = makeAISummary(card, marketIntel, projection, missingFields);

  async function save() {
    if (!card) return;
    const result = await updateCard(card.id, {
      ...form,
      purchasePrice: Number(form.purchasePrice || 0),
      estimatedValue: Number(form.estimatedValue || 0),
    });

    if (!result.ok) {
      setMessage(result.message || "Could not save card.");
      return;
    }

    setCard(result.data || card);
    setForm(result.data || {});
    setEditing(false);
    setMessage(result.message || "Saved.");
  }

  async function remove() {
    if (!card) return;
    const result = await deleteCard(card.id);
    if (!result.ok) {
      setMessage(result.message || "Could not delete card.");
      return;
    }
    router.push("/collection");
  }

  async function refreshMarketValue() {
    if (!card) return;
    if (!query) {
      setMessage("Add player, set, year, or parallel details before refreshing market value.");
      return;
    }

    setMarketLoading(true);
    setMessage("");
    const result = await searchLiveMarket(query);
    setMarketResult(result);
    setMarketLoading(false);

    if (!result.success) {
      setMessage(result.error || "Market search failed.");
      return;
    }

    const suggestedValue = Number(result.suggestedValue || result.medianPrice || result.averagePrice || 0);

    if (suggestedValue > 0) {
      const update = await updateCard(card.id, {
        estimatedValue: suggestedValue,
        notes: card.notes,
      });

      addPriceHistoryPoint(card.id, result);
      setPriceHistory(getPriceHistory(card.id));

      if (update.ok && update.data) {
        setCard(update.data);
        setForm(update.data);
      }
    }

    setMessage(result.note || "Market value refreshed.");
  }

  return (
    <main className="min-h-screen px-4 pb-28 pt-6">
      <Link href="/collection" className="text-sm text-cm-purple">← Collection</Link>

      <h1 className="mt-4 text-3xl font-black">{card.player || "Unknown Player"}</h1>
      <p className="mt-1 text-cm-muted">{card.set || "Unknown Set"} • Card Intelligence V3</p>

      {message && <div className="mt-4 rounded-[22px] border border-cm-line bg-cm-surface p-4 text-sm text-cm-muted">{message}</div>}

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {card.image && <img src={card.image} alt={card.player || "Card front"} className="max-h-[520px] w-full rounded-[28px] border border-cm-line bg-black/30 object-contain p-3" />}
        {card.backImage && <img src={card.backImage} alt={card.player || "Card back"} className="max-h-[520px] w-full rounded-[28px] border border-cm-line bg-black/30 object-contain p-3" />}
      </div>

      <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-[22px] border border-cm-line bg-cm-surface p-3 text-center"><div className="text-xl font-black">{money(card.purchasePrice)}</div><div className="text-xs text-cm-muted">Cost</div></div>
        <div className="rounded-[22px] border border-cm-line bg-cm-surface p-3 text-center"><div className="text-xl font-black">{money(card.estimatedValue)}</div><div className="text-xs text-cm-muted">Value</div></div>
        <div className="rounded-[22px] border border-cm-line bg-cm-surface p-3 text-center"><div className={profit >= 0 ? "text-xl font-black text-cm-green" : "text-xl font-black text-red-300"}>{profit >= 0 ? "+" : "-"}{money(Math.abs(profit))}</div><div className="text-xs text-cm-muted">P/L</div></div>
        <div className="rounded-[22px] border border-cm-line bg-cm-surface p-3 text-center"><div className={roi >= 0 ? "text-xl font-black text-cm-green" : "text-xl font-black text-red-300"}>{pct(roi)}</div><div className="text-xs text-cm-muted">ROI</div></div>
      </section>

      <section className="mt-5 rounded-[28px] border border-cm-line bg-gradient-to-br from-violet-500/20 to-white/5 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-cm-muted">Card Intelligence V3</p>
            <h2 className="mt-1 text-xl font-black">{marketIntel.verdict} • Score {intelligence.score}/100 • {intelligence.band}</h2>
            <p className="mt-1 text-sm text-cm-muted">Investment score, AI summary, market verdict, grading ROI, risk, liquidity, and comparable sales.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center text-xs md:min-w-[280px]">
            <Link href="/assistant" className="rounded-2xl border border-cm-line bg-black/20 p-3 font-black text-white">Ask AI</Link>
            <Link href={`/grading?card=${card.id}`} className="rounded-2xl border border-cm-line bg-black/20 p-3 font-black text-white">Grade View</Link>
            <button onClick={refreshMarketValue} disabled={marketLoading || !query} className="rounded-2xl bg-blue-600 p-3 font-black text-white disabled:opacity-50">Update Market</button>
            <button onClick={() => setEditing(true)} className="rounded-2xl bg-cm-purple p-3 font-black text-white">Edit Data</button>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-[28px] border border-cm-line bg-cm-surface p-4">
        <h2 className="text-lg font-black">AI Investment Summary</h2>
        <p className="mt-2 text-sm leading-6 text-cm-muted">{aiSummary}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-black/20 p-3"><p className="text-xs text-cm-muted">Market Verdict</p><p className={`text-xl font-black ${marketToneClass(marketIntel.verdict)}`}>{marketIntel.verdict}</p></div>
          <div className="rounded-2xl bg-black/20 p-3"><p className="text-xs text-cm-muted">Risk</p><p className={`text-xl font-black ${marketToneClass(marketIntel.risk)}`}>{marketIntel.risk}</p></div>
          <div className="rounded-2xl bg-black/20 p-3"><p className="text-xs text-cm-muted">Liquidity</p><p className="text-xl font-black">{marketIntel.liquidityScore}/100</p></div>
          <div className="rounded-2xl bg-black/20 p-3"><p className="text-xs text-cm-muted">Confidence</p><p className={`text-xl font-black ${marketToneClass(marketIntel.confidenceLabel)}`}>{marketIntel.confidenceScore}/100</p></div>
        </div>
      </section>

      <section className="mt-5 rounded-[28px] border border-cm-line bg-cm-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">Card Intelligence</h2>
            <p className="mt-1 text-sm text-cm-muted">Investment, grading, scarcity, and liquidity assessment.</p>
          </div>
          <div className="text-right">
            <p className={`text-4xl font-black ${scoreColor(intelligence.score)}`}>{intelligence.score}</p>
            <p className="text-xs text-cm-muted">{intelligence.band} • {intelligence.action}</p>
            <p className="mt-1 text-xs text-cm-muted">Data: {detailIntelligence.dataQuality}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="rounded-2xl bg-black/20 p-3"><p className="text-xs text-cm-muted">Scarcity</p><p className="text-xl font-black">{intelligence.scarcityScore}</p></div>
          <div className="rounded-2xl bg-black/20 p-3"><p className="text-xs text-cm-muted">Liquidity</p><p className="text-xl font-black">{intelligence.liquidityScore}</p></div>
          <div className="rounded-2xl bg-black/20 p-3"><p className="text-xs text-cm-muted">Grading</p><p className="text-xl font-black">{intelligence.gradingScore}</p></div>
          <div className="rounded-2xl bg-black/20 p-3"><p className="text-xs text-cm-muted">Momentum</p><p className="text-xl font-black">{intelligence.momentumScore}</p></div>
          <div className="rounded-2xl bg-black/20 p-3"><p className="text-xs text-cm-muted">Risk</p><p className={`text-xl font-black ${riskToneClass(intelligence.risk)}`}>{intelligence.risk}</p></div>
        </div>

        <div className="mt-4 rounded-2xl border border-cm-line bg-black/20 p-4">
          <p className="text-sm font-black">Grading Recommendation</p>
          <p className="mt-1 text-sm text-cm-muted">{intelligence.gradingRecommendation}</p>
          <p className="mt-2 text-xs text-cm-muted">Pre-check result: <span className="font-bold text-white">{detailIntelligence.gradePrecheck}</span></p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {detailIntelligence.signals.map((signal) => (
            <div key={signal.label} className="rounded-2xl border border-cm-line bg-black/20 p-4">
              <p className="text-xs text-cm-muted">{signal.label}</p>
              <p className={`mt-1 text-lg font-black ${detailToneClass(signal.tone)}`}>{signal.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-cm-line bg-black/20 p-4">
            <p className="text-sm font-black">Catalysts</p>
            <ul className="mt-2 space-y-2 text-sm text-cm-muted">
              {detailIntelligence.catalysts.slice(0, 4).map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </div>
          <div className="rounded-2xl border border-cm-line bg-black/20 p-4">
            <p className="text-sm font-black">Risk Flags</p>
            <ul className="mt-2 space-y-2 text-sm text-cm-muted">
              {(detailIntelligence.riskFlags.length ? detailIntelligence.riskFlags : ["No major risk flags from saved data."]).slice(0, 4).map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </div>
          <div className="rounded-2xl border border-cm-line bg-black/20 p-4">
            <p className="text-sm font-black">Watch Triggers</p>
            <ul className="mt-2 space-y-2 text-sm text-cm-muted">
              {detailIntelligence.watchlistTriggers.slice(0, 4).map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-cm-line bg-black/20 p-4">
          <p className="text-sm font-black">Exit Plan</p>
          <p className="mt-1 text-sm text-cm-muted">{detailIntelligence.exitPlan}</p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-cm-line bg-black/20 p-4">
            <p className="text-sm font-black">Short-term Outlook</p>
            <p className="mt-1 text-sm text-cm-muted">{intelligence.shortTermOutlook}</p>
          </div>
          <div className="rounded-2xl border border-cm-line bg-black/20 p-4">
            <p className="text-sm font-black">Long-term Outlook</p>
            <p className="mt-1 text-sm text-cm-muted">{intelligence.longTermOutlook}</p>
          </div>
        </div>

        <ul className="mt-4 space-y-2 text-sm text-cm-muted">
          {intelligence.reasons.map((reason) => <li key={reason}>• {reason}</li>)}
        </ul>
      </section>

      <section className="mt-5 rounded-[28px] border border-cm-line bg-cm-surface p-4">
        <h2 className="text-lg font-black">AI Decision Panel</h2>
        <p className="mt-1 text-sm text-cm-muted">Plain-English action plan based on the saved card data.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-cm-line bg-black/20 p-4">
            <p className="text-xs text-cm-muted">Recommended Action</p>
            <p className={`mt-1 text-2xl font-black ${scoreColor(intelligence.score)}`}>{intelligence.action}</p>
          </div>
          <div className="rounded-2xl border border-cm-line bg-black/20 p-4">
            <p className="text-xs text-cm-muted">Data Confidence</p>
            <p className="mt-1 text-2xl font-black">{detailIntelligence.dataQuality}</p>
          </div>
          <div className="rounded-2xl border border-cm-line bg-black/20 p-4">
            <p className="text-xs text-cm-muted">Latest Trend</p>
            <p className={historyMove >= 0 ? "mt-1 text-2xl font-black text-cm-green" : "mt-1 text-2xl font-black text-red-300"}>
              {priceHistory.length > 1 ? `${historyMove >= 0 ? "+" : "-"}${money(Math.abs(historyMove))} (${pct(historyMovePct)})` : "No trend yet"}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-cm-line bg-black/20 p-4">
          <p className="text-sm font-black">Next Best Action</p>
          <p className="mt-1 text-sm text-cm-muted">
            {detailIntelligence.missingCriticalFields.length ? `Complete missing identity fields first: ${detailIntelligence.missingCriticalFields.slice(0, 4).join(", ")}${detailIntelligence.missingCriticalFields.length > 4 ? "..." : ""}.` : intelligence.action === "Buy" ? "Keep tracking comps and consider adding if sold prices stay below your estimated value." : intelligence.action === "Sell" ? "Review recent comps and consider taking profit or reducing exposure." : intelligence.action === "Watch" ? "Hold off on decisions until stronger market evidence appears." : "Hold and refresh market data periodically."}
          </p>
        </div>
      </section>

      <section className="mt-5 rounded-[28px] border border-cm-line bg-cm-surface p-4">
        <h2 className="text-lg font-black">Grading ROI Panel</h2>
        <p className="mt-1 text-sm text-cm-muted">Estimate whether grading could improve value after fees.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="rounded-2xl bg-black/20 p-3"><p className="text-xs text-cm-muted">Raw Value</p><p className="text-xl font-black">{money(card.estimatedValue)}</p></div>
          <div className="rounded-2xl bg-black/20 p-3"><p className="text-xs text-cm-muted">Est. PSA 9</p><p className="text-xl font-black">{money(projection.psa9Value)}</p></div>
          <div className="rounded-2xl bg-black/20 p-3"><p className="text-xs text-cm-muted">Est. PSA 10</p><p className="text-xl font-black">{money(projection.psa10Value)}</p></div>
          <div className="rounded-2xl bg-black/20 p-3"><p className="text-xs text-cm-muted">Break-even</p><p className="text-xl font-black">{money(projection.breakeven)}</p></div>
          <div className="rounded-2xl bg-black/20 p-3"><p className="text-xs text-cm-muted">Expected ROI</p><p className={projection.expectedProfit >= 0 ? "text-xl font-black text-cm-green" : "text-xl font-black text-red-300"}>{pct(projection.roi)}</p></div>
        </div>
        <p className="mt-3 text-sm text-cm-muted">
          {projection.raw ? intelligence.gradingRecommendation : "This card already appears to be graded. Use comparable sales for this exact grade before selling."}
        </p>
      </section>

      <section className="mt-5 rounded-[28px] border border-cm-line bg-cm-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">Live Market Intelligence</h2>
            <p className="mt-1 text-sm text-cm-muted">Search query: {query || "Add card details first"}</p>
          </div>
          <button onClick={refreshMarketValue} disabled={marketLoading || !query} className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">
            {marketLoading ? "Checking..." : "Update Value"}
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-black/20 p-3"><p className="text-xs text-cm-muted">Fair Value</p><p className="text-xl font-black">{money(marketIntel.fairValue)}</p><p className="text-[11px] text-cm-muted">{marketIntel.valueSource}</p></div>
          <div className="rounded-2xl bg-black/20 p-3"><p className="text-xs text-cm-muted">Confidence</p><p className={`text-xl font-black ${marketToneClass(marketIntel.confidenceLabel)}`}>{marketIntel.confidenceScore}/100</p><p className="text-[11px] text-cm-muted">{marketIntel.confidenceLabel}</p></div>
          <div className="rounded-2xl bg-black/20 p-3"><p className="text-xs text-cm-muted">Trend</p><p className={`text-xl font-black ${marketToneClass(marketIntel.trend)}`}>{marketIntel.trend}</p><p className="text-[11px] text-cm-muted">{pct(marketIntel.trendPercent)}</p></div>
          <div className="rounded-2xl bg-black/20 p-3"><p className="text-xs text-cm-muted">Verdict</p><p className={`text-xl font-black ${marketToneClass(marketIntel.verdict)}`}>{marketIntel.verdict}</p><p className="text-[11px] text-cm-muted">Risk: {marketIntel.risk}</p></div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <div className="rounded-2xl border border-cm-line bg-black/20 p-3"><p className="text-xs text-cm-muted">Raw Value</p><p className="text-lg font-black">{money(marketIntel.rawValue)}</p></div>
          <div className="rounded-2xl border border-cm-line bg-black/20 p-3"><p className="text-xs text-cm-muted">PSA 9 Model</p><p className="text-lg font-black">{money(marketIntel.psa9Value)}</p></div>
          <div className="rounded-2xl border border-cm-line bg-black/20 p-3"><p className="text-xs text-cm-muted">PSA 10 Model</p><p className="text-lg font-black">{money(marketIntel.psa10Value)}</p></div>
          <div className="rounded-2xl border border-cm-line bg-black/20 p-3"><p className="text-xs text-cm-muted">Liquidity</p><p className="text-lg font-black">{marketIntel.liquidityScore}/100</p></div>
          <div className="rounded-2xl border border-cm-line bg-black/20 p-3"><p className="text-xs text-cm-muted">Spread</p><p className="text-lg font-black">{marketIntel.spreadPercent}%</p></div>
        </div>

        <div className="mt-4 rounded-2xl border border-cm-line bg-black/20 p-4">
          <p className="text-sm font-black">Market Verdict Logic</p>
          <ul className="mt-2 space-y-2 text-sm text-cm-muted">
            {marketIntel.reasons.slice(0, 5).map((reason) => <li key={reason}>• {reason}</li>)}
          </ul>
        </div>

        {marketResult && (
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl bg-black/20 p-3"><p className="text-xs text-cm-muted">Suggested</p><p className="text-xl font-black">{money(marketResult.suggestedValue || marketResult.medianPrice || marketResult.averagePrice)}</p></div>
            <div className="rounded-2xl bg-black/20 p-3"><p className="text-xs text-cm-muted">Average</p><p className="text-xl font-black">{money(marketResult.averagePrice)}</p></div>
            <div className="rounded-2xl bg-black/20 p-3"><p className="text-xs text-cm-muted">Median</p><p className="text-xl font-black">{money(marketResult.medianPrice)}</p></div>
            <div className="rounded-2xl bg-black/20 p-3"><p className="text-xs text-cm-muted">Confidence</p><p className="text-xl font-black">{marketConfidenceLabel(marketResult)}</p></div>
          </div>
        )}

        {marketResult?.soldCount ? (
          <div className="mt-4 rounded-2xl border border-cm-line bg-black/20 p-4">
            <p className="text-sm font-black">{marketResult.soldCount} comparable sales • Range {money(marketResult.lowestPrice)} – {money(marketResult.highestPrice)}</p>
            <div className="mt-3 space-y-2">
              {(marketResult.sales || []).slice(0, 5).map((sale, index) => (
                <div key={`${sale.title}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 p-3 text-sm">
                  <span className="line-clamp-2 text-cm-muted">{sale.title}</span>
                  <b>{money(sale.price)}</b>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {priceHistory.length > 0 && (
          <div className="mt-4 rounded-2xl border border-cm-line bg-black/20 p-4">
            <p className="text-sm font-black">Price History</p>
            <div className="mt-3 space-y-2">
              {priceHistory.slice(0, 5).map((point) => (
                <div key={point.createdAt} className="flex items-center justify-between rounded-2xl bg-white/5 p-3 text-sm">
                  <span className="text-cm-muted">{new Date(point.createdAt).toLocaleString()}</span>
                  <b>{money(point.value)}</b>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="mt-5 rounded-[28px] border border-cm-line bg-cm-surface p-4">
        {editing ? (
          <div className="space-y-4">
            <div className="rounded-[22px] border border-cm-line bg-black/20 p-4"><p className="text-sm text-cm-muted">Live Profit / Loss</p><p className={liveProfit >= 0 ? "mt-1 text-2xl font-black text-cm-green" : "mt-1 text-2xl font-black text-red-300"}>{liveProfit >= 0 ? "+" : ""}{money(liveProfit)}</p></div>

            {textFields.map((field) => (
              <label key={field.key} className="block">
                <span className="mb-2 block text-sm font-bold text-white">{field.label}</span>
                <input value={(form as any)[field.key] || ""} onChange={(e) => setForm({ ...form, [field.key]: e.target.value })} placeholder={field.placeholder} className="w-full rounded-2xl border border-cm-line bg-black/30 p-3 outline-none" />
              </label>
            ))}

            <label className="block"><span className="mb-2 block text-sm font-bold text-white">Purchase Price (£)</span><input type="number" min="0" step="0.01" value={form.purchasePrice ?? 0} onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })} placeholder="Example: 10.00" className="w-full rounded-2xl border border-cm-line bg-black/30 p-3 outline-none" /></label>
            <label className="block"><span className="mb-2 block text-sm font-bold text-white">Estimated Value (£)</span><input type="number" min="0" step="0.01" value={form.estimatedValue ?? 0} onChange={(e) => setForm({ ...form, estimatedValue: Number(e.target.value) })} placeholder="Example: 65.00" className="w-full rounded-2xl border border-cm-line bg-black/30 p-3 outline-none" /></label>

            <button onClick={save} className="w-full rounded-2xl bg-cm-purple py-3 font-black">Save Changes</button>
            <button onClick={() => { setForm(card); setEditing(false); }} className="w-full rounded-2xl border border-cm-line bg-white/5 py-3 font-black">Cancel</button>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-cm-muted">
            <p><span className="text-white">Team:</span> {card.team || "—"}</p>
            <p><span className="text-white">Manufacturer:</span> {card.manufacturer || "—"}</p>
            <p><span className="text-white">Year:</span> {card.year || "—"}</p>
            <p><span className="text-white">Parallel:</span> {card.parallel || "—"}</p>
            <p><span className="text-white">Serial:</span> {card.serialNumber || "—"}</p>
            <p><span className="text-white">Card #:</span> {card.cardNumber || "—"}</p>
            <p><span className="text-white">Grade:</span> {card.grade || "Raw"}</p>
            <p><span className="text-white">Source:</span> {card.source || "manual"}</p>
            <p><span className="text-white">Notes:</span> {card.notes || "—"}</p>
            <button onClick={() => setEditing(true)} className="mt-3 w-full rounded-2xl bg-cm-purple py-3 font-black text-white">Edit Card</button>
            <button onClick={remove} className="w-full rounded-2xl border border-red-500/40 bg-red-500/10 py-3 font-black text-red-300">Delete Card</button>
          </div>
        )}
      </section>

      <BottomNav />
    </main>
  );
}
