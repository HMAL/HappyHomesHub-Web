# Deployment — Remaining Tasks

Stripe is configured and the backend is live: migrations 032–038 run, all edge
functions deployed, and these secrets are set in Supabase — `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET_CONNECT`, `STRIPE_PRICE_SECOND_PROPERTY`,
`STRIPE_PRICE_ADDITIONAL_PROPERTY`, `ALLOWED_ORIGINS`. Two webhook destinations
("Your account" + "Connected accounts") and two Prices are created. Connect is enabled.

Below is everything still **pending**.

---

## 1. Required before live payments work
- [ ] **Finish Stripe identity verification (KYC).** Stripe Dashboard → Settings → Business/Verification → upload the requested ID/business documents. **No live charge (subscriptions, rent, payouts) succeeds until this clears.** Everything else is already wired.

## 2. Frontend
- [ ] **Deploy the site to Cloudflare Pages** so the new pages (Home/Portfolio pricing, blog, contact, audience pages) and SEO/analytics fixes go live.
- [ ] After deploy: confirm `robots.txt`, `sitemap.xml`, and per-page canonicals are live; resubmit sitemap in Google Search Console; check Cloudflare **Bots** settings aren't 403-ing Googlebot.

## 3. Optional integrations (set the secret when you want the feature)
Each is off until configured; the app runs fine without them.
- [ ] **Web push notifications** — generate a VAPID keypair → set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (on `notify-user`) + `VITE_VAPID_PUBLIC_KEY` (frontend).
- [ ] **Contact form + email notifications** — set `RESEND_API_KEY` (+ `SUPPORT_EMAIL`, `NOTIFICATION_FROM_EMAIL`). Contact form accepts messages but won't email until set.
- [ ] **SMS (Portfolio benefit)** — set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` on `notify-user`.
- [ ] **Error tracking** — set `VITE_SENTRY_DSN` (frontend).

## 4. End-to-end test (once KYC clears)
- [ ] Add a 2nd property → **Subscribe to Portfolio** with a real card → confirm Active → **refund** it in Stripe.
- [ ] Tenant pays rent → confirm it lands in the landlord's connected account.
- [ ] Handyman: accept quote → landlord pays → payout reaches the handyman; expense auto-recorded.

## 5. Deferred features (built as plan/copy only — not yet functional)
- [ ] **Fee-free ACH mechanic** — enable `us_bank_account` in `pay-rent` + the way the platform absorbs the capped ACH fee (recommended: subscription statement credit, keeping direct charges). Pricing/gating/copy are done; the payment-method + fee absorption are not.
- [ ] Rent autopay, automated late fees, payment-plan tracking, bulk property import
- [ ] Recurring expense & mortgage tracking, auto-categorized expenses, portfolio analytics & owner statements, PDF exports
- [ ] Co-landlord/team access, custom lease/document templates
- [ ] 2FA, full Spanish i18n, edge-function rate limiting

## 6. New competitor features to scope (discussed, not started)
- [ ] **TransUnion credit/background check** ($20/applicant add-on) — needs a screening provider + FCRA + state application-fee compliance research first.
- [ ] **Application fee at submission** (tenant pays; landlord funds the credit check) — ties to the above; check state caps.
- [ ] **Maintenance scheduling calendar (week-grid view)** — `scheduled_for` + ETA already exist; this is the calendar UI.
- [ ] **Annual tax statement (Portfolio)** — define vs the existing free Schedule E export (e.g., a polished owner statement).
