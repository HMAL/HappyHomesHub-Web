import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Public disposable-email checker → proxies checkdisposable.email so the API key
// stays server-side. Called during signup (before a session exists), so no auth.
// CORS-restricted to the same origin allowlist as the contact form.
//
// FAIL OPEN: any error, timeout, missing key, or non-2xx upstream response returns
// { disposable: false } so a real user is never blocked by the checker being down.
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

const CDE_KEY = Deno.env.get('CDE_KEY');

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const { email } = await req.json();

    // Bad shape → let the frontend's own format validation handle it; don't block.
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email))) {
      return json({ disposable: false });
    }

    // No key configured yet → feature is inert (fail open), like RESEND_API_KEY in contact.
    if (!CDE_KEY) return json({ disposable: false });

    const res = await fetch(
      `https://api.checkdisposable.email/v1/check?email=${encodeURIComponent(String(email))}`,
      { headers: { Authorization: `Bearer ${CDE_KEY}` }, signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) return json({ disposable: false }); // 401/429/502/… → fail open

    const data = await res.json();
    const disposable = data?.is_disposable === true;

    // Best-effort audit of blocked attempts; never throws.
    if (disposable) {
      const url = Deno.env.get('SUPABASE_URL');
      const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (url && key) {
        const ip = req.headers.get('cf-connecting-ip')
          ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          ?? null;
        createClient(url, key).from('abuse_log').insert({
          event: 'disposable_blocked', ip, user_agent: req.headers.get('user-agent'),
          meta: { fn: 'check-disposable-email', email },
        }).then(() => {}, () => {});
      }
    }

    return json({ disposable });
  } catch (err) {
    console.error('check-disposable-email error:', err);
    return json({ disposable: false }); // incl. timeout / network failure → fail open
  }
});
