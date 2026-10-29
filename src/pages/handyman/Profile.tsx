import { useEffect, useState } from 'react';
import { Save, Star, ToggleLeft, ToggleRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { useToastStore } from '../../stores/toast';
import { HandymanProfile, HandymanReview, HandymanSkill, HandymanAvailability } from '../../types';
import { formatPhone, isValidPhone } from '../../lib/utils';
import { SkeletonList } from '../../components/shared/Skeleton';
import { useT } from '../../lib/i18n';

const PRIMARY = '#1B3A2F';
const ACCENT = '#34D399';

const ALL_SKILLS: HandymanSkill[] = [
  'Plumbing', 'Electrical', 'HVAC', 'Carpentry', 'Painting',
  'Appliance Repair', 'Roofing', 'Flooring', 'Landscaping',
  'Cleaning', 'Pest Control', 'Welding', 'Masonry', 'Other',
];

const ALL_AVAIL: { key: HandymanAvailability; labelKey: string }[] = [
  { key: 'weekdays', labelKey: 'hprof.av_weekdays' },
  { key: 'weekends', labelKey: 'hprof.av_weekends' },
  { key: 'evenings', labelKey: 'hprof.av_evenings' },
  { key: 'anytime', labelKey: 'hprof.av_anytime' },
  { key: 'by_appointment', labelKey: 'hprof.av_by_appointment' },
];

export default function HandymanProfilePage() {
  const { supabaseUser, profile: authProfile } = useAuthStore();
  const toast = useToastStore();
  const { t, lang } = useT();
  const [profile, setProfile] = useState<HandymanProfile | null>(null);
  const [skills, setSkills] = useState<HandymanSkill[]>([]);
  const [avail, setAvail] = useState<HandymanAvailability[]>([]);
  const [serviceArea, setServiceArea] = useState('');
  const [servicePhone, setServicePhone] = useState('');
  const [workingHours, setWorkingHours] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [bio, setBio] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<(HandymanReview & { reviewer: { full_name: string } | null })[]>([]);

  useEffect(() => {
    if (supabaseUser) { load(); loadReviews(); }
  }, [supabaseUser]);

  async function loadReviews() {
    const { data } = await supabase
      .from('handyman_reviews')
      .select('*, reviewer:reviewer_id(full_name)')
      .eq('handyman_user_id', supabaseUser!.id)
      .order('created_at', { ascending: false })
      .limit(10);
    setReviews((data as any[]) ?? []);
  }

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('handyman_profiles')
      .select('*')
      .eq('user_id', supabaseUser!.id)
      .single();
    if (data) {
      const p = data as HandymanProfile;
      setProfile(p);
      setSkills(p.skills ?? []);
      setAvail(p.availability ?? []);
      setServiceArea(p.service_area ?? '');
      setServicePhone(p.service_phone ?? '');
      setWorkingHours(p.working_hours ?? '');
      setBio(p.bio ?? '');
      setIsAvailable(p.is_available);
    }
    setBusinessName(authProfile?.business_name ?? '');
    setLoading(false);
  }

  function toggleSkill(s: HandymanSkill) {
    setSkills((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }

  function toggleAvail(a: HandymanAvailability) {
    setAvail((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  }

  async function handleSave() {
    if (!serviceArea.trim()) { toast.show(t('toast.serviceAreaRequired'), 'error'); return; }
    if (skills.length === 0) { toast.show(t('toast.selectSkill'), 'error'); return; }
    if (servicePhone && !isValidPhone(servicePhone)) { toast.show(t('toast.servicePhone10'), 'error'); return; }
    setSaving(true);

    const payload = {
      user_id: supabaseUser!.id,
      skills,
      availability: avail,
      service_area: serviceArea.trim(),
      service_phone: servicePhone.trim() || null,
      working_hours: workingHours.trim() || null,
      bio: bio.trim() || null,
      is_available: isAvailable,
      verified: profile?.verified ?? false,
      completed_jobs: profile?.completed_jobs ?? 0,
    };

    const { error } = profile
      ? await supabase.from('handyman_profiles').update(payload).eq('user_id', supabaseUser!.id)
      : await supabase.from('handyman_profiles').insert(payload);

    if (!error && businessName.trim() !== (authProfile?.business_name ?? '')) {
      await supabase.from('users').update({ business_name: businessName.trim() || null }).eq('id', supabaseUser!.id);
    }

    setSaving(false);
    if (error) toast.show(error.message, 'error');
    else { toast.show(t('toast.profileSaved'), 'success'); load(); }
  }

  // Profile completeness score (0–100)
  const completeness = (() => {
    let score = 0;
    if (skills.length > 0) score += 30;       // required
    if (serviceArea.trim()) score += 25;       // required
    if (avail.length > 0) score += 20;
    if (bio.trim()) score += 10;
    if (businessName.trim()) score += 8;
    if (servicePhone.trim()) score += 4;
    if (workingHours.trim()) score += 3;
    return Math.min(score, 100);
  })();

  const completenessLabel = completeness >= 90 ? t('hprof.cComplete') : completeness >= 60 ? t('hprof.cGood') : completeness >= 30 ? t('hprof.cNeedsWork') : t('hprof.cIncomplete');
  const completenessColor = completeness >= 90 ? '#34D399' : completeness >= 60 ? '#FCD34D' : '#F87171';

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <SkeletonList count={4} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-900">{t('hprof.title')}</h1>
        <button
          onClick={() => setIsAvailable(!isAvailable)}
          className="flex items-center gap-2 text-sm font-semibold"
          style={{ color: isAvailable ? ACCENT : '#9ca3af' }}
        >
          {isAvailable ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
          {isAvailable ? t('hm.available') : t('hm.unavailable')}
        </button>
      </div>

      {/* Profile completeness */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-gray-700">{t('hprof.completeness')}</p>
          <span className="text-sm font-bold" style={{ color: completenessColor }}>
            {completeness}% — {completenessLabel}
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${completeness}%`, background: completenessColor }}
          />
        </div>
        {completeness < 100 && (
          <p className="text-xs text-gray-400 mt-2">
            {!skills.length && t('hprof.hintSkills')}
            {!serviceArea.trim() && t('hprof.hintServiceArea')}
            {!avail.length && t('hprof.hintAvailability')}
            {!bio.trim() && t('hprof.hintBio')}
            {!businessName.trim() && t('hprof.hintBusinessName')}
          </p>
        )}
      </div>

      <div className="space-y-4">
        {/* Skills */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-800 mb-3">{t('hprof.skillsReq')}</h2>
          <div className="flex flex-wrap gap-2">
            {ALL_SKILLS.map((s) => (
              <button
                key={s}
                onClick={() => toggleSkill(s)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                style={
                  skills.includes(s)
                    ? { background: PRIMARY, color: ACCENT, borderColor: PRIMARY }
                    : { background: '#f9fafb', color: '#6b7280', borderColor: '#e5e7eb' }
                }
              >
                {t('hm.skill_' + s)}
              </button>
            ))}
          </div>
        </div>

        {/* Availability */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-800 mb-3">{t('hprof.availability')}</h2>
          <div className="flex flex-wrap gap-2">
            {ALL_AVAIL.map((a) => (
              <button
                key={a.key}
                onClick={() => toggleAvail(a.key)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                style={
                  avail.includes(a.key)
                    ? { background: PRIMARY, color: ACCENT, borderColor: PRIMARY }
                    : { background: '#f9fafb', color: '#6b7280', borderColor: '#e5e7eb' }
                }
              >
                {t(a.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Details */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
          <h2 className="font-semibold text-gray-800">{t('hprof.details')}</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('hprof.businessName')}</label>
            <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder={t('hprof.businessNamePh')}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A2F] transition" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('hprof.serviceAreaReq')}</label>
            <input type="text" value={serviceArea} onChange={(e) => setServiceArea(e.target.value)} placeholder={t('hprof.serviceAreaPh')}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A2F] transition" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('hprof.servicePhone')}</label>
            <input type="tel" value={servicePhone} onChange={(e) => setServicePhone(formatPhone(e.target.value))} placeholder="(555) 000-0000" maxLength={14}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A2F] transition" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('hprof.workingHours')}</label>
            <input type="text" value={workingHours} onChange={(e) => setWorkingHours(e.target.value)} placeholder={t('hprof.workingHoursPh')}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A2F] transition" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('hprof.pricing')}</label>
            <p className="text-sm text-gray-500 bg-gray-50 px-4 py-3 rounded-xl">{t('hprof.pricingNote')}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('hprof.bio')}</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder={t('hprof.bioPh')}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A2F] transition resize-none"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-60"
          style={{ background: PRIMARY }}
        >
          {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? t('common.saving') : t('hprof.saveProfile')}
        </button>

        {/* Reviews section */}
        {reviews.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-4 h-4 text-amber-500" fill="#f59e0b" />
              <h2 className="font-semibold text-gray-800">
                {t('hprof.reviews', { n: reviews.length })}
                {profile?.rating != null && profile.rating > 0 && (
                  <span className="text-amber-600 ml-2">{t('hprof.avg', { rating: Number(profile.rating).toFixed(1) })}</span>
                )}
              </h2>
            </div>
            <div className="space-y-3">
              {reviews.map((r) => (
                <div key={r.id} className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-semibold text-gray-800">
                      {r.reviewer?.full_name ?? t('hprof.anonymous')}
                    </p>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className="w-3.5 h-3.5"
                          style={{ color: '#f59e0b' }}
                          fill={r.rating >= n ? '#f59e0b' : 'none'}
                        />
                      ))}
                    </div>
                  </div>
                  {r.review_text && (
                    <p className="text-sm text-gray-600">{r.review_text}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(r.created_at).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        {reviews.length === 0 && profile && (
          <div className="bg-gray-50 rounded-2xl p-5 text-center border border-dashed border-gray-200">
            <Star className="w-6 h-6 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">{t('hprof.noReviews')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
