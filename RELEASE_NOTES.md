# CardMania V7.1 Stability + Smart Fill

This update builds on V7 Cloud First and focuses on making the scanner safer and more useful when Gemini quota is limited.

## Added
- Smart Fill fallback service.
- Paste visible card text and auto-fill player/team/set/year/parallel/serial fields.
- Quick preset buttons for common football cards.
- Better market estimate player rules.
- Scanner form now appears after image upload, even before AI scan.

## Fixed
- Scanner JSX structure cleaned up.
- Less chance of saving cards as Unknown Player when AI is unavailable.
- Clearer messaging when Gemini is rate-limited.

## Setup reminder
Copy your `.env.local` from the working V6/V7 folder into this project root before running.

## V7.2 Portfolio Pro
- Added portfolio insight engine.
- Added reusable portfolio breakdown bars.
- Upgraded Portfolio page with manufacturer/team value breakdowns.
- Added Top Profit Cards and Needs Cleanup sections.
- Added ROI, value/cost bars, and portfolio health insights.
