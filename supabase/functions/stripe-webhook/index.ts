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

// Escape user-controlled values before embedding in notification email HTML.
const esc = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Drains a landlord's available property-month referral credits onto their Stripe
// customer balance (a negative balance auto-applies to the next invoice), then
// marks those rewards redeemed. Safe to call repeatedly — no-op without credits.
async function applyPropertyCredits(landlordId: string) {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('landlord_id', landlordId)
    .maybeSingle();
  if (!sub?.stripe_customer_id) return; // free plan / no customer yet — credit waits in the ledger

  const { data: rewards } = await supabase
    .from('referral_rewards')
    .select('id, amount_cents')
    .eq('user_id', landlordId)
    .eq('kind', 'property_month_free')
    .eq('status', 'available');
  if (!rewards?.length) return;

  const total = rewards.reduce((s, r) => s + (r.amount_cents ?? 0), 0);
  await stripe.customers.createBalanceTransaction(sub.stripe_customer_id as string, {
    amount: -total,
    currency: 'usd',
    description: 'HappyHomesHub referral credit',
  });
  await supabase
    .from('referral_rewards')
    .update({ status: 'redeemed', redeemed_at: new Date().toISOString() })
    .in('id', rewards.map((r) => r.id));
}

// ── 1-to-1 payment helpers (rent + handyman direct charges) ──────────────────
// Cards settle inside checkout.session.completed (payment_status='paid'), but
// ACH bank debits complete Checkout immediately and settle days later via
// checkout.session.async_payment_succeeded / _failed. These helpers are shared
// by both paths.

/** What instrument actually paid a session: 'card' or 'ach' (us_bank_account). */
async function derivePaymentMethod(session: Stripe.Checkout.Session, account?: string): Promise<'card' | 'ach'> {
  try {
    if (!session.payment_intent) return 'card';
    const pi = await stripe.paymentIntents.retrieve(
      session.payment_intent as string,
      { expand: ['latest_charge'] },
      account ? { stripeAccount: account } : undefined,
    );
    const type = (pi.latest_charge as Stripe.Charge | null)?.payment_method_details?.type;
    return type === 'us_bank_account' ? 'ach' : 'card';
  } catch {
    return 'card'; // best effort — the method label is informational
  }
}

