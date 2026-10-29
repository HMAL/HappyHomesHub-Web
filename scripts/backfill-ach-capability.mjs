// One-time backfill: request the us_bank_account_ach_payments capability on
// every existing Stripe Connect account, so tenants/landlords can pay those
// recipients by bank (ACH) — new accounts request it during onboarding
// (connect-onboard). Existing accounts may be asked by Stripe for extra info;
// the account.updated webhook flips users.connect_ach_enabled when the
// capability goes active, so pay-rent/pay-handyman only offer ACH once it's live.
//
// Usage:  STRIPE_SECRET_KEY=sk_... node scripts/backfill-ach-capability.mjs
//         (add --dry-run to only list accounts)

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error('Set STRIPE_SECRET_KEY (the platform secret key).');
  process.exit(1);
}
const dryRun = process.argv.includes('--dry-run');

async function stripeGet(path) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error?.message ?? `GET ${path} failed`);
  return body;
}

async function stripePost(path, params) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error?.message ?? `POST ${path} failed`);
  return body;
}

let startingAfter = null;
let updated = 0, skipped = 0, failed = 0;

do {
  const query = `/accounts?limit=100${startingAfter ? `&starting_after=${startingAfter}` : ''}`;
  const page = await stripeGet(query);

  for (const account of page.data) {
    const current = account.capabilities?.us_bank_account_ach_payments;
    if (current === 'active' || current === 'pending') {
      skipped++;
      continue;
    }
    if (dryRun) {
      console.log(`[dry-run] would request ACH on ${account.id} (${account.email ?? 'no email'})`);
      continue;
    }
    try {
      await stripePost(`/accounts/${account.id}/capabilities/us_bank_account_ach_payments`, { requested: 'true' });
      updated++;
      console.log(`requested ACH on ${account.id}`);
    } catch (err) {
      failed++;
      console.error(`FAILED ${account.id}: ${err.message}`);
    }
  }

  startingAfter = page.has_more ? page.data[page.data.length - 1].id : null;
} while (startingAfter);

console.log(`Done. requested=${updated} already-enabled/pending=${skipped} failed=${failed}`);
