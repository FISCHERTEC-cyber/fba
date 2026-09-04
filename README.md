# FISCHERTEC Benefit Agent (FBA)

MVP 0.4 for capturing vouchers/benefits, reviewing extracted data, locating physical originals and matching benefits with relevant merchant events.

## Implemented

- Next.js / TypeScript application shell
- Prisma domain model for vouchers, balances, locations and opportunities
- Voucher extraction schema with per-field confidence
- mandatory review flags below configurable confidence threshold (default 82 %)
- provider-neutral import pipeline for photo, PDF, screenshot, email, manual and wallet sources
- configurable HTTP document decoder via `OCR_PROVIDER_URL` / `OCR_PROVIDER_TOKEN`
- binary decoder contract for OCR plus QR/barcode results
- deterministic text structurer for development/fallback operation
- import review UI at `/import`
- merchant-event opportunity engine with expiry, value, distance and interest weighting
- Schema.org `Event` JSON-LD parser with deduplication and category inference
- event discovery API at `POST /api/opportunities/discover`
- opportunity UI at `/opportunities`
- API routes: `POST /api/import/analyse`, `POST /api/opportunities`
- reminder and redemption-score foundations
- GitHub Actions CI for tests and production build

## Import provider contract

Binary recognition is behind `BinaryDocumentDecoder`. A production service receives base64-encoded image/PDF content and is expected to return extracted text, confidence and optional QR/barcode results. `HttpDocumentDecoder` provides the production integration boundary without coupling FBA to one OCR vendor.

Required runtime configuration for binary recognition:

- `OCR_PROVIDER_URL`
- `OCR_PROVIDER_TOKEN` (optional)

Text-only imports remain usable without an OCR provider.

## Event discovery

`parseStructuredEvents()` extracts Schema.org `Event` JSON-LD from merchant HTML, normalises it to `MerchantEvent`, deduplicates matching records and infers useful categories such as wild, poultry, music, wine, brunch, grill and asparagus.

The discovery API intentionally accepts already-retrieved HTML. Arbitrary server-side URL fetching is not exposed, avoiding an SSRF surface. A later scheduler will fetch only merchant sources from a controlled source registry.

## Next development steps

1. select and connect the first production OCR/QR/barcode provider
2. save reviewed vouchers through Prisma/PostgreSQL
3. merchant source registry and scheduled event retrieval
4. source freshness, change detection and duplicate-event reconciliation
5. notification scheduler for expiry and opportunity alerts
6. email-forwarding ingestion
7. calendar/location context and family wallet