async function markRentPaid(rentPaymentId: string, method: 'card' | 'ach') {
  await supabase
    .from('rent_payments')
    .update({ status: 'paid', paid_at: new Date().toISOString(), payment_method: method })
    .eq('id', rentPaymentId);

  // Notify landlord — fire-and-forget
  (async () => {
    try {
      const { data: payment } = await supabase
        .from('rent_payments')
        .select('amount, tenancy:tenancy_id(tenant_id, property:property_id(address_line1, city, landlord_id))')
        .eq('id', rentPaymentId)
        .single();

      if (!payment) return;
      const tenancy = payment.tenancy as { tenant_id: string; property: { address_line1: string; city: string; landlord_id: string } } | null;
      if (!tenancy) return;

      const [landlordRes, tenantRes] = await Promise.all([
        supabase.from('users').select('email, language').eq('id', tenancy.property.landlord_id).single(),
        supabase.from('users').select('full_name').eq('id', tenancy.tenant_id).single(),
      ]);

      if (landlordRes.data?.email) {
        const es = landlordRes.data.language === 'es';
        const methodText = method === 'ach'
          ? (es ? 'transferencia bancaria (ACH)' : 'bank transfer (ACH)')
          : (es ? 'tarjeta' : 'card');
        const amount = `$${Number(payment.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const address = esc(`${tenancy.property.address_line1}, ${tenancy.property.city}`);
        const tenantName = esc(tenantRes.data?.full_name ?? (es ? 'Tu inquilino' : 'Your tenant'));
        await supabase.functions.invoke('send-notification', {
          body: {
            to: landlordRes.data.email,
            subject: es ? `Pago de renta recibido — ${address}` : `Rent payment received — ${address}`,
            html: es
              ? `<p>Hola,</p><p><strong>${tenantName}</strong> pagó <strong>${amount}</strong> con ${methodText} por <strong>${address}</strong>.</p><p>El pago se registró automáticamente en <a href="https://app.happyhomeshub.com/landlord/rent">HappyHomesHub</a>.</p>`
              : `<p>Hi,</p><p><strong>${tenantName}</strong> paid <strong>${amount}</strong> via ${methodText} for <strong>${address}</strong>.</p><p>The payment has been automatically recorded in <a href="https://app.happyhomeshub.com/landlord/rent">HappyHomesHub</a>.</p>`,
          },
        });
      }
    } catch (_) { /* silent */ }
  })();
}

async function markHandymanPaid(requestId: string, amountTotalCents: number) {
  const amount = amountTotalCents / 100;

  const { data: mr } = await supabase
    .from('maintenance_requests')
    .update({ payout_status: 'paid', handyman_paid_at: new Date().toISOString() })
    .eq('id', requestId)
    .select('handyman_id, title, tenancy:tenancy_id(property:property_id(id, landlord_id))')
    .single();

  // Record the payout as a landlord expense linked to the request, so it
  // appears in expense tracking and the handyman's revenue view.
  const property = (mr?.tenancy as { property: { id: string; landlord_id: string } } | null)?.property;
  if (property && mr) {
    await supabase.from('expenses').insert({
      property_id: property.id,
      landlord_id: property.landlord_id,
      category: 'maintenance',
      description: `Handyman payment — ${mr.title}`,
      amount,
      expense_date: new Date().toISOString().slice(0, 10),
      maintenance_request_id: requestId,
      created_by: mr.handyman_id,
      updated_by: mr.handyman_id,
    });
  }
}

/** ACH rent debit bounced (insufficient funds, closed account…). Reopen the payment and tell the tenant. */
async function handleRentPaymentFailed(rentPaymentId: string) {
  await supabase.from('rent_payments').update({ status: 'pending' }).eq('id', rentPaymentId);
  try {
    const { data: payment } = await supabase
      .from('rent_payments')
      .select('tenancy:tenancy_id(tenant_id, property:property_id(address_line1, city))')
      .eq('id', rentPaymentId)
      .single();
    const tenancy = payment?.tenancy as { tenant_id: string; property: { address_line1: string; city: string } } | null;
    if (!tenancy) return;
    const { data: tenant } = await supabase.from('users').select('email, language').eq('id', tenancy.tenant_id).single();
    if (!tenant?.email) return;
    const es = tenant.language === 'es';
    const address = esc(`${tenancy.property.address_line1}, ${tenancy.property.city}`);
    await supabase.functions.invoke('send-notification', {
      body: {
        to: tenant.email,
        subject: es ? `Tu pago de renta no se procesó — ${address}` : `Your rent payment didn't go through — ${address}`,
        html: es
          ? `<p>Hola,</p><p>Tu pago bancario de renta por <strong>${address}</strong> no se pudo completar (por ejemplo, fondos insuficientes o una cuenta cerrada). No se realizó ningún cargo.</p><p>Por favor intenta pagar de nuevo en <a href="https://app.happyhomeshub.com/tenant/rent">HappyHomesHub</a>.</p>`
          : `<p>Hi,</p><p>Your bank payment for rent at <strong>${address}</strong> could not be completed (for example, insufficient funds or a closed account). You have not been charged.</p><p>Please try paying again in <a href="https://app.happyhomeshub.com/tenant/rent">HappyHomesHub</a>.</p>`,
      },
    });
  } catch (_) { /* silent */ }
}

