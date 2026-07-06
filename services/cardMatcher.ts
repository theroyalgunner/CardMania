export type MatchResult = {
  accepted: boolean;
  score: number;
  reasons: string[];
  rejects: string[];
};

const PARALLELS = [
  "ultra violet", "gold", "black", "blue", "purple", "orange", "green", "red",
  "pink", "silver", "mojo", "refractor", "wave", "cosmic", "sapphire",
  "genesis", "color blast", "downtown", "kaboom", "manga", "stained glass",
  "zebra", "elephant", "dragon scale", "checkerboard", "pulsar", "prizm"
];

const JUNK = [
  "lot", "bundle", "job lot", "team set", "complete set", "empty box",
  "wrapper", "pack", "toploader", "sleeve", "digital", "reprint",
  "custom", "fan made"
];

function norm(v = "") {
  return v.toLowerCase().replace(/[#]/g, " ").replace(/\s+/g, " ").trim();
}

function serialDenominator(v = "") {
  const m = v.match(/\/\s*(\d{1,4})\b/);
  return m ? `/${m[1]}` : "";
}

function foundParallel(q: string) {
  return PARALLELS.find((p) => norm(q).includes(p));
}

function hasAny(text: string, words: string[]) {
  const t = norm(text);
  return words.some((w) => t.includes(w));
}

export function matchMarketListing(title: string, query: string): MatchResult {
  const t = norm(title);
  const q = norm(query);
  const reasons: string[] = [];
  const rejects: string[] = [];
  let score = 0;

  for (const junk of JUNK) {
    if (t.includes(junk)) rejects.push(`Junk listing: ${junk}`);
  }

  const parallel = foundParallel(q);
  if (parallel) {
    if (!t.includes(parallel)) rejects.push(`Wrong/missing parallel: ${parallel}`);
    else {
      score += 30;
      reasons.push(`Parallel matched: ${parallel}`);
    }
  }

  const denom = serialDenominator(q);
  if (denom) {
    if (!t.includes(denom)) rejects.push(`Wrong/missing serial: ${denom}`);
    else {
      score += 20;
      reasons.push(`Serial matched: ${denom}`);
    }
  }

  const wantsAuto = hasAny(q, ["auto", "autograph", "signed"]);
  const titleAuto = hasAny(t, ["auto", "autograph", "signed"]);
  if (wantsAuto && !titleAuto) rejects.push("Missing auto");
  if (!wantsAuto && titleAuto) rejects.push("Auto mismatch");
  if (wantsAuto && titleAuto) {
    score += 20;
    reasons.push("Auto matched");
  }

  const wantsRelic = hasAny(q, ["patch", "relic", "jersey", "memorabilia"]);
  const titleRelic = hasAny(t, ["patch", "relic", "jersey", "memorabilia"]);
  if (wantsRelic && !titleRelic) rejects.push("Missing patch/relic");
  if (!wantsRelic && titleRelic) rejects.push("Relic mismatch");
  if (wantsRelic && titleRelic) {
    score += 20;
    reasons.push("Patch/relic matched");
  }

  const qTokens = q.split(" ").filter((x) => x.length >= 3);
  const hits = qTokens.filter((x) => t.includes(x)).length;
  score += Math.min(40, hits * 5);

  if (hits >= 2) reasons.push(`${hits} keyword matches`);

  return {
    accepted: rejects.length === 0 && score >= 35,
    score: Math.max(0, Math.min(100, score)),
    reasons,
    rejects,
  };
}
