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

    // RLS-scoped client for DB queries (carries the caller's JWT to PostgREST).
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

    const { rent_payment_id: bodyPaymentId, advance, success_url, cancel_url } = await req.json();
    if (!bodyPaymentId && !advance) return json({ error: 'rent_payment_id is required' }, 400);

    let rent_payment_id = bodyPaymentId as string | null;

    // Advance payment: the tenant pays the next month before the landlord (or the
    // monthly scheduler) has generated the charge. Create the pending row for
    // their own tenancy under their RLS, then check out as usual.
    if (!rent_payment_id) {
      const { data: tenancy } = await supabase
        .from('tenancies')
        .select('id, monthly_rent')
        .eq('tenant_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      if (!tenancy) return json({ error: 'No active tenancy found' }, 404);

      const { data: existing } = await supabase
        .from('rent_payments')
        .select('id, due_date, status')
        .eq('tenancy_id', tenancy.id)
        .order('due_date', { ascending: false });

      const open = (existing ?? []).find((p) => ['pending', 'late'].includes(p.status));
      if (open) {
        // Something is already due — pay that instead of skipping ahead.
        rent_payment_id = open.id as string;
      } else {
        // First of the month after the latest record; this month if none exist.
        const latest = existing?.[0]?.due_date as string | undefined;
        const base = latest ? new Date(latest + 'T00:00:00Z') : new Date();
        const next = new Date(Date.UTC(
          base.getUTCFullYear(),
          latest ? base.getUTCMonth() + 1 : base.getUTCMonth(),
          1,
        ));
        const dueDate = next.toISOString().slice(0, 10);
        const { data: created, error: createErr } = await supabase
          .from('rent_payments')
          .insert({
            tenancy_id: tenancy.id,
            amount: tenancy.monthly_rent,
            status: 'pending',
            due_date: dueDate,
            created_by: user.id,
            updated_by: user.id,
          })
          .select('id')
          .single();
        if (createErr || !created) {
          return json({ error: createErr?.message ?? 'Could not create the advance rent charge' }, 500);
        }
        rent_payment_id = created.id as string;
      }
    }

    // Load rent payment + tenancy + property (incl. landlord) under the tenant's RLS.
    const { data: payment, error: payErr } = await supabase
      .from('rent_payments')
      .select('*, tenancy:tenancy_id(monthly_rent, property:property_id(address_line1, city, state, landlord_id))')
      .eq('id', rent_payment_id)
      .single();

    if (payErr || !payment) return json({ error: 'Payment not found' }, 404);
    if (payment.status === 'paid') {
      return json({ error: 'This rent payment is already paid.', code: 'already_paid' }, 409);
    }
    if (payment.status === 'processing') {
      // An ACH debit is already in flight for this month; starting a second
      // checkout would double-charge once both settle.
      return json({ error: 'A bank payment is already processing for this month.', code: 'payment_processing' }, 409);
    }

    const property = (payment.tenancy as {
      property: { address_line1: string; city: string; state: string; landlord_id: string };
    }).property;

    // Look up the landlord's Connect account with the service role (the tenant
    // can't read the landlord row under RLS).
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: landlord } = await admin
      .from('users')
      .select('stripe_connect_account_id, connect_charges_enabled, connect_ach_enabled')
      .eq('id', property.landlord_id)
      .single();

    const destination = landlord?.stripe_connect_account_id as string | null;
    if (!destination || !landlord?.connect_charges_enabled) {
      // Rent must flow end-to-end to the landlord; block card payment until they
      // finish payout setup. The UI shows a friendly message for this code.
      return json({ error: 'Your landlord has not set up rent payouts yet.', code: 'landlord_not_onboarded' }, 409);
    }

    const description = `Rent payment — ${property.address_line1}, ${property.city}, ${property.state}`;
    const amountCents = Math.round(Number(payment.amount) * 100);

    // A per-landlord-account Customer lets the tenant save their card/bank in
    // Checkout and reuse it for next month's rent with one click.
    const { data: me } = await admin.from('users').select('full_name').eq('id', user.id).single();
    const customerId = await getOrCreateConnectCustomer(admin, stripe, {
      userId: user.id,
      email: user.email,
      name: me?.full_name as string | null,
      connectAccountId: destination,
    });

    // Direct charge: the Checkout Session is created ON the landlord's connected
    // account, so the tenant pays the landlord directly and the rent never enters
    // the platform balance. The landlord is the merchant of record (their name on
    // the statement; they own refunds/disputes). No application_fee_amount → the
    // platform takes $0. Note: this fires checkout.session.completed as a
    // *connected-account* event (event.account = landlord) on the webhook, and
    // ACH payments settle later via checkout.session.async_payment_succeeded.
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      ...paymentMethodParams(!!landlord?.connect_ach_enabled),
      customer: customerId,
      saved_payment_method_options: { payment_method_save: 'enabled' },
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: { name: 'Rent Payment', description },
        },
        quantity: 1,
      }],
      metadata: { rent_payment_id, tenant_id: user.id },
      success_url: success_url ?? `${req.headers.get('origin')}/tenant/rent?paid=1`,
      cancel_url: cancel_url ?? `${req.headers.get('origin')}/tenant/rent`,
    }, { stripeAccount: destination });

    await supabase
      .from('rent_payments')
      .update({ stripe_session_id: session.id })
      .eq('id', rent_payment_id);

    return json({ url: session.url });
  } catch (err) {
    console.error('pay-rent error:', err);
    return json({ error: (err as Error).message }, 500);
  }
});
