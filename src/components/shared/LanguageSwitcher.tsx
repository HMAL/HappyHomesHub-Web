import { Globe } from 'lucide-react';
import { useT, Lang } from '../../lib/i18n';

/** Compact EN/ES toggle. `tone` adapts colors for dark vs light backgrounds. */
export default function LanguageSwitcher({ tone = 'light', className = '' }: { tone?: 'light' | 'dark'; className?: string }) {
  const { lang, setLang } = useT();
  const base = tone === 'dark' ? 'text-white/60' : 'text-gray-500';
  const activeCls = tone === 'dark' ? 'text-white font-semibold' : 'text-gray-900 font-semibold';

  const Btn = ({ value, label }: { value: Lang; label: string }) => (
    <button
      type="button"
      onClick={() => setLang(value)}
      aria-pressed={lang === value}
      className={`px-1.5 transition hover:opacity-80 ${lang === value ? activeCls : base}`}
    >
      {label}
    </button>
  );

  return (
    <div className={`inline-flex items-center gap-0.5 text-xs ${base} ${className}`}>
      <Globe className="w-3.5 h-3.5 mr-0.5" aria-hidden="true" />
      <Btn value="en" label="EN" />
      <span className="opacity-40">·</span>
      <Btn value="es" label="ES" />
    </div>
  );
}
