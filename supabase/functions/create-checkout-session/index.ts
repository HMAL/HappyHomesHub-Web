import Stripe from 'https://esm.sh/stripe@16?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-11-20.acacia',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',').map((o) => o.trim()).filter(Boolean);

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] ?? '';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

// Two tiers, billed per property. The launch coupon credits the LANDLORD base
// ($7), so it nets $0 on Landlord and $3 on Super.
const LANDLORD_PRICE_CENTS = 700;
const amountFor = (tier: string) => (tier === 'super' ? 10 : 7);

// Resolve the recurring Stripe Price for a tier. Prefers the STRIPE_PRICE_*
// env secrets; otherwise finds (or creates) the price by a stable lookup_key,
// so checkout keeps working even when the secrets aren't configured.
const PRICE_LOOKUP: Record<string, string> = { super: 'hhh_super_monthly', landlord: 'hhh_landlord_monthly' };
const PRICE_CENTS: Record<string, number> = { super: 1000, landlord: LANDLORD_PRICE_CENTS };
const priceCache: Record<string, string> = {};

async function priceFor(tier: string): Promise<string> {
  const envId = tier === 'super' ? Deno.env.get('STRIPE_PRICE_SUPER') : Deno.env.get('STRIPE_PRICE_LANDLORD');
  if (envId) return envId;
  if (priceCache[tier]) return priceCache[tier];
  const lookupKey = PRICE_LOOKUP[tier] ?? PRICE_LOOKUP.landlord;
  const found = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  let id = found.data[0]?.id;
  if (!id) {
    const price = await stripe.prices.create({
      lookup_key: lookupKey,
      currency: 'usd',
      unit_amount: PRICE_CENTS[tier] ?? LANDLORD_PRICE_CENTS,
      recurring: { interval: 'month' },
      product_data: {
        name: tier === 'super'
          ? 'HappyHomesHub Super Landlord (per property)'
          : 'HappyHomesHub Landlord (per property)',
      },
    });
    id = price.id;
  }
  priceCache[tier] = id;
  return id;
}

const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

