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
    // Verify the landlord from the JWT.
    // Validate the caller's JWT explicitly. Don't set a global authorization
    // header on this client: combined with getUser(jwt) it produces duplicate
    // Authorization headers that the API gateway rejects.
    const authHeader = req.headers.get('authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authErr } = await anon.auth.getUser(jwt);
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

    const { return_url, refresh_url } = await req.json();
    if (!return_url || !refresh_url) return json({ error: 'return_url and refresh_url are required' }, 400);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Reuse an existing Connect account or create a new Express one.
    const { data: profile } = await admin
      .from('users').select('stripe_connect_account_id, email').eq('id', user.id).single();

    let accountId = profile?.stripe_connect_account_id as string | null;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: profile?.email ?? user.email,
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
          // Lets payers use a bank account (ACH debit) — 0.8% capped at $5,
          // far cheaper than card fees on rent-sized amounts.
          us_bank_account_ach_payments: { requested: true },
        },
        business_type: 'individual',
        metadata: { landlord_id: user.id },
      });
      accountId = account.id;
      await admin.from('users').update({ stripe_connect_account_id: accountId }).eq('id', user.id);
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url,
      return_url,
      type: 'account_onboarding',
    });

    return json({ url: link.url });
  } catch (err) {
    console.error('connect-onboard error:', err);
    return json({ error: (err as Error).message }, 500);
  }
});
