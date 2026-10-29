import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Sparkles, ArrowRight } from 'lucide-react';
import { useIsSuper } from '../../lib/useIsSuper';
import { useT } from '../../lib/i18n';

interface Props {
  /** Short feature name, e.g. "Expense tracking". */
  title: string;
  /** One-line pitch shown under the title. */
  description?: string;
  children: ReactNode;
  /** Render a compact inline lock instead of a full card (for buttons/rows). */
  compact?: boolean;
}

const PRIMARY = '#0D1F2D';
const ACCENT = '#D4972A';

/**
 * Gates Super-only features. Renders children for Super landlords; otherwise shows
 * an upsell that leans on the "$3 more" decoy framing.
 */
export default function SuperLock({ title, description, children, compact }: Props) {
  const { isSuper, loading } = useIsSuper();
  const { t } = useT();
  if (loading) return null;
  if (isSuper) return <>{children}</>;

  if (compact) {
    return (
      <Link
        to="/landlord/account/billing"
        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-dashed hover:bg-amber-50 transition"
        style={{ borderColor: ACCENT, color: PRIMARY }}
      >
        <Lock className="w-3.5 h-3.5" style={{ color: ACCENT }} />
        {title} {t('cmp.unlockSuper')}
      </Link>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-dashed p-7 text-center" style={{ borderColor: ACCENT, background: '#FBF6EC' }}>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: ACCENT + '22' }}>
        <Sparkles className="w-6 h-6" style={{ color: ACCENT }} />
      </div>
      <h2 className="font-display text-xl font-bold text-gray-900 mb-1">{title} {t('cmp.isSuperFeature')}</h2>
      <p className="text-sm text-gray-500 mb-5">
        {description ?? t('cmp.unlockUpgrade')} {t('cmp.itsJustPre')} <strong>{t('cmp.threeMore')}</strong> {t('cmp.perPropertySuffix')}
      </p>
      <Link
        to="/landlord/account/billing"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition hover:opacity-90"
        style={{ background: PRIMARY, color: ACCENT }}
      >
        {t('cmp.upgradeSuper')} <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
