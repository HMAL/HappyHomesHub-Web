# HappyHomesHub — Feature & Improvement Tracker

This document tracks all product features, improvements, and known issues across the HappyHomesHub Web SPA. Update this file whenever a feature is added, modified, or removed.

**Format:** Each item has a status badge, affected roles, and file references.
- Status: `[DONE]` `[IN PROGRESS]` `[PLANNED]` `[REMOVED]`
- Roles: `Landlord` `Tenant` `Handyman` `All`

---

## P1 — Critical Fixes (Blocking adoption or trust)

| # | Feature / Fix | Roles | Status | File(s) |
|---|---------------|-------|--------|---------|
| 1 | **Toast auto-dismiss timing** — error toasts stay 7s (was bugged at 3s) | All | `[DONE]` | `src/components/shared/Toast.tsx` |
| 2 | **Invite silent failure in Login** — account IS created even when invite link fails; user redirected to /role-select with warning toast | Tenant | `[DONE]` | `src/pages/auth/Login.tsx` |
| 3 | **ProtectedRoute timeout** — 20s total, "Still loading…" message at 8s, retry button at timeout | All | `[DONE]` | `src/components/shared/ProtectedRoute.tsx` |
| 4 | **ErrorBoundary safe messages** — hide raw DB/query error text; show generic user-safe message | All | `[DONE]` | `src/components/shared/ErrorBoundary.tsx` |
| 5 | **Application denial confirmation** — confirm dialog before denying tenant application | Landlord | `[DONE]` (was already present) | `src/pages/landlord/Tenants.tsx` |
| 6 | **Account deletion two-step** — confirm before removing all role access | All | `[DONE]` (was already present) | `src/pages/tenant/Account.tsx` etc. |
| 7 | **Password strength indicator** — real-time Too short/Weak/Fair/Strong meter on Signup | All | `[DONE]` | `src/pages/auth/Signup.tsx` |

---

## P2 — High User Impact

| # | Feature / Fix | Roles | Status | File(s) |
|---|---------------|-------|--------|---------|
| 8 | **Inspection photo upload** — attach jpg/png/webp (max 5MB) to inspections, stored in Supabase Storage `inspection-photos` bucket | Landlord | `[DONE]` | `src/pages/landlord/Inspections.tsx` |
| 9 | **Handyman ratings & reviews** — 1–5 star rating + text review via upsert modal; DB trigger syncs avg rating; handyman sees reviews on Profile page | Landlord, Handyman | `[DONE]` | `src/pages/landlord/Handymen.tsx`, `src/pages/handyman/Profile.tsx`, `supabase/migrations/029_handyman_reviews.sql` |
| 10 | **Realtime repair status** — Supabase `.channel()` subscription on `maintenance_requests` so tenant sees status changes without refresh | Tenant | `[DONE]` | `src/pages/tenant/Repairs.tsx` |
| 11 | **Realtime maintenance updates** — live status changes for landlord Maintenance page via Supabase channel | Landlord | `[DONE]` | `src/pages/landlord/Maintenance.tsx` |
| 12 | **Stripe payment polling retry** — poll every 2s up to 30s after Stripe redirect, showing "Verifying…" spinner (was one-shot 2.5s) | Tenant | `[DONE]` | `src/pages/tenant/Rent.tsx` |
| 13 | **Bulk "Mark all as paid"** — one-click to record payments for all current-month tenants without a paid record | Landlord | `[DONE]` | `src/pages/landlord/Rent.tsx` |
| 14 | **Send rent reminder** — "Remind" button on each row fires email via `notify` Edge Function to overdue tenant | Landlord | `[DONE]` | `src/pages/landlord/Rent.tsx` |
| 15 | **Paywall signal in Properties** — show "1 of 1 free / $10/mo each" count badge in Properties list | Landlord | `[DONE]` | `src/pages/landlord/Properties.tsx` |

---

## P3 — Quality of Life

| # | Feature / Fix | Roles | Status | File(s) |
|---|---------------|-------|--------|---------|
| 16 | **Back button in detail views** — in-app "Back to repairs" button on Repairs detail | Tenant | `[DONE]` (already present via ArrowLeft) | `src/pages/tenant/Repairs.tsx` |
| 17 | **Pagination on Maintenance list** — limit 50, "Load more" button; client-side search/filter on already-loaded page | Landlord | `[DONE]` | `src/pages/landlord/Maintenance.tsx` |
| 18 | **N+1 query refactor** — single JOIN queries for Maintenance, Expenses, Tenants | Landlord | `[PLANNED]` | `src/pages/landlord/Maintenance.tsx`, `src/pages/landlord/Expenses.tsx` |
| 19 | **Stripe redirect verifying state** — spinner shows "Verifying your payment…" while polling after Stripe redirect | Tenant | `[DONE]` | `src/pages/tenant/Rent.tsx` |
| 20 | **MaintenanceBanner localStorage persist** — dismiss state survives page refresh via `hhh_maintenance_dismissed` key | All | `[DONE]` | `src/components/shared/MaintenanceBanner.tsx` |
| 21 | **Phone validation fix** — accept E.164 format (11-digit with leading 1); strip country code gracefully | All | `[DONE]` | `src/pages/auth/Signup.tsx` |
| 22 | **Mobile bottom-sheet modals** — modals slide from bottom on screens < 640px | All | `[PLANNED]` | Global modal pattern |
| 23 | **Shared constants file** — support email, app URL, HANDYMAN_SERVICES, SERVICE_RADII, US_STATES, ROLE_META | All | `[DONE]` | `src/lib/constants.ts` |
| 24 | **Late fee field in Rent modal** — add optional late fee amount; appended to notes as "Late fee: $X.XX" | Landlord | `[DONE]` | `src/pages/landlord/Rent.tsx` |
| 25 | **Dead code removal** — `{false && isTenant && ...}` tenant address block removed from Signup | All | `[DONE]` | `src/pages/auth/Signup.tsx` |
| 26 | **File size limit display** — "PDF, DOC, DOCX, JPG, PNG · max 10 MB" shown before upload | Landlord | `[DONE]` | `src/pages/landlord/Documents.tsx`, `src/pages/landlord/Expenses.tsx` |
| 27 | **Handyman profile completeness** — animated progress bar (0–100%) showing profile fill percentage with missing field hints | Handyman | `[DONE]` | `src/pages/handyman/Profile.tsx` |
| 28 | **Constants deduplication** — HANDYMAN_SERVICES, SERVICE_RADII, US_STATES imported from `lib/constants.ts` in RoleManager | All | `[DONE]` | `src/components/shared/RoleManager.tsx` |

