import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Emails go out in each recipient's language (users.language), defaulting to English.
type Lang = 'en' | 'es';
const lang = (l: string | null | undefined): Lang => (l === 'es' ? 'es' : 'en');
const tr = (l: Lang, en: string, es: string) => (l === 'es' ? es : en);
// Escape user-controlled values (names) before embedding in email HTML.
const esc = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const today = new Date().toISOString().slice(0, 10);

    // Find pending payments that are past due
    const { data: overdue, error: fetchErr } = await supabase
      .from('rent_payments')
      .select(`
        id, amount, due_date,
        tenancy:tenancy_id(
          tenant_id,
          property:property_id(address_line1, city, landlord_id)
        )
      `)
      .eq('status', 'pending')
      .lt('due_date', today);

    if (fetchErr) throw fetchErr;
    if (!overdue || overdue.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    let notified = 0;

    for (const payment of overdue) {
      const tenancy = payment.tenancy as {
        tenant_id: string;
        property: { address_line1: string; city: string; landlord_id: string };
      } | null;
      if (!tenancy) continue;

      const [tenantRes, landlordRes] = await Promise.all([
        supabase.from('users').select('email, full_name, language').eq('id', tenancy.tenant_id).single(),
        supabase.from('users').select('email, full_name, language').eq('id', tenancy.property.landlord_id).single(),
      ]);

      const amount = `$${Number(payment.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const address = esc(`${tenancy.property.address_line1}, ${tenancy.property.city}`);
      const dueDate = esc(payment.due_date);

      // Notify tenant (in their language)
      if (tenantRes.data?.email) {
        const tl = lang(tenantRes.data.language);
        await supabase.functions.invoke('send-notification', {
          body: {
            to: tenantRes.data.email,
            subject: tr(tl, `Rent payment overdue — ${address}`, `Pago de renta atrasado — ${address}`),
            html: tr(tl,
              `<p>Hi ${esc(tenantRes.data.full_name) ?? ''},</p>
<p>Your rent payment of <strong>${amount}</strong> was due on <strong>${dueDate}</strong> and has not been received.</p>
<p>Please log in to <a href="https://app.happyhomeshub.com/tenant/rent">HappyHomesHub</a> to make your payment or contact your landlord.</p>`,
              `<p>Hola ${esc(tenantRes.data.full_name) ?? ''},</p>
<p>Tu pago de renta de <strong>${amount}</strong> venció el <strong>${dueDate}</strong> y no se ha recibido.</p>
<p>Por favor inicia sesión en <a href="https://app.happyhomeshub.com/tenant/rent">HappyHomesHub</a> para realizar tu pago o contacta a tu arrendador.</p>`),
          },
        }).catch(() => {});
      }

      // Notify landlord (in their language)
      if (landlordRes.data?.email) {
        const ll = lang(landlordRes.data.language);
        const tenantName = esc(tenantRes.data?.full_name ?? tr(ll, 'Your tenant', 'Tu inquilino'));
        await supabase.functions.invoke('send-notification', {
          body: {
            to: landlordRes.data.email,
            subject: tr(ll, `Rent overdue — ${address}`, `Renta atrasada — ${address}`),
            html: tr(ll,
              `<p>Hi ${esc(landlordRes.data.full_name) ?? ''},</p>
<p><strong>${tenantName}</strong>'s rent of <strong>${amount}</strong> at <strong>${address}</strong> was due on <strong>${dueDate}</strong> and remains unpaid.</p>
<p>View details in <a href="https://app.happyhomeshub.com/landlord/rent">HappyHomesHub</a>.</p>`,
              `<p>Hola ${esc(landlordRes.data.full_name) ?? ''},</p>
<p>La renta de <strong>${tenantName}</strong> de <strong>${amount}</strong> en <strong>${address}</strong> venció el <strong>${dueDate}</strong> y sigue sin pagarse.</p>
<p>Ver detalles en <a href="https://app.happyhomeshub.com/landlord/rent">HappyHomesHub</a>.</p>`),
          },
        }).catch(() => {});
      }

      notified++;
    }

    return new Response(JSON.stringify({ processed: overdue.length, notified }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('check-overdue-rent error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
