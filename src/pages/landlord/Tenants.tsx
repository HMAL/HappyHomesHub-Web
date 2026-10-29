import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Mail, X, Phone, Calendar, DollarSign, Home, MessageSquare, LogOut, CheckCircle, XCircle, Pencil, Search, Columns2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { useToastStore } from '../../stores/toast';
import { Tenancy, Property, User, ApplicationStatus } from '../../types';
import { formatDate, formatDateTime, stateToTimezone, initials, formatCurrency, formatPhone } from '../../lib/utils';
import Badge, { statusVariant } from '../../components/shared/Badge';
import { SkeletonList } from '../../components/shared/Skeleton';
import EmptyState from '../../components/shared/EmptyState';
import { useT } from '../../lib/i18n';

const PRIMARY = '#0D1F2D';
const ACCENT = '#D4972A';

interface TenantRow {
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
  property: Property;
  tenant: (User & { phone?: string }) | null;
  application_status: ApplicationStatus | null;
}

function TenantDetailPanel({
  row,
  onClose,
  onEnded,
  onUpdated,
}: {
  row: TenantRow;
  onClose: () => void;
  onEnded: (id: string) => void;
  onUpdated: (id: string, changes: Partial<TenantRow>) => void;
}) {
  const navigate = useNavigate();
  const toast = useToastStore();
  const { t } = useT();
  const { supabaseUser } = useAuthStore();
  const [ending, setEnding] = useState(false);
  const [approving, setApproving] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmDeny, setConfirmDeny] = useState(false);
  const [editingLease, setEditingLease] = useState(false);
  const [leaseStart, setLeaseStart] = useState('');
  const [leaseEnd, setLeaseEnd] = useState('');
  const [savingLease, setSavingLease] = useState(false);

  function startEditingLease() {
    setLeaseStart(row.lease_start ?? '');
    setLeaseEnd(row.lease_end ?? '');
    setEditingLease(true);
  }

  async function approveApplication() {
    setApproving(true);
    const { error: appErr } = await supabase
      .from('applications')
      .update({ status: 'approved', updated_by: supabaseUser!.id })
      .eq('tenancy_id', row.id);
    if (appErr) { toast.show(appErr.message, 'error'); setApproving(false); return; }
    const { error: tenancyErr } = await supabase
      .from('tenancies')
      .update({ status: 'active', updated_by: supabaseUser!.id })
      .eq('id', row.id);
    setApproving(false);
    if (tenancyErr) { toast.show(tenancyErr.message, 'error'); return; }
    toast.show(t('toast.appApproved'), 'success');
    onUpdated(row.id, { status: 'active', application_status: 'approved' });
    onClose();
  }

  async function denyApplication() {
    setConfirmDeny(false);
    const { error } = await supabase
      .from('applications')
      .update({ status: 'denied', updated_by: supabaseUser!.id })
      .eq('tenancy_id', row.id);
    if (error) { toast.show(error.message, 'error'); return; }
    toast.show(t('toast.appDenied'), 'success');
    onUpdated(row.id, { application_status: 'denied' });
    onClose();
  }

  async function saveLease() {
    if (leaseStart && leaseEnd && leaseEnd < leaseStart) {
      toast.show(t('toast.leaseDateOrder'), 'error');
      return;
    }
    setSavingLease(true);
    const { error } = await supabase
      .from('tenancies')
      .update({ lease_start: leaseStart || null, lease_end: leaseEnd || null, updated_by: supabaseUser!.id })
      .eq('id', row.id);
    setSavingLease(false);
    if (error) { toast.show(error.message, 'error'); return; }
    toast.show(t('toast.leaseDatesUpdated'), 'success');
    onUpdated(row.id, { lease_start: leaseStart || undefined, lease_end: leaseEnd || undefined });
    setEditingLease(false);
  }

  async function handleEndTenancy() {
    setConfirmEnd(false);
    setEnding(true);
    const { error } = await supabase
      .from('tenancies')
      .update({ status: 'ended', updated_by: supabaseUser!.id })
      .eq('id', row.id);
    setEnding(false);
    if (error) { toast.show(error.message, 'error'); return; }
    toast.show(t('toast.tenancyEnded'), 'success');
    onEnded(row.id);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100" style={{ background: PRIMARY }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
              style={{ background: ACCENT, color: PRIMARY }}
            >
              {row.tenant ? initials(row.tenant.full_name) : '?'}
            </div>
            <div>
              <p className="font-bold text-white">{row.tenant?.full_name ?? t('tnt.pendingTenant')}</p>
              <p className="text-white/60 text-xs">{row.tenant?.email ?? t('tnt.noEmail')}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-6 space-y-5">
          {/* Status */}
          <div className="flex gap-2 flex-wrap">
            <Badge label={t('status.' + row.status)} variant={statusVariant(row.status)} />
            {row.application_status && (
              <Badge label={`${t('tnt.appLabel')}: ${t('status.' + row.application_status)}`} variant={statusVariant(row.application_status)} />
            )}
          </div>

          {/* Application review — shown when landlord action is needed */}
          {(row.application_status === 'submitted' || row.application_status === 'under_review') && (
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
              <p className="text-sm font-semibold text-amber-800 mb-1">{t('tnt.appAwaiting')}</p>
              <p className="text-xs text-amber-600 mb-3">
                {t('tnt.appSubmittedDesc', { name: row.tenant?.full_name ?? t('common.tenant') })}
              </p>
              {confirmDeny ? (
                <div className="flex items-center gap-2 mt-2 p-3 rounded-xl bg-red-50 border border-red-200">
                  <p className="text-xs text-red-700 flex-1">{t('tnt.denyConfirm')}</p>
                  <button onClick={denyApplication} disabled={approving}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-50">
                    {t('tnt.yesDeny')}
                  </button>
                  <button onClick={() => setConfirmDeny(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition">
                    {t('common.cancel')}
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={approveApplication}
                    disabled={approving}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50"
                    style={{ background: '#16a34a' }}
                  >
                    <CheckCircle className="w-4 h-4" />
                    {approving ? t('tnt.approving') : t('tnt.approve')}
                  </button>
                  <button
                    onClick={() => setConfirmDeny(true)}
                    disabled={approving}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    {t('tnt.deny')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Property info */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1">
              <Home className="w-4 h-4" style={{ color: ACCENT }} />
              {t('tnt.property')}
            </div>
            <p className="text-sm text-gray-800">{row.property?.address_line1}</p>
            <p className="text-xs text-gray-500">
              {row.property?.city}, {row.property?.state} {row.property?.zip}
            </p>
          </div>

          {/* Financial */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1">
              <DollarSign className="w-4 h-4" style={{ color: ACCENT }} />
              {t('tnt.financials')}
            </div>
            {[
              { label: t('prop.monthlyRent'), value: formatCurrency(row.monthly_rent) },
              { label: t('tnt.securityDeposit'), value: formatCurrency(row.deposit_amount) },
              { label: t('tnt.depositCollected'), value: row.deposit_collected ? t('common.yes') : t('common.no') },
            ].map((f) => (
              <div key={f.label} className="flex justify-between text-sm">
                <span className="text-gray-500">{f.label}</span>
                <span className="font-semibold text-gray-800">{f.value}</span>
              </div>
            ))}
          </div>

          {/* Lease dates — always shown, editable */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Calendar className="w-4 h-4" style={{ color: ACCENT }} />
                {t('tnt.leaseDates')}
              </div>
              {!editingLease && (
                <button
                  onClick={startEditingLease}
                  className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg hover:bg-gray-100 transition"
                  style={{ color: ACCENT }}
                >
                  <Pencil className="w-3 h-3" /> {t('common.edit')}
                </button>
              )}
            </div>
            {editingLease ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('prop.leaseStart')}</label>
                  <input
                    type="date"
                    value={leaseStart}
                    onChange={(e) => setLeaseStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('prop.leaseEnd')}</label>
                  <input
                    type="date"
                    value={leaseEnd}
                    onChange={(e) => setLeaseEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={saveLease}
                    disabled={savingLease}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50"
                    style={{ background: PRIMARY }}
                  >
                    {savingLease ? t('common.saving') : t('tnt.saveDates')}
                  </button>
                  <button
                    onClick={() => setEditingLease(false)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-100 transition"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('tnt.start')}</span>
                  <span className="font-semibold text-gray-800">{row.lease_start ? formatDate(row.lease_start) : '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('tnt.end')}</span>
                  <span className="font-semibold text-gray-800">{row.lease_end ? formatDate(row.lease_end) : '—'}</span>
                </div>
              </>
            )}
          </div>

          {/* Contact */}
          {row.tenant && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700 mb-1">{t('tnt.contact')}</p>
              {row.tenant.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <a href={`mailto:${row.tenant.email}`} className="text-blue-600 hover:underline">{row.tenant.email}</a>
                </div>
              )}
              {row.tenant.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <a href={`tel:${row.tenant.phone}`} className="text-blue-600 hover:underline">{formatPhone(row.tenant.phone)}</a>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2 pt-2">
            {row.tenant && (
              <button
                onClick={() => { navigate(`/landlord/messages/${row.id}`); onClose(); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition"
                style={{ background: PRIMARY }}
              >
                <MessageSquare className="w-4 h-4" />
                {t('tnt.messageTenant')}
              </button>
            )}
            {(row.status === 'active' || row.status === 'pending_invite') && (
              confirmEnd ? (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 space-y-2">
                  <p className="text-xs font-semibold text-red-700">{t('tnt.endConfirm', { name: row.tenant?.full_name ?? t('tnt.thisTenant') })}</p>
                  <p className="text-xs text-red-600">{t('tnt.endConfirmDesc')}</p>
                  <div className="flex gap-2">
                    <button onClick={handleEndTenancy} disabled={ending}
                      className="flex-1 py-2 rounded-xl text-xs font-bold text-white hover:opacity-90 transition disabled:opacity-50"
                      style={{ background: '#dc2626' }}>
                      {ending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : t('tnt.yesEnd')}
                    </button>
                    <button onClick={() => setConfirmEnd(false)}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition">
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmEnd(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition"
                  style={{ background: '#dc2626' }}
                >
                  <LogOut className="w-4 h-4" />
                  {t('tnt.endTenancy')}
                </button>
              )
            )}
          </div>

          <p className="text-xs text-gray-400 text-center">{t('tnt.createdAt', { date: formatDateTime(row.created_at, stateToTimezone(row.property?.state)) })}</p>
        </div>
      </div>
    </div>
  );
}

// ── Application compare modal ─────────────────────────────────────────────────

interface AppData {
  tenancy_id: string;
  applicant: { full_name: string; email: string } | null;
  monthly_income?: number;
  employment_type?: string;
  employer_name?: string;
  has_pets: boolean;
  pet_description?: string;
  vehicle_count: number;
  applicant_references: { name: string; relationship: string }[];
  background_check_consent: boolean;
  credit_check_consent: boolean;
  status: string;
  submitted_at?: string;
}

function CompareModal({ tenancyIds, onClose }: { tenancyIds: string[]; onClose: () => void }) {
  const toast = useToastStore();
  const { t } = useT();
  const [apps, setApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('applications')
      .select('tenancy_id, monthly_income, employment_type, employer_name, has_pets, pet_description, vehicle_count, applicant_references, background_check_consent, credit_check_consent, status, submitted_at, applicant:applicant_id(full_name, email)')
      .in('tenancy_id', tenancyIds)
      .then(({ data, error }) => {
        if (error) toast.show(error.message, 'error');
        setApps((data as unknown as AppData[]) ?? []);
        setLoading(false);
      });
  }, []);

  const colW = apps.length === 2 ? 'w-1/2' : 'w-1/3';

  function row(label: string, vals: (string | number | boolean | undefined | null)[]) {
    return (
      <div key={label} className="flex border-b border-gray-100 last:border-0">
        <div className="w-28 shrink-0 px-3 py-2.5 text-xs font-semibold text-gray-500 bg-gray-50 border-r border-gray-100">
          {label}
        </div>
        {vals.map((v, i) => (
          <div key={i} className={`${colW} px-3 py-2.5 text-sm text-gray-800 border-r border-gray-100 last:border-0`}>
            {v == null || v === '' ? <span className="text-gray-300">—</span> : String(v)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100" style={{ background: '#0D1F2D' }}>
          <p className="font-bold text-white">{t('tnt.compareTitle', { n: apps.length })}</p>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
            </div>
          ) : apps.length === 0 ? (
            <p className="text-center text-gray-400 py-10 text-sm">{t('tnt.noApps')}</p>
          ) : (
            <div className="text-sm">
              {/* Header row */}
              <div className="flex border-b border-gray-200 bg-gray-50">
                <div className="w-28 shrink-0 px-3 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide border-r border-gray-100" />
                {apps.map((a) => (
                  <div key={a.tenancy_id} className={`${colW} px-3 py-3 font-bold text-gray-900 border-r border-gray-100 last:border-0`}>
                    {a.applicant?.full_name ?? t('tnt.applicant')}
                    <p className="text-xs font-normal text-gray-400">{a.applicant?.email}</p>
                  </div>
                ))}
              </div>
              {row(t('tnt.income'), apps.map((a) => a.monthly_income != null ? `$${Number(a.monthly_income).toLocaleString()}/mo` : null))}
              {row(t('tnt.employment'), apps.map((a) => a.employment_type?.replace('_', ' ') ?? null))}
              {row(t('tnt.employer'), apps.map((a) => a.employer_name ?? null))}
              {row(t('tnt.pets'), apps.map((a) => a.has_pets ? (a.pet_description || t('common.yes')) : t('common.no')))}
              {row(t('tnt.vehicles'), apps.map((a) => a.vehicle_count))}
              {row(t('tnt.references'), apps.map((a) => a.applicant_references?.length ?? 0))}
              {row(t('tnt.background'), apps.map((a) => a.background_check_consent ? t('tnt.consented') : t('tnt.notConsented')))}
              {row(t('tnt.credit'), apps.map((a) => a.credit_check_consent ? t('tnt.consented') : t('tnt.notConsented')))}
              {row(t('tnt.statusLabel'), apps.map((a) => a.status ? t('status.' + a.status) : null))}
              {row(t('tnt.submitted'), apps.map((a) => a.submitted_at ? new Date(a.submitted_at).toLocaleDateString() : null))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Tenants() {
  const navigate = useNavigate();
  const { t } = useT();
  const { supabaseUser } = useAuthStore();
  const [rows, setRows] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<TenantRow | null>(null);
  const [search, setSearch] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [showCompare, setShowCompare] = useState(false);
  const toast = useToastStore();

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((t) =>
      `${t.tenant?.full_name ?? ''} ${t.tenant?.email ?? ''} ${t.property?.address_line1 ?? ''}`.toLowerCase().includes(q)
    );
  }, [rows, search]);

  useEffect(() => {
    if (supabaseUser) load();
  }, [supabaseUser]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data: props } = await supabase.from('properties').select('id').eq('landlord_id', supabaseUser!.id);
      const propIds = (props ?? []).map((p: { id: string }) => p.id);

      if (propIds.length === 0) { setLoading(false); return; }

      const { data: tenancies, error: tenancyErr } = await supabase
        .from('tenancies')
        .select('*, property:property_id(*), tenant:tenant_id(id, full_name, email, phone, avatar_url, created_at, updated_at)')
        .in('property_id', propIds)
        .order('created_at', { ascending: false });

      if (tenancyErr) throw tenancyErr;
      if (!tenancies) { setLoading(false); return; }

      const tenancyIds = tenancies.map((t: { id: string }) => t.id);
      const { data: apps } = await supabase
        .from('applications')
        .select('tenancy_id, status')
        .in('tenancy_id', tenancyIds);

      const appMap = new Map((apps ?? []).map((a: { tenancy_id: string; status: ApplicationStatus }) => [a.tenancy_id, a.status]));

      setRows(
        tenancies.map((t: Tenancy & { property: Property; tenant: User | null }) => ({
          ...t,
          application_status: (appMap.get(t.id) as ApplicationStatus) ?? null,
        })),
      );
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? t('tnt.loadFailed');
      setError(msg);
      toast.show(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl font-bold text-gray-900">{t('tnt.title')}</h1>
        <div className="flex items-center gap-2">
          {rows.some((r) => r.application_status === 'submitted' || r.application_status === 'under_review') && (
            <button
              onClick={() => { setCompareMode((v) => !v); setCompareIds(new Set()); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                compareMode ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              {compareMode ? t('tnt.cancelCompare') : t('tnt.compare')}
            </button>
          )}
          <Link
            to="/landlord/invite"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition"
            style={{ background: PRIMARY }}
          >
            <Mail className="w-4 h-4" /> {t('tnt.inviteTenant')}
          </Link>
        </div>
      </div>
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder={t('tnt.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition"
        />
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
          icon={Users}
          title={search ? t('tnt.noMatch') : t('tnt.noneYet')}
          description={search ? t('tnt.noMatchDesc') : t('tnt.noneDesc')}
          action={!search ? { label: t('tnt.inviteTenant'), onClick: () => navigate('/landlord/invite') } : undefined}
        />
      ) : (
        <>
          <div className="space-y-3">
            {filtered.map((tn) => {
              const isComparable = tn.application_status === 'submitted' || tn.application_status === 'under_review';
              const isChecked = compareIds.has(tn.id);
              return (
                <button
                  key={tn.id}
                  onClick={() => {
                    if (compareMode) {
                      if (!isComparable) return;
                      setCompareIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(tn.id)) next.delete(tn.id); else next.add(tn.id);
                        return next;
                      });
                    } else {
                      setSelected(tn);
                    }
                  }}
                  className={`w-full bg-white rounded-xl p-4 shadow-sm border transition-all text-left flex items-center gap-4 ${
                    compareMode && isComparable
                      ? isChecked
                        ? 'border-blue-400 ring-2 ring-blue-200 hover:shadow-md'
                        : 'border-gray-100 hover:border-blue-200 hover:shadow-md'
                      : 'border-gray-100 hover:shadow-md'
                  } ${compareMode && !isComparable ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {compareMode && isComparable && (
                    <div className={`w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition ${
                      isChecked ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                    }`}>
                      {isChecked && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                    </div>
                  )}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: ACCENT, color: PRIMARY }}
                  >
                    {tn.tenant ? initials(tn.tenant.full_name) : '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">
                      {tn.tenant?.full_name ?? `${t('tnt.invited')} — ${tn.property?.address_line1}`}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {tn.tenant?.email ?? t('tnt.pendingInvite')}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{tn.property?.address_line1}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <Badge label={t('status.' + tn.status)} variant={statusVariant(tn.status)} />
                    {tn.application_status && (
                      <Badge label={`${t('tnt.appLabel')}: ${t('status.' + tn.application_status)}`} variant={statusVariant(tn.application_status)} />
                    )}
                    <p className="text-xs text-gray-500">{formatCurrency(tn.monthly_rent)}/mo</p>
                    {tn.lease_end && (
                      <p className="text-xs text-gray-400">{t('tnt.ends')} {formatDate(tn.lease_end)}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Compare floating bar */}
          {compareMode && compareIds.size >= 2 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-white rounded-2xl shadow-2xl border border-blue-200 px-5 py-3">
              <p className="text-sm font-semibold text-gray-800">{t('tnt.applicantsSelected', { n: compareIds.size })}</p>
              <button
                onClick={() => setShowCompare(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 transition"
                style={{ background: '#0D1F2D' }}
              >
                <Columns2 className="w-4 h-4" />
                {t('tnt.compareSideBySide')}
              </button>
            </div>
          )}
        </>
      )}

      {selected && (
        <TenantDetailPanel
          row={selected}
          onClose={() => setSelected(null)}
          onEnded={(id) => setRows((prev) => prev.map((r) => r.id === id ? { ...r, status: 'ended' as Tenancy['status'] } : r))}
          onUpdated={(id, changes) => {
            setRows((prev) => prev.map((r) => r.id === id ? { ...r, ...changes } : r));
            setSelected((prev) => prev?.id === id ? { ...prev, ...changes } : prev);
          }}
        />
      )}

      {showCompare && (
        <CompareModal
          tenancyIds={Array.from(compareIds)}
          onClose={() => setShowCompare(false)}
        />
      )}
    </div>
  );
}
