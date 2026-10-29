import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normalizeCallback } from '../_shared/transunion.ts';

// Public postback endpoint TransUnion calls when a screening result is ready.
// Register this function's URL as TRANSUNION_CALLBACK_URL.
//
// Authentication is twofold and both must pass:
//   1. Optional global shared secret (env TRANSUNION_CALLBACK_SECRET) sent as a
//      header — cheap rejection of random traffic.
//   2. Per-report callback_token that we generated at order time and the provider
//      echoes back — proves the postback belongs to THIS report.
// No Supabase JWT is involved (the caller is TransUnion, not a user), so deploy
// this function with --no-verify-jwt.

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const GLOBAL_SECRET = Deno.env.get('TRANSUNION_CALLBACK_SECRET') ?? '';

// Constant-time string compare to avoid leaking secrets via timing.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok');
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // 1. Global shared secret (if configured).
  if (GLOBAL_SECRET) {
    const provided = req.headers.get('x-callback-secret') ?? '';
    if (!safeEqual(provided, GLOBAL_SECRET)) return json({ error: 'Unauthorized' }, 401);
  }

  let payload: Record<string, any>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const normalized = normalizeCallback(payload);
  if (!normalized) return json({ error: 'Unrecognized payload' }, 400);

  // Match the report by the provider order id we stored at order time.
  const { data: report, error: loadErr } = await admin
    .from('screening_reports')
    .select('id, applicant_id, callback_token, report_status')
    .eq('smartmove_order_id', normalized.providerRequestId)
    .maybeSingle();
  if (loadErr || !report) return json({ error: 'Unknown request' }, 404);

  // 2. Per-report token the provider echoed back.
  const token = req.headers.get('x-callback-token')
    ?? payload.callback?.token
    ?? payload.token
    ?? '';
  if (!report.callback_token || !safeEqual(String(token), String(report.callback_token))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // Idempotent: a completed/failed report is terminal — ignore late duplicates.
  if (report.report_status === 'completed' || report.report_status === 'failed') {
    return json({ ok: true, note: 'already finalized' });
  }

  await admin
    .from('screening_reports')
    .update({
      report_status: normalized.status,
      score: normalized.score,
      recommendation: normalized.recommendation,
      report_url: normalized.reportUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', report.id);

  // Notify the applicant their report is ready (best-effort).
  if (normalized.status === 'completed') {
    try {
      const { data: authUser } = await admin.auth.admin.getUserById(report.applicant_id);
      const email = authUser?.user?.email;
      if (email) {
        await admin.functions.invoke('send-notification', {
          body: {
            to: email,
            subject: 'Your tenant screening report is ready',
            html: `<p>Your TransUnion screening report is complete and ready to share
                   with landlords on HappyHomesHub.</p>
                   <p><a href="https://app.happyhomeshub.com/tenant/screening">View my report &rarr;</a></p>`,
          },
        });
      }
    } catch { /* best-effort */ }
  }

  return json({ ok: true });
});
