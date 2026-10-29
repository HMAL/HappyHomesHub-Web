import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY');
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:support@happyhomeshub.com';
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const TWILIO_FROM = Deno.env.get('TWILIO_FROM_NUMBER');

async function sendSms(to: string, body: string) {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) return; // not configured → no-op
  const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
  const form = new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body });
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    // Require a signed-in caller (any authenticated user can trigger a notification
    // to another user as part of normal flows, e.g. status changes).
    // Validate the caller's JWT explicitly. Don't set a global authorization
    // header on this client: combined with getUser(jwt) it produces duplicate
    // Authorization headers that the API gateway rejects.
    const authHeader = req.headers.get('authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authErr } = await anon.auth.getUser(jwt);
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

    const { user_id, title, body, url, sms_body } = await req.json();
    if (!user_id || !title) return json({ error: 'user_id and title are required' }, 400);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const [{ data: prefs }, { data: recipient }, { data: subs }] = await Promise.all([
      admin.from('notification_prefs').select('*').eq('user_id', user_id).maybeSingle(),
      admin.from('users').select('is_premium, phone').eq('id', user_id).single(),
      admin.from('push_subscriptions').select('*').eq('user_id', user_id),
    ]);

    const pushEnabled = prefs?.push_enabled ?? true;
    const smsEnabled = prefs?.sms_enabled ?? false;

    // ── Web Push (free, all users) ───────────────────────────────────────────
    if (pushEnabled && VAPID_PUBLIC && VAPID_PRIVATE && subs?.length) {
      const payload = JSON.stringify({ title, body: body ?? '', url: url ?? '/' });
      await Promise.all(subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
        } catch (err) {
          // Clean up expired/invalid subscriptions.
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('id', s.id);
        }
      }));
    }

    // ── SMS (Premium benefit only) ───────────────────────────────────────────
    if (recipient?.is_premium && smsEnabled && recipient.phone) {
      await sendSms(recipient.phone, sms_body ?? `${title}${body ? ` — ${body}` : ''}`);
    }

    return json({ ok: true });
  } catch (err) {
    console.error('notify-user error:', err);
    return json({ error: (err as Error).message }, 500);
  }
});
