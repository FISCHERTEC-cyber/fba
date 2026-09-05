# FISCHERTEC Benefit Agent (FBA)

MVP 0.8 for capturing vouchers/benefits, reviewing extracted data, locating physical originals, tracking partial redemptions, matching benefits with relevant merchant events and delivering actionable reminders.

## Implemented

- Next.js / TypeScript application shell
- Prisma domain model for vouchers, balances, locations and opportunities
- Voucher extraction schema with per-field confidence
- mandatory review flags below configurable confidence threshold (default 82 %)
- provider-neutral import pipeline for photo, PDF, screenshot, email, manual and wallet sources
- configurable HTTP document decoder via `OCR_PROVIDER_URL` / `OCR_PROVIDER_TOKEN`
- binary decoder contract for OCR plus QR/barcode results
- deterministic text structurer for development/fallback operation
- import review UI at `/import` with editable fields, confidence confirmations and persistence
- photo, screenshot and PDF upload flow with a 10 MiB client/server limit
- merchant-event opportunity engine with expiry, value, distance and interest weighting
- Schema.org `Event` JSON-LD parser with deduplication and category inference
- event discovery API at `POST /api/opportunities/discover`
- controlled merchant source registry with indexed due times and per-source scan intervals
- protected scheduled scan endpoint at `POST /api/jobs/merchant-source-scan`
- SSRF guard for local, private and reserved scan targets plus validation of redirects
- conditional HTTP retrieval through ETag/Last-Modified, 12 s timeout and 2 MiB response limit
- SHA-256 content change detection to avoid unnecessary event processing
- persistent merchant events with update, reactivation and two-scan disappearance reconciliation
- stored opportunity API at `GET /api/opportunities`
- opportunity UI at `/opportunities`
- API routes for import analysis, reviewed voucher persistence, merchant sources and opportunity queries
- persistent voucher inventory at `/vouchers` with calculated remaining balances
- validated partial redemptions and complete redemption for monetary and non-monetary benefits
- automatic status transition to `REDEEMED` when the remaining balance reaches zero
- persistent, deduplicated in-app notifications for voucher expiry and relevant merchant events
- calendar-day expiry reminders at 30, 14, 7, 2 and 0 days in `Europe/Berlin`
- protected notification scheduler at `POST /api/jobs/notifications`
- provider-neutral HTTP delivery adapter for queued email notifications
- protected email delivery job with claim locking, delivery-attempt audit trail and exponential retry
- notification inbox at `/notifications` with read and dismiss actions
- GitHub Actions CI for tests and production build

## Import provider contract

Binary recognition is behind `BinaryDocumentDecoder`. A production service receives base64-encoded image/PDF content and is expected to return extracted text, confidence and optional QR/barcode results. `HttpDocumentDecoder` provides the production integration boundary without coupling FBA to one OCR vendor.

Required runtime configuration for binary recognition:

- `OCR_PROVIDER_URL`
- `OCR_PROVIDER_TOKEN` (optional)

Text-only imports remain usable without an OCR provider.

Until authentication is connected, the reviewed-voucher UI uses the server-side `FBA_MVP_USER_ID` as its user context. The referenced user must already exist in PostgreSQL. API clients can alternatively send `x-fba-user-id`.

## Event discovery

`parseStructuredEvents()` extracts Schema.org `Event` JSON-LD from merchant HTML, normalises it to `MerchantEvent`, deduplicates matching records and infers useful categories such as wild, poultry, music, wine, brunch, grill and asparagus.

The discovery API still accepts already-retrieved HTML for testing. Automated retrieval only uses registered merchant sources. It rejects URL credentials, local hostnames, private or reserved IP targets and redirects to such targets. Responses are limited to HTML, 2 MiB and 12 seconds.

## Scheduled merchant scans

Set a long random `SCAN_JOB_TOKEN`, then invoke the job with:

```http
POST /api/jobs/merchant-source-scan
Authorization: Bearer <SCAN_JOB_TOKEN>
Content-Type: application/json

{"limit":20}
```

The job selects due, enabled sources across users, processes at most 50 sources per invocation and continues after individual source failures. Failed sources use bounded exponential retry delays. A source event is deactivated only after it is absent from two changed, successful scans.

New database deployments must apply the initial Prisma migration before enabling the scan job.

## Scheduled notifications

Set a separate long random `NOTIFICATION_JOB_TOKEN`, then invoke the notification job daily with:

```http
POST /api/jobs/notifications
Authorization: Bearer <NOTIFICATION_JOB_TOKEN>
Content-Type: application/json

{"timeZone":"Europe/Berlin","minimumOpportunityScore":50,"channels":["IN_APP","EMAIL"]}
```

The job creates expiry reminders exactly 30, 14, 7, 2 and 0 local calendar days before expiration. Opportunity alerts are created for active, monitored vouchers when a merchant event reaches the configured score. Repeated job runs are safe because every notification has a stable deduplication key.

Apply all Prisma migrations before enabling the job. Users can view, mark as read and dismiss their in-app notifications at `/notifications` or through `GET` and `PATCH /api/notifications`.

Email generation is opt-in per scheduler call through `channels`. Configure the provider-neutral delivery endpoint with `NOTIFICATION_DELIVERY_URL` and optionally `NOTIFICATION_DELIVERY_TOKEN`. Then run:

```http
POST /api/jobs/notification-delivery
Authorization: Bearer <NOTIFICATION_JOB_TOKEN>
Content-Type: application/json

{"limit":20}
```

The adapter sends `notificationId`, `to`, `subject`, `text` and `metadata` as JSON. It also sends `notificationId` in the `Idempotency-Key` header. Providers should enforce that key because delivery is at least once. Failed requests are retried after 15, 30, 60 and 120 minutes; the fifth failed attempt moves the notification to `FAILED`. Each attempt is persisted.

## Next development steps

1. select and connect the first production OCR/QR/barcode provider
2. connect and validate the first production email provider
3. email-forwarding ingestion
4. authentication plus calendar/location context and family wallet
