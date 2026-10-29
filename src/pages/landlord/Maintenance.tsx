import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Wrench, ArrowLeft, Star, UserCheck, DollarSign, Search, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { useToastStore } from '../../stores/toast';
import { repairStatusChangedEmail, quoteAcceptedEmail, statusLabel, type Lang } from '../../lib/notify';
import { MaintenanceRequest, MaintenanceStatus, MaintenanceUpdate } from '../../types';
import { formatDateTime, stateToTimezone, timeAgo, initials } from '../../lib/utils';
import Badge, { statusVariant, priorityVariant } from '../../components/shared/Badge';
import { SkeletonList } from '../../components/shared/Skeleton';
import EmptyState from '../../components/shared/EmptyState';
import { useT } from '../../lib/i18n';

const PRIMARY = '#0D1F2D';
const ACCENT = '#D4972A';

interface MR {
  id: string;
  tenancy_id: string;
  title: string;
  description: string;
  priority: MaintenanceRequest['priority'];
  status: MaintenanceRequest['status'];
  created_at: string;
  updated_at: string;
  handyman_id: string | null;
  payout_status?: 'none' | 'pending' | 'processing' | 'paid';
  payout_amount?: number | null;
  handyman_paid_at?: string | null;
  tenancy: { property_id: string; property: { address_line1: string; city: string } } | null;
  submitter: { full_name: string } | null;
  handyman: { full_name: string } | null;
}

