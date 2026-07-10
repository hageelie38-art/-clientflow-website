# ClientFlow AI — Backend + Dashboard

Backend and live dashboard for **ClientFlow AI**, an AI receptionist service for
home service businesses (HVAC, plumbing, roofing). It receives `call.ended`
webhooks from Ulio, logs every call to Airtable, and serves a dark-themed
dashboard showing call activity, booking rate, and revenue captured.

## How it fits together

```
Ulio (AI receptionist) --call.ended webhook--> /api/webhook --> Airtable "Call Log"
                                                                       |
Dashboard (public/) <--/api/stats, /api/calls, /api/appointments, /api/monthly-summary-- Airtable
```

- `api/webhook.js` — receives Ulio's `call.ended` event, maps its fields onto
  the Airtable "Call Log" table, and creates a record.
- `api/stats.js` — aggregates Call Log records into the Overview stat cards
  (60-second in-memory cache).
- `api/calls.js`, `api/appointments.js`, `api/monthly-summary.js` — read-only
  endpoints backing the Call Log, Booked Appointments, and Monthly Summary
  tabs. The Airtable token never reaches the browser — the frontend only ever
  talks to these endpoints.
- `public/` — the dashboard itself (vanilla HTML/CSS/JS, no build step).
- `server.js` — Express server for local dev and Railway. The same `api/*.js`
  handlers also work unmodified as Vercel Functions.

## Airtable base

The backend is wired to this base by default (IDs live in `lib/config.js`):

| Table | ID |
|---|---|
| Call Log | `tblvskjHbDfauOo7r` |
| Appointments Booked | `tblNIfe3DCXKllVM5` |
| Monthly Summary | `tblh2PaNByS6rqpP1` |

Base ID: `appmYr2NnWtdIoKwS`.

## 1. Get an Airtable personal access token

1. Go to [airtable.com/create/tokens](https://airtable.com/create/tokens) (Account → Developer hub → Personal access tokens).
2. Click **Create token**.
3. Add scopes: `data.records:read` and `data.records:write`.
4. Under **Access**, add the ClientFlow AI base specifically (or the whole workspace).
5. Create the token and copy it — it's only shown once.

## 2. Configure environment variables

Copy `.env.example` to `.env.local` for local development:

```bash
cp .env.example .env.local
```

Set at minimum:

```
AIRTABLE_TOKEN=patXXXXXXXXXXXXXX...
```

Everything else (base/table IDs) already defaults to the ClientFlow AI base and
only needs overriding if you point this at a different base.

`ULIO_WEBHOOK_SECRET` is optional — set it once you've configured Ulio to send
a matching `x-ulio-signature` header, to reject spoofed webhook calls.

## 3. Run locally

```bash
npm install
npm start
```

The dashboard is served at `http://localhost:3000`, and the webhook is at
`http://localhost:3000/api/webhook`.

## 4. Deploy

### Option A — Vercel

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. Import the repo at [vercel.com/new](https://vercel.com/new).
3. Vercel auto-detects `api/*.js` as Functions and serves `public/` as static assets — no build command needed.
4. Add `AIRTABLE_TOKEN` (and `ULIO_WEBHOOK_SECRET` if used) under **Settings → Environment Variables**.
5. Deploy. Your webhook URL is `https://<your-project>.vercel.app/api/webhook`.

### Option B — Railway

1. Create a new project at [railway.app](https://railway.app) from this GitHub repo.
2. Railway detects `npm start` from `package.json` automatically.
3. Add `AIRTABLE_TOKEN` (and `ULIO_WEBHOOK_SECRET` if used) under the service's **Variables** tab.
4. Deploy. Your webhook URL is `https://<your-service>.up.railway.app/api/webhook`.

## 5. Test the webhook before going live

1. Get a temporary URL from [webhook.site](https://webhook.site).
2. In Ulio's webhook settings, point the `call.ended` webhook at that temporary URL.
3. Make a test call to the AI receptionist number.
4. On webhook.site, confirm the payload includes: `caller_name`, `phone_number` (or `phone`), `call_timestamp` (or `timestamp`), `duration`, `transcript` (or `full_transcript`), `call_type`, `outcome`, `estimated_value`, `after_hours`.
   - If Ulio's field names differ from these, adjust `lib/mapWebhookPayload.js` — it already tries a couple of common aliases for each field and falls back sensibly (e.g. an unrecognized `call_type` maps to "Vendor/Other" rather than failing).
5. Once the payload shape is confirmed, switch Ulio's webhook to your real deployed URL: `https://<your-domain>/api/webhook`.
6. Make one more real test call and confirm the record appears in the Airtable "Call Log" table and the dashboard's Call Log tab.

## Field mapping reference

Ulio → Airtable "Call Log" (`lib/config.js`, `lib/mapWebhookPayload.js`):

| Ulio field | Airtable field |
|---|---|
| `caller_name` | Caller Name |
| `phone_number` / `phone` | Phone Number |
| `call_timestamp` / `timestamp` | Call Date/Time |
| `call_type` | Call Type (New Lead / Existing Customer / Emergency Service / Billing Question / Vendor/Other) |
| `transcript` / `full_transcript` | Call Transcript |
| `outcome` | Outcome (Appointment Booked / Info Given / Transferred to Jamie / Voicemail Left / Missed - Would Have Lost Call) |
| `after_hours` | After Hours (checkbox) |
| `estimated_value` | Est. Job Value |

`call_type` and `outcome` are matched case-insensitively against the exact
Airtable option list first, then a small synonym table (e.g. `booked` →
"Appointment Booked", `emergency` → "Emergency Service"), then a fuzzy
substring match, before falling back to a safe default. Nothing ever throws on
an unexpected value.

## API reference

| Endpoint | Method | Returns |
|---|---|---|
| `/api/webhook` | POST | Logs a Ulio `call.ended` event to Airtable |
| `/api/stats` | GET | `total_calls`, `appointments_booked`, `after_hours_calls`, `estimated_revenue`, `booking_rate`, `calls_would_have_missed` (cached 60s) |
| `/api/calls` | GET | All Call Log records, newest first |
| `/api/appointments` | GET | All Appointments Booked records |
| `/api/monthly-summary` | GET | All Monthly Summary records |
| `/api/health` | GET | Liveness check |

## Rate limits

Airtable allows 5 requests/second per base. `lib/airtableClient.js` serializes
every Airtable call through a single queue with a ~220ms minimum gap between
requests, and backs off with retries on a 429.

## Notes

- The Airtable token lives only in server-side environment variables — the
  dashboard frontend never receives it, it only calls this backend's own
  `/api/*` endpoints.
- `/api/stats` caches its result in memory for 60 seconds; pass `?refresh=1`
  to force a recomputation.
