// Generates pending rent_payment records for all active tenancies with
// auto_rent_enabled = true, for the current calendar month.
// Skips if a record already exists for that tenancy + month.
//
// Deploy as a Supabase scheduled function or trigger via cron on the 1st of each month.
// Can also be called manually from the landlord rent page.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  // Cron-only: this runs globally with the service role, so only the scheduler
  // (which presents the service-role key as a bearer token) may invoke it.
  if (req.headers.get('authorization') !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const dueDate = `${year}-${month}-01`;

  try {
    // Load all active tenancies with auto-rent enabled
    const { data: tenancies, error: tErr } = await supabase
      .from('tenancies')
      .select('id, monthly_rent, tenant_id')
      .eq('status', 'active')
      .eq('auto_rent_enabled', true);

    if (tErr) throw tErr;
    if (!tenancies || tenancies.length === 0) {
      return new Response(JSON.stringify({ created: 0, skipped: 0 }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    let created = 0;
    let skipped = 0;

    for (const t of tenancies) {
      // Check if a record already exists for this tenancy + month
      const { count } = await supabase
        .from('rent_payments')
        .select('id', { count: 'exact' })
        .eq('tenancy_id', t.id)
        .eq('due_date', dueDate);

      if ((count ?? 0) > 0) { skipped++; continue; }

      const { error: insertErr } = await supabase.from('rent_payments').insert({
        tenancy_id: t.id,
        amount: t.monthly_rent,
        status: 'pending',
        due_date: dueDate,
        created_by: t.tenant_id,
        updated_by: t.tenant_id,
      });

      if (insertErr) {
        console.error(`Failed to create rent for tenancy ${t.id}:`, insertErr.message);
      } else {
        created++;
      }
    }

    return new Response(JSON.stringify({ created, skipped }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('generate-monthly-rent error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
