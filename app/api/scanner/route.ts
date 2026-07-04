import { NextResponse } from "next/server";
import {
  buildScannerPrompt,
  imageToGeminiPart,
  imageToOpenAIInput,
  normalizeScannerCard,
  parseScannerJson,
  smartFillScannerResult,
} from "@/services/scannerAnalysis";

async function scanWithOpenAI(payload: {
  image?: string;
  backImage?: string;
  visibleText?: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const content: any[] = [
    { type: "input_text", text: buildScannerPrompt(payload.visibleText) },
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
      message: response.status === 429 ? "OpenAI quota or rate limit reached." : "OpenAI scanner returned an error.",
      raw: data,
    };
  }

  const outputText =
    data?.output_text ||
    data?.output?.flatMap((item: any) => item?.content || [])?.find((part: any) => part?.type === "output_text")?.text ||
    "{}";

  const parsed = parseScannerJson(outputText);
  return {
    ok: true,
    mode: "openai",
    provider: "openai",
    card: normalizeScannerCard(parsed),
    raw: outputText,
  };
}

async function scanWithGemini(payload: {
  image?: string;
  backImage?: string;
  mimeType?: string;
  backMimeType?: string;
  visibleText?: string;
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const parts: any[] = [{ text: buildScannerPrompt(payload.visibleText) }];
  const front = imageToGeminiPart(payload.image, payload.mimeType);
  const back = imageToGeminiPart(payload.backImage, payload.backMimeType || payload.mimeType);
  if (front) parts.push(front);
  if (back) parts.push(back);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_SCANNER_MODEL || "gemini-2.5-flash"}:generateContent?key=${apiKey}`,
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
      message: response.status === 429 ? "Gemini quota or rate limit reached." : "Gemini scanner returned an error.",
      raw: data,
    };
  }

  const outputText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const parsed = parseScannerJson(outputText);
  return {
    ok: true,
    mode: "gemini",
    provider: "gemini",
    card: normalizeScannerCard(parsed),
    raw: outputText,
  };
}

export async function POST(req: Request) {
  try {
    const { image, backImage, mimeType, backMimeType, visibleText } = await req.json();

    if (!image && !backImage && !visibleText) {
      return NextResponse.json(
        smartFillScannerResult("", "No image or visible text was received. Upload a card image or enter visible text.")
      );
    }

    const payload = { image, backImage, mimeType, backMimeType, visibleText };
    const providerPreference = String(process.env.SCANNER_PROVIDER || "auto").toLowerCase();
    const errors: any[] = [];

    const providers = providerPreference === "gemini" ? [scanWithGemini, scanWithOpenAI] : [scanWithOpenAI, scanWithGemini];

    for (const provider of providers) {
      try {
        const result = await provider(payload);
        if (!result) continue;
        if (result.ok) return NextResponse.json(result);
        errors.push(result);
      } catch (error: any) {
        errors.push({ message: error?.message || "Scanner provider failed." });
      }
    }

    const fallbackReason = errors.length
      ? `${errors[0]?.message || "AI scanner unavailable"} Smart Fill used local text clues instead.`
      : "No AI scanner key found. Add OPENAI_API_KEY or GEMINI_API_KEY in .env.local. Smart Fill used local text clues instead.";

    return NextResponse.json({
      ...smartFillScannerResult(String(visibleText || ""), fallbackReason),
      errors,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ...smartFillScannerResult("", error?.message || "Scanner server error. Smart Fill remains available."),
        mode: "scanner-error",
      },
      { status: 200 }
    );
  }
}
