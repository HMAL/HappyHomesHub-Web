import { useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Clock, Calendar } from 'lucide-react';
import HHLogo from '../../components/brand/HHLogo';
import Footer from '../../components/shared/Footer';
import { usePageMeta } from '../../lib/seo';
import { useT } from '../../lib/i18n';
import { POSTS, getPost } from './posts';

const PRIMARY = '#0D1F2D';
const ACCENT = '#D4972A';

function fmtDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' });
}

function BlogNav() {
  const { t } = useT();
  return (
    <nav className="sticky top-0 z-40 bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between">
      <Link to="/"><HHLogo variant="full" theme="light" size={44} /></Link>
      <Link to="/" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition">
        <ArrowLeft className="w-4 h-4" /> {t('common.backToHome')}
      </Link>
    </nav>
  );
}

export function BlogIndex() {
  const { t, lang } = useT();
  usePageMeta(
    t('blog.metaTitle'),
    t('blog.metaDesc'),
    '/blog',
  );
  return (
    <div className="min-h-screen bg-white">
      <BlogNav />
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">{t('blog.eyebrow')}</p>
          <h1 className="font-display text-4xl font-bold text-gray-900 mb-3">{t('blog.title')}</h1>
          <p className="text-gray-500">{t('blog.subtitle')}</p>
        </div>

        <div className="space-y-5">
          {POSTS.map((post) => (
            <Link
              key={post.slug}
              to={`/blog/${post.slug}`}
              className="block rounded-2xl border border-gray-200 p-6 hover:border-gray-900 hover:shadow-md transition"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ background: ACCENT + '22', color: '#8a6312' }}>{post.category[lang]}</span>
                <span className="text-xs text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {t('blog.minRead', { n: post.readMins })}</span>
              </div>
              <h2 className="font-display text-xl font-bold text-gray-900 mb-1.5">{post.title[lang]}</h2>
              <p className="text-sm text-gray-500 mb-3">{post.excerpt[lang]}</p>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900">
                {t('blog.readMore')} <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}

export function BlogPost() {
  const { t, lang } = useT();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const post = slug ? getPost(slug) : undefined;

  usePageMeta(
    post ? `${post.title[lang]} | HappyHomesHub Blog` : t('blog.notFoundMeta'),
    post?.excerpt[lang] ?? '',
    post ? `/blog/${post.slug}` : '/blog',
  );

  useEffect(() => { window.scrollTo(0, 0); }, [slug]);

  // BlogPosting structured data — enables Article rich results and gives AI
  // answer engines clean provenance. Injected client-side; Googlebot renders JS.
  useEffect(() => {
    if (!post) return;
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title[lang],
      description: post.excerpt[lang],
      dateModified: post.updated,
      inLanguage: lang === 'es' ? 'es' : 'en',
      mainEntityOfPage: `https://happyhomeshub.com/blog/${post.slug}`,
      author: { '@type': 'Organization', name: 'HappyHomesHub', url: 'https://happyhomeshub.com' },
      publisher: {
        '@type': 'Organization',
        name: 'HappyHomesHub',
        logo: { '@type': 'ImageObject', url: 'https://happyhomeshub.com/hhh-icon.svg' },
      },
    });
    document.head.appendChild(el);
    return () => { document.head.removeChild(el); };
  }, [post, lang]);

  if (!post) {
    return (
      <div className="min-h-screen bg-white">
        <BlogNav />
        <div className="max-w-3xl mx-auto px-6 py-24 text-center">
          <p className="text-gray-500 mb-4">{t('blog.notFound')}</p>
          <button onClick={() => navigate('/blog')} className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: PRIMARY }}>
            {t('blog.backToBlog')}
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <BlogNav />
      <article className="max-w-2xl mx-auto px-6 py-16">
        <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition mb-8">
          <ArrowLeft className="w-4 h-4" /> {t('blog.allArticles')}
        </Link>

        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ background: ACCENT + '22', color: '#8a6312' }}>{post.category[lang]}</span>
        <h1 className="font-display text-4xl font-bold text-gray-900 mt-4 mb-3 leading-tight">{post.title[lang]}</h1>
        <div className="flex items-center gap-4 text-xs text-gray-400 mb-10">
          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {t('blog.updated', { date: fmtDate(post.updated, lang === 'es' ? 'es-ES' : 'en-US') })}</span>
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {t('blog.minRead', { n: post.readMins })}</span>
        </div>

        <div className="space-y-8">
          {post.sections.map((s, i) => (
            <section key={i}>
              {s.heading && <h2 className="font-display text-xl font-bold text-gray-900 mb-3">{s.heading[lang]}</h2>}
              {s.body.map((p, j) => (
                <p key={j} className="text-[15px] text-gray-700 leading-relaxed mb-3">{p[lang]}</p>
              ))}
            </section>
          ))}
        </div>

        <div className="mt-14 rounded-2xl p-7 text-center" style={{ background: PRIMARY }}>
          <h3 className="font-display text-xl font-bold text-white mb-2">{t('blog.ctaTitle')}</h3>
          <p className="text-white/60 text-sm mb-5">{t('blog.ctaDesc')}</p>
          <Link to="/signup" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm" style={{ background: ACCENT, color: PRIMARY }}>
            {t('rl.getStartedFree')} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <p className="text-xs text-gray-400 mt-10 leading-relaxed">
          {t('blog.disclaimer')}
        </p>
      </article>
      <Footer />
    </div>
  );
}
