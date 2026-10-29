import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Restrict CORS to an explicit allowlist. Set ALLOWED_ORIGINS as a comma-separated
// list of origins (e.g. "https://app.happyhomeshub.com,https://happyhomeshub.com").
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] ?? '';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const cors = corsHeaders(origin);

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    // Require a valid session; derive the user from the verified JWT — never trust
    // a user_id from the request body.
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const anon = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );
    const { data: userData, error: userErr } = await anon.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    const user_id = userData.user.id;

    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: 'token is required' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Use service role to bypass RLS for the controlled update below.
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Find the pending invite
    const { data: invite, error: inviteErr } = await admin
      .from('invites')
      .select('id, tenancy_id')
      .eq('token', token)
      .eq('status', 'pending')
      .single();

    if (inviteErr || !invite) {
      return new Response(JSON.stringify({ error: 'Invite not found or already used' }), {
        status: 404,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Link tenant to the tenancy — status stays pending_invite until landlord approves application
    const { error: tenancyErr } = await admin
      .from('tenancies')
      .update({ tenant_id: user_id, status: 'pending_invite', updated_by: user_id })
      .eq('id', invite.tenancy_id);

    if (tenancyErr) {
      return new Response(JSON.stringify({ error: 'Failed to update tenancy: ' + tenancyErr.message }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Mark invite as accepted
    await admin
      .from('invites')
      .update({ status: 'accepted', updated_by: user_id })
      .eq('id', invite.id);

    // Ensure tenant role_assignment exists
    const { data: existing } = await admin
      .from('role_assignments')
      .select('id')
      .eq('user_id', user_id)
      .eq('role', 'tenant')
      .maybeSingle();

    if (!existing) {
      await admin.from('role_assignments').insert({
        user_id,
        role: 'tenant',
        context_id: user_id,
        context_type: 'global',
        created_by: user_id,
        updated_by: user_id,
      });
    }

    return new Response(JSON.stringify({ success: true, tenancy_id: invite.tenancy_id }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
