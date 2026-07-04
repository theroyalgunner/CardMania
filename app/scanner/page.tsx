"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { CollectionCard } from "@/services/collectionStore";
import { listCards, saveCard } from "@/services/cardRepository";
import { parseAIResult, confidencePercent } from "@/services/aiTools";
import { estimateCardValue, profitLabel } from "@/services/marketEngine";
import { inferCardFromText, mergeSuggestionIntoForm } from "@/services/cardAutofill";
import { buildMarketQuery, searchLiveMarket, LiveMarketResult } from "@/services/liveMarket";

type ManualForm = {
  player: string;
  team: string;
  manufacturer: string;
  set: string;
  year: string;
  parallel: string;
  serialNumber: string;
  cardNumber: string;
  grade: string;
  purchasePrice: string;
  estimatedValue: string;
  notes: string;
};

const blankForm: ManualForm = {
  player: "",
  team: "",
  manufacturer: "",
  set: "",
  year: "",
  parallel: "",
  serialNumber: "",
  cardNumber: "",
  grade: "Raw",
  purchasePrice: "0",
  estimatedValue: "0",
  notes: "",
};

const formFields: Array<[keyof ManualForm, string, string]> = [
  ["player", "Player", "Example: Ronaldinho"],
  ["team", "Team / Club", "Example: Brazil, Real Madrid, Barcelona"],
  ["manufacturer", "Manufacturer", "Example: Topps, Panini, Futera"],
  ["set", "Set / Product", "Example: Topps Chrome UEFA"],
  ["year", "Year", "Example: 2024"],
  ["parallel", "Parallel", "Example: Gold Refractor /50"],
  ["serialNumber", "Serial Number", "Example: 07/50"],
  ["cardNumber", "Card Number", "Example: 118 or UCC-12"],
  ["grade", "Grade", "Example: Raw, PSA 10, BGS 9.5"],
];

const quickPresets = [
  "Ronaldinho Brazil Topps Chrome UEFA Legendary Gold Refractor 07/50",
  "Jude Bellingham Real Madrid Topps Chrome UEFA 2024 Gold Refractor /50",
  "Lamine Yamal FC Barcelona Topps Chrome UEFA 2024 Purple Refractor /25 RC",
  "Lionel Messi Inter Miami Topps Chrome 2024 Refractor",
  "Cristiano Ronaldo Al Nassr Panini Prizm 2024",
];

function estimateFromManual(form: ManualForm) {
  return estimateCardValue({
    player: form.player,
    team: form.team,
    manufacturer: form.manufacturer,
    set: form.set,
    parallel: form.parallel,
    serialNumber: form.serialNumber,
    grade: form.grade,
    purchasePrice: Number(form.purchasePrice) || 0,
    estimatedValue: Number(form.estimatedValue) || 0,
  } as any);
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
}

function duplicateScore(card: CollectionCard, form: ManualForm) {
  let score = 0;
  if (card.player && form.player && card.player.toLowerCase() === form.player.toLowerCase()) score += 3;
  if (card.set && form.set && card.set.toLowerCase() === form.set.toLowerCase()) score += 2;
  if (card.year && form.year && String(card.year) === String(form.year)) score += 1;
  if (card.cardNumber && form.cardNumber && card.cardNumber.toLowerCase() === form.cardNumber.toLowerCase()) score += 3;
  if (card.serialNumber && form.serialNumber && card.serialNumber === form.serialNumber) score += 4;
  if (card.parallel && form.parallel && card.parallel.toLowerCase() === form.parallel.toLowerCase()) score += 2;
  return score;
}

