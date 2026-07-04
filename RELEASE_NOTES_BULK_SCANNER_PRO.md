# CardMania Bulk Scanner Pro

This upgrade replaces the old bulk importer with a review-first AI bulk scan workflow.

## Added
- Upload multiple card images at once.
- Run each image through the existing `/api/scanner` Gemini scanner.
- Auto-fill player, team, year, manufacturer, set, parallel, serial number, card number, grade, league, country, notes, confidence, and estimated value.
- Review and edit every card before saving.
- Select/unselect individual cards before save.
- Rescan a single card.
- Remove individual drafts.
- Duplicate check before saving selected cards.
- Save through `saveCard`, so cloud/local repository behavior remains consistent with the rest of the app.

## Test status
- `npm run typecheck` passed.
- `npm run build` compiled successfully; the sandbox timed out during Next.js page-data collection after compilation. Please run full build locally as normal.
