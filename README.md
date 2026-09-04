# FISCHERTEC Benefit Agent (FBA)

MVP 0.3 for capturing vouchers/benefits, reviewing extracted data, locating physical originals and matching benefits with relevant merchant events.

## Implemented

- Next.js / TypeScript application shell
- Prisma domain model for vouchers, balances, locations and opportunities
- Voucher extraction schema with per-field confidence
- mandatory review flags below configurable confidence threshold (default 82 %)
- provider-neutral import pipeline for photo, PDF, screenshot, email, manual and wallet sources
- deterministic text structurer for development/fallback operation
- import review UI at `/import`
- merchant-event opportunity engine with expiry, value, distance and interest weighting
- opportunity UI at `/opportunities`
- API routes: `POST /api/import/analyse`, `POST /api/opportunities`
- reminder and redemption-score foundations

## Provider boundary

Binary OCR is intentionally behind `DocumentTextProvider`. The current API can analyse supplied/extracted text immediately. A production OCR provider can be attached without changing the voucher domain model or review workflow.

Event discovery is intentionally separated from matching. External website/calendar/event feeds produce `MerchantEvent` records; `buildOpportunities()` performs deterministic voucher matching and ranking.

## Next development steps

1. production OCR for image/PDF plus QR/barcode extraction
2. save reviewed vouchers through Prisma/PostgreSQL
3. merchant source registry and scheduled event discovery
4. duplicate-event detection and source freshness checks
5. notification scheduler for expiry and opportunity alerts
6. email-forwarding ingestion
7. calendar/location context and family wallet
