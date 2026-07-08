export interface MarketScore {
  score: number;
  trend: "Bullish" | "Neutral" | "Bearish";
  momentum: "Strong" | "Average" | "Weak";
  liquidity: "High" | "Medium" | "Low";
  volatility: "High" | "Medium" | "Low";
  scarcity: "Common" | "Limited" | "Rare";
  recommendation: "Strong Buy" | "Buy" | "Hold" | "Sell" | "Avoid";
  label: "Elite Investment" | "Strong Buy" | "Buy" | "Hold" | "Sell" | "Avoid";
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculateMarketScore(input: {
  confidenceScore?: number;
  roi?: number;
  liquidityScore?: number;
  risk?: "Low" | "Medium" | "High" | string;
  serialNumber?: string;
  trendPercent?: number;
  spreadPercent?: number;
}): MarketScore {
  const confidence = Number(input.confidenceScore || 0);
  const roi = Number(input.roi || 0);
  const liquidity = Number(input.liquidityScore || 0);
  const trendPercent = Number(input.trendPercent || 0);
  const spreadPercent = Number(input.spreadPercent || 0);

  const riskPenalty =
    input.risk === "High" ? 22 :
    input.risk === "Medium" ? 10 :
    0;

  const serial = String(input.serialNumber || "");
  const serialMax = Number(serial.split("/")[1] || 0);
  const scarcityBonus =
    serialMax > 0 && serialMax <= 10 ? 18 :
    serialMax > 0 && serialMax <= 50 ? 12 :
    serialMax > 0 && serialMax <= 99 ? 7 :
    0;

  const roiScore = Math.max(-15, Math.min(22, roi / 4));
  const trendScore = Math.max(-12, Math.min(12, trendPercent * 2));
  const volatilityPenalty = spreadPercent > 90 ? 12 : spreadPercent > 55 ? 7 : spreadPercent > 30 ? 3 : 0;

  const score = clamp(
    35 +
      confidence * 0.25 +
      liquidity * 0.18 +
      roiScore +
      trendScore +
      scarcityBonus -
      riskPenalty -
      volatilityPenalty
  );

  const trend = trendPercent > 8 ? "Bullish" : trendPercent < -8 ? "Bearish" : "Neutral";
  const momentum = trendPercent > 8 || roi > 35 ? "Strong" : trendPercent < -8 || roi < -20 ? "Weak" : "Average";
  const liquidityLabel = liquidity >= 75 ? "High" : liquidity >= 45 ? "Medium" : "Low";
  const volatility = spreadPercent > 70 ? "High" : spreadPercent > 35 ? "Medium" : "Low";
  const scarcity = serialMax > 0 && serialMax <= 25 ? "Rare" : serialMax > 0 && serialMax <= 99 ? "Limited" : "Common";

  const recommendation =
    score >= 85 ? "Strong Buy" :
    score >= 70 ? "Buy" :
    score >= 55 ? "Hold" :
    score >= 40 ? "Sell" :
    "Avoid";

  const label =
    score >= 95 ? "Elite Investment" :
    score >= 85 ? "Strong Buy" :
    score >= 70 ? "Buy" :
    score >= 55 ? "Hold" :
    score >= 40 ? "Sell" :
    "Avoid";

  return {
    score,
    trend,
    momentum,
    liquidity: liquidityLabel,
    volatility,
    scarcity,
    recommendation,
    label,
  };
}

export function marketScoreTone(score: number) {
  if (score >= 85) return "text-cm-green";
  if (score >= 70) return "text-yellow-200";
  if (score >= 55) return "text-orange-300";
  if (score >= 40) return "text-red-300";
  return "text-cm-muted";
}
