# TransUnion screening connector — setup & go-live

The screening flow is wired end-to-end but **inert** until TransUnion partner API
credentials exist. With no credentials, every report stays on the existing manual
path (admin gets an email, updates Supabase by hand). Nothing here changes that
until you set the env vars below.

## How the pieces fit

```
applicant pays (Stripe Checkout)
      │
      ▼
stripe-webhook  ── inserts screening_reports row (pending)
      │              │
      │              ├─ invokes  screening-order  (internal, service-role only)
      │              │     ├─ TransUnion NOT configured → no-op  ─┐
      │              │     └─ configured → createScreeningOrder() │
      │              │            stores order id + invite_url,   │
      │              │            status → processing,            │
      │              │            emails applicant the exam link  │
      │              └─ if not auto-ordered → manual admin email ◄┘
      ▼
applicant completes identity exam + consent on TransUnion's hosted page
      ▼
TransUnion → POST screening-callback  (public, token-authenticated)
      └─ normalizeCallback() → updates row: status/score/recommendation/report_url
            └─ emails applicant "report ready"
```

The single place the real API contract plugs in is
[`_shared/transunion.ts`](./transunion.ts) — two `TODO(contract)` blocks
(request mapping in `createScreeningOrder`, response mapping in
`normalizeCallback`) and one `TODO(credentials)` block (auth scheme in `tuFetch`).
No other file needs to change to go live.

## What to apply for

You have no TransUnion relationship yet. Options, easiest → most capable:

1. **TransUnion ShareAble for Rentals** (`shareable.com`) — the applicant-pays,
   landlord-receives model that matches this app's UX. Lightest onboarding. Check
   whether their current partner program exposes an API or only a hosted/affiliate
   flow; historically much of ShareAble is hosted-redirect rather than REST.
2. **TransUnion SmartMove** — the classic product the original code references.
   API access is via TransUnion's partner/reseller program, not self-serve.
3. **TransUnion TruVision Resident Screening / Resident Screening Solutions** —
   the full enterprise screening API (credit, criminal, eviction, income/ResidentScore).
   Most capable, heaviest compliance + contracting (FCRA, data-furnisher
   agreements, site inspection may be required).

Apply at the TransUnion partner/developer portal and ask specifically for:
- REST API access for resident screening (order creation + result retrieval)
- **Result delivery via webhook/postback** (so `screening-callback` can be used);
  if they only support polling, we'll add a scheduled poll instead.
- Their API reference (endpoints, auth, request/response schemas, status + decision
  enums) and sandbox/test credentials.

> Compliance note: pulling consumer credit/criminal data is FCRA-regulated. You'll
> sign a data agreement, attest to permissible purpose, and pass identity/site
> verification before production access. Budget weeks, not days. Keep the manual
> fallback live until then.

## Env vars to set (Supabase Edge Function secrets)

Set on the Supabase project (Dashboard → Project Settings → Edge Functions →
Secrets, or `supabase secrets set KEY=value`):

| Secret | Required | Example / notes |
| --- | --- | --- |
| `TRANSUNION_API_BASE` | yes | `https://api.transunion.com/resident-screening/v1` (from their docs) |
| `TRANSUNION_API_KEY` | yes | partner API key / bearer. If they use OAuth2 client-credentials, see `tuFetch` TODO and add `TRANSUNION_CLIENT_ID`/`SECRET` instead |
| `TRANSUNION_CALLBACK_URL` | yes | public URL of the `screening-callback` function: `https://<project-ref>.supabase.co/functions/v1/screening-callback` |
| `TRANSUNION_CALLBACK_SECRET` | recommended | random string; register it with TransUnion to send as the `x-callback-secret` header |
| `TRANSUNION_PRODUCT_BUNDLE` | optional | product/bundle code to order; defaults to `smartcheck_plus` |

`isConfigured()` flips to true only when the first three are present.

## Deploy

```sh
supabase functions deploy screening-order            # internal, keep JWT verification
supabase functions deploy screening-callback --no-verify-jwt   # called by TransUnion, not a user
supabase functions deploy stripe-webhook             # now invokes screening-order
supabase db push                                     # applies migration 051
```

Then register `TRANSUNION_CALLBACK_URL` (+ secret) in the TransUnion partner
dashboard as the result postback.

## Going live — fill in the contract

Once you have the API reference, in `_shared/transunion.ts`:
1. `tuFetch` — confirm/replace the auth header (static bearer vs OAuth token).
2. `createScreeningOrder` — map `requestBody` to their order schema; map the
   response to `{ providerRequestId, inviteUrl }`.
3. `normalizeCallback` — map their postback fields/enums to our
   `{ status, score, recommendation, reportUrl }`.

The DB columns, callback auth, idempotency, applicant emails, and manual fallback
are all already handled.
