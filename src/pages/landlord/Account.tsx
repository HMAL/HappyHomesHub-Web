import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Edit, Bell, CreditCard, ChevronRight, CheckCircle, AlertTriangle, ExternalLink, Trash2, Mail, HelpCircle, Landmark, Sparkles, MessageSquareText, Building2, Ticket, Flame, LogOut } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { useToastStore } from '../../stores/toast';
import { initials, formatDateTime, formatPhone, isValidPhone } from '../../lib/utils';
import { supabase } from '../../lib/supabase';
import type { Subscription, PromoCode, LandlordTier } from '../../types';
import RoleManager from '../../components/shared/RoleManager';
import ReferralCard from '../../components/shared/ReferralCard';
import { useT } from '../../lib/i18n';

const PRIMARY = '#0D1F2D';
const ACCENT = '#D4972A';

export function Account() {
  const { profile, supabaseUser, signOut } = useAuthStore();
  const navigate = useNavigate();
  const toast = useToastStore();
  const { t } = useT();
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);

  const menuItems = [
    { label: t('lacct.editProfile'), icon: Edit, to: '/landlord/account/edit' },
    { label: t('lacct.notifications'), icon: Bell, to: '/landlord/account/notifications' },
    { label: t('lacct.billing'), icon: CreditCard, to: '/landlord/account/billing' },
  ];

  async function handleDeleteAccount() {
    if (!supabaseUser || !profile) return;
    setDeletingAccount(true);
    await supabase.from('role_assignments').delete().eq('user_id', supabaseUser.id);
    toast.show(t('toast.accountRemoved'), 'success');
    setTimeout(() => { signOut(); navigate('/', { replace: true }); }, 1500);
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="font-display text-2xl font-bold text-gray-900 mb-6">{t('lacct.account')}</h1>

      {/* Profile card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-5">
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold"
            style={{ background: ACCENT, color: PRIMARY }}
          >
            {profile ? initials(profile.full_name) : '?'}
          </div>
          <div>
            <p className="font-bold text-lg text-gray-900">{profile?.full_name}</p>
            <p className="text-sm text-gray-500">{profile?.email}</p>
            <p className="text-xs text-gray-400 mt-1">{t('lacct.memberSince', { date: formatDateTime(profile?.created_at) })}</p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-5">
        {menuItems.map((item, i) => (
          <Link
            key={item.to}
            to={item.to}
            className={`flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors ${
              i < menuItems.length - 1 ? 'border-b border-gray-50' : ''
            }`}
          >
            <item.icon className="w-4 h-4 text-gray-400" />
            <span className="flex-1 text-sm font-medium text-gray-700">{item.label}</span>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </Link>
        ))}
        <button
          onClick={() => { signOut(); navigate('/login'); }}
          className="w-full flex items-center gap-3 px-5 py-4 border-t border-gray-50 hover:bg-red-50 transition text-left"
        >
          <LogOut className="w-4 h-4 text-red-400" />
          <span className="flex-1 text-sm font-medium text-red-600">{t('common.signOut')}</span>
        </button>
      </div>

      <div className="mb-5">
        <RoleManager />
      </div>

      {/* Contact & Support */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-5">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700">{t('lacct.contactSupport')}</h2>
        </div>
        <div className="divide-y divide-gray-50">
          <a href="mailto:support@happyhomeshub.com" className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition group">
            <Mail className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition">{t('lacct.emailSupport')}</p>
              <p className="text-xs text-gray-400">support@happyhomeshub.com</p>
            </div>
          </a>
          <Link to="/faq" className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition group">
            <HelpCircle className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition">{t('lacct.browseFaq')}</p>
              <p className="text-xs text-gray-400">{t('lacct.faqDesc')}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </Link>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-red-50 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <h2 className="text-sm font-semibold text-red-700">{t('lacct.dangerZone')}</h2>
        </div>
        <div className="p-5">
          {confirmDeleteAccount ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-red-700">{t('lacct.removeAccessConfirm')}</p>
              <p className="text-xs text-gray-500">{t('lacct.deleteDataNote')} <a href="mailto:support@happyhomeshub.com" className="underline">support@happyhomeshub.com</a>.</p>
              <div className="flex gap-2 pt-1">
                <button onClick={handleDeleteAccount} disabled={deletingAccount}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-white hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-1"
                  style={{ background: '#dc2626' }}>
                  {deletingAccount ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                  {t('lacct.yesDeleteAccess')}
                </button>
                <button onClick={() => setConfirmDeleteAccount(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition">
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-900">{t('lacct.deleteAccount')}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t('lacct.deleteAccountDesc')}</p>
              </div>
              <button
                onClick={() => setConfirmDeleteAccount(true)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
              >
                <Trash2 className="w-3.5 h-3.5" /> {t('common.delete')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function EditProfile() {
  const { profile, updateProfile } = useAuthStore();
  const toast = useToastStore();
  const { t } = useT();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) { toast.show(t('toast.nameRequired'), 'error'); return; }
    if (phone && !isValidPhone(phone)) { toast.show(t('toast.phone10'), 'error'); return; }
    setSaving(true);
    const err = await updateProfile({ full_name: fullName, phone });
    setSaving(false);
    if (err) toast.show(err, 'error');
    else toast.show(t('toast.profileUpdatedShort'), 'success');
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-8">
      <h1 className="font-display text-2xl font-bold text-gray-900 mb-6">{t('lacct.editProfile')}</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('lacct.fullName')}</label>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('lacct.phone')}</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="(555) 000-0000" maxLength={14} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D1F2D] transition" />
          {phone && !isValidPhone(phone) && <p className="text-xs text-red-500 mt-1">{t('lacct.phone10')}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('lacct.email')}</label>
          <input type="email" value={profile?.email ?? ''} disabled className="w-full px-4 py-3 rounded-xl border border-gray-100 text-sm bg-gray-50 text-gray-400" />
          <p className="text-xs text-gray-400 mt-1">{t('lacct.changeEmailNote')} <a href="mailto:support@happyhomeshub.com" className="underline hover:text-gray-600">support@happyhomeshub.com</a></p>
        </div>
        <button type="submit" disabled={saving} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-60" style={{ background: PRIMARY }}>
          {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
          {saving ? t('common.saving') : t('common.saveChanges')}
        </button>
      </form>
    </div>
  );
}

const TIER_PRICE: Record<LandlordTier, number> = { landlord: 7, super: 10 };

const FEATURE_KEYS = ['lacct.feat1', 'lacct.feat2', 'lacct.feat3', 'lacct.feat4', 'lacct.feat5', 'lacct.feat6', 'lacct.feat7', 'lacct.feat8'];

function StatusBadge({ status }: { status: Subscription['status'] }) {
  const { t } = useT();
  const map: Record<Subscription['status'], { key: string; cls: string }> = {
    active:   { key: 'lacct.st_active',   cls: 'bg-green-100 text-green-700' },
    trialing: { key: 'lacct.st_trialing', cls: 'bg-blue-100 text-blue-700' },
    past_due: { key: 'lacct.st_past_due', cls: 'bg-red-100 text-red-700' },
    canceled: { key: 'lacct.st_canceled', cls: 'bg-gray-100 text-gray-500' },
  };
  const { key, cls } = map[status] ?? map.canceled;
  return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${cls}`}>{t(key)}</span>;
}

export function Billing() {
  const { supabaseUser, profile } = useAuthStore();
  const toast = useToastStore();
  const { t } = useT();
  const [searchParams, setSearchParams] = useSearchParams();

  const [propertyCount, setPropertyCount] = useState(0);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Promo codes: the live launch promo (for the scarcity banner) and whatever
  // the landlord has typed/applied at checkout.
  const [launchPromo, setLaunchPromo] = useState<PromoCode | null>(null);
  const [promoInput, setPromoInput] = useState('');
  const [promoApplied, setPromoApplied] = useState<PromoCode | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<LandlordTier>('super');

  // Stripe Connect payout state — lets rent flow tenant → landlord.
  const [payouts, setPayouts] = useState<{ connected: boolean; charges_enabled: boolean } | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);

  // Portfolio state — active when the landlord has a paid (2+ property) subscription;
  // unlocks SMS + fee-free ACH (the is_premium flag is set by the webhook).
  const [isPremium, setIsPremium] = useState(false);

  const justSucceeded = searchParams.get('success') === 'true';
  const returnedFromConnect = searchParams.get('connect') === 'done';

  useEffect(() => {
    if (!supabaseUser) return;
    (async () => {
      const [{ count }, { data: sub }] = await Promise.all([
        supabase
          .from('properties')
          .select('*', { count: 'exact', head: true })
          .eq('landlord_id', supabaseUser.id),
        supabase
          .from('subscriptions')
          .select('*')
          .eq('landlord_id', supabaseUser.id)
          .maybeSingle(),
      ]);
      setPropertyCount(count ?? 0);
      setSubscription(sub as Subscription | null);
      setLoading(false);
    })();
  }, [supabaseUser, justSucceeded]);

  // Live launch promo for the scarcity banner (RLS only returns active, unexpired
  // codes with redemptions left exposed to the client).
  useEffect(() => {
    supabase
      .from('promo_codes')
      .select('*')
      .eq('code', 'HAPPYHOMEOWNER')
      .maybeSingle()
      .then(({ data }) => setLaunchPromo((data as PromoCode) ?? null));
  }, [justSucceeded]);

  async function handleApplyPromo() {
    setPromoError(null);
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    // Look the code up directly (RLS only returns active, unexpired codes). The
    // edge function re-validates authoritatively before applying any discount.
    const { data: promo } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('code', code)
      .maybeSingle();
    if (!promo) {
      setPromoApplied(null);
      setPromoError(t('lacct.promoInvalid'));
      return;
    }
    if (promo.used_count >= promo.max_uses) {
      setPromoApplied(null);
      setPromoError(t('lacct.promoRedeemed'));
      return;
    }
    setPromoApplied(promo as PromoCode);
  }

  // clear ?success=true from URL after first render
  useEffect(() => {
    if (justSucceeded) {
      const t = setTimeout(() => setSearchParams({}, { replace: true }), 4000);
      return () => clearTimeout(t);
    }
  }, [justSucceeded]);

  async function handleSubscribe() {
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          landlord_id: supabaseUser!.id,
          property_count: propertyCount,
          customer_email: profile?.email,
          tier: selectedTier,
          promo_code: promoApplied?.code ?? null,
          success_url: `${window.location.origin}/landlord/account/billing?success=true`,
          cancel_url: `${window.location.origin}/landlord/account/billing`,
        },
      });
      if (error || !data?.url) throw error ?? new Error('No checkout URL returned');
      window.location.href = data.url;
    } catch {
      toast.show(t('toast.checkoutFailed'), 'error');
      setActionLoading(false);
    }
  }

  // Upgrade/downgrade an active subscription between Landlord and Super (the "$3 steal").
  async function handleSwitchTier(tier: LandlordTier) {
    setActionLoading(true);
    try {
      const { error } = await supabase.functions.invoke('create-checkout-session', {
        body: { action: 'switch_tier', landlord_id: supabaseUser!.id, tier },
      });
      if (error) throw error;
      toast.show(t(tier === 'super' ? 'toast.welcomeSuper' : 'toast.switchedLandlord'), 'success');
      setSearchParams({ success: 'true' }, { replace: true });
    } catch {
      toast.show(t('toast.planChangeFailed'), 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleManage() {
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-portal-session', {
        body: {
          customer_id: subscription!.stripe_customer_id,
          return_url: `${window.location.origin}/landlord/account/billing`,
        },
      });
      if (error || !data?.url) throw error ?? new Error('No portal URL returned');
      window.location.href = data.url;
    } catch {
      toast.show(t('toast.portalFailed'), 'error');
      setActionLoading(false);
    }
  }

  // Load (and refresh) Connect payout status. Re-check when returning from onboarding.
  useEffect(() => {
    if (!supabaseUser) return;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('connect-status', { body: {} });
        if (data) setPayouts({ connected: !!data.connected, charges_enabled: !!data.charges_enabled });
      } catch { /* leave null — UI shows the connect prompt */ }
    })();
  }, [supabaseUser, returnedFromConnect]);

  useEffect(() => {
    if (!supabaseUser) return;
    supabase.from('users').select('is_premium').eq('id', supabaseUser.id).single()
      .then(({ data }) => setIsPremium(!!data?.is_premium));
  }, [supabaseUser, justSucceeded]);

  async function handleConnectPayouts() {
    setConnectLoading(true);
    try {
      const base = `${window.location.origin}/landlord/account/billing`;
      const { data, error } = await supabase.functions.invoke('connect-onboard', {
        body: { return_url: `${base}?connect=done`, refresh_url: `${base}?connect=refresh` },
      });
      if (error || !data?.url) throw error ?? new Error('No onboarding URL returned');
      window.location.href = data.url;
    } catch {
      toast.show(t('toast.payoutSetupFailed'), 'error');
      setConnectLoading(false);
    }
  }

  // Flat $10/mo per property, including the first. A promo can free some property
  // units (HAPPYHOMEOWNER frees the first). Once subscribed, use the free units
  // stored on the subscription; before that, use whatever promo is applied.
  const freeUnits = subscription?.free_property_units ?? (promoApplied?.discount_type === 'first_property_free' ? 1 : 0);
  const billableProps = Math.max(propertyCount - freeUnits, 0);
  const isActive        = subscription?.status === 'active' || subscription?.status === 'trialing';
  const isPastDue       = subscription?.status === 'past_due';
  const currentTier: LandlordTier = (subscription?.tier as LandlordTier) ?? 'landlord';
  // Active subs price on their current tier; new subscribers on the one they pick.
  const activeTier: LandlordTier = isActive ? currentTier : selectedTier;
  const perProperty = TIER_PRICE[activeTier];
  const monthlyAmount = billableProps * perProperty;
  // The 3-month free trial is a Super Landlord perk for new (non-coupon) landlords.
  const trialMonths = (!subscription && selectedTier === 'super' && !promoApplied) ? 3 : 0;
  // HAPPYHOMEOWNER credits $7/property for 12 months → $0 on Landlord, $3 on Super.
  const couponMonths = !subscription && promoApplied?.discount_type === 'free_months'
    ? Number(promoApplied.discount_value ?? 0) : 0;
  const firstPeriodAmount = couponMonths > 0 ? Math.max(monthlyAmount - 7, 0) : monthlyAmount;
  const needsSubscription = propertyCount > 0 && !isActive && !isPastDue;
  const promoRemaining = launchPromo ? Math.max(0, launchPromo.max_uses - launchPromo.used_count) : 0;
  const promoLive = !!launchPromo && launchPromo.active && promoRemaining > 0 &&
    (!launchPromo.expires_at || new Date(launchPromo.expires_at) > new Date());

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">{t('lacct.billing')}</h1>
      <p className="text-sm text-gray-500 mb-6">{t('lacct.billingSubtitle')}</p>

      {/* Success banner */}
      {justSucceeded && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl p-4 mb-5">
          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
          <p className="text-sm font-medium text-green-800">{t('lacct.subActivated')}</p>
        </div>
      )}

      {/* Past-due warning */}
      {isPastDue && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-4 mb-5">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">{t('lacct.paymentFailed')}</p>
            <p className="text-xs text-red-600 mt-0.5">{t('lacct.updatePayment')}</p>
          </div>
          <button
            onClick={handleManage}
            disabled={actionLoading}
            className="text-xs font-semibold text-red-700 underline underline-offset-2 hover:text-red-900 disabled:opacity-50"
          >
            {t('lacct.fixNow')}
          </button>
        </div>
      )}

      {/* Launch promo scarcity banner */}
      {promoLive && !isActive && (
        <div className="flex items-start gap-3 rounded-2xl p-4 mb-5 border" style={{ background: '#FFF7ED', borderColor: '#FED7AA' }}>
          <Flame className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#EA580C' }} />
          <div className="flex-1">
            <p className="text-sm font-bold text-orange-900">
              {t('lacct.launchOffer', { code: launchPromo!.code })}
            </p>
            <p className="text-xs text-orange-700 mt-0.5">
              {t('lacct.launchOfferSub', { n: promoRemaining, max: launchPromo!.max_uses })}
            </p>
          </div>
        </div>
      )}

      {/* Pricing card */}
      <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100 mb-5">
        <div className="p-6" style={{ background: PRIMARY }}>
          <div className="flex items-start justify-between mb-1">
            <p className="font-display font-bold text-2xl text-white">{t('lacct.yourPlan')}</p>
            {!loading && subscription && <StatusBadge status={subscription.status} />}
          </div>
          <div className="flex items-baseline gap-2 mt-4">
            <span className="font-display text-4xl font-bold text-white">${perProperty}</span>
            <span className="text-white/60 text-sm">{t('lacct.perPropertyTier', { tier: t('lacct.tier_' + activeTier) })}</span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-sm font-semibold" style={{ color: ACCENT }}>
              {isActive ? t('lacct.currentPlan') : t('lacct.pricePair')}
            </span>
            <span className="text-white/60 text-sm">{t('lacct.cancelAnytime')}</span>
          </div>
        </div>

        <div className="bg-white p-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{t('lacct.everyPropertyIncludes')}</p>
          <ul className="grid sm:grid-cols-2 gap-2">
            {FEATURE_KEYS.map((fk) => (
              <li key={fk} className="flex items-center gap-2 text-sm text-gray-700">
                <span className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs shrink-0">✓</span>
                {t(fk)}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Rent payouts (Stripe Connect) */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#F4ECD9', color: ACCENT }}>
            <Landmark className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-800">{t('lacct.receiveRent')}</p>
            {payouts?.charges_enabled ? (
              <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> {t('lacct.connected')}
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-0.5">
                {t('lacct.connectBank')}
              </p>
            )}

            {!payouts?.charges_enabled && (
              <button
                onClick={handleConnectPayouts}
                disabled={connectLoading}
                className="mt-3 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-60"
                style={{ background: PRIMARY }}
              >
                {connectLoading
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Landmark className="w-4 h-4" />}
                {connectLoading ? t('lacct.redirecting') : payouts?.connected ? t('lacct.finishPayout') : t('lacct.setupPayouts')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Super Landlord benefits */}
      <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100 mb-5">
        <div className="px-5 py-4 flex items-center justify-between" style={{ background: '#F4ECD9' }}>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" style={{ color: ACCENT }} />
            <h2 className="text-sm font-bold" style={{ color: PRIMARY }}>{t('lacct.superUnlocks')}</h2>
          </div>
          {isPremium && (
            <span className="flex items-center gap-1 text-xs font-semibold text-green-700">
              <CheckCircle className="w-3.5 h-3.5" /> {t('lacct.activeShort')}
            </span>
          )}
        </div>
        <div className="bg-white p-5">
          <ul className="space-y-2 mb-4">
            <li className="flex items-center gap-2 text-sm text-gray-700">
              <CheckCircle className="w-4 h-4 shrink-0" style={{ color: ACCENT }} /> {t('lacct.benefit1')}
            </li>
            <li className="flex items-center gap-2 text-sm text-gray-700">
              <MessageSquareText className="w-4 h-4 shrink-0" style={{ color: ACCENT }} /> {t('lacct.benefit2')}
            </li>
            <li className="flex items-center gap-2 text-sm text-gray-700">
              <Building2 className="w-4 h-4 shrink-0" style={{ color: ACCENT }} /> {t('lacct.benefit3')}
            </li>
            <li className="flex items-center gap-2 text-sm text-gray-700">
              <Landmark className="w-4 h-4 shrink-0" style={{ color: ACCENT }} /> {t('lacct.benefit4')}
            </li>
          </ul>
          {isPremium ? (
            <p className="text-xs text-gray-500">{t('lacct.onSuperNote')}</p>
          ) : (
            <p className="text-xs text-gray-500">{t('lacct.upgradeNote')}</p>
          )}
        </div>
      </div>

      {/* Current usage */}
      {!loading && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">{t('lacct.currentUsage')}</p>
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-600">{t('lacct.properties')}</span>
            <span className="text-sm font-semibold text-gray-900">{propertyCount}</span>
          </div>
          {freeUnits > 0 && (
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-sm text-gray-600">{t('lacct.promoLabel', { code: subscription?.promo_code ?? promoApplied?.code ?? '' })}</span>
              <span className="text-sm font-semibold text-green-600">
                {freeUnits === 1 ? t('lacct.propertyFree', { n: freeUnits }) : t('lacct.propertiesFree', { n: freeUnits })}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-600">{t('lacct.plan')}</span>
            <span className="text-sm font-semibold text-gray-900">{t('lacct.planValue', { tier: t('lacct.tier_' + activeTier), price: perProperty })}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-600">{t('lacct.billableProperties')}</span>
            <span className="text-sm font-semibold text-gray-900">{t('lacct.billableValue', { n: billableProps, price: perProperty })}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-semibold text-gray-700">{t('lacct.monthlyTotal')}</span>
            <span className="text-base font-bold" style={{ color: (trialMonths > 0 || firstPeriodAmount === 0) ? '#16a34a' : PRIMARY }}>
              {trialMonths > 0
                ? t('lacct.freeForMo', { n: trialMonths })
                : couponMonths > 0
                ? (firstPeriodAmount === 0 ? t('lacct.freeForMo', { n: couponMonths }) : t('lacct.priceForMo', { amount: firstPeriodAmount, n: couponMonths }))
                : monthlyAmount === 0 ? t('lacct.free') : t('lacct.perMo', { amount: monthlyAmount })}
            </span>
          </div>
          {(trialMonths > 0 || couponMonths > 0) && (
            <p className="text-xs text-gray-400 -mt-1 pb-1 text-right">{t('lacct.thenPerMo', { amount: monthlyAmount })}</p>
          )}

          {/* Promo code entry — only before there's an active subscription */}
          {!isActive && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              {promoApplied ? (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-green-800">
                    <Ticket className="w-4 h-4" /> {t('lacct.promoAppliedLabel', { code: promoApplied.code })}
                  </span>
                  <button
                    onClick={() => { setPromoApplied(null); setPromoInput(''); }}
                    className="text-xs font-semibold text-green-700 underline underline-offset-2 hover:text-green-900"
                  >
                    {t('lacct.remove')}
                  </button>
                </div>
              ) : (
                <>
                  <label className="text-xs font-semibold text-gray-500 mb-1.5 block">{t('lacct.havePromo')}</label>
                  <div className="flex gap-2">
                    <input
                      value={promoInput}
                      onChange={(e) => { setPromoInput(e.target.value); setPromoError(null); }}
                      placeholder={t('lacct.promoPlaceholder')}
                      className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-gray-200"
                    />
                    <button
                      onClick={handleApplyPromo}
                      className="px-4 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                    >
                      {t('lacct.apply')}
                    </button>
                  </div>
                  {promoError && <p className="text-xs text-red-500 mt-1.5">{promoError}</p>}
                </>
              )}
            </div>
          )}

          {/* Tier selector (new subscribers) */}
          {needsSubscription && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {(['landlord', 'super'] as LandlordTier[]).map((tier) => {
                const active = selectedTier === tier;
                const base = TIER_PRICE[tier];
                const couponPrice = promoApplied ? Math.max(base - 7, 0) : base;
                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setSelectedTier(tier)}
                    className={`relative text-left rounded-xl p-3.5 border-2 transition ${active ? 'shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}
                    style={active ? { borderColor: ACCENT, background: '#FBF6EC' } : undefined}
                  >
                    {tier === 'super' && (
                      <span className="absolute -top-2 right-2 text-[9px] font-bold uppercase tracking-wide text-white px-1.5 py-0.5 rounded-full" style={{ background: ACCENT }}>
                        {t('lacct.mostPopular')}
                      </span>
                    )}
                    <p className="text-sm font-bold text-gray-900">{t('lacct.tier_' + tier)}</p>
                    <p className="text-lg font-bold text-gray-900">${base}<span className="text-xs font-normal text-gray-400">/property</span></p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {promoApplied
                        ? (couponPrice === 0 ? t('lacct.freeForYear') : t('lacct.priceForYear', { price: couponPrice }))
                        : tier === 'super' ? t('lacct.threeMonthsFree') : t('lacct.coreFeatures')}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {/* CTA */}
          {needsSubscription && (
            <button
              onClick={handleSubscribe}
              disabled={actionLoading}
              className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-60"
              style={{ background: PRIMARY }}
            >
              {actionLoading
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <CreditCard className="w-4 h-4" />}
              {actionLoading
                ? t('lacct.redirecting')
                : trialMonths > 0
                ? t('lacct.startTrialTier', { tier: t('lacct.tier_' + selectedTier) })
                : couponMonths > 0
                ? (firstPeriodAmount === 0 ? t('lacct.claimYearFree') : t('lacct.subscribePrice', { amount: firstPeriodAmount }))
                : monthlyAmount === 0 ? t('lacct.activatePlan') : t('lacct.subscribePriceTier', { amount: monthlyAmount, tier: t('lacct.tier_' + selectedTier) })}
            </button>
          )}

          {/* Upgrade / downgrade (active subscribers) — the "$3 steal" */}
          {isActive && (
            currentTier === 'landlord' ? (
              <button
                onClick={() => handleSwitchTier('super')}
                disabled={actionLoading}
                className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-60"
                style={{ background: PRIMARY }}
              >
                <Sparkles className="w-4 h-4" style={{ color: ACCENT }} />
                {t('lacct.upgradeCta')}
              </button>
            ) : (
              <button
                onClick={() => handleSwitchTier('landlord')}
                disabled={actionLoading}
                className="mt-3 w-full text-center text-xs font-semibold text-gray-400 hover:text-gray-600 transition"
              >
                {t('lacct.downgradeCta')}
              </button>
            )
          )}

          {(isActive || isPastDue) && subscription?.stripe_customer_id && (
            <button
              onClick={handleManage}
              disabled={actionLoading}
              className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition disabled:opacity-60"
            >
              {actionLoading
                ? <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                : <ExternalLink className="w-4 h-4" />}
              {actionLoading ? t('lacct.redirecting') : t('lacct.manageSubscription')}
            </button>
          )}

          {isActive && subscription?.current_period_end && (
            <p className="text-xs text-gray-400 text-center mt-3">
              {t('lacct.nextBilling', { date: formatDateTime(subscription.current_period_end) })}
            </p>
          )}
        </div>
      )}

      {/* Referral loop */}
      <ReferralCard variant="property" />

      {/* Cost calculator */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <p className="text-sm font-semibold text-gray-700 mb-3">{t('lacct.howMuch')}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 text-xs text-gray-400 font-medium">{t('lacct.properties')}</th>
                <th className="text-right py-2 text-xs text-gray-400 font-medium">{t('lacct.colLandlord')}</th>
                <th className="text-right py-2 text-xs text-gray-400 font-medium">{t('lacct.colSuper')}</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 5].map((n) => (
                <tr key={n} className="border-b border-gray-50 last:border-0">
                  <td className="py-2.5 text-gray-700">{n === 1 ? t('lacct.nProperty', { n }) : t('lacct.nProperties', { n })}</td>
                  <td className="py-2.5 text-right font-semibold text-gray-700">${n * 7}/mo</td>
                  <td className="py-2.5 text-right font-semibold" style={{ color: PRIMARY }}>${n * 10}/mo</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          {t('lacct.costFooter')}
        </p>
      </div>
    </div>
  );
}
