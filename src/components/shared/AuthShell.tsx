import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import HHLogo from '../brand/HHLogo';
import Footer from './Footer';
import LanguageSwitcher from './LanguageSwitcher';
import { useT } from '../../lib/i18n';

const PANEL_POINTS = [
  { key: 'auth.panel.p0', color: '#D4972A' },
  { key: 'auth.panel.p1', color: '#00C8BB' },
  { key: 'auth.panel.p2', color: '#34D399' },
];

/** Split-screen shell for auth pages: brand panel on the left (desktop only),
 *  form content on the right. Keeps login/signup/reset visually consistent. */
export default function AuthShell({
  children,
  maxWidth = 'max-w-md',
}: {
  children: ReactNode;
  /** Tailwind max-width class for the form column. */
  maxWidth?: string;
}) {
  const { t } = useT();
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="flex-1 grid lg:grid-cols-[0.95fr_1.05fr]">
        {/* Brand panel */}
        <aside className="hidden lg:flex flex-col justify-between bg-ink text-white p-12 xl:p-16">
          <Link to="/" className="inline-block w-fit hover:opacity-80 transition">
            <HHLogo variant="full" theme="dark" size={52} />
          </Link>
          <div className="py-12">
            <h2 className="font-display text-4xl font-bold leading-tight mb-9 max-w-md">
              {t('auth.panel.title')}
            </h2>
            <ul className="space-y-4">
              {PANEL_POINTS.map((item) => (
                <li key={item.key} className="flex items-center gap-3 text-white/80 text-base">
                  <CheckCircle className="w-5 h-5 shrink-0" style={{ color: item.color }} />
                  {t(item.key)}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-white/40 text-xs">{t('landing.trust.0')}</p>
        </aside>

        {/* Form side */}
        <main className="flex flex-col items-center justify-center px-4 py-12">
          <Link to="/" className="lg:hidden mb-8">
            <HHLogo variant="full" theme="light" size={52} />
          </Link>
          <div className={`w-full ${maxWidth}`}>{children}</div>
          <div className="mt-6">
            <LanguageSwitcher tone="light" />
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