// A stable fingerprint for a landlord, used to grant the Super trial only once per
// real person regardless of how many accounts they create. Combines their
// demographics (name + phone) with their first property's address.
async function trialFingerprint(landlordId: string): Promise<string | null> {
  const [{ data: user }, { data: prop }] = await Promise.all([
    supabase.from('users').select('full_name, phone').eq('id', landlordId).maybeSingle(),
    supabase.from('properties').select('address_line1, zip').eq('landlord_id', landlordId)
      .order('created_at', { ascending: true }).limit(1).maybeSingle(),
  ]);
  if (!user) return null;
  return `${norm(user.full_name)}|${norm(user.phone)}|${norm(prop?.address_line1)}${norm(prop?.zip)}`;
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    // Require an authenticated caller and act ONLY on their own landlord account —
    // never trust a landlord_id from the request body.
    // Validate the caller's JWT explicitly. Don't set a global authorization
    // header on this client: combined with getUser(jwt) it produces duplicate
    // Authorization headers that the API gateway rejects.
    const authHeader = req.headers.get('authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authErr } = await anon.auth.getUser(jwt);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { property_count, customer_email, promo_code, success_url, cancel_url } = body;
    const landlord_id = user.id; // authoritative — ignore any client-supplied id
    const action: string = body.action ?? 'checkout';
    const tier: string = body.tier === 'super' ? 'super' : 'landlord';

    // ── Upgrade / downgrade an existing subscription (the "$3 steal") ──────────
    if (action === 'switch_tier') {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('stripe_subscription_id')
        .eq('landlord_id', landlord_id)
        .maybeSingle();
      if (!sub?.stripe_subscription_id) {
        return new Response(JSON.stringify({ error: 'No active subscription to switch.' }), {
          status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }
      const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id as string);
      const item = stripeSub.items.data[0];
      await stripe.subscriptions.update(sub.stripe_subscription_id as string, {
        items: [{ id: item.id, price: await priceFor(tier) }],
        proration_behavior: 'create_prorations',
      });
      // Reflect immediately; the customer.subscription.updated webhook also syncs.
      await supabase.from('subscriptions')
        .update({ tier, amount_per_property: amountFor(tier) })
        .eq('landlord_id', landlord_id);
      await supabase.from('users').update({ is_premium: tier === 'super' }).eq('id', landlord_id);
      return new Response(JSON.stringify({ switched: true, tier }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const totalProps = Math.max(property_count ?? 1, 1);

    // Validate any promo code.
    let freeUnits = 0;
    let appliedPromo: string | null = null;
    let freeMonths = 0;
    if (promo_code) {
      const { data: promo } = await supabase
        .from('promo_codes')
        .select('code, discount_type, discount_value, max_uses, used_count, expires_at, active')
        .eq('code', String(promo_code).trim().toUpperCase())
        .maybeSingle();

      const valid =
        promo &&
        promo.active &&
        promo.used_count < promo.max_uses &&
        (!promo.expires_at || new Date(promo.expires_at) > new Date());

      if (!valid) {
        return new Response(JSON.stringify({ error: 'Promo code is invalid, expired, or fully redeemed.' }), {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }
      appliedPromo = promo.code;
      if (promo.discount_type === 'first_property_free') {
        freeUnits = 1;
      } else if (promo.discount_type === 'free_months') {
        freeMonths = Math.max(0, Math.round(Number(promo.discount_value) || 0));
      }
    }

    // free_months coupon: credit one property's LANDLORD base ($7) for N months.
    // On Landlord that nets $0; on Super, $3. Reuse a deterministic coupon.
    const discounts: { coupon: string }[] = [];
    if (freeMonths > 0) {
      const couponId = `hhh_${LANDLORD_PRICE_CENTS}off_${freeMonths}mo`;
      try {
        await stripe.coupons.retrieve(couponId);
      } catch {
        await stripe.coupons.create({
          id: couponId,
          amount_off: LANDLORD_PRICE_CENTS,
          currency: 'usd',
          duration: 'repeating',
          duration_in_months: freeMonths,
          name: `1 property credit for ${freeMonths} months`,
        });
      }
      discounts.push({ coupon: couponId });
    }

    const billable = totalProps - freeUnits;

    // The 3-month free trial is a SUPER-tier perk, granted only to a new landlord
    // (no existing subscription) whose fingerprint hasn't claimed one — and only
    // when no coupon is applied (the coupon is the alternative entry path).
    let trialDays = 0;
    let fingerprint: string | null = null;
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('landlord_id')
      .eq('landlord_id', landlord_id)
      .maybeSingle();
    if (tier === 'super' && !appliedPromo && !existingSub) {
      fingerprint = await trialFingerprint(landlord_id);
      if (fingerprint) {
        const { data: prior } = await supabase
          .from('trial_redemptions')
          .select('fingerprint')
          .eq('fingerprint', fingerprint)
          .maybeSingle();
        if (!prior) trialDays = 90;
      }
    }

    // Fully covered by a first_property_free promo on a single property: record a
    // free subscription directly (no Stripe charge) and burn the redemption.
    if (billable <= 0) {
      await supabase.from('subscriptions').upsert(
        {
          landlord_id,
          property_count: totalProps,
          amount_per_property: amountFor(tier),
          tier,
          promo_code: appliedPromo,
          free_property_units: freeUnits,
          status: 'active',
        },
        { onConflict: 'landlord_id' },
      );
      await supabase.from('users').update({ is_premium: tier === 'super' }).eq('id', landlord_id);
      if (appliedPromo) {
        await supabase.rpc('increment_promo_usage', { p_code: appliedPromo });
      }
      return new Response(JSON.stringify({ url: success_url, free: true }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email,
      line_items: [{ price: await priceFor(tier), quantity: billable }],
      ...(discounts.length ? { discounts } : {}),
      metadata: {
        landlord_id,
        tier,
        promo_code: appliedPromo ?? '',
        free_property_units: String(freeUnits),
        trial_fingerprint: trialDays > 0 ? (fingerprint ?? '') : '',
      },
      subscription_data: {
        ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
        metadata: {
          landlord_id,
          tier,
          promo_code: appliedPromo ?? '',
          free_property_units: String(freeUnits),
        },
      },
      success_url,
      cancel_url,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('create-checkout-session error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
