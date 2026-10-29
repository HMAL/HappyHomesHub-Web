import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { useToastStore } from '../../stores/toast';
import { Deposit as DepositType } from '../../types';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/utils';
import Badge, { statusVariant } from '../../components/shared/Badge';
import { SkeletonList } from '../../components/shared/Skeleton';
import { useT } from '../../lib/i18n';

const PRIMARY = '#12202E';

export default function Deposit() {
  const { supabaseUser } = useAuthStore();
  const toast = useToastStore();
  const { t } = useT();
  const [deposit, setDeposit] = useState<DepositType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (supabaseUser) load();
  }, [supabaseUser]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data: tenancy, error: tenancyErr } = await supabase
        .from('tenancies')
        .select('id')
        .eq('tenant_id', supabaseUser!.id)
        .in('status', ['active', 'pending_invite'])
        .limit(1)
        .single();

      if (tenancyErr && tenancyErr.code !== 'PGRST116') throw tenancyErr;
      if (!tenancy) { setLoading(false); return; }

      const { data, error: depErr } = await supabase
        .from('deposits')
        .select('*')
        .eq('tenancy_id', tenancy.id)
        .single();

      if (depErr && depErr.code !== 'PGRST116') throw depErr;
      setDeposit(data as DepositType ?? null);
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? t('dep.failedLoad');
      setError(msg);
      toast.show(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="font-display text-2xl font-bold text-gray-900 mb-6">{t('dep.pageTitle')}</h1>

      {loading ? (
        <SkeletonList count={2} />
      ) : error ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-red-500">{error}</p>
          <button onClick={load} className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition" style={{ background: PRIMARY }}>{t('common.retry')}</button>
        </div>
      ) : !deposit ? (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
          <Shield className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{t('dep.none')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl p-6 text-white" style={{ background: PRIMARY }}>
            <p className="text-white/60 text-xs uppercase tracking-wider mb-1">{t('dep.cardLabel')}</p>
            <p className="text-3xl font-bold mb-2">{formatCurrency(deposit.total_amount)}</p>
            <Badge label={deposit.status.replace(/_/g, ' ')} variant={statusVariant(deposit.status)} />
            {deposit.collected_at && (
              <p className="text-white/60 text-sm mt-2">{t('dep.collected', { date: formatDateTime(deposit.collected_at) })}</p>
            )}
          </div>

          {/* Always-visible clarity breakdown — tenants want to know where their
              deposit stands at any time, not just after move-out. */}
          {(() => {
            const deductionTotal = (deposit.deductions ?? []).reduce((s, d) => s + (Number(d.amount) || 0), 0);
            const isReturned = deposit.returned_amount != null;
            const expected = isReturned ? Number(deposit.returned_amount) : deposit.total_amount - deductionTotal;
            return (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h2 className="font-semibold text-gray-800 mb-3">
                  {isReturned ? t('dep.summary') : t('dep.whatBack')}
                </h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">{t('dep.original')}</span><span className="font-medium text-gray-900">{formatCurrency(deposit.total_amount)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">{t('dep.deductionsSoFar')}</span><span className="font-medium text-red-600">−{formatCurrency(deductionTotal)}</span></div>
                  <div className="flex justify-between pt-2 border-t border-gray-100">
                    <span className="font-semibold text-gray-800">{isReturned ? t('dep.returnedToYou') : t('dep.estimatedReturn')}</span>
                    <span className="font-bold text-green-700">{formatCurrency(Math.max(0, expected))}</span>
                  </div>
                </div>
                {!isReturned && (
                  <p className="text-xs text-gray-400 mt-3">{t('dep.estimateNote')}</p>
                )}
              </div>
            );
          })()}

          {deposit.status !== 'held' && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-gray-800 mb-3">{t('dep.returnDetails')}</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {deposit.returned_amount != null && (
                  <>
                    <div>
                      <p className="text-gray-400 text-xs">{t('dep.amountReturned')}</p>
                      <p className="font-bold text-green-700">{formatCurrency(deposit.returned_amount)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">{t('dep.returnedOn')}</p>
                      <p className="font-medium">{formatDateTime(deposit.returned_at)}</p>
                    </div>
                  </>
                )}
              </div>

              {deposit.deductions?.length > 0 && (
                <div className="mt-4">
                  <p className="font-semibold text-gray-700 mb-2">{t('dep.deductions')}</p>
                  <div className="space-y-2">
                    {deposit.deductions.map((d, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div>
                          <p className="text-sm text-gray-700">{d.description}</p>
                          <p className="text-xs text-gray-400">{formatDate(d.date)}</p>
                        </div>
                        <p className="text-sm font-semibold text-red-600">-{formatCurrency(d.amount)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
