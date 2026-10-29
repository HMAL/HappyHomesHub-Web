import { useEffect, useState } from 'react';
import { Bell, ChevronLeft, ChevronRight, DollarSign, Plus, X, Settings, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { useToastStore } from '../../stores/toast';
import { Tenancy, Property, User, RentPayment, LateFeeType } from '../../types';
import { formatCurrency, formatDate, formatDateTime, stateToTimezone, startOfMonth, endOfMonth, prevMonth, nextMonth, formatMonth } from '../../lib/utils';
import Badge, { statusVariant } from '../../components/shared/Badge';
import { SkeletonList } from '../../components/shared/Skeleton';
import { useT } from '../../lib/i18n';

const PRIMARY = '#0D1F2D';

interface TenancyRow {
  id: string;
  property_id: string;
  tenant_id?: string;
  monthly_rent: number;
  deposit_amount: number;
  deposit_collected: boolean;
  status: Tenancy['status'];
  created_at: string;
  updated_at: string;
  created_by: string;
  lease_start?: string;
  lease_end?: string;
  auto_rent_enabled: boolean;
  late_fee_enabled: boolean;
  late_fee_grace_days: number;
  late_fee_type: LateFeeType;
  late_fee_amount: number | null;
  property: Property;
  tenant: User | null;
  payments: RentPayment[];
}

function calcLateFee(row: TenancyRow, payment: RentPayment): number | null {
  if (!row.late_fee_enabled || !row.late_fee_amount) return null;
  if (!['pending', 'late'].includes(payment.status)) return null;
  const graceEnd = new Date(payment.due_date + 'T00:00:00');
  graceEnd.setDate(graceEnd.getDate() + (row.late_fee_grace_days ?? 5));
  if (new Date() <= graceEnd) return null;
  return row.late_fee_type === 'percent'
    ? (row.late_fee_amount / 100) * row.monthly_rent
    : row.late_fee_amount;
}

type PaymentStatus = 'pending' | 'paid' | 'partial' | 'late';

// ─── Late Fee Settings Panel ──────────────────────────────────────────────────

interface LateFeeSettingsPanelProps {
  row: TenancyRow;
  onSaved: (updated: Partial<TenancyRow>) => void;
}

function LateFeeSettingsPanel({ row, onSaved }: LateFeeSettingsPanelProps) {
  const { supabaseUser } = useAuthStore();
  const toast = useToastStore();
  const { t } = useT();
  const [enabled, setEnabled] = useState(row.late_fee_enabled);
  const [graceDays, setGraceDays] = useState(String(row.late_fee_grace_days ?? 5));
  const [feeType, setFeeType] = useState<LateFeeType>(row.late_fee_type ?? 'fixed');
  const [amount, setAmount] = useState(String(row.late_fee_amount ?? ''));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const graceDaysNum = parseInt(graceDays);
    const amountNum = parseFloat(amount);
    if (enabled) {
      if (isNaN(graceDaysNum) || graceDaysNum < 0) { toast.show(t('toast.graceDaysInvalid'), 'error'); return; }
      if (isNaN(amountNum) || amountNum <= 0) { toast.show(t('toast.lateFeeInvalid'), 'error'); return; }
      if (feeType === 'percent' && amountNum > 100) { toast.show(t('toast.percentMax'), 'error'); return; }
    }
    setSaving(true);
    const { error } = await supabase.from('tenancies').update({
      late_fee_enabled: enabled,
      late_fee_grace_days: graceDaysNum || 5,
      late_fee_type: feeType,
      late_fee_amount: enabled ? amountNum : null,
      updated_by: supabaseUser!.id,
    }).eq('id', row.id);
    setSaving(false);
    if (error) { toast.show(error.message, 'error'); return; }
    toast.show(t('toast.lateFeeSaved'), 'success');
    onSaved({
      late_fee_enabled: enabled,
      late_fee_grace_days: graceDaysNum || 5,
      late_fee_type: feeType,
      late_fee_amount: enabled ? amountNum : null,
    });
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{t('lrent.lateFeeSettings')}</p>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-gray-500">{enabled ? t('lrent.enabled') : t('lrent.disabled')}</span>
          <button
            type="button"
            onClick={() => setEnabled((v) => !v)}
            className={`relative w-9 h-5 rounded-full transition-colors ${enabled ? 'bg-red-500' : 'bg-gray-200'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-4' : ''}`} />
          </button>
        </label>
      </div>

      {enabled && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('lrent.gracePeriod')}</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={graceDays}
                onChange={(e) => setGraceDays(e.target.value)}
                min={0}
                max={30}
                className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#0D1F2D]"
              />
              <span className="text-xs text-gray-400 whitespace-nowrap">{t('lrent.days')}</span>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('lrent.feeType')}</label>
            <select
              value={feeType}
              onChange={(e) => setFeeType(e.target.value as LateFeeType)}
              className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D]"
            >
              <option value="fixed">{t('lrent.fixedDollar')}</option>
              <option value="percent">{t('lrent.percentOfRent')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{feeType === 'percent' ? t('lrent.percent') : t('lrent.amount')}</label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">{feeType === 'percent' ? '' : '$'}</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={0}
                step={feeType === 'percent' ? '0.1' : '0.01'}
                placeholder={feeType === 'percent' ? '5' : '50'}
                className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D]"
              />
              {feeType === 'percent' && <span className="text-xs text-gray-400">%</span>}
            </div>
          </div>
        </div>
      )}

      {enabled && (
        <p className="text-xs text-gray-400 mb-2">
          {t('lrent.lateFeeExplainPre')}{' '}
          <strong>{feeType === 'percent' ? `${amount}% (≈${formatCurrency((parseFloat(amount) / 100) * row.monthly_rent)})` : `$${amount}`}</strong>{' '}
          {t('lrent.lateFeeExplainMid')} <strong>{graceDays} {graceDays !== '1' ? t('lrent.lateFeeExplainDays') : t('lrent.lateFeeExplainDay')}</strong> {t('lrent.lateFeeExplainPost')}
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition disabled:opacity-60"
        style={{ background: '#0D1F2D' }}
      >
        {saving ? t('common.saving') : t('lrent.saveLateFee')}
      </button>
    </div>
  );
}