export default function ScannerPage() {
  const router = useRouter();
  const [image, setImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState("image/jpeg");
  const [backMimeType, setBackMimeType] = useState("image/jpeg");
  const [fileName, setFileName] = useState("");
  const [visibleText, setVisibleText] = useState("");
  const [result, setResult] = useState<any>(null);
  const [marketResult, setMarketResult] = useState<LiveMarketResult | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState("");
  const [manual, setManual] = useState<ManualForm>(blankForm);

  const ai = useMemo(() => parseAIResult(result), [result]);
  const resultText = JSON.stringify(result || {}).toLowerCase();
  const providerLabel = result?.provider ? String(result.provider).toUpperCase() : result?.mode ? String(result.mode).toUpperCase() : "READY";
  const quality = ai?.quality;
  const featureLabels = [
    ai?.features?.rookie && "RC",
    ai?.features?.autograph && "Auto",
    ai?.features?.patch && "Patch",
    ai?.features?.jersey && "Jersey",
    ai?.features?.relic && "Relic",
    ai?.features?.numbered && "Numbered",
    ai?.features?.oneOfOne && "1/1",
    ai?.features?.parallel && "Parallel",
  ].filter(Boolean) as string[];

  const isQuotaError =
    resultText.includes("quota") ||
    resultText.includes("429") ||
    resultText.includes("rate");

  const hasResult = Boolean(result);

  async function onFile(file: File | undefined, side: "front" | "back") {
    if (!file) return;

    const dataUrl = await readFileAsDataUrl(file);

    if (side === "front") {
      setImage(dataUrl);
      setMimeType(file.type || "image/jpeg");
      setFileName(file.name || "");
    } else {
      setBackImage(dataUrl);
      setBackMimeType(file.type || "image/jpeg");
    }

    setResult(null);
    setMarketResult(null);
    setDuplicateWarning("");
    setManual((current) => ({ ...current, ...blankForm, grade: current.grade || "Raw" }));
    setVisibleText((current) => current || file.name || "");
    setMessage(side === "front" ? "Front image loaded. Add the back image if you have it, then scan." : "Back image loaded. Scan will use both sides.");
  }

  function applySuggestionFromText(text: string) {
    const suggestion = inferCardFromText(text);

    setManual((current) => {
      const merged = mergeSuggestionIntoForm(current, suggestion as any) as ManualForm;
      const estimated = estimateFromManual(merged);

      return {
        ...merged,
        estimatedValue: merged.estimatedValue === "0" ? String(estimated || 0) : merged.estimatedValue,
      };
    });

    setMessage(suggestion.reason || "Smart Fill applied.");
  }

  async function checkDuplicate(next: ManualForm) {
    const result = await listCards();
    const cards = result.data || [];
    const duplicate = cards
      .map((card) => ({ card, score: duplicateScore(card, next) }))
      .filter((item) => item.score >= 6)
      .sort((a, b) => b.score - a.score)[0];

    if (duplicate) {
      setDuplicateWarning(
        `Possible duplicate: ${duplicate.card.player || "Unknown Player"} • ${duplicate.card.set || "Unknown Set"}${duplicate.card.serialNumber ? ` • ${duplicate.card.serialNumber}` : ""}`
      );
    } else {
      setDuplicateWarning("");
    }
  }

  async function scan() {
    setLoading(true);
    setResult(null);
    setMarketResult(null);
    setMessage("");
    setDuplicateWarning("");

    try {
      const res = await fetch("/api/scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, backImage, mimeType, backMimeType, visibleText: `${fileName} ${visibleText}` }),
      });

      const data = await res.json();
      const parsed = parseAIResult(data);
      const backupSuggestion = inferCardFromText(`${fileName} ${visibleText}`);

      const mergedSuggestion = {
        ...backupSuggestion,
        ...parsed,
        year: String(parsed?.year || backupSuggestion?.year || ""),
        set: parsed?.set || parsed?.product || backupSuggestion?.set || "",
      };

      const next = mergeSuggestionIntoForm(blankForm, mergedSuggestion as any) as ManualForm;
      const suggestedValue = estimateFromManual(next);

      const finalForm = {
        ...next,
        purchasePrice: "0",
        estimatedValue: String(suggestedValue || 0),
        notes:
          [parsed?.notes, backupSuggestion.notes, data?.message, backupSuggestion.reason, "Saved from CardMania AI Scanner Pro"]
            .filter(Boolean)
            .join("\n") || "Saved from CardMania AI Scanner Pro",
      };

      setResult(data);
      setManual(finalForm);
      await checkDuplicate(finalForm);

      const marketQuery = parsed?.searchQuery || buildMarketQuery(finalForm as any);
      if (marketQuery) {
        setMarketLoading(true);
        try {
          const live = await searchLiveMarket(marketQuery);
          setMarketResult(live);
          if (live?.success && live.suggestedValue && live.suggestedValue > 0) {
            setManual((current) => ({ ...current, estimatedValue: String(live.suggestedValue) }));
          }
        } finally {
          setMarketLoading(false);
        }
      }

      if (data?.mode === "manual-required" || data?.quota) {
        setMessage("AI was limited. Smart Fill used visible text/file clues where possible.");
      }
    } catch (error: any) {
      const suggestion = inferCardFromText(`${fileName} ${visibleText}`);
      const next = mergeSuggestionIntoForm(blankForm, suggestion as any) as ManualForm;

      setResult({ mode: "scanner-error", message: error?.message || "Scanner request failed." });
      setManual({ ...next, notes: suggestion.reason || "Scanner failed. Fill the card manually." });
      setMessage("Scanner request failed. Smart Fill is still available below.");
    } finally {
      setLoading(false);
    }
  }

  function updateManual(key: keyof ManualForm, value: string) {
    setManual((current) => {
      const next = { ...current, [key]: value };
      checkDuplicate(next);
      return next;
    });
  }

  function autoEstimate() {
    const value = estimateFromManual(manual);
    updateManual("estimatedValue", String(value));
  }

  async function saveToCollection() {
    setSaving(true);
    setMessage("");

    const card: CollectionCard = {
      id: crypto.randomUUID(),
      image: image || undefined,
      backImage: backImage || undefined,
      player: manual.player || ai?.player || "Unknown Player",
      team: manual.team || ai?.team || "Unknown Team",
      manufacturer: manual.manufacturer || ai?.manufacturer || "Unknown",
      set: manual.set || ai?.set || ai?.product || "Unknown Set",
      year: manual.year || String(ai?.year || ""),
      parallel: manual.parallel || ai?.parallel || "",
      serialNumber: manual.serialNumber || ai?.serialNumber || "",
      cardNumber: manual.cardNumber || ai?.cardNumber || "",
      grade: manual.grade || ai?.grade || "Raw",
      notes: manual.notes || ai?.notes || "Saved from AI Scanner Pro",
      purchasePrice: Number(manual.purchasePrice) || 0,
      estimatedValue: Number(manual.estimatedValue) || 0,
      confidence: ai?.confidence,
      source: "scanner",
      createdAt: new Date().toISOString(),
    } as CollectionCard;

    const saveResult = await saveCard(card);
    setSaving(false);

    if (!saveResult.ok) {
      setMessage(saveResult.message || "Could not save card.");
      return;
    }

    setMessage(saveResult.message || "Saved.");
    router.push("/collection");
  }

  const previewCard = {
    purchasePrice: Number(manual.purchasePrice) || 0,
    estimatedValue: Number(manual.estimatedValue) || 0,
  };

  return (
    <main className="min-h-screen px-4 pb-28 pt-6">
      <div className="mb-5">
        <p className="text-sm text-cm-muted">CardMania Scanner</p>
        <h1 className="text-3xl font-black">Scanner Pro</h1>
        <p className="mt-1 text-sm text-cm-muted">AI Scanner V2: real vision scan, OCR clues, feature detection, duplicate check, live market comps, and manual fallback.</p>
      </div>

      <div className="rounded-[28px] border border-cm-line bg-cm-surface p-5">
        <label className="block">
          <span className="mb-2 block text-sm font-bold">Front Image</span>
          <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0], "front")} className="w-full rounded-2xl border border-cm-line bg-black/30 p-3" />
        </label>

        {image && <img src={image} alt="front preview" className="mt-4 max-h-80 w-full rounded-2xl bg-black/30 object-contain" />}

        <label className="mt-4 block">
          <span className="mb-2 block text-sm font-bold">Back Image Optional</span>
          <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0], "back")} className="w-full rounded-2xl border border-cm-line bg-black/30 p-3" />
        </label>

        {backImage && <img src={backImage} alt="back preview" className="mt-4 max-h-80 w-full rounded-2xl bg-black/30 object-contain" />}

        <button onClick={scan} disabled={(!image && !backImage) || loading} className="mt-4 w-full rounded-2xl bg-cm-purple py-3 font-black disabled:opacity-50">
          {loading ? "Scanning..." : "Scan Card"}
        </button>
      </div>

      <section className="mt-5 rounded-[28px] border border-cm-line bg-cm-surface p-4">
        <h2 className="text-lg font-black">Smart Fill Text</h2>
        <p className="mt-1 text-sm text-cm-muted">Paste visible front/back text, seller title, or auction listing title.</p>

        <textarea value={visibleText} onChange={(e) => setVisibleText(e.target.value)} placeholder="Example: Ronaldinho Brazil Topps Chrome Legendary Gold Refractor 07/50 card #118" className="mt-3 min-h-24 w-full rounded-2xl border border-cm-line bg-black/30 p-3 outline-none" />

        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {quickPresets.map((preset) => (
            <button key={preset} onClick={() => { setVisibleText(preset); applySuggestionFromText(preset); }} className="rounded-2xl border border-cm-line bg-white/10 px-3 py-2 text-left text-sm font-bold">
              {preset}
            </button>
          ))}
        </div>

        <button onClick={() => applySuggestionFromText(visibleText)} className="mt-3 w-full rounded-2xl border border-cm-line bg-white/10 py-3 font-black">
          Smart Fill From Text
        </button>
      </section>

      {(hasResult || image || backImage) && (
        <section className="mt-5 rounded-[28px] border border-cm-line bg-cm-surface p-4">
          {hasResult && isQuotaError ? (
            <div className="rounded-[22px] border border-yellow-500/30 bg-yellow-500/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-black text-yellow-300">AI quota reached</h2>
                <span className="rounded-full border border-yellow-500/30 px-3 py-1 text-xs font-black text-yellow-200">{providerLabel}</span>
              </div>
              <p className="mt-1 text-sm text-cm-muted">Fill the fields below and save manually. Smart Fill can still help with visible text.</p>
            </div>
          ) : hasResult ? (
            <div className="rounded-[22px] border border-green-500/30 bg-green-500/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">{manual.player || "Scan Result"}</h2>
                  <p className="mt-1 text-sm text-cm-muted">{manual.team || "Unknown Team"} • Confidence {confidencePercent(ai?.confidence)}</p>
                </div>
                <span className="shrink-0 rounded-full border border-green-500/30 px-3 py-1 text-xs font-black text-green-200">{providerLabel}</span>
              </div>

              {quality && (
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-cm-line bg-black/20 p-3">
                    <p className="text-xs text-cm-muted">Scan Quality</p>
                    <p className="mt-1 text-lg font-black">{quality.label || "Review"}</p>
                    <p className="text-xs text-cm-muted">Score {quality.score ?? "—"}/100</p>
                  </div>
                  <div className="rounded-2xl border border-cm-line bg-black/20 p-3 md:col-span-2">
                    <p className="text-xs text-cm-muted">Detected Features</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {featureLabels.length ? featureLabels.map((label) => (
                        <span key={label} className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">{label}</span>
                      )) : <span className="text-sm text-cm-muted">No special feature detected yet.</span>}
                    </div>
                  </div>
                </div>
              )}

              {quality?.warnings?.length ? (
                <div className="mt-3 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-sm text-yellow-100">
                  {quality.warnings.join(" • ")}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-[22px] border border-cm-line bg-black/20 p-4">
              <h2 className="font-black">Manual Entry Ready</h2>
              <p className="mt-1 text-sm text-cm-muted">Use Scan Card, Smart Fill, or type the fields yourself.</p>
            </div>
          )}

          {duplicateWarning && (
            <div className="mt-4 rounded-[22px] border border-orange-500/30 bg-orange-500/10 p-4 text-sm text-orange-200">
              {duplicateWarning}
            </div>
          )}

          {(marketLoading || marketResult) && (
            <div className="mt-4 rounded-[22px] border border-cm-line bg-black/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black">Live Market Check</h3>
                  <p className="mt-1 text-sm text-cm-muted">
                    {marketLoading ? "Searching recent sold comps..." : marketResult?.note || marketResult?.error || "Market search complete."}
                  </p>
                </div>
                {marketResult?.confidence && (
                  <span className="rounded-full border border-cm-line px-3 py-1 text-xs font-black">{marketResult.confidence}</span>
                )}
              </div>

              {marketResult?.success && (
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-cm-line bg-white/5 p-3">
                    <p className="text-xs text-cm-muted">Suggested</p>
                    <p className="text-lg font-black">£{marketResult.suggestedValue || 0}</p>
                  </div>
                  <div className="rounded-2xl border border-cm-line bg-white/5 p-3">
                    <p className="text-xs text-cm-muted">Median</p>
                    <p className="text-lg font-black">£{marketResult.medianPrice || 0}</p>
                  </div>
                  <div className="rounded-2xl border border-cm-line bg-white/5 p-3">
                    <p className="text-xs text-cm-muted">Sold Comps</p>
                    <p className="text-lg font-black">{marketResult.keptCount || marketResult.soldCount || 0}</p>
                  </div>
                  <div className="rounded-2xl border border-cm-line bg-white/5 p-3">
                    <p className="text-xs text-cm-muted">Spread</p>
                    <p className="text-lg font-black">{marketResult.spreadPercent ?? 0}%</p>
                  </div>
                </div>
              )}

              {marketResult?.sales?.length ? (
                <div className="mt-4 grid gap-2">
                  {marketResult.sales.slice(0, 3).map((sale, index) => (
                    <a key={`${sale.title}-${index}`} href={sale.url || marketResult.searchUrl} target="_blank" rel="noreferrer" className="rounded-2xl border border-cm-line bg-white/5 p-3 text-sm hover:bg-white/10">
                      <div className="flex items-start justify-between gap-3">
                        <span className="line-clamp-2 font-bold">{sale.title}</span>
                        <span className="shrink-0 font-black">£{sale.price}</span>
                      </div>
                      {sale.flags?.length ? <p className="mt-1 text-xs text-cm-muted">{sale.flags.join(" • ")}</p> : null}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          <div className="mt-4 grid gap-3">
            {formFields.map(([key, label, placeholder]) => (
              <label key={key} className="block">
                <span className="mb-1 block text-sm font-bold">{label}</span>
                <input value={manual[key]} onChange={(e) => updateManual(key, e.target.value)} placeholder={placeholder} className="w-full rounded-2xl border border-cm-line bg-black/30 p-3 outline-none" />
              </label>
            ))}

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-bold">Purchase Price (£)</span>
                <input type="number" min="0" step="0.01" value={manual.purchasePrice} onChange={(e) => updateManual("purchasePrice", e.target.value)} className="w-full rounded-2xl border border-cm-line bg-black/30 p-3 outline-none" />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-bold">Estimated Value (£)</span>
                <input type="number" min="0" step="0.01" value={manual.estimatedValue} onChange={(e) => updateManual("estimatedValue", e.target.value)} className="w-full rounded-2xl border border-cm-line bg-black/30 p-3 outline-none" />
              </label>
            </div>

            <button onClick={autoEstimate} className="rounded-2xl border border-cm-line bg-white/10 py-3 font-black">Auto Estimate Value</button>

            {quality?.missingFields?.length ? (
              <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-3 text-sm text-orange-100">
                Review needed: {quality.missingFields.join(", ")}
              </div>
            ) : null}

            <label className="block">
              <span className="mb-1 block text-sm font-bold">Notes</span>
              <textarea value={manual.notes} onChange={(e) => updateManual("notes", e.target.value)} placeholder="Condition, seller, source, AI uncertainty, auto/patch/rookie notes..." className="min-h-24 w-full rounded-2xl border border-cm-line bg-black/30 p-3 outline-none" />
            </label>
          </div>

          <div className="mt-4 rounded-[22px] border border-cm-line bg-black/20 p-4">
            <p className="text-xs text-cm-muted">Live Profit / Loss</p>
            <p className="mt-1 text-2xl font-black text-cm-green">{profitLabel(previewCard as any)}</p>
          </div>

          {message && <p className="mt-3 text-sm text-cm-muted">{message}</p>}

          <button onClick={saveToCollection} disabled={saving || (!image && !backImage)} className="mt-4 w-full rounded-2xl bg-green-600 py-3 font-black disabled:opacity-50">
            {saving ? "Saving..." : "Save Card"}
          </button>
        </section>
      )}

      <BottomNav />
    </main>
  );
}
