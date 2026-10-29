import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Plus, X, Building2, Users, Wrench,
  ArrowRight, CheckCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { useToastStore } from '../../stores/toast';
import { useT } from '../../lib/i18n';
import type { UserRole } from '../../types';
import {
  HANDYMAN_SERVICES as HANDYMAN_SERVICES_CONST,
  SERVICE_RADII as SERVICE_RADII_CONST,
  US_STATES as US_STATES_FULL,
} from '../../lib/constants';

// ── shared constants ──────────────────────────────────────────────────────────

const ROLE_META: Record<string, {
  labelKey: string;
  icon: typeof Shield;
  color: string;
  bg: string;
  descKey: string;
}> = {
  landlord: { labelKey: 'rm.role_landlord', icon: Building2, color: '#D4972A', bg: '#0D1F2D', descKey: 'rm.roleDesc_landlord' },
  tenant:   { labelKey: 'rm.role_tenant',  icon: Users,     color: '#00C8BB', bg: '#12202E', descKey: 'rm.roleDesc_tenant' },
  handyman: { labelKey: 'rm.role_handyman',  icon: Wrench,    color: '#34D399', bg: '#1B3A2F', descKey: 'rm.roleDesc_handyman' },
};

const SERVICE_KEYS: Record<string, string> = Object.fromEntries(HANDYMAN_SERVICES_CONST.map((s) => [s, `rm.svc_${s}`]));
const RADIUS_KEYS: Record<string, string> = Object.fromEntries(SERVICE_RADII_CONST.map((r) => [r, `rm.radius_${r}`]));

const US_STATES = US_STATES_FULL.map(([abbr]) => abbr);
const HANDYMAN_SERVICES = [...HANDYMAN_SERVICES_CONST];
const SERVICE_RADII = [...SERVICE_RADII_CONST];

const inputCls = 'w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] focus:border-transparent transition bg-white';

// ── Add Landlord modal ────────────────────────────────────────────────────────

function AddLandlordModal({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const { supabaseUser, loadRoles } = useAuthStore();
  const toast = useToastStore();
  const { t } = useT();
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity]     = useState('');
  const [state, setState]   = useState('');
  const [zip, setZip]       = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone]     = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!street.trim() || !city.trim() || !state || !zip.trim()) {
      toast.show(t('toast.allAddressRequired'), 'error');
      return;
    }
    setSaving(true);
    const uid = supabaseUser!.id;

    // 1. Add landlord role
    const { error: roleErr } = await supabase.from('role_assignments').insert({
      user_id: uid, role: 'landlord', context_id: uid,
      context_type: 'global', created_by: uid, updated_by: uid,
    });
    if (roleErr && !roleErr.message.includes('duplicate')) {
      toast.show(t('toast.addRoleFailed', { msg: roleErr.message }), 'error');
      setSaving(false);
      return;
    }

    // 2. Create first property
    const { error: propErr } = await supabase.from('properties').insert({
      landlord_id: uid,
      address_line1: street.trim(),
      city: city.trim(),
      state,
      zip: zip.trim(),
      created_by: uid,
      updated_by: uid,
    });
    if (propErr) {
      toast.show(t('toast.rolePropFailed', { msg: propErr.message }), 'error');
    }

    // 3. Save business name if provided
    if (businessName.trim()) {
      await supabase.from('users').update({ business_name: businessName.trim() }).eq('id', uid);
    }

    await loadRoles();
    setSaving(false);
    setDone(true);
    onSuccess();
  }

  if (done) {
    return (
      <div className="text-center py-4">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
        <p className="font-bold text-gray-900 mb-1">{t('rm.landlordActivated')}</p>
        <p className="text-sm text-gray-500 mb-5">{t('rm.landlordActivatedDesc')}</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => { onClose(); navigate('/landlord/invite'); }}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0D1F2D] text-white font-semibold text-sm hover:opacity-90 transition"
          >
            {t('rm.inviteHabitant')} <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => { onClose(); navigate('/landlord'); }}
            className="py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition"
          >
            {t('rm.goLandlordDash')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-[#D4972A] uppercase tracking-wide mb-3">{t('rm.yourHomeownerProfile')}</p>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('rm.businessName')} <span className="text-gray-400 font-normal">{t('rm.optional')}</span></label>
        <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder={t('rm.businessPhLandlord')} className={inputCls} />
      </div>
      <div>
        <p className="text-xs font-semibold text-[#D4972A] uppercase tracking-wide mb-3">{t('rm.firstPropertyAddr')}</p>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('prop.streetAddress')}</label>
        <input type="text" value={street} onChange={(e) => setStreet(e.target.value)} placeholder="123 Main St" className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('prop.city')}</label>
          <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Austin" className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('prop.state')}</label>
          <select value={state} onChange={(e) => setState(e.target.value)} className={inputCls}>
            <option value="">{t('rm.select')}</option>
            {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="w-1/2">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('rm.zipCode')}</label>
        <input type="text" value={zip} onChange={(e) => setZip(e.target.value)} placeholder="78701" maxLength={10} className={inputCls} />
      </div>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
          {t('common.cancel')}
        </button>
        <button type="submit" disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0D1F2D] text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-60">
          {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
          {saving ? t('rm.activating') : t('rm.activateLandlord')}
        </button>
      </div>
    </form>
  );
}