// ─── List ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export function MaintenanceList() {
  const { supabaseUser } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useT();
  const [requests, setRequests] = useState<MR[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | MaintenanceStatus>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [tenancyIds, setTenancyIds] = useState<string[]>([]);
  const toast = useToastStore();

  useEffect(() => {
    if (supabaseUser) load(0, true);
  }, [supabaseUser]);

  // Realtime: reload when any maintenance_request changes for this landlord
  useEffect(() => {
    if (!supabaseUser) return;
    const channel = supabase
      .channel(`maintenance-landlord-${supabaseUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_requests' }, () => {
        load(0, true);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabaseUser]);

  async function load(pageNum: number, reset: boolean) {
    if (reset) setLoading(true);
    setError(null);
    try {
      let tIds = tenancyIds;
      if (reset || tIds.length === 0) {
        const propIds = (
          await supabase.from('properties').select('id').eq('landlord_id', supabaseUser!.id)
        ).data?.map((p: { id: string }) => p.id) ?? [];
        tIds = (
          await supabase.from('tenancies').select('id').in('property_id', propIds)
        ).data?.map((t: { id: string }) => t.id) ?? [];
        setTenancyIds(tIds);
      }

      if (tIds.length === 0) { setRequests([]); setLoading(false); return; }

      const from = pageNum * PAGE_SIZE;
      const { data, error: fetchErr } = await supabase
        .from('maintenance_requests')
        .select('*, tenancy:tenancy_id(property:property_id(address_line1, city, state)), submitter:submitted_by(full_name), handyman:handyman_id(full_name)')
        .in('tenancy_id', tIds)
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (fetchErr) throw fetchErr;
      const fetched = (data as MR[]) ?? [];
      setHasMore(fetched.length === PAGE_SIZE);
      setRequests((prev) => reset ? fetched : [...prev, ...fetched]);
      setPage(pageNum);
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? t('mnt.loadListFailed');
      setError(msg);
      toast.show(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    let list = filter === 'all' ? requests : requests.filter((r) => r.status === filter);
    const q = search.toLowerCase().trim();
    if (q) list = list.filter((r) =>
      `${r.title} ${(r.tenancy as { property: { address_line1: string } } | null)?.property?.address_line1 ?? ''}`.toLowerCase().includes(q)
    );
    return list;
  }, [requests, filter, search]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl font-bold text-gray-900">{t('mnt.title')}</h1>
      </div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder={t('mnt.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
        {(['all', 'open', 'assigned', 'in_progress', 'resolved', 'closed'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              filter === s ? 'text-white' : 'text-gray-500 bg-gray-100 hover:bg-gray-200'
            }`}
            style={filter === s ? { background: PRIMARY } : {}}
          >
            {s === 'all' ? t('common.all') : t('status.' + s)}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonList />
      ) : error ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-red-500">{error}</p>
          <button onClick={() => load(0, true)} className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition" style={{ background: PRIMARY }}>{t('common.retry')}</button>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Wrench} title={t('mnt.empty')} description={t('mnt.emptyDesc')} />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => navigate(`/landlord/maintenance/${r.id}`)}
              className="w-full bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all text-left flex items-start gap-4"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: PRIMARY }}>
                <Wrench className="w-4 h-4" style={{ color: ACCENT }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{r.title}</p>
                <p className="text-sm text-gray-500 line-clamp-2 mt-0.5">{r.description}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {(r.tenancy as { property: { address_line1: string } } | null)?.property?.address_line1} · {timeAgo(r.created_at)}
                  {r.handyman_id && (
                    <span className="ml-1 font-medium" style={{ color: ACCENT }}>
                      · {(r.handyman as { full_name: string } | null)?.full_name ?? t('mnt.assigned')}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <Badge label={t('status.' + r.status)} variant={statusVariant(r.status)} />
                <Badge label={t('priority.' + r.priority)} variant={priorityVariant(r.priority)} />
              </div>
            </button>
          ))}
          {hasMore && filter === 'all' && !search && (
            <button
              onClick={() => load(page + 1, false)}
              className="w-full py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
            >
              {t('common.loadMore')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Detail ──────────────────────────────────────────────────────────────────

interface FavoriteHandyman { id: string; full_name: string; }
interface Quote { id: string; handyman_id: string; amount: number; description: string | null; status: string; handyman: { full_name: string } | null; created_at: string; }
interface LinkedExpense { id: string; description: string; amount: number; category: string; expense_date: string; }

export function MaintenanceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToastStore();
  const { t } = useT();
  const { supabaseUser } = useAuthStore();
  const [request, setRequest] = useState<MR & { updates: (MaintenanceUpdate & { user: { full_name: string } | null })[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [newStatus, setNewStatus] = useState<MaintenanceStatus | ''>('');
  const [saving, setSaving] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteHandyman[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [respondingQuote, setRespondingQuote] = useState<string | null>(null);
  const [linkedExpenses, setLinkedExpenses] = useState<LinkedExpense[]>([]);
  const [payingHandyman, setPayingHandyman] = useState(false);

  async function payHandyman() {
    if (!id) return;
    setPayingHandyman(true);
    const origin = window.location.origin;
    const { data, error } = await supabase.functions.invoke('pay-handyman', {
      body: { request_id: id, success_url: `${origin}/landlord/maintenance/${id}?paid=1`, cancel_url: `${origin}/landlord/maintenance/${id}` },
    });
    setPayingHandyman(false);
    if (error || !data?.url) {
      let msg = t('mnt.payFailed');
      try {
        const body = await (error as { context?: Response })?.context?.json?.();
        if (body?.code === 'handyman_not_onboarded') msg = t('mnt.handymanNotOnboarded');
        else if (body?.code === 'no_accepted_quote') msg = t('mnt.noAcceptedQuote');
        else if (body?.code === 'payment_processing') msg = t('mnt.payAlreadyProcessing');
        else if (body?.error) msg = body.error;
      } catch { /* keep default */ }
      toast.show(msg, 'error');
      return;
    }
    window.location.href = data.url;
  }

  useEffect(() => {
    if (id) { load(); loadFavorites(); loadQuotes(); loadLinkedExpenses(); }
  }, [id]);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('maintenance_requests')
        .select('*, tenancy:tenancy_id(property_id, property:property_id(address_line1, city, state)), submitter:submitted_by(full_name), handyman:handyman_id(full_name), updates:maintenance_updates(*, user:user_id(full_name))')
        .eq('id', id)
        .single();
      if (fetchErr) throw fetchErr;
      setRequest(data as typeof request);
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? t('mnt.loadFailed');
      setLoadError(msg);
      toast.show(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadLinkedExpenses() {
    const { data } = await supabase
      .from('expenses')
      .select('id, description, amount, category, expense_date')
      .eq('maintenance_request_id', id!)
      .order('expense_date', { ascending: false });
    setLinkedExpenses((data as LinkedExpense[]) ?? []);
  }

  async function loadFavorites() {
    const { data } = await supabase
      .from('favorite_handymen')
      .select('handyman_id, handyman:handyman_id(id, full_name)')
      .eq('landlord_id', supabaseUser!.id);
    setFavorites(
      (data ?? []).map((f: any) => ({
        id: f.handyman_id,
        full_name: f.handyman?.full_name ?? 'Unknown',
      }))
    );
  }

  async function loadQuotes() {
    const { data } = await supabase
      .from('quotes')
      .select('*, handyman:handyman_id(full_name)')
      .eq('request_id', id)
      .order('created_at', { ascending: false });
    setQuotes((data as Quote[]) ?? []);
  }

  async function assignHandyman(handymanId: string) {
    setAssigning(true);
    const handymanName = favorites.find((f) => f.id === handymanId)?.full_name ?? 'Handyman';
    const wasAssigned = !!request?.handyman_id;
    const { error } = await supabase
      .from('maintenance_requests')
      .update({ handyman_id: handymanId, status: 'assigned', updated_by: supabaseUser!.id })
      .eq('id', id!);
    if (!error) {
      await supabase.from('maintenance_updates').insert({
        request_id: id!,
        user_id: supabaseUser!.id,
        note: wasAssigned ? `Reassigned to ${handymanName}.` : `Handyman assigned by landlord.`,
        status_change: 'assigned',
      });
      toast.show(t(wasAssigned ? 'toast.handymanReassigned' : 'toast.handymanAssigned'), 'success');
      load();
    } else {
      toast.show(error.message, 'error');
    }
    setAssigning(false);
  }

  async function clearAssignment() {
    setAssigning(true);
    const { error } = await supabase
      .from('maintenance_requests')
      .update({ handyman_id: null, status: 'open', updated_by: supabaseUser!.id })
      .eq('id', id!);
    if (!error) {
      await supabase.from('maintenance_updates').insert({
        request_id: id!,
        user_id: supabaseUser!.id,
        note: 'Assignment removed — ticket returned to open.',
        status_change: 'open',
      });
      toast.show(t('toast.assignmentRemoved'), 'success');
      load();
    } else {
      toast.show(error.message, 'error');
    }
    setAssigning(false);
  }

  async function respondToQuote(quoteId: string, status: 'accepted' | 'declined', handymanId?: string) {
    setRespondingQuote(quoteId);
    const { error } = await supabase.from('quotes').update({ status, updated_at: new Date().toISOString() }).eq('id', quoteId);
    if (!error && status === 'accepted' && handymanId) {
      await supabase.from('maintenance_requests').update({ handyman_id: handymanId, status: 'assigned', updated_by: supabaseUser!.id }).eq('id', id!);
      await supabase.from('maintenance_updates').insert({
        request_id: id!,
        user_id: supabaseUser!.id,
        note: 'Quote accepted — handyman assigned.',
        status_change: 'assigned',
      });
      // Notify the handyman (fire-and-forget)
      const acceptedQuote = quotes.find((q) => q.id === quoteId);
      if (acceptedQuote?.handyman_id) {
        supabase.from('users').select('email, language').eq('id', acceptedQuote.handyman_id).single().then(({ data: hUser }) => {
          if (hUser?.email && request) {
            const hl: Lang = hUser.language === 'es' ? 'es' : 'en';
            const amountStr = `$${Number(acceptedQuote.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            const landlordName = supabaseUser!.email ?? (hl === 'es' ? 'Tu arrendador' : 'Your landlord');
            quoteAcceptedEmail(hUser.email, landlordName, request.title, amountStr, hl);
          }
        });
      }
    }
    setRespondingQuote(null);
    if (error) toast.show(error.message, 'error');
    else { toast.show(t(status === 'accepted' ? 'toast.quoteAccepted' : 'toast.quoteDeclined'), 'success'); loadQuotes(); load(); }
  }

  async function handleUpdate() {
    if (!note.trim()) return;
    setSaving(true);
    const updates: { request_id: string; user_id: string; note: string; status_change?: string } = {
      request_id: id!,
      user_id: supabaseUser!.id,
      note: note.trim(),
    };
    if (newStatus) updates.status_change = newStatus;

    const { error } = await supabase.from('maintenance_updates').insert(updates);
    if (!error && newStatus) {
      await supabase.from('maintenance_requests').update({ status: newStatus, updated_by: supabaseUser!.id }).eq('id', id!);
      // Notify tenant about status change (fire-and-forget)
      if (request?.tenancy_id) {
        supabase.from('tenancies').select('tenant_id').eq('id', request.tenancy_id).single().then(({ data: tn }) => {
          if (tn?.tenant_id) {
            // Push (free) + SMS (premium) + email to the tenant, in their language — the
            // #1 documented tenant grievance is not knowing a repair's status.
            supabase.from('users').select('email, language').eq('id', tn.tenant_id).single().then(({ data: u }) => {
              const tl: Lang = u?.language === 'es' ? 'es' : 'en';
              const readable = statusLabel(tl, newStatus);
              const title = tl === 'es' ? 'Actualización de reparación' : 'Repair update';
              const body = tl === 'es'
                ? `“${request.title}” ahora está ${readable}.`
                : `“${request.title}” is now ${readable}.`;
              const smsBody = tl === 'es'
                ? `HappyHomesHub: tu reparación “${request.title}” ahora está ${readable}.`
                : `HappyHomesHub: your repair “${request.title}” is now ${readable}.`;
              supabase.functions.invoke('notify-user', {
                body: { user_id: tn.tenant_id, title, body, url: '/tenant/repairs', sms_body: smsBody },
              });
              if (u?.email) repairStatusChangedEmail(u.email, request.title, newStatus, tl);
            });
          }
        });
      }
    }
    setSaving(false);
    if (error) {
      toast.show(error.message, 'error');
    } else {
      toast.show(t('toast.updatePosted'), 'success');
      setNote('');
      setNewStatus('');
      load();
    }
  }

  if (loading) return <div className="p-8"><SkeletonList count={3} /></div>;
  if (loadError) return (
    <div className="flex flex-col items-center gap-4 py-16 text-center px-6">
      <p className="text-red-500">{loadError}</p>
      <button onClick={load} className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition" style={{ background: PRIMARY }}>{t('common.retry')}</button>
    </div>
  );
  if (!request) return <div className="p-8 text-gray-500">{t('mnt.notFound')}</div>;

  const slaDays: Record<string, number> = { urgent: 1, high: 2, medium: 7, low: 14 };
  const slaDaysVal = slaDays[request.priority] ?? 7;
  const slaDeadline = new Date(new Date(request.created_at).getTime() + slaDaysVal * 24 * 60 * 60 * 1000);
  const slaPassed = slaDeadline < new Date() && !['resolved', 'closed'].includes(request.status);
  const slaLabel = slaPassed
    ? t('mnt.overdue', { date: slaDeadline.toLocaleDateString() })
    : t('mnt.dueBy', { date: slaDeadline.toLocaleDateString(), n: slaDays[request.priority] });

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-display text-xl font-bold text-gray-900">{request.title}</h1>
          <p className="text-sm text-gray-500">
            {(request.tenancy as { property: { address_line1: string } } | null)?.property?.address_line1}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex flex-wrap gap-2 mb-3">
            <Badge label={t('status.' + request.status)} variant={statusVariant(request.status)} />
            <Badge label={t('priority.' + request.priority)} variant={priorityVariant(request.priority)} />
          </div>
          {!['resolved', 'closed'].includes(request.status) && (
            <p className={`text-xs font-medium mb-3 ${slaPassed ? 'text-red-600' : 'text-gray-500'}`}>
              {slaPassed ? '⚠ ' : '⏱ '}{slaLabel}
            </p>
          )}
          <p className="text-sm text-gray-700">{request.description}</p>
          <p className="text-xs text-gray-400 mt-3">
            {t('mnt.submittedBy', { name: (request.submitter as { full_name: string } | null)?.full_name ?? t('common.unknown'), date: formatDateTime(request.created_at, stateToTimezone((request.tenancy as any)?.property?.state)) })}
          </p>
          {request.handyman_id && (
            <p className="text-xs text-gray-500 mt-1 font-medium">
              {t('mnt.assignedHandyman', { name: (request.handyman as { full_name: string } | null)?.full_name ?? t('common.unknown') })}
            </p>
          )}
        </div>

        {/* Updates */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-800 mb-4">{t('mnt.updates')}</h2>
          <div className="space-y-3">
            {request.updates?.map((u) => {
              const updaterName = (u.user as { full_name: string } | null)?.full_name ?? t('common.unknown');
              return (
              <div key={u.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold shrink-0">
                  {updaterName.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-600 mb-0.5">{updaterName}</p>
                  <p className="text-sm text-gray-700">{u.note}</p>
                  {u.status_change && (
                    <Badge label={`→ ${t('status.' + u.status_change)}`} variant={statusVariant(u.status_change)} className="mt-1" />
                  )}
                  <p className="text-xs text-gray-400 mt-1">{timeAgo(u.created_at)}</p>
                </div>
              </div>
              );
            })}
            {!request.updates?.length && <p className="text-sm text-gray-400">{t('mnt.noUpdates')}</p>}
          </div>
        </div>

        {/* Quotes from handymen */}
        {quotes.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-800 mb-4">{t('mnt.quotesReceived')}</h2>
            <div className="space-y-3">
              {quotes.map((q) => (
                <div key={q.id} className="flex items-start justify-between gap-3 p-3 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold shrink-0">
                      {initials(q.handyman?.full_name ?? 'H')}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{q.handyman?.full_name ?? t('mnt.handyman')}</p>
                      <p className="text-xs text-gray-500">{q.description}</p>
                      <p className="text-sm font-bold mt-0.5" style={{ color: ACCENT }}>${Number(q.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {q.status === 'pending' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => respondToQuote(q.id, 'accepted', q.handyman_id)}
                          disabled={respondingQuote === q.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
                          style={{ background: '#16a34a' }}
                        >
                          {t('mnt.accept')}
                        </button>
                        <button
                          onClick={() => respondToQuote(q.id, 'declined')}
                          disabled={respondingQuote === q.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
                        >
                          {t('mnt.decline')}
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-end gap-1.5">
                        <Badge label={t('status.' + q.status)} variant={q.status === 'accepted' ? 'success' : 'neutral'} />
                        {q.status === 'accepted' && (
                          request.payout_status === 'paid' ? (
                            <span className="text-xs font-semibold text-green-600 flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" /> {t('mnt.paid')}
                            </span>
                          ) : request.payout_status === 'processing' ? (
                            // ACH debit in flight — settles in a few business days
                            <span className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" /> {t('mnt.payProcessing')}
                            </span>
                          ) : (
                            <button
                              onClick={payHandyman}
                              disabled={payingHandyman}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
                              style={{ background: PRIMARY }}
                            >
                              {payingHandyman ? t('common.redirecting') : t('mnt.pay', { amount: `$${Number(q.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` })}
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assign / Reassign from favorites */}
        {favorites.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
              <Star className="w-4 h-4" style={{ color: ACCENT }} />
              {request.handyman_id ? t('mnt.reassign') : t('mnt.assignFavorite')}
            </h2>
            {request.handyman_id && (
              <p className="text-xs text-gray-400 mb-3">
                {t('mnt.currently', { name: (request.handyman as { full_name: string } | null)?.full_name ?? t('common.unknown') })}
              </p>
            )}
            {!request.handyman_id && <div className="mb-3" />}
            <div className="flex flex-wrap gap-2">
              {favorites.map((f) => (
                <button
                  key={f.id}
                  onClick={() => assignHandyman(f.id)}
                  disabled={assigning || f.id === request.handyman_id}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition disabled:opacity-40"
                  style={f.id === request.handyman_id
                    ? { borderColor: ACCENT, background: ACCENT + '18', color: PRIMARY }
                    : { borderColor: '#e5e7eb', color: '#374151' }}
                >
                  <UserCheck className="w-4 h-4" style={{ color: f.id === request.handyman_id ? ACCENT : '#9ca3af' }} />
                  {f.full_name}
                  {f.id === request.handyman_id && <span className="text-xs ml-1">{t('mnt.current')}</span>}
                </button>
              ))}
            </div>
            {request.handyman_id && (
              <button
                onClick={clearAssignment}
                disabled={assigning}
                className="mt-3 text-xs font-semibold text-red-500 hover:text-red-700 transition disabled:opacity-50"
              >
                {t('mnt.removeAssignment')}
              </button>
            )}
          </div>
        )}

        {/* Linked Expenses */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <DollarSign className="w-4 h-4" style={{ color: ACCENT }} />
              {t('mnt.linkedExpenses')}
            </h2>
            <button
              onClick={() => {
                const propId = (request?.tenancy as { property_id?: string } | null)?.property_id ?? '';
                navigate(`/landlord/expenses/new?request_id=${id}&property_id=${propId}`);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition"
              style={{ background: PRIMARY }}
            >
              {t('mnt.addExpense')}
            </button>
          </div>
          {linkedExpenses.length === 0 ? (
            <p className="text-sm text-gray-400">{t('mnt.noExpenses')}</p>
          ) : (
            <div className="space-y-2">
              {linkedExpenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                  <div>
                    <span className="text-gray-800 font-medium">{e.description}</span>
                    <span className="text-xs text-gray-400 ml-2">{e.category}</span>
                  </div>
                  <span className="font-semibold text-gray-900">${Number(e.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold pt-2">
                <span className="text-gray-700">{t('mnt.total')}</span>
                <span style={{ color: ACCENT }}>
                  ${linkedExpenses.reduce((s, e) => s + Number(e.amount), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Post update */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-800 mb-3">{t('mnt.postUpdate')}</h2>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder={t('mnt.notePlaceholder')}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition resize-none mb-3"
          />
          <div className="flex gap-3">
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as MaintenanceStatus | '')}
              className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition"
            >
              <option value="">{t('mnt.keepStatus')}</option>
              <option value="open">{t('mnt.optOpen')}</option>
              <option value="assigned">{t('mnt.optAssigned')}</option>
              <option value="in_progress">{t('mnt.optInProgress')}</option>
              <option value="resolved">{t('mnt.optResolved')}</option>
              <option value="closed">{t('mnt.optClosed')}</option>
            </select>
            <button
              onClick={handleUpdate}
              disabled={saving || !note.trim()}
              className="px-5 py-2.5 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-50"
              style={{ background: PRIMARY }}
            >
              {saving ? t('mnt.posting') : t('mnt.post')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
