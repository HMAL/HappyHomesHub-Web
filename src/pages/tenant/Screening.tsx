import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ShieldCheck, Clock, CheckCircle, XCircle, CreditCard,
  FileText, User, Search, AlertCircle, Infinity as InfinityIcon,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { useToastStore } from '../../stores/toast';
import { ScreeningReport } from '../../types';
import { formatDate, safeHttpUrl } from '../../lib/utils';
import { useT } from '../../lib/i18n';

const PRIMARY = '#12202E';
const ACCENT = '#00C8BB';

type Tier = 'capped' | 'unlimited';
type TFunc = (key: string, vars?: Record<string, string | number>) => string;

const TIERS: Record<Tier, { price: number; appsKey: string; taglineKey: string }> = {
  capped: { price: 50, appsKey: 'scr.cappedApps', taglineKey: 'scr.cappedTagline' },
  unlimited: { price: 70, appsKey: 'scr.unlimitedApps', taglineKey: 'scr.unlimitedTagline' },
};

// Cost basis for the breakdown panel. The report itself runs on TransUnion
// SmartCheck Plus (~$40 + tax); the remainder is tax, Stripe processing and the
// HappyHomesHub service (the unlimited tier carries the extra reuse headroom).
function costBreakdown(tier: Tier, t: TFunc) {
  const reportCost = 40;
  const remainder = TIERS[tier].price - reportCost;
  return [
    {
      label: 'TransUnion SmartCheck Plus',
      detail: t('scr.reportDetail'),
      cost: '$40.00',
    },
    {
      label: tier === 'unlimited' ? t('scr.feeLabelUnlimited') : t('scr.feeLabelCapped'),
      detail: t('scr.feeDetail'),
      cost: `$${remainder.toFixed(2)}`,
    },
  ];
}

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function recommendationColor(rec?: string) {
  if (rec === 'approved') return { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', labelKey: 'scr.recApproved' };
  if (rec === 'consider') return { bg: '#fffbeb', border: '#fde68a', text: '#92400e', labelKey: 'scr.recConsider' };
  if (rec === 'declined') return { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', labelKey: 'scr.recDeclined' };
  return null;
}

export default function Screening() {
  const { supabaseUser } = useAuthStore();
  const toast = useToastStore();
  const { t } = useT();
  const [searchParams] = useSearchParams();
  const justPaid = searchParams.get('success') === 'true';

  const [report, setReport] = useState<ScreeningReport | null>(null);
  const [appsUsed, setAppsUsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [tier, setTier] = useState<Tier>('unlimited');

  useEffect(() => {
    if (supabaseUser) load();
  }, [supabaseUser]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('screening_reports')
      .select('*')
      .eq('applicant_id', supabaseUser!.id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const r = (data as ScreeningReport) ?? null;
    setReport(r);

    // Applications used against this package = the applicant's non-draft
    // applications created since the report was purchased.
    if (r) {
      const { count } = await supabase
        .from('applications')
        .select('id', { count: 'exact', head: true })
        .eq('applicant_id', supabaseUser!.id)
        .neq('status', 'draft')
        .gte('created_at', r.created_at);
      setAppsUsed(count ?? 0);
    }
    setLoading(false);
  }

  async function handlePay(chosen: Tier) {
    setPaying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const origin = window.location.origin;
      const { data, error } = await supabase.functions.invoke('create-screening-session', {
        body: {
          applicant_id: supabaseUser!.id,
          applicant_email: session?.user?.email ?? supabaseUser!.email,
          tier: chosen,
          success_url: `${origin}/tenant/screening?success=true`,
          cancel_url: `${origin}/tenant/screening`,
        },
      });
      if (error || !data?.url) throw new Error(error?.message ?? 'Failed to start checkout');
      window.location.href = data.url;
    } catch (e) {
      toast.show((e as Error).message, 'error');
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-100 rounded-xl w-48" />
          <div className="h-48 bg-gray-100 rounded-2xl" />
          <div className="h-32 bg-gray-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  // ── Just paid — webhook may be seconds behind ─────────────────────────────
  if (justPaid && !report) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="font-display text-2xl font-bold text-gray-900 mb-6">{t('sidebar.screening')}</h1>
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: ACCENT + '22' }}>
            <CheckCircle className="w-8 h-8" style={{ color: ACCENT }} />
          </div>
          <h2 className="font-bold text-xl text-gray-900 mb-2">{t('scr.paymentReceived')}</h2>
          <p className="text-sm text-gray-500 mb-4">
            {t('scr.paidDesc')}
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 flex items-center gap-2">
            <Clock className="w-4 h-4 shrink-0" />
            {t('scr.reportReadyNote')}
          </div>
          <button
            onClick={load}
            className="mt-5 px-5 py-2.5 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition"
            style={{ background: PRIMARY }}
          >
            {t('scr.checkStatus')}
          </button>
        </div>
      </div>
    );
  }

  // ── Has a valid report ────────────────────────────────────────────────────
  if (report) {
    const days = daysUntil(report.expires_at);
    const rec = recommendationColor(report.recommendation);
    const limit = report.application_limit ?? null; // null = unlimited
    const remaining = limit === null ? null : Math.max(0, limit - appsUsed);

    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="font-display text-2xl font-bold text-gray-900 mb-6">{t('scr.reportTitle')}</h1>

        {/* Status hero */}
        <div className="rounded-2xl p-6 text-white mb-4" style={{ background: PRIMARY }}>
          <div className="flex items-center gap-4">
            {report.report_status === 'completed' ? (
              <CheckCircle className="w-10 h-10 shrink-0" style={{ color: ACCENT }} />
            ) : report.report_status === 'failed' ? (
              <XCircle className="w-10 h-10 shrink-0 text-red-400" />
            ) : (
              <Clock className="w-10 h-10 shrink-0 text-white/60" />
            )}
            <div>
              <p className="font-bold text-lg capitalize">
                {report.report_status === 'pending' ? t('scr.statusPending') :
                 report.report_status === 'processing' ? t('scr.statusProcessing') :
                 report.report_status === 'completed' ? t('scr.statusReady') :
                 t('scr.statusFailed')}
              </p>
              <p className="text-white/60 text-sm mt-0.5">
                {report.report_status === 'completed'
                  ? t(days !== 1 ? 'scr.validForMany' : 'scr.validForOne', { days, date: formatDate(report.expires_at) })
                  : report.report_status === 'pending'
                  ? t('scr.checkEmailLink')
                  : t('scr.expires', { date: formatDate(report.expires_at) })}
              </p>
            </div>
          </div>

          {/* Validity bar */}
          {report.report_status === 'completed' && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-white/50 mb-1">
                <span>{t('scr.validity')}</span>
                <span>{t('scr.daysRemaining', { days })}</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{ width: `${(days / 90) * 100}%`, background: ACCENT }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Application usage */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {limit === null
              ? <InfinityIcon className="w-6 h-6 shrink-0" style={{ color: ACCENT }} />
              : <FileText className="w-6 h-6 shrink-0" style={{ color: ACCENT }} />}
            <div>
              <p className="font-semibold text-gray-800 text-sm">
                {limit === null ? t('scr.unlimitedApps') : t('scr.appsUsed', { used: appsUsed, limit })}
              </p>
              <p className="text-xs text-gray-400">
                {limit === null
                  ? t('scr.unlimitedNote')
                  : remaining === 0
                  ? t('scr.cappedUsedAll')
                  : t(remaining !== 1 ? 'scr.remainingMany' : 'scr.remainingOne', { n: remaining ?? 0 })}
              </p>
            </div>
          </div>
          {limit !== null && remaining === 0 && (
            <button
              onClick={() => handlePay('unlimited')}
              disabled={paying}
              className="px-3 py-2 rounded-xl text-white text-xs font-semibold hover:opacity-90 transition disabled:opacity-60 shrink-0"
              style={{ background: PRIMARY }}
            >
              {t('scr.upgrade70')}
            </button>
          )}
        </div>

        {/* Recommendation */}
        {rec && (
          <div
            className="rounded-2xl p-5 shadow-sm border mb-4 flex items-center gap-4"
            style={{ background: rec.bg, borderColor: rec.border }}
          >
            <ShieldCheck className="w-8 h-8 shrink-0" style={{ color: rec.text }} />
            <div>
              <p className="font-bold text-base" style={{ color: rec.text }}>{t('scr.recommendation', { label: t(rec.labelKey) })}</p>
              {report.score && (
                <p className="text-sm mt-0.5" style={{ color: rec.text }}>
                  {t('scr.residentScore')}: <strong>{report.score}</strong>
                </p>
              )}
            </div>
          </div>
        )}

        {/* What's included */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
          <h2 className="font-semibold text-gray-800 mb-3">{t('scr.packageIncludes')}</h2>
          <div className="space-y-2">
            {[
              { icon: FileText, label: t('scr.benCredit') },
              { icon: Search, label: t('scr.benCriminal') },
              { icon: AlertCircle, label: t('scr.benEviction') },
              { icon: User, label: t('scr.benIncome') },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 text-sm text-gray-700">
                <item.icon className="w-4 h-4 shrink-0" style={{ color: ACCENT }} />
                {item.label}
              </div>
            ))}
          </div>
        </div>

        {/* Reuse info */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-700">
          <p className="font-semibold mb-1">{t('scr.applyMultiple')}</p>
          <p>{t('scr.reuseDesc')}</p>
        </div>

        {/* Report PDF link */}
        {report.report_url && (
          <a
            href={safeHttpUrl(report.report_url)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            <FileText className="w-4 h-4" />
            {t('scr.viewReport')}
          </a>
        )}
      </div>
    );
  }

  // ── No report — payment wall with two tiers ───────────────────────────────
  const selected = TIERS[tier];
  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">{t('scr.wallTitle')}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {t('scr.wallSubtitle')}
      </p>

      {/* Tier selector */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {(Object.keys(TIERS) as Tier[]).map((tk) => {
          const info = TIERS[tk];
          const active = tier === tk;
          return (
            <button
              key={tk}
              onClick={() => setTier(tk)}
              className={`relative text-left rounded-2xl p-5 border-2 transition ${
                active ? 'shadow-md' : 'border-gray-200 hover:border-gray-300'
              }`}
              style={active ? { borderColor: ACCENT, background: '#f0fdfc' } : undefined}
            >
              {tk === 'unlimited' && (
                <span
                  className="absolute -top-2.5 right-3 text-[10px] font-bold uppercase tracking-wide text-white px-2 py-0.5 rounded-full"
                  style={{ background: ACCENT }}
                >
                  {t('scr.bestValue')}
                </span>
              )}
              <p className="text-3xl font-bold text-gray-900">${info.price}</p>
              <p className="text-sm font-semibold text-gray-800 mt-1">{t(info.appsKey)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{t(info.taglineKey)}</p>
              {active && (
                <CheckCircle className="w-5 h-5 mt-3" style={{ color: ACCENT }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Cost breakdown */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-5">
        <h2 className="font-semibold text-gray-800 mb-4">{t('scr.whatYouGet')}</h2>
        <div className="space-y-3">
          {costBreakdown(tier, t).map((item) => (
            <div key={item.label} className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: ACCENT }} />
                <div>
                  <p className="text-sm font-medium text-gray-800">{item.label}</p>
                  <p className="text-xs text-gray-400">{item.detail}</p>
                </div>
              </div>
              <p className="text-sm font-semibold text-gray-700 shrink-0">{item.cost}</p>
            </div>
          ))}
          <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900">{t('scr.total')}</p>
            <p className="text-sm font-bold text-gray-900">${selected.price}.00</p>
          </div>
        </div>
      </div>

      {/* Benefits */}
      <div className="bg-teal-50 border border-teal-100 rounded-2xl p-4 mb-6 text-sm text-teal-800">
        <p className="font-semibold mb-1.5">{t('scr.whyTitle')}</p>
        <ul className="space-y-1 text-xs text-teal-700">
          <li>• {t('scr.why1')}</li>
          <li>• {t('scr.why2')}</li>
          <li>• {t('scr.why3')}</li>
          <li>• {t('scr.why4')}</li>
        </ul>
      </div>

      <button
        onClick={() => handlePay(tier)}
        disabled={paying}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-white font-bold text-base hover:opacity-90 transition disabled:opacity-60"
        style={{ background: PRIMARY }}
      >
        {paying ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <CreditCard className="w-5 h-5" />
        )}
        {paying
          ? t('scr.redirecting')
          : t('scr.payBtn', { price: selected.price, plan: t(tier === 'unlimited' ? 'scr.unlimitedPlan' : 'scr.cappedPlan') })}
      </button>

      <p className="text-center text-xs text-gray-400 mt-3">
        {t('scr.securedNote')}
      </p>
    </div>
  );
}
