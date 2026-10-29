import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, HardHat, Star, MapPin, Phone, CheckCircle, MessageSquare, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/auth';
import { useToastStore } from '../../stores/toast';
import { User, HandymanSkill } from '../../types';
import { formatPhone } from '../../lib/utils';
import { SkeletonList } from '../../components/shared/Skeleton';
import EmptyState from '../../components/shared/EmptyState';
import { useT } from '../../lib/i18n';

const PRIMARY = '#0D1F2D';
const ACCENT = '#D4972A';

interface HandymanRow {
  id: string;
  user_id: string;
  skills: HandymanSkill[];
  service_area: string;
  service_phone?: string;
  hourly_rate?: number;
  bio?: string;
  is_available: boolean;
  verified: boolean;
  rating?: number;
  completed_jobs: number;
  user: User | null;
}

// ── Star rating component ────────────────────────────────────────────────────

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="transition"
        >
          <Star
            className="w-7 h-7"
            style={{ color: '#f59e0b' }}
            fill={(hover || value) >= n ? '#f59e0b' : 'none'}
          />
        </button>
      ))}
    </div>
  );
}

// ── Rate modal ────────────────────────────────────────────────────────────────

interface RateModalProps {
  handyman: HandymanRow;
  existingRating: number;
  existingText: string;
  onClose: () => void;
  onSaved: (newRating: number, newText: string) => void;
}

function RateHandymanModal({ handyman, existingRating, existingText, onClose, onSaved }: RateModalProps) {
  const { supabaseUser } = useAuthStore();
  const toast = useToastStore();
  const { t } = useT();
  const [rating, setRating] = useState(existingRating || 0);
  const [text, setText] = useState(existingText || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (rating === 0) { toast.show(t('toast.selectStarRating'), 'error'); return; }
    setSaving(true);
    const { error } = await supabase.from('handyman_reviews').upsert({
      handyman_user_id: handyman.user_id,
      reviewer_id: supabaseUser!.id,
      rating,
      review_text: text.trim() || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'handyman_user_id,reviewer_id' });
    setSaving(false);
    if (error) { toast.show(error.message, 'error'); return; }
    toast.show(t('toast.reviewSaved'), 'success');
    onSaved(rating, text.trim());
  }

  const labels = ['', t('hm.lbl1'), t('hm.lbl2'), t('hm.lbl3'), t('hm.lbl4'), t('hm.lbl5')];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100" style={{ background: PRIMARY }}>
          <p className="font-bold text-white">{t('hm.rateName', { name: handyman.user?.full_name ?? t('hm.handyman') })}</p>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="text-center">
            <StarPicker value={rating} onChange={setRating} />
            {rating > 0 && (
              <p className="text-sm font-semibold mt-1" style={{ color: ACCENT }}>{labels[rating]}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('hm.reviewOptional')}</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('hm.reviewPlaceholder')}
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] resize-none transition"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving || rating === 0}
            className="w-full py-2.5 rounded-xl text-white text-sm font-bold hover:opacity-90 transition disabled:opacity-50"
            style={{ background: PRIMARY }}
          >
            {saving ? t('common.saving') : existingRating ? t('hm.updateReview') : t('hm.submitReview')}
          </button>
        </div>
      </div>
    </div>
  );
}

const ALL_SKILLS: HandymanSkill[] = [
  'Plumbing', 'Electrical', 'HVAC', 'Carpentry', 'Painting',
  'Appliance Repair', 'Roofing', 'Flooring', 'Landscaping',
  'Cleaning', 'Pest Control', 'Welding', 'Masonry', 'Other',
];

