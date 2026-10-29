// Shared helpers for the 1-to-1 payment functions (pay-rent, pay-handyman).
// Both flows are direct charges on the recipient's Connect account: the payer
// pays the recipient directly, funds never enter the platform balance, and the
// platform takes $0.
import Stripe from 'https://esm.sh/stripe@16?target=deno';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Direct charges put the Stripe Customer on the *connected* account, so each
 * payer gets one Customer per recipient account. Resolve (or create) that
 * Customer and remember it in stripe_customers so saved payment methods show
 * up on the payer's next Checkout for the same recipient.
 */
export async function getOrCreateConnectCustomer(
  admin: SupabaseClient,
  stripe: Stripe,
  opts: { userId: string; email?: string | null; name?: string | null; connectAccountId: string },
): Promise<string> {
  const { data: existing } = await admin
    .from('stripe_customers')
    .select('stripe_customer_id')
    .eq('user_id', opts.userId)
    .eq('connect_account_id', opts.connectAccountId)
    .maybeSingle();
  if (existing?.stripe_customer_id) return existing.stripe_customer_id as string;

  const customer = await stripe.customers.create({
    email: opts.email ?? undefined,
    name: opts.name ?? undefined,
    metadata: { platform_user_id: opts.userId },
  }, { stripeAccount: opts.connectAccountId });

  // Two concurrent checkouts can race; the PK rejects the second insert and we
  // use whichever row won.
  const { error } = await admin.from('stripe_customers').insert({
    user_id: opts.userId,
    connect_account_id: opts.connectAccountId,
    stripe_customer_id: customer.id,
  });
  if (error) {
    const { data: winner } = await admin
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('user_id', opts.userId)
      .eq('connect_account_id', opts.connectAccountId)
      .maybeSingle();
    if (winner?.stripe_customer_id) return winner.stripe_customer_id as string;
  }
  return customer.id;
}

/**
 * Checkout payment-method params. ACH (us_bank_account) is only offered when
 * the recipient's connected account has the capability active — older accounts
 * onboarded before ACH was requested fall back to card-only.
 */
export function paymentMethodParams(achEnabled: boolean): Pick<
  Stripe.Checkout.SessionCreateParams,
  'payment_method_types' | 'payment_method_options'
> {
  if (!achEnabled) return { payment_method_types: ['card'] };
  return {
    payment_method_types: ['card', 'us_bank_account'],
    // 'automatic' = instant bank login (Financial Connections) when the bank
    // supports it, micro-deposit verification otherwise. Stripe hosts both.
    payment_method_options: { us_bank_account: { verification_method: 'automatic' } },
  };
}
