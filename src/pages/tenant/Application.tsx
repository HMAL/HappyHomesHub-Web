import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { useToastStore } from '../../stores/toast';
import { Application, ApplicationStatus, EmploymentType, ScreeningReport } from '../../types';
import { formatDateTime, formatCurrency, formatPhone } from '../../lib/utils';
import { SkeletonList } from '../../components/shared/Skeleton';
import { useT } from '../../lib/i18n';

const PRIMARY = '#12202E';
const ACCENT = '#00C8BB';

// ─── Status view ─────────────────────────────────────────────────────────────

export function ApplicationStatus_() {
  const { supabaseUser } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useT();
  const [app, setApp] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasTenancy, setHasTenancy] = useState<boolean | null>(null);

  useEffect(() => {
    if (supabaseUser) load();
  }, [supabaseUser]);

  async function load() {
    setLoading(true);
    const [{ data: appData }, { data: tenancyData }] = await Promise.all([
      supabase.from('applications').select('*').eq('applicant_id', supabaseUser!.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('tenancies').select('id').eq('tenant_id', supabaseUser!.id).in('status', ['active', 'pending_invite']).limit(1).maybeSingle(),
    ]);
    setApp(appData as Application ?? null);
    setHasTenancy(!!tenancyData);
    setLoading(false);
  }

  const steps: { key: ApplicationStatus; label: string }[] = [
    { key: 'draft', label: t('app.stepStarted') },
    { key: 'submitted', label: t('app.stepSubmitted') },
    { key: 'under_review', label: t('app.stepReview') },
    { key: 'approved', label: t('app.stepApproved') },
  ];

  const stepIndex = app ? steps.findIndex((s) => s.key === app.status) : -1;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="font-display text-2xl font-bold text-gray-900 mb-6">{t('app.pageTitle')}</h1>

      {loading ? (
        <SkeletonList count={3} />
      ) : !hasTenancy ? (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
          <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-700 mb-1">{t('app.noTenancy')}</p>
          <p className="text-sm text-gray-400">{t('app.noTenancyDesc')}</p>
        </div>
      ) : !app ? (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
          <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-700 mb-1">{t('app.noApp')}</p>
          <p className="text-sm text-gray-400 mb-4">{t('app.noAppDesc')}</p>
          <button
            onClick={() => navigate('/tenant/application/fill')}
            className="px-5 py-2.5 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition"
            style={{ background: PRIMARY }}
          >
            {t('app.startApp')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Status hero */}
          <div className="rounded-2xl p-6 text-white" style={{ background: PRIMARY }}>
            <div className="flex items-center gap-3 mb-2">
              {app.status === 'approved' ? (
                <CheckCircle className="w-8 h-8" style={{ color: ACCENT }} />
              ) : app.status === 'denied' ? (
                <XCircle className="w-8 h-8 text-red-400" />
              ) : (
                <Clock className="w-8 h-8 text-white/60" />
              )}
              <div>
                <p className="font-bold text-lg capitalize">{t('status.' + app.status)}</p>
                <p className="text-white/60 text-sm">
                  {app.status === 'approved' ? t('app.descApproved') :
                   app.status === 'denied' ? t('app.descDenied') :
                   app.status === 'draft' ? t('app.descDraft') :
                   t('app.descReview')}
                </p>
              </div>
            </div>
            {app.landlord_notes && (
              <div className="mt-3 p-3 rounded-xl bg-white/10 text-sm text-white/80">
                <p className="text-xs font-semibold text-white/50 mb-1">{t('app.landlordNotes')}</p>
                {app.landlord_notes}
              </div>
            )}
          </div>

          {/* Timeline */}
          {app.status !== 'denied' && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-gray-800 mb-4">{t('app.progress')}</h2>
              <div className="space-y-2">
                {steps.map((step, i) => (
                  <div key={step.key} className="flex items-center gap-3">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{
                        background: i <= stepIndex ? ACCENT : '#f3f4f6',
                        color: i <= stepIndex ? PRIMARY : '#9ca3af',
                      }}
                    >
                      {i < stepIndex ? '✓' : i + 1}
                    </div>
                    <p className={`text-sm font-medium ${i <= stepIndex ? 'text-gray-900' : 'text-gray-400'}`}>
                      {step.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Details */}
          {app.status !== 'draft' && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-gray-800 mb-3">{t('app.details')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {[
                  { label: t('app.lblEmployment'), value: app.employment_type?.replace('_', ' ') ?? '—' },
                  { label: t('app.lblIncome'), value: app.monthly_income ? formatCurrency(app.monthly_income) : '—' },
                  { label: t('app.lblEmployer'), value: app.employer_name ?? '—' },
                  { label: t('app.lblCurrentAddress'), value: app.current_address ?? '—' },
                  { label: t('app.lblPets'), value: app.has_pets ? t('common.yes') : t('common.no') },
                  { label: t('app.lblSubmitted'), value: app.submitted_at ? formatDateTime(app.submitted_at) : '—' },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-gray-400 text-xs">{item.label}</p>
                    <p className="font-medium text-gray-800 capitalize">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {app.status === 'draft' && (
            <button
              onClick={() => navigate('/tenant/application/fill')}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition"
              style={{ background: PRIMARY }}
            >
              {t('app.completeApp')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Fill form ───────────────────────────────────────────────────────────────

export function ApplicationFill() {
  const { supabaseUser } = useAuthStore();
  const navigate = useNavigate();
  const toast = useToastStore();
  const { t } = useT();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [employerExtension, setEmployerExtension] = useState('');
  const [screeningReport, setScreeningReport] = useState<ScreeningReport | null | undefined>(undefined);
  const [appsUsed, setAppsUsed] = useState(0);

  useEffect(() => {
    if (!supabaseUser) return;
    supabase
      .from('screening_reports')
      .select('*')
      .eq('applicant_id', supabaseUser.id)
      .gt('expires_at', new Date().toISOString())
      .in('report_status', ['pending', 'processing', 'completed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(async ({ data }) => {
        const r = (data as ScreeningReport) ?? null;
        setScreeningReport(r);
        // Count applications already used against this package (non-draft apps
        // submitted since the report was purchased) to enforce the tier cap.
        if (r && r.application_limit != null) {
          const { count } = await supabase
            .from('applications')
            .select('id', { count: 'exact', head: true })
            .eq('applicant_id', supabaseUser.id)
            .neq('status', 'draft')
            .gte('created_at', r.created_at);
          setAppsUsed(count ?? 0);
        }
      });
  }, [supabaseUser]);

  // Capped tier ($50) is exhausted once used applications reach the limit;
  // the unlimited tier ($70) has application_limit == null and never caps.
  const capReached =
    !!screeningReport &&
    screeningReport.application_limit != null &&
    appsUsed >= screeningReport.application_limit;

  const [form, setForm] = useState({
    employer_name: '', employer_phone: '', monthly_income: '',
    employment_type: 'full_time' as EmploymentType,
    current_address: '', current_landlord_name: '', current_landlord_phone: '',
    current_monthly_rent: '', reason_for_moving: '',
    has_pets: false, pet_description: '', vehicle_count: '0',
    emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relationship: '',
    background_check_consent: false, credit_check_consent: false,
  });

  function set(key: string, value: string | boolean | number) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validateStep(s: number): boolean {
    if (s === 0) {
      if (form.employment_type !== 'unemployed' && !form.monthly_income) {
        toast.show(t('toast.incomeRequired'), 'error'); return false;
      }
    }
    if (s === 1) {
      if (!form.current_address.trim()) {
        toast.show(t('toast.addressRequired'), 'error'); return false;
      }
    }
    if (s === 2) {
      if (!form.emergency_contact_name.trim()) {
        toast.show(t('toast.emergencyNameRequired'), 'error'); return false;
      }
    }
    if (s === 3) {
      if (!form.background_check_consent || !form.credit_check_consent) {
        toast.show(t('toast.consentsRequired'), 'error'); return false;
      }
      if (!screeningReport) {
        toast.show(t('toast.screeningRequired'), 'error'); return false;
      }
      if (capReached) {
        toast.show(t('toast.screeningCapReached'), 'error');
        return false;
      }
    }
    return true;
  }

  async function save(submit: boolean) {
    setSaving(true);
    const { data: tenancy } = await supabase
      .from('tenancies')
      .select('id, property_id')
      .eq('tenant_id', supabaseUser!.id)
      .in('status', ['active', 'pending_invite'])
      .limit(1)
      .single();

    if (!tenancy) { toast.show(t('toast.noTenancy'), 'error'); setSaving(false); return; }

    const { data: existing } = await supabase
      .from('applications')
      .select('id')
      .eq('tenancy_id', tenancy.id)
      .eq('applicant_id', supabaseUser!.id)
      .single();

    const payload = {
      tenancy_id: tenancy.id,
      property_id: tenancy.property_id,
      applicant_id: supabaseUser!.id,
      ...form,
      employer_phone: employerExtension.trim()
        ? `${form.employer_phone} ext. ${employerExtension.trim()}`
        : form.employer_phone,
      monthly_income: form.monthly_income ? parseFloat(form.monthly_income) : null,
      current_monthly_rent: form.current_monthly_rent ? parseFloat(form.current_monthly_rent) : null,
      vehicle_count: parseInt(form.vehicle_count) || 0,
      status: submit ? 'submitted' : 'draft',
      submitted_at: submit ? new Date().toISOString() : null,
      applicant_references: [],
      created_by: supabaseUser!.id,
      updated_by: supabaseUser!.id,
    };

    const { error } = existing
      ? await supabase.from('applications').update({ ...payload, updated_by: supabaseUser!.id }).eq('id', existing.id)
      : await supabase.from('applications').insert(payload);

    setSaving(false);
    if (error) toast.show(error.message, 'error');
    else {
      if (submit) {
        toast.show(t('toast.applicationSubmitted'), 'success');
        navigate('/tenant/application');
      } else {
        setDraftSaved(true);
        setTimeout(() => setDraftSaved(false), 3000);
      }
    }
  }

  const inp = (label: string, key: string, opts?: { type?: string; placeholder?: string }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <input
        type={opts?.type ?? 'text'}
        value={String(form[key as keyof typeof form])}
        onChange={(e) => set(key, e.target.value)}
        placeholder={opts?.placeholder}
        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#12202E] transition"
      />
    </div>
  );

  const steps = [
    <>
      <h2 className="font-semibold text-gray-800 mb-4">{t('appf.employment')}</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('appf.employmentType')}</label>
          <select value={form.employment_type} onChange={(e) => set('employment_type', e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#12202E] transition">
            <option value="full_time">{t('appf.empFullTime')}</option>
            <option value="part_time">{t('appf.empPartTime')}</option>
            <option value="self_employed">{t('appf.empSelf')}</option>
            <option value="unemployed">{t('appf.empUnemployed')}</option>
            <option value="other">{t('appf.empOther')}</option>
          </select>
        </div>
        {inp(t('appf.employerName'), 'employer_name', { placeholder: t('appf.employerNamePh') })}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('appf.employerPhone')}</label>
          <div className="flex gap-2">
            <input
              type="tel"
              value={form.employer_phone}
              onChange={(e) => set('employer_phone', formatPhone(e.target.value))}
              placeholder="(555) 010-0000"
              maxLength={14}
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#12202E] transition"
            />
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-sm text-gray-500">{t('appf.ext')}</span>
              <input
                type="text"
                value={employerExtension}
                onChange={(e) => setEmployerExtension(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="0000"
                maxLength={6}
                className="w-20 px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#12202E] transition"
              />
            </div>
          </div>
        </div>
        {inp(t('appf.monthlyIncome'), 'monthly_income', { type: 'number', placeholder: '4000' })}
      </div>
    </>,
    <>
      <h2 className="font-semibold text-gray-800 mb-4">{t('appf.currentRental')}</h2>
      <div className="space-y-4">
        {inp(t('app.lblCurrentAddress'), 'current_address', { placeholder: '123 Main St' })}
        {inp(t('appf.currentLandlordName'), 'current_landlord_name')}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('appf.currentLandlordPhone')}</label>
          <input
            type="tel"
            value={form.current_landlord_phone}
            onChange={(e) => set('current_landlord_phone', formatPhone(e.target.value))}
            placeholder="(555) 000-0000"
            maxLength={14}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#12202E] transition"
          />
        </div>
        {inp(t('appf.currentRent'), 'current_monthly_rent', { type: 'number' })}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('appf.reasonMoving')}</label>
          <textarea value={form.reason_for_moving} onChange={(e) => set('reason_for_moving', e.target.value)} rows={3} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#12202E] transition resize-none" />
        </div>
      </div>
    </>,
    <>
      <h2 className="font-semibold text-gray-800 mb-4">{t('appf.additionalInfo')}</h2>
      <div className="space-y-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={form.has_pets} onChange={(e) => set('has_pets', e.target.checked)} className="w-4 h-4" />
          <span className="text-sm font-medium text-gray-700">{t('appf.iHavePets')}</span>
        </label>
        {form.has_pets && inp(t('appf.petDesc'), 'pet_description', { placeholder: t('appf.petDescPh') })}
        {inp(t('appf.vehicleCount'), 'vehicle_count', { type: 'number' })}
        {inp(t('appf.emergencyName'), 'emergency_contact_name')}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('appf.emergencyPhone')}</label>
          <input
            type="tel"
            value={form.emergency_contact_phone}
            onChange={(e) => set('emergency_contact_phone', formatPhone(e.target.value))}
            placeholder="(555) 000-0000"
            maxLength={14}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#12202E] transition"
          />
        </div>
        {inp(t('appf.relationship'), 'emergency_contact_relationship', { placeholder: t('appf.relationshipPh') })}
      </div>
    </>,
    <>
      <h2 className="font-semibold text-gray-800 mb-4">{t('appf.consentScreening')}</h2>
      <div className="space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={form.background_check_consent} onChange={(e) => set('background_check_consent', e.target.checked)} className="w-4 h-4 mt-0.5" />
          <span className="text-sm text-gray-700">{t('appf.consentBackground')}</span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={form.credit_check_consent} onChange={(e) => set('credit_check_consent', e.target.checked)} className="w-4 h-4 mt-0.5" />
          <span className="text-sm text-gray-700">{t('appf.consentCredit')}</span>
        </label>

        {/* Screening payment gate */}
        {screeningReport === undefined ? (
          <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-500">
            {t('appf.checkingScreening')}
          </div>
        ) : screeningReport && !capReached ? (
          <div className="rounded-xl bg-teal-50 border border-teal-200 px-4 py-3 flex items-start gap-3">
            <CheckCircle className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-teal-800">{t('appf.reportOnFile')}</p>
              <p className="text-xs text-teal-600 mt-0.5">
                {screeningReport.report_status === 'completed'
                  ? t('appf.reportComplete')
                  : t('appf.reportProcessing')}
                {screeningReport.application_limit != null &&
                  t('appf.appsLeft', { n: Math.max(0, screeningReport.application_limit - appsUsed), limit: screeningReport.application_limit })}
              </p>
            </div>
          </div>
        ) : capReached ? (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">{t('appf.limitReached')}</p>
              <p className="text-xs text-amber-600 mt-0.5 mb-2">
                {t('appf.limitReachedDesc', { limit: screeningReport?.application_limit ?? 0 })}
              </p>
              <Link
                to="/tenant/screening"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white hover:opacity-90 transition"
                style={{ background: '#12202E' }}
              >
                {t('appf.upgradeUnlimited')}
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">{t('appf.screeningRequired')}</p>
              <p className="text-xs text-amber-600 mt-0.5 mb-2">
                {t('appf.screeningRequiredDesc')}
              </p>
              <Link
                to="/tenant/screening"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white hover:opacity-90 transition"
                style={{ background: '#12202E' }}
              >
                {t('appf.getScreened')}
              </Link>
            </div>
          </div>
        )}
      </div>
    </>,
  ];

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">{t('app.pageTitle')}</h1>
      <p className="text-sm text-gray-500 mb-6">{t('appf.stepOf', { n: step + 1, total: steps.length })}</p>

      {/* Progress */}
      <div className="w-full bg-gray-100 rounded-full h-1.5 mb-6">
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%`, background: ACCENT }} />
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-4">
        {steps[step]}
      </div>

      <div className="flex gap-3">
        {step > 0 && (
          <button onClick={() => setStep((s) => s - 1)} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
            {t('common.backPlain')}
          </button>
        )}
        <button
          onClick={() => save(false)}
          disabled={saving}
          className="flex-1 py-3 rounded-xl border text-sm font-semibold transition disabled:opacity-50"
          style={draftSaved
            ? { borderColor: '#16a34a', color: '#16a34a', background: '#f0fdf4' }
            : { borderColor: '#e5e7eb', color: '#4b5563', background: 'white' }}
        >
          {draftSaved ? t('appf.saved') : saving ? t('common.saving') : t('appf.saveDraft')}
        </button>
        {step < steps.length - 1 ? (
          <button
            onClick={() => { if (validateStep(step)) setStep((s) => s + 1); }}
            className="flex-1 py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition"
            style={{ background: PRIMARY }}
          >
            {t('common.next')}
          </button>
        ) : (
          <button
            onClick={() => { if (validateStep(step)) save(true); }}
            disabled={saving}
            className="flex-1 py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-60"
            style={{ background: PRIMARY }}
          >
            {saving ? t('appf.submitting') : t('appf.submitApp')}
          </button>
        )}
      </div>
    </div>
  );
}
