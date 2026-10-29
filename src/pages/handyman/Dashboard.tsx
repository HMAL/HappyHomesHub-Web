import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, MessageSquare, UserCircle, AlertCircle, TrendingUp, CalendarClock, Star, BadgeCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { useToastStore } from '../../stores/toast';
import { HandymanProfile } from '../../types';
import { getGreeting } from '../../lib/utils';
import { SkeletonList } from '../../components/shared/Skeleton';
import { useT } from '../../lib/i18n';

type RevenuePeriod = 'today' | 'yesterday' | 'last7' | 'last_month' | 'mtd' | 'ytd';

function getDateRange(period: RevenuePeriod): { start: string; end?: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const now = new Date();
  if (period === 'today') return { start: fmt(now) };
  if (period === 'yesterday') {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    return { start: fmt(y), end: fmt(y) };
  }
  if (period === 'last7') {
    const d = new Date(now); d.setDate(d.getDate() - 6);
    return { start: fmt(d) };
  }
  if (period === 'last_month') {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: fmt(first), end: fmt(last) };
  }
  if (period === 'mtd') return { start: fmt(new Date(now.getFullYear(), now.getMonth(), 1)) };
  // ytd
  return { start: `${now.getFullYear()}-01-01` };
}

const PRIMARY = '#1B3A2F';
const ACCENT = '#34D399';

