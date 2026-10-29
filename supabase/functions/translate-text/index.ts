import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// On-demand message translation. The client sends the original text plus the
// viewer's target language; we auto-detect the source and translate. Backed by
// the Google Cloud Translation API v2 (set GOOGLE_TRANSLATE_API_KEY). Requires a
// signed-in user so the endpoint can't be abused anonymously.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    // Validate the caller's JWT explicitly. Don't set a global authorization
    // header on this client: combined with getUser(jwt) it produces duplicate
    // Authorization headers that the API gateway rejects.
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user } } = await supabase.auth.getUser(jwt);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    // Per-user rate limit (60 translations / minute) to cap Google Translate cost
    // abuse. Uses a service-role client so the counter can't be tampered with.
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: allowed } = await admin.rpc('rate_limit_check', {
      p_key: `translate:${user.id}`, p_limit: 60, p_window_seconds: 60,
    });
    if (allowed === false) return json({ error: 'Too many requests. Please slow down.' }, 429);

    const { text, target } = await req.json();
    if (!text || typeof text !== 'string') return json({ error: 'text is required' }, 400);
    const tgt = target === 'es' ? 'es' : 'en';

    const key = Deno.env.get('GOOGLE_TRANSLATE_API_KEY');
    if (!key) return json({ error: 'Translation is not configured.' }, 503);

    const resp = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text.slice(0, 5000), target: tgt, format: 'text' }),
    });
    const data = await resp.json();
    const tr = data?.data?.translations?.[0];
    if (!tr) {
      console.error('translate-text provider error:', JSON.stringify(data));
      return json({ error: 'Translation failed.' }, 502);
    }
    return json({
      translatedText: tr.translatedText,
      detectedSourceLanguage: tr.detectedSourceLanguage ?? null,
    });
  } catch (err) {
    console.error('translate-text error:', err);
    return json({ error: (err as Error).message }, 500);
  }
});
