import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, Wrench, Users, CheckCircle, ArrowRight,
  Bell, MessageSquare, FileText, DollarSign, Home,
  AlertCircle, Briefcase, MapPin,
  TrendingUp, Hammer, ChevronDown, Lock, CreditCard, Shield, Layers, Mail,
} from 'lucide-react';
import HHLogo from '../components/brand/HHLogo';
import Footer from '../components/shared/Footer';
import PricingComparison from '../components/shared/PricingComparison';
import LanguageSwitcher from '../components/shared/LanguageSwitcher';
import SectionHeading from '../components/shared/SectionHeading';
import CTALink from '../components/ui/CTALink';
import { supabase } from '../lib/supabase';
import { useT } from '../lib/i18n';
import { usePageMeta } from '../lib/seo';
import { useReveal } from '../lib/useReveal';
import type { PromoCode } from '../types';

type RoleId = 'landlord' | 'tenant' | 'handyman';

const features = [
  { key: 'landlord', prefix: 'l', icon: Building2, color: '#D4972A', bg: '#0D1F2D', to: '/for-landlords' },
  { key: 'tenant', prefix: 't', icon: Users, color: '#00C8BB', bg: '#12202E', to: '/for-tenants' },
  { key: 'handyman', prefix: 'h', icon: Wrench, color: '#34D399', bg: '#1B3A2F', to: '/for-handymen' },
] as const;

const HOW_TO_USE = [
  { id: 'landlord' as const, icon: Building2, color: '#D4972A' },
  { id: 'tenant' as const, icon: Users, color: '#00C8BB' },
  { id: 'handyman' as const, icon: Wrench, color: '#34D399' },
];

// ── Dashboard preview components ──────────────────────────────────────────────

function MockChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/10">
      {/* Browser chrome */}
      <div className="bg-gray-800 px-4 py-2.5 flex items-center gap-2.5">
        <span className="w-3 h-3 rounded-full bg-red-400" />
        <span className="w-3 h-3 rounded-full bg-yellow-400" />
        <span className="w-3 h-3 rounded-full bg-green-400" />
        <div className="ml-3 flex-1 bg-gray-700 rounded-md px-3 py-1 text-xs text-gray-400 font-mono max-w-xs">
          app.happyhomeshub.com
        </div>
      </div>
      {children}
    </div>
  );
}

