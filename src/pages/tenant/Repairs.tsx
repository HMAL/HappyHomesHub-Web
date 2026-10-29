import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Wrench, Plus, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { useToastStore } from '../../stores/toast';
import { MaintenanceRequest, MaintenancePriority, MaintenanceStatus, MaintenanceUpdate } from '../../types';
import { formatDateTime, timeAgo } from '../../lib/utils';
import { repairSubmittedEmail, type Lang } from '../../lib/notify';
import { maybePromptForPush } from '../../lib/push';
import Badge, { statusVariant, priorityVariant } from '../../components/shared/Badge';
import { SkeletonList } from '../../components/shared/Skeleton';
import { useT } from '../../lib/i18n';
import EmptyState from '../../components/shared/EmptyState';
import RepairTimeline from '../../components/shared/RepairTimeline';

const PRIMARY = '#12202E';
const ACCENT = '#00C8BB';

type MR = MaintenanceRequest & {
  updates?: (MaintenanceUpdate & { user: { full_name: string } | null })[];
  handyman?: { full_name: string } | null;
};

// ─── List ────────────────────────────────────────────────────────────────────

export function RepairsList() {
  const { supabaseUser } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useT();
  const [requests, setRequests] = useState<MR[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | MaintenanceStatus>('all');
  const [tenancyId, setTenancyId] = useState<string | null>(null);
  const toast = useToastStore();

  useEffect(() => {
    if (supabaseUser) load();
  }, [supabaseUser]);

  // Realtime: re-fetch when any maintenance_request changes for this tenancy
  useEffect(() => {
    if (!tenancyId) return;
    const channel = supabase
      .channel(`repairs-tenant-${tenancyId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'maintenance_requests',
        filter: `tenancy_id=eq.${tenancyId}`,
      }, () => loadForTenancy(tenancyId))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenancyId]);

  async function loadForTenancy(tid: string) {
    const { data, error: fetchErr } = await supabase
      .from('maintenance_requests')
      .select('*')
      .eq('tenancy_id', tid)
      .order('created_at', { ascending: false });
    if (!fetchErr) setRequests((data as MR[]) ?? []);
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data: tenancy } = await supabase
        .from('tenancies')
        .select('id')
        .eq('tenant_id', supabaseUser!.id)
        .in('status', ['active', 'pending_invite'])
        .limit(1)
        .single();

      if (!tenancy) { setLoading(false); return; }
      setTenancyId(tenancy.id);

      const { data, error: fetchErr } = await supabase
        .from('maintenance_requests')
        .select('*')
        .eq('tenancy_id', tenancy.id)
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setRequests((data as MR[]) ?? []);
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? t('rep.failedLoad');
      setError(msg);
      toast.show(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-900">{t('sidebar.repairs')}</h1>
        <button
          onClick={() => navigate('/tenant/repairs/new')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition"
          style={{ background: PRIMARY }}
        >
          <Plus className="w-4 h-4" /> {t('rep.reportIssue')}
        </button>
      </div>

      {/* Stats row */}
      {requests.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: t('status.open'), count: requests.filter((r) => r.status === 'open').length },
            { label: t('status.in_progress'), count: requests.filter((r) => r.status === 'in_progress').length },
            { label: t('status.resolved'), count: requests.filter((r) => r.status === 'resolved').length },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
              <p className="text-xl font-bold text-gray-900">{s.count}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
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
          <button onClick={load} className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition" style={{ background: PRIMARY }}>{t('common.retry')}</button>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title={t('rep.noneTitle')}
          description={t('rep.noneDesc')}
          action={{ label: t('rep.reportIssue'), onClick: () => navigate('/tenant/repairs/new') }}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => navigate(`/tenant/repairs/${r.id}`)}
              className="w-full bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all text-left flex items-start gap-4"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: PRIMARY }}>
                <Wrench className="w-4 h-4" style={{ color: ACCENT }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{r.title}</p>
                <p className="text-sm text-gray-500 line-clamp-2 mt-0.5">{r.description}</p>
                <p className="text-xs text-gray-400 mt-1">{timeAgo(r.created_at)}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <Badge label={t('status.' + r.status)} variant={statusVariant(r.status)} />
                <Badge label={t('priority.' + r.priority)} variant={priorityVariant(r.priority)} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── New ─────────────────────────────────────────────────────────────────────

export function RepairNew() {
  const navigate = useNavigate();
  const { supabaseUser, profile } = useAuthStore();
  const toast = useToastStore();
  const { t } = useT();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<MaintenancePriority>('medium');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) { toast.show(t('toast.fillAllFields'), 'error'); return; }
    setSaving(true);

    const { data: tenancy } = await supabase
      .from('tenancies')
      .select('id, property:property_id(address_line1, city, state, landlord_id)')
      .eq('tenant_id', supabaseUser!.id)
      .in('status', ['active', 'pending_invite'])
      .limit(1)
      .single();

    if (!tenancy) { toast.show(t('toast.noActiveTenancy'), 'error'); setSaving(false); return; }

    const { error } = await supabase.from('maintenance_requests').insert({
      tenancy_id: tenancy.id,
      submitted_by: supabaseUser!.id,
      title: title.trim(),
      description: description.trim(),
      priority,
      status: 'open',
      created_by: supabaseUser!.id,
      updated_by: supabaseUser!.id,
    });

    setSaving(false);
    if (error) { toast.show(error.message, 'error'); return; }

    toast.show(t('toast.repairSubmitted'), 'success');

    // First meaningful action — a good moment to ask about notifications so the
    // tenant can be alerted when their repair progresses (not on first load).
    maybePromptForPush();

    // Notify landlord by email (fire-and-forget)
    const prop = (tenancy as unknown as { property: { address_line1: string; city: string; state: string; landlord_id: string } }).property;
    if (prop?.landlord_id) {
      supabase.from('users').select('email, language').eq('id', prop.landlord_id).single().then(({ data }) => {
        if (data?.email) {
          const ll: Lang = data.language === 'es' ? 'es' : 'en';
          repairSubmittedEmail(
            data.email,
            profile?.full_name ?? (ll === 'es' ? 'Tu inquilino' : 'Your tenant'),
            title.trim(),
            `${prop.address_line1}, ${prop.city}, ${prop.state}`,
            ll,
          );
        }
      });
    }

    navigate('/tenant/repairs');
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display text-2xl font-bold text-gray-900">{t('rep.reportTitle')}</h1>
      </div>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('rep.issueTitle')}</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder={t('rep.issueTitlePlaceholder')} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#12202E] transition" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('rep.description')}</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={4} placeholder={t('rep.descPlaceholder')} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#12202E] transition resize-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('rep.priority')}</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value as MaintenancePriority)} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#12202E] transition">
            <option value="low">{t('rep.prioLow')}</option>
            <option value="medium">{t('rep.prioMedium')}</option>
            <option value="high">{t('rep.prioHigh')}</option>
            <option value="urgent">{t('rep.prioUrgent')}</option>
          </select>
        </div>
        <button type="submit" disabled={saving} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-60" style={{ background: PRIMARY }}>
          {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Wrench className="w-4 h-4" />}
          {saving ? t('rep.submitting') : t('rep.submitRequest')}
        </button>
      </form>
    </div>
  );
}

// ─── Detail ──────────────────────────────────────────────────────────────────

export function RepairDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useT();
  const detailToast = useToastStore();
  const [request, setRequest] = useState<MR | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (id) load();
  }, [id]);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('maintenance_requests')
        .select('*, handyman:handyman_id(full_name), updates:maintenance_updates(*, user:user_id(full_name))')
        .eq('id', id)
        .single();
      if (fetchErr) throw fetchErr;
      setRequest(data as MR);
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? t('rep.failedLoadOne');
      setLoadError(msg);
      detailToast.show(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-8"><SkeletonList count={3} /></div>;
  if (loadError) return (
    <div className="flex flex-col items-center gap-4 py-16 text-center px-6">
      <p className="text-red-500">{loadError}</p>
      <button onClick={load} className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition" style={{ background: PRIMARY }}>{t('common.retry')}</button>
    </div>
  );
  if (!request) return <div className="p-8 text-gray-500">{t('rep.notFound')}</div>;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display text-xl font-bold text-gray-900">{request.title}</h1>
      </div>

      <div className="space-y-4">
        <RepairTimeline status={request.status} scheduledFor={request.scheduled_for} accent={ACCENT} />

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex flex-wrap gap-2 mb-3">
            <Badge label={t('status.' + request.status)} variant={statusVariant(request.status)} />
            <Badge label={t('priority.' + request.priority)} variant={priorityVariant(request.priority)} />
          </div>
          <p className="text-sm text-gray-700">{request.description}</p>
          <p className="text-xs text-gray-400 mt-3">{t('rep.submitted', { date: formatDateTime(request.created_at) })}</p>
          {request.handyman && (
            <div className="mt-3 flex items-center gap-2 bg-emerald-50 rounded-xl px-3 py-2.5 border border-emerald-100">
              <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700 shrink-0">
                {(request.handyman.full_name ?? 'H').charAt(0)}
              </div>
              <div>
                <p className="text-xs font-semibold text-emerald-800">{request.handyman.full_name}</p>
                <p className="text-xs text-emerald-600">{t('rep.assignedHandyman')}</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-800 mb-4">{t('rep.statusUpdates')}</h2>
          {!request.updates?.length ? (
            <p className="text-sm text-gray-400">{t('rep.noUpdates')}</p>
          ) : (
            <div className="space-y-3">
              {request.updates.map((u) => {
                const updaterName = (u.user as { full_name: string } | null)?.full_name ?? t('common.unknown');
                return (
                <div key={u.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: ACCENT + '22', color: ACCENT }}>
                    {updaterName.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-0.5">{updaterName}</p>
                    <p className="text-sm text-gray-700">{u.note}</p>
                    {u.status_change && <Badge label={`→ ${t('status.' + u.status_change)}`} variant={statusVariant(u.status_change)} className="mt-1" />}
                    <p className="text-xs text-gray-400 mt-1">{timeAgo(u.created_at)}</p>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