// ── Add Handyman modal ────────────────────────────────────────────────────────

const HANDYMAN_AVAIL_OPTIONS = [
  { key: 'weekdays', labelKey: 'hprof.av_weekdays' },
  { key: 'weekends', labelKey: 'hprof.av_weekends' },
  { key: 'evenings', labelKey: 'hprof.av_evenings' },
  { key: 'anytime', labelKey: 'hprof.av_anytime' },
  { key: 'by_appointment', labelKey: 'hprof.av_by_appointment' },
];

function AddHandymanModal({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const { supabaseUser, loadRoles } = useAuthStore();
  const toast = useToastStore();
  const { t } = useT();
  const navigate = useNavigate();
  const [serviceZip, setServiceZip]       = useState('');
  const [serviceRadius, setServiceRadius] = useState('');
  const [services, setServices]           = useState<string[]>([]);
  const [availability, setAvailability]   = useState<string[]>([]);
  const [workingHours, setWorkingHours]   = useState('');
  const [businessName, setBusinessName]   = useState('');
  const [bio, setBio]                     = useState('');
  const [saving, setSaving]               = useState(false);
  const [done, setDone]                   = useState(false);

  function toggleService(s: string) {
    setServices((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }

  function toggleAvail(a: string) {
    setAvailability((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (services.length === 0)  { toast.show(t('toast.selectService'), 'error'); return; }
    if (!serviceZip.trim())     { toast.show(t('toast.serviceZipRequired'), 'error'); return; }
    if (!serviceRadius)         { toast.show(t('toast.selectRadius'), 'error'); return; }
    setSaving(true);
    const uid = supabaseUser!.id;

    // 1. Add handyman role
    const { error: roleErr } = await supabase.from('role_assignments').insert({
      user_id: uid, role: 'handyman', context_id: uid,
      context_type: 'global', created_by: uid, updated_by: uid,
    });
    if (roleErr && !roleErr.message.includes('duplicate')) {
      toast.show(t('toast.addRoleFailed', { msg: roleErr.message }), 'error');
      setSaving(false);
      return;
    }

    // 2. Create/update handyman profile
    await supabase.from('handyman_profiles').upsert({
      user_id: uid,
      skills: services,
      availability,
      service_area: `${serviceZip} (${serviceRadius})`,
      working_hours: workingHours.trim() || null,
      is_available: true,
      bio: bio.trim() || null,
    }, { onConflict: 'user_id' });

    // 3. Save business name if provided
    if (businessName.trim()) {
      await supabase.from('users').update({ business_name: businessName.trim() }).eq('id', uid);
    }

    await loadRoles();
    setSaving(false);
    setDone(true);
    onSuccess();
  }

  if (done) {
    return (
      <div className="text-center py-4">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
        <p className="font-bold text-gray-900 mb-1">{t('rm.handymanActivated')}</p>
        <p className="text-sm text-gray-500 mb-5">{t('rm.handymanActivatedDesc')}</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => { onClose(); navigate('/handyman'); }}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1B3A2F] text-white font-semibold text-sm hover:opacity-90 transition"
          >
            {t('rm.goHandymanDash')} <ArrowRight className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition">
            {t('rm.stayHere')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs font-semibold text-[#34D399] uppercase tracking-wide mb-1">{t('rm.serviceDetails')}</p>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('rm.businessName')} <span className="text-gray-400 font-normal">{t('rm.optional')}</span></label>
        <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder={t('rm.businessPhHandyman')} className={inputCls} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('rm.serviceZip')}</label>
          <input type="text" value={serviceZip} onChange={(e) => setServiceZip(e.target.value)} placeholder="78701" maxLength={10} className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('rm.serviceRadius')}</label>
          <select value={serviceRadius} onChange={(e) => setServiceRadius(e.target.value)} className={inputCls}>
            <option value="">{t('rm.select')}</option>
            {SERVICE_RADII.map((r) => <option key={r} value={r}>{t(RADIUS_KEYS[r] ?? r)}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('rm.workingHours')} <span className="text-gray-400 font-normal">{t('rm.optional')}</span></label>
        <input type="text" value={workingHours} onChange={(e) => setWorkingHours(e.target.value)} placeholder={t('rm.workingHoursPh')} className={inputCls} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('hprof.availability')}</label>
        <div className="flex flex-wrap gap-2">
          {HANDYMAN_AVAIL_OPTIONS.map(({ key, labelKey }) => {
            const on = availability.includes(key);
            return (
              <button key={key} type="button" onClick={() => toggleAvail(key)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition ${on ? 'border-[#1B3A2F] bg-[#1B3A2F] text-[#34D399]' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                {t(labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('rm.servicesProvide')}</label>
        <div className="flex flex-wrap gap-2">
          {HANDYMAN_SERVICES.map((s) => {
            const on = services.includes(s);
            return (
              <button key={s} type="button" onClick={() => toggleService(s)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition ${on ? 'border-[#1B3A2F] bg-[#1B3A2F] text-[#34D399]' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                {t(SERVICE_KEYS[s] ?? s)}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('rm.shortBio')} <span className="text-gray-400 font-normal">{t('rm.optional')}</span></label>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} placeholder={t('rm.bioPh')}
          className={inputCls + ' resize-none'} />
      </div>

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
          {t('common.cancel')}
        </button>
        <button type="submit" disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1B3A2F] text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-60">
          {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
          {saving ? t('rm.activating') : t('rm.activateHandyman')}
        </button>
      </div>
    </form>
  );
}

// ── Main RoleManager component ────────────────────────────────────────────────

interface Props {
  /** Roles the "Add" section should offer. Defaults to ['landlord','handyman']. */
  offeredRoles?: UserRole[];
}

export default function RoleManager({ offeredRoles = ['landlord', 'handyman'] }: Props) {
  const { roles, supabaseUser, loadRoles } = useAuthStore();
  const toast = useToastStore();
  const { t } = useT();
  const [modalRole, setModalRole] = useState<UserRole | null>(null);
  const [removingRole, setRemovingRole] = useState<string | null>(null);
  const [confirmRemoveRole, setConfirmRemoveRole] = useState<string | null>(null);

  const currentRoleNames = roles.map((r) => r.role);
  const addableRoles = offeredRoles.filter((r) => !currentRoleNames.includes(r));

  async function handleRemoveRole(role: UserRole) {
    if (!supabaseUser) return;
    if (roles.length <= 1) {
      toast.show(t('toast.keepOneRole'), 'error');
      return;
    }

    // Pre-checks
    if (role === 'landlord') {
      const { count } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .eq('landlord_id', supabaseUser.id);
      if ((count ?? 0) > 0) {
        toast.show(t('toast.removePropsFirst'), 'error');
        return;
      }
      const { count: tenantCount } = await supabase
        .from('tenancies')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .in('property_id',
          (await supabase.from('properties').select('id').eq('landlord_id', supabaseUser.id)).data?.map((p) => p.id) ?? []
        );
      if ((tenantCount ?? 0) > 0) {
        toast.show(t('toast.endTenanciesFirst'), 'error');
        return;
      }
    }

    if (role === 'handyman') {
      const { count } = await supabase
        .from('maintenance_requests')
        .select('*', { count: 'exact', head: true })
        .eq('handyman_id', supabaseUser.id)
        .in('status', ['open', 'assigned', 'in_progress']);
      if ((count ?? 0) > 0) {
        toast.show(t('toast.finishJobsFirst'), 'error');
        return;
      }
    }

    setRemovingRole(role);
    await supabase.from('role_assignments').delete()
      .eq('user_id', supabaseUser.id)
      .eq('role', role);
    await loadRoles();
    setRemovingRole(null);
    setConfirmRemoveRole(null);
    toast.show(t('toast.roleRemoved', { role: ROLE_META[role] ? t(ROLE_META[role].labelKey) : role }), 'success');
  }

  return (
    <>
      {/* Roles & Access card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
          <Shield className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700">{t('rm.rolesAccess')}</h2>
        </div>
        <div className="p-5 space-y-3">
          {/* Current roles */}
          {roles.map((assignment) => {
            const meta = ROLE_META[assignment.role];
            if (!meta) return null;
            const canRemove = roles.length > 1 && (assignment.role === 'landlord' || assignment.role === 'handyman');
            return (
              <div key={assignment.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: meta.bg }}>
                  <meta.icon className="w-4 h-4" style={{ color: meta.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{t(meta.labelKey)}</p>
                  <p className="text-xs text-gray-500">{t(meta.descKey)}</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 shrink-0">{t('lacct.activeShort')}</span>
                {canRemove && (
                  confirmRemoveRole === assignment.role ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleRemoveRole(assignment.role as UserRole)}
                        disabled={!!removingRole}
                        className="px-2 py-1 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-1"
                      >
                        {removingRole === assignment.role
                          ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : null}
                        {t('common.yes')}
                      </button>
                      <button
                        onClick={() => setConfirmRemoveRole(null)}
                        className="px-2 py-1 rounded-lg text-xs font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition"
                      >
                        {t('common.no')}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmRemoveRole(assignment.role)}
                      disabled={!!removingRole}
                      title={t('rm.removeRoleTitle', { role: t(meta.labelKey) })}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-40"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )
                )}
              </div>
            );
          })}

          {/* Add role buttons */}
          {addableRoles.length > 0 && (
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">{t('rm.addAnother')}</p>
              <div className="flex gap-2 flex-wrap">
                {addableRoles.map((role) => {
                  const meta = ROLE_META[role];
                  return (
                    <button key={role} onClick={() => setModalRole(role)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition">
                      <Plus className="w-3 h-3" /> {t('rm.addAs', { role: t(meta.labelKey) })}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Role setup modal */}
      {modalRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                {(() => {
                  const meta = ROLE_META[modalRole];
                  const Icon = meta.icon;
                  return (
                    <>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: meta.bg }}>
                        <Icon className="w-4 h-4" style={{ color: meta.color }} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{t('rm.addRoleTitle', { role: t(meta.labelKey) })}</p>
                        <p className="text-xs text-gray-500">{t('rm.fillDetails')}</p>
                      </div>
                    </>
                  );
                })()}
              </div>
              <button onClick={() => setModalRole(null)} className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6">
              {modalRole === 'landlord' && (
                <AddLandlordModal
                  onSuccess={() => {}}
                  onClose={() => setModalRole(null)}
                />
              )}
              {modalRole === 'handyman' && (
                <AddHandymanModal
                  onSuccess={() => {}}
                  onClose={() => setModalRole(null)}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
