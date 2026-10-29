import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, Phone, Mail } from 'lucide-react';
import HHLogo from '../components/brand/HHLogo';
import Footer from '../components/shared/Footer';
import { usePageMeta } from '../lib/seo';
import { useT } from '../lib/i18n';

export default function Accessibility() {
  const { t } = useT();
  usePageMeta(
    t('acc.metaTitle'),
    t('acc.metaDesc'),
    '/accessibility',
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between">
        <HHLogo variant="full" theme="light" size={44} />
        <Link to="/" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition">
          <ArrowLeft className="w-4 h-4" /> {t('common.backToHome')}
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">{t('acc.eyebrow')}</p>
          <div className="flex items-center gap-3 mb-2">
            <Eye className="w-7 h-7 text-[#00C8BB]" />
            <h1 className="font-display text-4xl font-bold text-gray-900">{t('acc.title')}</h1>
          </div>
          <p className="text-sm text-gray-400">{t('acc.lastUpdated')}</p>
        </div>

        {/* Commitment */}
        <div className="bg-[#0D1F2D] rounded-2xl p-7 mb-8 text-white">
          <h2 className="font-display text-xl font-bold mb-3" style={{ color: '#00C8BB' }}>{t('acc.commitTitle')}</h2>
          <p className="text-white/80 text-sm leading-relaxed">
            {t('acc.commitBody')}
          </p>
        </div>

        {/* Standards */}
        <section className="mb-8">
          <h2 className="font-display text-xl font-bold text-gray-900 mb-3">{t('acc.standardsTitle')}</h2>
          <div className="text-sm text-gray-600 leading-relaxed space-y-3">
            <p>{t('acc.standardsP1')}</p>
            <p>{t('acc.standardsP2')}</p>
            <ul className="list-disc pl-5 space-y-2">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <li key={i}>{t(`acc.li${i}`)}</li>)}
            </ul>
          </div>
        </section>

        {/* We're Here to Help */}
        <section className="mb-8">
          <h2 className="font-display text-xl font-bold text-gray-900 mb-3">{t('acc.helpTitle')}</h2>
          <div className="text-sm text-gray-600 leading-relaxed space-y-3">
            <p>{t('acc.helpP1')}</p>
            <p>{t('acc.helpP2')}</p>
            <div className="bg-gray-50 rounded-xl p-5 space-y-3 mt-3">
              <a
                href="tel:5186676688"
                className="flex items-center gap-3 text-[#0D1F2D] font-semibold hover:underline"
                aria-label={t('acc.callAria')}
              >
                <Phone className="w-5 h-5 text-[#00C8BB] shrink-0" aria-hidden="true" />
                (518) 667-6688
              </a>
              <a
                href="mailto:accessibility@happyhomeshub.com"
                className="flex items-center gap-3 text-[#0D1F2D] font-semibold hover:underline"
                aria-label={t('acc.emailAria')}
              >
                <Mail className="w-5 h-5 text-[#00C8BB] shrink-0" aria-hidden="true" />
                accessibility@happyhomeshub.com
              </a>
            </div>
          </div>
        </section>

        {/* Known Limitations */}
        <section className="mb-8">
          <h2 className="font-display text-xl font-bold text-gray-900 mb-3">{t('acc.limitsTitle')}</h2>
          <div className="text-sm text-gray-600 leading-relaxed space-y-3">
            <p>{t('acc.limitsP1')}</p>
            <p>{t('acc.limitsP2')}</p>
          </div>
        </section>

        {/* Feedback */}
        <section className="mb-8">
          <h2 className="font-display text-xl font-bold text-gray-900 mb-3">{t('acc.feedbackTitle')}</h2>
          <div className="text-sm text-gray-600 leading-relaxed space-y-3">
            <p>{t('acc.feedbackP1')}</p>
            <p>{t('acc.feedbackP2')}</p>
          </div>
        </section>

        {/* Contact box */}
        <div className="bg-[#0D1F2D] rounded-2xl p-7 text-white mb-8">
          <h2 className="font-display text-lg font-bold mb-3">{t('acc.contactTitle')}</h2>
          <div className="space-y-2 text-sm text-white/80">
            <p><strong className="text-white">HappyHomesHub</strong></p>
            <p>
              {t('acc.phoneLabel')}{' '}
              <a href="tel:5186676688" className="text-[#00C8BB] hover:underline font-semibold">
                (518) 667-6688
              </a>
              {' '}{t('acc.hours')}
            </p>
            <p>
              {t('acc.emailLabel')}{' '}
              <a href="mailto:accessibility@happyhomeshub.com" className="text-[#00C8BB] hover:underline font-semibold">
                accessibility@happyhomeshub.com
              </a>
            </p>
            <p>
              {t('acc.generalSupport')}{' '}
              <a href="mailto:support@happyhomeshub.com" className="text-[#00C8BB] hover:underline font-semibold">
                support@happyhomeshub.com
              </a>
            </p>
          </div>
        </div>

        {/* Legal links */}
        <div className="border-t border-gray-100 pt-6 flex flex-wrap gap-4 text-sm text-gray-400">
          <Link to="/legal/privacy" className="hover:text-gray-700 underline">{t('acc.privacyPolicy')}</Link>
          <Link to="/legal/terms" className="hover:text-gray-700 underline">{t('acc.termsOfService')}</Link>
          <Link to="/contact" className="hover:text-gray-700 underline">{t('acc.contactUs')}</Link>
          <Link to="/" className="hover:text-gray-700">{t('acc.backHome')}</Link>
        </div>
      </div>

      <Footer />
    </div>
  );
}
