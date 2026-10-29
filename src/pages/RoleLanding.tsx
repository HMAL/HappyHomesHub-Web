import { Link } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle, Building2, Users, Wrench,
  DollarSign, FileText, Bell, Landmark, Calendar, Star,
} from 'lucide-react';
import HHLogo from '../components/brand/HHLogo';
import Footer from '../components/shared/Footer';
import PricingComparison from '../components/shared/PricingComparison';
import CTALink from '../components/ui/CTALink';
import { usePageMeta } from '../lib/seo';
import { useT } from '../lib/i18n';
import { useReveal } from '../lib/useReveal';

type RoleKey = 'landlord' | 'tenant' | 'handyman';

type IconC = React.FC<{ className?: string; style?: React.CSSProperties }>;

interface RoleConfig {
  key: RoleKey;
  primary: string;
  accent: string;
  path: string;
  benefitIcons: IconC[];
}

const ROLES: Record<RoleKey, RoleConfig> = {
  landlord: {
    key: 'landlord',
    primary: '#0D1F2D',
    accent: '#D4972A',
    path: '/for-landlords',
    benefitIcons: [DollarSign, Wrench, FileText, Building2],
  },
  tenant: {
    key: 'tenant',
    primary: '#12202E',
    accent: '#00C8BB',
    path: '/for-tenants',
    benefitIcons: [DollarSign, Wrench, Landmark, Bell],
  },
  handyman: {
    key: 'handyman',
    primary: '#1B3A2F',
    accent: '#34D399',
    path: '/for-handymen',
    benefitIcons: [DollarSign, Wrench, Calendar, Star],
  },
};

export default function RoleLanding({ roleKey }: { roleKey: RoleKey }) {
  const { t } = useT();
  const r = ROLES[roleKey];
  usePageMeta(t(`rl.${r.key}_metaTitle`), t(`rl.${r.key}_metaDesc`), r.path);
  useReveal();

  const roleIcon = { landlord: Building2, tenant: Users, handyman: Wrench }[r.key];
  const RoleIcon = roleIcon;

  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-40 bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between">
        <Link to="/"><HHLogo variant="full" theme="light" size={44} /></Link>
        <Link to="/" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition">
          <ArrowLeft className="w-4 h-4" /> {t('common.backToHome')}
        </Link>
      </nav>

      {/* Hero */}
      <section className="px-6 py-20 text-white" style={{ background: r.primary }}>
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm mb-6" style={{ background: r.accent + '22', color: r.accent }}>
            <RoleIcon className="w-4 h-4" /> {t(`rl.${r.key}_eyebrow`)}
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold leading-[1.1] mb-5">{t(`rl.${r.key}_h1`)}</h1>
          <p className="text-lg text-white/70 max-w-xl mx-auto mb-9 leading-relaxed">{t(`rl.${r.key}_intro`)}</p>
          <CTALink to="/signup" variant="accent" accent={r.accent} accentText={r.primary}>
            {t('rl.getStartedFree')}
          </CTALink>
        </div>
      </section>

      {/* Benefits */}
      <section className="px-6 py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="grid sm:grid-cols-2 gap-5">
            {r.benefitIcons.map((Icon, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 reveal">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: r.accent + '22' }}>
                    <Icon className="w-5 h-5" style={{ color: r.accent }} />
                  </div>
                  <h2 className="font-semibold text-gray-900 text-lg">{t(`rl.${r.key}_b${i}_t`)}</h2>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">{t(`rl.${r.key}_b${i}_d`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-16 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 text-center mb-10 reveal">{t('rl.howItWorks')}</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-50 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0" style={{ background: r.accent + '22', color: r.accent }}>{i + 1}</div>
                  <h3 className="font-semibold text-gray-900 text-base">{t(`rl.${r.key}_s${i}_t`)}</h3>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">{t(`rl.${r.key}_s${i}_d`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing comparison (landlords only) */}
      {r.key === 'landlord' && (
        <section className="px-6 py-16 bg-white border-t border-gray-100">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 text-center mb-3">{t('rl.lvs')}</h2>
            <p className="text-gray-600 text-center mb-10">{t('rl.lvsDesc')}</p>
            <PricingComparison />
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="px-6 py-16 bg-gray-50">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 text-center mb-8">{t('rl.commonQuestions')}</h2>
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="font-semibold text-gray-900 text-sm mb-1.5 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0" style={{ color: r.accent }} /> {t(`rl.${r.key}_f${i}_q`)}
                </p>
                <p className="text-sm text-gray-600 leading-relaxed">{t(`rl.${r.key}_f${i}_a`)}</p>
              </div>
            ))}
          </div>
          <p className="text-center mt-6 text-sm text-gray-500">
            {t('rl.seeThe')} <Link to="/faq" className="font-semibold text-gray-900 hover:underline">{t('rl.fullFaq')}</Link> {t('rl.orContact')}{' '}
            <Link to="/contact" className="font-semibold text-gray-900 hover:underline">{t('rl.contactUsLower')}</Link>.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16 text-center" style={{ background: r.primary }}>
        <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-3">{t('rl.readyStart')}</h2>
        <p className="text-white/60 mb-7">{t('rl.readyDesc')}</p>
        <CTALink to="/signup" variant="accent" accent={r.accent} accentText={r.primary} size="lg">
          {t('rl.createFreeAccount')}
        </CTALink>
      </section>

      <Footer />
    </div>
  );
}
