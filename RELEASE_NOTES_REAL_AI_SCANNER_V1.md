# CardMania Real AI Scanner v1

## Added
- New shared scanner analysis engine in `services/scannerAnalysis.ts`.
- `/api/scanner` now supports provider priority through `SCANNER_PROVIDER`.
- OpenAI vision scanner support through `OPENAI_API_KEY`.
- Gemini scanner remains supported through `GEMINI_API_KEY`.
- Local Smart Fill fallback still works when no AI key is configured or quota is reached.
- Scanner output now includes structured features: rookie, autograph, patch, jersey, relic, numbered, 1/1, and parallel.
- Scanner output now includes quality scoring, missing field warnings, and scan strengths.
- Scanner page now shows provider label, scan quality, detected feature badges, and review warnings.

## Environment
Add optional scanner variables to `.env.local`:

```env
SCANNER_PROVIDER=auto
OPENAI_API_KEY=your_openai_api_key_optional
OPENAI_SCANNER_MODEL=gpt-4.1-mini
GEMINI_API_KEY=your_gemini_api_key_optional
GEMINI_SCANNER_MODEL=gemini-2.5-flash
```

## Notes
- The app remains buildable and usable without AI keys.
- Without AI keys, the scanner uses Smart Fill from file names and visible text.
