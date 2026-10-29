import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Briefcase, MapPin, Clock, X, CheckCircle, DollarSign, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { useToastStore } from '../../stores/toast';
import { MaintenanceRequest, Property, Tenancy } from '../../types';
import { timeAgo } from '../../lib/utils';
import Badge, { priorityVariant, statusVariant } from '../../components/shared/Badge';
import { SkeletonList } from '../../components/shared/Skeleton';
import EmptyState from '../../components/shared/EmptyState';
import { useT } from '../../lib/i18n';

const PRIMARY = '#1B3A2F';
const ACCENT = '#34D399';

type Tab = 'available' | 'active' | 'completed' | 'history';

interface JobRow {
  id: string;
  tenancy_id: string;
  title: string;
  description: string;
  priority: MaintenanceRequest['priority'];
  status: MaintenanceRequest['status'];
  created_at: string;
  updated_at: string;
  handyman_id: string | null;
  tenancy: (Tenancy & { property: Property }) | null;
}

interface JobDetailModalProps {
  job: JobRow;
  tab: Tab;
  onClose: () => void;
  onAccept: (id: string) => Promise<void>;
  onUpdateStatus: (id: string, status: MaintenanceRequest['status']) => Promise<void>;
  onDrop: (id: string) => Promise<void>;
}

interface InvoiceFormProps {
  show: boolean; onToggle: () => void;
  amount: string; onAmount: (v: string) => void;
  desc: string; onDesc: (v: string) => void;
  onSubmit: () => void; submitting: boolean;
}
function InvoiceForm({ show, onToggle, amount, onAmount, desc, onDesc, onSubmit, submitting }: InvoiceFormProps) {
  const { t } = useT();
  return (
    <div className="border-t border-gray-100 pt-3 mt-1">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-sm font-semibold w-full"
        style={{ color: PRIMARY }}
      >
        <DollarSign className="w-4 h-4" style={{ color: ACCENT }} />
        {show ? t('hjobs.cancelInvoice') : t('hjobs.submitInvoiceTo')}
      </button>
      {show && (
        <div className="mt-3 space-y-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => onAmount(e.target.value)}
            placeholder={t('hjobs.amountPh')}
            min={0}
            step="0.01"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition"
            style={{ '--tw-ring-color': ACCENT } as React.CSSProperties}
          />
          <textarea
            value={desc}
            onChange={(e) => onDesc(e.target.value)}
            placeholder={t('hjobs.invoiceDescPh')}
            rows={2}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition resize-none"
            style={{ '--tw-ring-color': ACCENT } as React.CSSProperties}
          />
          <button
            onClick={onSubmit}
            disabled={submitting || !amount || !desc.trim()}
            className="w-full py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition disabled:opacity-50"
            style={{ background: ACCENT, color: PRIMARY }}
          >
            {submitting ? t('hjobs.submitting') : t('hjobs.submitInvoice')}
          </button>
        </div>
      )}
    </div>
  );
}

