import Stripe from 'https://esm.sh/stripe@16?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getOrCreateConnectCustomer, paymentMethodParams } from '../_shared/payments.ts';

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
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    // Landlord context (their RLS lets them read their own request).
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { authorization: authHeader } } },
    );
    // Validate the JWT on a separate plain client: a global authorization header
    // combined with getUser(jwt) sends duplicate Authorization headers, which the
    // API gateway rejects.
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authErr } = await authClient.auth.getUser(jwt);
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

    const { request_id, success_url, cancel_url } = await req.json();
    if (!request_id) return json({ error: 'request_id is required' }, 400);

    // Load the request with property (to confirm the caller is the landlord) and
    // the assigned handyman.
    const { data: mr, error: mrErr } = await supabase
      .from('maintenance_requests')
      .select('id, handyman_id, title, payout_status, tenancy:tenancy_id(property:property_id(landlord_id, address_line1, city))')
      .eq('id', request_id)
      .single();
    if (mrErr || !mr) return json({ error: 'Request not found' }, 404);

    const property = (mr.tenancy as { property: { landlord_id: string; address_line1: string; city: string } }).property;
    if (property.landlord_id !== user.id) return json({ error: 'Not your request' }, 403);
    if (!mr.handyman_id) return json({ error: 'No handyman assigned to this request' }, 400);
    if (mr.payout_status === 'paid') return json({ error: 'This job is already paid', code: 'already_paid' }, 409);
    if (mr.payout_status === 'processing') {
      // An ACH debit is already settling for this job; a second checkout would
      // double-pay the handyman.
      return json({ error: 'A bank payment is already processing for this job.', code: 'payment_processing' }, 409);
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // The amount is the accepted quote for this request (server-derived, never
    // trusted from the client).
    const { data: quote } = await admin
      .from('quotes')
      .select('amount')
      .eq('request_id', request_id)
      .eq('handyman_id', mr.handyman_id)
      .eq('status', 'accepted')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!quote?.amount || Number(quote.amount) <= 0) {
      return json({ error: 'No accepted quote to pay for this job.', code: 'no_accepted_quote' }, 409);
    }

    // The handyman must have completed Connect onboarding to receive funds.
    const { data: handyman } = await admin
      .from('users')
      .select('stripe_connect_account_id, connect_charges_enabled, connect_ach_enabled, full_name')
      .eq('id', mr.handyman_id)
      .single();

    const destination = handyman?.stripe_connect_account_id as string | null;
    if (!destination || !handyman?.connect_charges_enabled) {
      return json({ error: 'This handyman has not set up payouts yet.', code: 'handyman_not_onboarded' }, 409);
    }

    const amountCents = Math.round(Number(quote.amount) * 100);

    // A per-handyman-account Customer lets the landlord save their card/bank in
    // Checkout and reuse it when paying the same pro again.
    const { data: me } = await admin.from('users').select('full_name').eq('id', user.id).single();
    const customerId = await getOrCreateConnectCustomer(admin, stripe, {
      userId: user.id,
      email: user.email,
      name: me?.full_name as string | null,
      connectAccountId: destination,
    });

    // Direct charge on the handyman's connected account: the landlord pays the
    // handyman directly, funds never enter the platform balance, platform takes $0.
    // Fires checkout.session.completed as a connected-account event (event.account
    // = handyman) on the webhook; ACH payments settle later via
    // checkout.session.async_payment_succeeded.
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      ...paymentMethodParams(!!handyman?.connect_ach_enabled),
      customer: customerId,
      saved_payment_method_options: { payment_method_save: 'enabled' },
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: {
            name: 'Handyman payment',
            description: `${mr.title} — ${property.address_line1}, ${property.city}`,
          },
        },
        quantity: 1,
      }],
      metadata: { handyman_payment_request_id: request_id, landlord_id: user.id, handyman_id: mr.handyman_id },
      success_url: success_url ?? `${req.headers.get('origin')}/landlord/maintenance?paid=1`,
      cancel_url: cancel_url ?? `${req.headers.get('origin')}/landlord/maintenance`,
    }, { stripeAccount: destination });

    await admin
      .from('maintenance_requests')
      .update({ payout_status: 'pending', payout_amount: quote.amount, payout_session_id: session.id })
      .eq('id', request_id);

    return json({ url: session.url });
  } catch (err) {
    console.error('pay-handyman error:', err);
    return json({ error: (err as Error).message }, 500);
  }
});
