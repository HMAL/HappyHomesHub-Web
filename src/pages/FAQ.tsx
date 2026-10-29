import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import HHLogo from '../components/brand/HHLogo';
import Footer from '../components/shared/Footer';
import { usePageMeta } from '../lib/seo';
import { useT } from '../lib/i18n';

// Stable category ids (used for anchors) + how many Q&A items each has.
const CATEGORY_DEFS: { id: string; emoji: string; count: number }[] = [
  { id: 'start', emoji: '🚀', count: 5 },
  { id: 'pricing', emoji: '💳', count: 7 },
  { id: 'homeowners', emoji: '🏠', count: 7 },
  { id: 'habitants', emoji: '🔑', count: 6 },
  { id: 'handymen', emoji: '🔧', count: 5 },
  { id: 'screening', emoji: '🛡️', count: 8 },
  { id: 'security', emoji: '🔒', count: 5 },
];

export default function FAQ() {
  const { t } = useT();
  const [open, setOpen] = useState<string | null>(null);
  usePageMeta(
    t('faq.metaTitle'),
    t('faq.metaDesc'),
    '/faq',
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

      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold mb-3">{t('faq.support')}</p>
          <h1 className="font-display text-4xl font-bold text-gray-900 mb-3">{t('faq.title')}</h1>
          <p className="text-gray-600">
            {t('faq.cantFind')}{' '}
            <a href="mailto:support@happyhomeshub.com" className="font-semibold text-gray-700 hover:underline">
              {t('ct.title')}
            </a>
          </p>
        </div>

        {/* Jump links */}
        <div className="flex flex-wrap gap-2 mb-12 pb-8 border-b border-gray-100">
          {CATEGORY_DEFS.map((cat) => (
            <a
              key={cat.id}
              href={`#faq-${cat.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-xs font-semibold text-gray-600 hover:border-gray-900 hover:text-gray-900 transition"
            >
              <span>{cat.emoji}</span> {t('faq.cat_' + cat.id)}
            </a>
          ))}
        </div>

        {/* Categories */}
        <div className="space-y-12">
          {CATEGORY_DEFS.map((cat) => (
            <div key={cat.id} id={`faq-${cat.id}`}>
              <h2 className="font-display text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span aria-hidden="true">{cat.emoji}</span>
                {t('faq.cat_' + cat.id)}
              </h2>
              <div className="space-y-2">
                {Array.from({ length: cat.count }).map((_, i) => {
                  const key = `${cat.id}-${i}`;
                  const isOpen = open === key;
                  return (
                    <div key={key} className="rounded-xl border border-gray-200 overflow-hidden">
                      <button
                        onClick={() => setOpen(isOpen ? null : key)}
                        className="w-full flex items-center justify-between px-5 py-4 text-left bg-white hover:bg-gray-50 transition"
                      >
                        <span className="font-semibold text-gray-900 text-sm pr-4">{t(`faq.${cat.id}_q${i}`)}</span>
                        <ChevronDown
                          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-4 bg-white">
                          <p className="text-sm text-gray-600 leading-relaxed">{t(`faq.${cat.id}_a${i}`)}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-2xl bg-[#0D1F2D] p-8 text-center">
          <h3 className="font-display text-xl font-bold text-white mb-2">{t('faq.stillQuestions')}</h3>
          <p className="text-white/60 text-sm mb-5">{t('faq.stillDesc')}</p>
          <a
            href="mailto:support@happyhomeshub.com"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm"
            style={{ background: '#D4972A', color: '#0D1F2D' }}
          >
            {t('lacct.emailSupport')}
          </a>
        </div>
      </div>

      <Footer />
    </div>
  );
}
