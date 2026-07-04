# Assistant Pro + Wishlist Alerts

## Added
- New `services/cardAdvisor.ts` scoring engine.
- AI-style local assistant for grading, buy/hold/sell, portfolio risk, and wishlist deal guidance.
- Opportunity score for collection cards.
- Grading candidate watch section.
- Wishlist target/current price editing.
- Wishlist deal labels: Strong Buy Alert, Good Deal, At Target, Slightly Above Target, Too Expensive.
- Refresh Market button for wishlist items using Live Market Intelligence.

## Verification
- `npm run typecheck` passed.
- `next build` compiled successfully locally before timing out during Next page data collection in the sandbox environment. Run `npm run build` locally as usual.

## Environment
- Keep `.env.local` in the root beside `package.json`.
