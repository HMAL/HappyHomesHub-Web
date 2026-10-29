import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  isConfigured,
  createScreeningOrder,
  NotConfiguredError,
} from '../_shared/transunion.ts';

// Orders a TransUnion screening report for an already-paid screening_reports row.
//
// Invoked server-to-server by stripe-webhook right after the 'pending' row is
// created. INTERNAL ONLY: the caller must present the service-role key (the webhook
// already runs as service role), so this paid external call can't be triggered by
// the public. If TransUnion isn't configured yet, this is a no-op and the webhook's
// existing manual admin email remains the fallback.

const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(Deno.env.get('SUPABASE_URL')!, SERVICE_ROLE_KEY);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok');
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Internal guard: only the service role (i.e. our own webhook) may order reports.
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (bearer !== SERVICE_ROLE_KEY) return json({ error: 'Forbidden' }, 403);

  try {
    const { reportId } = await req.json();
    if (!reportId) return json({ error: 'reportId is required' }, 400);

    const { data: report, error: loadErr } = await admin
      .from('screening_reports')
      .select('id, applicant_id, smartmove_order_id')
      .eq('id', reportId)
      .single();
    if (loadErr || !report) return json({ error: 'Report not found' }, 404);

    // Idempotent: if an order already exists, don't place another (webhook retries,
    // duplicate Stripe events).
    if (report.smartmove_order_id) {
      return json({ configured: true, ordered: false, reason: 'already_ordered' });
    }

    // No credentials yet → leave the row 'pending' for the manual flow.
    if (!isConfigured()) return json({ configured: false, ordered: false });

    // Applicant identity: name from the profile, email from auth (authoritative).
    const [{ data: profile }, { data: authUser }] = await Promise.all([
      admin.from('users').select('full_name, email').eq('id', report.applicant_id).single(),
      admin.auth.admin.getUserById(report.applicant_id),
    ]);
    const email = authUser?.user?.email ?? profile?.email;
    const fullName = profile?.full_name ?? 'Applicant';
    if (!email) return json({ error: 'Applicant has no email' }, 400);

    // Per-report secret the provider must echo back on its callback.
    const callbackToken = crypto.randomUUID();

    const { providerRequestId, inviteUrl } = await createScreeningOrder({
      reportId: report.id,
      applicantId: report.applicant_id,
      fullName,
      email,
      callbackToken,
      tier: 'unlimited', // tier doesn't change the product ordered; cap is enforced app-side
    });

    await admin
      .from('screening_reports')
      .update({
        provider: 'transunion',
        smartmove_order_id: providerRequestId,
        invite_url: inviteUrl,
        callback_token: callbackToken,
        report_status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', report.id);

    // Email the applicant their identity-verification / consent link.
    if (inviteUrl) {
      await admin.functions.invoke('send-notification', {
        body: {
          to: email,
          subject: 'Complete your tenant screening',
          html: `<p>Hi ${fullName.split(' ')[0] ?? ''},</p>
                 <p>Your screening payment was received. To finish, please complete
                 your identity verification and consent with TransUnion:</p>
                 <p><a href="${inviteUrl}">Complete my screening &rarr;</a></p>
                 <p>Your report is valid for 90 days across all HappyHomesHub
                 properties once ready.</p>`,
        },
      }).catch(() => { /* email is best-effort */ });
    }

    return json({ configured: true, ordered: true, providerRequestId });
  } catch (err) {
    if (err instanceof NotConfiguredError) return json({ configured: false, ordered: false });
    console.error('screening-order error:', err);
    return json({ error: (err as Error).message }, 500);
  }
});
