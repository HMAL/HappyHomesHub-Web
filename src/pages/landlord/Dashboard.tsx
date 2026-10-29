import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle, Plus, Mail, MessageSquare, Receipt, Building2, Users, AlertCircle, Home, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { Property, Tenancy } from '../../types';
import { formatCurrency, getGreeting, startOfMonth, endOfMonth } from '../../lib/utils';
import { SkeletonList } from '../../components/shared/Skeleton';
import CashflowCharts from '../../components/shared/CashflowCharts';
import Badge from '../../components/shared/Badge';
import { useT } from '../../lib/i18n';

const ACCENT = '#D4972A';
const PRIMARY = '#0D1F2D';

function OnboardingChecklist({ hasProperty, hasTenant, hasRent }: { hasProperty: boolean; hasTenant: boolean; hasRent: boolean }) {
  const { t } = useT();
  const allDone = hasProperty && hasTenant && hasRent;
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('hhh_checklist_dismissed') === '1');
  const [open, setOpen] = useState(true);

  if (dismissed || allDone) return null;

  const steps = [
    { label: t('ldash.stepAccount'), done: true },
    { label: t('ldash.stepProperty'), done: hasProperty, to: '/landlord/properties/new' },
    { label: t('ldash.stepTenant'), done: hasTenant, to: '/landlord/invite' },
    { label: t('ldash.stepRent'), done: hasRent, to: '/landlord/rent' },
  ];
  const completedCount = steps.filter((s) => s.done).length;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: ACCENT }}>
            {completedCount}/{steps.length}
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-900 text-sm">{t('ldash.gettingStarted')}</p>
            <p className="text-xs text-gray-400">{t('ldash.gettingStartedDesc')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); localStorage.setItem('hhh_checklist_dismissed', '1'); setDismissed(true); }}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100 transition"
          >
            {t('common.dismiss')}
          </button>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-gray-50 px-5 pb-4 space-y-2.5">
          {steps.map((step) => (
            <div key={step.label} className="flex items-center gap-3">
              <CheckCircle2 className={`w-5 h-5 shrink-0 ${step.done ? 'text-green-500' : 'text-gray-200'}`} />
              {step.to && !step.done ? (
                <Link to={step.to} className="text-sm font-medium hover:underline" style={{ color: ACCENT }}>{step.label}</Link>
              ) : (
                <p className={`text-sm ${step.done ? 'text-gray-500 line-through' : 'text-gray-700 font-medium'}`}>{step.label}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface PropertyWithTenancy extends Property {
  tenancies: (Tenancy & { tenant: { full_name: string; email: string } | null })[];
}

export default function LandlordDashboard() {
  const { profile, supabaseUser } = useAuthStore();
  const { t } = useT();
  const location = useLocation();
  const [properties, setProperties] = useState<PropertyWithTenancy[]>([]);
  const [openRequests, setOpenRequests] = useState(0);
  const [rentCollected, setRentCollected] = useState(0);
  const [rentExpected, setRentExpected] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (supabaseUser) fetchDashboard();
  }, [supabaseUser, location.key]);

  async function fetchDashboard() {
    setLoading(true);
    const uid = supabaseUser!.id;

    const propsRes = await supabase
      .from('properties')
      .select('*, tenancies(*, tenant:tenant_id(full_name, email))')
      .eq('landlord_id', uid)
      .order('created_at', { ascending: false });

    if (propsRes.data) setProperties(propsRes.data as PropertyWithTenancy[]);

    const propIds = (propsRes.data ?? []).map((p: { id: string }) => p.id);
    if (propIds.length === 0) { setLoading(false); return; }

    const tenancyIds = (
      await supabase.from('tenancies').select('id').in('property_id', propIds)
    ).data?.map((t: { id: string }) => t.id) ?? [];

    if (tenancyIds.length === 0) { setLoading(false); return; }

    const [maintRes, rentRes, msgRes, expenseRes] = await Promise.all([
      supabase
        .from('maintenance_requests')
        .select('id', { count: 'exact' })
        .in('tenancy_id', tenancyIds)
        .in('status', ['open', 'assigned', 'in_progress']),

      supabase
        .from('rent_payments')
        .select('amount, status')
        .in('tenancy_id', tenancyIds)
        .gte('due_date', startOfMonth().toISOString().slice(0, 10))
        .lte('due_date', endOfMonth().toISOString().slice(0, 10)),

      supabase
        .from('messages')
        .select('id', { count: 'exact' })
        .in('tenancy_id', tenancyIds)
        .is('read_at', null)
        .neq('sender_id', uid),

      supabase
        .from('expenses')
        .select('amount')
        .in('property_id', propIds)
        .gte('expense_date', startOfMonth().toISOString().slice(0, 10))
        .lte('expense_date', endOfMonth().toISOString().slice(0, 10)),
    ]);

    setOpenRequests(maintRes.count ?? 0);
    setUnreadMessages(msgRes.count ?? 0);

    if (expenseRes.data) {
      const exp = (expenseRes.data as { amount: number }[]).reduce((s, e) => s + Number(e.amount), 0);
      setTotalExpenses(exp);
    }

    if (rentRes.data) {
      const payments = rentRes.data as { amount: number; status: string }[];
      const collected = payments
        .filter((p) => ['paid', 'partial'].includes(p.status))
        .reduce((s, p) => s + Number(p.amount), 0);
      const expected = payments.reduce((s, p) => s + Number(p.amount), 0);
      setRentCollected(collected);
      setRentExpected(expected);
    }

    setLoading(false);
  }

  const vacancies = properties.filter(
    (p) => !p.tenancies?.some((t) => t.status === 'active' || t.status === 'pending_invite'),
  ).length;

  // Tenancies with lease ending in ≤ 60 days
  const leaseRenewals = useMemo(() => {
    const today = new Date();
    const cutoff = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
    return properties.flatMap((p) =>
      (p.tenancies ?? [])
        .filter((t) =>
          t.status === 'active' && t.lease_end &&
          new Date(t.lease_end) >= today && new Date(t.lease_end) <= cutoff,
        )
        .map((t) => ({
          address: p.address_line1,
          tenantName: (t.tenant as { full_name: string } | null)?.full_name ?? '',
          leaseEnd: t.lease_end!,
          daysLeft: Math.round((new Date(t.lease_end!).getTime() - today.getTime()) / 86_400_000),
          propertyId: p.id,
        })),
    );
  }, [properties]);

  const tenantCount = properties.reduce((sum, p) => {
    return sum + p.tenancies.filter((t) => t.status === 'active').length;
  }, 0);

  const rentPct = rentExpected > 0 ? Math.round((rentCollected / rentExpected) * 100) : 0;

  const stats = [
    { label: t('sidebar.properties'), value: properties.length, icon: Building2, to: '/landlord/properties' },
    { label: t('sidebar.tenants'), value: tenantCount, icon: Users, to: '/landlord/tenants' },
    { label: t('ldash.vacancies'), value: vacancies, icon: Home, to: '/landlord/properties' },
    { label: t('ldash.openIssues'), value: openRequests, icon: AlertCircle, to: '/landlord/maintenance' },
  ];

  const quickActions = [
    { label: t('ldash.addProperty'), icon: Plus, to: '/landlord/properties/new', color: ACCENT },
    { label: t('ldash.inviteTenant'), icon: Mail, to: '/landlord/invite', color: '#4F8EF7' },
    {
      label: `${t('sidebar.messages')}${unreadMessages > 0 ? ` (${unreadMessages})` : ''}`,
      icon: MessageSquare,
      to: '/landlord/messages',
      color: '#34D399',
    },
    { label: t('sidebar.expenses'), icon: Receipt, to: '/landlord/expenses', color: '#A78BFA' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-gray-900">
          {getGreeting()}, {profile?.full_name?.split(' ')[0] ?? 'there'} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">{t('ldash.subtitle')}</p>
      </div>

      {loading ? (
        <SkeletonList count={4} />
      ) : (
        <>
          {/* Onboarding checklist — shown until all steps complete or dismissed */}
          <OnboardingChecklist
            hasProperty={properties.length > 0}
            hasTenant={tenantCount > 0}
            hasRent={rentExpected > 0}
          />

          {/* Lease renewal alerts */}
          {leaseRenewals.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-sm font-semibold text-amber-800">
                  {t(leaseRenewals.length > 1 ? 'ldash.leasesExpiringMany' : 'ldash.leasesExpiringOne', { n: leaseRenewals.length })}
                </p>
              </div>
              {leaseRenewals.map((r) => (
                <div key={r.propertyId + r.leaseEnd} className="flex items-center justify-between gap-2">
                  <p className="text-xs text-amber-700">
                    <span className="font-semibold">{r.address}</span> — {r.tenantName} · {t(r.daysLeft !== 1 ? 'ldash.daysLeftMany' : 'ldash.daysLeftOne', { n: r.daysLeft })}
                  </p>
                  <Link
                    to={`/landlord/properties/${r.propertyId}`}
                    className="text-xs font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900 whitespace-nowrap"
                  >
                    {t('ldash.renew')}
                  </Link>
                </div>
              ))}
            </div>
          )}

          {/* Rent + Net Revenue card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-6 border border-gray-100">
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-sm text-gray-500 mb-1">{t('ldash.rentCollected')}</p>
                <p className="text-3xl font-bold text-gray-900">{formatCurrency(rentCollected)}</p>
              </div>
              <p className="text-sm text-gray-400">{t('ldash.ofExpected', { amount: formatCurrency(rentExpected) })}</p>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 mb-3">
              <div
                className="h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${rentPct}%`, background: ACCENT }}
              />
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <div className="text-sm">
                <span className="text-gray-500">{t('ldash.expensesLabel')} </span>
                <span className="font-semibold text-red-600">{formatCurrency(totalExpenses)}</span>
              </div>
              <div className="text-sm text-right">
                <span className="text-gray-500">{t('ldash.netRevenue')} </span>
                <span className={`font-bold ${(rentCollected - totalExpenses) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {formatCurrency(rentCollected - totalExpenses)}
                </span>
              </div>
            </div>
          </div>

          {/* Stats pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {stats.map((s) => (
              <Link
                key={s.label}
                to={s.to}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex flex-col gap-2"
              >
                <s.icon className="w-5 h-5 text-gray-400" />
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </Link>
            ))}
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {quickActions.map((a) => (
              <Link
                key={a.label}
                to={a.to}
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
                style={{ background: a.color }}
              >
                <a.icon className="w-4 h-4 shrink-0" />
                {a.label}
              </Link>
            ))}
          </div>

          {/* Cashflow charts */}
          <div className="mb-8">
            <CashflowCharts primary={PRIMARY} accent={ACCENT} />
          </div>

          {/* Properties list */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-gray-900">{t('sidebar.properties')}</h2>
              <Link to="/landlord/properties" className="text-sm text-gray-500 hover:text-gray-800">
                {t('ldash.viewAll')}
              </Link>
            </div>

            {properties.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center border border-dashed border-gray-200">
                <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 font-medium mb-1">{t('ldash.noProperties')}</p>
                <p className="text-sm text-gray-400 mb-4">{t('ldash.noPropertiesDesc')}</p>
                <Link
                  to="/landlord/properties/new"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{ background: PRIMARY }}
                >
                  <Plus className="w-4 h-4" /> {t('ldash.addProperty')}
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {properties.map((p) => {
                  const activeTenancy = p.tenancies?.find(
                    (t) => t.status === 'active' || t.status === 'pending_invite',
                  );
                  const isVacant = !activeTenancy;
                  return (
                    <Link
                      key={p.id}
                      to={`/landlord/properties/${p.id}`}
                      className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all flex items-start gap-4"
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: PRIMARY }}
                      >
                        <Building2 className="w-5 h-5" style={{ color: ACCENT }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{p.address_line1}</p>
                        <p className="text-sm text-gray-500 truncate">
                          {p.city}, {p.state} {p.zip}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <Badge
                            label={isVacant ? t('ldash.vacant') : activeTenancy?.status === 'pending_invite' ? t('ldash.inviteSent') : t('ldash.occupied')}
                            variant={isVacant ? 'neutral' : activeTenancy?.status === 'pending_invite' ? 'info' : 'success'}
                          />
                          {activeTenancy?.tenant && (
                            <span className="text-xs text-gray-500">
                              {(activeTenancy.tenant as { full_name: string }).full_name}
                            </span>
                          )}
                        </div>
                      </div>
                      {activeTenancy && (
                        <p className="text-sm font-bold text-gray-900 shrink-0">
                          {formatCurrency(activeTenancy.monthly_rent)}{t('dash.perMo')}
                        </p>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