/** ACH handyman-payment debit bounced. Reopen the payout and tell the landlord (the payer). */
async function handleHandymanPaymentFailed(requestId: string) {
  await supabase.from('maintenance_requests').update({ payout_status: 'none' }).eq('id', requestId);
  try {
    const { data: mr } = await supabase
      .from('maintenance_requests')
      .select('title, tenancy:tenancy_id(property:property_id(landlord_id))')
      .eq('id', requestId)
      .single();
    const landlordId = (mr?.tenancy as { property: { landlord_id: string } } | null)?.property?.landlord_id;
    if (!landlordId) return;
    const { data: landlord } = await supabase.from('users').select('email, language').eq('id', landlordId).single();
    if (!landlord?.email) return;
    const es = landlord.language === 'es';
    const title = esc(mr?.title ?? '');
    await supabase.functions.invoke('send-notification', {
      body: {
        to: landlord.email,
        subject: es ? `Tu pago al profesional no se procesó — ${title}` : `Your handyman payment didn't go through — ${title}`,
        html: es
          ? `<p>Hola,</p><p>Tu pago bancario por <strong>${title}</strong> no se pudo completar. No se realizó ningún cargo.</p><p>Por favor intenta pagar de nuevo en <a href="https://app.happyhomeshub.com/landlord/maintenance">HappyHomesHub</a>.</p>`
          : `<p>Hi,</p><p>Your bank payment for <strong>${title}</strong> could not be completed. You have not been charged.</p><p>Please try paying again in <a href="https://app.happyhomeshub.com/landlord/maintenance">HappyHomesHub</a>.</p>`,
      },
    });
  } catch (_) { /* silent */ }
}

