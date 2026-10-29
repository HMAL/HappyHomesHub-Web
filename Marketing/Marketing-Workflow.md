# HappyHomesHub — Marketing Workflow

A practical playbook for acquiring **Homeowners (landlords)** and **Handymen**. Use it as a repeatable weekly process, not a one-time campaign.

---

## 1. The offers to lead with

Lead every message with a concrete, current offer — these are what's actually live in the product:

| Audience | Headline offer | Backup hooks |
|---|---|---|
| **Homeowner** | **First 3 months free** (automatic on signup) | $10/mo per property after; `HAPPYHOMEOWNER` code = first property free *forever*; no cut of rent; tax-ready reports |
| **Handyman** | **100% free — no subscription, no commission, no lead fees** | Get paid in-app the moment a job is approved; real jobs from local landlords; ratings + verified badge |
| **Tenant** (secondary) | Free tenant accounts | Pay rent online, track repairs, screening $50 (10 apps) / $70 (unlimited) |

> Scarcity lever: `HAPPYHOMEOWNER` is capped (currently 100 redemptions) with a live "X left" counter on the billing page. Use "limited free-property codes" language in homeowner campaigns.

---

## 2. Deep links (use these everywhere)

Production domain: **app.happyhomeshub.com**

| Purpose | URL |
|---|---|
| Handyman signup (skips role picker) | `https://app.happyhomeshub.com/signup?role=handyman` |
| Homeowner signup (skips role picker) | `https://app.happyhomeshub.com/signup?role=landlord` |
| Homeowner landing page | `https://app.happyhomeshub.com/for-landlords` |
| Handyman landing page | `https://app.happyhomeshub.com/for-handymen` |
| Tenant landing page | `https://app.happyhomeshub.com/for-tenants` |
| Referral link (per user) | `https://app.happyhomeshub.com/signup?ref=THEIRCODE` |

The **handyman flyer QR** (see `Handyman-Flyer.html`) encodes the `?role=handyman` link, so a scan lands them directly on handyman signup.

---

## 3. Funnel (same five stages for both audiences)

1. **Awareness** — they hear about HHH (flyer/QR, local group post, referral, search).
2. **Consideration** — they land on `/for-landlords` or `/for-handymen` and read the value props + FAQ.
3. **Signup** — deep link drops them into the right signup with the role preselected.
4. **Activation** — the moment they get value:
   - Homeowner = **adds a property AND invites a tenant** (also triggers referral payout).
   - Handyman = **builds profile + connects bank** so they can receive jobs and payouts.
5. **Referral** — happy users share their link; rewards are automatic (see §6).

Goal of marketing is to move people from stage 1 → 4 as fast as possible. Track drop-off between stages.

---

## 4. Channel playbook

### Homeowners
- **Local Facebook groups / Nextdoor** — "landlord," "real estate investor," and neighborhood groups. Lead with "first 3 months free + first property free forever for the first 100."
- **Real estate investor meetups / REIA chapters** — short demo, hand out a homeowner version of the flyer.
- **Property manager & realtor referrals** — they touch landlords daily.
- **SEO / blog** — the app already has `/blog`. Publish state-specific guides ("Late fee laws in [state]", "Schedule E for small landlords") that tie to real features.
- **Existing-user referrals** — every landlord has a referral link in Billing.

### Handymen
- **Flyers + QR** (`Handyman-Flyer.html`) at hardware stores, supply houses, lumber yards, paint stores, community boards, coffee shops near trade areas.
- **Local trade Facebook groups** and Craigslist "gigs/services."
- **In-person at supply counters** — the QR makes signup a 1-scan action.
- **Word of mouth** — handymen talk; "free, no lead fees, paid in-app" is a strong pitch.

---

## 5. Sample copy

**Handyman flyer / post (short):**
> Get handyman jobs from local landlords — **free**. No subscription, no commission, no lead fees. Get paid straight to your bank when the job's done. Scan to sign up in 2 minutes.

**Homeowner social post:**
> Manage your rentals in one place — rent collection, repairs, expenses, and tax-ready reports. **Your first 3 months are free**, then just $10/month per property. The first 100 homeowners get their first property **free forever** with code HAPPYHOMEOWNER. → app.happyhomeshub.com/for-landlords

**Cold DM to a handyman:**
> Hey [name] — I run HappyHomesHub, where local landlords post repair jobs. It's free for pros: no monthly fee, no commission, no lead fees, and you get paid in-app. Want me to send your signup link?

---

## 6. Referral mechanics (automatic — just get users sharing)

- **Homeowner → homeowner:** both get a **$10 property-month credit** once the new homeowner **adds a property and invites a tenant**. (Activation-gated to block empty signups.)
- **Tenant → tenant:** both get **$10 off their next screening** once the new tenant purchases screening.
- Each user's link lives on their Billing/Account page ("Refer a friend" card) with copy button and a live "friends joined / credits earned" counter.

Marketing action: after a user activates, prompt them to share their link (email, in-app nudge, "give $10, get $10" framing).

---

## 7. Weekly cadence (repeatable checklist)

- [ ] Post 2–3 times in local homeowner groups (rotate the offer + a tip).
- [ ] Restock/print flyers at 3 new handyman-traffic locations.
- [ ] DM 10 handymen found on local trade groups/Craigslist with their signup link.
- [ ] Publish 1 SEO blog post tied to a feature.
- [ ] Ask every newly-activated user to share their referral link.
- [ ] Review metrics (below) and double down on the best channel.

---

## 8. Metrics to track

- Signups by role and by **source** (use UTM params on links, e.g. `?role=handyman&utm_source=flyer_hardwarestore`).
- **Activation rate**: % of signups that reach stage 4.
- Promo redemptions remaining (`HAPPYHOMEOWNER` counter).
- Referral signups and credits issued.
- Channel cost vs. activated users (flyers printed → scans → activations).

> Tip: add `utm_source` / `utm_campaign` params to any link. They don't affect the deep-link behavior and help you see which channel actually converts.
