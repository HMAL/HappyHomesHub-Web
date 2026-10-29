import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, MessageSquare, CheckCircle, Send } from 'lucide-react';
import HHLogo from '../components/brand/HHLogo';
import Footer from '../components/shared/Footer';
import { supabase } from '../lib/supabase';
import { usePageMeta } from '../lib/seo';
import { useT } from '../lib/i18n';

const PRIMARY = '#0D1F2D';
const ACCENT = '#D4972A';

export default function Contact() {
  const { t } = useT();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [company, setCompany] = useState(''); // honeypot
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  usePageMeta(
    t('ct.metaTitle'),
    t('ct.metaDesc'),
    '/contact',
  );

  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  const canSubmit = name.trim() && validEmail && message.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) { setError(t('ct.errFill')); return; }
    setSending(true);
    setError('');
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('contact', {
        body: { name: name.trim(), email: email.trim(), message: message.trim(), company },
      });
      // A non-2xx response surfaces as fnErr (FunctionsHttpError) with the real
      // reason in fnErr.context (the Response). Pull it out so failures are
      // diagnosable instead of hidden behind a generic message.
      if (fnErr) {
        let detail = fnErr.message;
        try {
          const ctx = (fnErr as { context?: Response }).context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.clone().json();
            if (body?.error) detail = body.error;
          }
        } catch { /* body not JSON — keep fnErr.message */ }
        console.error('[contact] function error:', detail, fnErr);
        throw new Error(detail);
      }
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setSent(true);
    } catch (err) {
      console.error('[contact] submit failed:', err);
      setError(t('ct.errGeneric'));
    } finally {
      setSending(false);
    }
  }

  const inputCls = 'w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 transition';

  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-40 bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between">
        <Link to="/"><HHLogo variant="full" theme="light" size={44} /></Link>
        <Link to="/" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition">
          <ArrowLeft className="w-4 h-4" /> {t('common.backToHome')}
        </Link>
      </nav>

      <div className="max-w-xl mx-auto px-6 py-16">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold mb-3">{t('ct.getInTouch')}</p>
          <h1 className="font-display text-4xl font-bold text-gray-900 mb-3">{t('ct.title')}</h1>
          <p className="text-gray-600">{t('ct.subtitle')}</p>
        </div>

        {sent ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
            <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-3" />
            <h2 className="font-display text-xl font-bold text-gray-900 mb-1">{t('ct.sent')}</h2>
            <p className="text-sm text-gray-600">{t('ct.sentDesc', { name: name.split(' ')[0] || t('hdash.there'), email })}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>}

            <div>
              <label htmlFor="c-name" className="block text-sm font-medium text-gray-700 mb-1.5">{t('ct.yourName')}</label>
              <input id="c-name" type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Jane Doe" />
            </div>
            <div>
              <label htmlFor="c-email" className="block text-sm font-medium text-gray-700 mb-1.5">{t('ct.email')}</label>
              <input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="jane@example.com" />
              {email && !validEmail && <p className="text-xs text-red-500 mt-1">{t('ct.invalidEmail')}</p>}
            </div>
            <div>
              <label htmlFor="c-message" className="block text-sm font-medium text-gray-700 mb-1.5">{t('ct.message')}</label>
              <textarea id="c-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={5} className={`${inputCls} resize-none`} placeholder={t('ct.messagePh')} />
            </div>

            {/* Honeypot — hidden from real users */}
            <input
              type="text" tabIndex={-1} autoComplete="off" value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="hidden" aria-hidden="true"
            />

            <button
              type="submit"
              disabled={sending || !canSubmit}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-50"
              style={{ background: PRIMARY }}
            >
              {sending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? t('ct.sending') : t('ct.sendMessage')}
            </button>
          </form>
        )}

        {/* Direct contact options */}
        <div className="mt-8 grid sm:grid-cols-2 gap-4">
          <a href="mailto:support@happyhomeshub.com" className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 hover:border-gray-900 transition">
            <Mail className="w-5 h-5" style={{ color: ACCENT }} />
            <div>
              <p className="text-sm font-semibold text-gray-900">{t('ct.emailUs')}</p>
              <p className="text-xs text-gray-400">support@happyhomeshub.com</p>
            </div>
          </a>
          <Link to="/faq" className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 hover:border-gray-900 transition">
            <MessageSquare className="w-5 h-5" style={{ color: ACCENT }} />
            <div>
              <p className="text-sm font-semibold text-gray-900">{t('lacct.browseFaq')}</p>
              <p className="text-xs text-gray-400">{t('lacct.faqDesc')}</p>
            </div>
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  );
}