---

## P4 — New Features / Competitive Edge

| # | Feature / Fix | Roles | Status | File(s) |
|---|---------------|-------|--------|---------|
| 29 | **Dashboard charts** — rent collection trend (bar) + expense breakdown (pie) via recharts | Landlord | `[PLANNED]` | `src/pages/landlord/Dashboard.tsx` |
| 30 | **Bulk property CSV import** — upload CSV to add multiple properties at once | Landlord | `[PLANNED]` | `src/pages/landlord/Properties.tsx` |
| 31 | **PDF export** — download inspections, expense reports, rent ledger as PDF | Landlord | `[PLANNED]` | Multiple pages |
| 32 | **Lease renewal prompt** — alert banner in Dashboard 60 days before lease end with "Renew →" link per property | Landlord | `[DONE]` | `src/pages/landlord/Dashboard.tsx` |
| 33 | **Payment plan tracking** — split overdue rent into future installments | Landlord, Tenant | `[PLANNED]` | `src/pages/landlord/Rent.tsx` |
| 34 | **Two-factor authentication** — TOTP 2FA for landlords via Supabase Auth | Landlord | `[PLANNED]` | `src/pages/auth/` |
| 35 | **Push/browser notifications** — browser Notification API for rent, repairs, messages | All | `[PLANNED]` | New `src/lib/push.ts` |
| 36 | **Handyman job calendar** — week-view calendar showing assigned jobs + availability | Handyman | `[PLANNED]` | `src/pages/handyman/Jobs.tsx` |
| 37 | **Database index migration** — indexes on tenancy_id, property_id, status, due_date, created_at | All | `[DONE]` | `supabase/migrations/028_performance_indexes.sql` |
| 38 | **Inspection report PDF** — PDF with photos + notes for move-in/move-out (requires #8 + #31 first) | Landlord | `[PLANNED]` | `src/pages/landlord/Inspections.tsx` |
| 39 | **Application comparison view** — "Compare" toggle mode; select 2–3 submitted applicants; side-by-side modal showing income, employment, pets, vehicles, references, consents | Landlord | `[DONE]` | `src/pages/landlord/Tenants.tsx` |
| 40 | **Form validation library** — zod + react-hook-form for multi-step forms | All | `[PLANNED]` | All form pages |
| 41 | **Email template URL config** — replace hardcoded `app.happyhomeshub.com` with `APP_URL` constant | All | `[DONE]` | `src/lib/constants.ts` |
| 42 | **Edge Function rate limiting** — per-user request throttling on Edge Functions | All | `[PLANNED]` | `supabase/functions/` |
| 43 | **Late rent tenant notification** — tenant gets email when rent becomes overdue | Tenant | `[DONE]` (Edge Function already does this) | `supabase/functions/check-overdue-rent` |
| 44 | **Handyman marketplace messaging** — handyman can initiate conversation with new landlord | Handyman, Landlord | `[PLANNED]` | `src/pages/handyman/HandymanMessages.tsx` |

---

## Known Issues

| # | Issue | Severity | Notes |
|---|-------|----------|-------|
| A | RLS blocks unauthenticated invite property details on Join page | Medium | Tenant sees "sign up to view" instead of property address — intentional trade-off |
| B | Sentry/LogRocket not integrated — production errors only logged to console | High | Add error tracking before heavy production traffic |
| C | No E.164 formatting on handyman profile phone (only Signup validates correctly) | Low | `src/pages/handyman/Profile.tsx` uses same format util |

---

## Feature Removal Log

| Feature | Removed | Reason |
|---------|---------|--------|
| Hardcoded 3000ms Toast dismiss | Session 1 | Fixed: now uses store-defined duration (3s success, 7s error) |
| One-shot 2500ms Stripe polling | Session 2 | Fixed: replaced with 15-attempt 2s retry loop |
| Local HANDYMAN_SERVICES/US_STATES in Signup + RoleManager | Session 2 | Consolidated into `src/lib/constants.ts` |

---

## How to Update This File

1. When a feature is **added**: insert a new row, set status to `[DONE]` or `[IN PROGRESS]`
2. When a feature is **modified**: update the description and file reference
3. When a feature is **removed**: move it to the **Removal Log** with a reason
4. When a feature is **planned**: add row with `[PLANNED]` — fill in files when work starts
5. Commit this file alongside the code change so history stays in sync
