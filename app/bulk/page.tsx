"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
import { CollectionCard } from "@/services/collectionStore";
import { listCards, saveCard } from "@/services/cardRepository";
import { inferCardFromFileName, inferCardFromText } from "@/services/cardAutofill";
import { parseAIResult, confidencePercent } from "@/services/aiTools";
import { estimateCardValue, profitLabel } from "@/services/marketEngine";
import { buildMarketQuery, searchLiveMarket } from "@/services/liveMarket";
import { addWishlistItem } from "@/services/wishlistStore";
import { bulkInsights, detectionCells, DetectionMode, queueProgress } from "@/services/bulkScannerEngine";

type BulkDraft = CollectionCard & {
  fileName?: string;
  mimeType?: string;
  selected: boolean;
  status: "queued" | "scanning" | "ready" | "error" | "saved";
  warning?: string;
  batchId?: string;
  cropLabel?: string;
};

const editableFields: Array<[keyof CollectionCard, string, string]> = [
  ["player", "Player", "Player name"],
  ["team", "Team / Club", "Team or club"],
  ["manufacturer", "Manufacturer", "Topps, Panini, Futera..."],
  ["set", "Set / Product", "Topps Chrome UEFA"],
  ["year", "Year", "2024"],
  ["parallel", "Parallel", "Gold Refractor /50"],
  ["serialNumber", "Serial Number", "07/50"],
  ["cardNumber", "Card Number", "118"],
  ["grade", "Grade", "Raw, PSA 10, BGS 9.5"],
];

function cropDataUrl(dataUrl: string, cell: { x: number; y: number; w: number; h: number }) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const sourceX = Math.floor(image.width * cell.x);
      const sourceY = Math.floor(image.height * cell.y);
      const sourceW = Math.floor(image.width * cell.w);
      const sourceH = Math.floor(image.height * cell.h);
      canvas.width = sourceW;
      canvas.height = sourceH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Could not prepare crop."));
      ctx.drawImage(image, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    image.onerror = () => reject(new Error("Could not detect cards in image."));
    image.src = dataUrl;
  });
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

