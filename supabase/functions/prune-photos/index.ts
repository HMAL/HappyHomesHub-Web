import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Scheduled daily (Supabase cron → this function). Enforces the tier-based photo
// retention policy, the core storage-cost lever:
//   • Landlord tier  → inspection photos deleted 1 month after upload (silent).
//   • Super tier      → kept until the lease ends + 3 months, with a heads-up
//                       notice ~7 days before deletion.
// Leases / e-signed documents are never touched here (legal record).

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const BUCKET = 'inspection-photos';
const DAY = 24 * 60 * 60 * 1000;

interface PhotoRow {
  id: string;
  storage_path: string;
  created_at: string;
  deletion_notice_sent: boolean;
  inspection: {
    tenancy: { lease_end: string | null; property: { landlord_id: string } | null } | null;
  } | null;
}

async function deletePhotos(rows: { id: string; storage_path: string }[]) {
  if (!rows.length) return;
  await supabase.storage.from(BUCKET).remove(rows.map((r) => r.storage_path));
  await supabase.from('inspection_photos').delete().in('id', rows.map((r) => r.id));
}

Deno.serve(async (req) => {
  // Only allow the scheduled invocation / service role to run this.
  if (req.headers.get('authorization') !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const now = Date.now();

    // Tier map: landlord_id → 'landlord' | 'super'. Missing = base ('landlord').
    const { data: subs } = await supabase.from('subscriptions').select('landlord_id, tier');
    const tierOf = new Map<string, string>((subs ?? []).map((s) => [s.landlord_id as string, (s.tier as string) ?? 'landlord']));

    const { data: photos } = await supabase
      .from('inspection_photos')
      .select('id, storage_path, created_at, deletion_notice_sent, inspection:inspection_id(tenancy:tenancy_id(lease_end, property:property_id(landlord_id)))');

    const toDelete: { id: string; storage_path: string }[] = [];
    const toNotify: { id: string; landlordId: string }[] = [];

    for (const p of (photos ?? []) as unknown as PhotoRow[]) {
      const landlordId = p.inspection?.tenancy?.property?.landlord_id;
      if (!landlordId) continue;
      const isSuper = tierOf.get(landlordId) === 'super';

      if (!isSuper) {
        // Base tier: delete 1 month after upload, silently.
        if (now - new Date(p.created_at).getTime() > 30 * DAY) {
          toDelete.push({ id: p.id, storage_path: p.storage_path });
        }
        continue;
      }

      // Super tier: retain until lease_end + 3 months; notice 7 days prior.
      const leaseEnd = p.inspection?.tenancy?.lease_end;
      if (!leaseEnd) continue; // active/open lease → keep
      const deleteAt = new Date(leaseEnd).getTime() + 90 * DAY;
      if (now >= deleteAt) {
        toDelete.push({ id: p.id, storage_path: p.storage_path });
      } else if (now >= deleteAt - 7 * DAY && !p.deletion_notice_sent) {
        toNotify.push({ id: p.id, landlordId });
      }
    }

    await deletePhotos(toDelete);

    // Batch one notice per landlord, then mark those photos notified.
    const byLandlord = new Map<string, string[]>();
    for (const n of toNotify) {
      byLandlord.set(n.landlordId, [...(byLandlord.get(n.landlordId) ?? []), n.id]);
    }
    for (const [landlordId, ids] of byLandlord) {
      const { data: user } = await supabase.from('users').select('email, language').eq('id', landlordId).single();
      if (user?.email) {
        const es = user.language === 'es';
        await supabase.functions.invoke('send-notification', {
          body: {
            to: user.email,
            subject: es ? 'Las fotos de inspección se eliminarán pronto' : 'Inspection photos will be deleted soon',
            html: es
              ? `<p>Algunas de tus fotos de inspección están programadas para eliminarse en ~7 días (su contrato terminó hace más de 3 meses).</p>
                   <p>Descarga lo que necesites conservar de tus inspecciones en HappyHomesHub.</p>`
              : `<p>Some of your inspection photos are scheduled for deletion in ~7 days (their lease ended over 3 months ago).</p>
                   <p>Download anything you need to keep from your HappyHomesHub inspections.</p>`,
          },
        });
      }
      await supabase.from('inspection_photos').update({ deletion_notice_sent: true }).in('id', ids);
    }

    return new Response(JSON.stringify({ deleted: toDelete.length, notified: byLandlord.size }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('prune-photos error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});
