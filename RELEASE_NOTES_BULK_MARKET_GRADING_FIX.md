# Bulk Scanner + Market Estimate + Grading Route Fix

Fixes reported from Vercel testing:

- Bulk Scanner now runs a live market check after AI recognition and uses sold-comps suggested value when available.
- Bulk save now prevents unscanned drafts from being saved as image-only cards with blank details.
- Bulk save button now shows ready cards vs selected cards.
- Market pricing now uses median sold comps with auction/outlier filtering, fair low/high range, and pricing method.
- Added `/grade` redirect alias to `/grading` to prevent broken grade links.
- Home badge updated to V7.

Verification:

- `npm run typecheck` passed.
- `npm run build` started successfully in the sandbox but did not finish before the sandbox timeout; run locally/Vercel for final build confirmation.
