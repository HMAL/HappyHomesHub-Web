import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DollarSign, TrendingUp, AlertTriangle, CreditCard, CheckCircle, Download, Landmark } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { useToastStore } from '../../stores/toast';
import { RentPayment, Tenancy, Property, LateFeeType } from '../../types';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/utils';
import { printRentReceipt } from '../../lib/receipt';
import Badge, { statusVariant } from '../../components/shared/Badge';
import { SkeletonList } from '../../components/shared/Skeleton';
import { useT } from '../../lib/i18n';

const PRIMARY = '#12202E';
const ACCENT = '#00C8BB';

function calcTenantLateFee(
  tenancy: Tenancy & { late_fee_enabled?: boolean; late_fee_grace_days?: number; late_fee_type?: LateFeeType; late_fee_amount?: number | null },
  payment: RentPayment,
): { fee: number; appliedOn: string } | null {
  if (!tenancy.late_fee_enabled || !tenancy.late_fee_amount) return null;
  if (!['pending', 'late'].includes(payment.status)) return null;
  const graceEnd = new Date(payment.due_date + 'T00:00:00');
  graceEnd.setDate(graceEnd.getDate() + (tenancy.late_fee_grace_days ?? 5));
  if (new Date() <= graceEnd) return null;
  const fee = tenancy.late_fee_type === 'percent'
    ? (tenancy.late_fee_amount / 100) * tenancy.monthly_rent
    : tenancy.late_fee_amount;
  return { fee, appliedOn: graceEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
}

export default function TenantRent() {
  const { supabaseUser, profile } = useAuthStore();
  const toast = useToastStore();
  const { t, lang } = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tenancy, setTenancy] = useState<(Tenancy & { property?: Property }) | null>(null);
  const [payments, setPayments] = useState<RentPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [payingStripe, setPayingStripe] = useState(false);
  const stripeSuccess = searchParams.get('paid') === '1';
  const [reportAmount, setReportAmount] = useState('');
  const [reportMonth, setReportMonth] = useState('');
  const [reportMethod, setReportMethod] = useState('bank_transfer');
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [reportNotes, setReportNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  // 'paid' = card settled instantly; 'processing' = ACH debit initiated, settles in days.
  const [verifiedOutcome, setVerifiedOutcome] = useState<'paid' | 'processing' | null>(null);

  useEffect(() => {
    if (supabaseUser) load();
  }, [supabaseUser]);

  // Poll for Stripe webhook confirmation after redirect back from checkout
  useEffect(() => {
    if (!stripeSuccess || !supabaseUser) return;
    const redirectedAt = (() => {
      try { return localStorage.getItem('hhh_stripe_redirect_at') ?? ''; } catch { return ''; }
    })();
    let cancelled = false;
    let attempts = 0;
    setVerifyingPayment(true);

    async function poll() {
      if (cancelled) return;
      const list = await load();
      if (cancelled) return;
      const paid = (list ?? []).some(
        (p) => p.status === 'paid' && p.paid_at && (redirectedAt ? p.paid_at >= redirectedAt : true),
      );
      // 'processing' only ever comes from a Stripe bank (ACH) checkout, so its
      // presence right after redirect means this payment was initiated.
      const processing = !paid && (list ?? []).some((p) => p.status === 'processing');
      if (paid || processing || attempts >= 14) {
        setVerifiedOutcome(paid ? 'paid' : processing ? 'processing' : null);
        setVerifyingPayment(false);
        try { localStorage.removeItem('hhh_stripe_redirect_at'); } catch { /* ignore */ }
        if (!paid && !processing) {
          toast.show(t('toast.paymentConfirmDelay'), 'warning');
        }
        return;
      }
      attempts++;
      setTimeout(poll, 2000);
    }

    poll();
    return () => { cancelled = true; };
  }, [stripeSuccess, supabaseUser]);

  async function load(): Promise<RentPayment[] | null> {
    setLoading(true);
    setError(null);
    try {
      const { data: t } = await supabase
        .from('tenancies')
        .select('*, property:property_id(*)')
        .eq('tenant_id', supabaseUser!.id)
        .in('status', ['active', 'pending_invite'])
        .limit(1)
        .single();

      if (!t) { setLoading(false); return null; }
      setTenancy(t as Tenancy & { property?: Property });

      const { data: p, error: fetchErr } = await supabase
        .from('rent_payments')
        .select('*')
        .eq('tenancy_id', t.id)
        .order('due_date', { ascending: false });

      if (fetchErr) throw fetchErr;
      const list = (p as RentPayment[]) ?? [];
      setPayments(list);
      return list;
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? 'Failed to load rent';
      setError(msg);
      toast.show(msg, 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }

  function leaseMonths(): { label: string; value: string }[] {
    if (!tenancy?.lease_start) return [];
    const start = new Date(tenancy.lease_start + 'T00:00:00');
    const endDate = tenancy.lease_end
      ? new Date(tenancy.lease_end + 'T00:00:00')
      : new Date(start.getFullYear() + 2, start.getMonth(), 1);
    const months: { label: string; value: string }[] = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= endDate) {
      months.push({
        label: cur.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        value: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-01`,
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    return months;
  }

  // With a paymentId, pays that charge; without one, asks pay-rent to create
  // next month's charge for this tenancy (advance payment) and pays that.
  async function payWithCard(paymentId?: string) {
    setPayingStripe(true);
    const origin = window.location.origin;
    const { data, error } = await supabase.functions.invoke('pay-rent', {
      body: {
        ...(paymentId ? { rent_payment_id: paymentId } : { advance: true }),
        success_url: `${origin}/tenant/rent?paid=1`,
        cancel_url: `${origin}/tenant/rent`,
      },
    });
    setPayingStripe(false);
    if (error || !data?.url) {
      // pay-rent returns 409 {code:'landlord_not_onboarded'} until the landlord
      // connects a bank to receive rent; surface that clearly.
      let msg = error?.message ?? 'Could not create payment session';
      try {
        const body = await (error as { context?: Response })?.context?.json?.();
        if (body?.code === 'landlord_not_onboarded') {
          msg = 'Your landlord hasn’t set up online rent payments yet. Try another payment method or check back soon.';
        } else if (body?.error) {
          msg = body.error;
        }
      } catch { /* keep default message */ }
      toast.show(msg, 'error');
      return;
    }
    try { localStorage.setItem('hhh_stripe_redirect_at', new Date().toISOString()); } catch { /* ignore */ }
    window.location.href = data.url;
  }

  async function reportPayment() {
    const amount = parseFloat(reportAmount);
    if (!amount || amount <= 0) { toast.show(t('toast.enterValidAmount'), 'error'); return; }
    if (!tenancy) return;
    if (!reportMonth) { toast.show(t('toast.selectPaymentMonth'), 'error'); return; }
    setSubmitting(true);
    const dueDate = reportMonth;
    const { error } = await supabase.from('rent_payments').insert({
      tenancy_id: tenancy.id,
      amount,
      status: 'pending',
      due_date: dueDate,
      paid_at: reportDate,
      payment_method: reportMethod,
      notes: reportNotes.trim() || null,
      created_by: supabaseUser!.id,
      updated_by: supabaseUser!.id,
    });
    setSubmitting(false);
    if (error) { toast.show(error.message, 'error'); return; }
    toast.show(t('toast.paymentRecorded'), 'success');
    setShowReportForm(false);
    setReportAmount('');
    setReportMonth('');
    setReportNotes('');
    load();
  }

  const pendingPayments = payments.filter((p) => ['pending', 'late'].includes(p.status));
  // An ACH debit in flight — not payable, not settled; shown as its own hero state.
  const processingPayment = payments.find((p) => p.status === 'processing');
  const methodLabel = (m?: string) =>
    !m ? '' : m === 'ach' ? t('trent.methodAchShort') : m === 'card' ? t('trent.methodCardShort') : m.replace('_', ' ');
  const nextDue = pendingPayments.length > 0
    ? pendingPayments.reduce((earliest, p) => p.due_date < earliest.due_date ? p : earliest)
    : null;
  const lateCount = payments.filter((p) => p.status === 'late').length;
  // The month an advance payment would cover: the month after the latest charge
  // on record, or the current month when no charges exist yet.
  const advanceMonthLabel = (() => {
    const latest = payments[0]?.due_date; // payments are ordered by due_date desc
    const d = latest ? new Date(latest + 'T00:00:00') : new Date();
    const m = new Date(d.getFullYear(), latest ? d.getMonth() + 1 : d.getMonth(), 1);
    return m.toLocaleDateString(lang === 'es' ? 'es' : 'en-US', { month: 'long', year: 'numeric' });
  })();
  const totalPaid = payments
    .filter((p) => ['paid', 'partial'].includes(p.status))
    .reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <h1 className="font-display text-2xl font-bold text-gray-900 mb-4">{t('sidebar.rent')}</h1>

      {stripeSuccess && verifyingPayment && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-5">
          <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin shrink-0" />
          <p className="text-sm font-semibold text-blue-800">{t('trent.verifying')}</p>
        </div>
      )}
      {stripeSuccess && !verifyingPayment && verifiedOutcome === 'processing' && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-5">
          <Landmark className="w-5 h-5 text-blue-600 shrink-0" />
          <p className="text-sm font-semibold text-blue-800">{t('trent.payProcessingBanner')}</p>
          <button
            onClick={() => setSearchParams({})}
            className="ml-auto text-blue-500 hover:text-blue-700 text-xs"
          >
            {t('common.dismiss')}
          </button>
        </div>
      )}
      {stripeSuccess && !verifyingPayment && verifiedOutcome !== 'processing' && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-5">
          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
          <p className="text-sm font-semibold text-green-800">{t('trent.paySuccess')}</p>
          <button
            onClick={() => setSearchParams({})}
            className="ml-auto text-green-500 hover:text-green-700 text-xs"
          >
            {t('common.dismiss')}
          </button>
        </div>
      )}

      {loading ? (
        <SkeletonList />
      ) : error ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-red-500">{error}</p>
          <button onClick={load} className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition" style={{ background: PRIMARY }}>{t('common.retry')}</button>
        </div>
      ) : !tenancy ? (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
          <p className="text-gray-500">{t('trent.noTenancy')}</p>
        </div>
      ) : (
        <>
          {/* Next payment hero */}
          <div className="rounded-2xl p-5 mb-5 text-white" style={{ background: PRIMARY }}>
            {nextDue ? (
              <>
                <p className="text-white/60 text-xs uppercase tracking-wider mb-1">
                  {nextDue.status === 'late' ? t('trent.overdue') : t('trent.nextDue')}
                </p>
                <p className="text-3xl font-bold mb-1">{formatCurrency(nextDue.amount)}</p>
                <p className="text-white/70 text-sm mb-1">{t('dash.due', { date: formatDate(nextDue.due_date) })}</p>
                {(() => {
                  const lf = tenancy ? calcTenantLateFee(tenancy as any, nextDue) : null;
                  return lf ? (
                    <div className="flex items-center gap-1.5 bg-red-500/20 border border-red-400/30 rounded-lg px-3 py-1.5 mb-3 text-xs text-red-200">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      {t('trent.lateFeePre')} <strong className="text-red-100">{formatCurrency(lf.fee)}</strong> {t('trent.lateFeeSince', { date: lf.appliedOn })}
                    </div>
                  ) : null;
                })()}
                <button
                  onClick={() => payWithCard(nextDue.id)}
                  disabled={payingStripe}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition disabled:opacity-60"
                  style={{ background: ACCENT, color: PRIMARY }}
                >
                  {payingStripe
                    ? <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                    : <CreditCard className="w-4 h-4" />}
                  {payingStripe ? t('common.redirecting') : t('trent.payNow')}
                </button>
                <p className="text-white/50 text-xs mt-2">{t('trent.payMethodsNote')}</p>
              </>
            ) : processingPayment ? (
              <>
                <p className="text-white/60 text-xs uppercase tracking-wider mb-1">{t('trent.processingLabel')}</p>
                <p className="text-3xl font-bold mb-1">{formatCurrency(processingPayment.amount)}</p>
                <p className="text-white/70 text-sm">{t('trent.processingNote')}</p>
              </>
            ) : (
              <>
                <p className="text-white/60 text-xs uppercase tracking-wider mb-2">{t('trent.statusLabel')}</p>
                <p className="text-2xl font-bold" style={{ color: ACCENT }}>{t('trent.allClear')}</p>
                <p className="text-white/70 text-sm mt-1 mb-3">{t('trent.noCurrentlyDue')}</p>
                <button
                  onClick={() => payWithCard()}
                  disabled={payingStripe}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition disabled:opacity-60"
                  style={{ background: ACCENT, color: PRIMARY }}
                >
                  {payingStripe
                    ? <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                    : <CreditCard className="w-4 h-4" />}
                  {payingStripe ? t('common.redirecting') : t('trent.payAdvance', { month: advanceMonthLabel })}
                </button>
                <p className="text-white/50 text-xs mt-2">{t('trent.payAdvanceNote')}</p>
              </>
            )}
          </div>

          {/* Report a Payment — always visible */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-5 overflow-hidden">
            <button
              onClick={() => {
                if (!showReportForm) {
                  setReportAmount(nextDue ? String(nextDue.amount) : String(tenancy.monthly_rent));
                  const months = leaseMonths();
                  const paidMonths = new Set(
                    payments
                      .filter((p) => ['paid', 'approved'].includes(p.status))
                      .map((p) => p.due_date.slice(0, 7))
                  );
                  const defaultMonth = months.find((m) => !paidMonths.has(m.value.slice(0, 7)))?.value ?? months[0]?.value ?? '';
                  setReportMonth(defaultMonth);
                }
                setShowReportForm((v) => !v);
              }}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" style={{ color: ACCENT }} />
                <p className="font-semibold text-gray-800 text-sm">{t('trent.reportPayment')}</p>
              </div>
              <span className="text-xs text-gray-400">{showReportForm ? t('common.cancel') : t('trent.iPaid')}</span>
            </button>

            {showReportForm && (
              <div className="px-5 pb-5 space-y-3 border-t border-gray-100 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('trent.amount')}</label>
                    <input
                      type="number"
                      value={reportAmount}
                      onChange={(e) => setReportAmount(e.target.value)}
                      placeholder="0.00"
                      min={0} step="0.01"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition"
                      style={{ '--tw-ring-color': ACCENT } as React.CSSProperties}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('trent.datePaid')}</label>
                    <input
                      type="date"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition"
                      style={{ '--tw-ring-color': ACCENT } as React.CSSProperties}
                    />
                  </div>
                </div>
                {leaseMonths().length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('trent.paymentForMonth')}</label>
                    <select
                      value={reportMonth}
                      onChange={(e) => setReportMonth(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition"
                      style={{ '--tw-ring-color': ACCENT } as React.CSSProperties}
                    >
                      <option value="">{t('trent.selectMonth')}</option>
                      {leaseMonths().map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('trent.paymentMethod')}</label>
                  <select
                    value={reportMethod}
                    onChange={(e) => setReportMethod(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition"
                    style={{ '--tw-ring-color': ACCENT } as React.CSSProperties}
                  >
                    <option value="bank_transfer">{t('trent.methodBank')}</option>
                    <option value="cash">{t('trent.methodCash')}</option>
                    <option value="check">{t('trent.methodCheck')}</option>
                    <option value="money_order">{t('trent.methodMoneyOrder')}</option>
                    <option value="other">{t('trent.methodOther')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('trent.notes')}</label>
                  <input
                    type="text"
                    value={reportNotes}
                    onChange={(e) => setReportNotes(e.target.value)}
                    placeholder={t('trent.notesPlaceholder')}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition"
                    style={{ '--tw-ring-color': ACCENT } as React.CSSProperties}
                  />
                </div>
                <button
                  onClick={reportPayment}
                  disabled={submitting || !reportAmount}
                  className="w-full py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition disabled:opacity-50"
                  style={{ background: PRIMARY, color: '#fff' }}
                >
                  {submitting ? t('trent.submitting') : t('trent.submitApproval')}
                </button>
                <p className="text-xs text-gray-400 text-center">
                  {t('trent.reviewNote')}
                </p>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: t('trent.monthlyRent'), value: formatCurrency(tenancy.monthly_rent), icon: DollarSign },
              { label: t('trent.totalPaid'), value: formatCurrency(totalPaid), icon: TrendingUp },
              { label: t('trent.latePayments'), value: String(lateCount), icon: AlertTriangle, warn: lateCount > 0 },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                <p className={`text-xl font-bold ${s.warn ? 'text-red-600' : 'text-gray-900'}`}>{s.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Payment history */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <p className="font-semibold text-gray-800">{t('trent.paymentHistory')}</p>
            </div>
            {payments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">{t('trent.noPaymentRecords')}</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {payments.map((p) => {
                  const lf = tenancy ? calcTenantLateFee(tenancy as any, p) : null;
                  return (
                  <div key={p.id} className="px-5 py-4 flex items-center gap-3">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{
                        background: p.status === 'paid' ? '#16a34a' : p.status === 'late' ? '#dc2626' : p.status === 'processing' ? '#2563eb' : '#d97706',
                      }}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">
                        {new Date(p.due_date).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { month: 'long', year: 'numeric' })}
                      </p>
                      {p.paid_at && (
                        <p className="text-xs text-gray-400">
                          {t('trent.paidOn', { date: formatDateTime(p.paid_at) })}{p.payment_method ? ` · ${methodLabel(p.payment_method)}` : ''}
                        </p>
                      )}
                      {lf && (
                        <p className="text-xs text-red-500 mt-0.5">
                          {t('trent.lateFeeHistory', { fee: formatCurrency(lf.fee), date: lf.appliedOn })}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">{formatCurrency(p.amount)}</span>
                      <Badge label={t('status.' + p.status)} variant={statusVariant(p.status)} />
                      {p.status === 'paid' && p.paid_at && (
                        <button
                          onClick={() => printRentReceipt({
                            receiptNo: p.id.slice(0, 8).toUpperCase(),
                            paidAt: p.paid_at!,
                            dueDate: p.due_date,
                            amount: p.amount,
                            method: methodLabel(p.payment_method ?? 'card'),
                            propertyAddress: tenancy?.property
                              ? `${tenancy.property.address_line1}, ${tenancy.property.city}, ${tenancy.property.state}`
                              : '—',
                            tenantName: profile?.full_name ?? 'Tenant',
                          })}
                          title={t('trent.downloadReceipt')}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
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
