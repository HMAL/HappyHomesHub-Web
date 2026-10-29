import Stripe from 'https://esm.sh/stripe@16?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-11-20.acacia',
  httpClient: Stripe.createFetchHttpClient(),
});

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
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    // Validate the caller's JWT explicitly. Don't set a global authorization
    // header on this client: combined with getUser(jwt) it produces duplicate
    // Authorization headers that the API gateway rejects.
    const authHeader = req.headers.get('authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authErr } = await anon.auth.getUser(jwt);
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

    const priceId = Deno.env.get('STRIPE_PREMIUM_PRICE_ID');
    if (!priceId) return json({ error: 'Premium is not configured yet.', code: 'not_configured' }, 503);

    const { success_url, cancel_url } = await req.json();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { premium_for: user.id },
      subscription_data: { metadata: { premium_for: user.id } },
      success_url: success_url ?? `${req.headers.get('origin')}/landlord/account/billing?premium=1`,
      cancel_url: cancel_url ?? `${req.headers.get('origin')}/landlord/account/billing`,
    });

    return json({ url: session.url });
  } catch (err) {
    console.error('premium-checkout error:', err);
    return json({ error: (err as Error).message }, 500);
  }
});
