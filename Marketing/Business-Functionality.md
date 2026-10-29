# HappyHomesHub — Business & Functionality Reference

A plain-language map of what the platform does today and how the money works, written so you can plan future enhancements without reading the code. (For exact implementation, the source of truth is `src/` and `supabase/`.)

---

## 1. What it is

A property-management SaaS connecting three roles in one app:

- **Homeowner (landlord)** — manages properties, tenants, rent, repairs, expenses, and taxes.
- **Tenant (habitant)** — pays rent, requests repairs, tracks deposit, applies to rentals, gets screened.
- **Handyman** — gets discovered by landlords, accepts jobs, gets paid in-app.

Each role has its own portal (`/landlord`, `/tenant`, `/handyman`) behind authentication.

---

## 2. Core modules

| Module | What it does |
|---|---|
| **Properties** | Landlord adds/edits properties (address, beds/baths, notes). |
| **Tenancies & invites** | Landlord creates a tenancy + secure invite link; tenant accepts to connect. |
| **Rent** | Tracks rent due/paid; tenants pay by card or bank via Stripe; **late-fee config** per tenancy (grace days, fixed or % fee). Payouts go straight to the landlord's bank (Stripe Connect) — HHH takes no cut of rent. |
| **Maintenance / repairs** | Tenant submits a request with photos; status timeline + ETA; landlord assigns a handyman. |
| **Handyman marketplace** | Landlords find handymen by trade/area; jobs assigned, scheduled, completed, and **paid in-app** (recorded as a landlord expense). |
| **Inspections** | Move-in/move-out/routine inspections with photos and tenant sign-off. |
| **Documents & e-signature** | Lease agreements and notices with in-app signing. |
| **Expenses & tax** | Per-property expense tracking, Schedule E export, cashflow charts. |
| **Messaging** | Landlord ↔ tenant and landlord ↔ handyman threads. |
| **Notifications / PWA** | Email + push (and SMS on the paid tier); installable progressive web app, offline banner. |
| **Applicant screening** | Tenant buys a TransUnion SmartCheck Plus report, reused across landlords (see §3). |
| **Referrals** | Per-user referral links with automatic credit rewards (see §3). |
| **Error logging** | All front-end errors recorded to `error_log` so the team sees bugs users don't report. |

---

## 2b. Full feature inventory

The §2 table is the high-level view. Below is the complete, current feature set (derived from the live pages, components, and edge functions).

