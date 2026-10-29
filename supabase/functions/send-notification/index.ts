// Send transactional email notifications via Resend.
// Env vars required: RESEND_API_KEY, NOTIFICATION_FROM_EMAIL (e.g. noreply@happyhomeshub.com)
//
// Payload shape:
//   { to: string, subject: string, html: string }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FROM = Deno.env.get('NOTIFICATION_FROM_EMAIL') ?? 'HappyHomesHub <noreply@happyhomeshub.com>';
const RESEND_KEY = Deno.env.get('RESEND_API_KEY');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  if (!RESEND_KEY) {
    console.warn('RESEND_API_KEY not set — skipping email');
    return new Response(JSON.stringify({ skipped: true }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  try {
    const { to, subject, html } = await req.json();
    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: 'to, subject, and html are required' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });

    const body = await res.json();
    if (!res.ok) {
      console.error('Resend error:', body);
      return new Response(JSON.stringify({ error: body }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ sent: true, id: body.id }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-notification error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
