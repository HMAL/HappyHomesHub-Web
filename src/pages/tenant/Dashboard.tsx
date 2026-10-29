import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, Wrench, FileText, MessageSquare, Home, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { useToastStore } from '../../stores/toast';
import { Tenancy, Property, RentPayment, ApplicationStatus } from '../../types';
import { formatCurrency, formatDate, getGreeting } from '../../lib/utils';
import Badge, { statusVariant } from '../../components/shared/Badge';
import { SkeletonList } from '../../components/shared/Skeleton';
import { useT } from '../../lib/i18n';

const PRIMARY = '#12202E';
const ACCENT = '#00C8BB';

interface DashboardData {
  tenancy: (Tenancy & { property: Property }) | null;
  nextPayment: RentPayment | null;
  openRepairs: number;
  unreadMessages: number;
  docCount: number;
  appStatus: ApplicationStatus | null;
}

async function loadDashboard(uid: string): Promise<DashboardData> {
  const { data: tenancyData } = await supabase
    .from('tenancies')
    .select('*, property:property_id(*)')
    .eq('tenant_id', uid)
    .in('status', ['active', 'pending_invite'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!tenancyData) {
    return { tenancy: null, nextPayment: null, openRepairs: 0, unreadMessages: 0, docCount: 0, appStatus: null };
  }

  const tid = tenancyData.id;
  const [payRes, repairRes, msgRes, docRes, appRes] = await Promise.all([
    supabase.from('rent_payments').select('*').eq('tenancy_id', tid).in('status', ['pending', 'late']).order('due_date', { ascending: true }).limit(1),
    supabase.from('maintenance_requests').select('id', { count: 'exact' }).eq('tenancy_id', tid).in('status', ['open', 'assigned', 'in_progress']),
    supabase.from('messages').select('id', { count: 'exact' }).eq('tenancy_id', tid).is('read_at', null).neq('sender_id', uid),
    supabase.from('documents').select('id', { count: 'exact' }).eq('tenancy_id', tid),
    supabase.from('applications').select('status').eq('tenancy_id', tid).limit(1).maybeSingle(),
  ]);

  return {
    tenancy: tenancyData as Tenancy & { property: Property },
    nextPayment: (payRes.data?.[0] as RentPayment) ?? null,
    openRepairs: repairRes.count ?? 0,
    unreadMessages: msgRes.count ?? 0,
    docCount: docRes.count ?? 0,
    appStatus: (appRes.data?.status as ApplicationStatus) ?? null,
  };
}

export default function TenantDashboard() {
  const { profile, supabaseUser } = useAuthStore();
  const toast = useToastStore();
  const { t } = useT();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tenant-dashboard', supabaseUser?.id],
    queryFn: () => loadDashboard(supabaseUser!.id),
    enabled: !!supabaseUser,
  });

  const tenancy = data?.tenancy ?? null;
  const nextPayment = data?.nextPayment ?? null;
  const openRepairs = data?.openRepairs ?? 0;
  const unreadMessages = data?.unreadMessages ?? 0;
  const docCount = data?.docCount ?? 0;
  const appStatus = data?.appStatus ?? null;

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <SkeletonList count={4} />
      </div>
    );
  }

  if (error) return (
    <div className="max-w-3xl mx-auto px-6 py-16 flex flex-col items-center gap-4 text-center">
      <p className="text-red-500">{(error as Error)?.message ?? t('dash.failedLoad')}</p>
      <button onClick={() => refetch()} className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition" style={{ background: PRIMARY }}>{t('common.retry')}</button>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-900">
          {getGreeting()}, {profile?.full_name?.split(' ')[0] ?? 'there'} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">{t('dash.subtitle')}</p>
      </div>

      {!tenancy ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-dashed border-gray-200">
          <Home className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-800 font-semibold mb-1">{t('dash.waitingLandlord')}</p>
          <p className="text-sm text-gray-500 mb-4">
            {t('dash.waitingDesc')}
          </p>
          <div className="flex items-center justify-center gap-2 bg-gray-50 rounded-xl px-4 py-2.5 max-w-xs mx-auto">
            <span className="text-sm text-gray-700 font-medium truncate">{supabaseUser?.email}</span>
            <button
              onClick={() => { navigator.clipboard.writeText(supabaseUser?.email ?? ''); toast.show(t('toast.emailCopied'), 'success'); }}
              className="shrink-0 text-xs text-[#00C8BB] font-semibold hover:underline"
            >
              {t('common.copy')}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Property banner */}
          <div
            className="rounded-2xl p-5 mb-5 text-white"
            style={{ background: PRIMARY }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-1">{t('dash.yourHome')}</p>
                <p className="font-bold text-lg">{tenancy.property?.address_line1}</p>
                <p className="text-white/70 text-sm">{tenancy.property?.city}, {tenancy.property?.state}</p>
              </div>
              <Badge label={tenancy.status} variant={statusVariant(tenancy.status)} />
            </div>
            <div className="flex gap-4 mt-3 text-sm text-white/70">
              <span>{formatCurrency(tenancy.monthly_rent)}{t('dash.perMo')}</span>
              {tenancy.lease_end && <span>{t('dash.leaseEnds', { date: formatDate(tenancy.lease_end) })}</span>}
            </div>
          </div>

          {/* Application reminder — shown whenever app is not approved */}
          {appStatus !== 'approved' && (
            <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800">
                  {appStatus ? t('dash.appStatusPrefix', { status: appStatus.replace('_', ' ') }) : t('dash.appNeeded')}
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  {!appStatus
                    ? t('dash.appCompleteOnboard')
                    : appStatus === 'draft'
                    ? t('dash.appCompleteSubmit')
                    : t('dash.appUnderReview')}
                </p>
              </div>
              <Link
                to={!appStatus || appStatus === 'draft' ? '/tenant/application/fill' : '/tenant/application'}
                className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 transition"
              >
                {!appStatus ? t('common.start') : appStatus === 'draft' ? t('common.continue') : t('common.view')}
              </Link>
            </div>
          )}

          {/* Dashboard cards */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/tenant/rent"
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4" style={{ color: ACCENT }} />
                <p className="text-sm font-semibold text-gray-700">{t('sidebar.rent')}</p>
              </div>
              {nextPayment ? (
                <>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(nextPayment.amount)}</p>
                  <p className="text-xs text-gray-400 mt-1">{t('dash.due', { date: formatDate(nextPayment.due_date) })}</p>
                  <Badge label={nextPayment.status} variant={statusVariant(nextPayment.status)} className="mt-2" />
                </>
              ) : (
                <>
                  <p className="text-lg font-bold text-green-600">{t('dash.allClear')}</p>
                  <p className="text-xs text-gray-400 mt-1">{t('dash.noPaymentsDue')}</p>
                </>
              )}
            </Link>

            <Link
              to="/tenant/repairs"
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <Wrench className="w-4 h-4" style={{ color: ACCENT }} />
                <p className="text-sm font-semibold text-gray-700">{t('sidebar.repairs')}</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{openRepairs}</p>
              <p className="text-xs text-gray-400 mt-1">{t(openRepairs !== 1 ? 'dash.openRequests' : 'dash.openRequest')}</p>
              <p className="text-xs mt-2" style={{ color: ACCENT }}>{t('dash.newRequest')}</p>
            </Link>

            <Link
              to="/tenant/documents"
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4" style={{ color: ACCENT }} />
                <p className="text-sm font-semibold text-gray-700">{t('sidebar.documents')}</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{docCount}</p>
              <p className="text-xs text-gray-400 mt-1">{t('dash.leaseInspection')}</p>
            </Link>

            <Link
              to="/tenant/messages"
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4" style={{ color: ACCENT }} />
                <p className="text-sm font-semibold text-gray-700">{t('sidebar.messages')}</p>
              </div>
              {unreadMessages > 0 ? (
                <>
                  <p className="text-2xl font-bold" style={{ color: ACCENT }}>{unreadMessages}</p>
                  <p className="text-xs text-gray-400 mt-1">{t(unreadMessages !== 1 ? 'dash.unreadMessages' : 'dash.unreadMessage')}</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-bold text-gray-400">{t('dash.noNew')}</p>
                  <p className="text-xs text-gray-400 mt-1">{t('dash.messageLandlord')}</p>
                </>
              )}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
