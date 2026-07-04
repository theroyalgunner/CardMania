import { CollectionCard } from "./collectionStore";
import { WishlistItem } from "./wishlistStore";
import { estimateCardValue, valuationConfidence } from "./marketEngine";

export type CardRating = "Buy" | "Hold" | "Sell" | "Grade Candidate" | "Research";
export type RatingTone = "green" | "yellow" | "red" | "purple" | "blue";

export type CardOpportunity = {
  rating: CardRating;
  score: number;
  tone: RatingTone;
  headline: string;
  reasons: string[];
  risks: string[];
  nextAction: string;
};

function textFor(card: Partial<CollectionCard>) {
  return [
    card.player,
    card.team,
    card.manufacturer,
    card.set,
    card.year,
    card.parallel,
    card.serialNumber,
    card.cardNumber,
    card.grade,
    card.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hasAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function rarityScore(card: Partial<CollectionCard>) {
  const text = textFor(card);
  let score = 0;

  if (hasAny(text, ["1/1", "superfractor", "printing plate"])) score += 35;
  if (hasAny(text, ["/5", " /5", "red", "black"])) score += 24;
  if (hasAny(text, ["/10", "orange"])) score += 18;
  if (hasAny(text, ["/25", "purple", "gold"])) score += 14;
  if (hasAny(text, ["/50", "refractor", "auto", "autograph", "patch", "jersey"])) score += 10;
  if (hasAny(text, ["rookie", "rc", "debut"])) score += 10;

  const serial = String(card.serialNumber || "");
  const run = serial.match(/\/(\d+)/);
  if (run) {
    const number = Number(run[1]);
    if (number <= 1) score += 35;
    else if (number <= 5) score += 28;
    else if (number <= 10) score += 22;
    else if (number <= 25) score += 16;
    else if (number <= 50) score += 10;
    else if (number <= 99) score += 6;
  }

  return Math.min(score, 45);
}

function playerDemandScore(card: Partial<CollectionCard>) {
  const text = textFor(card);
  let score = 6;

  if (hasAny(text, ["messi", "cristiano", "ronaldo", "pele", "maradona"])) score += 26;
  if (hasAny(text, ["ronaldinho", "zidane", "beckham", "neymar", "mbappe", "haaland"])) score += 22;
  if (hasAny(text, ["yamal", "bellingham", "vinicius", "vini", "musiala", "endrick", "guler", "saka"])) score += 20;
  if (hasAny(text, ["real madrid", "barcelona", "manchester", "psg", "brazil", "argentina", "england", "france"])) score += 6;

  return Math.min(score, 35);
}

function valueScore(card: Partial<CollectionCard>) {
  const estimated = Number(card.estimatedValue || 0);
  const purchase = Number(card.purchasePrice || 0);
  const profit = estimated - purchase;

  if (!estimated && !purchase) return 4;
  if (estimated >= 500) return 20;
  if (estimated >= 150) return 16;
  if (profit >= 100) return 16;
  if (profit >= 30) return 12;
  if (profit >= 0) return 8;
  return 2;
}

export function analyzeCardOpportunity(card: Partial<CollectionCard>): CardOpportunity {
  const text = textFor(card);
  const estimated = Number(card.estimatedValue || 0);
  const purchase = Number(card.purchasePrice || 0);
  const profit = estimated - purchase;
  const rawScore = rarityScore(card) + playerDemandScore(card) + valueScore(card);
  const score = Math.max(0, Math.min(100, rawScore));
  const reasons: string[] = [];
  const risks: string[] = [];

  if (rarityScore(card) >= 25) reasons.push("Strong rarity signal from serial number, parallel, auto, patch, or short print details.");
  if (playerDemandScore(card) >= 25) reasons.push("Strong player/team demand profile for collector liquidity.");
  if (estimated > purchase && purchase > 0) reasons.push(`Current value is above cost by £${profit.toLocaleString()}.`);
  if (estimated >= 150) reasons.push("Card value is high enough to justify deeper market research before selling or grading.");
  if (String(card.grade || "Raw").toLowerCase() === "raw" && estimated >= 50) reasons.push("Raw card with enough value to consider grading if condition is clean.");

  if (!card.serialNumber && hasAny(text, ["gold", "orange", "red", "black", "refractor"])) risks.push("Parallel is entered, but serial number is missing; confirm if it is numbered.");
  if (!estimated) risks.push("Estimated value is missing, so the score is based mostly on card details.");
  if (estimated < purchase && purchase > 0) risks.push("Current estimated value is below purchase price.");
  if (!card.grade || String(card.grade).toLowerCase() === "raw") risks.push("Raw condition adds grading and condition risk.");
  if (!card.set || !card.year) risks.push("Set/year details are incomplete, which can reduce comparable accuracy.");

  let rating: CardRating = "Research";
  let tone: RatingTone = "blue";
  let headline = "Research before making a move";
  let nextAction = "Refresh market value, check sold comps, and complete missing card details.";

  if (score >= 78 && String(card.grade || "Raw").toLowerCase() === "raw") {
    rating = "Grade Candidate";
    tone = "purple";
    headline = "Strong grading candidate";
    nextAction = "Inspect corners, surface, edges, and centering. Grade only if condition looks clean.";
  } else if (score >= 70) {
    rating = "Buy";
    tone = "green";
    headline = "Strong opportunity profile";
    nextAction = "Look for sold comps below the suggested market value and avoid overpaying above recent median.";
  } else if (score >= 45) {
    rating = "Hold";
    tone = "yellow";
    headline = "Hold and monitor market";
    nextAction = "Track price movement and sell only if a strong offer appears.";
  } else if (estimated < purchase && purchase > 0) {
    rating = "Sell";
    tone = "red";
    headline = "Weak value position";
    nextAction = "Consider exiting if you need liquidity, or hold only if you expect player demand to improve.";
  }

  return {
    rating,
    score,
    tone,
    headline,
    reasons: reasons.length ? reasons : ["Not enough premium signals yet; add more details or market data."],
    risks: risks.length ? risks : ["No major risk flags from the saved details."],
    nextAction,
  };
}

export function gradeAdvice(card: Partial<CollectionCard>) {
  const estimated = Number(card.estimatedValue || 0);
  const text = textFor(card);
  const likelyWorthChecking = estimated >= 50 || hasAny(text, ["auto", "gold", "red", "black", "/10", "/25", "1/1", "rookie", "ronaldinho", "messi", "ronaldo"]);

  if (!likelyWorthChecking) {
    return "Probably do not grade yet. Add market value first, then grade only if the card is clean and the graded premium covers grading fees.";
  }

  return "Possible grading candidate. Check centering, corners, edges, surface scratches, print lines, and back damage. Grade only if expected PSA/BGS/SGC premium is higher than grading + shipping fees.";
}

export function wishlistDealLabel(item: Partial<WishlistItem>) {
  const target = Number(item.targetPrice || 0);
  const current = Number(item.currentPrice || 0);

  if (!target && !current) return { label: "Needs prices", tone: "text-cm-muted", score: 0 };
  if (!current) return { label: "Waiting for market price", tone: "text-yellow-300", score: 20 };
  if (!target) return { label: "Add target price", tone: "text-yellow-300", score: 20 };

  const discount = ((target - current) / target) * 100;

  if (discount >= 25) return { label: "Strong Buy Alert", tone: "text-cm-green", score: 95 };
  if (discount >= 10) return { label: "Good Deal", tone: "text-cm-green", score: 80 };
  if (discount >= 0) return { label: "At Target", tone: "text-yellow-300", score: 65 };
  if (discount >= -15) return { label: "Slightly Above Target", tone: "text-yellow-300", score: 40 };
  return { label: "Too Expensive", tone: "text-red-300", score: 20 };
}


function cardName(card: Partial<CollectionCard>) {
  return [card.player, card.year, card.set, card.parallel, card.serialNumber].filter(Boolean).join(" ") || "Unknown card";
}

function findReferencedCard(question: string, cards: CollectionCard[]) {
  const q = question.toLowerCase();
  return cards.find((card) => {
    const player = String(card.player || "").toLowerCase();
    const set = String(card.set || "").toLowerCase();
    const serial = String(card.serialNumber || "").toLowerCase();
    return (player && q.includes(player)) || (set && q.includes(set)) || (serial && q.includes(serial));
  });
}

function cardDeepDive(card: CollectionCard) {
  const analysis = analyzeCardOpportunity(card);
  const estimate = estimateCardValue(card);
  const confidence = valuationConfidence(card);
  const profit = estimate - Number(card.purchasePrice || 0);
  const reasons = analysis.reasons.slice(0, 2).join(" ");
  const risks = analysis.risks.slice(0, 2).join(" ");

  return `${cardName(card)}: ${analysis.rating} signal with ${analysis.score}/100 opportunity score. Estimated value is £${estimate.toLocaleString()} (${confidence} confidence) and current P/L is ${profit >= 0 ? "+" : "-"}£${Math.abs(profit).toLocaleString()}. ${reasons} Risk notes: ${risks} Next action: ${analysis.nextAction}`;
}

export function assistantAnswer(question: string, cards: CollectionCard[], wishlist: WishlistItem[] = []) {
  const q = question.toLowerCase().trim();
  const totalValue = cards.reduce((sum, card) => sum + Number(card.estimatedValue || estimateCardValue(card) || 0), 0);
  const totalCost = cards.reduce((sum, card) => sum + Number(card.purchasePrice || 0), 0);
  const profit = totalValue - totalCost;
  const sortedByScore = [...cards].sort((a, b) => analyzeCardOpportunity(b).score - analyzeCardOpportunity(a).score);
  const referenced = findReferencedCard(q, cards);

  if (!cards.length) {
    return "No cards are saved yet. Scan or bulk-import a few cards first, then I can rank grading candidates, value risks, sell candidates, and strongest opportunities.";
  }

  if (!q) {
    const top = sortedByScore[0];
    return top
      ? `Portfolio summary: ${cards.length} card(s), estimated value £${totalValue.toLocaleString()}, ${profit >= 0 ? "+" : "-"}£${Math.abs(profit).toLocaleString()} P/L. Best current opportunity: ${cardName(top)} (${analyzeCardOpportunity(top).score}/100). Ask about a player/card, grading, selling, or portfolio risk.`
      : "Ask about grading, buy/hold/sell, portfolio risk, wishlist deals, or which cards to research next.";
  }

  if (referenced) {
    if (q.includes("grade") || q.includes("psa") || q.includes("bgs") || q.includes("sgc")) {
      return `${cardDeepDive(referenced)} Grading view: ${gradeAdvice(referenced)}`;
    }
    if (q.includes("worth") || q.includes("value") || q.includes("price")) {
      const estimate = estimateCardValue(referenced);
      return `${cardName(referenced)} estimated value is £${estimate.toLocaleString()} using the offline valuation engine (${valuationConfidence(referenced)} confidence). Use Update Value on the card page for live market comps when available.`;
    }
    return cardDeepDive(referenced);
  }

  if (q.includes("grade") || q.includes("psa") || q.includes("bgs") || q.includes("sgc")) {
    const candidates = sortedByScore.filter((card) => analyzeCardOpportunity(card).score >= 55).slice(0, 5);
    if (!candidates.length) return "No strong grading candidates yet. Add estimated values, serial numbers, and parallel details first.";
    return `Top grading candidates: ${candidates.map((card) => `${cardName(card)} (${analyzeCardOpportunity(card).score}/100)`).join("; ")}. Grade only after checking centering, corners, edges, and surface under strong light.`;
  }

  if (q.includes("buy") || q.includes("deal") || q.includes("wishlist")) {
    const deals = wishlist
      .map((item) => ({ item, deal: wishlistDealLabel(item) }))
      .sort((a, b) => b.deal.score - a.deal.score)
      .slice(0, 5);

    if (!deals.length) return "No wishlist deals yet. Add target and current prices to the Wishlist page.";
    return `Best wishlist opportunities: ${deals.map(({ item, deal }) => `${item.name}: ${deal.label}`).join("; ")}.`;
  }

  if (q.includes("sell")) {
    const candidates = [...cards]
      .filter((card) => Number(card.estimatedValue || estimateCardValue(card) || 0) > 0)
      .sort((a, b) => Number(b.estimatedValue || estimateCardValue(b) || 0) - Number(a.estimatedValue || estimateCardValue(a) || 0))
      .slice(0, 5);

    if (!candidates.length) return "No sell candidates yet because card values are missing.";
    return `Potential sell candidates by value: ${candidates.map((card) => `${cardName(card)} £${Number(card.estimatedValue || estimateCardValue(card) || 0).toLocaleString()}`).join("; ")}. Check recent sold comps before listing.`;
  }

  if (q.includes("risk")) {
    const rawCount = cards.filter((card) => !card.grade || String(card.grade).toLowerCase() === "raw").length;
    const missingValue = cards.filter((card) => !Number(card.estimatedValue || 0)).length;
    const topCard = [...cards].sort((a, b) => Number(b.estimatedValue || estimateCardValue(b) || 0) - Number(a.estimatedValue || estimateCardValue(a) || 0))[0];
    return `Main risks: ${rawCount} raw card(s), ${missingValue} card(s) without saved market value, and concentration risk if ${topCard ? cardName(topCard) : "one card"} is a large share of the portfolio. Refresh market values before major decisions.`;
  }

  if (q.includes("value") || q.includes("worth") || q.includes("portfolio")) {
    return `Portfolio value is about £${totalValue.toLocaleString()} with ${profit >= 0 ? "+" : "-"}£${Math.abs(profit).toLocaleString()} profit/loss across ${cards.length} cards. Values use saved live prices where available and improved offline estimates otherwise.`;
  }

  if (q.includes("best") || q.includes("opportunity")) {
    const top = sortedByScore[0];
    if (!top) return "No cards saved yet.";
    const analysis = analyzeCardOpportunity(top);
    return `Best current opportunity: ${cardName(top)} with score ${analysis.score}/100 (${analysis.rating}). ${analysis.nextAction}`;
  }

  return `I checked your ${cards.length} saved card(s). Ask a specific question such as “Should I grade Ronaldinho?”, “What is my best opportunity?”, “What should I sell?”, or “What is my portfolio risk?”.`;
}