function LandlordPreview() {
  const { t } = useT();
  return (
    <MockChrome>
      <div className="bg-[#0D1F2D] flex" style={{ minHeight: 400 }}>
        {/* Mini sidebar */}
        <div className="w-14 bg-[#091621] flex flex-col items-center py-4 gap-5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[#D4972A] flex items-center justify-center text-[#0D1F2D] font-bold text-xs">H</div>
          {[Home, Building2, Users, DollarSign, Wrench, MessageSquare, FileText].map((Icon, i) => (
            <Icon key={i} className={`w-5 h-5 ${i === 0 ? 'text-[#D4972A]' : 'text-white/30'}`} />
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 p-5 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white/50 text-xs">{t('landing.preview.goodMorning')}</p>
              <p className="text-white font-semibold text-sm">Sarah Mitchell</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                <Bell className="w-3 h-3 text-white/60" />
              </div>
              <div className="w-7 h-7 rounded-full bg-[#D4972A] flex items-center justify-center text-[#0D1F2D] font-bold text-xs">SM</div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: t('landing.preview.s_properties'), value: '3', icon: Building2, color: '#D4972A' },
              { label: t('landing.preview.s_rentCollected'), value: '$4,200', icon: TrendingUp, color: '#34D399' },
              { label: t('landing.preview.s_openRepairs'), value: '2', icon: AlertCircle, color: '#f87171' },
            ].map((s) => (
              <div key={s.label} className="bg-white/5 rounded-xl p-3">
                <s.icon className="w-4 h-4 mb-1.5" style={{ color: s.color }} />
                <p className="text-white font-bold text-sm">{s.value}</p>
                <p className="text-white/40 text-xs">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Properties */}
          <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-2">{t('landing.preview.yourProperties')}</p>
          <div className="space-y-2">
            {[
              { address: '142 Maple St · Unit 2A', tenant: 'James Thornton', status: t('landing.preview.st_paid'), statusColor: '#34D399', rent: '$1,400' },
              { address: '87 Oak Avenue', tenant: 'Maria Lopez', status: t('landing.preview.st_pending'), statusColor: '#D4972A', rent: '$1,800' },
              { address: '310 Birch Lane · Apt 5', tenant: t('landing.preview.noTenant'), status: t('landing.preview.st_vacant'), statusColor: '#6b7280', rent: '$2,000' },
            ].map((p) => (
              <div key={p.address} className="bg-white/5 rounded-xl px-3 py-2.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#D4972A]/20 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 text-[#D4972A]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium truncate">{p.address}</p>
                  <p className="text-white/40 text-xs truncate">{p.tenant}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-white text-xs font-semibold">{p.rent}</p>
                  <p className="text-xs font-medium" style={{ color: p.statusColor }}>{p.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MockChrome>
  );
}

function TenantPreview() {
  const { t } = useT();
  return (
    <MockChrome>
      <div className="bg-[#12202E] flex" style={{ minHeight: 400 }}>
        {/* Mini sidebar */}
        <div className="w-14 bg-[#0c1a25] flex flex-col items-center py-4 gap-5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[#00C8BB] flex items-center justify-center text-[#0c1a25] font-bold text-xs">H</div>
          {[Home, DollarSign, Wrench, MessageSquare, FileText, Briefcase].map((Icon, i) => (
            <Icon key={i} className={`w-5 h-5 ${i === 0 ? 'text-[#00C8BB]' : 'text-white/30'}`} />
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 p-5 overflow-hidden">
          {/* Property banner */}
          <div className="bg-[#00C8BB]/15 border border-[#00C8BB]/30 rounded-xl p-3 mb-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#00C8BB]/20 flex items-center justify-center shrink-0">
              <Home className="w-5 h-5 text-[#00C8BB]" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">142 Maple St · Unit 2A</p>
              <p className="text-white/50 text-xs">{t('landing.preview.landlordPrefix')} Sarah Mitchell</p>
            </div>
          </div>

          {/* Rent card */}
          <div className="bg-white/5 rounded-xl p-3 mb-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/50 text-xs font-medium uppercase tracking-wider">{t('landing.preview.nextRentDue')}</p>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">{t('landing.preview.paidCaps')}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-white font-bold text-2xl">$1,400</p>
              <p className="text-white/40 text-xs">due Jun 1, 2025</p>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-white/10">
              <div className="h-full rounded-full bg-green-400" style={{ width: '100%' }} />
            </div>
          </div>

          {/* Repairs */}
          <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-2">{t('landing.preview.openRepairs')}</p>
          <div className="space-y-2 mb-3">
            {[
              { title: 'Kitchen faucet leaking', status: t('landing.preview.st_inProgress'), color: '#D4972A' },
              { title: 'Bedroom window — draft', status: t('landing.preview.st_open'), color: '#60a5fa' },
            ].map((r) => (
              <div key={r.title} className="bg-white/5 rounded-xl px-3 py-2.5 flex items-center gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: r.color + '22' }}>
                  <Wrench className="w-3 h-3" style={{ color: r.color }} />
                </div>
                <p className="flex-1 text-white text-xs">{r.title}</p>
                <span className="text-xs font-medium" style={{ color: r.color }}>{r.status}</span>
              </div>
            ))}
          </div>

          {/* Message preview */}
          <div className="bg-white/5 rounded-xl px-3 py-2.5 flex items-center gap-3">
            <MessageSquare className="w-4 h-4 text-[#00C8BB] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium">Sarah Mitchell</p>
              <p className="text-white/40 text-xs truncate">Plumber coming Friday 10am — please be home</p>
            </div>
            <span className="w-2 h-2 rounded-full bg-[#00C8BB] shrink-0" />
          </div>
        </div>
      </div>
    </MockChrome>
  );
}

function HandymanPreview() {
  const { t } = useT();
  return (
    <MockChrome>
      <div className="bg-[#1B3A2F] flex" style={{ minHeight: 400 }}>
        {/* Mini sidebar */}
        <div className="w-14 bg-[#122b22] flex flex-col items-center py-4 gap-5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[#34D399] flex items-center justify-center text-[#122b22] font-bold text-xs">H</div>
          {[Home, Briefcase, Hammer, MessageSquare, Users].map((Icon, i) => (
            <Icon key={i} className={`w-5 h-5 ${i === 0 ? 'text-[#34D399]' : 'text-white/30'}`} />
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 p-5 overflow-hidden">
          {/* Header + availability */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white font-semibold text-sm">Carlos Rivera</p>
              <p className="text-white/40 text-xs">Plumbing · HVAC · Electrical</p>
            </div>
            <div className="flex items-center gap-2 bg-green-500/20 rounded-full px-3 py-1">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-green-400 text-xs font-semibold">{t('landing.preview.available')}</span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: t('landing.preview.openJobs'), value: '4', color: '#34D399' },
              { label: t('landing.preview.active'), value: '1', color: '#D4972A' },
              { label: t('landing.preview.completed'), value: '14', color: '#60a5fa' },
            ].map((s) => (
              <div key={s.label} className="bg-white/5 rounded-xl p-3 text-center">
                <p className="font-bold text-lg" style={{ color: s.color }}>{s.value}</p>
                <p className="text-white/40 text-xs">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Available jobs */}
          <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-2">{t('landing.preview.availableJobs')}</p>
          <div className="space-y-2">
            {[
              { title: 'Burst pipe repair', loc: '142 Maple St · Austin TX', tag: 'Plumbing', urgency: t('landing.preview.u_urgent'), urgencyColor: '#f87171' },
              { title: 'AC unit not cooling', loc: '87 Oak Ave · Austin TX', tag: 'HVAC', urgency: t('landing.preview.u_high'), urgencyColor: '#D4972A' },
              { title: 'Outlet replacement', loc: '310 Birch Ln · Austin TX', tag: 'Electrical', urgency: t('landing.preview.u_medium'), urgencyColor: '#60a5fa' },
            ].map((j) => (
              <div key={j.title} className="bg-white/5 rounded-xl px-3 py-2.5">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-white text-xs font-semibold">{j.title}</p>
                  <span className="text-xs font-medium shrink-0" style={{ color: j.urgencyColor }}>{j.urgency}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-white/30" />
                    <p className="text-white/40 text-xs">{j.loc}</p>
                  </div>
                  <button className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#34D399]/20 text-[#34D399]">
                    {t('landing.preview.accept')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MockChrome>
  );
}

const TABS = [
  { id: 'landlord', labelKey: 'landing.preview.tab_landlord', icon: Building2, color: '#D4972A', preview: LandlordPreview },
  { id: 'tenant',   labelKey: 'landing.preview.tab_tenant',   icon: Users,     color: '#00C8BB', preview: TenantPreview },
  { id: 'handyman', labelKey: 'landing.preview.tab_handyman', icon: Wrench,    color: '#34D399', preview: HandymanPreview },
] as const;

// ── Hero ─────────────────────────────────────────────────────────────────────
// Signature moment: the product lives inside the hero. Switching role tabs
// swaps the dashboard mock and re-tints the headline accent and primary CTA.

function HeroSection() {
  const { t } = useT();
  const [role, setRole] = useState<RoleId>('landlord');
  const activeTab = TABS.find((tab) => tab.id === role)!;
  const ActivePreview = activeTab.preview;

  // Live launch promo, shown in the hero badge while redemptions remain
  // (RLS only exposes active, unexpired codes to anonymous visitors).
  const [launchPromo, setLaunchPromo] = useState<PromoCode | null>(null);
  useEffect(() => {
    supabase
      .from('promo_codes')
      .select('*')
      .eq('code', 'HAPPYHOMEOWNER')
      .maybeSingle()
      .then(({ data }) => setLaunchPromo((data as PromoCode) ?? null));
  }, []);
  const promoRemaining = launchPromo ? Math.max(0, launchPromo.max_uses - launchPromo.used_count) : 0;
  const promoLive = !!launchPromo && launchPromo.active && promoRemaining > 0 &&
    (!launchPromo.expires_at || new Date(launchPromo.expires_at) > new Date());

  return (
    <section className="bg-ink text-white px-6 pt-16 pb-20 lg:pt-20 lg:pb-24 overflow-hidden">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_1.1fr] gap-12 lg:gap-14 items-center">
        {/* Copy */}
        <div className="min-w-0 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-sm text-white/80 mb-6">
            <span
              className="w-2 h-2 rounded-full transition-colors duration-300"
              style={{ background: activeTab.color }}
            />
            {promoLive
              ? t('landing.hero.promoBadge', { code: launchPromo!.code, n: promoRemaining })
              : t('landing.hero.badge')}
          </div>
          <h1 className="font-display text-4xl md:text-5xl xl:text-6xl font-bold leading-[1.08] mb-6">
            {t('landing.hero.title')}{' '}
            <span className="transition-colors duration-300" style={{ color: activeTab.color }}>
              {t('landing.hero.titleAccent')}
            </span>
          </h1>
          <p className="text-lg text-white/70 max-w-xl mx-auto lg:mx-0 mb-10 leading-relaxed">
            {t('landing.hero.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
            <CTALink to="/signup" variant="accent" accent={activeTab.color}>
              {t('common.getStarted')}
            </CTALink>
            <CTALink to="/login" variant="outline-dark" arrow={false}>
              {t('landing.hero.signin')}
            </CTALink>
          </div>
        </div>

        {/* Product preview */}
        <div className="min-w-0">
          {/* Role tabs */}
          <div className="flex flex-wrap justify-center lg:justify-start gap-2 mb-5">
            {TABS.map((tab) => {
              const isActive = role === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setRole(tab.id)}
                  aria-pressed={isActive}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all"
                  style={
                    isActive
                      ? { background: tab.color, color: '#0D1F2D' }
                      : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }
                  }
                >
                  <tab.icon className="w-4 h-4" />
                  {t(tab.labelKey)}
                </button>
              );
            })}
          </div>

          <div className="overflow-x-auto rounded-2xl scrollbar-hide">
            <div className="min-w-[520px]">
              <ActivePreview />
            </div>
          </div>
          <p className="text-white/40 text-xs mt-4 text-center lg:text-left">
            {t(`landing.preview.cap_${role}`)}
          </p>
        </div>
      </div>
    </section>
  );
}

// ── How to Use ───────────────────────────────────────────────────────────────

function HowToUseSection() {
  const { t } = useT();
  const [role, setRole] = useState<RoleId>('landlord');
  const active = HOW_TO_USE.find((r) => r.id === role)!;
  const activeLabel = t(`landing.how.label_${active.id}`);

  return (
    <section className="py-20 px-6 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <SectionHeading
          eyebrow={t('landing.how.eyebrow')}
          title={t('landing.how.title')}
          subtitle={t('landing.how.subtitle')}
          className="mb-10 reveal"
        />

        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {HOW_TO_USE.map((r) => {
            const isActive = role === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setRole(r.id)}
                aria-pressed={isActive}
                className="flex items-center gap-2 px-3 sm:px-5 py-2.5 rounded-full text-sm font-semibold transition-all"
                style={isActive ? { background: r.color, color: '#0D1F2D' } : { background: '#e5e7eb', color: '#6b7280' }}
              >
                <r.icon className="w-4 h-4" />
                {t(`landing.how.label_${r.id}`)}
              </button>
            );
          })}
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="relative">
              {i < 3 && (
                <div className="hidden md:block absolute top-6 left-[calc(100%-8px)] w-full h-0.5 bg-gray-200 z-0" />
              )}
              <div className="relative z-10 bg-white border border-gray-100 rounded-2xl p-7 h-full">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-base mb-4"
                  style={{ background: active.color + '22', color: active.color }}
                >
                  {i + 1}
                </div>
                <h3 className="font-semibold text-gray-900 text-base mb-2">{t(`landing.how.${active.id}_s${i}_t`)}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{t(`landing.how.${active.id}_s${i}_d`)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <CTALink to="/signup" variant="accent" accent={active.color}>
            {t('landing.how.getStartedAs', { label: activeLabel })}
          </CTALink>
        </div>
      </div>
    </section>
  );
}

// ── FAQ ──────────────────────────────────────────────────────────────────────

function FaqSection() {
  const { t } = useT();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="py-20 px-6 bg-gray-50">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10 reveal">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-4">{t('landing.faq.title')}</h2>
          <p className="text-gray-600">{t('landing.faq.cantFind')} <a href="mailto:support@happyhomeshub.com" className="font-semibold text-gray-800 hover:underline">{t('ct.title')}</a></p>
        </div>
        <div className="space-y-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="font-semibold text-gray-900 text-sm">{t(`landing.faq.${i}q`)}</span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ml-3 ${open === i ? 'rotate-180' : ''}`} />
              </button>
              {open === i && (
                <div className="px-6 pb-4">
                  <p className="text-sm text-gray-600 leading-relaxed">{t(`landing.faq.${i}a`)}</p>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link to="/faq" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 hover:underline">
            {t('landing.faq.seeAll')} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function Landing() {
  const { t } = useT();
  usePageMeta(
    t('landing.metaTitle'),
    t('landing.metaDesc'),
    '/',
  );
  useReveal();
  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Handyman banner — single line, top of page */}
      <Link
        to="/signup"
        className="block bg-[#1B3A2F] text-white hover:bg-[#16302a] transition-colors"
      >
        <div className="max-w-6xl mx-auto px-6 py-2 flex items-center justify-center gap-2 text-sm">
          <Hammer className="w-4 h-4 text-leaf shrink-0" />
          <span className="text-center">
            <span className="font-semibold">{t('landing.banner.q')}</span>
            <span className="text-white/75"> {t('landing.banner.desc')}</span>
          </span>
          <ArrowRight className="w-4 h-4 text-leaf shrink-0" />
        </div>
      </Link>

      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <span className="sm:hidden"><HHLogo variant="mark" theme="light" size={36} /></span>
          <span className="hidden sm:block"><HHLogo variant="full" theme="light" size={48} /></span>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/blog"
              className="hidden sm:block text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors px-3 py-2"
            >
              Blog
            </Link>
            <Link
              to="/faq"
              className="hidden sm:block text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors px-3 py-2"
            >
              FAQ
            </Link>
            <Link
              to="/contact"
              className="hidden sm:block text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors px-3 py-2"
            >
              {t('landing.nav.contact')}
            </Link>
            <Link
              to="/login"
              className="hidden min-[480px]:block text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-3 sm:px-4 py-2"
            >
              {t('nav.signIn')}
            </Link>
            <Link
              to="/signup"
              className="text-sm font-semibold bg-ink text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-ink/85 transition-colors"
            >
              {t('nav.getStarted')}
            </Link>
            <LanguageSwitcher tone="light" className="ml-1" />
          </div>
        </div>
      </nav>

      {/* Hero — headline + live role-switchable product preview */}
      <HeroSection />

      {/* Social proof bar */}
      <section className="bg-white border-b border-gray-100 py-6 px-6">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-center">
          {[
            { value: t('landing.sp.trial'), label: t('landing.sp.trialLabel') },
            { value: t('landing.sp.price'), label: t('landing.sp.priceLabel') },
            { value: t('landing.sp.free'), label: t('landing.sp.freeLabel') },
            { value: t('landing.sp.features'), label: t('landing.sp.featuresLabel') },
          ].map((s) => (
            <div key={s.label}>
              <p className="font-display font-bold text-2xl text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            title={t('landing.feat.title')}
            subtitle={t('landing.feat.subtitle')}
            className="mb-12 reveal"
          />
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.key} className="rounded-2xl p-6 text-white flex flex-col reveal" style={{ background: f.bg }}>
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: f.color + '22' }}
                >
                  <f.icon className="w-5 h-5" style={{ color: f.color }} />
                </div>
                <h3 className="font-display text-xl font-bold mb-3" style={{ color: f.color }}>
                  {t('landing.feat.forRole', { role: t(`landing.feat.role_${f.key}`) })}
                </h3>
                <ul className="space-y-2 flex-1">
                  {[0, 1, 2, 3].map((i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-white/75">
                      <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: f.color }} />
                      {t(`landing.feat.${f.prefix}${i}`)}
                    </li>
                  ))}
                </ul>
                {f.key === 'handyman' && (
                  <div className="mt-4 pt-3 border-t border-white/10">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full" style={{ background: f.color + '22', color: f.color }}>
                      <CheckCircle className="w-3 h-3" /> {t('landing.feat.freeForever')}
                    </span>
                  </div>
                )}
                <Link to={f.to} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold hover:underline" style={{ color: f.color }}>
                  {t('common.learnMore')} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why choose us — quiet, single-accent grid */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <SectionHeading
            eyebrow={t('landing.why.eyebrow')}
            title={t('landing.why.title')}
            subtitle={t('landing.why.subtitle')}
            className="mb-12 reveal"
          />
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
            {[DollarSign, Layers, Shield, Bell, FileText, Mail].map((Icon, i) => (
              <div key={i} className="bg-gray-50 rounded-2xl p-7 border border-gray-100 reveal">
                <div className="w-11 h-11 rounded-xl bg-ink/5 flex items-center justify-center mb-5">
                  <Icon className="w-5 h-5 text-ink" />
                </div>
                <h3 className="font-semibold text-gray-900 text-base mb-2">{t(`landing.why.${i}t`)}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{t(`landing.why.${i}d`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How to use */}
      <HowToUseSection />

      {/* Pricing */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <SectionHeading
            title={t('landing.pricing.title')}
            subtitle={t('landing.pricing.subtitle')}
            className="mb-12 reveal"
          />
          <PricingComparison />
        </div>
      </section>

      {/* Trust strip */}
      <section className="py-5 px-6 bg-gray-50 border-y border-gray-100">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            {t('landing.trust.0')}
          </span>
          <span className="flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 shrink-0" />
            {t('landing.trust.1')}
          </span>
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 shrink-0" />
            {t('landing.trust.2')}
          </span>
        </div>
      </section>

      {/* FAQ */}
      <FaqSection />

      {/* CTA */}
      <section className="py-20 px-6 bg-ink text-center">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">{t('landing.cta2.title')}</h2>
        <p className="text-white/60 mb-8">{t('landing.cta2.subtitle')}</p>
        <CTALink to="/signup" variant="gold" size="lg">
          {t('rl.createFreeAccount')}
        </CTALink>
      </section>

      <Footer />
    </div>
  );
}