### Landlord portal
- Dashboard with portfolio stats and a guided setup checklist
- Properties: add, edit, list, detail (beds/baths/sqft/notes)
- Tenants directory
- Tenant invites: secure one-click join links, email/SMS delivery, resend/expire
- Rent: schedule & track, record manual payments, online card/bank payment status, history, receipts
- **Late-fee configuration** per tenancy: grace days, fixed $ or % of rent, auto-applied when overdue
- Rent payouts via Stripe Connect (deposited to the landlord's bank; HHH takes no cut); fee-free ACH on an active subscription
- Maintenance: requests with photos, status workflow, assign a handyman, ETA timeline
- Handyman marketplace: browse by trade/area, assign jobs, pay in-app (logged as an expense)
- Inspections: move-in / move-out / routine, photos by room, tenant e-sign
- Documents: upload, e-signature requests, lease agreements & notices
- Expenses: per-property, categories, receipt upload, link to a maintenance request
- **Tax export (Schedule E)** summary and **cashflow charts**
- Messaging: tenant and handyman threads
- Notifications: email + web push + SMS, with per-channel settings
- Billing: subscription, promo codes, referral card, payout setup
- Referral program (refer other landlords)

### Tenant portal
- Dashboard
- Pay rent online (card or bank/ACH), payment history, downloadable receipts, late-fee visibility
- Repairs: submit with photos, live status timeline & ETA, detail view
- Rental application: multi-step form with status tracking
- Screening: buy a TransUnion SmartCheck Plus report ($50 / $70), view status & 90-day validity
- Deposit: amount, deductions, estimated return, status
- Documents: view & e-sign leases
- Messaging with the landlord
- Account & referral (refer tenants → screening discount)

### Handyman portal
- Dashboard (open / active / completed jobs)
- Jobs: accept, schedule, quote, complete
- Profile: trades, service area/radius, availability, bio, working hours; verified badge & ratings
- Get paid in-app via Stripe Connect (no commission, no lead fees)
- Messaging with landlords
- Account

### Public & marketing
- Landing page and role landing pages (`/for-landlords`, `/for-tenants`, `/for-handymen`) with **role deep-link signup** (`?role=`)
- FAQ, Contact form, Accessibility statement, Terms, Privacy
- Blog / SEO (sitemap, meta tags, per-page titles)

### Platform & cross-cutting
- Auth: email/password signup, login, forgot/reset password, email confirmation
- **Multi-role accounts** (landlord + tenant + handyman) with role switching
- Role-based access + Postgres Row-Level Security on every table
- Audit log of record changes
- Progressive Web App: installable, offline banner, service worker
- Web push notifications, transactional email, SMS (premium)
- Photo/image upload & handling; on-screen e-signature pad
- Error logging to `error_log` + Sentry monitoring
- Toast + maintenance/system banners; theming

### Monetization (detail in §3)
- Landlord subscription: $10/property/mo with an automatic 3-month trial (one per person via fingerprint)
- Promo codes: first-property-free and free-months, with quota/expiry and a scarcity counter
- Applicant screening tiers ($50 / $70)
- Referral credits (landlord property-month; tenant screening discount)

---

## 3. How the money works (monetization)

### Landlord subscription — two tiers (per property, per month)
- **Landlord — $7** (decoy/entry): core features. Inspection/maintenance photos auto-delete after **1 month**; no SMS; no expense tracking, in-app payouts or analytics.
- **Super Landlord — $10** (only **$3 more**): adds **SMS alerts**, **photo retention until lease end + 3 months** (with deletion notice), **expense tracking**, **in-app handyman payouts**, **cashflow analytics & tax reports**, and priority support. The cost-heavy features (storage, SMS) live here on purpose.
- **3-month free trial of Super Landlord** for new (non-coupon) landlords, enforced **once per real person** via a demographics+address fingerprint (`trial_redemptions`).
- `subscriptions.tier` stores the tier; `users.is_premium` means "on Super" and drives all the Super-only gating (a `useIsSuper` hook + `SuperLock` upsell on the client). Tier is derived in the webhook from the Stripe price the customer is on, so upgrade/downgrade ("switch_tier", a prorated price swap) stays in sync.
- Billing runs on **Stripe subscriptions** (two recurring prices, `STRIPE_PRICE_LANDLORD` / `STRIPE_PRICE_SUPER`, × property quantity).

### Promo codes (owner-controlled, database-driven)
Stored in the `promo_codes` table — edit rows directly (no code change needed). Each code has a usage quota (`max_uses`/`used_count`), optional expiry, and a discount type:
- `free_months` — credits the **$7 Landlord base for N months** via a Stripe coupon. `HAPPYHOMEOWNER` is now **first property free for 1 year** (12 months); because it credits $7, upgrading that property to Super costs exactly **$3** — the "steal."
- `first_property_free` — frees a property's base price (legacy; still supported).
- `percent` / `fixed` — defined in the schema, **not yet wired** into checkout (future work).

Redemptions are burned only on **successful** checkout, so abandoned carts don't waste codes.

### Applicant screening (tenant-paid)
- **$50** = TransUnion SmartCheck Plus report, valid 90 days, up to **10 applications**.
- **$70** = same report, **unlimited** applications.
- One-time Stripe payment; report reused across all HHH landlords for 90 days.
- **Fulfillment is currently manual**: on payment, an admin email fires; the team initiates the SmartCheck order and updates the record. (Automation needs TransUnion partner API access — a future enhancement.)

### Referrals (growth credits)
- Homeowner → homeowner: both earn a **$10 property-month credit** when the new homeowner **adds a property + invites a tenant**. Credits apply via Stripe customer balance.
- Tenant → tenant: both earn **$10 off next screening** when the new tenant gets screened.

### Handyman
- **Free.** No subscription, no commission, no lead fees. Revenue from handymen is intentionally $0 — they are supply that makes the landlord product more valuable.

---

## 4. Technical architecture (for planning, not deep detail)

- **Frontend:** React 18 + TypeScript + Vite + TailwindCSS. Routing via React Router (lazy-loaded). State via Zustand + TanStack Query. PWA with service worker.
- **Backend:** Supabase — PostgreSQL with **Row-Level Security on every table**, Supabase Auth, and Deno **Edge Functions** for anything needing secrets/Stripe.
- **Payments:** Stripe — subscriptions (landlord billing), one-time payments (screening, rent, handyman payouts), Connect (landlord payouts), customer balance (referral credits), coupons (promos).
- **Key edge functions:** `create-checkout-session` (landlord billing + promo + trial), `create-screening-session` (screening tiers + referral discount), `stripe-webhook` (the hub: subscriptions, screening, payouts, referrals, trial fingerprints, promo redemptions), `connect-onboard`/`connect-status`, `pay-rent`, `accept-invite`, `send-notification`.
- **Migrations:** numbered SQL files in `supabase/migrations/` are the schema source of truth.

### Notable data tables
`users`, `properties`, `tenancies`, `invites`, `rent_payments`, `maintenance_requests`, `handyman_profiles`, `inspections`, `documents`, `expenses`, `subscriptions`, `promo_codes`, `screening_reports`, `referrals` / `referral_codes` / `referral_rewards`, `trial_redemptions`, `error_log`.

---

## 5. Operational notes (things done outside the app)

- **New migrations** must be run in the Supabase SQL editor in order.
- **Stripe setup:** a $10/mo recurring price (`STRIPE_PRICE_PROPERTY`) must exist and be set as an edge-function secret. Promo `free_months` coupons are auto-created on first use.
- **Promo management is SQL-driven:** change `max_uses`, `expires_at`, or `active` directly on a `promo_codes` row — the UI and checkout read it live.
- **Screening fulfillment is manual** until TransUnion API access is approved.

---

## 6. Future enhancements backlog

> **Standing requirement — bilingual (English + Spanish):** the product is to be bilingual. **Every future enhancement that adds or changes user-facing copy must ship in both English and Spanish** — UI strings, emails/SMS, marketing pages, flyers, and legal/FAQ pages. There is currently **no i18n layer** (copy is hard-coded English); the first step is an i18n foundation (e.g. `react-i18next` or a lightweight context + `en`/`es` message catalogs), a language toggle, and a persisted language preference.

Ordered roughly by value-to-effort:

0. **Bilingual EN/ES (i18n)** — add the i18n foundation above, translate existing copy to Spanish, and a language switcher. Prerequisite for the "both languages" rule on everything below.
1. **Verified Renter badge** — let a $70-unlimited tenant share a public verification profile to *any* landlord (even off-platform) → pulls landlords in.
2. **Lease renewal reminders** — scheduled emails before `lease_end` (60/30/7 days).
3. **Rent increase notice generator** — compliant notices with state rules.
4. **Renters insurance referral widget** — affiliate revenue, zero platform cost.
5. **Adverse-action letter generator** — auto FCRA decline letters for landlords; paid add-on competitors charge for.
6. **Screening automation** — TransUnion partner API to replace manual fulfillment.
7. **Wire `percent` / `fixed` promo types** into checkout (schema already supports them).
8. **Handyman referral program** — extend the referral loop to the handyman side.
9. **Tighter trial guard** — also fingerprint the payment card (Stripe exposes a card fingerprint) so the same card can't trial twice.
10. **SEO content engine** — programmatic state-specific landlord guides off the existing `/blog`.
11. **Move-in/out checklist templates** and **post-lease tenant ratings**.

---

## 7. Known copy/consistency cleanups

- The marketing landing page (`/for-landlords`) still describes the **old pricing** ("first property free, $20 for the 2nd, then $10"). With the move to **$10/property + a 3-month trial**, this copy should be refreshed to match. Flagged here so it isn't forgotten in the next marketing pass.
