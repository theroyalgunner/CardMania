# CardMania Card Intelligence + Grading Center

Added in this upgrade:

- Card Intelligence score on every card detail page
- Buy / Hold / Sell / Watch signal
- Scarcity, liquidity, grading, momentum, and value sub-scores
- Risk label and investment band
- Short-term and long-term outlook text
- Grading recommendation per card
- New Grading Center page at `/grading`
- Ranked grading candidates across the collection
- Bottom navigation link for Grade

Validation:

- `npm run typecheck` completed successfully.
- `npm run build` compiled successfully and generated static pages in the sandbox before the command window timed out during final cleanup.

Use:

1. Copy `.env.local` into the root folder beside `package.json`.
2. Run `npm install` if needed.
3. Run `npm run typecheck`.
4. Run `npm run build`.
5. Run `npm run dev`.
