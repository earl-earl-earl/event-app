# QR Event Check-In System (Next.js + Supabase)

Production-ready QR-based event check-in for real-world venues with large guest lists,
concurrent scanner devices, and strict duplicate-entry prevention.

## Features

- Admin event creation and listing.
- Bulk CSV import with per-row validation and partial failure reporting.
- JWT-based secure ticket tokens (signed server-side with `jose`).
- `metadata` JSONB support for arbitrary guest fields (seat, company, VIP, etc.).
- Guest ticket page renders QR client-side from tokenized ticket link.
- Camera-based check-in scanner (`html5-qrcode`) plus manual token fallback.
- Transaction-safe verification through PostgreSQL function with row locking.
- Replay/double-scan protection across concurrent scanners.
- Realtime dashboard updates via Supabase Realtime.
- Dispatch queue for email/SMS link delivery (Resend + Twilio integration).

## Tech Stack

- Next.js App Router + TypeScript
- Supabase (PostgreSQL, Auth, Realtime)
- Supabase JS client (server + browser)
- `jose` (JWT signing and verification)
- `papaparse` (CSV parsing)
- `qrcode` (client and server QR generation)
- `html5-qrcode` (camera scanner)

## Project Structure

```text
app/
	api/
		events/route.ts
		guests/route.ts
		guests/stats/route.ts
		upload-csv/route.ts
		verify/route.ts
		dispatch/route.ts
		qr/route.ts
	dashboard/
		layout.tsx
		page.tsx
		events/page.tsx
		guests/page.tsx
	check-in/page.tsx
	ticket/
		page.tsx
		TicketCard.tsx
	login/page.tsx
lib/
	auth/
	csv/
	env/
	supabase/
	dispatch.ts
	http.ts
	qr.ts
	ticket.ts
	tokens.ts
supabase/
	schema.sql
types/
	database.ts
```

## 1. Environment Setup

Copy `.env.example` to `.env.local` and fill all required values.

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `QR_JWT_SECRET` (>= 32 chars)
- `APP_BASE_URL` (for ticket links)

Optional (automated dispatch):

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`

## 2. Database Setup (Supabase)

Run [supabase/schema.sql](supabase/schema.sql) in Supabase SQL Editor.

This creates:

- `events`
- `guests` (with JSONB `metadata`, `entry_count`, `max_entries`, unique `qr_token`)
- `scan_logs` (every allow/deny attempt)
- `verify_rate_limits` (DB-backed rate limiting state)
- `dispatch_queue` (email/SMS delivery queue)

It also creates transactional functions:

- `verify_guest_check_in(...)` uses `SELECT ... FOR UPDATE` row lock.
- `enforce_verify_rate_limit(...)` for API throttling.
- `log_scan_attempt(...)` for security audit logs.
- `claim_dispatch_jobs(...)` with `FOR UPDATE SKIP LOCKED` for safe worker scaling.

## 3. Install and Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## 4. Auth Expectations

Protected routes:

- `/dashboard/*`
- `/check-in`
- `/api/events`
- `/api/guests`
- `/api/upload-csv`
- `/api/verify`
- `/api/dispatch`

Supabase Auth session is required (middleware + server guards). By default, authenticated
users without an explicit role are accepted for backward compatibility. For stricter
production controls, set user role claims (`admin`, `organizer`, `staff`) and tighten guards.

## 5. CSV Format

Supports flexible headers. Recommended columns:

- `first_name`
- `last_name`
- `email`
- `phone_number`
- `max_entries` (optional)

Also supports combined `name` instead of first/last. Unknown columns are automatically
stored in guest `metadata` JSONB.

Example:

```csv
first_name,last_name,email,phone_number,max_entries,company,seat,vip
Jane,Doe,jane@acme.com,+639171111111,1,ACME,A12,true
```

## 6. Ticket Flow

1. Admin uploads CSV for an event.
2. System generates a signed JWT per guest and stores it as `qr_token`.
3. Ticket link format: `https://yourdomain.com/ticket?token=JWT_TOKEN`
4. Guest opens ticket page; QR is rendered client-side.
5. Scanner page reads QR and posts token to `/api/verify`.
6. Backend verifies JWT, enforces rate limit, runs transactional check-in RPC, logs result.

## 7. Concurrency and Double-Scan Protection

`/api/verify` calls PostgreSQL function `verify_guest_check_in` which:

- Locks guest row with `FOR UPDATE`.
- Rechecks event and token match.
- Rejects already-used/over-limit entries.
- Atomically increments `entry_count` and sets `checked_in`.

This ensures only one scanner succeeds under simultaneous scans.

## 8. Dispatch Worker

CSV import queues email and SMS jobs to `dispatch_queue`.

Run dispatch processing manually via:

- Dashboard button "Run Dispatch Worker", or
- `POST /api/dispatch`

For production, trigger `/api/dispatch` from a scheduled job (cron) at short intervals.

## 9. Performance Notes

- CSV inserts are batched (`500` rows/chunk).
- Token generation is concurrency-limited.
- Indexes exist on `qr_token`, `event_id`, and scan timelines.
- Verify API does minimal payload work and DB-side atomic logic.

## 10. Security Notes

- Token payload stores only IDs and issue timestamps.
- JWT verified server-side on every scan.
- Frontend data is never trusted for check-in.
- Verify endpoint is rate limited.
- Every scan attempt is logged.
- Enforce HTTPS in deployment.
