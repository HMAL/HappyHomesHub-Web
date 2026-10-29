import { Link } from 'react-router-dom';
import { useT } from '../../lib/i18n';
import HHLogo from '../brand/HHLogo';
import LanguageSwitcher from './LanguageSwitcher';

export default function Footer() {
  const { t } = useT();
  return (
    <footer className="bg-gray-950 border-t border-gray-800">
      {/* Main footer content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-8">
          {/* Brand */}
          <div>
            <Link to="/" className="inline-block hover:opacity-80 transition">
              <HHLogo variant="full" theme="dark" size={56} />
            </Link>
          </div>

          {/* Sitemap links */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-2">
            {[
              { to: '/for-landlords', label: t('nav.forLandlords') },
              { to: '/for-tenants', label: t('nav.forTenants') },
              { to: '/for-handymen', label: t('nav.forHandymen') },
              { to: '/blog', label: 'Blog' },
              { to: '/faq', label: 'FAQ' },
              { to: '/contact', label: t('footer.contact') },
            ].map((l) => (
              <Link key={l.to} to={l.to} className="text-sm text-gray-400 hover:text-white transition">
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Legal links */}
        <div className="mt-8 pt-6 border-t border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-gray-600">
            {t('footer.rights', { year: new Date().getFullYear() })}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/legal/terms" className="text-xs text-gray-500 hover:text-gray-300 transition">
              {t('footer.terms')}
            </Link>
            <Link to="/legal/privacy" className="text-xs text-gray-500 hover:text-gray-300 transition">
              {t('footer.privacy')}
            </Link>
            <Link to="/accessibility" className="text-xs text-gray-500 hover:text-gray-300 transition">
              {t('footer.accessibility')}
            </Link>
            <a href="mailto:support@happyhomeshub.com" className="text-xs text-gray-500 hover:text-gray-300 transition">
              {t('footer.contact')}
            </a>
            <LanguageSwitcher tone="dark" />
          </div>
        </div>
      </div>
    </footer>
  );
}