export default function HandymanDashboard() {
  const { profile, supabaseUser } = useAuthStore();
  const toast = useToastStore();
  const { t, lang } = useT();
  const [hmProfile, setHmProfile] = useState<HandymanProfile | null>(null);
  const [openJobs, setOpenJobs] = useState(0);
  const [activeJobs, setActiveJobs] = useState(0);
  const [completedJobs, setCompletedJobs] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revenuePeriod, setRevenuePeriod] = useState<RevenuePeriod>('mtd');
  const [revenue, setRevenue] = useState<number | null>(null);
  const [upcoming, setUpcoming] = useState<{ id: string; title: string; scheduled_for: string; address: string }[]>([]);

  useEffect(() => {
    if (supabaseUser) load();
  }, [supabaseUser]);

  useEffect(() => {
    if (supabaseUser) loadRevenue();
  }, [supabaseUser, revenuePeriod]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const uid = supabaseUser!.id;

      const [profileRes, openRes, activeRes, completedRes, msgRes] = await Promise.all([
        supabase.from('handyman_profiles').select('*').eq('user_id', uid).single(),
        supabase.from('maintenance_requests').select('id', { count: 'exact' }).eq('status', 'open').is('handyman_id', null),
        supabase.from('maintenance_requests').select('id', { count: 'exact' }).in('status', ['assigned', 'in_progress']).eq('handyman_id', uid),
        supabase.from('maintenance_requests').select('id', { count: 'exact' }).eq('status', 'resolved').eq('handyman_id', uid),
        supabase.from('messages').select('id', { count: 'exact' }).eq('receiver_id', uid).is('read_at', null),
      ]);

      if (profileRes.data) setHmProfile(profileRes.data as HandymanProfile);
      setOpenJobs(openRes.count ?? 0);
      setActiveJobs(activeRes.count ?? 0);
      setCompletedJobs(completedRes.count ?? 0);
      setUnreadMessages(msgRes.count ?? 0);

      // Upcoming scheduled visits — the glanceable "what's on my plate" view.
      const { data: sched } = await supabase
        .from('maintenance_requests')
        .select('id, title, scheduled_for, tenancy:tenancy_id(property:property_id(address_line1, city))')
        .eq('handyman_id', uid)
        .in('status', ['assigned', 'in_progress'])
        .not('scheduled_for', 'is', null)
        .gte('scheduled_for', new Date().toISOString())
        .order('scheduled_for', { ascending: true })
        .limit(5);
      setUpcoming((sched ?? []).map((r) => {
        const prop = (r.tenancy as { property?: { address_line1: string; city: string } } | null)?.property;
        return { id: r.id, title: r.title, scheduled_for: r.scheduled_for as string, address: prop ? `${prop.address_line1}, ${prop.city}` : '' };
      }));
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? t('hdash.loadFailed');
      setError(msg);
      toast.show(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadRevenue() {
    try {
      const uid = supabaseUser!.id;
      const { start, end } = getDateRange(revenuePeriod);
      // Actual earnings = in-app payouts received for the period (paid by landlords
      // through HappyHomesHub), based on the request's handyman_paid_at.
      let q = supabase
        .from('maintenance_requests')
        .select('payout_amount, handyman_paid_at')
        .eq('handyman_id', uid)
        .eq('payout_status', 'paid')
        .gte('handyman_paid_at', `${start}T00:00:00`);
      if (end) q = q.lte('handyman_paid_at', `${end}T23:59:59`);
      const { data, error: fetchErr } = await q;
      if (fetchErr) throw fetchErr;
      const total = (data ?? []).reduce((s: number, r: { payout_amount: number | null }) => s + Number(r.payout_amount ?? 0), 0);
      setRevenue(total);
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? t('hdash.earningsFailed');
      toast.show(msg, 'error');
    }
  }

  const stats = [
    { label: t('hdash.openJobs'), value: openJobs, to: '/handyman/jobs?tab=available', color: 'text-amber-600' },
    { label: t('hdash.active'), value: activeJobs, to: '/handyman/jobs?tab=active', color: activeJobs > 0 ? 'text-green-600' : 'text-gray-900' },
    { label: t('hdash.completed'), value: completedJobs, to: '/handyman/jobs?tab=completed', color: 'text-gray-900' },
    { label: t('hdash.messages'), value: unreadMessages, to: '/handyman/messages', color: unreadMessages > 0 ? 'text-blue-600' : 'text-gray-900' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-900">
          {getGreeting()}, {profile?.full_name?.split(' ')[0] ?? t('hdash.there')} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">{t('hdash.subtitle')}</p>
      </div>

      {loading ? (
        <SkeletonList count={3} />
      ) : error ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-red-500">{error}</p>
          <button onClick={load} className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition" style={{ background: PRIMARY }}>{t('common.retry')}</button>
        </div>
      ) : (
        <>
          {/* Availability banner */}
          {hmProfile && (
            <div
              className="rounded-2xl p-4 mb-5 flex items-center justify-between"
              style={{ background: hmProfile.is_available ? ACCENT + '22' : '#f3f4f6' }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: hmProfile.is_available ? ACCENT : '#9ca3af' }}
                />
                <p className="text-sm font-semibold text-gray-800">
                  {hmProfile.is_available ? t('hdash.available') : t('hdash.unavailable')}
                </p>
              </div>
              <Link to="/handyman/profile" className="text-xs font-semibold text-gray-500 hover:text-gray-800">
                {t('hdash.editProfile')}
              </Link>
            </div>
          )}

          {/* Reputation strip — your standing, visible to landlords browsing the marketplace */}
          {hmProfile && (hmProfile.rating || hmProfile.completed_jobs > 0 || hmProfile.verified) && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-5 px-1">
              {hmProfile.rating ? (
                <span className="flex items-center gap-1.5 text-sm">
                  <Star className="w-4 h-4 fill-current" style={{ color: '#f59e0b' }} />
                  <span className="font-bold text-gray-900">{hmProfile.rating.toFixed(1)}</span>
                  <span className="text-gray-400 text-xs">{t('hdash.rating')}</span>
                </span>
              ) : null}
              <span className="flex items-center gap-1.5 text-sm">
                <span className="font-bold text-gray-900">{hmProfile.completed_jobs}</span>
                <span className="text-gray-400 text-xs">{t('hdash.jobsCompleted')}</span>
              </span>
              {hmProfile.verified && (
                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  <BadgeCheck className="w-4 h-4" /> {t('hm.verified')}
                </span>
              )}
            </div>
          )}

          {/* Profile setup reminder */}
          {!hmProfile && (
            <div className="mb-5 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800">{t('hdash.setupProfile')}</p>
                <p className="text-xs text-amber-600">{t('hdash.setupDesc')}</p>
              </div>
              <Link to="/handyman/profile" className="text-xs font-semibold text-amber-700 hover:text-amber-900">
                {t('hdash.setup')}
              </Link>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {stats.map((s) => (
              <Link
                key={s.label}
                to={s.to}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all"
              >
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-400 mt-1">{s.label}</p>
              </Link>
            ))}
          </div>

          {/* Revenue */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" style={{ color: ACCENT }} />
                <p className="font-semibold text-gray-800 text-sm">{t('hdash.earnings')}</p>
              </div>
              <select
                value={revenuePeriod}
                onChange={(e) => setRevenuePeriod(e.target.value as RevenuePeriod)}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#34D399] transition"
              >
                <option value="today">{t('hdash.pToday')}</option>
                <option value="yesterday">{t('hdash.pYesterday')}</option>
                <option value="last7">{t('hdash.pLast7')}</option>
                <option value="mtd">{t('hdash.pMtd')}</option>
                <option value="last_month">{t('hdash.pLastMonth')}</option>
                <option value="ytd">{t('hdash.pYtd')}</option>
              </select>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {revenue === null
                ? '—'
                : `$${revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
            <p className="text-xs text-gray-400 mt-1">{t('hdash.earningsNote')}</p>
          </div>

          {/* Upcoming schedule */}
          {upcoming.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <CalendarClock className="w-4 h-4" style={{ color: ACCENT }} />
                <p className="font-semibold text-gray-800 text-sm">{t('hdash.upcoming')}</p>
              </div>
              <div className="divide-y divide-gray-50">
                {upcoming.map((u) => (
                  <Link key={u.id} to={`/handyman/jobs?tab=active`} className="flex items-center justify-between py-2.5 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{u.title}</p>
                      {u.address && <p className="text-xs text-gray-400 truncate">{u.address}</p>}
                    </div>
                    <span className="text-xs font-semibold shrink-0 ml-3" style={{ color: PRIMARY }}>
                      {new Date(u.scheduled_for).toLocaleString(lang === 'es' ? 'es-ES' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t('hdash.findJobs'), icon: Briefcase, to: '/handyman/jobs', color: PRIMARY },
              { label: t('hdash.messages'), icon: MessageSquare, to: '/handyman/messages', color: '#4F8EF7' },
              { label: t('hdash.myProfile'), icon: UserCircle, to: '/handyman/profile', color: ACCENT.replace('#', '#') },
            ].map((a) => (
              <Link
                key={a.label}
                to={a.to}
                className="flex flex-col items-center gap-2 p-4 rounded-xl text-white text-sm font-semibold shadow-sm hover:opacity-90 transition"
                style={{ background: a.color }}
              >
                <a.icon className="w-5 h-5" />
                {a.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