function JobDetailModal({ job, tab, onClose, onAccept, onUpdateStatus, onDrop }: JobDetailModalProps) {
  const { supabaseUser } = useAuthStore();
  const toast = useToastStore();
  const { t } = useT();
  const property = (job.tenancy as { property: Property } | null)?.property;
  const [updating, setUpdating] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [confirmDrop, setConfirmDrop] = useState(false);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteDesc, setQuoteDesc] = useState('');
  const [submittingQuote, setSubmittingQuote] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceDesc, setInvoiceDesc] = useState('');
  const [submittingInvoice, setSubmittingInvoice] = useState(false);
  const [scheduleAt, setScheduleAt] = useState((job as { scheduled_for?: string | null }).scheduled_for?.slice(0, 16) ?? '');
  const [savingSchedule, setSavingSchedule] = useState(false);

  async function saveSchedule() {
    if (!scheduleAt) return;
    setSavingSchedule(true);
    const iso = new Date(scheduleAt).toISOString();
    const { error } = await supabase
      .from('maintenance_requests')
      .update({ scheduled_for: iso, updated_by: supabaseUser!.id })
      .eq('id', job.id);
    if (error) { toast.show(error.message, 'error'); setSavingSchedule(false); return; }

    const whenEn = new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    await supabase.from('maintenance_updates').insert({
      request_id: job.id, user_id: supabaseUser!.id, note: `Visit scheduled for ${whenEn}.`,
    });
    // Tell the tenant the pro is coming (push free / SMS if premium), in their language.
    const tenantId = (job as { tenancy?: { tenant_id?: string } }).tenancy?.tenant_id;
    if (tenantId) {
      supabase.from('users').select('language').eq('id', tenantId).single().then(({ data: u }) => {
        const tl: 'en' | 'es' = u?.language === 'es' ? 'es' : 'en';
        const when = new Date(iso).toLocaleString(tl === 'es' ? 'es-ES' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
        const title = tl === 'es' ? 'Tu técnico está programado' : 'Your pro is scheduled';
        const body = tl === 'es'
          ? `${job.title}: visita programada para ${when}.`
          : `${job.title}: visit scheduled for ${when}.`;
        const smsBody = tl === 'es'
          ? `HappyHomesHub: tu técnico visitará para “${job.title}” el ${when}.`
          : `HappyHomesHub: your pro will visit for “${job.title}” on ${when}.`;
        supabase.functions.invoke('notify-user', {
          body: { user_id: tenantId, title, body, url: '/tenant/repairs', sms_body: smsBody },
        });
      });
    }
    toast.show(t('toast.visitScheduled'), 'success');
    setSavingSchedule(false);
  }

  async function submitQuote() {
    if (!quoteAmount || parseFloat(quoteAmount) <= 0) { toast.show(t('toast.enterValidAmount'), 'error'); return; }
    setSubmittingQuote(true);
    const { error } = await supabase.from('quotes').insert({
      request_id: job.id,
      handyman_id: supabaseUser!.id,
      amount: parseFloat(quoteAmount),
      description: quoteDesc.trim() || null,
    });
    setSubmittingQuote(false);
    if (error) { toast.show(error.message, 'error'); return; }
    toast.show(t('toast.quoteSent'), 'success');
    setShowQuoteForm(false);
    onClose();
  }

  async function submitInvoice() {
    const amount = parseFloat(invoiceAmount);
    if (!amount || amount <= 0) { toast.show(t('toast.enterValidAmount'), 'error'); return; }
    if (!invoiceDesc.trim()) { toast.show(t('toast.enterDescription'), 'error'); return; }
    setSubmittingInvoice(true);

    const prop = (job.tenancy as any)?.property as (Property & { landlord_id: string }) | undefined;
    const propId = job.tenancy?.property_id;
    const landlordId = prop?.landlord_id;

    if (!propId || !landlordId) {
      toast.show(t('toast.propertyDataUnavailable'), 'error');
      setSubmittingInvoice(false);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const [updateRes, expenseRes] = await Promise.all([
      supabase.from('maintenance_updates').insert({
        request_id: job.id,
        user_id: supabaseUser!.id,
        note: `Invoice submitted: $${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} — ${invoiceDesc.trim()}`,
      }),
      supabase.from('expenses').insert({
        property_id: propId,
        landlord_id: landlordId,
        category: 'maintenance',
        description: invoiceDesc.trim(),
        amount,
        expense_date: today,
        maintenance_request_id: job.id,
        created_by: supabaseUser!.id,
        updated_by: supabaseUser!.id,
      }),
    ]);

    setSubmittingInvoice(false);
    if (expenseRes.error || updateRes.error) {
      toast.show(expenseRes.error?.message ?? updateRes.error?.message ?? 'Error', 'error');
      return;
    }
    toast.show(t('toast.invoiceSubmitted'), 'success');
    setShowInvoiceForm(false);
    setInvoiceAmount('');
    setInvoiceDesc('');
  }

  async function handleAccept() {
    setUpdating(true);
    await onAccept(job.id);
    setUpdating(false);
    onClose();
  }

  async function handleStatus(s: MaintenanceRequest['status']) {
    setUpdating(true);
    await onUpdateStatus(job.id, s);
    setUpdating(false);
    onClose();
  }

  async function handleDrop() {
    setDropping(true);
    await onDrop(job.id);
    setDropping(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg overflow-hidden">
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100" style={{ background: PRIMARY }}>
          <div className="flex-1 pr-3">
            <p className="font-bold text-white text-lg">{job.title}</p>
            {property && (
              <p className="text-white/60 text-sm mt-0.5">{property.address_line1}, {property.city}</p>
            )}
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            <Badge label={t('priority.' + job.priority)} variant={priorityVariant(job.priority)} />
            <Badge label={t('status.' + job.status)} variant={statusVariant(job.status)} />
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">{t('hjobs.description')}</p>
            <p className="text-sm text-gray-800">{job.description}</p>
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
            {property && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {property.address_line1}, {property.city}, {property.state}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {t('hjobs.posted', { time: timeAgo(job.created_at) })}
            </span>
          </div>

          {/* Actions */}
          {tab === 'available' && !showQuoteForm && (
            <div className="space-y-2">
              <button
                onClick={handleAccept}
                disabled={updating}
                className="w-full py-3 rounded-xl font-bold text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: ACCENT, color: PRIMARY }}
              >
                {updating ? <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {updating ? t('hjobs.accepting') : t('hjobs.acceptJob')}
              </button>
              <button
                onClick={() => setShowQuoteForm(true)}
                className="w-full py-3 rounded-xl font-bold text-sm border-2 hover:opacity-80 transition flex items-center justify-center gap-2"
                style={{ borderColor: ACCENT, color: PRIMARY }}
              >
                <DollarSign className="w-4 h-4" />
                {t('hjobs.sendQuoteInstead')}
              </button>
            </div>
          )}

          {tab === 'available' && showQuoteForm && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{t('hjobs.yourQuote')}</p>
              <input
                type="number"
                value={quoteAmount}
                onChange={(e) => setQuoteAmount(e.target.value)}
                placeholder={t('hjobs.amountPh')}
                min={0}
                step="0.01"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition"
                style={{ '--tw-ring-color': ACCENT } as React.CSSProperties}
              />
              <textarea
                value={quoteDesc}
                onChange={(e) => setQuoteDesc(e.target.value)}
                placeholder={t('hjobs.quoteDescPh')}
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition resize-none"
                style={{ '--tw-ring-color': ACCENT } as React.CSSProperties}
              />
              <div className="flex gap-2">
                <button onClick={() => setShowQuoteForm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                  {t('common.cancel')}
                </button>
                <button
                  onClick={submitQuote}
                  disabled={submittingQuote || !quoteAmount}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition disabled:opacity-50"
                  style={{ background: ACCENT, color: PRIMARY }}
                >
                  {submittingQuote ? t('hjobs.sending') : t('hjobs.sendQuote')}
                </button>
              </div>
            </div>
          )}

          {tab === 'active' && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('hjobs.updateStatus')}</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleStatus('in_progress')}
                  disabled={updating || job.status === 'in_progress'}
                  className="py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition disabled:opacity-40"
                >
                  {t('hjobs.inProgress')}
                </button>
                <button
                  onClick={() => handleStatus('resolved')}
                  disabled={updating}
                  className="py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition disabled:opacity-40"
                  style={{ background: ACCENT, color: PRIMARY }}
                >
                  {t('hjobs.markResolved')}
                </button>
              </div>

              {/* Schedule a visit — shows the tenant a "pro on the way" ETA */}
              <div className="pt-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t('hjobs.scheduleVisit')}</p>
                <div className="flex gap-2">
                  <input
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(e) => setScheduleAt(e.target.value)}
                    className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition"
                    style={{ '--tw-ring-color': ACCENT } as React.CSSProperties}
                  />
                  <button
                    onClick={saveSchedule}
                    disabled={savingSchedule || !scheduleAt}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold border-2 hover:opacity-80 transition disabled:opacity-40"
                    style={{ borderColor: ACCENT, color: PRIMARY }}
                  >
                    {savingSchedule ? t('common.saving') : t('hjobs.setEta')}
                  </button>
                </div>
              </div>
              {confirmDrop ? (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                  <p className="text-xs text-red-700 flex-1">{t('hjobs.dropConfirm')}</p>
                  <button
                    onClick={handleDrop}
                    disabled={dropping}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-50"
                  >
                    {dropping ? '…' : t('hjobs.yesDrop')}
                  </button>
                  <button
                    onClick={() => setConfirmDrop(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDrop(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border border-red-200 text-red-500 hover:bg-red-50 transition"
                >
                  <AlertTriangle className="w-4 h-4" />
                  {t('hjobs.dropJob')}
                </button>
              )}
              {/* Invoice form — active tab */}
              <InvoiceForm
                show={showInvoiceForm}
                onToggle={() => setShowInvoiceForm((v) => !v)}
                amount={invoiceAmount}
                onAmount={setInvoiceAmount}
                desc={invoiceDesc}
                onDesc={setInvoiceDesc}
                onSubmit={submitInvoice}
                submitting={submittingInvoice}
              />
            </div>
          )}

          {tab === 'completed' && (
            <InvoiceForm
              show={showInvoiceForm}
              onToggle={() => setShowInvoiceForm((v) => !v)}
              amount={invoiceAmount}
              onAmount={setInvoiceAmount}
              desc={invoiceDesc}
              onDesc={setInvoiceDesc}
              onSubmit={submitInvoice}
              submitting={submittingInvoice}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function Jobs() {
  const { supabaseUser } = useAuthStore();
  const toast = useToastStore();
  const { t } = useT();
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as Tab | null) ?? 'available';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<JobRow | null>(null);

  useEffect(() => {
    if (supabaseUser) load();
  }, [supabaseUser, tab]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('maintenance_requests')
        .select('*, tenancy:tenancy_id(*, property:property_id(id, address_line1, city, state, landlord_id))')
        .order('created_at', { ascending: false });

      if (tab === 'available') {
        query = query.eq('status', 'open');
      } else if (tab === 'active') {
        query = query.in('status', ['assigned', 'in_progress']).eq('handyman_id', supabaseUser!.id);
      } else if (tab === 'completed') {
        query = query.eq('status', 'resolved').eq('handyman_id', supabaseUser!.id);
      } else {
        query = query.eq('status', 'closed').eq('handyman_id', supabaseUser!.id);
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;
      setJobs((data as JobRow[]) ?? []);
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? t('hjobs.loadFailed');
      setError(msg);
      toast.show(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function acceptJob(jobId: string) {
    const { error } = await supabase
      .from('maintenance_requests')
      .update({ handyman_id: supabaseUser!.id, status: 'assigned', updated_by: supabaseUser!.id })
      .eq('id', jobId);
    if (error) { toast.show(error.message, 'error'); return; }
    await supabase.from('maintenance_updates').insert({
      request_id: jobId,
      user_id: supabaseUser!.id,
      note: 'Handyman accepted this job.',
      status_change: 'assigned',
    });
    toast.show(t('toast.jobAccepted'), 'success');
    load();
  }

  async function dropJob(jobId: string) {
    const { error } = await supabase
      .from('maintenance_requests')
      .update({ handyman_id: null, status: 'open', updated_by: supabaseUser!.id })
      .eq('id', jobId);
    if (error) { toast.show(error.message, 'error'); return; }
    await supabase.from('maintenance_updates').insert({
      request_id: jobId,
      user_id: supabaseUser!.id,
      note: 'Handyman dropped the job — returned to open.',
      status_change: 'open',
    });
    toast.show(t('toast.jobDropped'), 'success');
    load();
  }

  async function updateJobStatus(jobId: string, status: MaintenanceRequest['status']) {
    const { error } = await supabase
      .from('maintenance_requests')
      .update({ status, updated_by: supabaseUser!.id })
      .eq('id', jobId);
    if (error) { toast.show(error.message, 'error'); return; }
    const noteMap: Partial<Record<MaintenanceRequest['status'], string>> = {
      in_progress: 'Work is now in progress.',
      resolved: 'Job marked as resolved.',
      closed: 'Job closed.',
    };
    await supabase.from('maintenance_updates').insert({
      request_id: jobId,
      user_id: supabaseUser!.id,
      note: noteMap[status] ?? `Status updated to ${status.replace('_', ' ')}.`,
      status_change: status,
    });
    toast.show(t('toast.statusUpdated', { status: status.replace('_', ' ') }), 'success');
    load();
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'available', label: t('hjobs.tabAvailable') },
    { key: 'active', label: t('hjobs.tabActive') },
    { key: 'completed', label: t('hjobs.tabCompleted') },
    { key: 'history', label: t('hjobs.tabHistory') },
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <h1 className="font-display text-2xl font-bold text-gray-900 mb-6">{t('hjobs.title')}</h1>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
            style={tab === tb.key ? { background: PRIMARY, color: '#fff' } : { color: '#6b7280' }}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonList />
      ) : error ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-red-500">{error}</p>
          <button onClick={load} className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition" style={{ background: PRIMARY }}>{t('common.retry')}</button>
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={tab === 'available' ? t('hjobs.emptyAvailable') : tab === 'active' ? t('hjobs.emptyActive') : tab === 'completed' ? t('hjobs.emptyCompleted') : t('hjobs.emptyHistory')}
          description={tab === 'available' ? t('hjobs.emptyDescAvail') : tab === 'history' ? t('hjobs.emptyDescHistory') : ''}
        />
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const property = (job.tenancy as { property: Property } | null)?.property;
            return (
              <button
                key={job.id}
                onClick={() => setSelected(job)}
                className="w-full bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all text-left"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: PRIMARY }}
                  >
                    <Briefcase className="w-4 h-4" style={{ color: ACCENT }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-semibold text-gray-900">{job.title}</p>
                      <div className="flex gap-1.5 shrink-0">
                        <Badge label={t('priority.' + job.priority)} variant={priorityVariant(job.priority)} />
                        <Badge label={t('status.' + job.status)} variant={statusVariant(job.status)} />
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2">{job.description}</p>
                    <div className="flex flex-wrap gap-3 mt-2">
                      {property && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <MapPin className="w-3 h-3" />
                          {property.address_line1}, {property.city}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        {timeAgo(job.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
                {tab === 'available' && (
                  <div
                    className="mt-3 w-full py-2 rounded-xl text-center text-sm font-semibold"
                    style={{ background: ACCENT + '22', color: PRIMARY }}
                  >
                    {t('hjobs.tapToView')}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <JobDetailModal
          job={selected}
          tab={tab}
          onClose={() => setSelected(null)}
          onAccept={acceptJob}
          onUpdateStatus={updateJobStatus}
          onDrop={dropJob}
        />
      )}
    </div>
  );
}
