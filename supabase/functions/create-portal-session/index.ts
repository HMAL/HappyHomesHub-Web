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

// Only allow returning to one of our own origins (defence against an open redirect
// via return_url). Falls back to the first allowed origin.
function safeReturnUrl(url: unknown): string {
  const base = ALLOWED_ORIGINS[0] ?? '';
  if (typeof url !== 'string') return base;
  try {
    const u = new URL(url);
    return ALLOWED_ORIGINS.includes(u.origin) ? url : base;
  } catch {
    return base;
  }
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    // Authenticate the caller and resolve THEIR Stripe customer id server-side —
    // never trust a customer_id from the request body (that would let anyone open
    // another customer's billing portal).
    // Validate the caller's JWT explicitly. Don't set a global authorization
    // header on this client: combined with getUser(jwt) it produces duplicate
    // Authorization headers that the API gateway rejects.
    const authHeader = req.headers.get('authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authErr } = await anon.auth.getUser(jwt);
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

    const { return_url } = await req.json();

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: sub } = await admin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('landlord_id', user.id)
      .maybeSingle();

    if (!sub?.stripe_customer_id) return json({ error: 'No billing account found.' }, 404);

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id as string,
      return_url: safeReturnUrl(return_url),
    });

    return json({ url: session.url });
  } catch (err) {
    console.error('create-portal-session error:', err);
    return json({ error: (err as Error).message }, 500);
  }
});
