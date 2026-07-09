import { NextResponse } from "next/server";
import {
  buildScannerPrompt,
  imageToGeminiPart,
  imageToOpenAIInput,
  normalizeScannerCard,
  parseScannerJson,
  smartFillScannerResult,
} from "@/services/scannerAnalysis";

type ScannerPayload = {
  image?: string;
  backImage?: string;
  mimeType?: string;
  backMimeType?: string;
  visibleText?: string;
};

function scannerJsonResponse(body: any, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function buildV4Prompt(visibleText?: string) {
  return `${buildScannerPrompt(visibleText)}

CardMania Real AI Card Identification V4 instructions:
- Identify the actual trading card, not just the visible words.
- Prioritize player, team/club/country, manufacturer, product/set, year, card number, parallel, serial numbering, rookie status, autograph, patch/relic, and grade.
- If the card is sports-related, infer the sport when obvious.
- Return strict JSON only.
- Use null or empty string for unknown values.
- Include a searchQuery optimized for sold-comps lookup.
- Include confidence from 0 to 1.
- Include notes explaining any uncertainty.
- Include features object when possible:
  {
    "rookie": boolean,
    "autograph": boolean,
    "patch": boolean,
    "jersey": boolean,
    "relic": boolean,
    "numbered": boolean,
    "oneOfOne": boolean,
    "parallel": boolean
  }
- Include quality object when possible:
  {
    "score": number,
    "label": string,
    "warnings": string[],
    "missingFields": string[]
  }`;
}

async function scanWithOpenAI(payload: ScannerPayload) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const content: any[] = [
    { type: "input_text", text: buildV4Prompt(payload.visibleText) },
  ];

  const front = imageToOpenAIInput(payload.image);
  const back = imageToOpenAIInput(payload.backImage);
  if (front) content.push(front);
  if (back) content.push(back);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_SCANNER_MODEL || "gpt-4.1-mini",
      input: [{ role: "user", content }],
      temperature: 0,
      text: { format: { type: "json_object" } },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      provider: "openai",
      message:
        response.status === 429
          ? "OpenAI quota or rate limit reached."
          : data?.error?.message || "OpenAI scanner returned an error.",
      raw: data,
    };
  }

  const outputText =
    data?.output_text ||
    data?.output?.flatMap((item: any) => item?.content || [])?.find((part: any) => part?.type === "output_text")?.text ||
    "{}";

  const parsed = parseScannerJson(outputText);
  const card = normalizeScannerCard(parsed);

  return {
    ok: true,
    mode: "openai-v4",
    provider: "openai",
    version: "CardMania Real AI Card Identification V4",
    card,
    ...card,
    raw: outputText,
  };
}

async function scanWithGemini(payload: ScannerPayload) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const parts: any[] = [{ text: buildV4Prompt(payload.visibleText) }];
  const front = imageToGeminiPart(payload.image, payload.mimeType);
  const back = imageToGeminiPart(payload.backImage, payload.backMimeType || payload.mimeType);
  if (front) parts.push(front);
  if (back) parts.push(back);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_SCANNER_MODEL || "gemini-2.0-flash"}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0,
          response_mime_type: "application/json",
        },
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      provider: "gemini",
      message:
        response.status === 429
          ? "Gemini quota or rate limit reached."
          : data?.error?.message || "Gemini scanner returned an error.",
      raw: data,
    };
  }

  const outputText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const parsed = parseScannerJson(outputText);
  const card = normalizeScannerCard(parsed);

  return {
    ok: true,
    mode: "gemini-v4",
    provider: "gemini",
    version: "CardMania Real AI Card Identification V4",
    card,
    ...card,
    raw: outputText,
  };
}

export async function POST(req: Request) {
  try {
    const { image, backImage, mimeType, backMimeType, visibleText } = await req.json();

    if (!image && !backImage && !visibleText) {
      return scannerJsonResponse(
        smartFillScannerResult("", "No image or visible text was received. Upload a card image or enter visible text.")
      );
    }

    const payload: ScannerPayload = { image, backImage, mimeType, backMimeType, visibleText };
    const providerPreference = String(process.env.SCANNER_PROVIDER || "auto").toLowerCase();
    const errors: any[] = [];

    const providers =
      providerPreference === "gemini"
        ? [scanWithGemini, scanWithOpenAI]
        : providerPreference === "openai"
          ? [scanWithOpenAI, scanWithGemini]
          : [scanWithOpenAI, scanWithGemini];

    for (const provider of providers) {
      try {
        const result = await provider(payload);
        if (!result) continue;
        if (result.ok) return scannerJsonResponse(result);
        errors.push(result);
      } catch (error: any) {
        errors.push({ message: error?.message || "Scanner provider failed." });
      }
    }

    const fallbackReason = errors.length
      ? `${errors[0]?.message || "AI scanner unavailable"} Smart Fill used local text clues instead.`
      : "No AI scanner key found. Add OPENAI_API_KEY or GEMINI_API_KEY in .env.local. Smart Fill used local text clues instead.";

    return scannerJsonResponse({
      ...smartFillScannerResult(String(visibleText || ""), fallbackReason),
      mode: "manual-required",
      provider: "smart-fill",
      version: "CardMania Real AI Card Identification V4 fallback",
      errors,
    });
  } catch (error: any) {
    return scannerJsonResponse(
      {
        ...smartFillScannerResult("", error?.message || "Scanner server error. Smart Fill remains available."),
        mode: "scanner-error",
        provider: "server",
        version: "CardMania Real AI Card Identification V4",
      },
      200
    );
  }
}
