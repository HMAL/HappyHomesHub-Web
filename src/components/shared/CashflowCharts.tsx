import { useQuery } from '@tanstack/react-query';
import { TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { formatCurrency } from '../../lib/utils';
import SuperLock from './SuperLock';
import { useIsSuper } from '../../lib/useIsSuper';
import { useT } from '../../lib/i18n';

interface MonthBucket { label: string; key: string; collected: number; expenses: number; }

function lastSixMonths(locale: string): MonthBucket[] {
  const out: MonthBucket[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 5; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push({
      label: m.toLocaleDateString(locale, { month: 'short' }),
      key: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`,
      collected: 0,
      expenses: 0,
    });
  }
  return out;
}

async function loadCashflow(landlordId: string, locale: string) {
  const buckets = lastSixMonths(locale);
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  const since = `${buckets[0].key}-01`;

  const { data: properties } = await supabase
    .from('properties').select('id').eq('landlord_id', landlordId);
  const propIds = (properties ?? []).map((p) => p.id);
  if (!propIds.length) return buckets;

  const { data: tenancies } = await supabase
    .from('tenancies').select('id').in('property_id', propIds);
  const tenancyIds = (tenancies ?? []).map((t) => t.id);

  const [payRes, expRes] = await Promise.all([
    tenancyIds.length
      ? supabase.from('rent_payments').select('amount, paid_at, status').in('tenancy_id', tenancyIds).eq('status', 'paid').gte('paid_at', since)
      : Promise.resolve({ data: [] as { amount: number; paid_at: string | null; status: string }[] }),
    supabase.from('expenses').select('amount, expense_date').in('property_id', propIds).gte('expense_date', since),
  ]);

  for (const p of payRes.data ?? []) {
    if (!p.paid_at) continue;
    const b = byKey.get(p.paid_at.slice(0, 7));
    if (b) b.collected += Number(p.amount) || 0;
  }
  for (const e of expRes.data ?? []) {
    const b = byKey.get(String(e.expense_date).slice(0, 7));
    if (b) b.expenses += Number(e.amount) || 0;
  }
  return buckets;
}

/** Last-6-months rent-collected vs expenses, as lightweight CSS bars (no chart lib). */
export default function CashflowCharts({ primary = '#0D1F2D', accent = '#D4972A' }: { primary?: string; accent?: string }) {
  const { supabaseUser } = useAuthStore();
  const { isSuper, loading: superLoading } = useIsSuper();
  const { t, lang } = useT();
  const { data: buckets } = useQuery({
    queryKey: ['landlord-cashflow', supabaseUser?.id, lang],
    queryFn: () => loadCashflow(supabaseUser!.id, lang === 'es' ? 'es-ES' : 'en-US'),
    enabled: !!supabaseUser && isSuper,
  });

  // Analytics is a Super Landlord feature.
  if (!superLoading && !isSuper) {
    return <SuperLock title={t('cmp.cashflowTitle')} description={t('cmp.cashflowDesc')} >{null}</SuperLock>;
  }
  if (!buckets) return null;
  const max = Math.max(1, ...buckets.map((b) => Math.max(b.collected, b.expenses)));
  const totalCollected = buckets.reduce((s, b) => s + b.collected, 0);
  const totalExpenses = buckets.reduce((s, b) => s + b.expenses, 0);

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4" style={{ color: accent }} />
        <h2 className="text-sm font-semibold text-gray-700">{t('cmp.cashflowHeader')}</h2>
      </div>

      <div className="flex items-end justify-between gap-2 h-32 mb-3">
        {buckets.map((b) => (
          <div key={b.key} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex items-end justify-center gap-0.5 h-28">
              <div
                className="w-1/2 rounded-t"
                style={{ height: `${(b.collected / max) * 100}%`, background: primary, minHeight: b.collected ? 2 : 0 }}
                title={t('cmp.collectedTitle', { amount: formatCurrency(b.collected) })}
              />
              <div
                className="w-1/2 rounded-t"
                style={{ height: `${(b.expenses / max) * 100}%`, background: accent, minHeight: b.expenses ? 2 : 0 }}
                title={t('cmp.expensesTitle', { amount: formatCurrency(b.expenses) })}
              />
            </div>
            <span className="text-[10px] text-gray-400">{b.label}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: primary }} />
          <span className="text-gray-500">{t('cmp.collected')}</span>
          <span className="font-semibold text-gray-800">{formatCurrency(totalCollected)}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: accent }} />
          <span className="text-gray-500">{t('cmp.expenses')}</span>
          <span className="font-semibold text-gray-800">{formatCurrency(totalExpenses)}</span>
        </span>
      </div>
    </div>
  );
}
