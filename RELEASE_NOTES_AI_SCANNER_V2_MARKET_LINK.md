# CardMania – AI Scanner V2 + Market Link

## What changed

- Upgraded Scanner prompt to AI Scanner V2.
- Added stronger image/OCR instructions for front and back card images.
- Added condition estimate, OCR clues, and AI-built market search query support.
- Scanner now automatically runs a live market check after a scan.
- Scanner shows suggested value, median price, sold comp count, spread, and top recent comps.
- Estimated value auto-updates when live market data returns a suggested value.

## Files changed

- `services/scannerAnalysis.ts`
- `services/aiTools.ts`
- `app/scanner/page.tsx`
- `RELEASE_NOTES_AI_SCANNER_V2_MARKET_LINK.md`

## Verification

- `npm run typecheck` passed.
- `npm run build` compiled successfully in the sandbox, then stalled during the final validation stage. Run locally for full confirmation.