// ─── Record Payment Modal ─────────────────────────────────────────────────────

interface RecordPaymentModalProps {
  row: TenancyRow;
  month: Date;
  onClose: () => void;
  onSaved: () => void;
}

function RecordPaymentModal({ row, month, onClose, onSaved }: RecordPaymentModalProps) {
  const { supabaseUser } = useAuthStore();
  const toast = useToastStore();
  const { t } = useT();
  const [amount, setAmount] = useState(String(row.monthly_rent));
  const [status, setStatus] = useState<PaymentStatus>('paid');
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(
    `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-01`,
  );
  const [method, setMethod] = useState('cash');
  const [saving, setSaving] = useState(false);

  // Auto-calculate late fee based on tenancy config and due date
  const autoLateFee = (() => {
    if (!row.late_fee_enabled || !row.late_fee_amount) return null;
    const graceEnd = new Date(dueDate + 'T00:00:00');
    graceEnd.setDate(graceEnd.getDate() + (row.late_fee_grace_days ?? 5));
    if (new Date() <= graceEnd) return null;
    return row.late_fee_type === 'percent'
      ? (row.late_fee_amount / 100) * row.monthly_rent
      : row.late_fee_amount;
  })();

  const [lateFee, setLateFee] = useState(autoLateFee ? autoLateFee.toFixed(2) : '');
  const [notes, setNotes] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) { toast.show(t('toast.enterValidAmount'), 'error'); return; }
    setSaving(true);
    const lateFeeNum = parseFloat(lateFee);
    const fullNotes = [
      lateFeeNum > 0 ? `Late fee: $${lateFeeNum.toFixed(2)}` : '',
      notes.trim(),
    ].filter(Boolean).join(' | ') || null;
    const { error } = await supabase.from('rent_payments').insert({
      tenancy_id: row.id,
      amount: parseFloat(amount),
      status,
      due_date: dueDate,
      paid_at: status === 'paid' || status === 'partial' ? paidAt : null,
      payment_method: method,
      notes: fullNotes,
      created_by: supabaseUser!.id,
      updated_by: supabaseUser!.id,
    });
    setSaving(false);
    if (error) {
      toast.show(error.message, 'error');
    } else {
      toast.show(t('toast.paymentRecorded'), 'success');
      onSaved();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100" style={{ background: PRIMARY }}>
          <p className="font-bold text-white">{t('lrent.recordPayment')}</p>
          <button onClick={onClose} className="text-white/60 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500">{t('lrent.property')}</p>
            <p className="font-semibold text-gray-800 text-sm">{row.property?.address_line1}</p>
            <p className="text-xs text-gray-500">{row.tenant?.full_name ?? t('lrent.noTenant')}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('lrent.amountReq')}</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                min={0}
                step="0.01"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('lrent.statusReq')}</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PaymentStatus)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition"
              >
                <option value="paid">{t('status.paid')}</option>
                <option value="partial">{t('status.partial')}</option>
                <option value="pending">{t('status.pending')}</option>
                <option value="late">{t('status.late')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('lrent.dueDateReq')}</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition"
              />
            </div>
            {(status === 'paid' || status === 'partial') && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('lrent.paidOnLabel')}</label>
                <input
                  type="date"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('lrent.paymentMethod')}</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition"
              >
                <option value="cash">{t('lrent.method_cash')}</option>
                <option value="check">{t('lrent.method_check')}</option>
                <option value="bank_transfer">{t('lrent.method_bank_transfer')}</option>
                <option value="money_order">{t('lrent.method_money_order')}</option>
                <option value="other">{t('lrent.method_other')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t('lrent.lateFeeDollar')}
                {autoLateFee && (
                  <span className="ml-1 text-red-500 font-normal">{t('lrent.lateFeeAuto', { amount: autoLateFee.toFixed(2) })}</span>
                )}
              </label>
              <input
                type="number"
                value={lateFee}
                onChange={(e) => setLateFee(e.target.value)}
                placeholder="0.00"
                min={0}
                step="0.01"
                className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition ${autoLateFee ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}
              />
              {autoLateFee && !lateFee && (
                <button
                  type="button"
                  onClick={() => setLateFee(autoLateFee.toFixed(2))}
                  className="text-xs text-red-600 hover:underline mt-0.5"
                >
                  {t('lrent.applyLateFee', { amount: autoLateFee.toFixed(2) })}
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('lrent.notes')}</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('lrent.notesPlaceholder')}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-60"
            style={{ background: PRIMARY }}
          >
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <DollarSign className="w-4 h-4" />}
            {saving ? t('common.saving') : t('lrent.recordPayment')}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Rent() {
  const { supabaseUser } = useAuthStore();
  const toast = useToastStore();
  const { t } = useT();
  const [month, setMonth] = useState(new Date());
  const [rows, setRows] = useState<TenancyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recordingFor, setRecordingFor] = useState<TenancyRow | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [togglingAutoRent, setTogglingAutoRent] = useState<string | null>(null);
  const [markingAllPaid, setMarkingAllPaid] = useState(false);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [lateFeeOpen, setLateFeeOpen] = useState<string | null>(null);

  useEffect(() => {
    if (supabaseUser) load();
  }, [supabaseUser, month]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const propIds = (
        await supabase.from('properties').select('id').eq('landlord_id', supabaseUser!.id)
      ).data?.map((p: { id: string }) => p.id) ?? [];

      const { data: tenancies, error: tenancyErr } = await supabase
        .from('tenancies')
        .select('*, property:property_id(*), tenant:tenant_id(*)')
        .in('property_id', propIds)
        .eq('status', 'active');

      if (tenancyErr) throw tenancyErr;
      if (!tenancies) { setLoading(false); return; }

      const tenancyIds = tenancies.map((t: { id: string }) => t.id);
      const { data: payments } = await supabase
        .from('rent_payments')
        .select('*')
        .in('tenancy_id', tenancyIds)
        .gte('due_date', startOfMonth(month).toISOString().slice(0, 10))
        .lte('due_date', endOfMonth(month).toISOString().slice(0, 10));

      const payMap = new Map<string, RentPayment[]>();
      (payments ?? []).forEach((p: RentPayment) => {
        const arr = payMap.get(p.tenancy_id) ?? [];
        arr.push(p);
        payMap.set(p.tenancy_id, arr);
      });

      setRows(
        tenancies.map((t: Tenancy & { property: Property; tenant: User | null }) => ({
          ...t,
          auto_rent_enabled: (t as any).auto_rent_enabled ?? false,
          late_fee_enabled: (t as any).late_fee_enabled ?? false,
          late_fee_grace_days: (t as any).late_fee_grace_days ?? 5,
          late_fee_type: (t as any).late_fee_type ?? 'fixed',
          late_fee_amount: (t as any).late_fee_amount ?? null,
          payments: payMap.get(t.id) ?? [],
        })),
      );
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? t('lrent.loadFailed');
      setError(msg);
      toast.show(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function toggleAutoRent(tenancyId: string, current: boolean) {
    setTogglingAutoRent(tenancyId);
    const { error } = await supabase
      .from('tenancies')
      .update({ auto_rent_enabled: !current, updated_by: supabaseUser!.id })
      .eq('id', tenancyId);
    setTogglingAutoRent(null);
    if (error) { toast.show(error.message, 'error'); return; }
    setRows((prev) => prev.map((r) => r.id === tenancyId ? { ...r, auto_rent_enabled: !current } : r));
    toast.show(t(!current ? 'toast.autoRentOn' : 'toast.autoRentOff'), 'success');
  }

  async function approvePayment(paymentId: string) {
    setApprovingId(paymentId);
    const { error } = await supabase
      .from('rent_payments')
      .update({ status: 'paid', updated_by: supabaseUser!.id })
      .eq('id', paymentId);
    setApprovingId(null);
    if (error) { toast.show(error.message, 'error'); return; }
    toast.show(t('toast.paymentApproved'), 'success');
    load();
  }

  async function markAllPaid() {
    const unpaidRows = rows.filter((r) => !r.payments.some((p) => p.status === 'paid'));
    if (unpaidRows.length === 0) { toast.show(t('toast.allPaidThisMonth'), 'info'); return; }
    if (!window.confirm(t('lrent.confirmMarkAll', { count: unpaidRows.length, month: formatMonth(month.toISOString()) }))) return;
    setMarkingAllPaid(true);
    const today = new Date().toISOString().slice(0, 10);
    const dueDate = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-01`;
    const records = unpaidRows.map((r) => ({
      tenancy_id: r.id,
      amount: r.monthly_rent,
      status: 'paid',
      due_date: dueDate,
      paid_at: today,
      payment_method: 'other',
      notes: 'Bulk mark paid',
      created_by: supabaseUser!.id,
      updated_by: supabaseUser!.id,
    }));
    const { error } = await supabase.from('rent_payments').insert(records);
    setMarkingAllPaid(false);
    if (error) { toast.show(error.message, 'error'); return; }
    toast.show(t('toast.markedPaid', { count: unpaidRows.length }), 'success');
    load();
  }

  async function sendReminder(row: TenancyRow) {
    if (!row.tenant?.email) { toast.show(t('toast.noTenantEmail'), 'error'); return; }
    setSendingReminder(row.id);
    const { error } = await supabase.functions.invoke('send-notification', {
      body: {
        to: row.tenant.email,
        subject: `Rent reminder — ${formatMonth(month.toISOString())}`,
        html: `<p>Hi ${row.tenant.full_name ?? 'there'},</p><p>This is a friendly reminder that your rent of <strong>$${Number(row.monthly_rent).toFixed(2)}</strong> for <strong>${row.property?.address_line1 ?? 'your property'}</strong> is due for ${formatMonth(month.toISOString())}.</p><p>Please <a href="https://happyhomeshub.com/tenant/rent">log in to HappyHomesHub</a> to pay or record your payment.</p><p>Thank you.</p>`,
      },
    });
    setSendingReminder(null);
    if (error) toast.show(t('toast.reminderFailed', { msg: error.message }), 'error');
    else toast.show(t('toast.reminderSentTo', { email: row.tenant.email }), 'success');
  }

  const totalCollected = rows
    .flatMap((r) => r.payments)
    .filter((p) => ['paid', 'partial'].includes(p.status))
    .reduce((s, p) => s + Number(p.amount), 0);

  const totalExpected = rows.reduce((s, r) => s + Number(r.monthly_rent), 0);
  const outstanding = totalExpected - totalCollected;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-900">{t('lrent.title')}</h1>
        {rows.length > 0 && (
          <button
            onClick={markAllPaid}
            disabled={markingAllPaid}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
            style={{ background: '#16a34a' }}
          >
            {markingAllPaid
              ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <DollarSign className="w-3.5 h-3.5" />}
            {t('lrent.markAllPaid')}
          </button>
        )}
      </div>

      {/* Month navigator */}
      <div className="flex items-center justify-between bg-white rounded-2xl px-5 py-4 shadow-sm border border-gray-100 mb-5">
        <button
          onClick={() => setMonth(prevMonth(month))}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex items-center gap-3">
          <p className="font-semibold text-gray-900">{formatMonth(month.toISOString())}</p>
          {month.getMonth() !== new Date().getMonth() || month.getFullYear() !== new Date().getFullYear() ? (
            <button
              onClick={() => setMonth(new Date())}
              className="text-xs font-medium text-[#D4972A] hover:underline"
            >
              {t('lrent.today')}
            </button>
          ) : null}
        </div>
        <button
          onClick={() => setMonth(nextMonth(month))}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 sm:grid-cols-3 gap-2 sm:gap-3 mb-6">
        {[
          { label: t('lrent.collected'), value: formatCurrency(totalCollected), color: 'text-green-700' },
          { label: t('lrent.expected'), value: formatCurrency(totalExpected), color: 'text-gray-900' },
          { label: t('lrent.outstanding'), value: formatCurrency(outstanding), color: outstanding > 0 ? 'text-red-600' : 'text-gray-400' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tenancy rows */}
      {loading ? (
        <SkeletonList />
      ) : error ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-red-500">{error}</p>
          <button onClick={load} className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition" style={{ background: PRIMARY }}>{t('common.retry')}</button>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
          <DollarSign className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{t('lrent.noActive')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                <div>
                  <p className="font-semibold text-gray-900">{row.property?.address_line1}</p>
                  <p className="text-sm text-gray-500">{row.tenant?.full_name ?? t('common.tenant')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => toggleAutoRent(row.id, row.auto_rent_enabled)}
                    disabled={togglingAutoRent === row.id}
                    title={row.auto_rent_enabled
                      ? t('lrent.autoRentOnTitle')
                      : t('lrent.autoRentOffTitle')}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition ${
                      row.auto_rent_enabled
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-gray-50 border-gray-200 text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {row.auto_rent_enabled ? t('lrent.autoRentOn') : t('lrent.autoRentOff')}
                  </button>
                  <p className="font-bold text-gray-900">{formatCurrency(row.monthly_rent)}/mo</p>
                  {/* No reminder while a bank payment is already settling */}
                  {row.tenant?.email && !row.payments.some((p) => ['paid', 'processing'].includes(p.status)) && (
                    <button
                      onClick={() => sendReminder(row)}
                      disabled={sendingReminder === row.id}
                      title={t('lrent.remindTitle', { email: row.tenant?.email ?? '' })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90 transition disabled:opacity-50 border border-amber-300 text-amber-700 bg-amber-50"
                    >
                      {sendingReminder === row.id
                        ? <div className="w-3.5 h-3.5 border-2 border-amber-400/30 border-t-amber-600 rounded-full animate-spin" />
                        : <Bell className="w-3.5 h-3.5" />}
                      {t('lrent.remind')}
                    </button>
                  )}
                  <button
                    onClick={() => setRecordingFor(row)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition"
                    style={{ background: PRIMARY }}
                  >
                    <Plus className="w-3.5 h-3.5" /> {t('lrent.record')}
                  </button>
                </div>
              </div>
              {row.payments.length === 0 ? (
                <p className="text-sm text-gray-400 italic">{t('lrent.noPaymentThisMonth')}</p>
              ) : (
                row.payments.map((p) => {
                  const fee = calcLateFee(row, p);
                  return (
                    <div key={p.id} className="flex items-center justify-between py-2 border-t border-gray-50">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            background: p.status === 'paid' ? '#16a34a' : p.status === 'late' ? '#dc2626' : p.status === 'processing' ? '#2563eb' : '#d97706',
                          }}
                        />
                        <div>
                          <span className="text-sm text-gray-600">{t('lrent.due', { date: formatDate(p.due_date) })}</span>
                          {p.paid_at && <span className="text-xs text-gray-400"> {t('lrent.paidOn', { date: formatDateTime(p.paid_at, stateToTimezone(row.property?.state)) })}</span>}
                          {fee !== null && (
                            <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                              <AlertTriangle className="w-3 h-3" />
                              {t('lrent.lateFeeLabel', { fee: formatCurrency(fee) })}
                            </span>
                          )}
                          {p.notes && <p className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">{p.notes}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-semibold">{formatCurrency(p.amount)}</span>
                        <Badge label={t('status.' + p.status)} variant={statusVariant(p.status)} />
                        {p.status === 'pending' && (
                          <button
                            onClick={() => approvePayment(p.id)}
                            disabled={approvingId === p.id}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
                            style={{ background: '#16a34a' }}
                          >
                            {approvingId === p.id ? '…' : t('lrent.approve')}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Late fee settings toggle */}
              <div className="mt-2 border-t border-gray-50 pt-2">
                <button
                  onClick={() => setLateFeeOpen((v) => v === row.id ? null : row.id)}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition"
                >
                  <Settings className="w-3.5 h-3.5" />
                  {row.late_fee_enabled
                    ? (row.late_fee_type === 'percent'
                        ? t('lrent.lateFeePercentSummary', { pct: row.late_fee_amount ?? 0, n: row.late_fee_grace_days })
                        : t('lrent.lateFeeSummary', { fee: formatCurrency(row.late_fee_amount ?? 0), n: row.late_fee_grace_days }))
                    : t('lrent.configureLateFee')}
                </button>
                {lateFeeOpen === row.id && (
                  <LateFeeSettingsPanel
                    row={row}
                    onSaved={(updated) => {
                      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, ...updated } : r));
                      setLateFeeOpen(null);
                    }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {recordingFor && (
        <RecordPaymentModal
          row={recordingFor}
          month={month}
          onClose={() => setRecordingFor(null)}
          onSaved={() => { setRecordingFor(null); load(); }}
        />
      )}
    </div>
  );
}
