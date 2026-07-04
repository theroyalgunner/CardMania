# CardMania Phase 2.1 — Live Market Intelligence

## Added
- Stronger eBay sold-listing parser.
- Average, median, lowest, highest, suggested market value, sold count, and confidence score.
- Market update button on each card detail page.
- Local price history for refreshed cards.
- Market page can analyze cards and update values directly.
- Bulk top-10 live value refresh from the Market page.

## Notes
- `.env.local` is intentionally excluded from the release ZIP. Copy your existing `.env.local` into the project root before running.
- The eBay parser uses public sold-listing page text. If eBay blocks parsing or returns limited HTML, CardMania still opens the eBay sold-search page and shows a low-confidence result.

## Verify
Run:

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

Test:
- `/market` → Analyze a card and refresh top values.
- `/card/[id]` → Update Market Value and review comparable sales/history.