Deno.serve(async (req) => {
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();

  // The platform has two webhook destinations with separate signing secrets:
  // one for "Your account" events (subscriptions) and one for "Connected accounts"
  // events (rent/handyman direct charges, onboarding). Verify against whichever
  // secret matches.
  const secrets = [
    Deno.env.get('STRIPE_WEBHOOK_SECRET'),
    Deno.env.get('STRIPE_WEBHOOK_SECRET_CONNECT'),
  ].filter((s): s is string => !!s);

  let event: Stripe.Event | null = null;
  for (const secret of secrets) {
    try {
      event = await stripe.webhooks.constructEventAsync(body, sig!, secret);
      break;
    } catch {
      // try the next secret
    }
  }
  if (!event) {
    console.error('Webhook signature verification failed for all configured secrets');
    return new Response('Webhook signature verification failed', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        // ── Applicant screening package ($50 capped / $70 unlimited, one-time) ─
        if (session.metadata?.screening_type === 'transunion_smartcheck') {
          const applicantId = session.metadata.applicant_id;
          const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
          // '' / missing metadata = unlimited tier; otherwise the numeric cap (10).
          const limitRaw = session.metadata.application_limit;
          const applicationLimit = limitRaw ? Number(limitRaw) : null;

          const { data: insertedReport } = await supabase.from('screening_reports').insert({
            applicant_id: applicantId,
            stripe_session_id: session.id,
            stripe_payment_intent_id: session.payment_intent as string ?? null,
            amount_paid: session.amount_total ?? 5000,
            application_limit: applicationLimit,
            report_status: 'pending',
            expires_at: expiresAt,
          }).select('id').single();

          // Redeem any referral screening-discount credits that were applied to
          // this checkout (their ids were passed through in metadata).
          const discountIds = (session.metadata.discount_reward_ids ?? '')
            .split(',').map((s) => s.trim()).filter(Boolean);
          if (discountIds.length) {
            await supabase
              .from('referral_rewards')
              .update({ status: 'redeemed', redeemed_at: new Date().toISOString() })
              .in('id', discountIds);
          }

          // Referral reward: this applicant's screening purchase qualifies their
          // referral. Both parties get a $10 screening discount for next time.
          await supabase.rpc('qualify_referral', {
            p_referee: applicantId, p_kind: 'screening_discount', p_amount: 1000,
          });

          // Try to place the order automatically via the TransUnion connector. It
          // no-ops (ordered: false) when credentials aren't configured yet, in which
          // case we fall back to the manual admin email below.
          let autoOrdered = false;
          if (insertedReport?.id) {
            try {
              const { data: orderRes } = await supabase.functions.invoke('screening-order', {
                body: { reportId: insertedReport.id },
              });
              autoOrdered = (orderRes as { ordered?: boolean } | null)?.ordered === true;
            } catch (err) {
              console.error('screening-order invoke failed:', err);
            }
          }

          // Manual fallback: notify admin to initiate the SmartCheck order by hand.
          if (!autoOrdered) {
            await supabase.functions.invoke('send-notification', {
              body: {
                to: 'homemadeappsllc@gmail.com',
                subject: `New screening order — applicant ${applicantId}`,
                html: `<p>A new screening package was purchased.</p>
                       <p><strong>Applicant ID:</strong> ${applicantId}</p>
                       <p><strong>Stripe Session:</strong> ${session.id}</p>
                       <p><strong>Tier:</strong> ${applicationLimit ? `Capped (${applicationLimit} applications)` : 'Unlimited'}</p>
                       <p><strong>Amount:</strong> $${((session.amount_total ?? 5000) / 100).toFixed(2)}</p>
                       <p>Log into TransUnion SmartCheck and invite this applicant to complete their report. Then update the record in Supabase.</p>`,
              },
            });
          }
          break;
        }

        // ── Handyman payment (one-time) ──────────────────────────────────────
        if (session.metadata?.handyman_payment_request_id) {
          const requestId = session.metadata.handyman_payment_request_id;
          if (session.payment_status === 'paid') {
            await markHandymanPaid(requestId, session.amount_total ?? 0);
          } else {
            // ACH debit initiated; async_payment_succeeded/_failed finishes it.
            await supabase.from('maintenance_requests')
              .update({ payout_status: 'processing' })
              .eq('id', requestId);
          }
          break;
        }

        // ── Rent payment (one-time) ──────────────────────────────────────────
        if (session.metadata?.rent_payment_id) {
          const rentPaymentId = session.metadata.rent_payment_id;
          const method = await derivePaymentMethod(session, event.account);
          if (session.payment_status === 'paid') {
            await markRentPaid(rentPaymentId, method);
          } else {
            // ACH debit initiated — the tenant is done, but settlement takes a
            // few business days; async_payment_succeeded/_failed finishes it.
            await supabase
              .from('rent_payments')
              .update({ status: 'processing', payment_method: method })
              .eq('id', rentPaymentId);
          }
          break;
        }

        // ── Premium ("Real" tier) subscription ───────────────────────────────
        if (session.metadata?.premium_for && session.subscription) {
          await supabase
            .from('users')
            .update({ is_premium: true, stripe_premium_subscription_id: session.subscription as string })
            .eq('id', session.metadata.premium_for);
          break;
        }

        // ── Landlord subscription (recurring) ────────────────────────────────
        const landlord_id = session.metadata?.landlord_id;
        if (!landlord_id || !session.subscription || !session.customer) break;

        const sub = await stripe.subscriptions.retrieve(session.subscription as string);

        // Per-property billing across two tiers. A promo may free some property
        // units (e.g. first_property_free), which aren't billed by Stripe but still
        // count toward property_count. Tier is derived from the price the customer
        // actually subscribed to (Super → is_premium → SMS + long retention),
        // matched by env id or the stable lookup_key checkout falls back to.
        const superPrice = Deno.env.get('STRIPE_PRICE_SUPER');
        const tier = sub.items.data.some((i) =>
          (superPrice && i.price?.id === superPrice) || i.price?.lookup_key === 'hhh_super_monthly'
        ) ? 'super' : 'landlord';
        const freeUnits = Number(session.metadata?.free_property_units ?? '0') || 0;
        const promoCode = session.metadata?.promo_code || null;
        const billedQty = sub.items.data.reduce((s, i) => s + (i.quantity ?? 0), 0);
        await supabase.from('subscriptions').upsert(
          {
            landlord_id,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: sub.id,
            property_count: billedQty + freeUnits,
            amount_per_property: tier === 'super' ? 10 : 7,
            tier,
            promo_code: promoCode,
            free_property_units: freeUnits,
            status: sub.status,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          },
          { onConflict: 'landlord_id' },
        );

        // Burn one promo redemption now that checkout succeeded (not at validation,
        // so abandoned checkouts don't consume a code).
        if (promoCode) {
          await supabase.rpc('increment_promo_usage', { p_code: promoCode });
        }

        // is_premium tracks the Super tier → unlocks SMS, long photo retention,
        // expenses, in-app payouts and analytics.
        await supabase.from('users').update({ is_premium: tier === 'super' }).eq('id', landlord_id);

        // Record the trial fingerprint so this person can't claim another free
        // trial from a second account.
        const fingerprint = session.metadata?.trial_fingerprint;
        if (fingerprint) {
          await supabase.from('trial_redemptions')
            .upsert({ fingerprint, landlord_id }, { onConflict: 'fingerprint' });
        }

        // Landlord referrals qualify on activation (property + tenant added), not
        // here. But now that this landlord has a Stripe customer, push any property
        // referral credits they've already earned onto their balance.
        await applyPropertyCredits(landlord_id);
        break;
      }

      // ── ACH settlement (rent + handyman payments) ────────────────────────
      // Bank debits complete Checkout right away but settle days later. These
      // connected-account events deliver the final outcome.
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.rent_payment_id) {
          await markRentPaid(session.metadata.rent_payment_id, 'ach');
        } else if (session.metadata?.handyman_payment_request_id) {
          await markHandymanPaid(session.metadata.handyman_payment_request_id, session.amount_total ?? 0);
        }
        break;
      }

      case 'checkout.session.async_payment_failed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.rent_payment_id) {
          await handleRentPaymentFailed(session.metadata.rent_payment_id);
        } else if (session.metadata?.handyman_payment_request_id) {
          await handleHandymanPaymentFailed(session.metadata.handyman_payment_request_id);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const freeUnits = Number(sub.metadata?.free_property_units ?? '0') || 0;
        const billedQty = sub.items.data.reduce((s, i) => s + (i.quantity ?? 0), 0);
        // Re-derive tier from the current price (handles upgrade/downgrade switches),
        // matched by env id or the stable lookup_key checkout falls back to.
        const superPrice = Deno.env.get('STRIPE_PRICE_SUPER');
        const tier = sub.items.data.some((i) =>
          (superPrice && i.price?.id === superPrice) || i.price?.lookup_key === 'hhh_super_monthly'
        ) ? 'super' : 'landlord';
        await supabase
          .from('subscriptions')
          .update({
            status: sub.status,
            tier,
            amount_per_property: tier === 'super' ? 10 : 7,
            property_count: billedQty + freeUnits,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          })
          .eq('stripe_subscription_id', sub.id);
        // is_premium = on the Super tier AND the subscription is live.
        if (sub.metadata?.landlord_id) {
          const active = sub.status === 'active' || sub.status === 'trialing';
          await supabase.from('users').update({ is_premium: active && tier === 'super' }).eq('id', sub.metadata.landlord_id);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await supabase
          .from('subscriptions')
          .update({ status: 'canceled' })
          .eq('stripe_subscription_id', sub.id);
        // Portfolio canceled → drop is_premium (disables SMS + fee-free ACH).
        if (sub.metadata?.landlord_id) {
          await supabase.from('users').update({ is_premium: false }).eq('id', sub.metadata.landlord_id);
        }
        // Also handle the standalone Premium subscription path (Epic 5), if used.
        await supabase
          .from('users')
          .update({ is_premium: false, stripe_premium_subscription_id: null })
          .eq('stripe_premium_subscription_id', sub.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          await supabase
            .from('subscriptions')
            .update({ status: 'past_due' })
            .eq('stripe_subscription_id', invoice.subscription as string);
        }
        break;
      }

      // On each successful invoice, sweep any referral credits the landlord has
      // earned onto their balance so they auto-apply to the next cycle. This is
      // how an already-subscribed referrer's credit gets delivered.
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const { data: sub } = await supabase
            .from('subscriptions')
            .select('landlord_id')
            .eq('stripe_subscription_id', invoice.subscription as string)
            .maybeSingle();
          if (sub?.landlord_id) await applyPropertyCredits(sub.landlord_id as string);
        }
        break;
      }

      // Keep the landlord's Connect onboarding state in sync so pay-rent can
      // trust connect_charges_enabled without calling Stripe on every payment.
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        await supabase
          .from('users')
          .update({
            connect_charges_enabled: account.charges_enabled,
            connect_payouts_enabled: account.payouts_enabled,
            // Offer bank-account (ACH) payment only once the capability is live
            // on the recipient's account (pay-rent/pay-handyman read this flag).
            connect_ach_enabled: account.capabilities?.us_bank_account_ach_payments === 'active',
          })
          .eq('stripe_connect_account_id', account.id);
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    return new Response('Internal error', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
