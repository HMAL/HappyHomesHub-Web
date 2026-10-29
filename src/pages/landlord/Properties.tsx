import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { Plus, Building2, Bed, Bath, Maximize2, ArrowLeft, Save, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { useToastStore } from '../../stores/toast';
import { Property, Tenancy } from '../../types';
import { formatCurrency } from '../../lib/utils';
import Badge, { statusVariant } from '../../components/shared/Badge';
import { SkeletonList } from '../../components/shared/Skeleton';
import EmptyState from '../../components/shared/EmptyState';
import { useT } from '../../lib/i18n';

const PRIMARY = '#0D1F2D';
const ACCENT = '#D4972A';

const US_STATES = [
  ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],
  ['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['FL','Florida'],['GA','Georgia'],
  ['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],
  ['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],
  ['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],
  ['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],
  ['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],
  ['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],
  ['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],
  ['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming'],
] as const;

// ─── List ────────────────────────────────────────────────────────────────────

interface PropWithTenancy extends Property {
  tenancies: Tenancy[];
}

export function PropertiesList() {
  const { supabaseUser } = useAuthStore();
  const toast = useToastStore();
  const { t } = useT();
  const location = useLocation();
  const [properties, setProperties] = useState<PropWithTenancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return properties;
    return properties.filter((p) =>
      `${p.address_line1} ${p.city} ${p.state} ${p.zip}`.toLowerCase().includes(q)
    );
  }, [properties, search]);

  useEffect(() => {
    if (supabaseUser) load();
  }, [supabaseUser, location.key]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('properties')
        .select('*, tenancies(*)')
        .eq('landlord_id', supabaseUser!.id)
        .order('created_at', { ascending: false });
      if (fetchErr) throw fetchErr;
      setProperties((data as PropWithTenancy[]) ?? []);
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? t('prop.loadListFailed');
      setError(msg);
      toast.show(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  const propCount = properties.length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">{t('prop.title')}</h1>
          {propCount > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              {propCount === 1
                ? t('prop.freeOne')
                : t('prop.countLine', { n: propCount })}
            </p>
          )}
        </div>
        <Link
          to="/landlord/properties/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition"
          style={{ background: PRIMARY }}
        >
          <Plus className="w-4 h-4" /> {t('prop.addProperty')}
        </Link>
      </div>
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder={t('prop.searchPlaceholder')}
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
          icon={Building2}
          title={search ? t('prop.noMatch') : t('prop.noneYet')}
          description={search ? t('prop.noMatchDesc') : t('prop.noneDesc')}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const activeTenancy = p.tenancies?.find((t) => ['active', 'pending_invite'].includes(t.status));
            return (
              <Link
                key={p.id}
                to={`/landlord/properties/${p.id}`}
                className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all flex items-start gap-4"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: PRIMARY }}
                >
                  <Building2 className="w-5 h-5" style={{ color: ACCENT }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{p.address_line1}</p>
                  {p.unit_number && <p className="text-xs text-gray-400">{t('prop.unit')} {p.unit_number}</p>}
                  <p className="text-sm text-gray-500">
                    {p.city}, {p.state} {p.zip}
                  </p>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {p.bedrooms != null && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Bed className="w-3.5 h-3.5" /> {p.bedrooms} {t('prop.bed')}
                      </span>
                    )}
                    {p.bathrooms != null && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Bath className="w-3.5 h-3.5" /> {p.bathrooms} {t('prop.bath')}
                      </span>
                    )}
                    {p.sqft != null && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Maximize2 className="w-3.5 h-3.5" /> {p.sqft.toLocaleString()} {t('prop.sqftShort')}
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    <Badge
                      label={
                        !activeTenancy
                          ? t('prop.vacant')
                          : activeTenancy.status === 'active'
                          ? t('prop.occupied')
                          : activeTenancy.tenant_id
                          ? t('prop.appPending')
                          : t('prop.inviteSent')
                      }
                      variant={
                        !activeTenancy
                          ? 'neutral'
                          : activeTenancy.status === 'active'
                          ? 'success'
                          : activeTenancy.tenant_id
                          ? 'warning'
                          : 'info'
                      }
                    />
                  </div>
                </div>
                {activeTenancy && (
                  <p className="text-sm font-bold text-gray-900 shrink-0">
                    {formatCurrency(activeTenancy.monthly_rent)}/mo
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── New / Edit ──────────────────────────────────────────────────────────────

interface FormData {
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip: string;
  bedrooms: string;
  bathrooms: string;
  sqft: string;
  notes: string;
}

const empty: FormData = {
  address_line1: '', address_line2: '', city: '', state: '', zip: '',
  bedrooms: '', bathrooms: '', sqft: '', notes: '',
};

function UpgradeWall({ count }: { count: number }) {
  const { t } = useT();
  const features = [
    t('prop.uwFeat1'), t('prop.uwFeat2'), t('prop.uwFeat3'),
    t('prop.uwFeat4'), t('prop.uwFeat5'), t('prop.uwFeat6'),
  ];
  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-12 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
        style={{ background: '#D4972A22' }}
      >
        <Building2 className="w-8 h-8" style={{ color: '#D4972A' }} />
      </div>
      <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">{t('prop.uwTitle')}</h1>
      <p className="text-gray-500 text-sm mb-1">
        {t('prop.uwHavePre')} <strong>{count} {count === 1 ? t('prop.property') : t('prop.properties')}</strong>.
      </p>
      <p className="text-gray-500 text-sm mb-8">
        {t('prop.uwTrialPre')} <strong>{t('prop.uwTrialBold')}</strong>{t('prop.uwTrialPost')} <strong>{t('prop.uwTrialPrice')}</strong>
        {' '}{t('prop.uwTrialTail')}
      </p>
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm mb-6">
        <div className="flex items-baseline justify-center gap-1 mb-1">
          <span className="font-display text-4xl font-bold text-gray-900">{t('prop.uw3Months')}</span>
          <span className="text-gray-400 text-sm">{t('prop.uwFree')}</span>
        </div>
        <p className="text-xs text-gray-400 mb-5">{t('prop.uwThen')}</p>
        <ul className="text-sm text-gray-600 space-y-2 text-left mb-5">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-green-100 text-green-600 text-xs flex items-center justify-center shrink-0">✓</span>
              {f}
            </li>
          ))}
        </ul>
        <Link
          to="/landlord/account/billing"
          className="block w-full py-3 rounded-xl text-sm font-bold text-center transition hover:opacity-90"
          style={{ background: '#0D1F2D', color: '#D4972A' }}
        >
          {t('prop.uwStartTrial')}
        </Link>
      </div>
      <button
        onClick={() => window.history.back()}
        className="text-sm text-gray-400 hover:text-gray-600 transition"
      >
        {t('prop.uwGoBack')}
      </button>
    </div>
  );
}

export function PropertyNew() {
  const navigate = useNavigate();
  const { supabaseUser } = useAuthStore();
  const toast = useToastStore();
  const { t } = useT();
  const [form, setForm] = useState<FormData>(empty);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [saving, setSaving] = useState(false);
  const [propertyCount, setPropertyCount] = useState<number | null>(null);
  const [hasActiveSub, setHasActiveSub] = useState(false);

  useEffect(() => {
    if (supabaseUser) checkLimit();
  }, [supabaseUser]);

  async function checkLimit() {
    const [{ count }, { data: sub }] = await Promise.all([
      supabase
        .from('properties')
        .select('id', { count: 'exact', head: true })
        .eq('landlord_id', supabaseUser!.id),
      supabase
        .from('subscriptions')
        .select('status')
        .eq('landlord_id', supabaseUser!.id)
        .maybeSingle(),
    ]);
    setPropertyCount(count ?? 0);
    setHasActiveSub(sub?.status === 'active' || sub?.status === 'trialing');
  }

  function validate() {
    const e: Partial<FormData> = {};
    if (!form.address_line1.trim()) e.address_line1 = t('prop.addrRequired');
    if (!form.city.trim()) e.city = t('prop.cityRequired');
    if (!form.state.trim()) e.state = t('prop.stateRequired');
    if (!form.zip.trim()) e.zip = t('prop.zipRequired');
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);

    const uid = supabaseUser!.id;

    // Ensure user profile row exists — FK on created_by/updated_by requires it
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', uid)
      .maybeSingle();

    if (!existingUser) {
      const email = supabaseUser!.email ?? '';
      const fullName =
        (supabaseUser!.user_metadata?.full_name as string | undefined) ??
        email.split('@')[0] ??
        'User';
      const { error: profileErr } = await supabase
        .from('users')
        .insert({ id: uid, email, full_name: fullName });
      if (profileErr) {
        setSaving(false);
        toast.show(t('toast.createProfileFailed', { msg: profileErr.message }), 'error');
        return;
      }
    }

    const { error } = await supabase.from('properties').insert({
      landlord_id: uid,
      address_line1: form.address_line1.trim(),
      address_line2: form.address_line2.trim() || null,
      city: form.city.trim(),
      state: form.state.trim(),
      zip: form.zip.trim(),
      country: 'US',
      bedrooms: form.bedrooms ? parseInt(form.bedrooms) : null,
      bathrooms: form.bathrooms ? parseFloat(form.bathrooms) : null,
      sqft: form.sqft ? parseInt(form.sqft) : null,
      notes: form.notes.trim() || null,
      created_by: uid,
      updated_by: uid,
    });

    setSaving(false);
    if (error) {
      toast.show(error.message, 'error');
    } else {
      toast.show(t('toast.propertyAdded'), 'success');
      navigate('/landlord/properties');
    }
  }

  function field(label: string, key: keyof FormData, opts?: { placeholder?: string; type?: string }) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
        <input
          type={opts?.type ?? 'text'}
          value={form[key]}
          onChange={(e) => {
            setForm((f) => ({ ...f, [key]: e.target.value }));
            setErrors((er) => ({ ...er, [key]: undefined }));
          }}
          placeholder={opts?.placeholder}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition"
        />
        {errors[key] && <p className="text-xs text-red-500 mt-1">{errors[key]}</p>}
      </div>
    );
  }

  if (propertyCount === null) {
    return <div className="flex items-center justify-center min-h-[300px]"><div className="w-7 h-7 border-4 border-gray-200 border-t-gray-700 rounded-full animate-spin" /></div>;
  }
  // Adding a property beyond the first requires an active or trialing subscription.
  // (The first is allowed through so new landlords can set up and then start their
  // 3-month trial from the billing page.)
  if (propertyCount >= 1 && !hasActiveSub) {
    return <UpgradeWall count={propertyCount} />;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display text-2xl font-bold text-gray-900">{t('prop.addProperty')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        {field(t('prop.streetAddress'), 'address_line1', { placeholder: '123 Main St' })}
        {field(t('prop.aptSuite'), 'address_line2', { placeholder: 'Apt 2B' })}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {field(t('prop.city'), 'city', { placeholder: 'Austin' })}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('prop.state')}</label>
            <select
              value={form.state}
              onChange={(e) => {
                setForm((f) => ({ ...f, state: e.target.value }));
                setErrors((er) => ({ ...er, state: undefined }));
              }}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition bg-white"
            >
              <option value="">{t('common.select')}</option>
              {US_STATES.map(([abbr, name]) => (
                <option key={abbr} value={abbr}>{abbr} – {name}</option>
              ))}
            </select>
            {errors.state && <p className="text-xs text-red-500 mt-1">{errors.state}</p>}
          </div>
          {field(t('prop.zip'), 'zip', { placeholder: '78701' })}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {field(t('prop.bedrooms'), 'bedrooms', { type: 'number', placeholder: '3' })}
          {field(t('prop.bathrooms'), 'bathrooms', { type: 'number', placeholder: '2' })}
          {field(t('prop.sqft'), 'sqft', { type: 'number', placeholder: '1200' })}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('prop.notes')}</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={3}
            placeholder={t('prop.notesPlaceholder')}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition resize-none"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-60"
          style={{ background: PRIMARY }}
        >
          {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? t('common.saving') : t('prop.saveProperty')}
        </button>
      </form>
    </div>
  );
}

// ─── Edit ────────────────────────────────────────────────────────────────────

export function PropertyEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { supabaseUser } = useAuthStore();
  const toast = useToastStore();
  const { t } = useT();
  const [form, setForm] = useState<FormData>(empty);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) load();
  }, [id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('properties').select('*').eq('id', id).single();
    if (data) {
      const p = data as Property;
      setForm({
        address_line1: p.address_line1 ?? '',
        address_line2: p.address_line2 ?? '',
        city: p.city ?? '',
        state: p.state ?? '',
        zip: p.zip ?? '',
        bedrooms: p.bedrooms != null ? String(p.bedrooms) : '',
        bathrooms: p.bathrooms != null ? String(p.bathrooms) : '',
        sqft: p.sqft != null ? String(p.sqft) : '',
        notes: p.notes ?? '',
      });
    }
    setLoading(false);
  }

  function validate() {
    const e: Partial<FormData> = {};
    if (!form.address_line1.trim()) e.address_line1 = t('prop.addrRequired');
    if (!form.city.trim()) e.city = t('prop.cityRequired');
    if (!form.state.trim()) e.state = t('prop.stateRequired');
    if (!form.zip.trim()) e.zip = t('prop.zipRequired');
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const { error } = await supabase.from('properties').update({
      address_line1: form.address_line1.trim(),
      address_line2: form.address_line2.trim() || null,
      city: form.city.trim(),
      state: form.state.trim(),
      zip: form.zip.trim(),
      bedrooms: form.bedrooms ? parseInt(form.bedrooms) : null,
      bathrooms: form.bathrooms ? parseFloat(form.bathrooms) : null,
      sqft: form.sqft ? parseInt(form.sqft) : null,
      notes: form.notes.trim() || null,
      updated_by: supabaseUser!.id,
    }).eq('id', id!);
    setSaving(false);
    if (error) {
      toast.show(error.message, 'error');
    } else {
      toast.show(t('toast.propertyUpdated'), 'success');
      navigate(`/landlord/properties/${id}`);
    }
  }

  function field(label: string, key: keyof FormData, opts?: { placeholder?: string; type?: string }) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
        <input
          type={opts?.type ?? 'text'}
          value={form[key]}
          onChange={(e) => {
            setForm((f) => ({ ...f, [key]: e.target.value }));
            setErrors((er) => ({ ...er, [key]: undefined }));
          }}
          placeholder={opts?.placeholder}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition"
        />
        {errors[key] && <p className="text-xs text-red-500 mt-1">{errors[key]}</p>}
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center min-h-[300px]"><div className="w-7 h-7 border-4 border-gray-200 border-t-gray-700 rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display text-2xl font-bold text-gray-900">{t('prop.editProperty')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        {field(t('prop.streetAddress'), 'address_line1', { placeholder: '123 Main St' })}
        {field(t('prop.aptSuite'), 'address_line2', { placeholder: 'Apt 2B' })}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {field(t('prop.city'), 'city', { placeholder: 'Austin' })}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('prop.state')}</label>
            <select
              value={form.state}
              onChange={(e) => {
                setForm((f) => ({ ...f, state: e.target.value }));
                setErrors((er) => ({ ...er, state: undefined }));
              }}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition bg-white"
            >
              <option value="">{t('common.select')}</option>
              {US_STATES.map(([abbr, name]) => (
                <option key={abbr} value={abbr}>{abbr} – {name}</option>
              ))}
            </select>
            {errors.state && <p className="text-xs text-red-500 mt-1">{errors.state}</p>}
          </div>
          {field(t('prop.zip'), 'zip', { placeholder: '78701' })}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {field(t('prop.bedrooms'), 'bedrooms', { type: 'number', placeholder: '3' })}
          {field(t('prop.bathrooms'), 'bathrooms', { type: 'number', placeholder: '2' })}
          {field(t('prop.sqft'), 'sqft', { type: 'number', placeholder: '1200' })}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('prop.notes')}</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={3}
            placeholder={t('prop.notesPlaceholder')}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition resize-none"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-60"
          style={{ background: PRIMARY }}
        >
          {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? t('common.saving') : t('common.saveChanges')}
        </button>
      </form>
    </div>
  );
}

