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

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    // Authenticate the caller; the applicant is always the signed-in user. This
    // stops anyone from attributing a session to, or spending the referral credits
    // of, another applicant_id.
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

    const { tier, success_url, cancel_url } = await req.json();
    const applicant_id = user.id;
    const applicant_email = user.email;

    if (!applicant_email) {
      return new Response(JSON.stringify({ error: 'Account has no email' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Two tiers, both on TransUnion SmartCheck Plus, valid 90 days, reusable across
    // all landlords. 'capped' covers 10 applications; 'unlimited' has no cap.
    const isUnlimited = tier === 'unlimited';
    const baseAmount = isUnlimited ? 7000 : 5000;       // $70 / $50
    const applicationLimit = isUnlimited ? '' : '10';   // '' = unlimited (no metadata limit)
    const planLabel = isUnlimited ? 'Unlimited applications' : 'Up to 10 applications';

    // Apply any available referral screening-discount credits, keeping at least
    // Stripe's $0.50 minimum charge. Credit ids ride along in metadata and are
    // marked redeemed by the webhook once payment succeeds.
    const { data: credits } = await supabase
      .from('referral_rewards')
      .select('id, amount_cents')
      .eq('user_id', applicant_id)
      .eq('kind', 'screening_discount')
      .eq('status', 'available');
    const rawDiscount = (credits ?? []).reduce((s, c) => s + (c.amount_cents ?? 0), 0);
    const discount = Math.min(rawDiscount, baseAmount - 50);
    const unitAmount = baseAmount - Math.max(0, discount);
    const discountRewardIds = discount > 0 ? (credits ?? []).map((c) => c.id).join(',') : '';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: applicant_email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: unitAmount,
            product_data: {
              name: `Rental Application Screening — ${planLabel}`,
              description:
                'TransUnion SmartCheck Plus — credit, criminal background, eviction history & income insights. Valid for 90 days across all HappyHomesHub properties.',
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        screening_type: 'transunion_smartcheck',
        applicant_id,
        application_limit: applicationLimit,
        discount_reward_ids: discountRewardIds,
      },
      success_url,
      cancel_url,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('create-screening-session error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
