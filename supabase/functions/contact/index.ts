import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Public contact form → emails support via Resend. No auth (anyone can contact us),
// but CORS-restricted, length-limited, and honeypot-guarded against bots.
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

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM = Deno.env.get('NOTIFICATION_FROM_EMAIL') ?? 'HappyHomesHub <noreply@happyhomeshub.com>';
const SUPPORT = Deno.env.get('SUPPORT_EMAIL') ?? 'support@happyhomeshub.com';

const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!));

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  // Client IP for rate-limiting + abuse logging. Cloudflare sets cf-connecting-ip;
  // x-forwarded-for is the fallback (take the first hop).
  const ip = req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? null;
  const userAgent = req.headers.get('user-agent');
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const { name, email, message, company } = await req.json();

    // Honeypot: real users never fill the hidden "company" field.
    if (company) return json({ ok: true });

    if (!name || !email || !message) return json({ error: 'Name, email, and message are required.' }, 400);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Please enter a valid email.' }, 400);
    if (String(message).length > 5000) return json({ error: 'Message is too long.' }, 400);

    // Per-IP rate limit: 5 submissions / hour. Best-effort — never block on a
    // limiter failure.
    try {
      const { data: allowed } = await admin.rpc('rate_limit_check', {
        p_key: `contact:${ip ?? 'unknown'}`, p_limit: 5, p_window_seconds: 3600,
      });
      if (allowed === false) {
        await admin.from('abuse_log').insert({
          event: 'rate_limited', ip, user_agent: userAgent, meta: { fn: 'contact', email },
        }).then(() => {}, () => {});
        return json({ error: 'Too many messages. Please try again later.' }, 429);
      }
    } catch { /* limiter unavailable — fail open */ }

    // Audit the submission (best-effort) and optionally persist the message.
    try {
      await admin.from('abuse_log').insert({
        event: 'contact_submit', ip, user_agent: userAgent, meta: { name, email },
      });
      await admin.from('contact_messages').insert({ name, email, message });
    } catch { /* tables optional — ignore */ }

    if (!RESEND_API_KEY) {
      // No key configured yet — accept the message so the UI works; nothing sent.
      return json({ ok: true, note: 'Email not configured yet.' });
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: SUPPORT,
        reply_to: email,
        subject: `Contact form — ${esc(String(name))}`,
        html: `<p><strong>From:</strong> ${esc(String(name))} (${esc(String(email))})</p>
               <p><strong>Message:</strong></p>
               <p>${esc(String(message)).replace(/\n/g, '<br/>')}</p>`,
      }),
    });

    if (!res.ok) {
      // Surface Resend's actual rejection (unverified domain, bad key, etc.) to
      // the logs so the failure is diagnosable; keep the user-facing copy generic.
      const detail = await res.text().catch(() => '');
      console.error('Resend send failed:', res.status, detail);
      return json({ error: 'Could not send your message. Please email us directly.' }, 502);
    }
    return json({ ok: true });
  } catch (err) {
    console.error('contact error:', err);
    return json({ error: (err as Error).message }, 500);
  }
});