// ─── Detail ──────────────────────────────────────────────────────────────────

export function PropertyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useT();
  const [property, setProperty] = useState<PropWithTenancy | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const detailToast = useToastStore();

  useEffect(() => {
    if (id) load();
  }, [id]);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('properties')
        .select('*, tenancies(*, tenant:tenant_id(full_name, email))')
        .eq('id', id)
        .single();
      if (fetchErr) throw fetchErr;
      setProperty(data as PropWithTenancy);
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? t('prop.loadFailed');
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
  if (!property) return <div className="p-8 text-gray-500">{t('prop.notFound')}</div>;

  const p = property;
  const activeTenancy = p.tenancies?.find((t) => ['active', 'pending_invite'].includes(t.status));

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-xl font-bold text-gray-900">{p.address_line1}</h1>
          <p className="text-sm text-gray-500">{p.city}, {p.state} {p.zip}</p>
        </div>
        <Link
          to={`/landlord/properties/${p.id}/edit`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition shrink-0"
        >
          <Save className="w-3 h-3" /> {t('common.edit')}
        </Link>
      </div>

      <div className="space-y-4">
        {/* Property info */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-800 mb-4">{t('prop.details')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: t('prop.bedrooms'), value: p.bedrooms ?? '—' },
              { label: t('prop.bathrooms'), value: p.bathrooms ?? '—' },
              { label: t('prop.sqft'), value: p.sqft ? p.sqft.toLocaleString() : '—' },
              { label: t('prop.unitLabel'), value: p.unit_number ?? '—' },
            ].map((item) => (
              <div key={item.label} className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-lg font-bold text-gray-900">{item.value}</p>
                <p className="text-xs text-gray-500">{item.label}</p>
              </div>
            ))}
          </div>
          {p.notes && <p className="mt-4 text-sm text-gray-600 bg-gray-50 rounded-xl p-3">{p.notes}</p>}
        </div>

        {/* Active tenancy */}
        {activeTenancy ? (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">{t('prop.currentTenancy')}</h2>
              <Badge label={t('status.' + activeTenancy.status)} variant={statusVariant(activeTenancy.status)} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {activeTenancy.tenant && (
                <div>
                  <p className="text-gray-400 text-xs">{t('common.tenant')}</p>
                  <p className="font-medium">{(activeTenancy.tenant as { full_name: string }).full_name}</p>
                </div>
              )}
              <div>
                <p className="text-gray-400 text-xs">{t('prop.monthlyRent')}</p>
                <p className="font-medium">{formatCurrency(activeTenancy.monthly_rent)}</p>
              </div>
              {activeTenancy.lease_start && (
                <div>
                  <p className="text-gray-400 text-xs">{t('prop.leaseStart')}</p>
                  <p className="font-medium">{activeTenancy.lease_start}</p>
                </div>
              )}
              {activeTenancy.lease_end && (
                <div>
                  <p className="text-gray-400 text-xs">{t('prop.leaseEnd')}</p>
                  <p className="font-medium">{activeTenancy.lease_end}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
            <p className="text-gray-500 mb-3">{t('prop.noActiveTenancy')}</p>
            <Link
              to="/landlord/invite"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: PRIMARY }}
            >
              {t('prop.inviteTenant')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
