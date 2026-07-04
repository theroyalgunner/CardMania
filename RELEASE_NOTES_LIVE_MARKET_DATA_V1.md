# CardMania — Live Market Data v1

## Added
- Stronger live sold-listing analysis for Market Intelligence.
- Optional eBay Browse API support using `EBAY_BEARER_TOKEN`.
- HTML sold-search fallback when no API token is configured.
- Comparable scoring for sold listings based on title/query match.
- Automatic weak-comparable filtering.
- Spread percentage, kept/rejected comp counts, and source mode reporting.
- Better parsed sale metadata: URL, image, flags, score, and sold date.

## Notes
- The app still works without API keys.
- Without `EBAY_BEARER_TOKEN`, CardMania uses the existing eBay sold-search parsing fallback.
- eBay can limit parseable data, so the app always keeps the manual sold-search URL available.