function cardSearchText(card: Partial<CollectionCard>) {
  return [
    card.player,
    card.team,
    card.year,
    card.manufacturer,
    card.set,
    card.parallel,
    card.serialNumber,
    card.cardNumber,
    card.grade,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function duplicateKey(card: Partial<CollectionCard>) {
  return [
    card.player,
    card.year,
    card.manufacturer,
    card.set,
    card.parallel,
    card.serialNumber,
    card.cardNumber,
  ]
    .filter(Boolean)
    .join("|")
    .toLowerCase()
    .replace(/[^a-z0-9|/]+/g, "")
    .trim();
}

function createDraft(image: string, file: File, index: number, cropLabel = "Full image", batchId = crypto.randomUUID()): BulkDraft {
  const fallback = inferCardFromFileName(file.name || "");
  const base: BulkDraft = {
    id: crypto.randomUUID(),
    image,
    fileName: file.name || `Bulk Card ${index + 1}`,
    mimeType: file.type || "image/jpeg",
    batchId,
    cropLabel,
    player: fallback.player || `Bulk Card ${index + 1}`,
    team: fallback.team || "",
    manufacturer: fallback.manufacturer || "",
    set: fallback.set || fallback.product || "",
    year: String(fallback.year || ""),
    parallel: fallback.parallel || "",
    serialNumber: fallback.serialNumber || "",
    cardNumber: fallback.cardNumber || "",
    grade: fallback.grade || "Raw",
    notes: fallback.reason || `${cropLabel}. Bulk imported. Review before saving.`,
    purchasePrice: 0,
    estimatedValue: 0,
    confidence: fallback.confidence || 0,
    source: "bulk",
    createdAt: new Date().toISOString(),
    selected: true,
    status: "queued",
  };

  return {
    ...base,
    estimatedValue: estimateCardValue(base),
  };
}

export default function BulkPage() {
  const [drafts, setDrafts] = useState<BulkDraft[]>([]);
  const [message, setMessage] = useState("");
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detectionMode, setDetectionMode] = useState<DetectionMode>("single");

  const selectedCount = useMemo(
    () => drafts.filter((draft) => draft.selected && draft.status !== "saved").length,
    [drafts]
  );
  const selectedReadyCount = useMemo(
    () => drafts.filter((draft) => draft.selected && draft.status === "ready").length,
    [drafts]
  );

  const insights = useMemo(() => bulkInsights(drafts), [drafts]);
  const progress = useMemo(() => queueProgress(drafts), [drafts]);

  async function onFiles(files?: FileList | null) {
    if (!files?.length) return;

    setMessage("Loading images...");

    const cells = detectionCells(detectionMode);
    const nextDraftGroups = await Promise.all(
      Array.from(files).map(async (file, fileIndex) => {
        const image = await readFileAsDataUrl(file);
        const batchId = crypto.randomUUID();
        const crops = await Promise.all(cells.map((cell) => cropDataUrl(image, cell)));
        return crops.map((crop, cropIndex) =>
          createDraft(
            crop,
            file,
            drafts.length + fileIndex * cells.length + cropIndex,
            cells.length === 1 ? "Full image" : `Detected slot ${cropIndex + 1}/${cells.length}`,
            batchId
          )
        );
      })
    );

    const nextDrafts = nextDraftGroups.flat();
    setDrafts((current) => [...current, ...nextDrafts]);
    setMessage(`${nextDrafts.length} card draft(s) loaded. Press Scan All to auto-fill details.`);
  }

  function updateDraft(id: string, updates: Partial<BulkDraft>) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === id
          ? {
              ...draft,
              ...updates,
              estimatedValue:
                updates.estimatedValue !== undefined
                  ? updates.estimatedValue
                  : estimateCardValue({ ...draft, ...updates }),
            }
          : draft
      )
    );
  }

  function removeDraft(id: string) {
    setDrafts((current) => current.filter((draft) => draft.id !== id));
  }

  function clearAll() {
    setDrafts([]);
    setMessage("");
  }

  async function scanOne(draft: BulkDraft) {
    setDrafts((current) =>
      current.map((item) =>
        item.id === draft.id ? { ...item, status: "scanning", warning: "" } : item
      )
    );

    try {
      const res = await fetch("/api/scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: draft.image,
          mimeType: draft.mimeType || "image/jpeg",
          visibleText: `${draft.fileName || ""} ${draft.cropLabel || ""}`,
        }),
      });

      const data = await res.json();
      const parsed = parseAIResult(data);
      const fallback = inferCardFromText(`${draft.fileName || ""} ${parsed?.notes || ""}`);

      const next: BulkDraft = {
        ...draft,
        player: parsed.player || fallback.player || draft.player || "Unknown Player",
        team: parsed.team || fallback.team || draft.team || "Unknown Team",
        manufacturer: parsed.manufacturer || fallback.manufacturer || draft.manufacturer || "Unknown",
        set: parsed.set || parsed.product || fallback.set || fallback.product || draft.set || "Unknown Set",
        year: String(parsed.year || fallback.year || draft.year || ""),
        parallel: parsed.parallel || fallback.parallel || draft.parallel || "",
        serialNumber: parsed.serialNumber || fallback.serialNumber || draft.serialNumber || "",
        cardNumber: parsed.cardNumber || fallback.cardNumber || draft.cardNumber || "",
        league: parsed.league || fallback.league || draft.league || "",
        country: parsed.country || fallback.country || draft.country || "",
        grade: parsed.grade || fallback.grade || draft.grade || "Raw",
        confidence: Number(parsed.confidence || fallback.confidence || draft.confidence || 0),
        notes:
          parsed.notes ||
          fallback.notes ||
          fallback.reason ||
          draft.notes ||
          "Bulk AI scan completed. Review before saving.",
        status: "ready",
        warning:
          data?.mode === "manual-required"
            ? data?.message || "AI could not confidently identify this card."
            : "",
      };

      next.estimatedValue = estimateCardValue(next);

      const marketQuery = buildMarketQuery(next);
      if (marketQuery && next.player && next.player !== "Unknown Player") {
        try {
          const live = await searchLiveMarket(marketQuery);
          if (live?.success && Number(live.suggestedValue || 0) > 0) {
            next.estimatedValue = Number(live.suggestedValue || next.estimatedValue || 0);
            next.notes = [
              next.notes,
              `Live market: £${next.estimatedValue} suggested from ${live.soldCount || live.keptCount || 0} sold comp(s).`,
              live.fairLow && live.fairHigh ? `Fair range: £${live.fairLow}–£${live.fairHigh}.` : "",
            ]
              .filter(Boolean)
              .join("\n");
          }
        } catch {
          next.notes = [next.notes, "Market check unavailable during bulk scan."].filter(Boolean).join("\n");
        }
      }

      setDrafts((current) => current.map((item) => (item.id === draft.id ? next : item)));
    } catch (error: any) {
      setDrafts((current) =>
        current.map((item) =>
          item.id === draft.id
            ? {
                ...item,
                status: "error",
                warning: error?.message || "Bulk scan failed. You can still edit manually.",
              }
            : item
        )
      );
    }
  }

  async function scanAll() {
    if (!drafts.length) return;
    setScanning(true);
    setMessage("Scanning queue one card at a time. Failed cards can be retried without rescanning the full batch.");

    for (const draft of drafts) {
      if (draft.status === "saved") continue;
      await scanOne(draft);
    }

    setScanning(false);
    setMessage("Bulk scan complete. Review the cards, edit anything needed, then save selected cards.");
  }

  function addDraftToWishlist(draft: BulkDraft) {
    addWishlistItem({
      id: crypto.randomUUID(),
      name: [draft.player, draft.year, draft.set, draft.parallel].filter(Boolean).join(" • ") || "Bulk scanned card",
      player: draft.player,
      team: draft.team,
      set: draft.set,
      parallel: draft.parallel,
      targetPrice: Math.max(1, Math.round(Number(draft.estimatedValue || 0) * 0.85)),
      currentPrice: Number(draft.estimatedValue || 0),
      priority: Number(draft.estimatedValue || 0) >= 250 ? "High" : "Medium",
      notes: "Added from Bulk Scanner Pro.",
      createdAt: new Date().toISOString(),
    });
    updateDraft(draft.id, { warning: "Added to wishlist." });
  }

  async function retryFailed() {
    const failed = drafts.filter((draft) => draft.status === "error");
    if (!failed.length) {
      setMessage("No failed cards to retry.");
      return;
    }
    setScanning(true);
    setMessage(`Retrying ${failed.length} failed card(s)...`);
    for (const draft of failed) await scanOne(draft);
    setScanning(false);
    setMessage("Retry complete.");
  }

  function selectAllReady() {
    setDrafts((current) => current.map((draft) => ({ ...draft, selected: draft.status !== "saved" })));
  }

  async function saveSelected() {
    const selected = drafts.filter((draft) => draft.selected && draft.status !== "saved");
    const readySelected = selected.filter((draft) => draft.status === "ready");
    const notReady = selected.length - readySelected.length;

    if (!selected.length) {
      setMessage("No unsaved selected cards.");
      return;
    }

    if (notReady > 0) {
      setMessage(`${notReady} selected card(s) are not scanned/ready yet. Press Scan All first, then save again.`);
      setDrafts((current) =>
        current.map((draft) =>
          draft.selected && draft.status !== "ready" && draft.status !== "saved"
            ? { ...draft, warning: "Scan this card before saving so name, details, and value are not blank." }
            : draft
        )
      );
      return;
    }

    setSaving(true);
    setMessage("Checking duplicates and saving selected cards...");

    const existing = (await listCards()).data || [];
    const existingKeys = new Set(existing.map(duplicateKey).filter(Boolean));
    let saved = 0;
    let skipped = 0;

    for (const draft of readySelected) {
      const key = duplicateKey(draft);

      if (key && existingKeys.has(key)) {
        skipped += 1;
        updateDraft(draft.id, {
          warning: "Possible duplicate already exists in collection. Not saved.",
          selected: false,
        });
        continue;
      }

      const card: CollectionCard = {
        id: draft.id,
        image: draft.image,
        player: draft.player || "Unknown Player",
        team: draft.team || "Unknown Team",
        manufacturer: draft.manufacturer || "Unknown",
        league: draft.league || "",
        country: draft.country || "",
        set: draft.set || "Unknown Set",
        year: draft.year || "",
        parallel: draft.parallel || "",
        serialNumber: draft.serialNumber || "",
        cardNumber: draft.cardNumber || "",
        grade: draft.grade || "Raw",
        notes: draft.notes || "Bulk scanned and saved.",
        purchasePrice: Number(draft.purchasePrice || 0),
        estimatedValue: Number(draft.estimatedValue || 0),
        confidence: Number(draft.confidence || 0),
        source: "bulk",
        createdAt: draft.createdAt || new Date().toISOString(),
      };

      const result = await saveCard(card);

      if (result.ok) {
        saved += 1;
        existingKeys.add(key);
        updateDraft(draft.id, { status: "saved", selected: false, warning: result.message || "Saved." });
      } else {
        updateDraft(draft.id, { status: "error", warning: result.message || "Could not save." });
      }
    }

    setSaving(false);
    setMessage(`Saved ${saved} card(s). Skipped ${skipped} possible duplicate(s).`);
  }

  return (
    <main className="min-h-screen px-4 pb-28 pt-6">
      <p className="text-sm text-cm-muted">CardMania Bulk Scanner V9.1</p>
      <h1 className="text-3xl font-black">Bulk Import Pro V9.1</h1>
      <p className="mt-2 text-sm text-cm-muted">
        Upload multiple card images, scan them with the same AI as Scanner Pro, review the extracted details, then save all selected cards.
      </p>

      {message && (
        <div className="mt-5 rounded-[22px] border border-cm-line bg-cm-surface p-4 text-sm text-cm-green">
          {message}
        </div>
      )}

      <section className="mt-5 rounded-[28px] border border-cm-line bg-cm-surface p-5">
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          {([
            ["single", "1 card per image"],
            ["grid-2", "2-card split"],
            ["grid-4", "4-card grid"],
            ["grid-9", "9-card sheet"],
          ] as Array<[DetectionMode, string]>).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setDetectionMode(mode)}
              className={`rounded-2xl border px-3 py-3 text-sm font-black ${
                detectionMode === mode ? "border-cm-purple bg-cm-purple/30" : "border-cm-line bg-black/20"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="mb-3 text-xs text-cm-muted">
          Choose 1 card per image for normal uploads, or a grid mode when one photo contains multiple cards.
        </p>

        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => onFiles(e.target.files)}
          className="w-full rounded-2xl border border-cm-line bg-black/30 p-3"
        />

        {drafts.length > 0 && (
          <>
            <div className="mt-4 rounded-2xl border border-cm-line bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between text-xs font-bold text-cm-muted">
                <span>Queue Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-black/40">
                <div className="h-full rounded-full bg-cm-purple" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-cm-line bg-black/20 p-3">
                <p className="text-xs text-cm-muted">Detected</p>
                <p className="text-xl font-black">{insights.totalCards}</p>
              </div>
              <div className="rounded-2xl border border-cm-line bg-black/20 p-3">
                <p className="text-xs text-cm-muted">Total Estimate</p>
                <p className="text-xl font-black">£{insights.totalEstimatedValue.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-cm-line bg-black/20 p-3">
                <p className="text-xs text-cm-muted">Rookies</p>
                <p className="text-xl font-black">{insights.rookieCount}</p>
              </div>
              <div className="rounded-2xl border border-cm-line bg-black/20 p-3">
                <p className="text-xs text-cm-muted">Hits / Premium</p>
                <p className="text-xl font-black">{insights.premiumCount}</p>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-cm-line bg-black/20 p-3 text-sm text-cm-muted">
              Highest value: <span className="font-black text-white">{insights.highestValueCard?.player || "None yet"}</span>
              {insights.highestValueCard ? ` • £${Number(insights.highestValueCard.estimatedValue || 0).toLocaleString()}` : ""}
              {insights.averageConfidence ? ` • Avg confidence ${insights.averageConfidence}%` : ""}
            </div>

          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <button
              onClick={scanAll}
              disabled={scanning}
              className="rounded-2xl bg-cm-purple py-3 font-black disabled:opacity-50"
            >
              {scanning ? "Scanning..." : `Scan All ${drafts.length} Cards`}
            </button>

            <button
              onClick={saveSelected}
              disabled={saving || !selectedCount}
              className="rounded-2xl bg-green-600 py-3 font-black disabled:opacity-50"
            >
              {saving ? "Saving..." : `Save Ready (${selectedReadyCount}/${selectedCount})`}
            </button>

            <button
              onClick={retryFailed}
              disabled={scanning || saving || insights.errorCards === 0}
              className="rounded-2xl border border-cm-line bg-white/10 py-3 font-black disabled:opacity-50"
            >
              Retry Failed ({insights.errorCards})
            </button>

            <button
              onClick={selectAllReady}
              disabled={scanning || saving}
              className="rounded-2xl border border-cm-line bg-white/10 py-3 font-black disabled:opacity-50"
            >
              Select Unsaved
            </button>

            <button
              onClick={clearAll}
              disabled={scanning || saving}
              className="rounded-2xl border border-cm-line bg-white/10 py-3 font-black disabled:opacity-50"
            >
              Clear All
            </button>
          </div>
          </>
        )}
      </section>

      {drafts.length > 0 && (
        <section className="mt-5 space-y-4">
          {drafts.map((draft, index) => (
            <article
              key={draft.id}
              className="rounded-[28px] border border-cm-line bg-cm-surface p-4"
            >
              <div className="flex items-start gap-4">
                {draft.image && (
                  <img
                    src={draft.image}
                    alt={draft.player || `Bulk card ${index + 1}`}
                    className="h-36 w-28 rounded-2xl bg-black/30 object-contain p-2"
                  />
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-cm-muted">#{index + 1} • {draft.fileName} • {draft.cropLabel}</p>
                      <h2 className="mt-1 text-xl font-black">
                        {draft.player || "Unknown Player"}
                      </h2>
                      <p className="text-sm text-cm-muted">
                        {draft.set || "Unknown Set"} • Confidence {confidencePercent(draft.confidence)}
                      </p>
                    </div>

                    <label className="flex items-center gap-2 text-sm font-bold">
                      <input
                        type="checkbox"
                        checked={draft.selected}
                        disabled={draft.status === "saved"}
                        onChange={(e) => updateDraft(draft.id, { selected: e.target.checked })}
                      />
                      Save
                    </label>
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-4">
                    <div className="rounded-2xl border border-cm-line bg-black/20 p-3">
                      <p className="text-xs text-cm-muted">Status</p>
                      <p className="font-black capitalize">{draft.status}</p>
                    </div>
                    <div className="rounded-2xl border border-cm-line bg-black/20 p-3">
                      <p className="text-xs text-cm-muted">Estimate</p>
                      <p className="font-black">£{Number(draft.estimatedValue || 0).toLocaleString()}</p>
                    </div>
                    <div className="rounded-2xl border border-cm-line bg-black/20 p-3">
                      <p className="text-xs text-cm-muted">Profit / Loss</p>
                      <p className="font-black text-cm-green">{profitLabel(draft)}</p>
                    </div>
                    <div className="rounded-2xl border border-cm-line bg-black/20 p-3">
                      <p className="text-xs text-cm-muted">Card No.</p>
                      <p className="font-black">{draft.cardNumber || "—"}</p>
                    </div>
                  </div>
                </div>
              </div>

              {draft.warning && (
                <p className="mt-3 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-200">
                  {draft.warning}
                </p>
              )}

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {editableFields.map(([key, label, placeholder]) => (
                  <label key={`${draft.id}-${key}`} className="block">
                    <span className="mb-1 block text-xs font-bold text-cm-muted">{label}</span>
                    <input
                      value={String(draft[key] || "")}
                      onChange={(e) => updateDraft(draft.id, { [key]: e.target.value } as Partial<BulkDraft>)}
                      placeholder={placeholder}
                      className="w-full rounded-2xl border border-cm-line bg-black/30 p-3 outline-none"
                    />
                  </label>
                ))}

                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-cm-muted">Purchase Price (£)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={Number(draft.purchasePrice || 0)}
                    onChange={(e) => updateDraft(draft.id, { purchasePrice: Number(e.target.value) || 0 })}
                    className="w-full rounded-2xl border border-cm-line bg-black/30 p-3 outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-cm-muted">Estimated Value (£)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={Number(draft.estimatedValue || 0)}
                    onChange={(e) => updateDraft(draft.id, { estimatedValue: Number(e.target.value) || 0 })}
                    className="w-full rounded-2xl border border-cm-line bg-black/30 p-3 outline-none"
                  />
                </label>
              </div>

              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-bold text-cm-muted">Notes</span>
                <textarea
                  value={draft.notes || ""}
                  onChange={(e) => updateDraft(draft.id, { notes: e.target.value })}
                  className="min-h-20 w-full rounded-2xl border border-cm-line bg-black/30 p-3 outline-none"
                />
              </label>

              <div className="mt-3 grid gap-2 md:grid-cols-4">
                <button
                  onClick={() => scanOne(draft)}
                  disabled={scanning || draft.status === "scanning" || draft.status === "saved"}
                  className="rounded-2xl border border-cm-line bg-white/10 py-3 font-black disabled:opacity-50"
                >
                  {draft.status === "scanning" ? "Scanning..." : "Rescan This Card"}
                </button>

                <button
                  onClick={() => addDraftToWishlist(draft)}
                  disabled={saving}
                  className="rounded-2xl border border-cm-line bg-white/10 py-3 font-black disabled:opacity-50"
                >
                  Add to Wishlist
                </button>

                <Link
                  href={`/card/${draft.id}`}
                  className={`rounded-2xl border border-cm-line bg-white/10 py-3 text-center font-black ${draft.status !== "saved" ? "pointer-events-none opacity-50" : ""}`}
                >
                  View Details
                </Link>

                <button
                  onClick={() => removeDraft(draft.id)}
                  disabled={scanning || saving}
                  className="rounded-2xl border border-red-500/30 bg-red-500/10 py-3 font-black text-red-200 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      <BottomNav />
    </main>
  );
}
