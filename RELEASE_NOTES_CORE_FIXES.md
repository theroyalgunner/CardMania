# CardMania Core Fixes

This package focuses on the issues found during testing.

## Fixed / Improved

- Replaced the old placeholder valuation behavior where many cards stayed at £10.
- Offline valuation now considers player demand, brand/set, parallel, serial numbering, auto/patch/rookie signals, grade, age, and data completeness.
- Market Estimate Missing Values now also updates old £10 placeholder values.
- AI Assistant now gives a real portfolio summary on load instead of only showing prompt ideas.
- AI Assistant now answers about referenced cards by player/set/serial when possible.
- Home page restored as a proper CardMania dashboard instead of a duplicated market-style page.
- Added clear Grading shortcut on the home page.
- Grading Center remains accessible at /grading and through the bottom navigation.

## Test

Run:

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

Then test:

- /assistant
- /market Estimate Missing Values
- /grading
- / bulk scan workflow
- open a card and check intelligence/value blocks