export default function Handymen() {
  const navigate = useNavigate();
  const { supabaseUser } = useAuthStore();
  const toast = useToastStore();
  const { t } = useT();
  const [rows, setRows] = useState<HandymanRow[]>([]);
  const [filtered, setFiltered] = useState<HandymanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<HandymanSkill | ''>('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [ratingFor, setRatingFor] = useState<HandymanRow | null>(null);
  // myReviews: keyed by handyman_user_id → { rating, review_text }
  const [myReviews, setMyReviews] = useState<Record<string, { rating: number; review_text: string }>>({});
  // rateableHandymen: user_ids of handymen with at least one accepted quote from this landlord
  const [rateableHandymen, setRateableHandymen] = useState<Set<string>>(new Set());

  useEffect(() => {
    load();
    if (supabaseUser) { loadFavorites(); loadMyReviews(); loadRateableHandymen(); }
  }, []);

  useEffect(() => {
    applyFilters();
  }, [rows, search, selectedSkill, availableOnly]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('handyman_profiles')
        .select('*, user:user_id(id, full_name, email, phone, avatar_url)')
        .order('completed_jobs', { ascending: false });

      if (fetchErr) throw fetchErr;
      setRows((data as HandymanRow[]) ?? []);
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? t('hm.loadFailed');
      setError(msg);
      toast.show(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadRateableHandymen() {
    const uid = supabaseUser!.id;

    const { data: props } = await supabase.from('properties').select('id').eq('landlord_id', uid);
    const propIds = (props ?? []).map((p: { id: string }) => p.id);
    if (!propIds.length) { setRateableHandymen(new Set()); return; }

    const { data: tenancies } = await supabase.from('tenancies').select('id').in('property_id', propIds);
    const tenancyIds = (tenancies ?? []).map((t: { id: string }) => t.id);
    if (!tenancyIds.length) { setRateableHandymen(new Set()); return; }

    const { data: requests } = await supabase.from('maintenance_requests').select('id').in('tenancy_id', tenancyIds);
    const requestIds = (requests ?? []).map((r: { id: string }) => r.id);
    if (!requestIds.length) { setRateableHandymen(new Set()); return; }

    const { data: quotes } = await supabase
      .from('quotes')
      .select('handyman_id')
      .in('request_id', requestIds)
      .eq('status', 'accepted');

    setRateableHandymen(new Set((quotes ?? []).map((q: { handyman_id: string }) => q.handyman_id)));
  }

  async function loadMyReviews() {
    const { data } = await supabase
      .from('handyman_reviews')
      .select('handyman_user_id, rating, review_text')
      .eq('reviewer_id', supabaseUser!.id);
    const map: Record<string, { rating: number; review_text: string }> = {};
    (data ?? []).forEach((r: { handyman_user_id: string; rating: number; review_text: string | null }) => {
      map[r.handyman_user_id] = { rating: r.rating, review_text: r.review_text ?? '' };
    });
    setMyReviews(map);
  }

  async function loadFavorites() {
    const { data } = await supabase
      .from('favorite_handymen')
      .select('handyman_id')
      .eq('landlord_id', supabaseUser!.id);
    setFavorites(new Set((data ?? []).map((f: { handyman_id: string }) => f.handyman_id)));
  }

  async function toggleFavorite(handymanUserId: string) {
    if (!supabaseUser) return;
    setTogglingId(handymanUserId);
    if (favorites.has(handymanUserId)) {
      await supabase.from('favorite_handymen').delete().eq('landlord_id', supabaseUser.id).eq('handyman_id', handymanUserId);
      setFavorites((prev) => { const s = new Set(prev); s.delete(handymanUserId); return s; });
    } else {
      await supabase.from('favorite_handymen').insert({ landlord_id: supabaseUser.id, handyman_id: handymanUserId });
      setFavorites((prev) => new Set(prev).add(handymanUserId));
    }
    setTogglingId(null);
  }

  function applyFilters() {
    let result = [...rows];

    if (availableOnly) {
      result = result.filter((r) => r.is_available);
    }

    if (selectedSkill) {
      result = result.filter((r) => r.skills.includes(selectedSkill as HandymanSkill));
    }

    const q = search.toLowerCase().trim();
    if (q) {
      result = result.filter(
        (r) =>
          r.service_area.toLowerCase().includes(q) ||
          r.user?.full_name?.toLowerCase().includes(q) ||
          r.bio?.toLowerCase().includes(q) ||
          r.skills.some((s) => s.toLowerCase().includes(q)),
      );
    }

    setFiltered(result);
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-900">{t('hm.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('hm.subtitle')}</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('hm.searchPlaceholder')}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition"
          />
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          {/* Skill filter */}
          <select
            value={selectedSkill}
            onChange={(e) => setSelectedSkill(e.target.value as HandymanSkill | '')}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition"
          >
            <option value="">{t('hm.allSkills')}</option>
            {ALL_SKILLS.map((s) => <option key={s} value={s}>{t('hm.skill_' + s)}</option>)}
          </select>

          {/* Available toggle */}
          <button
            onClick={() => setAvailableOnly(!availableOnly)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all"
            style={
              availableOnly
                ? { background: PRIMARY, color: '#fff', borderColor: PRIMARY }
                : { background: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }
            }
          >
            <CheckCircle className="w-4 h-4" />
            {t('hm.availableOnly')}
          </button>

          <p className="text-sm text-gray-400 ml-auto">
            {filtered.length} {filtered.length !== 1 ? t('hm.results') : t('hm.result')}
          </p>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <SkeletonList count={4} />
      ) : error ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-red-500">{error}</p>
          <button onClick={load} className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition" style={{ background: PRIMARY }}>{t('common.retry')}</button>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={HardHat}
          title={t('hm.noneTitle')}
          description={t('hm.noneDesc')}
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((h) => (
            <div key={h.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold shrink-0"
                  style={{ background: PRIMARY, color: ACCENT }}
                >
                  {h.user?.full_name?.charAt(0)?.toUpperCase() ?? 'H'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900">{h.user?.full_name ?? t('hm.handyman')}</p>
                    {h.verified && (
                      <span
                        className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full cursor-help"
                        style={{ background: ACCENT + '22', color: '#92400e' }}
                        title={t('hm.verifiedTitle')}
                      >
                        <CheckCircle className="w-3 h-3" /> {t('hm.verified')}
                      </span>
                    )}
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: h.is_available ? '#16a34a' : '#9ca3af' }}
                      title={h.is_available ? t('hm.available') : t('hm.unavailable')}
                    />
                    <span className={`text-xs ${h.is_available ? 'text-green-600' : 'text-gray-400'}`}>
                      {h.is_available ? t('hm.available') : t('hm.unavailable')}
                    </span>
                  </div>

                  {/* Location + rate */}
                  <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-500">
                    <span className="flex items-center gap-1" title={t('hm.serviceAreaTitle')}>
                      <MapPin className="w-3 h-3" /> {h.service_area}
                    </span>
                    {h.hourly_rate && (
                      <span className="font-semibold text-gray-700">${h.hourly_rate}{t('hm.perHr')}</span>
                    )}
                    {h.rating != null && h.rating > 0 && (
                      <span className="flex items-center gap-1 text-amber-600 font-semibold">
                        <Star className="w-3 h-3 text-amber-500" fill="#f59e0b" />
                        {h.rating.toFixed(1)}
                      </span>
                    )}
                    {h.completed_jobs > 0 && (
                      <span>{h.completed_jobs !== 1 ? t('hm.jobsCompleted', { n: h.completed_jobs }) : t('hm.jobCompleted', { n: h.completed_jobs })}</span>
                    )}
                  </div>

                  {/* Bio */}
                  {h.bio && (
                    <p className="text-sm text-gray-500 mt-2 line-clamp-2">{h.bio}</p>
                  )}

                  {/* Skills */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {h.skills.slice(0, 8).map((s) => (
                      <span
                        key={s}
                        className="px-2 py-0.5 rounded-md text-xs font-medium"
                        style={{ background: PRIMARY + '11', color: PRIMARY }}
                      >
                        {t('hm.skill_' + s)}
                      </span>
                    ))}
                    {h.skills.length > 8 && (
                      <span className="text-xs text-gray-400">{t('hm.more', { n: h.skills.length - 8 })}</span>
                    )}
                  </div>
                </div>

                {/* Contact */}
                <div className="shrink-0 flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/landlord/messages/handyman/${h.user_id}`)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition"
                      style={{ background: PRIMARY }}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      {t('hm.message')}
                    </button>
                    {rateableHandymen.has(h.user_id) ? (
                      <button
                        onClick={() => setRatingFor(h)}
                        title={myReviews[h.user_id] ? t('hm.editReview') : t('hm.leaveReview')}
                        className="flex items-center gap-1 px-2.5 py-2 rounded-xl border text-xs font-semibold transition hover:bg-amber-50"
                        style={myReviews[h.user_id]
                          ? { borderColor: '#f59e0b', color: '#92400e', background: '#fffbeb' }
                          : { borderColor: '#e5e7eb', color: '#6b7280' }}
                      >
                        <Star className="w-3.5 h-3.5" fill={myReviews[h.user_id] ? '#f59e0b' : 'none'} style={{ color: '#f59e0b' }} />
                        {myReviews[h.user_id] ? myReviews[h.user_id].rating : t('hm.rate')}
                      </button>
                    ) : (
                      <button
                        disabled
                        title={t('hm.rateDisabledTitle')}
                        className="flex items-center gap-1 px-2.5 py-2 rounded-xl border border-gray-100 text-xs font-semibold text-gray-300 cursor-not-allowed"
                      >
                        <Star className="w-3.5 h-3.5 text-gray-300" />
                        {t('hm.rate')}
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(h.user_id); }}
                      disabled={togglingId === h.user_id}
                      title={favorites.has(h.user_id) ? t('hm.removeFav') : t('hm.addFav')}
                      className="p-2 rounded-xl border transition hover:bg-gray-50"
                      style={favorites.has(h.user_id) ? { borderColor: ACCENT, color: ACCENT } : { borderColor: '#e5e7eb', color: '#9ca3af' }}
                    >
                      <Star className="w-3.5 h-3.5" fill={favorites.has(h.user_id) ? ACCENT : 'none'} />
                    </button>
                  </div>
                  {h.service_phone && (
                    <a
                      href={`tel:${h.service_phone}`}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      {formatPhone(h.service_phone)}
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {ratingFor && (
        <RateHandymanModal
          handyman={ratingFor}
          existingRating={myReviews[ratingFor.user_id]?.rating ?? 0}
          existingText={myReviews[ratingFor.user_id]?.review_text ?? ''}
          onClose={() => setRatingFor(null)}
          onSaved={(newRating, newText) => {
            setMyReviews((prev) => ({
              ...prev,
              [ratingFor.user_id]: { rating: newRating, review_text: newText },
            }));
            // Optimistically update displayed avg rating on the card
            setRows((prev) => prev.map((r) =>
              r.user_id === ratingFor.user_id ? { ...r, rating: newRating } : r,
            ));
            setRatingFor(null);
          }}
        />
      )}
    </div>
  );
}
